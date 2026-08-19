# Şakül iOS Kısayolları

Bu klasördeki tarifler bir iPhone'da **Kısayollar (Shortcuts)** uygulamasında bir kez elle
kurulur, sonra **iCloud linki** olarak paylaşılır ve `/kurulum` sayfasındaki
`SHORTCUT_LINKS` dizisine yapıştırılır ([web/src/pages/Setup.tsx](../web/src/pages/Setup.tsx)).

## Ortak hazırlık (bir kez)

1. Uygulamada **⚙️ Kurulum → 3. Kısayol anahtarı** bölümünden anahtar oluştur, kopyala.
   Format: `sakul_...` — yalnızca bir kez gösterilir.
2. Aşağıdaki tarifleri kur. Her tarifte `ANAHTAR` yazan yere bu değer gelir.

> **Import Questions ile paylaşma:** Kısayolu iCloud linki olarak paylaşmadan önce,
> kısayol düzenleyicisinde **⋯ → Bilgi (ⓘ) → İçe Aktarma Soruları**'na `ANAHTAR`ı içeren
> Metin adımını ekle, soru olarak "Şakül cihaz anahtarını yapıştır" yaz. Böylece linki
> ekleyen kişiye kurulum sırasında anahtar sorulur — linkin içinde anahtar taşınmaz.

## Paylaşım

Kısayol hazır olunca: kısayola uzun bas → **Paylaş → iCloud Linkini Kopyala** →
linki `Setup.tsx` içindeki ilgili `url` alanına yapıştır → deploy et.

## Test

- "Hey Siri, Şakül Not" de; Türkçe bir cümle söyle; uygulamada Notlar sekmesinde görünmeli
  (kaynağı 🎙️ olarak işaretlenir).
- Şantiye jargonuyla dene: "kalıp söküm", "hakediş", "temel üstü vizesi" — dikte kalitesini gör.

## Sınırlar (bilinçli tercihler)

- Kısayollar **incecik**: dikte → tek HTTP POST. Mantık sunucuda yaşar; `git push` ile güncellenir,
  kısayolu yeniden kurmak gerekmez. Kısayolun yapısı değişirse yeni iCloud linki gerekir.
- Anahtarın yetkisi dar: yalnızca not ve hatırlatıcı **ekleyebilir**; hiçbir şey okuyamaz.
  Telefon kaybolursa ⚙️ Kurulum'dan tek dokunuşla iptal edilir.
