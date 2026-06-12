# Enerji Telemetri Takip Paneli

Bu proje, orijinal Python scriptindeki (`kvamainimport.py`) gibi uzak santrallerden (K499, K500, G500, G499, M499, M500, T500) anlık kVA ve tüketim (**Del/Rec/Net**) verilerini çeken, bunları yerel diskte kaydeden ve tarayıcı üzerinden anlık olarak izlemenizi sağlayan modern bir **Full-Stack (Express Backend + React/Tailwind Frontend)** uygulamasıdır.

---

## 🚀 Yerel Bilgisayarda (Lokalde) Çalıştırma Adımları

Projeyi kendi yerel bilgisayarınızda (Windows, macOS veya Linux) çalıştırmak için aşağıdaki adımları sırayla takip edin:

### 1. Projeyi Bilgisayarınıza İndirin
Google AI Studio arayüzündeki sağ üst köşede bulunan **Settings (Ayarlar)** menüsünden projenizi **ZIP** olarak indirebilir veya **Export to GitHub** seçeneğiyle GitHub deponuza aktarıp oradan bilgisayarınıza klonlayabilirsiniz.

### 2. Gereksinimleri Yükleyin
Bilgisayarınızda **Node.js** (LTS sürümü tavsiye edilir, v18 veya daha yeni bir sürüm) kurulu olmalıdır. Node.js'in kurulu olup olmadığını kontrol etmek için terminalde (komut satırında) şu komutları çalıştırabilirsiniz:
```bash
node -v
npm -v
```

### 3. Bağımlılıkları Yükleyin
Proje klasörünün içine gidin (terminal üzerinden) ve terminalde aşağıdaki komutu çalıştırarak gerekli tüm paketleri (Express, React, TypeScript, Vite, Tailwind CSS, Recharts vb.) kurun:
```bash
npm install
```

### 4. Geliştirme Sunucusunu Başlatın (Dev Mode)
Kurulum tamamlandıktan sonra yerel test sunucusunu başlatmak için şu komutu çalıştırın:
```bash
npm run dev
```

Bu komut:
* Arka planda uzak (veya simüle) istasyonlardan veri toplayan tarayıcı (scraping) döngülerini başlatır.
* `http://localhost:3000` adresinde yerel bir web sunucusu açar.

Tarayıcınızı açıp **`http://localhost:3000`** adresine giderek panelinizi kullanmaya başlayabilirsiniz! 🎉

---

## 🛠️ Üretim (Production / Canlı) Yayını Hazırlığı
Eğer projeyi yerel bir sunucuya veya canlıya tamamen kararlı ve derlenmiş şekilde kurmak isterseniz:

1. **Derleme (Build) Adımı:**
   ```bash
   npm run build
   ```
   Bu komut frontend dosyalarını (`index.html`, Javascript, CSS vb.) sıkıştırıp `dist/` klasörüne yazar ve TypeScript tabanlı `server.ts` Express sunucusunu Node.js'in doğrudan çalıştırabileceği tek bir optimize edilmiş `dist/server.cjs` dosyasına dönüştürür.

2. **Canlıda Çalıştırma (Start) Adımı:**
   ```bash
   npm run start
   ```
   Artık uygulamanız en yüksek performans ve en güvenli modda `3000` portunda çalışacaktır.

---

## 📂 Dosya ve Klasör Yapısı Hakkında Kısa Bilgiler
* **`/data/`**: Uygulama çalışmaya başladığında bu klasör ve içinde `db.json` (SQLite yerine kullanılan ve diskte saklanan hafif NoSQL veritabanı dosyası) ve `log.txt` (orijinal Python scriptindeki log günlüğü formatıyla birebir uyumlu log dosyası) otomatik oluşturulur.
* **`server.ts`**: Express tabanlı web API'lerini barındıran sunucumuzdur.
* **`server/db.ts`**: Veritabanı okuma/yazma, başlangıç için 7 günlük gerçekçi geçmiş veri tohumlama (seeding), log yazma ve istasyon kontrol kodlarını barındırır.
* **`server/scraper.ts`**: Orijinal Python scriptinizdeki HTML parse eden regex kısımlarını, zaman aşımı korumalı `fetch` isteklerini barındıran gerçek web tarayıcısıdır.
* **`src/App.tsx`**: Recharts ile çizilen mükemmel grafiklerin, anlık log konsolunun, simülasyon ve gerçek IP seçim düğmelerinin olduğu muazzam derecede şık tek sayfalık panel arayüzüdür.
