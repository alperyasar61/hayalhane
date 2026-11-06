# Hayalhâne — Oyun Hikâye Atölyesi

> ## ⚠️ ÜRETİM HAZIR DEĞİL
>
> **Bu proje henüz üretim (production) kullanımına hazır değildir.** Geliştirme sürmektedir; arayüz, veri biçimi ve API uçları haber verilmeden değişebilir. Gerçek/önemli verilerle kullanmadan önce yedek al. Sürüm numarası `0.x` iken kararlılık garantisi verilmez.

Mikrofonla konuşup yazıya çeviren, yazdıklarını yorumlayan, dünya dosyası okuyan ve metni bölüm bölüm sahneleyen yerel web uygulaması.

## Çalıştırma

```powershell
cd D:\Projeler\Oyun
npm install
npm start
```

Tarayıcıda aç: **http://127.0.0.1:4173**

> Mikrofon için **Chrome** veya **Edge** kullan. Konuşma tanıma tarayıcının bulut servisini kullandığı için internet gerekir.

### Gereken Node sürümü

`package.json` içindeki `engines` alanı **Node `>=20.16.0 <21 || >=22.3.0`** ister. Bu aralık keyfî değil: `pdf-parse` paketi Node 21'i desteklemiyor, bu yüzden 21 dışarıda bırakıldı.

| Node sürümü | Durum |
|---|---|
| 20.16.0 – 20.x | ✅ desteklenir |
| 21.x | ❌ desteklenmez (`pdf-parse`) |
| 22.3.0 ve üzeri 22.x | ✅ desteklenir |
| 24.x | ✅ desteklenir (geliştirme bu sürümde yapıldı) |

Sürümünü öğrenmek için `node -v`. Depoda `.nvmrc` var (`24`), nvm kullanıyorsan `nvm use` yeterli.

## GitHub'a yükleme

> **Durum: üretim öncesi.** Depo teknik olarak hatasız yüklenir (derleme adımı yok, `npm ci` sonrası `npm start` yeterli) ama proje **üretim için hazır değildir** — bkz. yukarıdaki uyarı. Depoyu herkese açık yayınlarken bunu göz önünde tut.

Yüklemeden önce bilinmesi gerekenler:

- **`data/` yüklenmez** (`.gitignore` içinde). Bu bilinçli: hikâyelerin, karakterlerin ve resimlerin senin makinende kalır. Depoyu klonlayan biri boş bir atölye ile başlar — sunucu `data/` klasörünü kendisi oluşturur.
- **`node_modules/` yüklenmez.** `package-lock.json` depoda olduğu için `npm ci` birebir aynı sürümleri kurar.
- **`assets/tessdata/` (~9,9 MB) depoya dahildir.** Bu iki `.traineddata` dosyası OCR'ın internet olmadan çalışmasını sağlar. Dosya başına GitHub sınırı 100 MB olduğu için sorun çıkmaz; sadece depo biraz büyür. Küçültmek istersen `.gitignore`'a `assets/tessdata/` ekleyip README'ye indirme adımı yazmak gerekir — ama o zaman OCR ilk kullanımda internet ister.
- **`.github/workflows/ci.yml`** her push'ta Node 20.16 / 22 / 24 matrisinde `npm ci` + `node --check` + sunucu açılış testi çalıştırır. Böylece "bende çalışıyordu" durumu ortaya çıkmaz.
- **`.gitattributes`** satır sonlarını `LF`'e sabitler; Windows'ta geliştirip Linux'ta çalıştırırken dosyalar bozulmaz.

İlk yükleme:

```powershell
cd D:\Projeler\Oyun
git init -b main
git add .
git commit -m "Hayalhane: hikaye atolyesi (uretim oncesi)"
gh repo create hayalhane --public --source=. --push
```

`gh` kurulu değilse GitHub'da boş bir depo açıp:

```powershell
git remote add origin https://github.com/<kullanici>/hayalhane.git
git push -u origin main
```

## Ne yapar

