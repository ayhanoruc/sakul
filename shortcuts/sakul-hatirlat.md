# Kısayol: Şakül Hatırlat

**Ne yapar:** Konuş → tarih/saat seç → hatırlatıcı kurulur; zamanı gelince push bildirimi gelir.

## Adımlar

Yeni Kısayol → adı **Şakül Hatırlat**:

1. **Metin** — `ANAHTAR`, değişken adı `Anahtar` (bkz. sakul-not.md)

2. **Metni Dikte Et** — Dil: Türkçe
   (Ne hatırlatılacağını söyle: "çekin fotokopisini muhasebeciye götür")

3. **Tarih Sor** (Ask for Input → Tarih ve Saat türü)
   - Soru: "Ne zaman hatırlatayım?"

4. **Tarihi Biçimlendir** (Format Date)
   - Tarih: bir önceki adımın çıktısı
   - Biçim: **Özel** → `yyyy-MM-dd'T'HH:mm:ssZZZZZ`
   (ISO 8601 üretir; API bunu bekler)

5. **URL İçeriğini Al** (Get Contents of URL)
   - URL: `https://sakulproject.duckdns.org/api/hatirlaticilar`
   - Yöntem: **POST**
   - Başlıklar: `Authorization` : `Bearer ` + `Anahtar`
   - İstek Gövdesi: **JSON**
     - `tur` (Metin) : `sabit`
     - `baslik` (Metin) : **Diktelenen Metin**
     - `hatirlatmaZamani` (Metin) : **Biçimlendirilmiş Tarih**

6. **Bildirim Göster** — "Hatırlatıcı kuruldu ⏰" (isteğe bağlı)
