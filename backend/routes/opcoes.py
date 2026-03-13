"""
routes/opcoes.py — API de Operações de Opções (B3)
Escopo: módulo opcoes EXCLUSIVAMENTE

Rotas registradas (prefixo /api/opcoes no server.py):
  GET    /api/opcoes              — listar todas
  GET    /api/opcoes/<id>         — buscar por ID
  POST   /api/opcoes              — criar
  PUT    /api/opcoes/<id>         — atualizar
  DELETE /api/opcoes/<id>         — excluir
  POST   /api/opcoes/refresh      — atualizar cotações das abertas
"""
from flask    import Blueprint, request, jsonify
from datetime import datetime
import os
import db

opcoes_bp = Blueprint('opcoes', __name__)


# ─── Normalização de resultado (VENDA ABERTA) ─────────────────────────────────
def normalize_resultado_opcao(op):
    """
    Para operações de VENDA com status ABERTA, garante que resultado ≥ 0.
    Resultado esperado de uma trava vendida = qtd * prêmio.
    """
    try:
        status        = str(op.get('status') or '').upper()
        tipo_operacao = str(op.get('tipo_operacao') or '').upper()
        qtd           = float(op.get('quantidade') or 0)
        premio        = float(op.get('premio') or 0)
        resultado     = op.get('resultado')
        is_venda      = tipo_operacao == 'VENDA' or (not tipo_operacao and qtd < 0)

        if status != 'ABERTA' or not is_venda:
            return op, False

        expected = abs(qtd) * abs(premio)
        if resultado is None:
            if expected > 0:
                op['resultado'] = expected
                return op, True
            return op, False

        resultado_val = float(resultado)
        if resultado_val < 0:
            op['resultado'] = expected if expected > 0 else abs(resultado_val)
            return op, True
        if resultado_val == 0 and expected > 0:
            op['resultado'] = expected
            return op, True
        return op, False
    except Exception:
        return op, False


# ─── Listar todas ────────────────────────────────────────────────────────────
@opcoes_bp.route('', methods=['GET'])
def get_opcoes():
    conn    = db.get_db()
    ops     = conn.execute('SELECT * FROM operacoes_opcoes ORDER BY data_operacao DESC').fetchall()
    ops_list = []
    updates  = []
    for op in ops:
        data = dict(op)
        normalized, changed = normalize_resultado_opcao(data)
        ops_list.append(normalized)
        if changed:
            updates.append((normalized.get('resultado'), normalized.get('id')))
    if updates:
        c = conn.cursor()
        c.executemany('UPDATE operacoes_opcoes SET resultado=? WHERE id=?', updates)
        conn.commit()
    conn.close()
    return jsonify(ops_list)


# ─── Buscar por ID ────────────────────────────────────────────────────────────
@opcoes_bp.route('/<int:id>', methods=['GET'])
def get_opcao(id):
    conn = db.get_db()
    op   = conn.execute('SELECT * FROM operacoes_opcoes WHERE id=?', (id,)).fetchone()
    if op:
        data = dict(op)
        normalized, changed = normalize_resultado_opcao(data)
        if changed:
            conn.execute('UPDATE operacoes_opcoes SET resultado=? WHERE id=?',
                         (normalized.get('resultado'), id))
            conn.commit()
        conn.close()
        return jsonify(normalized)
    conn.close()
    return jsonify({'error': 'Operação não encontrada'}), 404


# ─── Criar ────────────────────────────────────────────────────────────────────
@opcoes_bp.route('', methods=['POST'])
def create_opcoes():
    data = request.json
    conn = db.get_db()
    c    = conn.cursor()
    c.execute('''
        INSERT INTO operacoes_opcoes
            (ativo_base, ativo, tipo, tipo_operacao, quantidade, preco_entrada,
             preco_atual, strike, vencimento, premio, resultado, saldo_abertura,
             status, data_operacao, observacoes, is_test_data)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ''', (
        data.get('ativo_base'),
        data.get('ativo'),
        data.get('tipo'),
        data.get('tipo_operacao', 'VENDA'),
        data.get('quantidade'),
        data.get('preco_entrada'),
        data.get('preco_atual'),
        data.get('strike'),
        data.get('vencimento'),
        data.get('premio'),
        data.get('resultado'),
        data.get('saldo_abertura'),
        data.get('status'),
        data.get('data_operacao', datetime.now().strftime('%Y-%m-%d')),
        data.get('observacoes'),
        1 if data.get('is_test_data') else 0,
    ))
    conn.commit()
    new_id = c.lastrowid
    conn.close()
    return jsonify({'success': True, 'id': new_id})


# ─── Atualizar ────────────────────────────────────────────────────────────────
@opcoes_bp.route('/<int:id>', methods=['PUT'])
def update_opcoes(id):
    data = request.json
    conn = db.get_db()
    conn.execute('''
        UPDATE operacoes_opcoes SET
            ativo_base=?, ativo=?, tipo=?, tipo_operacao=?, quantidade=?,
            preco_entrada=?, preco_atual=?, strike=?, vencimento=?,
            premio=?, resultado=?, saldo_abertura=?, status=?, data_operacao=?,
            observacoes=?, is_test_data=?
        WHERE id=?
    ''', (
        data.get('ativo_base'),
        data.get('ativo'),
        data.get('tipo'),
        data.get('tipo_operacao', 'VENDA'),
        data.get('quantidade'),
        data.get('preco_entrada'),
        data.get('preco_atual'),
        data.get('strike'),
        data.get('vencimento'),
        data.get('premio'),
        data.get('resultado'),
        data.get('saldo_abertura'),
        data.get('status'),
        data.get('data_operacao'),
        data.get('observacoes'),
        1 if data.get('is_test_data') else 0,
        id,
    ))
    conn.commit()
    conn.close()
    return jsonify({'success': True})


