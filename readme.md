# 🎓 AI Destekli Öğrenci Harç Yönetim Sistemi

Bu proje, üniversite öğrencilerinin harç borçlarını doğal dil işleme (NLP) kullanarak sorgulayabildikleri ve güvenli bir şekilde ödeme yapabildikleri yapay zeka tabanlı bir asistan uygulamasıdır. Kullanıcıların karmaşık menülerle uğraşmak yerine, asistanla mesajlaşarak finansal işlemlerini gerçekleştirmesini sağlar.

## 🚀 Proje Özellikleri

- **Niyet Analizi (Intent Classification):** OpenAI GPT-3.5 Turbo modeli kullanılarak kullanıcının mesajından borç sorgulama, ödeme yapma veya selamlaşma niyetleri otomatik olarak tespit edilir.
- **Gerçek Zamanlı Veri Akışı (Realtime):** Supabase Realtime altyapısı sayesinde mesajlar ve bakiye güncellemeleri sayfayı yenilemeden anlık olarak kullanıcı arayüzüne yansır.
- **Dinamik Borç Yönetimi:** Sistem, öğrencinin borçlarını dönem bazlı (Güz/Bahar) takip eder ve ödeme yapıldığında bakiyeyi otomatik olarak günceller.
- **Merkezi API Yönetimi:** Tüm bankacılık işlemleri Render üzerinde yayınlanan canlı bir API servisi ile senkronize çalışır.

## 🛠️ Kullanılan Teknolojiler

- **Frontend:** React.js, Vite, Tailwind CSS
- **Backend:** Node.js, Express
- **Yapay Zeka:** OpenAI API (GPT-3.5)
- **Veritabanı & BaaS:** Supabase (PostgreSQL)
- **Canlı Yayın (Deployment):** Render

## 📋 Veritabanı Şeması

Sistem üç ana tablo üzerine kuruludur:
- `Student`: Öğrenci bilgileri ve öğrenci numaraları.
- `Tuition`: Dönemlik harç miktarları, kalan bakiyeler ve ödeme durumları.
- `Payment`: Gerçekleşen ödeme işlemlerinin kayıtları.
- `messages`: Asistan ile kullanıcı arasındaki mesajlaşma geçmişi.

## 🛠️ Teknik Detaylar (Hoca Bilgi Notu)

### AI Karar Mekanizması
OpenAI GPT-3.5 modeli, her mesajı analiz ederek 4 farklı niyetten (GREETING, QUERY_DEBT, PAY_DEBT, UNKNOWN) birine karar verir. Bu süreçte prompt engineering kullanılarak deterministik JSON çıktıları alınmıştır.

### Backend ve API İletişimi
Node.js üzerinde koşan servis, Render.com üzerindeki harç API'si ile Axios kütüphanesi üzerinden haberleşir. Ödeme işlemleri POST, sorgulama işlemleri GET istekleri ile yönetilmektedir.

### Veri Güvenliği
Proje genelinde API anahtarları .env dosyalarında saklanmış ve GitHub üzerinde ifşa edilmemesi için .gitignore yapılandırılması kullanılmıştır.


VİDEO LİNKİ = https://drive.google.com/file/d/1aEp4krsbj8PbZMyUiw2F8PAgZVhj6WJH/view?usp=sharing