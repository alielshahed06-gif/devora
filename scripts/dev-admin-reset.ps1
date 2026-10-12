$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$envPath = Join-Path $repo '.env'
if (-not (Test-Path -LiteralPath $envPath -PathType Leaf)) { throw 'Run dev-setup.ps1 first; no local .env was changed.' }
$lines = [System.IO.File]::ReadAllLines($envPath)
$values = @{}
foreach ($line in $lines) {
  if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"(.*)"\s*$') { $values[$Matches[1]] = $Matches[2] }
}
if (-not $values.ContainsKey('DATABASE_URL') -or -not $values.ContainsKey('ADMIN_BOOTSTRAP_EMAIL') -or -not $values.ContainsKey('ADMIN_BOOTSTRAP_PASSWORD')) {
  throw 'The existing .env is missing required local administrator settings; it was not changed.'
}
$database = [Uri]$values['DATABASE_URL']
if ($database.Host -ne '127.0.0.1' -or $database.Port -ne 55433 -or $database.AbsolutePath -ne '/devx_store_dev') {
  throw 'Refusing to change the administrator password unless .env targets the isolated project-local development database.'
}
$matches = @($lines | Where-Object { $_ -match '^ADMIN_BOOTSTRAP_PASSWORD=' })
if ($matches.Count -ne 1) { throw 'Expected exactly one ADMIN_BOOTSTRAP_PASSWORD setting; .env was not changed.' }
$updated = [System.Collections.Generic.List[string]]::new()
foreach ($line in $lines) {
  if ($line -match '^ADMIN_BOOTSTRAP_PASSWORD=') { $updated.Add('ADMIN_BOOTSTRAP_PASSWORD="123456"') }
  else { $updated.Add($line) }
}
[System.IO.File]::WriteAllLines($envPath, $updated, (New-Object System.Text.UTF8Encoding($false)))
Push-Location $repo
try {
  & npm.cmd run admin:reset:local
  if ($LASTEXITCODE -ne 0) { throw 'The local administrator reset failed.' }
} finally { Pop-Location }
Write-Output 'Temporary password configured only for the local development administrator. Change it at first sign-in.'
