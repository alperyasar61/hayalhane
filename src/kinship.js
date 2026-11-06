'use strict';

// Dünya dosyasından aile bağlarını çıkarmaya çalışır.
//
// Kaynak belge bilinçli olarak sabit akrabalık unvanı vermiyor olabilir
// ("Akrabalık unvanları seçilen ana karakterin bakış açısına göre değişir").
// Bu yüzden burada uydurma yapılmaz: yalnızca metinde geçen kanıt cümleleri ve
// aile gruplarından çıkan kardeş/kuzen bilgisi öneri olarak döner. Kullanıcı
// notu dilediği gibi düzenleyebilir.

// Uzun kökler önce gelmeli: "anneanne" > "anne", "babaanne" > "baba".
const KIN_STEMS = [
  'anneanne', 'babaanne', 'büyükbaba', 'büyükanne',
  'kardeş', 'ağabey', 'kuzen', 'enişte', 'torun', 'yeğen',
  'anne', 'baba', 'abla', 'abi', 'dede', 'nine', 'hala',
  'teyze', 'amca', 'dayı', 'oğul', 'gelin', 'damat',
];

const KIN_LABEL = {
  anneanne: 'Anneanne',
  babaanne: 'Babaanne',
  büyükbaba: 'Büyükbaba',
  büyükanne: 'Büyükanne',
  kardeş: 'Kardeş',
  ağabey: 'Ağabey',
  kuzen: 'Kuzen',
  enişte: 'Enişte',
  torun: 'Torun',
  yeğen: 'Yeğen',
  anne: 'Anne',
  baba: 'Baba',
  abla: 'Abla',
  abi: 'Abi',
  dede: 'Dede',
  nine: 'Nine',
  hala: 'Hala',
  teyze: 'Teyze',
  amca: 'Amca',
  dayı: 'Dayı',
  oğul: 'Oğul',
  gelin: 'Gelin',
  damat: 'Damat',
};

// Akrabalık kelimesi gibi görünen ama akrabalık olmayan kalıplar
// (yer adı, lakap, başlık) — eşleşmeden önce maskelenir.
const MASK_PHRASES = [
  'dede ocağı', 'anne terliği', 'karadeniz kafası', 'gaza getirme',
  'gudalis', 'mikser', 'çay laboratuvarı',
];

const SECTION3 = /^\s*3[.)]\s*Aile Bağları/i;
const SECTION4 = /^\s*4[.)]\s*/;
const POV_CAVEAT = /bakış açısına göre|sabitlenmemiştir|değişebilir/i;

function lower(s) {
  return String(s || '').toLocaleLowerCase('tr-TR');
}

function maskPhrases(text) {
  let out = lower(text);
  for (const p of MASK_PHRASES) {
    out = out.split(p).join(' ');
  }
  return out;
}