Uygulama **sol menü + çalışma alanı** olarak ikiye ayrılır. Sol menü (koyu panel) her ekranda sabit durur: en üstte Hayalhâne logosu, altında **Yeni hikâye** düğmesi, **HİKÂYELER** listesi (her satırda kelime ve sahne sayısı, üzerine gelince ✕ ile silme) ve **BÖLÜMLER** başlığı altında dört gezinme düğmesi. Sağdaki üst çubukta breadcrumb (`HAYALHÂNE / hikâye adı / bölüm`) ile **＋ Dosya Ekle** ve kayıt durumu yer alır.

| Bölüm | İşlev |
|---|---|
| **Yaz & Konuş** | Mikrofonu aç, Türkçe konuş; metin canlı olarak yazıya dökülür. Sesli komutlar: "yeni paragraf", "nokta", "virgül", "son kelimeyi sil", "analiz et", "sahnelere böl", "mikrofonu kapat". Hikâye seçimi ve yönetimi **sol menüdedir**; metin panelinin başındaki **ad kutusuna** hikâyenin adını doğrudan yaz (her tuşta kaydedilir). **Hikâye dosyası aç** ile elindeki `.txt` / `.md` / `.docx` / `.pdf` dosyasını taslağa yükle, sonra mikrofonla kaldığın yerden devam et. Panel başındaki **🔊 Sesli oku** taslağı Türkçe okur, **Türkçe düzelt** aksansız yazılmış metni (`kardes` → `kardeş`) düzeltir, **Word indir** `.docx`, **EPUB indir** e-kitap, **PDF indir** yazdırılabilir A4 belge üretir. |
| **Yorum & Öneriler** | Metni analiz eder: tür tahmini, karakterler, güçlü yanlar, eksikler, düşünme soruları ve **onayına sunulan** öneriler. "Onayla ve ekle" önerinin taslağını doğrudan metne yazar. |
| **Dünya Dosyası** | Üst çubuktaki **＋ Dosya Ekle** düğmesi ya da **Dünya Dosyası** bölümündeki sürükle-bırak alanı ile `.txt`, `.md`, `.docx`, `.pdf` yükle. Dosya otomatik olarak Markdown'a çevrilir. |
| **Karakterler** | Hikâyeden bağımsız karakter kartları. Dünya dosyasındaki "Ana Karakterler" ve "Yan Karakterler" bölümlerinden otomatik çıkarılır; her karakter ayrı kartta, **aileye göre gruplanmış** olarak listelenir. Kartı açıp **resim**, ad, takma ad, **özellik blokları** ve **aile bağları** notunu düzenleyebilir, karakteri bir hikâyeye bağlayabilir, tüm hikâyelerde arayabilir ve `karakterler.md` olarak dışa aktarabilirsin. Resmi **sürükle-bırak** ile karta bırakabilir ya da açık karttayken **Ctrl+V** ile panodan yapıştırabilirsin. Kart başındaki **onay kutusuyla** karakterleri seçip **toplu işlem** yapabilirsin: rolü değiştir (ana/yan), aileye taşı, hikâyeye bağla, hepsini birden sil. |
| **Sahneler** | Metni otomatik bölüm/sahne planına çevirir. Sahne planı **hikâye bazlıdır**: sol menüden hikâye değiştirdiğinde sahne listesi de o hikâyenin sahnelerine geçer. **＋ Sahne ekle** ile elle boş sahne ekleyebilir, sürükle-bırak sıralayabilir, başlık/özet düzenleyebilir, sahneyi onaylayabilir ve Markdown olarak dışa aktarabilirsin. Sıralama [SortableJS](https://github.com/SortableJS/Sortable) ile yapılır: `⠿` tutamacından tutup sürükle, **dokunmatik ekranda da** çalışır, animasyonludur ve bıraktığın anda kaydedilir. |
| **Notlar** | Hikâyeden bağımsız fikir defteri. Aklına gelen sahne, replik, mekân ya da çözülmesi gereken konuyu yaz. Her notta **başlık**, **gövde**, **etiketler** (`#sahne`, `#replik`…), **hikâye bağı** ve **sabitleme** var. Sabitlenen notlar listenin en üstünde kalır. Etikete, sabitlenenlere ve hikâyeye bağlı olanlara göre filtreleyebilir, notlarda arayabilirsin. **Metne ekle** notu doğrudan hikâye taslağının sonuna yazar, **Kopyala** panoya alır, **Dışa aktar** tüm notları `hayalhane-notlar.md` olarak indirir. Alttaki hızlı kutuya yazıp Enter'a basmak en hızlı yol. |

Her şey `data/project.json` içine otomatik kaydedilir; sayfayı yenilesen de hikâyeler, taslak, sahneler, karakterler ve dünya dosyası yerinde kalır.

### Yedekleme ve veri güvenliği

- Her kayıt **atomik** yazılır: önce `data/project.json.tmp` dosyasına yazılır, sonra yerine taşınır. Yazma sırasında bir kesinti olursa eski dosya bozulmadan kalır.
- Kayıt sırasında içerik **azalıyorsa** (kelime veya sahne sayısı düşüyorsa) mevcut dosya `data/backups/project-<tarih>.json` olarak yedeklenir. Son 40 yedek tutulur.
- Sol menünün altındaki **⟲ Yedekler** düğmesi yedekleri listeler (tarih, hikâye/karakter/sahne sayısı, boyut) ve tek tıkla geri yükler. Geri yüklemeden önce mevcut durum da yedeklenir.
- API: `GET /api/backups` listeler, `POST /api/backups/restore` `{ "file": "project-….json" }` ile geri yükler.
- **Projeyi indir / Projeyi yükle** (sol menünün altı): tüm projeyi (hikâyeler, taslaklar, sahneler, karakterler, resimler, dünya dosyası) tek bir `hayalhane-yedek-YYYY-AA-GG.json` dosyasına indirir. Bu dosya **taşınabilir tam yedektir** — diski bozulsa, bilgisayar değişse ya da proje silinse bile **Projeyi yükle** ile her şey birebir geri gelir. Yükleme öncesi mevcut durum otomatik yedeklenir, yani yanlış dosya seçsen de eski hâline dönebilirsin. API: `GET /api/project/export`, `POST /api/project/import`.
- **Kaydedilmemiş değişiklik koruması:** metin yazarken kayıt 700 ms geciktirilir (her tuşta diske yazmamak için). Sekmeyi kapatırsan, başka sekmeye geçersen ya da telefonu kilitlersen bekleyen değişiklik **anında** diske yazılır — yazdıkların kaybolmaz.
- **Yazdırma:** `Ctrl+P` ile doğrudan yazdırabilirsin. `@media print` kuralları sol menüyü, düğmeleri ve mikrofon çubuğunu gizler; metni beyaz kâğıda siyah 12 pt olarak, A4 kenar boşluklarıyla basar. Karakter kartları ve notlar sayfa ortasından bölünmez (`break-inside: avoid`).

### Gizlilik — veri dışarı çıkmaz

Uygulama **tamamen yereldir**. Sunucu yalnızca `127.0.0.1:4173` adresini dinler; ağdaki başka bir makineden erişilemez. Hikâyeler, karakterler, dünya dosyası ve resimler `data/project.json` dışına çıkmaz.

Kodda dışarıya veri gönderen **tek** yer `src/llm.js`'tir ve o da **yalnızca sen açıkça istersen** çalışır:

| Durum | Nereye gider |
|---|---|
| `AI_PROVIDER` tanımlı değil (varsayılan) | **Hiçbir yere.** Yerel kural motoru çalışır. |
| `AI_PROVIDER=ollama` | `127.0.0.1:11434` — kendi bilgisayarındaki Ollama. |
| `AI_PROVIDER=openai` + anahtar | `api.openai.com` — taslak metnin ilk 12.000 karakteri. |
| `AI_PROVIDER=gemini` + anahtar | `generativelanguage.googleapis.com` — aynı metin. |

Bunun dışında hiçbir telemetri, analitik, CDN veya dış servis yoktur:

- **Arayüz** yalnızca kendi sunucuna (`/api/...`) istek atar; hiçbir dış `fetch` yoktur. Tüm kütüphaneler (`sortable`, `fuse`, `cytoscape`) `node_modules` içinden `/vendor/...` ile yerelden sunulur.
- **OCR** dil verisi `assets/tessdata/` içindedir; tesseract.js CDN'e gitmez.
- **EPUB / Word** üretimi tamamen yerel, dosya sisteminde yapılır.
- **Sesli okuma** tarayıcının kendi `speechSynthesis` motorunu kullanır (Chrome'da bazı sesler bulut tabanlı olabilir; tamamen yerel ses istiyorsan işletim sisteminin yüklü seslerini kullan).
- **Mikrofon** tarayıcının konuşma tanıma servisini kullanır — Chrome/Edge bunu bulutta yapar. Çevrimdışı olması için **Çevrimdışı** anahtarını aç (`processLocally`).
- `scripts/check-env.js` (`npm run check`) sürüm karşılaştırması için `npm view` çağırır — yalnızca paket adı gider, proje içeriği gitmez.

### Hikâyeler

Proje artık **çok hikâyeli**: `stories[]` dizisi ve `activeStoryId` tutulur. Her hikâye `{ id, title, draft, scenes[] }` yapısındadır; taslak ve sahneler seçili hikâyeye aittir. Karakterler `storyId` alanıyla bir hikâyeye bağlanır — bir hikâyenin karakterleri diğerine karışmaz. Karakterler bölümündeki **hikâye filtresi** ile tek hikâyenin kadrosunu görebilir, arama kutusuna yazdığında ise **tüm hikâyelerde** arama yapılır.

Eski tek hikâyeli `project.json` dosyaları sunucu tarafında otomatik olarak yeni yapıya taşınır (`migrate()`); üst seviyedeki `draft`/`scenes` alanları etkin hikâyenin kopyası olarak geriye dönük uyumluluk için yazılmaya devam eder.

**Hikâye yönetimi sol menüdedir:** *Yeni hikâye* düğmesi ad sorup hikâyeyi açar ve o hikâyeye geçer; listedeki bir satıra tıklamak o hikâyeyi açar; satırın sağ ucundaki ✕ hikâyeyi siler. Metin panelinin başında da kırmızı **Hikâyeyi sil** düğmesi vardır — açık olan hikâyeyi siler.

Silme **her şeyi birlikte** kaldırır: hikâyenin metni, sahne planı ve o hikâyeye bağlı karakterler (resimleri ve özellik bloklarıyla). Onay kutusu silinecek kelime/sahne/karakter sayısını gösterir. Son hikâye de silinebilir; yerine boş bir `Hikâye 1` açılır, böylece uygulama her zaman en az bir hikâyeyle çalışır.

**Hikâye adı** metin panelinin başındaki kutudan doğrudan yazılır; ayrı bir "adı değiştir" düğmesi yoktur. Adı **tamamen boş bırakabilirsin** — uygulama kendi kendine `Hikâye N` adı üretmez. Ad boşken sol menüde, breadcrumb'da ve seçicilerde italik **Adsız hikâye** yer tutucusu görünür; bu metin kayda yazılmaz. *Yeni hikâye* düğmesi de ad sormaz: boş bir hikâye açar, imleci başlık kutusuna koyar. Ad değiştiğinde sol menü, breadcrumb ve sahne seçicisi anında güncellenir.

**Hikâye dosyası aç:** *Hikâye dosyası aç* düğmesi `.txt`, `.md`, `.markdown`, `.docx`, `.pdf` dosyasını sunucuya gönderir (`POST /api/document`), düz metne çevirir ve etkin hikâyenin taslağına yazar. Taslak doluysa önce onay istenir. Dünya dosyasına dokunmaz — yalnızca yazı alanını doldurur, böylece mikrofonla kaldığın yerden devam edebilirsin.

**Sahne planı hikâye bazlıdır:** her hikâyenin kendi `scenes[]` dizisi vardır. Sol menüden hikâye değiştirdiğinde sahne listesi o hikâyenin sahnelerine geçer; yeni bir hikâyede liste boş gelir, geri döndüğünde sahneler yerinde durur.

### Mikrofon doğruluğu

Konuşma tanıma Türkçede özel isimleri ve bitişik kelimeleri sık yanlış duyar. Bunun için üç katmanlı düzeltme var:

1. **Düzeltme sözlüğü** — *Sözlük* düğmesiyle açılır. Her satıra `yanlış duyulan = doğrusu` yazılır (ör. `hayal hane = Hayalhâne`). Kurallar `localStorage`'da saklanır, varsayılana döndürülebilir.
2. **Karakter adları** — sözlükteki karşılıklar ve kayıtlı karakter adları/takma adları, tanınan metinde Levenshtein mesafesiyle (kısa adlarda 1, uzun adlarda 2 harf tolerans) düzeltilir. `anne`, `baba`, `hala` gibi sıradan kelimeler korunur, büyük harfe çevrilmez.
3. **Çoklu alternatif** — tanıma motorundan 3 alternatif istenir; sözlüğe/karakter adlarına en çok uyan ve güveni en yüksek olan seçilir.

Ayrıca **Onaylayarak ekle** kutusu işaretlenirse tanınan cümle doğrudan metne yazılmaz; ekranın üstünde "Duyulan: …" çubuğu çıkar, **Ekle** / **Vazgeç** ile karar verirsin. **↶ Son cümleyi geri al** düğmesi mikrofonla eklenen son parçayı metinden çıkarır. Ara sonuçlar da düzeltmeden geçtiği için yazarken ne duyulduğunu doğru biçimde görürsün.

**Çevrimdışı mod** anahtarı cihaz üstü tanımayı (`SpeechRecognition.processLocally`) açar; ses buluta gitmez. Chrome 138+ gerekir, Türkçe dil paketi ilk kullanımda bir kez indirilir. Tarayıcı desteklemiyorsa anahtar kendiliğinden kapanır ve çevrimiçi moda döner.

### Dünya dosyası → Markdown

Yüklediğin `.docx` / `.pdf` / `.txt` dosyası sunucuda düz metne çıkarılır, ardından başlık, liste ve paragraf yapısı tahmin edilerek **Markdown**'a çevrilir. Dünya Dosyası sekmesinde iki görünüm vardır:

- **Markdown (AI için)** — analizde bağlam olarak kullanılan sürüm. Elle düzenleyebilirsin.
- **Ham metin** — dosyadan çıkan ham hâli.

Sağdaki **.md indir** düğmesi dosyayı `.md` olarak bilgisayarına kaydeder, **Kopyala** panoya alır. Markdown sürümü aynı zamanda `GET /api/world/markdown` adresinden de indirilebilir.

**Taranmış belgeler (OCR):** PDF'in metin katmanı yoksa ya da doğrudan bir resim (`.png`, `.jpg`, `.webp`, `.bmp`, `.tif`) yüklersen `tesseract.js` devreye girer ve `tur+eng` dil verisiyle metin çıkarılır. Dil verisi (`assets/tessdata/tur.traineddata`, `eng.traineddata`) **proje içinde** durur — OCR çalışırken **internete hiçbir şey gönderilmez, hiçbir şey indirilmez**. OCR yalnızca gerektiğinde çalışır.

### Karakterler

Dünya dosyasındaki numaralı bölümler taranır:

- `1. Ana Karakterler` → aile başlıkları (`Giresun Ailesi` gibi) ve `Ad: açıklama` satırları
- `2. Yan Karakterler ve Özellikleri` → `Ad – Takma ad: açıklama` satırları

Her karakter `{ name, nickname, family, role, storyId, description, features[], traits[], note, image }` olarak saklanır:

- `features[]` — **özellik blokları**. Her blok `{ id, title, detail }`; başlık kartın içinde kalın bir başlık olarak görünür (ör. **Anne Terliği**), altında açıklaması yer alır. `+ Özellik` ile eklenir, `✕` ile silinir.
- `note` — **aile bağları** (ör. "Doğa'nın kuzeni, Tufan'ın ablası").
- `image` — karakter resmi. `＋ Resim ekle` ile dosya seçilir, **resmi karta sürükleyip bırakabilir** ya da açık karttayken **Ctrl+V** ile panodan yapıştırabilirsin. Resim tarayıcıda 320 px'e küçültülüp JPEG data URL olarak saklanır, böylece `project.json` şişmez.
- `storyId` — karakterin bağlı olduğu hikâye.

**İsim değişince hikâye de güncellenir:** karttaki *İsim* alanını değiştirdiğinde eski isim, tüm hikâyelerin taslağında, sahne başlık/özet/beat'lerinde, dünya dosyası metinlerinde ve diğer karakterlerin not/özellik açıklamalarında tam kelime olarak yenisiyle değiştirilir; kaç yerde değiştiği bildirimde gösterilir.

Dünya dosyası yüklendiğinde ve karakter listesi boşsa çıkarma otomatik yapılır; **Dünya dosyasından çıkar** düğmesiyle elle de tetiklenebilir (aynı isimli karakterler tekrar eklenmez).

**Arama:** üstteki arama kutusu tüm hikâyelerde isim, takma ad, aile, açıklama, özellik ve not alanlarında arar. Önce birebir eşleşmeler gösterilir, ardından [Fuse.js](https://fusejs.io) ile **bulanık arama** devreye girer — `dogaa` yazınca `Doğa` da bulunur (Türkçe karakter toleranslı).

**Aile ağacı görünümü:** sağ üstteki **Kartlar / Aile Ağacı** düğmesi karakterleri [Cytoscape](https://js.cytoscape.org) grafiği olarak gösterir. Düğüm rengi aile grubunu belirtir (yan karakterler gri, kare biçiminde). Bağlar üç kaynaktan çıkarılır:

- **kardeş** — aynı aile grubundaki ana karakterler birbirine bağlanır,
- **not** — not/açıklama/özellik metninde başka bir karakterin adı geçiyorsa kesikli çizgi,
- **hikâye** — hiç bağı olmayan yan karakterler hikâyesinin ilk ana karakterine noktalı çizgiyle bağlanır.

Düğüme tıklayınca kart görünümüne dönülür ve o karakterin kartı açılır. **Sığdır** grafiği ekrana sığdırır, **Yeniden yerleştir** yerleşimi yeniden hesaplar.

**Word olarak indir:** *Yaz & Konuş* panelindeki **Word indir** düğmesi hikâyeyi `.docx` olarak indirir — başlık, taslak metni, sahne planı (amaç/süre/kelime/beat'ler) ve karakter kartları (özellikler + aile bağları notları) dahil. API: `POST /api/export/docx` gövdesi `{ "storyId": "..." }`.

**EPUB olarak indir:** **EPUB indir** düğmesi hikâyeyi e-kitap (`.epub`) olarak indirir — telefon, tablet ve e-okuyucularda açılır. Dosya **EPUB 3** standardındadır ve W3C'nin resmî **epubcheck 5.1.0** aracıyla doğrulandı (0 hata / 0 uyarı). İçinde başlık sayfası, hikâye metni (paragraflara bölünmüş), sahne planı ve karakter kartları ayrı bölümler olarak, otomatik **içindekiler** tablosuyla yer alır. Üretici [`src/epub.js`](src/epub.js) içinde, **sıfır ek bağımlılıkla** yazıldı (yalnızca `jszip`). API: `POST /api/export/epub` gövdesi `{ "storyId": "...", "includeScenes": true, "includeCharacters": true }`.

**PDF olarak indir:** **PDF indir** düğmesi hikâyeyi yazdırmaya hazır **A4** belge olarak açar ve tarayıcının yazdırma penceresini getirir; oradan **Hedef → PDF olarak kaydet** seçilir. Belge Georgia serif yazı tipiyle, 20 mm kenar boşluğuyla, başlık + Türkçe tarih alt başlığı + paragraflara bölünmüş hikâye metni + numaralı sahne planı + karakter kartları (ad, takma ad, aile, özellikler, not) içerir. Tamamen tarayıcıda üretilir — sunucuya istek gitmez, ek bağımlılık yoktur. Metindeki tüm HTML karakterleri kaçırılır (`<script>` yazsan bile çalışmaz, düz metin olarak basılır). Açılır pencere engelleyiciyi kapatman gerekebilir; engellenirse uyarı gösterilir.

**Sesli oku:** *Yaz & Konuş* panelindeki **🔊 Sesli oku** düğmesi taslağı tarayıcının `speechSynthesis` motoruyla Türkçe okur — ek bağımlılık yok. Metin cümlelere bölünüp sırayla okunur (Chrome'un uzun metin sınırını aşmamak için 200 karakterlik parçalar). Okuma sırasında düğme **⏹ Durdur**'a döner; sekme kapanırken ses kesilir. Türkçe ses yüklü değilse tarayıcının varsayılan sesi kullanılır.

**Türkçe düzelt:** **Türkçe düzelt** düğmesi aksansız yazılmış metni (`kardes`, `ogretmen`, `simdi`) doğru Türkçe harflere çevirir (`kardeş`, `öğretmen`, `şimdi`). [turkish-deasciifier](https://github.com/f/deasciifier) kullanılır (Deniz Yuret'in Emacs Türkçe eklentisinin JS portu, ISC lisansı). Bağlam tabanlı çalışır: `kar` → `kâr` gibi ayrımları da yakalar. API: `POST /api/deasciify` gövdesi `{ "text": "..." }` → `{ "text": "...", "changed": true }`.

API: `POST /api/characters` gövdesi `{ "text": "..." }` → `{ "characters": [...] }`. Karakterler `PUT /api/project` ile `data/project.json` içine yazılır.

### Hikâye dosyası açma API'si

`POST /api/document?filename=ad.txt` — gövde **ham dosya baytları** (`Content-Type: */*`, en fazla 25 MB). Dosya `.docx` (mammoth), `.pdf` (pdf-parse), resim (`.png/.jpg/.webp/.bmp/.tif` → tesseract OCR) veya düz metin olarak okunur; `.doc` desteklenmez (415 döner). Yanıt: `{ filename, text, chars, words }`. Bu uç nokta `project.world` alanına **yazmaz**.

### Aile bağları çıkarma

**Aile bağlarını çıkar** düğmesi dünya dosyasındaki *Aile Bağları ve Akrabalık Düzeni* bölümünü tarar (`src/kinship.js`):

- **Genel düzen** — bölümdeki kural cümleleri (ör. "On iki ana karakter, altı ayrı şehirde yaşayan altı kardeş ailesinin çocuklarıdır.") kartların üstündeki panelde gösterilir.
- **Kişi başına bağlar** — her karakterin adının geçtiği cümlelerde akrabalık kökü (`anne`, `baba`, `dede`, `kardeş`, `kuzen`, `hala`, `teyze`, `amca`, `dayı`, `enişte`, `yeğen`, `torun`…) aranır. Bulunan cümle kanıt olarak notun altına eklenir.
- **Kardeş / kuzen** — aynı aile grubundaki ana karakterler kardeş, diğer ailelerin ana karakterleri kuzen olarak yazılır.

Sınırlar:

- Metin akrabalık unvanlarını **bakış açısına göre** tanımlıyorsa (ör. "Akrabalık unvanları seçilen ana karakterin bakış açısına göre değişir") bu cümle kural olarak ayrılır ve bağ sayılmaz; panelde uyarı olarak gösterilir.
- Lakap ve yer adları bağ sayılmaz (`Anne Terliği`, `Dede Ocağı`, `Karadeniz Kafası` gibi ifadeler eşleşmeden önce maskelenir).
- Adı akrabalık unvanı olan karakterlerde (Anne, Baba, Dede…) çıplak unvan yerine iyelikli hâl aranır: "annesine", "babası", "dedesinin".

**Var olan not korunur:** çıkarma yalnızca *boş* not alanlarını doldurur; elle yazdığın notların üzerine yazmaz. Sonuç eksik ya da yanlışsa karttaki **Aile bağları / notlar** alanından doğrudan düzeltebilirsin.

API: `POST /api/kinships` gövdesi `{ "text": "...", "characters": [{ "id", "name", "family", "role" }] }` → `{ "general": [...], "caveat": "...", "byName": {...}, "notes": { "<id>": "..." } }`.

## Yorum motoru

Varsayılan olarak **yerel kural motoru** çalışır (internet/anahtar gerekmez). İstersen gerçek bir dil modeline bağla — ortam değişkenleriyle:

```powershell
# OpenAI
$env:AI_PROVIDER="openai"; $env:OPENAI_API_KEY="sk-..."; $env:OPENAI_MODEL="gpt-4o-mini"; npm start

# Google Gemini
$env:AI_PROVIDER="gemini"; $env:GEMINI_API_KEY="..."; npm start

# Yerel Ollama (önce https://ollama.com kur, sonra: ollama pull llama3.1)
$env:AI_PROVIDER="ollama"; $env:OLLAMA_MODEL="llama3.1"; npm start
```

Sağlayıcı hata verirse uygulama sessizce yerel motora düşer, ekran çalışmaya devam eder.

## Dosya yapısı

```
server.js          Express sunucusu + API
src/analyzer.js    Yerel analiz ve sahneleme motoru
src/characters.js  Dünya dosyasından karakter çıkarıcı
src/kinship.js     Aile bağları çıkarıcı
src/markdown.js    Düz metin → Markdown dönüştürücü
src/llm.js         OpenAI / Gemini / Ollama bağlayıcısı
src/epub.js        EPUB 3 e-kitap üretici (yerel, jszip)
public/            Arayüz (index.html, styles.css, app.js)
assets/tessdata/   OCR dil verisi (tur + eng, yerel)
data/project.json  Otomatik kayıt
data/backups/      Otomatik yedekler (son 40)
.github/workflows/ CI (Node 20.16 / 22 / 24 matrisi)
.githooks/         pre-commit: hikâye verisi commit'ini engeller
.nvmrc             Önerilen Node sürümü (24)
.gitattributes     Satır sonu normalizasyonu (LF)
ARASTIRMA-METODOLOJISI.md  İnceleme/doğrulama yöntemi (Ulak'a uyarlanabilir)
```

**Kullanılan kütüphaneler:** `express` (sunucu), `mammoth` (docx okuma), `pdf-parse` (pdf okuma), `tesseract.js` (OCR), `docx` (Word yazma), `jszip` (EPUB paketleme), `cytoscape` (aile ağacı), `fuse.js` (bulanık arama), `sortablejs` (sahne sıralama), `turkish-deasciifier` (Türkçe karakter düzeltme). Hepsi MIT / Apache-2.0 / ISC — ticari kapalı kaynak projede de serbestçe kullanılabilir.

## Hikâye verisi asla depoya girmez

`data/` klasöründe hikâyeler, karakterler, dünya dosyası, resimler ve yedekler durur. Bu klasör **üç katmanlı** olarak korunur:

1. **`.gitignore`** — `data/`, `**/project.json`, `**/backups/`, `*.hayalhane.json` engellenir.
2. **`.githooks/pre-commit`** — biri `git add -f` ile zorlasa bile commit **durdurulur**. Kurulum: `git config core.hooksPath .githooks` (depo klonlandıktan sonra bir kez).
3. **Uzak depo denetimi** — `git ls-tree -r --name-only origin/main | grep "^data/"` boş dönmelidir.

Doğrulama:

```powershell
git check-ignore -v data/project.json          # .gitignore eşleşmesini gösterir
git log --all --name-only | Select-String "^data/"   # geçmişte sızıntı var mı
git ls-tree -r --name-only origin/main | Select-String "^data/"  # uzakta var mı
```

## Arayüz yapısı

`public/index.html` iki sütunlu bir kabuk kullanır:

```
.app-shell
├── aside.sidebar          → logo, Yeni hikâye, HİKÂYELER listesi, BÖLÜMLER menüsü
└── .main-shell
    ├── header.topbar      → breadcrumb + ＋ Dosya Ekle + kayıt durumu
    └── main               → #view-write / #view-world / #view-characters / #view-scenes / #view-notes
```

Sol menüdeki beş `.side-nav-item.tab` düğmesi `data-view` taşır; `showView(view)` hem `.tab.active` hem `.view.active` sınıfını değiştirir ve breadcrumb'ı günceller. Hikâye listesi `renderSidebarStories()` ile çizilir; `#sideStoryList` üzerindeki tek bir delege click dinleyicisi `data-act="open"` / `data-act="delete"` ayrımını yapar. `state.scenes` bir accessor'dür ve her zaman etkin hikâyenin `scenes[]` dizisine bağlanır — bu yüzden sahne planı hikâye bazlıdır.

Karakter kartlarındaki onay kutuları `selectedCharIds` (bir `Set`) içine yazar; `renderBulkBar()` seçim varsa `#bulkBar` çubuğunu gösterir. Toplu işlemler `document` üzerindeki tek bir delege click dinleyicisiyle `data-bulk` özniteliğinden yürütülür. Notlar `state.notes` dizisinde tutulur; `renderNotes()` etiket filtresi düğmelerini (`data-nfilter`) ve kartları çizer, `data-nact` / `data-nfield` öznitelikleri delege dinleyicilerle işlenir.
