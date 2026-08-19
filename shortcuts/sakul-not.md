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

3. **URL İçeriğini Al** (Get Contents of URL)
   - URL: `https://sakulproject.duckdns.org/api/notlar`
   - Yöntem: **POST**
   - Başlıklar (Headers):
     - `Authorization` : `Bearer ` + `Anahtar` değişkeni  ("Bearer" + boşluk + değişken)
   - İstek Gövdesi: **JSON**
     - `icerik` (Metin) : **Diktelenen Metin** değişkeni
     - `kaynak` (Metin) : `shortcut`

4. **Bildirim Göster** (Show Notification) — isteğe bağlı
   - "Not kaydedildi ✓"

## Siri ile tam eller serbest

Ayarlar → Siri → "Hey Siri"yi aç. Arabada: "Hey Siri, Şakül Not" → sinyal sesinden sonra konuş.
