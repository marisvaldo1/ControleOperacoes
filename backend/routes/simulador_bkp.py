"""
routes/simulador.py — API do Simulador The Wheel (integração tastytrade)
Escopo: módulo simulador EXCLUSIVAMENTE

Rotas registradas (prefixo /api/simulador no server.py):
  GET  /api/simulador/status    — status da integração + premissas (sem expor segredos)
  GET  /api/simulador/universo  — cotações reais do universo, filtradas por limite de ação/lote
  GET  /api/simulador/cadeia    — cadeia de opções de 1 ativo (prêmios reais)
  GET  /api/simulador/premios   — resumo de prêmios diário/semanal para até 15 ativos
  GET  /api/simulador/strikes   — strikes de 1 vencimento + delta, PoP, break-even, anualizado
  GET  /api/simulador/conta     — saldo da conta (tastytrade ou configuração manual)
  POST /api/simulador/comparar  — cálculo puro dos cenários (sem chamada externa)

Credenciais (backend/.env):
  TASTYTRADE_CLIENT_ID, TASTYTRADE_CLIENT_SECRET, TASTYTRADE_REFRESH_TOKEN,
  TASTYTRADE_ACCOUNT_NUMBER, TASTYTRADE_BASE_URL, TASTYTRADE_USER_AGENT

Zero mock: preços, prêmios e dividendos vêm da API do tastytrade.
Quando um dado não existe na API, o campo volta como null e a premissa é
explicitada em `PREMISSAS` (retornadas por /status e /comparar).
"""
from flask    import Blueprint, request, jsonify
from datetime import date, datetime, timedelta
import math
import os
import random
import ssl
import threading
import time

import requests
import requests.adapters

import db

# Bundle de certificados: certifi + CA corporativa quando presente em
# backend/certs/ca-bundle.pem. A rede corporativa intercepta TLS de
# api.tastyworks.com com certificado próprio (webfilter.correiosnet.int);
# sem esta CA o requests falha com CERTIFICATE_VERIFY_FAILED (502 sem_conexao).
_BUNDLE_CA = os.path.normpath(os.path.join(
    os.path.dirname(os.path.abspath(__file__)), '..', 'certs', 'ca-bundle.pem'))

# O certificado do appliance corporativo não tem AKI/SKI e por isso é
# rejeitado pelo OpenSSL (Missing Authority Key Identifier). O truststore
# valida a cadeia com o repositório de certificados do Windows — o mesmo
# caminho usado pelo Chrome — e resolve a falha sem desligar a validação.
try:
    import truststore
except ImportError:      # pragma: no cover
    truststore = None


class _AdaptadorTLS(requests.adapters.HTTPAdapter):
    """HTTPAdapter com SSLContext próprio (restrito a esta sessão)."""

    def __init__(self, ssl_context=None, **kwargs):
        self._ssl_context = ssl_context
        super().__init__(**kwargs)

    def init_poolmanager(self, connections, maxsize, block=False, **pool_kwargs):
        pool_kwargs['ssl_context'] = self._ssl_context
        return super().init_poolmanager(connections, maxsize, block, **pool_kwargs)


def _criar_sessao():
    """Sessão HTTP exclusiva do simulador (não afeta os demais módulos)."""
    sess = requests.Session()
    if truststore is not None:
        try:
            ctx = truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
            ctx.check_hostname = True
            ctx.verify_mode = ssl.CERT_REQUIRED
            if os.path.exists(_BUNDLE_CA):
                ctx.load_verify_locations(cafile=_BUNDLE_CA)
            sess.mount('https://', _AdaptadorTLS(ctx))
            sess.verify = True
            return sess
        except Exception:
            pass
    sess.verify = _BUNDLE_CA if os.path.exists(_BUNDLE_CA) else True
    return sess


_sess = _criar_sessao()

simulador_bp = Blueprint('simulador', __name__)

# ─── Constantes do módulo ─────────────────────────────────────────────────────
MULTIPLICADOR          = 100      # 1 contrato de opção = 100 ações
LIMITE_SIMBOLOS_COTACAO = 100      # limite da API /market-data/by-type por requisição
LIMITE_CANDIDATOS       = 15       # ativos analisados por rodada de prêmios
TTL_COTACAO             = 60       # segundos
TTL_CADEIA              = 300      # segundos
LIMITE_ACAO_PADRAO      = 36.0     # US$ por ação  (regra da estratégia)
LIMITE_LOTE_PADRAO      = 3600.0   # US$ por lote  (regra da estratégia)
RISCO_MAX_POSICAO_PADRAO = 25.0    # %  (RiscoMaximoPorPosicaoPercent — bloqueio por saldo)
DISTANCIA_PADRAO        = 5.0      # % de distância do strike
DIAS_PADRAO             = 5        # dias corridos do vencimento semanal

# Cálculo financeiro (Black-Scholes) — ver seção "CÁLCULO FINANCEIRO"
DIAS_PREGAO_ANO         = 252      # pregões por ano (conversão DTE → anos)
TAXA_LIVRE_RISCO        = 0.04     # 4% a.a. usada no Black-Scholes
IV_MIN, IV_MAX          = 0.005, 5.0

# Campo de configuração (tabela configuracoes) com o saldo em US$ que o
# usuário informa para as operações de opções. Usado como fallback quando a
# tastytrade não devolve o saldo da conta.
CHAVE_SALDO_USD         = 'saldoOpcoesUsd'

# Dados de identificação do ativo (empresa, setor, atividade e perfil) — a
# tastytrade não os expõe, então vêm do yfinance. Cache longo porque mudam
# raramente; consultas que falham são retentadas em 10 minutos.
TTL_PERFIL              = 86400    # 24 horas
TTL_PERFIL_ERRO         = 600      # 10 minutos
THREADS_PERFIL          = 6        # paralelismo das consultas ao yfinance

# Universo padrão: ativos com opções semanais/diárias listadas na tastytrade.
# É apenas a lista de símbolos consultada — preços e prêmios são sempre reais.
UNIVERSO_PADRAO = [
    # ETFs / índices com vencimentos semanais e diários
    'SPY', 'QQQ', 'IWM', 'DIA', 'XLF', 'XLE', 'XOP', 'SMH', 'KRE',
    'GLD', 'SLV', 'USO', 'TLT', 'HYG', 'EEM', 'VIXY', 'SOXL', 'TQQQ',
    'SQQQ', 'FNGU', 'LABU', 'UDOW', 'SDOW',
    # Ações com opções semanais
    'F', 'AAL', 'DAL', 'UAL', 'CCL', 'RCL', 'SOFI', 'RIVN', 'LCID',
    'NIO', 'XPEV', 'PLUG', 'RIOT', 'MARA', 'CLSK', 'CIFR', 'WULF',
    'IREN', 'TSLA', 'NVDA', 'AMD', 'MU', 'INTC', 'GM', 'PBR', 'VALE',
    'ITUB', 'BBD', 'BABA', 'JD', 'PDD', 'SNAP', 'PINS', 'HOOD', 'COIN',
    'PYPL', 'OXY', 'CVE', 'MRO', 'WBA', 'CVS', 'RKT', 'UWMC', 'OPEN',
    'DKNG', 'PENN', 'MGM', 'DIS', 'BAC', 'C', 'GE', 'SIRI', 'WBD',
    'PARA', 'GPRO', 'BB', 'NOK', 'KO', 'PEP',
]

# Premissas dos cálculos — exibidas na tela e devolvidas pela API.
PREMISSAS = [
    'Prêmio da opção = preço médio entre bid e ask (mid); sem bid/ask, usa mark e, '
    'em último caso, o último preço negociado.',
    'Capital por lote = preço atual da ação × 100 (1 contrato). Para PUT cash-secured '
    'o colateral exato seria strike × 100.',
    'Prêmio diário equivalente = prêmio semanal ÷ número de dias (corridos até o '
    'vencimento semanal, editável).',
    'Ciclo dos vencimentos = campo expiration-type da tastytrade (Regular, Weekly, '
    'Monthly, Quarterly, Daily). Vencimentos "diários" = série de dias consecutivos '
    'seg-qui, típica de SPY/QQQ; ações como BB só têm ciclo semanal/mensal.',
    'Distância do strike = preço atual × (1 ± %). CALL usa o strike imediatamente '
    'acima do alvo; PUT, o imediatamente abaixo.',
    'Cenário conservador e arrojado consideram ativos com preço ≤ 50% do preço da '
    'ação de referência, respeitando o limite por ação e por lote.',
    'Bloqueio por saldo: capital do lote acima de RiscoMaximoPorPosicaoPercent (25%) '
    'do capital de referência impede a indicação.',
    'Cenário arrojado considera apenas ações pagadoras de dividendos confirmadas pela '
    'API (campo dividend-amount) e prioriza venda de CALL.',
    'Recomendação: ativo pagador de dividendos → BUY and HOLD; sem dividendos → '
    'SWING TRADE, usando os lucros liberados pela operação principal.',
    'Nenhuma ordem é enviada à corretora: o módulo é somente leitura.',
]


