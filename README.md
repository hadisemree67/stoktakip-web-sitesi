# Stok Takip & Satış Yönetimi Uygulaması

Bu proje, React ve Supabase (PostgreSQL) kullanılarak geliştirilmiş, çoklu para birimi destekli ve stok takipli bir satış yönetim sistemidir.

## 🚀 Kurulum Rehberi (Mac / Windows / Linux)

Projeyi başka bir bilgisayara (örneğin Mac) kurmak için aşağıdaki adımları izleyin.

### 1. Gereksinimler
Bilgisayarınızda **Node.js** yüklü olmalıdır.
- **Mac için**: [nodejs.org](https://nodejs.org/) adresinden "LTS" sürümünü indirip kurun.

### 2. Projeyi İndirme (Clone)
Terminali açın ve projeyi indirmek istediğiniz klasöre gidip şu komutu yazın:

```bash
git clone https://github.com/hadisemree67/stoktakip-web-sitesi.git
cd stoktakip-web-sitesi
```

### 3. Bağımlılıkları Yükleme
Proje klasörünün içindeyken şu komutu çalıştırın:

```bash
npm install
```

### 4. Çevre Değişkenlerini (Environment Variables) Ayarlama
Bu adım **ÇOK ÖNEMLİDİR**. Veritabanı bağlantı şifreleri GitHub'a güvenlik nedeniyle yüklenmez. Bu yüzden `env` dosyasını manuel oluşturmalısınız.

1.  Proje ana dizininde `.env` adında yeni bir dosya oluşturun.
2.  İçine şu bilgileri yapıştırın (Bu dosyayı kimseyle paylaşmayın):

```env
VITE_SUPABASE_URL=https://lxytuzqfefmmkgxpfyff.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4eXR1enFmZWZtbWtneHBmeWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1NTA3MDQsImV4cCI6MjA4NDEyNjcwNH0.XhB4dNacE1RN2iqSPZXH4usOdg0F0RzMBRBkMUfHEL0
```

*Not: Veritabanınız bulutta (Supabase) olduğu için Mac'inize ayrıca bir veritabanı kurmanıza gerek yoktur. İnternet bağlantınızın olması yeterlidir.*

### 5. Uygulamayı Çalıştırma
Her şey hazır! Uygulamayı başlatmak için:

```bash
npm run dev
```

Terminalde çıkan yerel linke (örn: `http://localhost:5173`) tıklayarak uygulamayı kullanabilirsiniz.

## 🛠 Kullanılan Teknolojiler
- **Frontend**: React, Vite, Tailwind CSS
- **Backend / DB**: Supabase, PostgreSQL
- **Özellikler**:
    - Stok Takibi & Kritik Stok Uyarısı
    - Satış & Faturalandırma (Yazdırma Desteği)
    - Çoklu Para Birimi (Dolar/Euro Gösterimi)
    - Cari Hesap / Müşteri Takibi

## ⚠️ Önemli Notlar
- Veritabanı şeması `migrations` klasöründe yer almaktadır.
- Yeni bir bilgisayara geçtiğinizde verileriniz kaybolmaz, çünkü veriler buluttadır.
