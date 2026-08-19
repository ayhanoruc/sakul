# Kısayol: Şakül Not

**Ne yapar:** Konuş → yazıya çevrilir → Şakül'e not olarak kaydedilir.
**Tetikleme:** "Hey Siri, Şakül Not" · Ana Ekran ikonu · Eylem Düğmesi · Arkaya Dokunma

## Adımlar (Kısayollar uygulamasında)

Yeni Kısayol → adını **Şakül Not** yap, sonra sırasıyla şu eylemleri ekle:

1. **Metin** (Text)
   - İçerik: `ANAHTAR` (kopyaladığın `sakul_...` değeri)
   - Değişken adı: uzun bas → Yeniden Adlandır → `Anahtar`

2. **Metni Dikte Et** (Dictate Text)
   - Dil: **Türkçe**
   - Dinlemeyi durdur: **Duraklamada** (Kısa cümleler için ideal; uzun notlar için "Dokunduğumda" seç)

3. **URL** (URL)
   - `https://sakulproject.duckdns.org/api/notlar`
   > Bu ayrı adım şart: "URL İçeriğini Al" bir önceki eylemin çıktısını otomatik girdi alır.
   > URL adımı olmadan diktelenen metni URL sanır. Araya URL koyunca doğru bağlanır.

4. **URL İçeriğini Al** (Get Contents of URL)
   - Girdi: otomatik olarak üstteki **URL** olur ✓ (Diktelenen Metin görünüyorsa: mavi değişkene dokun → Temizle)
   - Yöntem: **POST**
   - Başlıklar (Headers):
     - `Authorization` : `Bearer ` + `Anahtar` değişkeni  ("Bearer" + boşluk + değişken)
   - İstek Gövdesi: **JSON**
     - `icerik` (Metin) : değer alanına dokun → **Değişken Seç** → **Diktelenen Metin**
     - `kaynak` (Metin) : `shortcut`

5. **Bildirim Göster** (Show Notification) — isteğe bağlı
   - "Not kaydedildi ✓"

## Tetikleyiciler

**Ana Ekran ikonu (önerilen günlük yol):** Kısayollar uygulaması → kısayola uzun bas →
**Ayrıntılar → Ana Ekrana Ekle**. Tek dokunuş → dikte başlar. Siri gerekmez.
Aynı menüden Eylem Düğmesi (15 Pro+) ve Kilit Ekranı'na da eklenebilir.

**Siri:** Ayarlar → Siri → "Hey Siri"yi Dinle açık ve **Siri dili Türkçe** olmalı.
Tetik cümlesi = kısayolun adı. Siri "Şakül" kelimesini tanımıyorsa (uydurma kelimeleri
yanlış duyar) kısayolu Siri'nin güvenilir duyduğu bir ada **yeniden adlandır** —
örn. **"Şantiye Notu"** → "Hey Siri, Şantiye Notu". Ne duyduğunu test etmek için
herhangi bir metin alanında mikrofonla aynı kelimeyi söyle.