# ─── Erros do módulo ──────────────────────────────────────────────────────────
class TastyError(Exception):
    """Erro da integração tastytrade com código legível para a front-end."""

    def __init__(self, codigo, mensagem, status=502):
        super().__init__(mensagem)
        self.codigo  = codigo
        self.mensagem = mensagem
        self.status   = status


def _erro_response(erro):
    if isinstance(erro, TastyError):
        return jsonify({
            'success': False,
            'error':   erro.mensagem,
            'codigo':  erro.codigo,
            'premissas': PREMISSAS,
        }), erro.status
    return jsonify({'success': False, 'error': str(erro), 'codigo': 'erro_inesperado'}), 500


# ─── Configuração (.env) ──────────────────────────────────────────────────────
def _config():
    base = (os.getenv('TASTYTRADE_BASE_URL') or 'https://api.tastyworks.com').strip()
    return {
        'client_id':      os.getenv('TASTYTRADE_CLIENT_ID', '').strip(),
        'client_secret':  os.getenv('TASTYTRADE_CLIENT_SECRET', '').strip(),
        'refresh_token':  os.getenv('TASTYTRADE_REFRESH_TOKEN', '').strip(),
        'account_number': os.getenv('TASTYTRADE_ACCOUNT_NUMBER', '').strip(),
        'base_url':       base.rstrip('/'),
        'user_agent':     os.getenv('TASTYTRADE_USER_AGENT', 'controle-operacoes/1.0').strip(),
    }


# ─── Token OAuth2 (15 min, cacheado) ──────────────────────────────────────────
_token      = {'access_token': None, 'expira_em': 0.0}
_token_lock = threading.Lock()


def _limpar_token():
    with _token_lock:
        _token['access_token'] = None
        _token['expira_em']    = 0.0


def _obter_access_token():
    """Troca o refresh token por um access token de 15 minutos (cacheado)."""
    cfg = _config()
    if not cfg['refresh_token']:
        raise TastyError(
            'refresh_token_ausente',
            'TASTYTRADE_REFRESH_TOKEN não configurado em backend/.env. '
            'Gere em my.tastytrade.com → Manage → My Profile → API → OAuth '
            'Applications → Create Grant.', 400)
    if not cfg['client_secret']:
        raise TastyError(
            'client_secret_ausente',
            'TASTYTRADE_CLIENT_SECRET não configurado em backend/.env.', 400)

    with _token_lock:
        agora = time.time()
        if _token['access_token'] and agora < _token['expira_em'] - 60:
            return _token['access_token']

        payload = {
            'grant_type':    'refresh_token',
            'refresh_token': cfg['refresh_token'],
            'client_secret': cfg['client_secret'],
        }
        if cfg['client_id']:
            payload['client_id'] = cfg['client_id']

        try:
            resp = _chamar(
                'POST',
                f"{cfg['base_url']}/oauth/token",
                json=payload,
                headers={
                    'User-Agent':    cfg['user_agent'],
                    'Content-Type':  'application/json',
                    'Accept':        'application/json',
                },
                timeout=20,
            )
        except requests.RequestException as exc:
            raise TastyError('sem_conexao', f'Falha ao conectar na API tastytrade: {exc}', 502)

        if resp.status_code >= 400:
            raise TastyError('oauth_recusado', _mensagem_erro(resp), resp.status_code)

        corpo = resp.json()
        dados = corpo.get('data') if isinstance(corpo.get('data'), dict) else corpo
        token = dados.get('access_token')
        if not token:
            raise TastyError('token_ausente', 'API não retornou access_token.', 502)

        expira = float(dados.get('expires_in') or 900)
        _token['access_token'] = token
        _token['expira_em']    = time.time() + expira
        return token


# ─── HTTP com retry/backoff ───────────────────────────────────────────────────
def _mensagem_erro(resp):
    try:
        corpo = resp.json()
        err   = corpo.get('error') or {}
        msg   = err.get('message') or corpo.get('message')
        cod   = err.get('code')
        if msg and cod:
            return f'{cod}: {msg}'
        return msg or f'HTTP {resp.status_code}'
    except Exception:
        return f'HTTP {resp.status_code}'


def _chamar(metodo, url, tentativas=3, **kwargs):
    """Requisição HTTP repetindo em falhas de TLS/conexão.

    A rede corporativa intercepta TLS de forma intermitente e às vezes
    apresenta cadeia incompleta, causando CERTIFICATE_VERIFY_FAILED.
    Uma nova conexão normalmente resolve; não se trata como falha definitiva.
    """
    ultimo = None
    for i in range(tentativas):
        try:
            return _sess.request(metodo, url, **kwargs)
        except (requests.exceptions.SSLError,
                requests.exceptions.ConnectionError) as exc:
            ultimo = exc
            time.sleep(0.4 * (i + 1))
    raise ultimo


def _tt_get(caminho, params=None, timeout=25):
    """GET autenticado na tastytrade com retry em 401/429."""
    cfg  = _config()
    url  = caminho if caminho.startswith('http') else cfg['base_url'] + caminho
    retry = 0
    while True:
        token = _obter_access_token()
        try:
            resp = _chamar(
                'GET',
                url,
                params=params,
                headers={
                    'Authorization': f'Bearer {token}',
                    'User-Agent':    cfg['user_agent'],
                    'Accept':        'application/json',
                },
                timeout=timeout,
            )
        except requests.RequestException as exc:
            raise TastyError('sem_conexao', f'Falha ao conectar na API tastytrade: {exc}', 502)

        if resp.status_code == 401 and retry < 1:
            _limpar_token()
            retry += 1
            continue
        if resp.status_code == 429 and retry < 3:
            time.sleep(0.5 * (2 ** retry) + random.uniform(0, 0.3))
            retry += 1
            continue
        if resp.status_code >= 400:
            raise TastyError('api_erro', _mensagem_erro(resp), resp.status_code)

        try:
            return resp.json()
        except ValueError:
            raise TastyError('resposta_invalida', 'Resposta da API não é JSON.', 502)


# ─── Cache em memória ─────────────────────────────────────────────────────────
_cache      = {}
_cache_lock = threading.Lock()


def _cache_get(chave, ttl):
    with _cache_lock:
        item = _cache.get(chave)
        if item and (time.time() - item[0]) < ttl:
            return item[1]
    return None


def _cache_set(chave, valor):
    with _cache_lock:
        _cache[chave] = (time.time(), valor)
        if len(_cache) > 500:            # evita crescimento indefinido
            mais_antigo = min(_cache, key=lambda k: _cache[k][0])
            _cache.pop(mais_antigo, None)


# ─── Empresa / setor / perfil do ativo (yfinance) ────────────────────────────
# A API da tastytrade não devolve setor nem perfil do ativo. O yfinance traz
# nome da empresa, setor, atividade e beta — este último alimenta o rótulo de
# perfil de risco exibido na lista de candidatos.

_SETORES_GICS = {
    'Communication Services': 'Serviços de Comunicação',
    'Consumer Cyclical':      'Consumo Discricionário',
    'Consumer Defensive':     'Consumo Básico',
    'Energy':                 'Energia',
    'Financial Services':     'Serviços Financeiros',
    'Healthcare':             'Saúde',
    'Industrials':            'Bens Industriais',
    'Real Estate':            'Imobiliário',
    'Technology':             'Tecnologia',
    'Utilities':              'Serviços Públicos',
}


def _traduz_setor(setor):
    """Traduz os setores GICS para português; desconhecidos ficam originais."""
    if not setor:
        return None
    return _SETORES_GICS.get(setor, setor)


def _rotulo_perfil(beta):
    """Perfil de risco derivado do beta (ex.: "Beta 1,72 · alta volatilidade")."""
    if beta is None:
        return None
    if beta >= 1.20:
        risco = 'alta volatilidade'
    elif beta >= 0.80:
        risco = 'volatilidade moderada'
    else:
        risco = 'baixa volatilidade'
    return f'Beta {beta:.2f}'.replace('.', ',') + f' · {risco}'


def _dados_perfil(simbolo):
    """Consulta o yfinance e devolve empresa, setor, atividade e perfil."""
    import yfinance as yf                      # import local: pesado e opcional

    info = yf.Ticker(simbolo).info or {}
    return {
        'empresa':   info.get('longName') or info.get('shortName'),
        'setor':     _traduz_setor(info.get('sector')),
        'atividade': info.get('industry'),
        'perfil':    _rotulo_perfil(_float(info.get('beta'))),
    }


