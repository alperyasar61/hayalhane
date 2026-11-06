# Hayalhâne — GitHub Proje İncelemesi

Bu rapor, Hayalhâne'ye katkı sağlayabilecek açık kaynak projelerin incelenmesidir.
Her satırda **ne işe yaradığı**, **Hayalhâne'ye nasıl oturacağı**, **efor/risk** ve **öncelik** yazıyor.

Öncelik ölçeği:

- **A — Hemen ekle**: küçük efor, yüksek fayda, lisans uygun.
- **B — Sonra**: orta efor ya da ikinci faz.
- **C — Sadece ilham**: lisansı kapalı (GPL/AGPL) ya da mimarisi uymuyor; kodu alınmaz, fikri okunur.

---

## 1. Konuşma tanıma (mikrofon doğruluğu)

Şu an tarayıcının `webkitSpeechRecognition`'ı kullanılıyor. Türkçe için doğruluk sınırlı ve internet gerekiyor.

| Proje | ★ | Lisans | Dil | Ne yapar | Hayalhâne için |
|---|---|---|---|---|---|
| [alphacep/vosk-api](https://github.com/alphacep/vosk-api) | 15.2k | Apache-2.0 | C/Python/Node | Çevrimdışı konuşma tanıma, Türkçe model var (`vosk-model-small-tr`) | **A** — `vosk` npm paketi ile yerel, internet gerektirmeyen tanıma. Küçük model ~50 MB. Tarayıcı API'si başarısız olduğunda yedek yol olarak kullanılabilir. |
| [ggml-org/whisper.cpp](https://github.com/ggml-org/whisper.cpp) | 55k | MIT | C/C++ | Whisper'ın C++ portu, CPU'da hızlı, Türkçe desteği çok iyi | **B** — Doğruluk en yüksek seçenek ama kurulum ağır (model indirme, derleme). "Yüksek doğruluk modu" olarak opsiyonel eklenebilir. |
| [kcan25/turkish-whisper-finetuning](https://github.com/kcan25/turkish-whisper-finetuning) | — | — | Python | Türkçe için Whisper ince ayarı | **C** — Eğitim tarifi olarak ilham; modeli kendimiz barındırmayacağız. |
| [KeremIzmir/turkish-speech-to-text](https://github.com/KeremIzmir/turkish-speech-to-text) | — | — | Python | Türkçe STT örneği | **C** — Referans. |

**Öneri:** Vosk'u "Çevrimdışı mod" olarak ekle. Tarayıcı API'si zaten var; Vosk başarısız olduğunda devreye girsin. Böylece internet kesildiğinde de yazmaya devam edilir.

---

## 2. Türkçe metin işleme (düzeltme / normalizasyon)

Mikrofon düzeltme sözlüğü şu an elle yazılıyor. Bunu otomatikleştirecek projeler:

| Proje | ★ | Lisans | Dil | Ne yapar | Hayalhâne için |
|---|---|---|---|---|---|
| [ahmetaa/zemberek-nlp](https://github.com/ahmetaa/zemberek-nlp) | 1.4k | Apache-2.0 | Java | Türkçe morfoloji, yazım denetimi, heceleme | **C** — Java; Node'a köprü (JNI/ayrı servis) gerekir. Ama yazım denetimi fikri değerli. |
| [vngrs-ai/vnlp](https://github.com/vngrs-ai/vnlp) | 291 | **AGPL-3.0** | Python | Türkçe NLP araç seti | **C** — AGPL: kodu gömersen tüm uygulaman AGPL olur. Sadece fikir. |
| [ozguradmin/trnorm-js](https://github.com/ozguradmin/trnorm-js) | 4 | Apache-2.0 | JS | Türkçe metin normalizasyonu (npm: `@ozgurguler/trnorm`) | **A** — Küçük, JS, lisans uygun. Mikrofon çıktısındaki sayı/kısaltma normalizasyonu için doğrudan kullanılabilir. |
| [emres/turkish-deasciifier](https://github.com/emres/turkish-deasciifier) | 158 | MIT | JS | Bozuk Türkçe karakterleri düzeltir (`hayalhane` → `hayalhâne`) | **A** — Tek dosya, bağımlılıksız. Yapıştırılan metinlerde ve dosya adlarında işe yarar. |
| [muhammednursoy/turkcelestir](https://github.com/muhammednursoy/turkcelestir) | — | — | JS | Türkçeleştirme yardımcıları | **B** — Küçük yardımcı; deasciifier ile birlikte değerlendir. |
| [yasinkuyu/Turkish.js](https://github.com/yasinkuyu/Turkish.js) | 42 | MIT | JS | Türkçe string yardımcıları | **C** — Bakımsız (son commit eski). |

**Öneri:** `turkish-deasciifier` + `trnorm` ikilisi tek bir "metin temizle" katmanı olarak eklenebilir. Zemberek'i çalıştırmak için ayrı bir Java servisi gerekir; şimdilik gereksiz.

---

## 3. Aile bağları görselleştirme (soy ağacı)

Karakterlerin aile bağları şu an metin notu olarak tutuluyor. Görsel bir grafik çok daha anlaşılır olur.

| Proje | ★ | Lisans | Dil | Ne yapar | Hayalhâne için |
|---|---|---|---|---|---|
| [cytoscape/cytoscape.js](https://github.com/cytoscape/cytoscape.js) | 11.3k | MIT | JS | Graf görselleştirme + düzen algoritmaları | **A** — Soy ağacı için en uygun. `cose`/`dagre` düzeni ile aile ilişkileri otomatik yerleşir. Tek dosya, CDN'den bile yüklenebilir. |
| [visjs/vis-network](https://github.com/visjs/vis-network) | 3.6k | Apache-2.0 | JS | Ağ/graph görselleştirme | **B** — Alternatif; cytoscape'ten daha basit ama düzen algoritmaları daha zayıf. |

**Öneri:** Karakterler sekmesine **"Aile Ağacı"** görünümü ekle. `src/kinship.js` zaten ilişkileri çıkarıyor; sadece düğüm/kenar listesine çevirip cytoscape'e vermek yeterli. Efor: ~1 gün.

---

## 4. Sahne sıralama (sürükle-bırak)

| Proje | ★ | Lisans | Dil | Ne yapar | Hayalhâne için |
|---|---|---|---|---|---|
| [SortableJS/Sortable](https://github.com/SortableJS/Sortable) | 31.2k | MIT | JS | Sürükle-bırak sıralama, dokunmatik destekli | **A** — Şu an sıralama elle (HTML5 drag events) yapılıyor; Sortable ile dokunmatik cihazlarda da çalışır, animasyonlu ve stabil olur. ~10 KB. |

---

## 5. Dışa aktarma (Word / EPUB / PDF)

| Proje | ★ | Lisans | Dil | Ne yapar | Hayalhâne için |
|---|---|---|---|---|---|
| [dolanmiu/docx](https://github.com/dolanmiu/docx) | 6k | MIT | JS | `.docx` üretimi (tarayıcı + Node) | **A** — Hikâyeyi/sahneleri/karakterleri biçimli Word dosyası olarak indir. Yazarlar için en çok istenen özellik. |
| [cyrilis/epub-gen](https://github.com/cyrilis/epub-gen) | 459 | MIT | JS | EPUB üretimi | **B** — Hikâye tamamlanınca e-kitap çıktısı. |
| [markedjs/marked](https://github.com/markedjs/marked) | 37.3k | MIT | JS | Markdown → HTML | **B** — Zaten Markdown üretiyoruz; önizleme ve PDF (yazdır) için gerekli. |

**Öneri:** Önce `docx` (Word çıktısı), sonra `marked` + tarayıcı yazdırma ile PDF. EPUB en sona.

---

## 6. Depolama dayanıklılığı

| Proje | ★ | Lisans | Dil | Ne yapar | Hayalhâne için |
|---|---|---|---|---|---|
| [typicode/lowdb](https://github.com/typicode/lowdb) | 22.6k | MIT | JS | JSON dosya veritabanı, atomik yazma | **B** — Şu an elle JSON yazıyoruz. lowdb atomik yazma + şema verir. Ama kendi yedekleme katmanımızı zaten ekledik; lowdb'ye geçmek zorunlu değil. |

---

## 7. Metin editörü

| Proje | ★ | Lisans | Dil | Ne yapar | Hayalhâne için |
|---|---|---|---|---|---|
| [ueberdosis/tiptap](https://github.com/ueberdosis/tiptap) | 39k | MIT | JS | Headless zengin metin editörü | **C** — `<textarea>` yeterli ve sade. Zengin metin (kalın/italik) gerekirse düşünülür; şimdilik gereksiz karmaşıklık. |
| [ProseMirror/prosemirror](https://github.com/ProseMirror/prosemirror) | 8.7k | MIT | JS | Editör çatısı | **C** — tiptap'in alt katmanı; aynı gerekçe. |

---

## 8. Arama

| Proje | ★ | Lisans | Dil | Ne yapar | Hayalhâne için |
|---|---|---|---|---|---|
| [krisk/Fuse](https://github.com/krisk/Fuse) | 20.5k | Apache-2.0 | JS | Bulanık (fuzzy) arama | **A** — Karakter araması şu an `includes` ile birebir. Fuse ile "elif" yazınca "Elif", "Elıf", "Eliff" de bulunur; Türkçe karakter hatalarını tolere eder. |

---

## 9. OCR (taranmış belge okuma)

| Proje | ★ | Lisans | Dil | Ne yapar | Hayalhâne için |
|---|---|---|---|---|---|
| [naptha/tesseract.js](https://github.com/naptha/tesseract.js) | 38.8k | Apache-2.0 | JS | Tarayıcıda OCR, Türkçe dil paketi var | **B** — Kullanıcı el yazısı/değil taranmış PDF veya fotoğraf yüklerse metne çevirir. `pdf-parse` metin tabanlı PDF'lerde çalışıyor; taranmış PDF'lerde boş dönüyor. Bu boşluğu kapatır. |

---

## 10. Seslendirme (TTS)

| Proje | ★ | Lisans | Dil | Ne yapar | Hayalhâne için |
|---|---|---|---|---|---|
| [canberk7/ema-lightning](https://github.com/canberk7/ema-lightning) | 295 | — | Python | Türkçe TTS | **C** — Ağır model; tarayıcının `speechSynthesis`'ı Türkçe ses veriyor, yeterli. |
| [sewox/turkish-neural-tts](https://github.com/sewox/turkish-neural-tts) | — | — | Python | Türkçe nöral TTS | **C** — Aynı gerekçe. |

**Not:** Tarayıcıda `speechSynthesis` ile "hikâyeyi sesli oku" özelliği **sıfır bağımlılıkla** eklenebilir. Kütüphane gerekmez.

---

## 11. Referans projeler (yalnızca ilham — lisans kapalı)

| Proje | ★ | Lisans | Neden ilham |
|---|---|---|---|
| [saga-soft/novelWriter](https://github.com/saga-soft/novelWriter) | 3.2k | **GPL-3.0** | Roman yazma ortamı: proje ağacı, karakter/konum/etiket veritabanı, sahne meta verisi, anlık görüntü (snapshot) sistemi. **Snapshot fikri** bizim yedek sistemine çok benziyor. |
| [olivierkes/manuskript](https://github.com/olivierkes/manuskript) | 2.5k | **GPL-3.0** | Outliner + karakter kartları + hikâye örgüsü (plot) görünümü. **Plot çizgisi** görünümü ilham verici. |
| [akarshkashyap4-ui/NovelWriter](https://github.com/akarshkashyap4-ui/NovelWriter) | 45 | MIT | Basit web tabanlı yazma aracı; MIT olduğu için kodu incelenebilir. |

> GPL/AGPL projelerin kodu **kopyalanmaz**; yalnızca özellik fikirleri okunur. Aksi hâlde Hayalhâne'nin tamamının lisansı değişmek zorunda kalır.

---

## 12. Oyun motoru (ileri faz)

| Proje | ★ | Lisans | Dil | Ne yapar | Hayalhâne için |
|---|---|---|---|---|---|
| [excaliburjs/Excalibur](https://github.com/excaliburjs/Excalibur) | 2.4k | BSD-2 | TS | 2D oyun motoru, tarayıcıda | **C** — Hayalhâne bir yazma atölyesi, oyun motoru değil. Ancak "sahne önizlemesi" (diyalog + karakter resmi + arka plan) yapılmak istenirse temel olabilir. |

---

## Özet — sırayla yapılacaklar

| # | Özellik | Proje | Efor | Etki | Durum |
|---|---|---|---|---|---|
| 1 | Aile ağacı görünümü | cytoscape.js | ~1 gün | Çok yüksek — kullanıcının asıl istediği | ✅ **yapıldı** |
| 2 | Word (.docx) dışa aktarma | dolanmiu/docx | ~yarım gün | Yüksek | ✅ **yapıldı** |
| 3 | Bulanık karakter arama | Fuse.js | ~2 saat | Yüksek | ✅ **yapıldı** |
| 4 | Sahne sıralamada Sortable | SortableJS | ~2 saat | Orta | ✅ **yapıldı** |
| 5 | Türkçe karakter düzeltme | turkish-deasciifier | ~1 saat | Orta | ✅ **yapıldı** |
| 6 | Çevrimdışı mikrofon (Vosk) | vosk-api | ~1 gün | Yüksek (internet sorunu) | ✅ **yapıldı** (tarayıcının `processLocally` API'si ile — Vosk gerekmedi) |
| 7 | Taranmış PDF için OCR | tesseract.js | ~yarım gün | Orta | ✅ **yapıldı** |
| 8 | Hikâyeyi sesli okuma | (tarayıcı `speechSynthesis`) | ~1 saat | Orta — kütüphane gerekmez | ✅ **yapıldı** |
| 9 | EPUB çıktısı | epub-gen | ~yarım gün | Düşük | ✅ **yapıldı** (epub-gen yerine sıfır bağımlılıkla `src/epub.js` — epubcheck 5.1.0: 0 hata) |
| 10 | Zengin metin editörü | tiptap | ~2 gün | Düşük — şimdilik gereksiz | ⬜ gerekmiyor |

**Lisans notu:** 1–9 arasındaki tüm projeler MIT / Apache-2.0 / BSD — ticari kapalı kaynak projede bile serbestçe kullanılabilir. GPL/AGPL olanlar (novelWriter, manuskript, vnlp, zemberek Java hariç) yalnızca fikir kaynağı.
