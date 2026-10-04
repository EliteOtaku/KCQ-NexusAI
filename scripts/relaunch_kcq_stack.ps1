# relaunch_kcq_stack.ps1 - visible PowerShell windows for the KCQ plugin stack after reboot.
# Local dev tooling, not part of upstream PRs. MUST stay pure ASCII.
# Windows: 8090 connector (venv python, foreground) / 5177 dist static (CORS) / 5175 preview dev.

$ErrorActionPreference = 'Continue'

# 1) MT5 connector (8090) - project venv python in foreground window
Start-Process powershell -ArgumentList @('-NoExit','-ExecutionPolicy','Bypass','-Command',"Set-Location 'D:\AI\KCQ-MT5-connector'; Write-Host '[8090] KCQ MT5 connector' -ForegroundColor Cyan; & '.\.venv\Scripts\python.exe' './server.py'")

# 2) kcq-plugins dist static CORS server (5177)
Start-Process powershell -ArgumentList @('-NoExit','-ExecutionPolicy','Bypass','-Command',"Set-Location 'D:\AI\cloudtradeagent-vela\kcq-plugins'; Write-Host '[5177] kcq-plugins dist CORS static' -ForegroundColor Cyan; node '.\temp\serve_5177.mjs'")

# 3) KCQ preview dev server (5175)
Start-Process powershell -ArgumentList @('-NoExit','-ExecutionPolicy','Bypass','-Command',"Set-Location 'D:\AI\KCQ-NexusAI\packages\vue'; Write-Host '[5175] KCQ preview dev server' -ForegroundColor Cyan; npm run dev")

Write-Host 'launched: 8090 / 5177 / 5175 (three visible windows)'
