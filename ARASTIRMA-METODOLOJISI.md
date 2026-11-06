# Araştırma Metodolojisi — Nasıl İnceliyorum, Nelere Dikkat Ediyorum

> Bu belge, Hayalhâne projesinde yaptığım araştırma/inceleme sürecinin açık dökümüdür.
> Amaç: aynı yaklaşımı **Ulak** projesinde de uygulayabilmen. Belge bir "kişilik" tarifi değil,
> **tekrarlanabilir bir kontrol listesi**dir. Her bölümün sonunda "Ulak'ta nasıl uygularsın" notu var.

---

## 0. Temel ilke: önce kanıt, sonra cümle

Bir şeyi "yaptım" demeden önce **çalıştığını gördüğüm bir çıktı** olmalı. Sıralama hep şu:

```
oku → hipotez kur → en küçük komutla doğrula → sonucu oku → gerekirse hipotezi değiştir → tekrar doğrula
```

Yasak: "muhtemelen çalışır", "eklendi, olmuştur", "test edilmesine gerek yok".
Her iddianın yanında bir kanıt satırı olmalı: HTTP kodu, dosya boyutu, test çıktısı, `git log` satırı.

**Ulak'ta:** Her değişiklikten sonra en az bir doğrulama komutu çalıştır. "Derleme geçti" yeterli değilse, uygulamayı ayağa kaldırıp gerçek istek at.

---

## 1. Önce haritayı çıkar, sonra dosyaya gir

Kod okumaya rastgele dalmam. Sıra:

1. **Kök dizin listesi** — hangi klasör ne işe yarıyor?
2. **`package.json` / manifest** — bağımlılıklar, script'ler, `engines`, sürüm.
3. **Giriş noktası** — `server.js`, `main.py`, `index.ts`… akışın başladığı yer.
4. **Yapılandırma** — `.gitignore`, `.gitattributes`, `.nvmrc`, CI dosyaları.
5. **README** — iddia edilen ile gerçek uyuşuyor mu?

Bunu yapmadan dosya okumaya başlarsam, 3.000 satırlık `app.js` içinde kaybolurum.

**Ulak'ta:** Önce `tree`/`Get-ChildItem` ile yapıyı çıkar, sonra manifest'i oku, sonra giriş noktasından içeri gir.

---

## 2. Arama sırası: pahalıdan ucuza

| Sıra | Araç | Ne zaman |
|---|---|---|
| 1 | **Sembol/Anlamsal arama** | "Bu fonksiyon nerede tanımlı, kim çağırıyor?" |
| 2 | **LSP / usages** | Bir sembolün tüm referansları |
| 3 | **Glob** (`**/*.ts`) | Dosya adıyla daraltma |
| 4 | **Grep** (ripgrep) | Metin deseni, son çare olarak dosya filtresiyle |

Grep'i ilk tercih olarak kullanmam — çok gürültü üretir. Grep kullanacaksam **mutlaka** dosya glob'u ile daraltırım: `pattern: "renderNotes", glob: "**/*.js"`.

**Ulak'ta:** "Bu endpoint nerede?" diye sorarken önce sembol araması, bulamazsan `grep -n "app.get('/api" --glob "*.js"`.

---

## 3. Büyük dosyalar: asla tamamını okuma

20 KB üzeri dosyada:

1. `grep -n` ile **satır numarasını** bul.
2. `view` ile **sadece o aralığı** oku (`view_range: [120, 180]`).
3. Değiştireceksen `edit` ile **tam eşleşen** metni değiştir — dosyayı yeniden yazma.

Bu projede `public/app.js` 101 KB / ~2.900 satır. Tamamını okumak context'i bitirir; aralık okumak bitirmez.

**Ulak'ta:** `app.js` benzeri büyük dosyalarda aynı yöntem. `create` ile üzerine yazmak = veri kaybı riski.

---

