'use strict';

const crypto = require('crypto');

const STOPWORDS = new Set([
  'ama', 'ancak', 'fakat', 'lakin', 'çünkü', 'eğer', 'şey', 'şeyi', 'şeyler', 'bunu', 'şunu',
  'sonra', 'önce', 'şimdi', 'burada', 'orada', 'böyle', 'şöyle', 'kadar', 'gibi', 'için',
  'diye', 'belki', 'yine', 'artık', 'hemen', 'bütün', 'herkes', 'hiçbir', 'birşey',
  'evet', 'hayır', 'tamam', 'peki', 'işte', 'yani', 'üzere', 'dolayı', 'rağmen', 'bile',
  'kendi', 'diğer', 'bazı', 'birçok', 'hep', 'asla', 'sadece', 'yalnız', 'yoksa', 'madem',
  'bölüm', 'sahne', 'perde', 'son', 'başlangıç', 'giriş', 'final', 'özet', 'not',
]);

const GENRES = [
  { name: 'Fantastik', words: ['ejderha', 'büyü', 'sihir', 'kral', 'krallık', 'elf', 'cüce', 'kılıç', 'büyücü', 'lanet', 'kehanet', 'tanrı', 'tapınak', 'kale', 'orman'] },
  { name: 'Bilim Kurgu', words: ['uzay', 'gezegen', 'robot', 'yapay zeka', 'yıldız', 'koloni', 'android', 'galaksi', 'istasyon', 'gemi', 'ışın', 'siber', 'nöral', 'veri'] },
  { name: 'Korku', words: ['kan', 'karanlık', 'hayalet', 'cin', 'korku', 'çığlık', 'ceset', 'gölge', 'mezar', 'fısıltı', 'lanetli', 'bodrum'] },
  { name: 'Polisiye / Gerilim', words: ['cinayet', 'dedektif', 'ipucu', 'şüpheli', 'polis', 'silah', 'kayıp', 'soruşturma', 'tanık', 'dosya', 'kaçış', 'takip'] },
  { name: 'Dram', words: ['aile', 'anne', 'baba', 'aşk', 'ayrılık', 'hastalık', 'ölüm', 'özlem', 'çocuk', 'ev', 'mektup', 'hatıra'] },
  { name: 'Macera', words: ['yolculuk', 'hazine', 'harita', 'ada', 'dağ', 'gemi', 'kaçış', 'tuzak', 'mağara', 'çöl', 'nehir', 'fırtına'] },
];

const CONFLICT_WORDS = ['ama', 'ancak', 'fakat', 'savaş', 'kaç', 'kavga', 'tehdit', 'engel', 'kaybet', 'ölüm', 'korku', 'sır', 'yasak', 'çatışma', 'kriz', 'saldır', 'kırıl', 'patla', 'yanlış', 'hata', 'borç'];
const SENSORY_WORDS = ['koku', 'ses', 'soğuk', 'sıcak', 'ışık', 'gölge', 'rüzgar', 'rüzgâr', 'tuz', 'nem', 'acı', 'tatlı', 'pürüz', 'çınlama', 'uğultu', 'ten', 'nefes'];

function normalize(s) {
  return s.toLocaleLowerCase('tr-TR');
}

function words(text) {
  return text.trim().split(/\s+/).filter(Boolean);
}

function sentences(text) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function countHits(text, list) {
  const low = normalize(text);
  let hits = 0;
  const found = [];
  for (const w of list) {
    const re = new RegExp(`(^|[^a-zçğıöşü])${w}`, 'g');
    const m = low.match(re);
    if (m) {
      hits += m.length;
      found.push(w);
    }
  }
  return { hits, found };
}

function extractCharacters(text) {
  const counts = new Map();
  const re = /\b[A-ZÇĞİÖŞÜ][a-zçğıöşü]{2,}\b/g;
  let m;
  while ((m = re.exec(text))) {
    const w = m[0];
    const low = normalize(w);
    if (STOPWORDS.has(low)) continue;
    // Aynı kelime metinde küçük harfle de geçiyorsa sıradan bir kelimedir.
    if (new RegExp(`(^|[^A-Za-zÇĞİÖŞÜçğıöşü])${low}(?![a-zçğıöşü])`).test(text)) continue;
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));
}

function detectGenre(text) {
  const scored = GENRES.map((g) => ({ name: g.name, score: countHits(text, g.words).hits }))
    .sort((a, b) => b.score - a.score);
  const top = scored[0];
  if (!top || top.score === 0) return { genre: 'Belirsiz', confidence: 0, alternatives: [] };
  const total = scored.reduce((s, x) => s + x.score, 0) || 1;
  return {
    genre: top.name,
    confidence: Math.round((top.score / total) * 100),
    alternatives: scored.slice(1, 3).filter((s) => s.score > 0).map((s) => s.name),
  };
}

