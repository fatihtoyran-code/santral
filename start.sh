#!/bin/bash

# Clear screen and output dynamic greetings
clear
echo "======================================================="
echo "         ENERJİ TELEMETRİ TAKİP PANELİ"
echo "======================================================="
echo ""
echo "Proje yerel bilgisayarda başlatılıyor..."
echo ""

# 1. Node.js Check
if ! command -v node &> /dev/null; then
    echo "[HATA] Sisteminizde Node.js kurulu değil!"
    echo "Lütfen https://nodejs.org adresinden Node.js (v18+) indirip kurun."
    echo ""
    read -p "Çıkmak için Enter'a basın..."
    exit 1
fi

# 2. Install dependencies if node_modules is missing
if [ ! -d "node_modules" ]; then
    echo "[BİLGİ] Gerekli eklentiler (node_modules) eksik görünüyor."
    echo "Paketler internetten kuruluyor. Bu işlem kısa bir süre sürebilir..."
    echo ""
    npm install
    if [ $? -ne 0 ]; then
        echo ""
        echo "[HATA] Paket yükleme sırasında bir hata oluştu!"
        read -p "Çıkmak için Enter'a basın..."
        exit 1
    fi
    echo "[BAŞARILI] Tüm bağımlılıklar başarıyla yüklendi!"
    echo ""
fi

# 3. Run Development Server
echo ""
echo "======================================================="
echo "[BAŞARILI] Sistem Hazır!"
echo ""
echo "Lütfen tarayıcınızda şu adresi açın:"
echo "========> http://localhost:3000 <========"
echo ""
echo "Paneli kapatmak için terminalde Ctrl+C yapabilir veya pencereyi kapatabilirsiniz."
echo "======================================================="
echo ""

npm run dev
