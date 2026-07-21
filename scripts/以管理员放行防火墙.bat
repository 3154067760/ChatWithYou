@echo off
:: 右键「以管理员身份运行」此文件，放行 3010/5173 供手机访问
powershell -ExecutionPolicy Bypass -File "%~dp0allow-lan-firewall.ps1"
pause