def _perfil_em_cache(simbolo):
    """Perfil em cache: 24h quando a consulta deu certo, 10min quando falhou."""
    with _cache_lock:
        item = _cache.get(f'perfil:{simbolo}')
    if not item:
        return None
    ttl = TTL_PERFIL_ERRO if item[1].get('erro') else TTL_PERFIL
    return item[1] if (time.time() - item[0]) < ttl else None


def _perfis_dos_ativos(simbolos):
    """Empresa/setor/atividade/perfil de vários ativos, em paralelo.

    Só os símbolos sem cache são consultados; a primeira chamada do universo
    leva alguns segundos e as seguintes usam o cache de 24 horas.
    """
    saida, faltantes = {}, []
    for simb in simbolos:
        item = _perfil_em_cache(simb)
        if item is None:
            faltantes.append(simb)
        else:
            saida[simb] = item

    if not faltantes:
        return saida

    from concurrent.futures import ThreadPoolExecutor, as_completed

    def _buscar(simb):
        try:
            return simb, _dados_perfil(simb)
        except Exception as erro:              # falha de rede não derruba a lista
            return simb, {'erro': True,
                          'empresa': None, 'setor': None,
                          'atividade': None, 'perfil': None,
                          'detalhe': str(erro)[:200]}

    with ThreadPoolExecutor(max_workers=min(THREADS_PERFIL, len(faltantes))) as pool:
        futures = [pool.submit(_buscar, s) for s in faltantes]
        for futuro in as_completed(futures):
            simb, dados = futuro.result()
            # falhas também entram no cache (com TTL curto) para não repetir
            # a consulta a cada chamada do endpoint
            _cache_set(f'perfil:{simb}', dados)
            saida[simb] = dados
    return saida


# ─── Helpers de parse ─────────────────────────────────────────────────────────
def _float(valor, padrao=None):
    try:
        if valor is None or valor == '':
            return padrao
        return float(valor)
    except (TypeError, ValueError):
        return padrao


def _round(valor, casas=4):
    return None if valor is None else round(float(valor), casas)


def _parse_simbolos(raw):
    if not raw:
        return []
    partes = [p.strip().upper() for p in str(raw).replace(';', ',').split(',')]
    saida, vistos = [], set()
    for p in partes:
        if p and p not in vistos:
            vistos.add(p)
            saida.append(p)
    return saida


def _items(corpo):
    """Extrai data.items de uma resposta da tastytrade (aceita lista solta)."""
    if isinstance(corpo, list):
        return corpo
    dados = corpo.get('data') if isinstance(corpo, dict) else None
    if isinstance(dados, list):
        return dados
    if isinstance(dados, dict):
        itens = dados.get('items')
        if isinstance(itens, list):
            return itens
    return []


def _preco_da_cotacao(cot):
    """Preço de referência de uma cotação: mid → mark → (bid+ask)/2 → last → close."""
    if not cot:
        return None
    for chave in ('mid', 'mark'):
        v = _float(cot.get(chave))
        if v and v > 0:
            return v
    bid, ask = _float(cot.get('bid')), _float(cot.get('ask'))
    if bid and ask and bid > 0 and ask > 0:
        return (bid + ask) / 2
    for chave in ('last', 'last-mkt', 'close'):
        v = _float(cot.get(chave))
        if v and v > 0:
            return v
    return None


def _premio_da_cotacao(cot):
    """Prêmio de uma opção: mid → mark → média bid/ask → last."""
    if not cot:
        return None
    for chave in ('mid', 'mark'):
        v = _float(cot.get(chave))
        if v and v > 0:
            return v
    bid, ask = _float(cot.get('bid')), _float(cot.get('ask'))
    if bid and ask and bid > 0 and ask > 0:
        return (bid + ask) / 2
    v = _float(cot.get('last'))
    return v if v and v > 0 else None


def _dividendos_da_cotacao(cot):
    """dividend-amount/frequency vierem ausentes → paga=None (desconhecido)."""
    if not cot or 'dividend-amount' not in cot:
        return {'paga': None, 'valor': None, 'frequencia': None}
    valor = _float(cot.get('dividend-amount'), 0) or 0
    return {
        'paga':       valor > 0,
        'valor':      valor,
        'frequencia': cot.get('dividend-frequency') or None,
    }


def _variacao_do_dia(cot, preco):
    anterior = _float(cot.get('prev-close')) if cot else None
    if not anterior or not preco:
        return None
    return (preco - anterior) / anterior * 100


def _strike_do_occ(simbolo):
    """Decodifica o strike de um símbolo OCC (ex.: 'SPY   251121C00600000')."""
    try:
        return int(simbolo[-8:]) / 1000.0
    except (ValueError, IndexError, TypeError):
        return None


def _vencimento_do_occ(simbolo):
    """Decodifica a data de vencimento de um símbolo OCC (yymmdd)."""
    try:
        trecho = simbolo[-15:-9]
        return date(2000 + int(trecho[:2]), int(trecho[2:4]), int(trecho[4:6]))
    except (ValueError, IndexError, TypeError):
        return None


# Tipos de vencimento informados pela API tastytrade (campo "expiration-type"
# de /option-chains/{simbolo}/nested). A API é a fonte da verdade: o dia da
# semana não identifica o ciclo (ex.: no BB, 24/12 e 31/12 são Weekly, não
# vencimentos diários).
TIPOS_API = {
    'daily':     'diario',
    'weekly':    'semanal',
    'monthly':   'mensal',
    'quarterly': 'trimestral',
    'regular':   'regular',
}


def _classificar_vencimento(dtv, tipo_api=None):
    """Classifica um vencimento conforme o expiration-type da API.

    Sem o campo da API, cai na heurística por dia da semana
    (seg-qua = diário, sex = semanal/mensal).
    """
    if tipo_api:
        return TIPOS_API.get(str(tipo_api).strip().lower(), 'regular')
    if dtv is None:
        return 'diario'
    if dtv.weekday() == 4:
        return 'mensal' if 15 <= dtv.day <= 21 else 'semanal'
    return 'diario'


def _dia_util_anterior(dtv):
    """Dia útil (seg-sex) imediatamente anterior a dtv."""
    if dtv is None:
        return None
    if dtv.weekday() == 0:          # segunda -> sexta
        return dtv - timedelta(days=3)
    if dtv.weekday() == 6:          # domingo -> sexta
        return dtv - timedelta(days=2)
    return dtv - timedelta(days=1)


def _proximo_dia_util(dtv):
    """Dia útil (seg-sex) imediatamente posterior a dtv."""
    if dtv is None:
        return None
    if dtv.weekday() == 4:          # sexta -> segunda
        return dtv + timedelta(days=3)
    if dtv.weekday() == 5:          # sábado -> segunda
        return dtv + timedelta(days=2)
    return dtv + timedelta(days=1)


def _marcar_vencimentos_diarios(expiracoes):
    """Marca como 'diario' os vencimentos seg-qui de uma série de dias seguidos.

    Somente ações com expiração diária (SPY, QQQ, IWM...) apresentam dias
    consecutivos na cadeia; ações de ciclo semanal/mensal têm vencimentos
    isolados, mesmo quando caem numa quinta-feira.
    """
    datas = {e['dtv'] for e in expiracoes if e['dtv']}
    for exp in expiracoes:
        dtv = exp['dtv']
        if dtv is None or dtv.weekday() > 3:      # sex/sáb/dom não são diários
            continue
        if (_dia_util_anterior(dtv) in datas) or (_proximo_dia_util(dtv) in datas):
            exp['tipo'] = 'diario'
    return expiracoes


# ─── Cotações em lote ─────────────────────────────────────────────────────────
def _cotacoes(simbolos, instrumento='equity'):
    """Cotações em lotes de 100 símbolos (cache de 60s). Retorna {símbolo: cotação}."""
    saida = {}
    for ini in range(0, len(simbolos), LIMITE_SIMBOLOS_COTACAO):
        lote  = simbolos[ini:ini + LIMITE_SIMBOLOS_COTACAO]
        chave = f'cot:{instrumento}:' + ','.join(lote)
        corpo = _cache_get(chave, TTL_COTACAO)
        if corpo is None:
            corpo = _tt_get('/market-data/by-type', params={instrumento: ','.join(lote)})
            _cache_set(chave, corpo)
        for item in _items(corpo):
            simb = item.get('symbol')
            if simb:
                saida[simb] = item
    return saida


# ─── Cadeia de opções ─────────────────────────────────────────────────────────
def _cadeia(simbolo):
    chave = f'cadeia:{simbolo.upper()}'
    corpo = _cache_get(chave, TTL_CADEIA)
    if corpo is None:
        corpo = _tt_get(f'/option-chains/{simbolo.upper()}/nested')
        _cache_set(chave, corpo)
    return corpo


