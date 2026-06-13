@echo off
:: Set UTF-8 encoding so Turkish characters show up correctly in Windows CMD
chcp 65001 >nul
title Enerji Telemetri Takip Paneli - Canlı Yayın Başlatıcı (PROD)

echo =======================================================
echo     ENERJİ TELEMETRİ TAKİP PANELİ - ÜRETİM/CANLI MODU
echo =======================================================
echo.
echo Proje canlı (production) mod için hazırlanıyor...
echo.

:: 1. Node.js Check
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [HATA] Sisteminizde Node.js kurulu değil!
    echo Lütfen https://nodejs.org adresinden Node.js (v18+) indirip kurun.
    echo.
    pause
    exit /b 1
)

:: 2. Install dependencies if node_modules is missing
if not exist node_modules (
    echo [BİLGİ] Gerekli eklentiler (node_modules^) eksik. İndiriliyor...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo [HATA] Paket yükleme hatası!
        pause
        exit /b 1
    )
)

:: 3. Build the project
echo [BİLGİ] Kodlar optimize ediliyor ve canlı sürüm derleniyor (Build)...
echo.
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [HATA] Derleme (Build) sırasında bir hata oluştu!
    pause
    exit /b 1
)

:: 4. Run Production Server
cls
echo =======================================================
echo [BAŞARILI] Sistem Canlı Yayın Modunda Başlatıldı!
echo =======================================================
echo.
echo Yerel Ağ (LAN) Giriş Adresi:
echo http://localhost:3000
echo.
echo Statik IP Yayın Adresiniz:
echo http://[STATIK_IP_ADRESINIZ] (Modem port yönlendirme sonrası)
echo.
echo NOT: Bu pencereyi kapatırsanız sistem durur. Arka planda çalışmalıdır.
echo =======================================================
echo.

:: Set environment to production and start
set NODE_ENV=production
call npm run start
pause
