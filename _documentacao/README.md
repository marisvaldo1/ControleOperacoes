# Sistema de Controle de Investimentos BTC

Sistema completo para gerenciamento de operações de criptomoedas e opções, desenvolvido com Flask (backend) e Tabler.io (frontend).

## 🚀 Características

- **Backend em Flask** com SQLite para persistência de dados
- **Frontend moderno** baseado no template Tabler.io (tema dark por padrão)
- **Arquitetura modular** com separação de responsabilidades
- **APIs proxy** para Oplab e Binance (CORS bypass)
- **Bibliotecas modernas**: jQuery 4, DataTables, Chart.js, iziToast, SweetAlert2
- **Configurações persistentes** em localStorage e banco de dados
- **Responsivo** e otimizado para diferentes dispositivos

## 📁 Estrutura do Projeto

```
ControleOperacoesMiniMax/
├── backend/
│   ├── server.py           # API Flask
│   ├── .env                # Variáveis de ambiente
│   ├── requirements.txt    # Dependências Python
│   └── data/
│       └── controle_operacoes.db  # Banco SQLite
│
├── frontend/
│   ├── index.html          # Página inicial (redireciona para crypto.html)
│   ├── html/
│   │   ├── crypto.html     # Página de criptomoedas
│   │   └── opcoes.html     # Página de opções
│   ├── js/
│   │   ├── core/
│   │   │   ├── libs.js     # Carregador de bibliotecas
│   │   │   ├── layout.js   # Navbar e footer dinâmicos
│   │   │   └── global.js   # Funções comuns
│   │   ├── crypto.js       # Lógica da página crypto
│   │   └── opcoes.js       # Lógica da página opções
│   └── css/
│       ├── style.css       # Estilos globais
│       ├── crypto.css      # Estilos específicos crypto
│       └── opcoes.css      # Estilos específicos opções
│
└── README.md
```

## 🔧 Instalação e Configuração

### 1. Instalar dependências do Python

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configurar variáveis de ambiente

Edite o arquivo `backend/.env`:

```env
OPLAB_API_KEY=sua_chave_oplab_aqui
BINANCE_API_KEY=sua_chave_binance_aqui
BINANCE_SECRET=seu_secret_binance_aqui
```

### 3. Inicializar o banco de dados

O banco de dados será criado automaticamente ao iniciar o servidor pela primeira vez.
Já contém dados mockados para teste.

### 4. Iniciar o servidor

```bash
cd backend
python server.py
```

O servidor estará disponível em: `http://localhost:5000`

### 5. Abrir o frontend

Abra o arquivo `frontend/index.html` diretamente no navegador ou configure um servidor web local:

```bash
cd frontend
python -m http.server 8000
```

Acesse: `http://localhost:8000`

## 📱 Funcionalidades

### Página Crypto (Criptomoedas)
- ✅ Dashboard com métricas principais
- ✅ Gestão de operações (CRUD completo)
- ✅ Visualização por Mês Atual, Histórico e Anual
- ✅ Gráficos interativos com Chart.js
- ✅ Atualização de cotações via API Binance
- ✅ Cálculo automático de TAE, distância, resultados

### Página Opções (Ações)
- ✅ Dashboard com métricas principais
- ✅ Gestão de operações (CRUD completo)
- ✅ Controle de CALL e PUT
- ✅ Acompanhamento de status (ABERTA, FECHADA, EXERCIDA)
- ✅ Atualização de cotações via API Oplab

### Recursos Globais
- ✅ Navbar com menu de navegação
- ✅ Botão de atualização de cotações
- ✅ Painel de configurações (offcanvas lateral)
- ✅ Toggle entre tema dark/light
- ✅ Notificações com iziToast (canto superior direito)
- ✅ Confirmações com SweetAlert2
- ✅ Tabelas responsivas com DataTables
- ✅ Modais centralizados para todas as operações

## 🎨 Personalização

### Cores do Tema

As cores seguem o padrão do Tabler.io:

```css
--tblr-primary: #206bc4
--tblr-success: #2fb344
--tblr-danger: #d63939
--tblr-warning: #f59f00
--tblr-info: #4299e1
```

### Tema Dark (Padrão)

```css
--tblr-body-bg: #1e293b
--tblr-body-color: #cbd5e1
--tblr-card-bg: #0f172a
```

## 🔌 APIs Utilizadas

### Backend (Proxy)
- `/api/proxy/crypto/<ticker>` - Binance API
- `/api/proxy/stocks/<ticker>` - Oplab API (ações)
- `/api/proxy/options/<ticker>` - Oplab API (opções)

### Operações Crypto
- `GET /api/crypto` - Listar todas
- `POST /api/crypto` - Criar nova
- `PUT /api/crypto/<id>` - Atualizar
- `DELETE /api/crypto/<id>` - Excluir

### Operações Opções
- `GET /api/opcoes` - Listar todas
- `POST /api/opcoes` - Criar nova
- `PUT /api/opcoes/<id>` - Atualizar
- `DELETE /api/opcoes/<id>` - Excluir

### Configurações
- `GET /api/config` - Obter configurações
- `POST /api/config` - Salvar configurações

## 🛠️ Tecnologias

### Backend
- Python 3.x
- Flask
- Flask-CORS
- SQLite3
- Requests
- python-dotenv

### Frontend
- HTML5, CSS3, JavaScript
- Tabler.io (Framework CSS)
- jQuery 4
- DataTables
- Chart.js
- iziToast
- SweetAlert2

## 📝 Notas Importantes

1. **CORS**: As APIs Oplab e Binance têm bloqueio de CORS, por isso é necessário usar o proxy do backend.

2. **jQuery 4**: O projeto usa jQuery 4 (beta) conforme solicitado. Se houver problemas de compatibilidade, pode-se reverter para jQuery 3.7.1.

3. **Dados Mockados**: O banco de dados já vem com alguns dados de exemplo para teste. Eles podem ser removidos pela interface.

4. **LocalStorage**: As configurações são salvas tanto no localStorage do navegador quanto no banco de dados para persistência entre sessões.

5. **Modais Centralizados**: Todas as janelas modais foram configuradas para aparecer centralizadas na tela.

6. **Notificações**: iziToast configurado para aparecer no canto superior direito com animações suaves.

## 🐛 Resolução de Problemas

### Servidor não inicia
- Verifique se as dependências estão instaladas: `pip install -r requirements.txt`
- Verifique se a porta 5000 está disponível

### Frontend não carrega dados
- Verifique se o backend está rodando
- Verifique a configuração do `API_BASE` em `frontend/js/core/global.js`
- Abra o console do navegador para ver erros

### Erro de CORS
- Certifique-se de que o Flask-CORS está instalado
- Verifique se as requisições estão passando pelo proxy do backend

## 📄 Licença

Este projeto é proprietário e de uso interno.

## 👨‍💻 Autor

Desenvolvido para controle de investimentos em criptomoedas e opções.
