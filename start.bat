@echo off
:: Set UTF-8 encoding so Turkish characters show up correctly in Windows CMD
chcp 65001 >nul
title Enerji Telemetri Takip Paneli - Başlatıcı

echo =======================================================
echo          ENERJİ TELEMETRİ TAKİP PANELİ
echo =======================================================
echo.
echo Proje yerel bilgisayarda başlatılıyor...
echo.

:: 1. Node.js Check
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [HATA] Sisteminizde Node.js kurulu değil!
    echo Lütfen https://nodejs.org adresinden Node.js (v18+) indirip kurun.
    echo Kurulum bittikten sonra bu başlatıcıyı tekrar çalıştırın.
    echo.
    pause
    exit /b 1
)

:: 2. Install dependencies if node_modules is missing
if not exist node_modules (
    echo [BİLGİ] Gerekli eklentiler (node_modules^) eksik görünüyor.
    echo Paketler internetten indiriliyor. Bu işlem kısa bir süre sürebilir...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo [HATA] Paket yükleme sırasında bir hata oluştu!
        pause
        exit /b 1
    )
    echo [BAŞARILI] Tüm bağımlılıklar başarıyla yüklendi!
    echo.
)

:: 3. Run Development Server
echo.
echo =======================================================
echo [BAŞARILI] Sistem Hazır!
echo.
echo Lütfen tarayıcınızda şu adresi açın:
echo ========> http://localhost:3000 <========
echo.
echo Paneli kapatmak için bu konsol penceresini kapatabilirsiniz.
echo =======================================================
echo.

call npm run dev
pause
