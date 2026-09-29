# Script chay Expo Tunnel cho AIoT Nong Nghiep
Write-Host "================================================================" -ForegroundColor Green
Write-Host "  DANG KHOI CHAY EXPO TUNNEL CHO AIoT NONG NGHIEP (SDK 57)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Green
Write-Host ""

# Doc EXPO_TOKEN tu file .env
if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        $line = $_.Trim()
        if ($line -match "^EXPO_TOKEN=(.+)$") {
            $env:EXPO_TOKEN = $matches[1].Trim()
        }
    }
}

if ([string]::IsNullOrWhiteSpace($env:EXPO_TOKEN)) {
    Write-Host "[Luu y] Chua tim thay bien EXPO_TOKEN trong file .env!" -ForegroundColor Yellow
    Write-Host "Neu gap loi, hay lay token tai https://expo.dev/settings/access-tokens va them vao .env" -ForegroundColor Gray
} else {
    Write-Host "[OK] Da nap EXPO_TOKEN an toan tu file .env thanh cong." -ForegroundColor Green
}

Write-Host "[...] Dang khoi dong che do Tunnel qua Cloudflare/Ngrok..." -ForegroundColor White
Write-Host ""

npx expo start --tunnel
