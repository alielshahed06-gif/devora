$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'local-env.ps1')
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$data = Join-Path $repo '.local\postgres-data'
if (-not (Test-Path (Join-Path $data 'PG_VERSION'))) {
  Write-Output 'Dedicated local PostgreSQL has not been initialized.'
  exit 0
}
$pgCtl = Join-Path (Get-PostgresBinDirectory) 'pg_ctl.exe'
& $pgCtl -D $data -m fast -w stop
if ($LASTEXITCODE -ne 0) { throw "Could not stop the dedicated local PostgreSQL cluster (exit $LASTEXITCODE)." }
