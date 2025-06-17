import subprocess, sys
subprocess.run([
    r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe",
    "-NoProfile", "-ExecutionPolicy", "Bypass",
    "-File", "run_backend.ps1"
], check=False)
