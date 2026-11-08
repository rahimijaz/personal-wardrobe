<#
.SYNOPSIS
  Personal Wardrobe & AI Virtual Try-On Studio - Universal Startup Script
  Launches both the Python VTON Service (port 8188) and the Next.js Web App (port 3000).
#>

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
try {
    $Host.UI.RawUI.WindowTitle = "Personal Wardrobe - AI Studio"
} catch {}

function Write-Step ($msg) {
    Write-Host "[*] $msg" -ForegroundColor Cyan
}

function Write-Success ($msg) {
    Write-Host "[OK] $msg" -ForegroundColor Green
}

function Write-Warn ($msg) {
    Write-Host "[!] $msg" -ForegroundColor Yellow
}

function Write-Err ($msg) {
    Write-Host "[ERR] $msg" -ForegroundColor Red
}

Clear-Host
Write-Host "==========================================================" -ForegroundColor Magenta
Write-Host "    PERSONAL WARDROBE & AI VIRTUAL TRY-ON STUDIO          " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Magenta
Write-Host ""

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RootDir

# 1. Locate Python Interpreter with FASHN-VTON environment
$PythonExe = $null
$CandidatePaths = @(
    "$RootDir\.venv-fashn\Scripts\python.exe",
    "$RootDir\.venv\Scripts\python.exe",
    "python"
)

foreach ($candidate in $CandidatePaths) {
    if ($candidate -eq "python" -or (Test-Path $candidate)) {
        try {
            $testOut = & $candidate -c "import torch; print('OK')" 2>$null
            if ($testOut -like "*OK*") {
                $PythonExe = $candidate
                break
            }
        } catch {}
    }
}

if (-not $PythonExe) {
    Write-Err "Could not find a valid Python environment with PyTorch installed."
    Write-Host "Please ensure .venv-fashn exists or run pip install -r requirements." -ForegroundColor Yellow
    Pause
    exit 1
}

Write-Success "Python environment detected: $PythonExe"

# 2. Check for port conflicts & clean stale instances if desired
function Free-Port ($port) {
    try {
        $conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        if ($conns) {
            foreach ($c in $conns) {
                $pidToKill = $c.OwningProcess
                if ($pidToKill -and $pidToKill -gt 4 -and $pidToKill -ne $PID) {
                    Write-Warn "Port $port is in use by PID $pidToKill. Releasing port..."
                    Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
                }
            }
        }
    } catch {}
}

Write-Step "Checking network ports (8188 and 3000)..."
Free-Port 8188
Free-Port 3000

# 3. Launch Python VTON backend
Write-Step "Starting local VTON Service (FASHN-VTON and RMBG-1.4 on port 8188)..."
$vtonLog = Join-Path $RootDir "vton-service.log"
$vtonErr = Join-Path $RootDir "vton-service.err.log"
$VtonProcess = Start-Process -FilePath $PythonExe `
    -ArgumentList "vton-service\server.py --port 8188" `
    -WorkingDirectory $RootDir `
    -RedirectStandardOutput $vtonLog `
    -RedirectStandardError $vtonErr `
    -PassThru `
    -WindowStyle Hidden

# Poll for backend readiness
$vtonReady = $false
$attempts = 0
while (-not $vtonReady -and $attempts -lt 30) {
    Start-Sleep -Milliseconds 600
    $attempts++
    try {
        $res = Invoke-RestMethod -Uri "http://127.0.0.1:8188/health" -TimeoutSec 2 -ErrorAction Stop
        if ($res.service) {
            $vtonReady = $true
        }
    } catch {
        Write-Host "." -NoNewline -ForegroundColor DarkGray
    }
}
Write-Host ""

if ($vtonReady) {
    Write-Success "VTON Service is Online on http://127.0.0.1:8188"
} else {
    Write-Warn "VTON Service is taking longer to respond. Checking logs..."
    if (Test-Path $vtonLog) {
        Get-Content $vtonLog -Tail 10 | ForEach-Object { Write-Host "   $_" -ForegroundColor DarkGray }
    }
}