## 4. Değişiklikten önce: geri dönüş yolu var mı?

Her yıkıcı işlemden önce **yedek**:

```powershell
Copy-Item data\project.json data\project.pretest.json
```

Bu projede bir kez bu kuralı atladım ve kullanıcının 144 sahnelik hikâyesi test script'i tarafından silindi — **geri dönüşü yoktu**. O günden sonra kural katı: UI testi çalıştıracaksam önce kopya.

Ayrıca:
- `git` varsa `git stash` / yeni dal.
- Veritabanı varsa `pg_dump` / `.backup`.
- Sunucu ayaktaysa önce durdur, dosyayı öyle değiştir.

**Ulak'ta:** Test/otomasyon çalıştırmadan önce veri klasörünü kopyala. Otomatik testlerin "temizleme" adımı olsa bile kopya al — temizleme kodu hatalı olabilir.

---

## 5. Doğrulama katmanları (ucuzdan pahalıya)

Bir değişikliği şu sırayla doğrularım, gerektiği kadar ilerlerim:

| Katman | Komut | Ne yakalar |
|---|---|---|
| 1. Sözdizimi | `node --check dosya.js` | Yazım hataları, eksik parantez |
| 2. Bağımlılık | `npm ci` / `npm ls` | Sürüm çakışması, eksik paket |
| 3. Sunucu açılışı | `Invoke-WebRequest http://127.0.0.1:PORT` | Route/port/başlatma hatası |
| 4. API sözleşmesi | `curl`/`Invoke-RestMethod` ile gerçek istek | JSON şeması, durum kodu |
| 5. Arayüz | Puppeteer/Playwright headless | DOM, tıklama, konsol hatası |
| 6. Kalıcılık | Yenile → veri geri geldi mi? | Kaydetme hatası |
| 7. Regresyon | Mevcut testler / CI | Yan etki |

**Kritik:** Katman 5'te **konsol hatalarını topla**. Sessiz `console.error` en sinsi hata kaynağıdır. Puppeteer'da:

```js
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
```

Test sonunda `errors.length === 0` değilse **geçti saymam**.

**Ulak'ta:** Aynı 7 katman. Özellikle 6. katmanı atlama — "kaydettim" demek "kaydedildi" demek değil.

---

## 6. Test yazarken uyduğum kurallar

1. **Tek dosya, tek amaç.** `tmp-t7.js` notları test eder, `tmp-t8.js` kalıcılığı. Karıştırmam.
2. **Test kendi verisini kurar ve kendi temizler.** Sonunda `state.notes = []`, taslak boşalt.
3. **Test gerçek sunucuya gider**, mock'a değil. `http://127.0.0.1:4173`.
4. **Beklenen değeri yazdır**, sadece "ok" deme: `toplu silme: 25 -> 23 (beklenen 23)`.
5. **Test bitince dosyayı sil.** `tmp-*` kalırsa depoya sızar.
6. **Test verisini asla gerçek veriyle karıştırma.** Ayrı isim kullan: `FLUSH-TEST-12345`, `Test Ailesi`.

**Ulak'ta:** `tmp-` öneki + sonunda silme + kendi temizliğini yapan test. CI'da çalışacak testler ayrı klasörde (`tests/`), geçici olanlar kökte `tmp-`.

---

## 7. Sürüm/uyumluluk incelemesi

Bir paketin sürümünü kontrol ederken sadece `npm outdated`'a bakmam:

1. **`engines` alanını oku** — paket hangi Node sürümlerini destekliyor?
2. **Kendi `engines`'imle karşılaştır** — kesişim boşsa sorun var.
3. **Gerçekten kurulu sürümü oku** — `package.json`'daki `^` ile `node_modules`'daki farklı olabilir.
4. **Kırıcı değişiklik var mı** — major sürüm atlaması varsa changelog oku.

