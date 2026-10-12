param([string]$AdminEmail = 'admin@localhost.test')
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$envPath = Join-Path $repo '.env'
if (-not (Test-Path -LiteralPath $envPath)) {
  if ($AdminEmail -notmatch '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') { throw 'Provide a valid local administrator email.' }
  $bytes = New-Object byte[] 48
  $passwordBytes = New-Object byte[] 24
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($bytes)
    $rng.GetBytes($passwordBytes)
  } finally { $rng.Dispose() }
  $secret = [Convert]::ToBase64String($bytes)
  $bootstrapPassword = [Convert]::ToBase64String($passwordBytes)
  $content = @(
    'CATALOG_SOURCE="database"'
    'DATABASE_URL="postgresql://postgres@127.0.0.1:55433/devx_store_dev?schema=public"'
    'DIRECT_URL="postgresql://postgres@127.0.0.1:55433/devx_store_dev?schema=public"'
    'TEST_DATABASE_URL="postgresql://postgres@127.0.0.1:55433/devx_store_test?schema=public"'
    'SHADOW_DATABASE_URL="postgresql://postgres@127.0.0.1:55433/devx_store_shadow?schema=public"'
    "SESSION_SECRET=`"$secret`""
    'APP_BASE_URL="http://localhost:3000"'
    "ADMIN_BOOTSTRAP_EMAIL=`"$AdminEmail`""
    "ADMIN_BOOTSTRAP_PASSWORD=`"$bootstrapPassword`""
  ) -join [Environment]::NewLine
  $encoding = New-Object System.Text.UTF8Encoding($false)
  $stream = [System.IO.File]::Open($envPath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
  try {
    $writer = New-Object System.IO.StreamWriter($stream, $encoding)
    try { $writer.WriteLine($content) } finally { $writer.Dispose() }
  } finally {
    if ($stream) { $stream.Dispose() }
  }
}

. (Join-Path $PSScriptRoot 'local-env.ps1')
Import-LocalEnvironment $envPath
foreach ($name in @('DATABASE_URL', 'DIRECT_URL', 'TEST_DATABASE_URL')) {
  $value = [Environment]::GetEnvironmentVariable($name, 'Process')
  if (-not $value) { throw "The existing .env is missing required $name." }
  $url = [Uri]$value
  if ($url.Host -notin @('127.0.0.1', 'localhost', '::1') -or $url.Port -ne 55433) {
    throw "The existing .env $name does not target the dedicated project-local PostgreSQL cluster; it was not changed."
  }
}
$devUrl = [Uri]$env:DATABASE_URL
$directUrl = [Uri]$env:DIRECT_URL
$testUrl = [Uri]$env:TEST_DATABASE_URL
if ($devUrl.AbsolutePath -ne '/devx_store_dev' -or $directUrl.AbsolutePath -ne '/devx_store_dev' -or $testUrl.AbsolutePath -ne '/devx_store_test') {
  throw 'The existing .env database names must be the dedicated devx_store_dev and devx_store_test databases.'
}
if (-not $env:SHADOW_DATABASE_URL) {
  $shadowLine = 'SHADOW_DATABASE_URL="postgresql://postgres@127.0.0.1:55433/devx_store_shadow?schema=public"'
  [System.IO.File]::AppendAllText($envPath, [Environment]::NewLine + $shadowLine, (New-Object System.Text.UTF8Encoding($false)))
  $env:SHADOW_DATABASE_URL = 'postgresql://postgres@127.0.0.1:55433/devx_store_shadow?schema=public'
}
$shadowUrl = [Uri]$env:SHADOW_DATABASE_URL
if ($shadowUrl.Host -ne '127.0.0.1' -or $shadowUrl.Port -ne 55433 -or $shadowUrl.AbsolutePath -ne '/devx_store_shadow') {
  throw 'SHADOW_DATABASE_URL must target this project-owned local shadow database; existing settings were preserved.'
}
& (Join-Path $PSScriptRoot 'dev-db-start.ps1')
if ($LASTEXITCODE -ne 0) { throw 'Could not start local PostgreSQL.' }

$bin = Get-PostgresBinDirectory
$psql = Join-Path $bin 'psql.exe'
$createdb = Join-Path $bin 'createdb.exe'
foreach ($database in @('devx_store_dev', 'devx_store_test', 'devx_store_shadow')) {
  $exists = & $psql -h 127.0.0.1 -p 55433 -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$database'"
  if ($LASTEXITCODE -ne 0) { throw "Could not inspect the dedicated local PostgreSQL cluster." }
  if (-not $exists) {
    & $createdb -h 127.0.0.1 -p 55433 -U postgres $database
    if ($LASTEXITCODE -ne 0) { throw "Could not create the dedicated local database $database." }
  }
}

Push-Location $repo
try {
  & npm.cmd run db:generate
  if ($LASTEXITCODE -ne 0) { throw 'Prisma client generation failed.' }
  $env:DATABASE_URL = 'postgresql://postgres@127.0.0.1:55433/devx_store_dev?schema=public'
  $env:DIRECT_URL = $env:DATABASE_URL
  & npm.cmd run db:migrate:deploy
  if ($LASTEXITCODE -ne 0) { throw 'Development database migrations failed.' }
  $env:DATABASE_URL = 'postgresql://postgres@127.0.0.1:55433/devx_store_test?schema=public'
  $env:DIRECT_URL = $env:DATABASE_URL
  & npm.cmd run db:migrate:deploy
  if ($LASTEXITCODE -ne 0) { throw 'Test database migrations failed.' }
  $env:DATABASE_URL = 'postgresql://postgres@127.0.0.1:55433/devx_store_dev?schema=public'
  $env:DIRECT_URL = $env:DATABASE_URL
  & npm.cmd run db:seed:local
  if ($LASTEXITCODE -ne 0) { throw 'Local sample data setup failed.' }
  & npm.cmd run admin:bootstrap:local
  if ($LASTEXITCODE -ne 0) { throw 'Local administrator bootstrap failed.' }
} finally {
  Pop-Location
}
Write-Output 'Local development and integration-test databases are ready. The initial administrator must change the temporary password after first login.'