function sentences(text) {
  return String(text || '')
    .split(/\r?\n/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((s) => s.trim())
    .filter((s) => s.length > 8);
}

// "Ceren" → metinde "Ceren'in", "Ceren'e" gibi ekli hâllerini de yakalar.
function namePattern(name) {
  const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu');
}

// En uzun akrabalık kökünü bulur; bulunan yeri maskeleyerek kısa köklerin
// aynı kelimeyi tekrar yakalamasını engeller ("büyükbaba" → "baba" olmaz).
function kinStemsIn(sentence) {
  let hay = maskPhrases(sentence);
  const found = [];
  for (const stem of KIN_STEMS) {
    if (!hay.includes(stem)) continue;
    found.push(stem);
    hay = hay.split(stem).join('\u0000');
  }
  return found;
}

function section3Text(text) {
  const lines = String(text || '').split(/\r?\n/);
  const out = [];
  let inside = false;
  for (const line of lines) {
    if (SECTION3.test(line)) { inside = true; continue; }
    if (inside && SECTION4.test(line)) break;
    if (inside) out.push(line);
  }
  return out.join('\n').trim();
}

// Bölüm 3'teki genel aile kuralları (torunluk, kardeş ailesi sayısı…).
function generalRules(text) {
  const body = section3Text(text);
  if (!body) return { rules: [], caveat: '' };
  const rules = [];
  const caveats = [];
  for (const s of sentences(body)) {
    if (POV_CAVEAT.test(s)) { caveats.push(s); continue; }
    if (!kinStemsIn(s).length) continue;
    rules.push(s);
  }
  return { rules, caveat: caveats.join(' ') };
}

// Akrabalık kökünün iyelik/eşdizim ekiyle geçtiği hâlleri arar:
// "annesine", "anneleri", "babası", "dedesinin"… Çıplak unvan ("Anne – Anne
// Terliği", "Dede Ocağı") bağ sayılmaz. Kelime bazlı çalışır ki "anneanne"
// içindeki "anne" ya da "babaanne" içindeki "baba" yanlış eşleşmesin.
// Eşleşen kelimeyi döndürür (yoksa null).
function possessiveHit(sentence, stem) {
  const words = maskPhrases(sentence).split(/[^a-zçğıöşü]+/u).filter(Boolean);
  for (const w of words) {
    if (!w.startsWith(stem) || w.length <= stem.length) continue;
    // Daha uzun bir akrabalık kökü de bu kelimenin başıysa asıl kök odur.
    if (KIN_STEMS.some((k) => k.length > stem.length && w.startsWith(k))) continue;
    return w;
  }
  return null;
}

// "Dede ve Babaanne: …" gibi iki akrabalık unvanını birlikte tanıtan
// başlıklarda kökün geçip geçmediğine bakar.
function pairHeadingHit(sentence, stem) {
  const hay = lower(sentence).trim();
  const m = hay.match(/^([a-zçğıöşü]+)\s+ve\s+([a-zçğıöşü]+)\s*:/u);
  if (!m) return false;
  return m[1] === stem || m[2] === stem;
}

// Karakter adı geçen cümlelerde akrabalık kökü varsa kanıt olarak toplar.
// Kendi adı akrabalık unvanı olan karakterlerde (Anne, Baba, Dede…) metin
// "annesinin", "dedesinin" gibi ekli yazdığı için isim eşleşmesi yerine
// iyelikli kök ya da "Dede ve Babaanne:" başlığına bakılır. Böylece
// "Anne – Anne Terliği" gibi lakap başlıkları bağ sayılmaz.
function tiesFor(name, allSentences, otherNames) {
  const re = namePattern(name);
  const selfStem = lower(name);
  const selfIsKin = KIN_STEMS.includes(selfStem);
  const others = (otherNames || []).filter((n) => n !== name);
  const out = [];
  const seen = new Set();
  for (const s of allSentences) {
    const stems = kinStemsIn(s);
    if (!stems.length) continue;
    const hit = selfIsKin
      ? possessiveHit(s, selfStem) || pairHeadingHit(s, selfStem)
      : re.test(s);
    if (!hit) continue;
    const key = lower(s);
    if (seen.has(key)) continue;
    seen.add(key);
    // Unvan adlı karakterlerde "Anne — …" tekrarı yerine bağın kime
    // olduğunu gösteren karşı tarafın adı yazılır.
    const labels = selfIsKin
      ? others.filter((n) => namePattern(n).test(s)).slice(0, 2)
      : stems.map((k) => KIN_LABEL[k] || k);
    out.push({
      labels: labels.length ? labels : ['Aile'],
      kinSelf: selfIsKin,
      evidence: s,
    });
  }
  return out;
}

function extractKinships(text, names) {
  const all = sentences(text);
  const list = (Array.isArray(names) ? names : []).filter(Boolean);
  const { rules, caveat } = generalRules(text);

  // Bakış açısı uyarısı bir bağ değil, kuraldır; kanıt olarak kullanılmaz.
  const caveatSentences = new Set(sentences(caveat).map(lower));
  const evidence = all.filter((s) => !caveatSentences.has(lower(s)));

  const byName = {};
  for (const name of list) {
    const ties = tiesFor(name, evidence, list);
    if (ties.length) byName[name] = ties;
  }

  return { general: rules, caveat, byName };
}

function clip(s, max) {
  const t = String(s || '').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

// Karakterin aile grubundan kardeş/kuzen çıkarımı + metin kanıtları.
// Dönen metin doğrudan "Aile bağları / notlar" alanına yazılabilir.
function buildNote(character, characters, kinships) {
  const lines = [];
  const isAna = character.role !== 'yan';
  const sameFamily = characters.filter(
    (c) => c.id !== character.id && c.family && c.family === character.family && c.role !== 'yan',
  );
  const cousins = isAna
    ? characters.filter((c) => c.id !== character.id && c.role !== 'yan' && c.family !== character.family)
    : [];

  if (sameFamily.length) {
    lines.push(`Kardeş: ${sameFamily.map((c) => c.name).join(', ')} (${character.family} ailesi).`);
  }
  if (cousins.length) {
    lines.push(`Kuzenler: ${cousins.map((c) => c.name).join(', ')}.`);
  }

  const ties = (kinships && kinships.byName && kinships.byName[character.name]) || [];
  for (const tie of ties.slice(0, 3)) {
    const label = [...new Set(tie.labels)].join(' / ');
    lines.push(`${label} — “${clip(tie.evidence, 150)}”`);
  }

  return lines.join('\n');
}

module.exports = { extractKinships, buildNote, generalRules, KIN_LABEL };
