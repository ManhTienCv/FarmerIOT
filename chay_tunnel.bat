@echo off
title AIoT Nong Nghiep - Expo Tunnel Launcher
echo ================================================================
echo   DANG KHOI CHAY EXPO TUNNEL CHO AIoT NONG NGHIEP (SDK 57)
echo ================================================================
echo.

rem Doc EXPO_TOKEN tu file .env neu co
if exist .env (
    for /f "usebackq tokens=1,2 delims==" %%a in (".env") do (
        if "%%a"=="EXPO_TOKEN" (
            set "EXPO_TOKEN=%%b"
        )
    )
)

if "%EXPO_TOKEN%"=="" (
    echo [Luu y] Chua tim thay bien EXPO_TOKEN trong file .env!
    echo Neu gap loi yeu cau dang nhap, hay lay token tai: https://expo.dev/settings/access-tokens
    echo va them vao file .env theo cu phap: EXPO_TOKEN=your_token_here
    echo.
) else (
    echo [OK] Da nap EXPO_TOKEN an toan tu file .env!
)

echo Dang mo duong ham Tunnel (ho tro ca 5G, 4G, Hotspot va Wi-Fi)...
echo.
npx expo start --tunnel

pause
