$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
. (Join-Path $PSScriptRoot 'local-env.ps1')
Import-LocalEnvironment (Join-Path $repo '.env')
& (Join-Path $PSScriptRoot 'dev-db-start.ps1')
if ($LASTEXITCODE -ne 0) { throw 'Could not start local PostgreSQL.' }
Push-Location $repo
try {
  & npm.cmd run dev
  if ($LASTEXITCODE -ne 0) { throw "Next.js development server exited with code $LASTEXITCODE." }
} finally {
  Pop-Location
}
