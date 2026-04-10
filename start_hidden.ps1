param()

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $projectRoot 'backend'
$tmpDir = Join-Path $projectRoot '.tmp'
$requirementsFile = Join-Path $backendDir 'requirements.txt'
$startupLog = Join-Path $tmpDir 'start_hidden.log'
$stdoutLog = Join-Path $tmpDir 'server_stdout.log'
$stderrLog = Join-Path $tmpDir 'server_stderr.log'
$pidFile = Join-Path $tmpDir 'server.pid'
$appUrl = 'http://localhost:8888/html/opcoes.html'

function Show-StartupError {
    param([string]$Message)

    try {
        $shell = New-Object -ComObject WScript.Shell
        $null = $shell.Popup($Message, 0, 'Controle Operacoes - Falha ao iniciar', 16)
    } catch {
    }
}

function Resolve-Python {
    $venvPython = Join-Path $projectRoot '.venv\Scripts\python.exe'
    if (Test-Path $venvPython) {
        return $venvPython
    }

    $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if ($pythonCommand) {
        return $pythonCommand.Source
    }

    throw 'Python nao encontrado. Instale o Python 3.x ou crie a pasta .venv.'
}

function Wait-ForPort {
    param(
        [int]$Port,
        [int]$TimeoutSeconds = 20
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $client = New-Object Net.Sockets.TcpClient
            $client.Connect('127.0.0.1', $Port)
            $client.Close()
            return $true
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }

    return $false
}

New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
Set-Content -Path $startupLog -Value ("[{0}] Inicializacao silenciosa" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))

try {
    $python = Resolve-Python
    Add-Content -Path $startupLog -Value ("[{0}] Python: {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $python)

    Push-Location $backendDir
    try {
        & $python -m pip install -r $requirementsFile -q *>> $startupLog
        if ($LASTEXITCODE -ne 0) {
            throw 'Falha ao instalar as dependencias do backend.'
        }
    } finally {
        Pop-Location
    }

    $connections = Get-NetTCPConnection -LocalPort 8888 -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($processId in $connections) {
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }

    Remove-Item $stdoutLog, $stderrLog, $pidFile -Force -ErrorAction SilentlyContinue

    $serverProcess = Start-Process -FilePath $python -ArgumentList 'server.py' -WorkingDirectory $backendDir -WindowStyle Hidden -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -PassThru

    Set-Content -Path $pidFile -Value $serverProcess.Id
    Add-Content -Path $startupLog -Value ("[{0}] Servidor iniciado com PID {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $serverProcess.Id)

    if (-not (Wait-ForPort -Port 8888 -TimeoutSeconds 20)) {
        throw 'O servidor nao respondeu na porta 8888 dentro do tempo esperado. Consulte .tmp\\server_stderr.log.'
    }

    Start-Process $appUrl | Out-Null
    Add-Content -Path $startupLog -Value ("[{0}] Navegador aberto em {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $appUrl)
    exit 0
} catch {
    Add-Content -Path $startupLog -Value ("[{0}] ERRO: {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $_.Exception.Message)
    Show-StartupError ($_.Exception.Message + "`n`nConsulte o arquivo .tmp\\start_hidden.log para mais detalhes.")
    exit 1
}