def _simbolo_opcao(valor):
    """Normaliza o símbolo OCC da opção (string ou objeto)."""
    if isinstance(valor, dict):
        return (valor.get('symbol') or valor.get('option-symbol')
                or valor.get('option_symbol'))
    return valor or None


def _extrair_expiracoes(corpo):
    """
    Normaliza a cadeia aninhada:
    [{data, dias, tipo, strikes:[{strike, call, put}]}]
    Aceita as variações de chave da API (snake_case/dasherized).
    """
    expiracoes = []
    for item in _items(corpo):
        brutas = (item.get('expirations') or item.get('expiration')
                  or item.get('options') or [])
        if isinstance(brutas, dict):
            brutas = [brutas]
        for exp in brutas:
            dt_str = (exp.get('expiration-date') or exp.get('expiration_date')
                      or exp.get('expirationDate'))
            dtv = None
            if dt_str:
                try:
                    dtv = date.fromisoformat(str(dt_str)[:10])
                except ValueError:
                    dtv = _vencimento_do_occ(str(dt_str))

            dias = _float(exp.get('days-to-expiration')
                          or exp.get('days_to_expiration'))
            if dias is None and dtv:
                dias = (dtv - date.today()).days
            if dias is not None and dias < 0:
                continue                       # vencimento já passou

            tipo_api = (exp.get('expiration-type') or exp.get('expiration_type')
                        or exp.get('expirationType'))

            brutas_strikes = (exp.get('option') or exp.get('strikes')
                              or exp.get('options') or [])
            if isinstance(brutas_strikes, dict):
                brutas_strikes = [brutas_strikes]

            strikes = []
            for st in brutas_strikes:
                strike = _float(st.get('strike-price') or st.get('strike')
                                or st.get('strike_price'))
                # /option-chains/nested usa "call"/"put"; a versão plana usa
                # "call-symbol"/"put-symbol".
                call = _simbolo_opcao(st.get('call-symbol') or st.get('call_symbol')
                                      or st.get('callSymbol') or st.get('call'))
                put  = _simbolo_opcao(st.get('put-symbol') or st.get('put_symbol')
                                      or st.get('putSymbol') or st.get('put'))
                if strike is None and call:
                    strike = _strike_do_occ(call)
                if strike is None and put:
                    strike = _strike_do_occ(put)
                if strike is None or not (call or put):
                    continue
                strikes.append({'strike': strike, 'call': call, 'put': put})

            if not strikes:
                continue
            strikes.sort(key=lambda s: s['strike'])
            expiracoes.append({
                'data':     dtv.isoformat() if dtv else (str(dt_str)[:10] if dt_str else None),
                'dtv':      dtv,
                'dias':     int(dias) if dias is not None else None,
                'tipo':     _classificar_vencimento(dtv, tipo_api),
                'tipo_api': tipo_api,
                'strikes':  strikes,
            })

    expiracoes.sort(key=lambda e: (e['data'] or '9999-99-99'))
    return _marcar_vencimentos_diarios(expiracoes)


def _strike_alvo(strikes, preco, distancia_pct, tipo_opcao):
    """Strike OTM na distância definida: CALL ≥ alvo, PUT ≤ alvo."""
    alvo = preco * (1 + distancia_pct / 100) if tipo_opcao == 'CALL' \
        else preco * (1 - distancia_pct / 100)
    if tipo_opcao == 'CALL':
        otms = [s for s in strikes if s['strike'] >= alvo]
        escolhido = min(otms, key=lambda s: s['strike']) if otms \
            else max(strikes, key=lambda s: s['strike'])
    else:
        otms = [s for s in strikes if s['strike'] <= alvo]
        escolhido = max(otms, key=lambda s: s['strike']) if otms \
            else min(strikes, key=lambda s: s['strike'])
    return escolhido, alvo


def _simbolos_opcao_para_cotar(expiracoes, preco, distancia_pct, tipos=('CALL', 'PUT')):
    """Seleciona os símbolos OCC alvo (1 por vencimento por tipo) para cotação em lote."""
    alvos = []
    for exp in expiracoes:
        for tipo in tipos:
            escolhido, _ = _strike_alvo(exp['strikes'], preco, distancia_pct, tipo)
            if not escolhido:
                continue
            simbolo = escolhido.get('call' if tipo == 'CALL' else 'put')
            if simbolo:
                alvos.append({
                    'vencimento': exp['data'],
                    'tipo':       tipo,
                    'strike':     escolhido['strike'],
                    'simbolo':    simbolo,
                })
    return alvos


def _analise_ativo(simbolo, distancia_pct):
    """
    Análise completa de 1 ativo: preço, dividendos, variação do dia e prêmios
    por vencimento (CALL e PUT). Retorna também a lista de símbolos OCC a cotar.
    """
    cotacoes = _cotacoes([simbolo])
    cot      = cotacoes.get(simbolo) or {}
    preco    = _preco_da_cotacao(cot)
    if not preco:
        raise TastyError('sem_cotacao', f'Sem cotação para {simbolo}.', 404)

    expiracoes = _extrair_expiracoes(_cadeia(simbolo))
    if not expiracoes:
        raise TastyError('sem_cadeia', f'Sem cadeia de opções para {simbolo}.', 404)

    alvos = _simbolos_opcao_para_cotar(expiracoes, preco, distancia_pct)

    return {
        'simbolo':          simbolo.upper(),
        'preco':            preco,
        'variacao_dia_pct': _variacao_do_dia(cot, preco),
        'dividendos':       _dividendos_da_cotacao(cot),
        'expiracoes':       expiracoes,
        'alvos':            alvos,
        '_cot':             cot,
    }


def _aplicar_premios(analise, cotacoes_opcao):
    """Preenche bid/ask/prêmio de cada vencimento a partir das cotações em lote."""
    por_simbolo = {a['simbolo']: a for a in analise['alvos']}
    for exp in analise['expiracoes']:
        exp['call'] = None
        exp['put']  = None
        for tipo in ('CALL', 'PUT'):
            alvo = next((a for a in analise['alvos']
                         if a['vencimento'] == exp['data'] and a['tipo'] == tipo), None)
            if not alvo:
                continue
            cot = cotacoes_opcao.get(alvo['simbolo']) or {}
            registro = {
                'simbolo': alvo['simbolo'],
                'strike':  alvo['strike'],
                'bid':     _float(cot.get('bid')),
                'ask':     _float(cot.get('ask')),
                'premio':  _premio_da_cotacao(cot),
            }
            exp[tipo.lower()] = registro
    return analise


def _vencimentos_de_referencia(analise):
    """
    Escolhe os vencimentos de referência: o semanal (ciclo "Weekly" da API) e
    o diário (vencimentos em dias consecutivos, seg-qui) mais próximos.
    """
    expiracoes = analise['expiracoes']

    def _primeiro(tipo):
        return next((e for e in expiracoes if e['tipo'] == tipo), None)

    semanal = _primeiro('semanal')
    for alternativo in ('mensal', 'trimestral', 'regular'):
        if semanal is None:
            semanal = _primeiro(alternativo)
    diario = _primeiro('diario')
    return semanal, diario


def _alvos_dos_vencimentos_de_referencia(analise):
    """Alvos de cotação apenas dos vencimentos usados no resumo (economiza API)."""
    semanal, diario = _vencimentos_de_referencia(analise)
    datas = {e['data'] for e in (semanal, diario) if e}
    return [a for a in analise['alvos'] if a['vencimento'] in datas]


def _resumo_premios(analise):
    """Prêmios dos vencimentos de referência em formato plano."""
    semanal, diario = _vencimentos_de_referencia(analise)

    def _premio(exp, tipo):
        if not exp:
            return None
        bloco = exp.get(tipo.lower())
        return bloco.get('premio') if bloco else None

    def _strike(exp, tipo):
        if not exp:
            return None
        bloco = exp.get(tipo.lower())
        return bloco.get('strike') if bloco else None

    return {
        'premio_semanal_call': _round(_premio(semanal, 'CALL')),
        'premio_semanal_put':  _round(_premio(semanal, 'PUT')),
        'strike_semanal_call': _round(_strike(semanal, 'CALL'), 2),
        'strike_semanal_put':  _round(_strike(semanal, 'PUT'), 2),
        'vencimento_semanal':  semanal['data'] if semanal else None,
        'dias_semanal':        semanal['dias'] if semanal else None,
        'premio_diario_call':  _round(_premio(diario, 'CALL')),
        'premio_diario_put':   _round(_premio(diario, 'PUT')),
        'strike_diario_call':  _round(_strike(diario, 'CALL'), 2),
        'strike_diario_put':   _round(_strike(diario, 'PUT'), 2),
        'vencimento_diario':   diario['data'] if diario else None,
        'dias_diario':         diario['dias'] if diario else None,
        'tem_vencimento_diario': diario is not None,
        # Periodicidades existentes na cadeia do ativo — usadas pelo filtro
        # de "opções diárias / semanais / mensais" da lista de candidatos.
        'tem_vencimento_semanal': any(e['tipo'] == 'semanal'
                                      for e in analise['expiracoes']),
        'tem_vencimento_mensal':  any(e['tipo'] == 'mensal'
                                      for e in analise['expiracoes']),
    }


