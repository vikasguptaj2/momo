$ErrorActionPreference = 'Stop'

function Require-Command([string]$Name, [string]$InstallHint) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is required. $InstallHint"
  }
}

Require-Command 'node' 'Install Node.js 22.12 or later from https://nodejs.org/. '
Require-Command 'npm' 'npm is included with Node.js.'
Require-Command 'dotnet' 'Install the .NET 10 SDK from https://dotnet.microsoft.com/download/dotnet/10.0.'

$nodeVersion = (node --version).Trim().TrimStart('v').Split('.')[0..1] -join '.'
$nodeParts = $nodeVersion.Split('.') | ForEach-Object { [int]$_ }
if ($nodeParts[0] -lt 22 -or ($nodeParts[0] -eq 22 -and $nodeParts[1] -lt 12)) {
  throw "Node.js 22.12+ is required; detected $(node --version)."
}

$dotnetVersion = (dotnet --version).Trim()
if (-not $dotnetVersion.StartsWith('10.')) {
  throw ".NET SDK 10.0 is required; detected $dotnetVersion."
}

Write-Host 'Installing Node dependencies...' -ForegroundColor Cyan
npm install
Write-Host 'Checking TypeScript...' -ForegroundColor Cyan
npm run typecheck
Write-Host 'Running unit tests...' -ForegroundColor Cyan
npm test
Write-Host 'Publishing Windows monitor and building installer...' -ForegroundColor Cyan
npm run dist:win
Write-Host 'Done. Installer output is in .\dist\' -ForegroundColor Green
