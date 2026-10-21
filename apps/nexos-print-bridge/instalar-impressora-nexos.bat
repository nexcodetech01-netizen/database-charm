@echo off
setlocal
title Instalar impressora NexOS
echo.
echo  ===== Instalar impressora NexOS =====
echo  Faz o Print Bridge ligar sozinho, escondido, sempre que o computador ligar.
echo.

rem Pasta do Print Bridge: a deste arquivo (se estiver dentro dela) ou a padrao.
set "BRIDGE=%USERPROFILE%\OneDrive\Desktop\NexOS\Projeto NexOS\apps\nexos-print-bridge"
if exist "%~dp0package.json" set "BRIDGE=%~dp0"
if "%BRIDGE:~-1%"=="\" set "BRIDGE=%BRIDGE:~0,-1%"

if not exist "%BRIDGE%\package.json" (
  echo  [ERRO] Nao achei a pasta do Print Bridge em:
  echo         %BRIDGE%
  echo  Coloque este arquivo DENTRO da pasta nexos-print-bridge e rode de novo.
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo  [ERRO] O Node.js nao esta instalado neste computador.
  echo.
  pause
  exit /b 1
)

set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "VBS=%STARTUP%\nexos-print-bridge.vbs"
set "LOG=%TEMP%\nexos-print-bridge.log"

rem Remove a versao antiga (que abria a janela preta).
if exist "%STARTUP%\nexos-bridge.bat" del "%STARTUP%\nexos-bridge.bat"

> "%VBS%" echo Set sh = CreateObject("WScript.Shell")
>> "%VBS%" echo sh.CurrentDirectory = "%BRIDGE%"
>> "%VBS%" echo sh.Run "cmd /c npm run dev > ""%LOG%"" 2>&1", 0, False

echo  OK - o Print Bridge vai ligar sozinho quando o computador ligar.
echo.
echo  Ligando agora...
wscript "%VBS%"
timeout /t 10 /nobreak >nul

curl -s -m 5 http://127.0.0.1:48555/health >nul 2>nul
if errorlevel 1 (
  echo  Ainda nao respondeu. Espere 1 minuto e teste abrindo no navegador:
  echo     http://127.0.0.1:48555/health
  echo  Se nao abrir, o registro do que aconteceu esta em:
  echo     %LOG%
) else (
  echo  PRONTO! O Print Bridge esta ligado. Pode imprimir pelo NexOS.
)
echo.
pause