# 4. Launch Next.js Web App
Write-Step "Starting Next.js frontend (port 3000)..."
$NpmCmd = (Get-Command "npm.cmd" -ErrorAction SilentlyContinue).Source
if (-not $NpmCmd) { $NpmCmd = "npm" }

$NextProcess = Start-Process -FilePath $NpmCmd `
    -ArgumentList "run dev" `
    -WorkingDirectory $RootDir `
    -PassThru `
    -WindowStyle Normal

# Wait for frontend readiness
$nextReady = $false
$attempts = 0
while (-not $nextReady -and $attempts -lt 35) {
    Start-Sleep -Milliseconds 700
    $attempts++
    try {
        $res = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        if ($res.StatusCode -eq 200) {
            $nextReady = $true
        }
    } catch {
        Write-Host "." -NoNewline -ForegroundColor DarkGray
    }
}
Write-Host ""

if ($nextReady) {
    Write-Success "Next.js Web Studio is Online on http://localhost:3000"
} else {
    Write-Warn "Next.js dev server is compiling..."
}

# 5. Open in default browser
Write-Success "Launching Studio in your browser: http://localhost:3000"
try {
    Start-Process "http://localhost:3000"
} catch {}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  Both services are running!                              " -ForegroundColor White
Write-Host "  - Frontend : http://localhost:3000                      " -ForegroundColor Cyan
Write-Host "  - Backend  : http://127.0.0.1:8188 (VTON and Cutout AI) " -ForegroundColor Cyan
Write-Host "                                                          " -ForegroundColor White
Write-Host "  Press Ctrl+C or type 'q' in this window to stop both.   " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Green
Write-Host ""

# Graceful termination handler with safe error-tolerant loop
try {
    while ($true) {
        Start-Sleep -Seconds 1

        # Check if Python process terminated unexpectedly
        if ($VtonProcess -and $VtonProcess.HasExited) {
            Write-Err "VTON Service (PID $($VtonProcess.Id)) stopped unexpectedly with exit code $($VtonProcess.ExitCode)."
            if (Test-Path $vtonErr) {
                $errContent = Get-Content $vtonErr -Raw
                if ($errContent -and $errContent.Trim()) {
                    Write-Host "Error log (vton-service.err.log):" -ForegroundColor Red
                    Get-Content $vtonErr -Tail 15 | ForEach-Object { Write-Host "   $_" -ForegroundColor Red }
                }
            }
            if (Test-Path $vtonLog) {
                Write-Host "Service log (vton-service.log):" -ForegroundColor Yellow
                Get-Content $vtonLog -Tail 10 | ForEach-Object { Write-Host "   $_" -ForegroundColor DarkGray }
            }
            break
        }

        # Check if Next.js process terminated unexpectedly
        if ($NextProcess -and $NextProcess.HasExited) {
            Write-Err "Next.js Web App (PID $($NextProcess.Id)) stopped unexpectedly with exit code $($NextProcess.ExitCode)."
            break
        }

        # Safe key check (wrapped so redirected stdin/non-interactive terminals won't crash)
        try {
            if ([Console]::KeyAvailable) {
                $key = [Console]::ReadKey($true)
                if ($key.KeyChar -eq 'q' -or $key.KeyChar -eq 'Q') {
                    Write-Step "Shutdown requested by user ('q')."
                    break
                }
            }
        } catch {
            # Stdin is redirected or non-interactive console; sleep and continue
        }
    }
} finally {
    Write-Host ""
    Write-Step "Shutting down servers cleanly..."
    if ($NextProcess -and -not $NextProcess.HasExited) {
        Stop-Process -Id $NextProcess.Id -Force -ErrorAction SilentlyContinue
    }
    if ($VtonProcess -and -not $VtonProcess.HasExited) {
        Stop-Process -Id $VtonProcess.Id -Force -ErrorAction SilentlyContinue
    }
    Free-Port 8188
    Free-Port 3000
    Write-Success "All processes stopped cleanly. Goodbye!"
}
