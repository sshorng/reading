# 自動部署至 GitHub 腳本 (PowerShell 版)

Write-Host "🚀 開始自動部署程序..." -ForegroundColor Cyan

# 1. 檢查是否有變更
$status = git status --porcelain
if (-not $status) {
    Write-Host "✨ 目前沒有需要更新的內容。" -ForegroundColor Green
    exit
}

# 2. 加入所有變更
Write-Host "📦 正在封裝變更..." -ForegroundColor Yellow
git add .

# 3. 建立版本紀錄 (以目前時間作為訊息)
$date = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$message = "自動部署: $date"
Write-Host "📝 建立版本紀錄: $message" -ForegroundColor Yellow
git commit -m $message

# 4. 推送到 GitHub
Write-Host "☁️ 正在同步到 GitHub..." -ForegroundColor Yellow
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "🎉 部署成功！" -ForegroundColor Green
} else {
    Write-Host "❌ 部署失敗，請檢查網路連線或授權權限。" -ForegroundColor Red
}

Write-Host "`n按任意鍵繼續..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