# ═════════════════════════════════════════════════════════════════════════════
# CÁLCULO FINANCEIRO (Black-Scholes) — puro, testável com pytest
# Fórmulas portadas de ideias/scannerTotal-claude.html (linhas 262-290).
# ═════════════════════════════════════════════════════════════════════════════
def _norm_cdf(x):
    """Normal acumulada — aproximação de Abramowitz & Stegun (1964)."""
    a1, a2, a3, a4, a5 = 0.25482959, -0.28449673, 1.42141374, -1.45315207, 1.06140543
    p  = 0.3275911
    s  = 1.0 if x >= 0 else -1.0
    z  = abs(x) / math.sqrt(2.0)
    t  = 1.0 / (1.0 + p * z)
    y  = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * math.exp(-z * z)
    return 0.5 * (1.0 + s * y)


def _black_scholes(tipo, spot, strike, dias, iv):
    """
    Preço, delta e probabilidade de exercício (PoP) de uma opção europeia.
      tipo   — 'PUT' | 'CALL'
      spot   — preço atual da ação (US$)
      strike — preço de exercício (US$)
      dias   — dias corridos até o vencimento
      iv     — volatilidade implícita anual (0.35 = 35%)
    PoP = N(-d2) para PUT (prob. de fechar abaixo do strike) e N(d2) para CALL.
    """
    tipo = (tipo or 'PUT').upper()
    spot, strike, dias, iv = _float(spot), _float(strike), _float(dias), _float(iv)
    if not spot or not strike:
        return {'preco': None, 'delta': None, 'pop': None}

    if dias is None or dias <= 0 or iv is None or iv <= 0:
        # Vencendo hoje (ou sem vol): valor intrínseco e delta de limite
        if tipo == 'PUT':
            intrinseco = max(strike - spot, 0.0)
            delta = -1.0 if spot < strike else 0.0
            pop   = 1.0  if spot < strike else 0.0
        else:
            intrinseco = max(spot - strike, 0.0)
            delta = 1.0 if spot > strike else 0.0
            pop   = 1.0 if spot > strike else 0.0
        return {'preco': intrinseco, 'delta': delta, 'pop': pop}

    t  = dias / DIAS_PREGAO_ANO
    df = math.exp(-TAXA_LIVRE_RISCO * t)
    sd = iv * math.sqrt(t)
    d1 = (math.log(spot / strike) + (TAXA_LIVRE_RISCO + iv * iv / 2.0) * t) / sd
    d2 = d1 - sd

    if tipo == 'PUT':
        preco = strike * df * _norm_cdf(-d2) - spot * _norm_cdf(-d1)
        delta = _norm_cdf(d1) - 1.0
        pop   = _norm_cdf(-d2)
    else:
        preco = spot * _norm_cdf(d1) - strike * df * _norm_cdf(d2)
        delta = _norm_cdf(d1)
        pop   = _norm_cdf(d2)

    return {'preco': preco, 'delta': delta, 'pop': pop}


def _iv_implicita(tipo, spot, strike, dias, preco_alvo, tolerancia=1e-4, max_iter=60):
    """
    Volatilidade implícita obtida por biseção: encontra a IV cujo preço
    Black-Scholes reproduz o prêmio de mercado. Retorna None quando não há
    solução (sem prêmio, sem spot/strike ou sem dias até o vencimento).
    """
    preco_alvo = _float(preco_alvo)
    spot, strike, dias = _float(spot), _float(strike), _float(dias)
    if (preco_alvo is None or preco_alvo <= 0
            or not spot or not strike
            or dias is None or dias <= 0):
        return None

    # Fora da faixa: devolve o limite mais próximo (prêmio acima do máximo
    # teórico = IV no topo; abaixo do mínimo = IV no piso)
    if _black_scholes(tipo, spot, strike, dias, IV_MAX)['preco'] < preco_alvo:
        return IV_MAX
    if _black_scholes(tipo, spot, strike, dias, IV_MIN)['preco'] > preco_alvo:
        return IV_MIN

    lo, hi = IV_MIN, IV_MAX
    for _ in range(max_iter):
        meio = (lo + hi) / 2.0
        preco = _black_scholes(tipo, spot, strike, dias, meio)['preco']
        if abs(preco - preco_alvo) <= tolerancia:
            return meio
        if preco > preco_alvo:
            hi = meio
        else:
            lo = meio
    return (lo + hi) / 2.0


def calcular_strikes(spot, linhas, tipo, dias, hv, fill='mid', contratos=1, comissao=1.0):
    """
    Calcula as métricas de cada strike cotado de 1 vencimento.

    linhas: [{'strike': float, 'call': {bid, ask, premio}, 'put': {...}}]
      tipo      — 'PUT' | 'CALL' (qual lado será analisado)
      dias      — dias corridos até o vencimento
      hv        — volatilidade realizada esperada em % (base do valor justo)
      fill      — 'mid' ou 'bid' (preço de execução)
      contratos — nº de contratos (lotes de 100)
      comissao  — US$ por contrato

    Retorna lista com: strike, dist, otm, bid, ask, premio, iv, delta, pop,
    breakeven, capital, premio_liquido, roc, anualizado, fair, ev.
    """
    tipo       = (tipo or 'PUT').upper()
    spot       = _float(spot)
    dias       = _float(dias)
    hv         = _float(hv, 50.0) or 50.0
    contratos  = int(_float(contratos, 1) or 1)
    comissao   = _float(comissao, 1.0)
    if comissao is None:
        comissao = 1.0

    saida = []
    for linha in linhas or []:
        strike = _float(linha.get('strike'))
        if not strike or not spot:
            continue

        bloco = linha.get(tipo.lower()) or {}
        bid   = _float(bloco.get('bid'))
        ask   = _float(bloco.get('ask'))
        mid   = _float(bloco.get('premio'))

        # Preço de execução conforme o seletor Mid / Bid
        if fill == 'bid':
            premio = bid if bid is not None else mid
        else:
            premio = mid if mid is not None else (
                (bid + ask) / 2.0 if bid is not None and ask is not None else None)

        # Só strikes fora do dinheiro (venda OTM) e distância em módulo
        otm  = (strike <= spot) if tipo == 'PUT' else (strike >= spot)
        dist = abs(spot - strike) / spot * 100.0

        iv    = _iv_implicita(tipo, spot, strike, dias, premio) if premio else None
        modelo = _black_scholes(tipo, spot, strike, dias, iv) if iv else None
        delta = modelo['delta'] if modelo else None
        pop   = modelo['pop'] if modelo else None

        capital        = strike * MULTIPLICADOR * contratos
        premio_liquido = (premio * MULTIPLICADOR * contratos
                          - comissao * contratos) if premio is not None else None
        roc = (premio_liquido / capital
               if premio_liquido is not None and capital else None)
        anualizado = (roc * DIAS_PREGAO_ANO / dias
                      if (roc is not None and dias) else None)

        breakeven = (strike - premio if tipo == 'PUT' else strike + premio
                     ) if premio is not None else None

        # Valor justo pela volatilidade realizada (HV) e valor esperado
        fair = _black_scholes(tipo, spot, strike, dias, hv / 100.0)['preco']
        edge = (premio - fair) if (premio is not None and fair is not None) else None
        ev   = (edge * MULTIPLICADOR * contratos - comissao * contratos
                if edge is not None else None)

        saida.append({
            'strike':         _round(strike, 4),
            'dist':           _round(dist, 2),
            'otm':            otm,
            'bid':            bid,
            'ask':            ask,
            'premio':         _round(premio, 4),
            'iv':             _round(iv, 4),
            'delta':          _round(delta, 4),
            'pop':            _round(pop, 4),
            'breakeven':      _round(breakeven, 4),
            'capital':        _round(capital, 2),
            'premio_liquido': _round(premio_liquido, 4),
            'roc':            _round(roc, 6),
            'anualizado':     _round(anualizado, 6),
            'fair':           _round(fair, 4),
            'ev':             _round(ev, 4),
        })
    return saida


# ═════════════════════════════════════════════════════════════════════════════
# CÁLCULO PURO DOS CENÁRIOS (sem chamada externa — testável com pytest)
# ═════════════════════════════════════════════════════════════════════════════
def premio_diario_equivalente(premio_semanal, dias):
    """Prêmio semanal ÷ dias = prêmio diário equivalente."""
    if premio_semanal is None:
        return None
    dias = _float(dias)
    if not dias or dias <= 0:
        return None
    return float(premio_semanal) / dias


