# start_preview_5175_boot.ps1 - KCQ preview workbench (5175) detached bootstrap.
# Local dev tooling, not part of upstream PRs. MUST stay pure ASCII.
# Launched via Invoke-CimMethod Win32_Process.Create (separate process tree).

$ErrorActionPreference = 'Stop'
$pkgDir = 'D:\AI\KCQ-NexusAI\packages\vue'
$log = 'D:\AI\KCQ-NexusAI\temp\preview_5175.log'

$listener = Get-NetTCPConnection -LocalPort 5175 -State Listen -ErrorAction SilentlyContinue
if ($listener) { exit 0 }

if (-not (Test-Path -LiteralPath $pkgDir)) { exit 1 }
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $log) | Out-Null

Set-Location $pkgDir
$cmd = 'npm run dev >> "' + $log + '" 2>&1'
Invoke-Expression -Command $cmd