function hasDialogue(text) {
  return /[""«»]|^\s*[-—]\s+/m.test(text);
}

function analyze(text, worldText) {
  const clean = (text || '').trim();
  const w = words(clean);
  const s = sentences(clean);
  const paragraphs = clean.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const genre = detectGenre(clean + ' ' + (worldText || ''));
  const characters = extractCharacters(clean);
  const conflict = countHits(clean, CONFLICT_WORDS);
  const sensory = countHits(clean, SENSORY_WORDS);
  const dialogue = hasDialogue(clean);

  const strengths = [];
  const issues = [];
  const suggestions = [];
  const questions = [];

  if (w.length < 40) {
    issues.push('Metin çok kısa; çatışma ve karakter kurulumu için yeterli malzeme yok.');
    suggestions.push({
      type: 'tempo',
      title: 'Açılışı üç cümleyle netleştir',
      detail: 'Kim, nerede, ne istiyor? İlk üç cümlede bu üç sorunun cevabı görünmeli. Şu an metin bunu henüz kurmuyor.',
    });
  } else {
    strengths.push(`Sağlam bir hacim var: ${w.length} kelime, ${s.length} cümle, ${paragraphs.length} paragraf.`);
  }

  if (characters.length >= 2) {
    strengths.push(`İsimleri tekrar eden ${characters.length} karakter tespit edildi: ${characters.map((c) => c.name).join(', ')}.`);
  } else if (characters.length === 1) {
    issues.push('Sadece tek bir isimli karakter var; sahne tek kişilik monolog gibi duruyor.');
    suggestions.push({
      type: 'karakter',
      title: 'Karşıt bir figür ekle',
      detail: `${characters[0].name} için bir engel/karşıt güç tanımla. Karşıt figür, karakterin neyi kaybetmekten korktuğunu görünür kılar.`,
    });
  } else {
    issues.push('İsimlendirilmiş karakter bulunamadı; okuyucu kime bağlanacağını bilemiyor.');
    suggestions.push({
      type: 'karakter',
      title: 'Ana karaktere isim ve tek bir arzu ver',
      detail: 'Bir isim + tek cümlelik bir istek ("... elde etmek istiyor") yaz. Bu, sonraki tüm sahnelerin motoru olur.',
    });
  }

  if (conflict.hits === 0) {
    issues.push('Belirgin bir çatışma sinyali yok; sahne bilgi aktarımı gibi akıyor.');
    suggestions.push({
      type: 'sahne',
      title: 'Tetikleyici olayı öne çek',
      detail: 'Hikayeyi başlatan olayı (kayıp, tehdit, yasak, yanlış anlaşılma) ilk sahneye taşı. Seyirci "şimdi ne olacak?" sorusunu sormalı.',
    });
  } else {
    strengths.push(`Çatışma izleri mevcut (${conflict.found.slice(0, 4).join(', ')}).`);
  }

  if (!dialogue) {
    issues.push('Diyalog yok; her şey anlatıcı üzerinden aktarılıyor.');
    suggestions.push({
      type: 'diyalog',
      title: 'Tek bir replikle sahneyi canlandır',
      detail: 'En gergin ana 2-3 satırlık bir konuşma ekle. Replikler bilgi vermek yerine karakterin neyi sakladığını göstersin.',
    });
  } else {
    strengths.push('Diyalog kullanılmış; sahne nefes alıyor.');
  }

  if (sensory.hits < 3) {
    issues.push('Duyusal detay az; mekân zihinde canlanmıyor.');
    suggestions.push({
      type: 'dünya',
      title: 'Mekâna üç duyu ekle',
      detail: 'Bir koku, bir ses, bir dokunma hissi. Üçünü tek paragrafta kullan; atmosfer anında yoğunlaşır.',
    });
  } else {
    strengths.push(`Duyusal dokunuşlar var (${sensory.found.slice(0, 4).join(', ')}).`);
  }

  if (genre.confidence >= 40) {
    strengths.push(`Tür eğilimi net: ${genre.genre} (%${genre.confidence}).`);
  } else {
    questions.push('Bu hikâye hangi türde? Türü netleştirirsek önerileri ona göre keskinleştirebilirim.');
  }

  if (worldText && worldText.trim().length > 0) {
    strengths.push('Dünya dosyası yüklü; öneriler bu evrene göre filtreleniyor.');
  } else {
    questions.push('Bir dünya dosyası (evren, kurallar, karakter listesi) yüklemek ister misin? Öneriler çok daha isabetli olur.');
  }

  questions.push('Bu sahneden sonra karakterin hayatında ne değişiyor? Değişmiyorsa sahne kesilebilir.');
  questions.push('Seyircinin bu sahnede merak ettiği tek şey ne?');

  const summary = s.slice(0, 2).join(' ') || 'Metin boş.';
  const hero = characters[0] ? characters[0].name : 'Kahraman';

  const drafts = {
    tempo: `\n\n${hero} durdu. Nerede olduğunu biliyordu ama neden burada olduğunu artık hatırlamıyordu.`,
    karakter: `\n\n${hero} bir şeyi istiyordu ve bunu elde etmek için elindeki tek şeyi riske atmaya hazırdı.`,
    sahne: `\n\nO anda olmaması gereken bir şey oldu: kapı kendiliğinden açıldı.`,
    diyalog: `\n\n— Bunu yapmak zorunda değilsin, dedi ses. ${hero} cevap vermedi.`,
    dünya: `\n\nHavada ıslak taş ve duman kokusu vardı; uzaktan gelen uğultu, duvarların içinde bir şeyin hareket ettiğini söylüyordu.`,
  };

  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    stats: {
      words: w.length,
      sentences: s.length,
      paragraphs: paragraphs.length,
      characters: characters.length,
      readingMinutes: Math.max(1, Math.round(w.length / 180)),
    },
    genre,
    summary,
    characters,
    strengths,
    issues,
    questions,
    suggestions: suggestions.map((x) => ({ id: crypto.randomUUID(), status: 'pending', draft: drafts[x.type] || '', ...x })),
  };
}