Bu projede bulgu: `pdf-parse@2.4.5` → `engines: ">=20.16.0 <21 || >=22.3.0"`. Yani **Node 21 desteklenmiyor**. Bu yüzden projenin `engines` alanı da aynı aralığa çekildi ve README'ye tablo eklendi.

**Dikkat:** `require('paket/package.json')` çoğu modern pakette `ERR_PACKAGE_PATH_NOT_EXPORTED` verir. Doğru yol:

```js
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('node_modules/paket/package.json', 'utf8'));
```

**Ulak'ta:** Aynı 4 adım. Özellikle `engines` kesişimini kontrol et — "bende çalışıyor" tuzağının bir numaralı sebebi bu.

---

## 8. Gizlilik / veri sızıntısı denetimi

Kullanıcı verisi içeren projelerde **her zaman** şu üç soruyu sorarım:

1. **Hangi dosyalar kişisel veri içeriyor?** (`data/`, `*.db`, `uploads/`, `.env`)
2. **Bunlar `.gitignore`'da mı?** — `git check-ignore -v <yol>` ile **kanıtla**.
3. **Geçmişe sızmış mı?** — `git log --all --name-only | grep "^data/"` ile **tüm geçmişi** tara.

Sadece `.gitignore`'a yazmak yetmez, çünkü:
- Biri `git add -f` ile zorlayabilir.
- `.gitignore` sonradan eklenmişse eski commit'lerde dosya duruyor olabilir.
- `git rm --cached` yapılmadıysa dosya takip edilmeye devam eder.

Bu yüzden **üç katmanlı** koruma kurdum:

| Katman | Ne yapar | Nasıl doğrularım |
|---|---|---|
| `.gitignore` | Normalde engeller | `git check-ignore -v data/project.json` |
| `pre-commit` hook | `-f` ile zorlanırsa da engeller | `git add -f` + `commit` → çıkış kodu 1 |
| Uzak depo denetimi | Gerçekten gitmediğini kanıtlar | `git ls-tree -r --name-only origin/main \| grep "^data/"` |

**Ulak'ta:** Aynı üç katman. Özellikle 3.'yü atlama — "ignore'da var" ≠ "gitmedi".

---

## 9. Dış ağ / gizlilik sınırı

Kullanıcı "gizli projeden dışarı bilgi gitmesin" dediğinde yaptığım:

1. **Tüm `fetch`/`axios`/`http.request` çağrılarını bul** — `grep -rn "fetch(\|axios\|https\?\.request" --glob "*.js"`.
2. **Her birinin hedefini yaz** — hangi domain?
3. **Hangileri kullanıcı verisi gönderiyor?** — gövdeye bak.
4. **Hangileri opsiyonel?** — env değişkeniyle kapatılabiliyor mu?
5. **Rapor et**, sonra kullanıcıya sor: kapatayım mı?

Bu projede bulgu: `src/llm.js` tek dış ağ modülü (OpenAI/Gemini/Ollama) ve `AI_PROVIDER` env'i tanımlı değilse hiç çalışmıyor. OCR (`tesseract.js`) tamamen yerel — `langPath` yerel `assets/tessdata`'yı gösteriyor, CDN'e gitmiyor.

**Kural:** Üçüncü taraf servise **kod, kimlik bilgisi veya kullanıcı içeriği** gönderme. Göndermek gerekiyorsa açıkça sor ve varsayılan olarak **kapalı** tut.

**Ulak'ta:** Aynı 5 adım. Bulguları tablo hâlinde raporla: modül / hedef / ne gönderiyor / kapatılabilir mi.

---

## 10. CI kurarken dikkat ettiklerim

1. **Matris gerçekten test ediyor mu?** — `engines` aralığındaki her major sürüm matriste olmalı. Bu projede 20.16 / 22 / 24.
2. **`npm ci` kullan**, `npm install` değil — lockfile'a sadık kalır.
3. **Sadece derleme değil, çalıştırma da test et** — sunucuyu ayağa kaldır, HTTP 200 bekle.
4. **Süre sınırı koy** — sonsuz bekleyen job kötü.
5. **Yerelde aynı komutu çalıştır** — CI'da geçip yerelde kalan fark varsa CI yanıltıcıdır.

