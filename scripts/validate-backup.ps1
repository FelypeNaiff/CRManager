# Script de Validação de Integridade de Backup — NEEX

param(
    [string]$FilePath = $null
)

$ErrorActionPreference = "Stop"

$backupDir = Join-Path $PSScriptRoot "..\backups"
$backupDir = [System.IO.Path]::GetFullPath($backupDir)

# Se nenhum arquivo foi passado, seleciona o backup mais recente na pasta backups/
if (-not $FilePath) {
    if (Test-Path $backupDir) {
        $latest = Get-ChildItem -Path $backupDir -File | 
                  Where-Object { $_.Extension -in @(".sql", ".dump", ".backup") } | 
                  Sort-Object LastWriteTime -Descending | 
                  Select-Object -First 1
        if ($latest) {
            $FilePath = $latest.FullName
        }
    }
}

if (-not $FilePath) {
    Write-Host "ERRO: Nenhum arquivo de backup especificado e nenhum backup encontrado em: $backupDir" -ForegroundColor Red
    exit 1
}

# 1. Verificar existência do arquivo
if (-not (Test-Path $FilePath)) {
    Write-Host "ERRO: O arquivo '$FilePath' não existe." -ForegroundColor Red
    exit 1
}

# 2. Obter informações e validar extensão
$file = Get-Item $FilePath
$validExtensions = @(".sql", ".dump", ".backup")
if ($file.Extension -notin $validExtensions) {
    Write-Host "ERRO: O arquivo '$FilePath' possui uma extensão inválida ($($file.Extension)). Extensões aceitas: .sql, .dump, .backup" -ForegroundColor Red
    exit 1
}

# 3. Validar tamanho (deve ser maior que zero)
if ($file.Length -eq 0) {
    Write-Host "ERRO: O arquivo de backup '$FilePath' está vazio (0 bytes)." -ForegroundColor Red
    exit 1
}

# 4. Calcular Hash SHA-256
try {
    $hashResult = Get-FileHash -Path $FilePath -Algorithm SHA256
    $sha256 = $hashResult.Hash.ToLower()
} catch {
    Write-Host "ERRO: Falha ao calcular o hash SHA-256 do arquivo." -ForegroundColor Red
    exit 1
}

# 5. Exibir resultado da auditoria
Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "ARQUIVO DE BACKUP CORRETAMENTE VALIDADO!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host "Arquivo:     $($file.Name)"
Write-Host "Caminho:     $($file.FullName)"
Write-Host "Tamanho:     $([Math]::Round($file.Length / 1KB, 2)) KB ($($file.Length) bytes)"
Write-Host "Modificado:  $($file.LastWriteTime.ToString('dd/MM/yyyy HH:mm:ss'))"
Write-Host "SHA256 Hash: $sha256"
Write-Host "=================================================="
Write-Host "Aviso: Nenhuma operação de restauração foi executada automaticamente." -ForegroundColor Yellow
Write-Host ""