const MARKER_RE = /^(\*{3,}|-{3,}|#{1,6}\s|bölüm\b|sahne\b|perde\b|prolog\b|epilog\b)/i;

function purposeOf(block) {
  const low = normalize(block);
  if (/(savaş|kavga|çatışma|saldır|kaç|kovala)/.test(low)) return 'Çatışma / aksiyon';
  if (/(söyle|sor|fısılda|bağır|cevap|konuş)/.test(low)) return 'Diyalog / bilgi açığa çıkışı';
  if (/(hatırla|anımsa|geçmiş|çocukken|yıllar önce)/.test(low)) return 'Geri dönüş / geçmiş';
  if (/(karar|seç|artık|yeter|vazgeç)/.test(low)) return 'Dönüm noktası / karar';
  if (/(geldi|vardı|girdi|açtı|baktı|yürüdü)/.test(low)) return 'Kurulum / atmosfer';
  return 'Gelişme';
}

function breakdown(text) {
  const clean = (text || '').trim();
  if (!clean) return [];

  let blocks = clean.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  if (blocks.length === 1) {
    const s = sentences(clean);
    blocks = [];
    for (let i = 0; i < s.length; i += 4) blocks.push(s.slice(i, i + 4).join(' '));
  }

  const groups = [];
  let current = { title: null, blocks: [] };

  const flush = () => {
    if (current.blocks.length || current.title) groups.push(current);
    current = { title: null, blocks: [] };
  };

  for (const b of blocks) {
    if (MARKER_RE.test(b) && b.length < 90) {
      flush();
      current.title = b.replace(/^[#*\-\s]+/, '').trim();
      continue;
    }
    current.blocks.push(b);
    if (current.blocks.length >= 2) flush();
  }
  flush();

  return groups.map((g, idx) => {
    const body = g.blocks.join('\n\n');
    const s = sentences(body);
    const title = g.title || makeTitle(s[0], idx);
    const beats = g.blocks.slice(0, 5).map((b) => {
      const first = sentences(b)[0] || b;
      return first.length > 160 ? first.slice(0, 160) + '…' : first;
    });
    const wc = words(body).length;
    return {
      id: crypto.randomUUID(),
      title,
      summary: s.slice(0, 2).join(' ').slice(0, 400),
      beats,
      purpose: purposeOf(body),
      estimatedMinutes: Math.max(1, Math.round(wc / 180)),
      words: wc,
      source: 'ai',
    };
  });
}

function makeTitle(sentence, idx) {
  if (!sentence) return `Sahne ${idx + 1}`;
  let t = sentence
    .replace(/^[—–\-*•·\s]+/, '')
    .replace(/^[“"']+|[”"']+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return `Sahne ${idx + 1}`;
  const cut = t.slice(0, 58);
  t = cut.length < t.length ? cut.replace(/\s+\S*$/, '') + '…' : cut;
  return t.charAt(0).toLocaleUpperCase('tr-TR') + t.slice(1);
}

module.exports = { analyze, breakdown };
