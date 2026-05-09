param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("backup", "restore")]
    [string]$Mode,

    [string]$InputPath,
    [string]$OutputPath,
    [string]$DatabaseUrl = $env:DATABASE_URL
)

$ErrorActionPreference = "Stop"

function Require-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name not found on PATH"
    }
}

if (-not $DatabaseUrl) {
    throw "DATABASE_URL is required"
}

Require-Command "pg_dump"
Require-Command "pg_restore"

switch ($Mode) {
    "backup" {
        if (-not $OutputPath) {
            $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
            $OutputPath = Join-Path $PSScriptRoot "backups\promptledger-$stamp.dump"
        }

        $outputDir = Split-Path -Parent $OutputPath
        if ($outputDir -and -not (Test-Path $outputDir)) {
            New-Item -ItemType Directory -Path $outputDir | Out-Null
        }

        pg_dump --format=custom --file $OutputPath --dbname $DatabaseUrl
        Write-Host "Backup written to $OutputPath"
    }
    "restore" {
        if (-not $InputPath) {
            throw "InputPath is required for restore"
        }
        if (-not (Test-Path $InputPath)) {
            throw "Backup file not found: $InputPath"
        }

        pg_restore --clean --if-exists --dbname $DatabaseUrl $InputPath
        Write-Host "Restore completed from $InputPath"
    }
}