# ─── Excluir ──────────────────────────────────────────────────────────────────
@opcoes_bp.route('/<int:id>', methods=['DELETE'])
def delete_opcoes(id):
    conn = db.get_db()
    conn.execute('DELETE FROM operacoes_opcoes WHERE id=?', (id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})


# ─── Excluir dados de teste ───────────────────────────────────────────────────
@opcoes_bp.route('/test-data', methods=['DELETE'])
def delete_test_data():
    """Remove todos os registros marcados como is_test_data=1.
    Pode ser chamado pelo dashboard após executar testes E2E.
    """
    conn = db.get_db()
    c    = conn.cursor()
    c.execute('DELETE FROM operacoes_opcoes WHERE is_test_data=1')
    deleted = c.rowcount
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'deleted': deleted})


# ─── Atualizar cotações das operações abertas ─────────────────────────────────
@opcoes_bp.route('/refresh', methods=['POST'])
def refresh_opcoes_quotes():
    """Busca cotação atual (OpLab) para cada operação com status=ABERTA.
       Retorna dados por operação incluindo spot_price do ativo-base."""
    import certifi
    import requests
    from requests.exceptions import SSLError

    def _oplab_get(url, headers=None, timeout=5):
        mode = os.environ.get('OPLAB_SSL_VERIFY', 'auto').lower()
        if mode in ('false', '0', 'no'):
            return requests.get(url, headers=headers, timeout=timeout, verify=False)
        if mode in ('true', '1', 'yes'):
            return requests.get(url, headers=headers, timeout=timeout, verify=certifi.where())
        try:
            return requests.get(url, headers=headers, timeout=timeout, verify=certifi.where())
        except SSLError:
            return requests.get(url, headers=headers, timeout=timeout, verify=False)

    conn    = db.get_db()
    c       = conn.cursor()
    ops     = c.execute(
        "SELECT id, ativo, ativo_base, strike, premio, quantidade, vencimento, tipo, tipo_operacao "
        "FROM operacoes_opcoes WHERE status='ABERTA'"
    ).fetchall()
    api_key = os.environ.get('OPLAB_API_KEY', '')
    headers = {'Access-Token': api_key}
    updated = 0
    results = []
    stock_cache = {}   # cache underlying spot prices

    for op in ops:
        ticker       = op['ativo']
        base         = op['ativo_base'] or ''
        option_price = None
        spot_price   = None
        pop          = None

        # --- Fetch option price ---
        try:
            r = _oplab_get(f'https://api.oplab.com.br/v3/market/stocks/{ticker}',
                           headers=headers, timeout=5)
            if r.status_code == 200:
                d = r.json()
                option_price = d.get('close') or d.get('price') or d.get('last')
            if option_price is None:
                r2 = _oplab_get(f'https://api.oplab.com.br/v3/market/options/details/{ticker}',
                                headers=headers, timeout=5)
                if r2.status_code == 200:
                    d2 = r2.json()
                    if isinstance(d2, list) and d2:
                        option_price = d2[0].get('price') or d2[0].get('close')
                    elif isinstance(d2, dict):
                        option_price = d2.get('price') or d2.get('close')
                        # OpLab pode retornar implied prob aqui
                        pop = d2.get('probability_otm') or d2.get('pop') or d2.get('delta')
                        if pop and abs(pop) > 1:   # vem como percentual 0-100
                            pop = float(pop)
                        elif pop:
                            pop = float(pop) * 100
            if option_price is not None:
                c.execute('UPDATE operacoes_opcoes SET preco_atual=? WHERE id=?',
                          (float(option_price), op['id']))
                updated += 1
        except Exception as e:
            print(f'[opcoes/refresh] Erro ao atualizar opção {ticker}: {e}')

        # --- Fetch underlying stock price ---
        if base and base not in stock_cache:
            try:
                rs = _oplab_get(f'https://api.oplab.com.br/v3/market/stocks/{base}',
                                headers=headers, timeout=5)
                if rs.status_code == 200:
                    ds = rs.json()
                    sp = ds.get('close') or ds.get('price') or ds.get('last')
                    stock_cache[base] = float(sp) if sp is not None else None
                else:
                    stock_cache[base] = None
            except Exception as e:
                print(f'[opcoes/refresh] Erro ao buscar spot {base}: {e}')
                stock_cache[base] = None
        spot_price = stock_cache.get(base) if base else None

        # --- Estimate PoP if not returned by API ---
        if pop is None and spot_price and option_price is not None:
            try:
                strike = float(op['strike'] or 0)
                tipo   = (op['tipo'] or 'CALL').upper()
                if strike > 0 and spot_price > 0:
                    dist_pct = abs(spot_price - strike) / spot_price * 100
                    is_itm   = (spot_price < strike) if tipo == 'PUT' else (spot_price > strike)
                    if is_itm:
                        pop = max(5.0, 50.0 - dist_pct * 4.0)
                    else:
                        pop = min(95.0, 50.0 + dist_pct * 4.0)
            except Exception:
                pass

        results.append({
            'id':           op['id'],
            'option_price': float(option_price) if option_price is not None else None,
            'spot_price':   spot_price,
            'pop':          pop,
        })

    conn.commit()
    conn.close()
    return jsonify({'success': True, 'updated': updated, 'data': results})
