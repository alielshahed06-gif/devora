$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'local-env.ps1')
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$data = Join-Path $repo '.local\postgres-data'
$bin = Get-PostgresBinDirectory
$pgCtl = Join-Path $bin 'pg_ctl.exe'
$initDb = Join-Path $bin 'initdb.exe'

New-Item -ItemType Directory -Path (Split-Path $data -Parent) -Force | Out-Null
if (-not (Test-Path (Join-Path $data 'PG_VERSION'))) {
  if (Test-Path $data) { throw "Refusing to initialize a non-empty, unrecognized data directory: $data" }
  & $initDb -D $data -U postgres -A trust --no-locale -E UTF8
  if ($LASTEXITCODE -ne 0) { throw "PostgreSQL initialization failed (exit $LASTEXITCODE)." }
}

& $pgCtl -D $data status *> $null
if ($LASTEXITCODE -eq 0) {
  Write-Output 'Local PostgreSQL is already running on its dedicated data directory.'
  return
}
& $pgCtl -D $data -o '-h 127.0.0.1 -p 55433' -l (Join-Path $data 'server.log') -w start
if ($LASTEXITCODE -ne 0) { throw "Could not start the dedicated local PostgreSQL cluster (exit $LASTEXITCODE)." }
Write-Output 'Dedicated local PostgreSQL is running on 127.0.0.1:55433.'