def _montar_linha(cand, premio_semanal, premio_diario_ref, params):
    """Monta a linha de um candidato para um cenário."""
    preco        = _float(cand.get('preco'))
    dividendos   = cand.get('dividendos')
    variacao     = _float(cand.get('variacao_dia_pct'))
    capital_lote = preco * MULTIPLICADOR if preco else None

    eq = premio_diario_equivalente(premio_semanal, params['dias'])
    dif_valor = (eq - premio_diario_ref) if (eq is not None and premio_diario_ref is not None) else None
    dif_pct   = (dif_valor / premio_diario_ref * 100) if (dif_valor is not None and premio_diario_ref) else None

    rentab_diaria  = (eq / capital_lote * 100) if (eq is not None and capital_lote) else None
    rentab_semanal = (premio_semanal / capital_lote * 100) if (premio_semanal is not None and capital_lote) else None

    lucro_liberado        = premio_semanal * MULTIPLICADOR if premio_semanal is not None else None
    lucro_liberado_diario = eq * MULTIPLICADOR if eq is not None else None

    dentro_limite_acao = preco is not None and preco <= params['limite_acao']
    dentro_limite_lote = capital_lote is not None and capital_lote <= params['limite_lote']
    metade_referencia  = params['preco_referencia'] / 2
    ate_metade         = preco is not None and preco <= metade_referencia
    excede_saldo       = (capital_lote is not None
                          and capital_lote > params['limite_posicao'])

    apto = bool(preco and premio_semanal is not None and dentro_limite_acao
                and dentro_limite_lote and ate_metade and not excede_saldo)

    motivos = []
    if premio_semanal is None:
        motivos.append('sem prêmio disponível')
    if preco is not None and preco > params['limite_acao']:
        motivos.append('acima do limite por ação')
    if capital_lote is not None and capital_lote > params['limite_lote']:
        motivos.append('acima do limite por lote')
    if preco is not None and preco > metade_referencia:
        motivos.append('acima de 50% da ação de referência')
    if excede_saldo:
        motivos.append('bloqueio por saldo (RiscoMaximoPorPosicaoPercent)')

    return {
        'simbolo':                cand.get('simbolo'),
        'preco':                  _round(preco, 2),
        'capital_lote':           _round(capital_lote, 2),
        'dividendos':             dividendos,
        'variacao_dia_pct':       _round(variacao, 2),
        'premio_semanal':         _round(premio_semanal),
        'premio_diario_equiv':    _round(eq),
        'diferenca_valor':        _round(dif_valor),
        'diferenca_pct':          _round(dif_pct, 2),
        'rentabilidade_diaria_pct':  _round(rentab_diaria, 4),
        'rentabilidade_semanal_pct': _round(rentab_semanal, 4),
        'lucro_liberado':         _round(lucro_liberado, 2),
        'lucro_liberado_diario':  _round(lucro_liberado_diario, 2),
        'dentro_limite_acao':     dentro_limite_acao,
        'dentro_limite_lote':     dentro_limite_lote,
        'ate_metade_referencia':  ate_metade,
        'bloqueio_saldo':         excede_saldo,
        'apto':                   apto,
        'motivos':                motivos,
    }


def _recomendacao(melhor, params):
    """Indica ação e estratégia para investir os lucros liberados."""
    if not melhor:
        return {
            'acao': None,
            'estrategia': None,
            'motivo': 'Nenhum ativo apto com os parâmetros informados.',
        }

    paga_div = melhor.get('dividendos') is True
    estrategia = 'BUY_AND_HOLD' if paga_div else 'SWING_TRADE'

    partes = []
    if melhor.get('rentabilidade_diaria_pct') is not None:
        partes.append(f"rentabilidade diária de {melhor['rentabilidade_diaria_pct']:.2f}% "
                      f"sobre o capital do lote")
    if melhor.get('diferenca_pct') is not None:
        sinal = 'acima' if melhor['diferenca_pct'] >= 0 else 'abaixo'
        partes.append(f"prêmio diário equivalente {abs(melhor['diferenca_pct']):.2f}% {sinal} "
                      f"da ação de referência")
    if melhor.get('variacao_dia_pct') is not None:
        if melhor['variacao_dia_pct'] < 0:
            partes.append(f"com queda de {abs(melhor['variacao_dia_pct']):.2f}% no dia "
                          f"(entrada mais barata)")
        else:
            partes.append(f"com alta de {melhor['variacao_dia_pct']:.2f}% no dia")
    if paga_div:
        partes.append('paga dividendos → acumular posição com os lucros (buy and hold)')
    else:
        partes.append('não paga dividendos → operar a queda e a recuperação (swing trade)')

    return {
        'acao':       melhor.get('simbolo'),
        'estrategia': estrategia,
        'motivo':     '; '.join(partes) + '.',
        'lucro_liberado': melhor.get('lucro_liberado'),
    }


def _cenario(nome, linhas, params, exige_dividendo):
    """Monta um cenário: filtra, ranqueia por rentabilidade diária e recomenda."""
    aptos = [l for l in linhas
             if l['apto']
             and (not exige_dividendo or l.get('dividendos') is True)]

    for linha in linhas:
        if exige_dividendo and linha['apto'] and linha.get('dividendos') is not True:
            linha['apto'] = False
            linha['motivos'] = linha['motivos'] + ['não confirmado como pagadora de dividendos']

    aptos = sorted(
        aptos,
        key=lambda l: (l['rentabilidade_diaria_pct']
                       if l['rentabilidade_diaria_pct'] is not None else -1),
        reverse=True,
    )
    for pos, linha in enumerate(aptos, start=1):
        linha['posicao'] = pos

    melhor = aptos[0] if aptos else None
    return {
        'nome':                nome,
        'exige_dividendos':    exige_dividendo,
        'total_candidatos':    len(linhas),
        'total_apto':          len(aptos),
        'linhas':              linhas,
        'ranqueamento':        [l['simbolo'] for l in aptos],
        'melhor_acao':         melhor,
        'lucro_liberado_total': _round(sum(l['lucro_liberado'] or 0 for l in aptos), 2),
        'recomendacao':        _recomendacao(melhor, params),
        'parametros':          params,
    }


def calcular_comparacao(body):
    """
    Cálculo puro dos dois cenários a partir do payload da front-end.
    Levanta ValueError com mensagem amigável quando faltar dado essencial.
    """
    preco_referencia = _float(body.get('preco_referencia'))
    if not preco_referencia or preco_referencia <= 0:
        raise ValueError('Informe o preço atual da ação de referência (preco_referencia).')

    candidatos = body.get('candidatos') or []
    if not isinstance(candidatos, list):
        raise ValueError("'candidatos' deve ser uma lista.")

    tipo_operacao = str(body.get('tipo_operacao') or 'PUT').upper()
    if tipo_operacao not in ('PUT', 'CALL'):
        raise ValueError("'tipo_operacao' deve ser PUT ou CALL.")

    dias = _float(body.get('dias'), DIAS_PADRAO)
    if not dias or dias <= 0:
        raise ValueError('O número de dias deve ser maior que zero.')

    capital_referencia = _float(body.get('capital_referencia')) or preco_referencia * MULTIPLICADOR

    params = {
        'acao_referencia':      str(body.get('acao_selecionada') or '').upper() or None,
        'preco_referencia':     preco_referencia,
        'distancia_pct':        _float(body.get('distancia_pct'), DISTANCIA_PADRAO),
        'dias':                 int(dias),
        'tipo_operacao':        tipo_operacao,
        'capital_referencia':   capital_referencia,
        'limite_acao':          _float(body.get('limite_acao'), LIMITE_ACAO_PADRAO),
        'limite_lote':          _float(body.get('limite_lote'), LIMITE_LOTE_PADRAO),
        'risco_max_posicao_pct': _float(body.get('risco_max_posicao_pct'), RISCO_MAX_POSICAO_PADRAO),
    }
    params['limite_posicao'] = capital_referencia * params['risco_max_posicao_pct'] / 100

    # Prêmio diário da ação de referência (selecionada)
    premio_ref = _float(body.get(f'premio_diario_{tipo_operacao.lower()}'))
    if premio_ref is None:
        premio_ref = _float(body.get('premio_diario'))
    params['premio_diario_referencia'] = _round(premio_ref)

    # Cenário 1 usa o tipo de operação escolhido; Cenário 2 prioriza CALL.
    linhas_conservador = []
    for cand in candidatos:
        premio = _float(cand.get(f'premio_semanal_{tipo_operacao.lower()}'))
        if premio is None:
            premio = _float(cand.get('premio_semanal'))
        linhas_conservador.append(_montar_linha(cand, premio, premio_ref, params))

    linhas_arrojado = []
    for cand in candidatos:
        premio = _float(cand.get('premio_semanal_call'))
        linhas_arrojado.append(_montar_linha(cand, premio, premio_ref, params))

    conservador = _cenario('Conservador', linhas_conservador, params, exige_dividendo=False)
    arrojado    = _cenario('Arrojado', linhas_arrojado, params, exige_dividendo=True)

    return {
        'parametros': params,
        'premissas':  PREMISSAS,
        'cenarios':   {
            'conservador': conservador,
            'arrojado':    arrojado,
        },
    }


