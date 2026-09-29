# Script chay Expo Tunnel cho AIoT Nong Nghiep
Write-Host "================================================================" -ForegroundColor Green
Write-Host "  DANG KHOI CHAY EXPO TUNNEL CHO AIoT NONG NGHIEP (SDK 57)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Green
Write-Host ""

$env:EXPO_TOKEN = "DVmH1hTv_U2pWrJ3LL1nQ_GG6Za9vbImmHxqubsU"
Write-Host "[OK] Da thiet lap EXPO_TOKEN thanh cong." -ForegroundColor Yellow
Write-Host "[...] Dang khoi dong che do Tunnel qua Cloudflare/Ngrok..." -ForegroundColor White
Write-Host ""

npx expo start --tunnel
