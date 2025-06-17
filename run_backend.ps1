# run_backend.ps1

# 1) Change into your backend directory
Push-Location "$PSScriptRoot\backend"

# 2) Trap *any* terminating error (including Ctrl+C) and run cleanup
trap {
    Write-Host 'Interrupt received—cleaning up Python processes...'
    taskkill /F /IM python.exe | Out-Null
    exit
}

# 3) Launch uvicorn (blocks here until you hit Ctrl+C or it exits)
& uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# 4) Once uvicorn quits normally, do final cleanup
Write-Host 'Uvicorn exited—cleaning up Python processes...'
taskkill /F /IM python.exe | Out-Null

# 5) Return to original directory
Pop-Location