# ═════════════════════════════════════════════════════════════════════════════
# ROTAS
# ═════════════════════════════════════════════════════════════════════════════
@simulador_bp.route('/status', methods=['GET'])
def status_simulador():
    """Status da integração (nunca expõe segredos) + parâmetros padrão."""
    cfg     = _config()
    ambiente = 'sandbox' if 'cert' in cfg['base_url'] else 'producao'
    return jsonify({
        'success':        True,
        'configurado':    bool(cfg['refresh_token'] and cfg['client_secret']),
        'ambiente':       ambiente,
        'base_url':       cfg['base_url'],
        'account_number': cfg['account_number'] or None,
        'saldo_opcoes_usd': _saldo_configurado(),
        'client_id':      (cfg['client_id'][:8] + '…') if cfg['client_id'] else None,
        'tem_client_id':      bool(cfg['client_id']),
        'tem_client_secret':  bool(cfg['client_secret']),
        'tem_refresh_token':  bool(cfg['refresh_token']),
        'universo_padrao': len(UNIVERSO_PADRAO),
        'limites': {
            'limite_acao':           LIMITE_ACAO_PADRAO,
            'limite_lote':           LIMITE_LOTE_PADRAO,
            'risco_max_posicao_pct': RISCO_MAX_POSICAO_PADRAO,
            'distancia_pct':         DISTANCIA_PADRAO,
            'dias':                  DIAS_PADRAO,
        },
        'premissas': PREMISSAS,
        'gerado_em': datetime.now().isoformat(timespec='seconds'),
    })


@simulador_bp.route('/universo', methods=['GET'])
def universo():
    """
    Cotações reais do universo filtradas pelos limites de ação e de lote.
    Query: max_preco, max_lote, simbolos (opcional, substitui o universo padrão).
    """
    try:
        max_preco = _float(request.args.get('max_preco'))
        max_lote  = _float(request.args.get('max_lote'))
        simbolos  = _parse_simbolos(request.args.get('simbolos')) or list(UNIVERSO_PADRAO)
        simbolos  = simbolos[:LIMITE_SIMBOLOS_COTACAO]

        cotacoes = _cotacoes(simbolos)

        itens, sem_cotacao = [], []
        for simb in simbolos:
            cot   = cotacoes.get(simb)
            preco = _preco_da_cotacao(cot)
            if not preco:
                sem_cotacao.append(simb)
                continue
            capital = preco * MULTIPLICADOR
            itens.append({
                'simbolo':          simb,
                'preco':            _round(preco, 2),
                'capital_lote':     _round(capital, 2),
                'variacao_dia_pct': _round(_variacao_do_dia(cot, preco), 2),
                'dividendos':       _dividendos_da_cotacao(cot),
                'dentro_limite':    ((max_preco is None or preco <= max_preco)
                                     and (max_lote is None or capital <= max_lote)),
            })

        filtrados = [i for i in itens if i['dentro_limite']]
        filtrados.sort(key=lambda i: i['preco'])

        # Empresa/setor/atividade/perfil (yfinance, cache de 24h) — só para os
        # ativos que efetivamente entram na lista.
        perfis = _perfis_dos_ativos([i['simbolo'] for i in filtrados])
        for item in filtrados:
            dados = perfis.get(item['simbolo']) or {}
            item['empresa']   = dados.get('empresa')
            item['setor']     = dados.get('setor')
            item['atividade'] = dados.get('atividade')
            item['perfil']    = dados.get('perfil')

        return jsonify({
            'success':           True,
            'itens':             filtrados,
            'total_considerados': len(itens),
            'sem_cotacao':       sem_cotacao,
            'limites':           {'max_preco': max_preco, 'max_lote': max_lote},
            'fonte':             'tastytrade',
            'gerado_em':         datetime.now().isoformat(timespec='seconds'),
        })
    except TastyError as erro:
        return _erro_response(erro)


@simulador_bp.route('/cadeia', methods=['GET'])
def cadeia():
    """
    Cadeia de opções de 1 ativo com prêmios reais por vencimento.
    Query: simbolo (obrigatório), distancia_pct (padrão 5).
    """
    try:
        simbolo = (request.args.get('simbolo') or '').strip().upper()
        if not simbolo:
            return jsonify({'success': False, 'error': 'Informe o parâmetro simbolo.',
                            'codigo': 'parametro_ausente'}), 400
        distancia = _float(request.args.get('distancia_pct'), DISTANCIA_PADRAO)

        analise = _analise_ativo(simbolo, distancia)
        # A cadeia inteira é cotada (o seletor de vencimento mostra o prêmio
        # de cada um); _cotacoes fatia em lotes de 100.
        alvos   = [a['simbolo'] for a in analise['alvos']]
        cot_op  = _cotacoes(alvos, instrumento='equity-option') if alvos else {}
        _aplicar_premios(analise, cot_op)

        expiracoes = []
        for exp in analise['expiracoes']:
            expiracoes.append({
                'data':     exp['data'],
                'dias':     exp['dias'],
                'tipo':     exp['tipo'],
                'tipo_api': exp.get('tipo_api'),
                'call':     exp.get('call'),
                'put':      exp.get('put'),
            })

        _, alvo_call = _strike_alvo(analise['expiracoes'][0]['strikes'],
                                    analise['preco'], distancia, 'CALL')
        _, alvo_put  = _strike_alvo(analise['expiracoes'][0]['strikes'],
                                    analise['preco'], distancia, 'PUT')

        return jsonify({
            'success':        True,
            'simbolo':        analise['simbolo'],
            'preco':          _round(analise['preco'], 2),
            'variacao_dia_pct': _round(analise['variacao_dia_pct'], 2),
            'dividendos':     analise['dividendos'],
            'distancia_pct':  distancia,
            'alvo_call':      _round(alvo_call, 2),
            'alvo_put':       _round(alvo_put, 2),
            'expiracoes':     expiracoes,
            'premios':        _resumo_premios(analise),
            'premissas':      PREMISSAS,
            'fonte':          'tastytrade',
            'gerado_em':      datetime.now().isoformat(timespec='seconds'),
        })
    except TastyError as erro:
        return _erro_response(erro)


@simulador_bp.route('/premios', methods=['GET'])
def premios():
    """
    Resumo de prêmios (semanal e diário) para vários ativos de uma vez.
    Query: simbolos (obrigatório, separados por vírgula), distancia_pct (padrão 5).
    """
    try:
        simbolos = _parse_simbolos(request.args.get('simbolos'))
        if not simbolos:
            return jsonify({'success': False, 'error': 'Informe o parâmetro simbolos.',
                            'codigo': 'parametro_ausente'}), 400
        simbolos  = simbolos[:LIMITE_CANDIDATOS]
        distancia = _float(request.args.get('distancia_pct'), DISTANCIA_PADRAO)

        analises, todos_alvos, erros = [], [], []
        for simb in simbolos:
            try:
                analise = _analise_ativo(simb, distancia)
                analises.append(analise)
                # Só os vencimentos de referência precisam de cotação
                todos_alvos += [a['simbolo'] for a in
                                _alvos_dos_vencimentos_de_referencia(analise)]
            except TastyError as erro:
                erros.append({'simbolo': simb, 'error': erro.mensagem})

        # Cotação em lote de todas as opções-alvo (fatia de 100 na própria função)
        vistos, alvos_unicos = set(), []
        for s in todos_alvos:
            if s not in vistos:
                vistos.add(s)
                alvos_unicos.append(s)
        cot_op = _cotacoes(alvos_unicos, instrumento='equity-option') if alvos_unicos else {}

        itens = []
        for analise in analises:
            _aplicar_premios(analise, cot_op)
            linha = {
                'simbolo':          analise['simbolo'],
                'preco':            _round(analise['preco'], 2),
                'capital_lote':     _round(analise['preco'] * MULTIPLICADOR, 2),
                'variacao_dia_pct': _round(analise['variacao_dia_pct'], 2),
                'dividendos':       analise['dividendos'],
            }
            linha.update(_resumo_premios(analise))
            itens.append(linha)

        return jsonify({
            'success':   True,
            'itens':     itens,
            'erros':     erros,
            'distancia_pct': distancia,
            'limite':    LIMITE_CANDIDATOS,
            'premissas': PREMISSAS,
            'fonte':     'tastytrade',
            'gerado_em': datetime.now().isoformat(timespec='seconds'),
        })
    except TastyError as erro:
        return _erro_response(erro)


