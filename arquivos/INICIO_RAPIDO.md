# 🚀 Inicialização Rápida

## Opção 1: Usar o script automático (Windows)

Execute o arquivo `start.bat` clicando duas vezes nele.

O script irá:
1. Instalar as dependências
2. Iniciar o backend (Flask)
3. Iniciar o frontend (HTTP Server)
4. Abrir automaticamente no navegador

## Opção 2: Inicialização manual

### Terminal 1 - Backend
```bash
cd backend
python server.py
```

### Terminal 2 - Frontend
```bash
python start_frontend.py
```

### Abrir no navegador
http://localhost:8000/html/crypto.html

## Opção 3: Abrir HTML diretamente

Você pode abrir diretamente o arquivo:
`frontend/html/crypto.html` no navegador

**Nota:** O backend deve estar rodando na porta 5000.

## ⚙️ Configuração Inicial

1. Edite o arquivo `backend/.env` com suas chaves API:
   - OPLAB_API_KEY
   - BINANCE_API_KEY
   - BINANCE_SECRET

2. No navegador, clique no ícone de configurações (engrenagem) no navbar para configurar as chaves na interface.

## 📊 Dados de Teste

O sistema já vem com dados mockados para teste:
- 1 operação de crypto (BTCUSDT)
- 2 operações de opções (PETR4, VALE3)

Você pode excluir esses dados pela interface ou adicionar novos.

## 🎨 Tema

O sistema inicia com tema **dark** por padrão.
Use o botão de sol/lua no navbar para alternar entre dark/light.

## 📱 Funcionalidades Principais

### Página Crypto
- Dashboard com métricas
- Adicionar/Editar/Excluir operações
- Visualização por período (Mês Atual, Histórico, Anual)
- Gráficos interativos
- Atualização de cotações

### Página Opções
- Dashboard com métricas
- Gestão completa de operações
- Controle de CALL/PUT
- Status das operações
- Análise mensal e anual

## 🔧 Solução de Problemas

### Backend não inicia
- Verifique se Python está instalado: `python --version`
- Instale as dependências: `pip install -r backend/requirements.txt`

### Frontend não carrega dados
- Verifique se o backend está rodando em http://localhost:5000
- Abra o console do navegador (F12) para ver erros

### Erro de CORS
- Certifique-se de usar o proxy do backend para chamadas às APIs
- As requisições devem passar por http://localhost:5000/api/proxy/...

## 📞 Suporte

Para dúvidas ou problemas, consulte o arquivo README.md para mais detalhes.

## ✅ Checklist de Verificação

- [ ] Python instalado
- [ ] Dependências instaladas (`pip install -r backend/requirements.txt`)
- [ ] Arquivo `.env` configurado
- [ ] Backend rodando na porta 5000
- [ ] Frontend acessível (porta 8000 ou arquivo direto)
- [ ] Navegador moderno (Chrome, Firefox, Edge)

Pronto! Seu sistema está funcionando! 🎉
