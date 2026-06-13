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

:: 3. Port Check and Release
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

:: 4. Run Development Server
echo.
echo =======================================================
echo [BAŞARILI] Sistem Hazır!
echo.
echo Lütfen tarayıcınızda şu adresi açın:
echo ========> http://localhost:%PORT% <========
echo.
echo Paneli kapatmak için bu konsol penceresini kapatabilirsiniz.
echo =======================================================
echo.

set PORT=%PORT%
call npm run dev
pause