**Ulak'ta:** Matrisi `engines`'ten türet. `npm ci` + gerçek açılış testi.

---

## 11. Raporlama biçimi

Kullanıcıya dönerken şu iskeleti kullanırım:

```
## Ne yaptım
(madde madde, her madde tek satır)

## Nasıl doğruladım
(komut → çıktı → yorum)

## Bulgular / riskler
(tablo: konu | durum | kanıt)

## Sırada ne var
(numaralı, kullanıcının karar vermesi gerekenler işaretli)
```

**Yapmam:** "Her şey harika, tamamlandı!" — kanıt yoksa söylemem.
**Yaparım:** "3/4 geçti, 4. şu hatayı verdi, şu yüzden, şu çözümü deneyeceğim."

---

## 12. Sık düştüğüm tuzaklar (ve çözümleri)

| Tuzak | Belirti | Çözüm |
|---|---|---|
| PowerShell BOM | `JSON.parse` → `Unexpected token '﻿'` | Node ile yaz: `fs.writeFileSync(p, JSON.stringify(x, null, 2))` |
| `keepalive` fetch | `Failed to fetch`, gövde boş | 64 KB sınırı var; büyük gövdede kullanma |
| `beforeunload` | Her kapanışta uyarı | `visibilitychange` + `pagehide` kullan |
| `[hidden]` çalışmıyor | Eleman görünmeye devam ediyor | `display:` kuralı `[hidden]`'ı ezer; `!important` gerekir |
| `create` üzerine yazmıyor | "already exists" | Önce sil, ya da `edit` kullan |
| Here-string ile Node | Türkçe karakter bozuluyor | `.js` dosyası yaz, `node dosya.js` çalıştır |
| `execFileSync('npm')` | Windows'ta bulunamıyor | `execSync('npm -v')` kullan |
| Port çakışması | `EADDRINUSE` | `Get-NetTCPConnection -LocalPort N` → `Stop-Process -Id` |
| Test verisi sızıntısı | Depoda `tmp-*.js` | `.gitignore`'a `tmp-*` + test sonunda sil |

---

## 13. Ulak için hızlı başlangıç kontrol listesi

Yeni bir inceleme turuna başlarken sırayla:

- [ ] Kök dizin yapısını çıkar
- [ ] Manifest oku (`package.json` / `pyproject.toml` / `go.mod`)
- [ ] `engines` / sürüm aralığını not et
- [ ] Giriş noktasını bul, ilk 100 satırını oku
- [ ] `.gitignore` + `git check-ignore` ile veri sızıntısı kontrolü
- [ ] `git log --all --name-only` ile geçmiş sızıntısı kontrolü
- [ ] Dış ağ çağrılarını listele (`fetch`/`axios`/`http`)
- [ ] CI dosyası var mı, matris `engines` ile uyumlu mu
- [ ] README iddiaları kodla uyuşuyor mu
- [ ] Değişiklik öncesi yedek al
- [ ] Değişiklik sonrası 7 katmanlı doğrulama (gerektiği kadar)
- [ ] Geçici dosyaları sil
- [ ] Raporla: ne yaptım / nasıl doğruladım / bulgular / sırada ne var

---

## 14. Tek cümlelik özet

> **Okumadan değiştirme, yedeklemeden silme, doğrulamadan "bitti" deme, kanıtsız rapor verme.**

---

*Bu belge Hayalhâne projesindeki çalışma biçiminden türetilmiştir. Ulak'a uyarlarken teknolojiye özgü komutları (npm → pip/poetry, Puppeteer → Playwright, PowerShell → bash) değiştir; ilkeler aynı kalır.*
