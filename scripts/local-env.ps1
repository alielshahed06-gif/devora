function Import-LocalEnvironment {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "Local environment file is missing: $Path"
  }
  foreach ($line in [System.IO.File]::ReadAllLines($Path)) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"(.*)"\s*$') {
      [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], 'Process')
    }
  }
}

function Get-PostgresBinDirectory {
  $known = 'C:\Program Files\PostgreSQL\18\bin'
  if (Test-Path (Join-Path $known 'pg_ctl.exe')) { return $known }
  $command = Get-Command pg_ctl.exe -ErrorAction SilentlyContinue
  if ($command) { return Split-Path $command.Source -Parent }
  throw 'PostgreSQL 18 command-line tools are required. Install PostgreSQL locally, then run this script again.'
}

