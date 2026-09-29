@echo off
title AIoT Nong Nghiep - Expo Tunnel Launcher
echo ================================================================
echo   DANG KHOI CHAY EXPO TUNNEL CHO AIoT NONG NGHIEP (SDK 57)
echo ================================================================
echo.
echo [1/2] Dang thiet lap EXPO_TOKEN...
set EXPO_TOKEN=DVmH1hTv_U2pWrJ3LL1nQ_GG6Za9vbImmHxqubsU

echo [2/2] Dang mo duong ham Tunnel (ho tro ca 5G, 4G, Hotspot va Wi-Fi)...
echo.
npx expo start --tunnel

pause