def _saldo_configurado():
    """Saldo em US$ informado pelo usuário na tela de configurações."""
    try:
        conn   = db.get_db()
        linha  = conn.execute('SELECT valor FROM configuracoes WHERE chave=?',
                              (CHAVE_SALDO_USD,)).fetchone()
        conn.close()
        return _float(linha['valor']) if linha else None
    except Exception:
        return None


def _gravar_saldo_configurado(valor):
    """Atualiza o campo de saldo em US$ da tela de configurações (best-effort)."""
    try:
        conn = db.get_db()
        conn.execute(
            '''INSERT INTO configuracoes (chave, valor, updated_at) VALUES (?,?,?)
               ON CONFLICT(chave) DO UPDATE SET valor=?, updated_at=?''',
            (CHAVE_SALDO_USD, str(valor), datetime.now().isoformat(),
             str(valor), datetime.now().isoformat()))
        conn.commit()
        conn.close()
        return True
    except Exception:
        return False


_CACHE_CONTA = {'em': None, 'valor': None, 'origem': None}


def _saldo_tastytrade():
    """
    Tenta obter o saldo da conta na tastytrade (net liquidating value e,
    na falta dele, cash balance). Retorna (valor, campo) ou (None, None).
    Cache de 5 minutos para não repetir a chamada a cada acesso à tela.
    """
    agora = time.time()
    if _CACHE_CONTA['em'] and agora - _CACHE_CONTA['em'] < 300:
        return _CACHE_CONTA['valor'], _CACHE_CONTA['origem']

    cfg     = _config()
    caminhos = []
    if cfg.get('account_number'):
        caminhos.append(f"/accounts/{cfg['account_number']}")
    caminhos.append('/accounts')

    valor, campo = None, None
    for caminho in caminhos:
        try:
            corpo = _tt_get(caminho, timeout=15)
        except Exception:
            continue
        itens = _items(corpo)
        if not itens and isinstance(corpo, dict) and isinstance(corpo.get('data'), dict):
            itens = [corpo['data']]          # resposta de uma única conta
        for item in itens:
            attrs = item.get('attributes') if isinstance(item, dict) else None
            attrs = attrs if isinstance(attrs, dict) else item
            if not isinstance(attrs, dict):
                continue
            for chave in ('net-liquidating-value', 'net_liquidating_value',
                          'cash-balance', 'cash_balance'):
                v = _float(attrs.get(chave))
                if v is not None:
                    valor, campo = v, chave
                    break
        if valor is not None:
            break

    _CACHE_CONTA.update(em=agora, valor=valor, origem=campo)
    return valor, campo


@simulador_bp.route('/conta', methods=['GET'])
def conta():
    """
    Saldo da conta para o cálculo do "prêmio sobre o saldo".
    Tenta a tastytrade; quando obtém, atualiza o campo de configuração
    (saldoOpcoesUsd). Sem sucesso, devolve o valor já configurado.
    """
    saldo_api, campo_api = _saldo_tastytrade()
    if saldo_api is not None:
        _gravar_saldo_configurado(saldo_api)
        saldo, origem, atualizado = saldo_api, 'tastytrade', True
    else:
        saldo, origem, atualizado = _saldo_configurado(), 'configuracao', False

    return jsonify({
        'success':   True,
        'saldo':     saldo,
        'origem':    origem,
        'campo':     CHAVE_SALDO_USD,
        'campo_api': campo_api,
        'conta':     _config().get('account_number') or None,
        'atualizado_automaticamente': atualizado,
    })


@simulador_bp.route('/strikes', methods=['GET'])
def strikes():
    """
    Strikes de 1 vencimento com bid/ask reais + métricas calculadas:
    IV implícita, delta, PoP (probabilidade de exercício), break-even,
    ROC, anualizado e EV (valor justo pela HV).
    Query: simbolo (obrigatório), vencimento (opcional), tipo (PUT|CALL),
           dist_min, dist_max, delta_max, hv, fill, contratos, comissao
    """
    try:
        simbolo = (request.args.get('simbolo') or '').strip().upper()
        if not simbolo:
            raise TastyError('parametro_ausente', 'Informe o parâmetro simbolo.', 400)

        tipo = (request.args.get('tipo') or 'PUT').upper()
        if tipo not in ('PUT', 'CALL'):
            raise TastyError('parametro_invalido', 'tipo deve ser PUT ou CALL.', 400)

        dist_min  = _float(request.args.get('dist_min'), 0.0) or 0.0
        dist_max  = _float(request.args.get('dist_max'), 15.0)
        delta_max = _float(request.args.get('delta_max'), 0.5)
        hv        = _float(request.args.get('hv'), 50.0)
        fill      = (request.args.get('fill') or 'mid').lower()
        contratos = int(_float(request.args.get('contratos'), 1) or 1)
        comissao  = _float(request.args.get('comissao'), 1.0)

        analise    = _analise_ativo(simbolo, DISTANCIA_PADRAO)
        preco      = analise['preco']
        # Somente vencimentos com pelo menos 1 dia: a cadeia de SPY/QQQ lista
        # também o vencimento do dia (dias=0), que não pode ser simulado.
        expiracoes = [e for e in analise['expiracoes'] if (e['dias'] or 0) >= 1]
        if not expiracoes:
            raise TastyError('vencido', 'Cadeia sem vencimentos futuros.', 400)

        # Vencimento escolhido (ou o primeiro da cadeia)
        pedido = (request.args.get('vencimento') or '').strip()
        exp = next((e for e in expiracoes if e['data'] == pedido), None) if pedido else None
        if exp is None:
            exp = expiracoes[0]
        dias = exp['dias'] or 0
        if dias <= 0:
            raise TastyError('vencido', 'Vencimento sem dias restantes.', 400)

        # Cota TODOS os strikes do vencimento (os dois lados)
        simbolos = []
        for st in exp['strikes']:
            for lado in ('call', 'put'):
                s = _simbolo_opcao(st.get(lado))
                if s:
                    simbolos.append(s)
        cotacoes = _cotacoes(simbolos, instrumento='equity-option') if simbolos else {}

        linhas = []
        for st in exp['strikes']:
            bloco = {'strike': st['strike']}
            for lado in ('call', 'put'):
                s   = _simbolo_opcao(st.get(lado))
                cot = cotacoes.get(s) or {}
                bloco[lado] = {
                    'simbolo': s,
                    'bid':     _float(cot.get('bid')),
                    'ask':     _float(cot.get('ask')),
                    'premio':  _premio_da_cotacao(cot),
                }
            linhas.append(bloco)

        calculadas = calcular_strikes(preco, linhas, tipo, dias, hv,
                                      fill, contratos, comissao)

        filtradas = [
            c for c in calculadas
            if c['otm']
            and dist_min <= (c['dist'] or 0) <= dist_max
            and c['delta'] is not None and abs(c['delta']) <= delta_max
            and (c['premio'] or 0) >= 0.01
        ]
        # PUT: strike decrescente (mais próximo do spot primeiro)
        filtradas.sort(key=lambda c: c['strike'], reverse=(tipo == 'PUT'))

        return jsonify({
            'success':      True,
            'simbolo':      simbolo,
            'preco':        _round(preco, 2),
            'tipo':         tipo,
            'vencimento':   {'data': exp['data'], 'dias': dias, 'tipo': exp['tipo']},
            'vencimentos':  [{'data': e['data'], 'dias': e['dias'], 'tipo': e['tipo']}
                             for e in expiracoes],
            'strikes':      filtradas,
            'total_strikes': len(calculadas),
            'parametros': {
                'dist_min': dist_min, 'dist_max': dist_max,
                'delta_max': delta_max, 'hv': hv, 'fill': fill,
                'contratos': contratos, 'comissao': comissao,
            },
            'premissas': PREMISSAS,
            'fonte':     'tastytrade',
            'gerado_em': datetime.now().isoformat(timespec='seconds'),
        })
    except TastyError as erro:
        return _erro_response(erro)


@simulador_bp.route('/comparar', methods=['POST'])
def comparar():
    """Cálculo puro dos cenários (sem chamada externa)."""
    body = request.get_json(silent=True) or {}
    try:
        resultado = calcular_comparacao(body)
    except ValueError as erro:
        return jsonify({'success': False, 'error': str(erro),
                        'codigo': 'payload_invalido'}), 400
    resultado['success'] = True
    return jsonify(resultado)
