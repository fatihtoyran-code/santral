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

:: 4. Port Check and Release
set PORT=3000
netstat -ano | findstr LISTENING | findstr :%PORT% >nul 2>&1
if %errorlevel% neq 0 goto :PORT_OK

echo =======================================================
echo [UYARI] %PORT% portu şu anda sisteminizde kullanılmaktadır!
echo Büyük ihtimalle eski bir oturum arka planda açık kalmıştır.
echo =======================================================
echo.
echo Ne yapmak istersiniz?
echo [1] Portu kullanan eski programı kapat (ÖNERİLEN)
echo [2] Sistemi farklı bir porttan (3001) çalıştır
echo [3] Çıkış yap
echo.
set /p secim="Seçiminizi yazın ve Enter'a basın (1, 2 veya 3): "

if "%secim%"=="1" goto :KILL_PORT
if "%secim%"=="2" goto :USE_PORT_3001
goto :CANCEL_EXIT

:KILL_PORT
echo.
echo [BİLGİ] %PORT% portunu kullanan program kapatılıyor...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr LISTENING ^| findstr :%PORT%') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo [BAŞARILI] Port temizlendi! Kod çalıştırılmaya devam ediliyor...
echo.
timeout /t 2 >nul
goto :PORT_OK

:USE_PORT_3001
set PORT=3001
echo.
echo [BİLGİ] Port %PORT% olarak değiştirildi!
echo.
timeout /t 2 >nul
goto :PORT_OK

:CANCEL_EXIT
echo.
echo [BİLGİ] İşlem iptal edildi. Pencereyi kapatmak için bir tuşa basın.
pause
exit /b 0

:PORT_OK

:: 5. Run Production Server
cls
echo =======================================================
echo [BAŞARILI] Sistem Canlı Yayın Modunda Başlatıldı!
echo =======================================================
echo.
echo Yerel Ağ (LAN) Giriş Adresi:
echo http://localhost:%PORT%
echo.
echo Statik IP Yayın Adresiniz:
echo http://[STATIK_IP_ADRESINIZ] (Modem port yönlendirme sonrası)
echo.
echo NOT: Bu pencereyi kapatırsanız sistem durur. Arka planda çalışmalıdır.
echo =======================================================
echo.

:: Set environment to production and start
set NODE_ENV=production
set PORT=%PORT%
call npm run start
pause

