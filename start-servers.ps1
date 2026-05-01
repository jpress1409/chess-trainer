# Script to kill existing processes on ports 3000 and 8000, then start both servers

$frontendPort = 3000
$backendPort = 8000

Write-Host "Checking for processes on ports $frontendPort and $backendPort..." -ForegroundColor Yellow

# Function to kill process on a specific port
function Kill-ProcessOnPort {
    param (
        [int]$port
    )
    
    $process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | 
                Select-Object -ExpandProperty OwningProcess -ErrorAction SilentlyContinue
    
    if ($process) {
        $processName = (Get-Process -Id $process -ErrorAction SilentlyContinue).ProcessName
        if ($processName) {
            Write-Host "Killing process $processName (PID: $process) on port $port" -ForegroundColor Red
            Stop-Process -Id $process -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 1
        }
    } else {
        Write-Host "No process found on port $port" -ForegroundColor Green
    }
}

# Kill processes on both ports
Kill-ProcessOnPort -port $frontendPort
Kill-ProcessOnPort -port $backendPort

Write-Host "Starting servers..." -ForegroundColor Yellow

# Get the script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendDir = Join-Path $scriptDir "frontend"
$backendDir = Join-Path $scriptDir "backend"

# Start backend server
Write-Host "Starting backend server on port $backendPort..." -ForegroundColor Cyan
$backendProcess = Start-Process -FilePath "python" -ArgumentList "main.py" -WorkingDirectory $backendDir -WindowStyle Normal -PassThru

# Wait a moment for backend to start
Start-Sleep -Seconds 3

# Check if backend is still running
if ($backendProcess.HasExited) {
    Write-Host "Backend failed to start. Check Python dependencies." -ForegroundColor Red
    Write-Host "Run: cd backend && pip install -r requirements.txt" -ForegroundColor Yellow
    exit 1
}

# Start frontend server
Write-Host "Starting frontend server on port $frontendPort..." -ForegroundColor Cyan
$frontendProcess = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory $frontendDir -WindowStyle Normal -PassThru

Write-Host "`nServers started successfully!" -ForegroundColor Green
Write-Host "Frontend: http://localhost:$frontendPort" -ForegroundColor White
Write-Host "Backend: http://localhost:$backendPort" -ForegroundColor White
Write-Host "`nPress Ctrl+C to stop both servers" -ForegroundColor Yellow

# Store process IDs globally for cleanup
$global:backendPid = $backendProcess.Id
$global:frontendPid = $frontendProcess.Id

# Wait for user to stop
try {
    while ($true) {
        Start-Sleep -Seconds 1
        
        # Check if backend is still running
        if ($backendProcess.HasExited) {
            Write-Host "Backend has stopped unexpectedly!" -ForegroundColor Red
            break
        }
    }
} finally {
    Write-Host "`nStopping servers..." -ForegroundColor Yellow
    
    # Kill all processes on the ports (more reliable than just PID)
    Kill-ProcessOnPort -port $frontendPort
    Kill-ProcessOnPort -port $backendPort
    
    # Also try to kill by stored PIDs as backup
    if ($global:backendPid) {
        Stop-Process -Id $global:backendPid -Force -ErrorAction SilentlyContinue
    }
    if ($global:frontendPid) {
        Stop-Process -Id $global:frontendPid -Force -ErrorAction SilentlyContinue
    }
    
    Write-Host "Servers stopped." -ForegroundColor Green
}
