# Script de Backup Seguro do Banco de Dados — NEEX

$ErrorActionPreference = "Stop"

# 1. Verificar se pg_dump existe no sistema
$pgDumpPath = $null
$pgDumpCmd = Get-Command pg_dump -ErrorAction SilentlyContinue
if ($pgDumpCmd) {
    $pgDumpPath = $pgDumpCmd.Source
} else {
    # Procurar em diretórios padrão do PostgreSQL no Windows
    $commonPaths = @(
        "C:\Program Files\PostgreSQL\*\bin\pg_dump.exe",
        "C:\Program Files (x86)\PostgreSQL\*\bin\pg_dump.exe"
    )
    foreach ($pattern in $commonPaths) {
        $resolved = Resolve-Path $pattern -ErrorAction SilentlyContinue
        if ($resolved) {
            # Se encontrar múltiplas versões, seleciona a maior versão (ordena decrescente)
            $sorted = $resolved | Sort-Object -Property Path -Descending
            $pgDumpPath = $sorted[0].Path
            break
        }
    }
}

if (-not $pgDumpPath) {
    Write-Host ""
    Write-Host "==========================================================================" -ForegroundColor Red
    Write-Host "ERRO: O utilitário 'pg_dump' não foi encontrado no sistema." -ForegroundColor Red
    Write-Host "==========================================================================" -ForegroundColor Red
    Write-Host "Para executar backups manuais locais, instale as ferramentas de linha de comando do PostgreSQL:"
    Write-Host "1. Baixe o instalador do PostgreSQL para Windows: https://www.postgresql.org/download/windows/"
    Write-Host "2. Execute o instalador e selecione APENAS 'Command Line Tools' (ou configure o PATH manually)."
    Write-Host "3. Adicione o diretório 'bin' da instalação (ex: C:\Program Files\PostgreSQL\16\bin) ao PATH do Windows."
    Write-Host "=========================================================================="
    Write-Host ""
    exit 1
}

# 2. Obter URL de conexão (prioriza DIRECT_URL para pg_dump, senão DATABASE_URL)
$dbUrl = $env:DIRECT_URL
if (-not $dbUrl -and (Test-Path ".env")) {
    Get-Content ".env" | Foreach-Object {
        $line = $_.Trim()
        if ($line -match "^DIRECT_URL\s*=\s*`"(.+)`"$" -or $line -match "^DIRECT_URL\s*=\s*'(.+)'$" -or $line -match "^DIRECT_URL\s*=\s*(.+)$") {
            $dbUrl = $Matches[1].Trim().Trim('"').Trim("'")
        }
    }
}
if (-not $dbUrl) {
    $dbUrl = $env:DATABASE_URL
    if (-not $dbUrl -and (Test-Path ".env")) {
        Get-Content ".env" | Foreach-Object {
            $line = $_.Trim()
            if ($line -match "^DATABASE_URL\s*=\s*`"(.+)`"$" -or $line -match "^DATABASE_URL\s*=\s*'(.+)'$" -or $line -match "^DATABASE_URL\s*=\s*(.+)$") {
                $dbUrl = $Matches[1].Trim().Trim('"').Trim("'")
            }
        }
    }
}

if (-not $dbUrl) {
    Write-Host "ERRO: As variáveis de ambiente DIRECT_URL ou DATABASE_URL não estão configuradas e não foram encontradas no arquivo .env." -ForegroundColor Red
    exit 1
}

# 3. Preparar diretório de backups
$backupDir = Join-Path $PSScriptRoot "..\backups"
$backupDir = [System.IO.Path]::GetFullPath($backupDir)
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
}

# 4. Gerar nome do arquivo com timestamp
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$fileName = "neex_backup_$timestamp.sql"
$backupPath = Join-Path $backupDir $fileName

Write-Host "Iniciando geração de backup lógico do banco de dados..." -ForegroundColor Cyan

# 5. Executar pg_dump sem expor a URL de conexão
try {
    # Executa passando a URL de conexão oculta e suprimindo avisos
    & $pgDumpPath --dbname=$dbUrl --file=$backupPath --clean --no-owner --no-acl
} catch {
    Write-Host "ERRO: Falha ao executar o comando pg_dump." -ForegroundColor Red
    exit 1
}

# 6. Validar o arquivo de backup gerado
if (Test-Path $backupPath) {
    $fileInfo = Get-Item $backupPath
    if ($fileInfo.Length -gt 0) {
        Write-Host "`n==================================================" -ForegroundColor Green
        Write-Host "BACKUP CONCLUÍDO E VALIDADO COM SUCESSO!" -ForegroundColor Green
        Write-Host "==================================================" -ForegroundColor Green
        Write-Host "Caminho: $backupPath"
        Write-Host "Tamanho: $([Math]::Round($fileInfo.Length / 1KB, 2)) KB"
        Write-Host "Data:    $($fileInfo.LastWriteTime.ToString('dd/MM/yyyy HH:mm:ss'))"
        Write-Host "=================================================="
    } else {
        Remove-Item $backupPath -ErrorAction SilentlyContinue
        Write-Host "ERRO: O arquivo de backup foi criado mas possui 0 bytes de tamanho (vazio)." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "ERRO: O arquivo de backup não foi criado." -ForegroundColor Red
    exit 1
}
