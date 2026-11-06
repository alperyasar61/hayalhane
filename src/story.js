'use strict';

/**
 * Ham metni okunabilir "hikâye" biçimine getirir.
 * Noktalama düzeltir, cümle başlarını büyütür, uzun blokları paragraflara böler,
 * diyalogları em-dash + Türkçe tırnakla biçimlendirir.
 */

const HEADING_HINTS = /^(bölüm|bolum|kısım|kisim|perde|sahne|chapter|part|act|scene|prolog|epilog|önsöz|onsuz|giriş|giris|sonuç|sonuc)\b/i;
const SPEECH_VERB = /\b(dedi|diye|sordu|söyledi|bağırdı|fısıldadı|mırıldandı|haykırdı|yanıtladı|cevap verdi|ekledi|devam etti)\b/i;
const ABBREV = /\b(vb|vs|örn|bkz|dr|prof|no|sf|yy|mah|apt|sn)\.$/i;
const TERMINAL = /[.!?…]["'”’)\]]?$/;
const SCENE_BREAK = /^(\*{3,}|-{3,}|_{3,}|={3,})$/;

function cleanLine(line) {
  return line.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

function isHeadingLine(t) {
  if (!t) return false;
  if (/^#{1,6}\s/.test(t)) return true;
  if (t.length > 90) return false;
  if (/[.!?…,;:]$/.test(t)) return false;
  const letters = t.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g, '');
  if (letters.length >= 3 && letters === letters.toLocaleUpperCase('tr-TR')) return true;
  return HEADING_HINTS.test(t);
}

function fixPunctuation(s) {
  let t = s.replace(/\s+/g, ' ');
  t = t.replace(/\s+([,.;:!?…])/g, '$1');
  t = t.replace(/([,;:])(?=[^\s\d”’)\]])/g, '$1 ');
  t = t.replace(/([.!?…])(?=[A-ZÇĞİÖŞÜ])/g, '$1 ');
  t = t.replace(/\.{3,}/g, '…');
  t = t.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
  return t.trim();
}

function fixQuotes(s) {
  let open = true;
  let t = s.replace(/"/g, () => {
    const q = open ? '“' : '”';
    open = !open;
    return q;
  });
  t = t.replace(/“\s+/g, '“').replace(/\s+”/g, '”');
  return t;
}

function capitalizeSentences(s) {
  return s.replace(/(^|[.!?…]\s+|“\s*)([a-zçğıöşü])/g, (m, pre, ch) => pre + ch.toLocaleUpperCase('tr-TR'));
}

function ensureTerminal(s) {
  if (!s) return s;
  if (TERMINAL.test(s)) return s;
  if (/[,;:]$/.test(s)) return s.slice(0, -1) + '.';
  return s + '.';
}

function splitSentences(text) {
  const out = [];
  let buf = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    buf += ch;
    if (/[.!?…]/.test(ch)) {
      const next = text[i + 1];
      if (next === undefined || /\s/.test(next)) {
        const trimmed = buf.trim();
        if (!ABBREV.test(trimmed)) {
          out.push(trimmed);
          buf = '';
        }
      }
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out.filter(Boolean);
}

// Noktasız uzun cümleleri bağlaçlardan bölerek okunur hâle getirir.
const SPLIT_CONJ = /\s+(ama|fakat|ancak|lakin|oysa|çünkü|sonra|böylece|ardından|oysaki|meğer|yoksa|halbuki)\s+/gi;

function splitRunOn(sentence) {
  if (sentence.length < 110) return [sentence];
  const parts = [];
  let rest = sentence;
  let guard = 0;
  while (rest.length > 110 && guard++ < 12) {
    SPLIT_CONJ.lastIndex = 0;
    let best = null;
    let m;
    while ((m = SPLIT_CONJ.exec(rest))) {
      if (m.index > 40 && m.index < rest.length - 30) {
        best = m;
        break;
      }
    }
    if (!best) break;
    parts.push(rest.slice(0, best.index).trim());
    rest = rest.slice(best.index + best[0].length).trim();
  }
  if (rest) parts.push(rest);
  return parts.length ? parts : [sentence];
}

// Tırnak içi konuşmayı ayrı diyalog satırına çıkarır.
// Yalnızca konuşma fiiliyle (dedi, sordu…) birlikte gelen tırnaklar diyalog sayılır.
const QUOTE_RE = /["“]([^"”]{1,400})["”]/g;
const TAG_RE = /^\s*((?:diye\s+)?(?:dedi|sordu|söyledi|bağırdı|fısıldadı|mırıldandı|haykırdı|yanıtladı|cevap\s+verdi|ekledi|devam\s+etti)\b(?:\s+[A-ZÇĞİÖŞÜ][\wçğıöşü]{1,20})?)/;

function splitDialogue(sentences) {
  const lines = [];
  let narration = [];
  const flushNarration = () => {
    if (!narration.length) return;
    for (const p of chunkSentences(narration)) lines.push({ type: 'narration', text: p });
    narration = [];
  };

  for (const s of sentences) {
    if (!/["“”]/.test(s) || !SPEECH_VERB.test(s)) {
      narration.push(s);
      continue;
    }

    QUOTE_RE.lastIndex = 0;
    const matches = [...s.matchAll(QUOTE_RE)];
    if (!matches.length) {
      narration.push(s);
      continue;
    }

    let cursor = 0;
    for (const m of matches) {
      const before = s.slice(cursor, m.index).trim();
      if (before) narration.push(before);

      const afterQuote = s.slice(m.index + m[0].length);
      const tagMatch = afterQuote.match(TAG_RE);
      const tag = tagMatch ? tagMatch[1].trim() : '';
      const consumed = m.index + m[0].length + (tagMatch ? tagMatch[0].length : 0);

      flushNarration();
      lines.push({ type: 'dialogue', text: `“${m[1].trim()}”${tag ? ' ' + tag : ''}` });
      cursor = consumed;
    }

    const tail = s.slice(cursor).trim();
    if (tail) narration.push(tail);
  }
  flushNarration();
  return lines;
}

function chunkSentences(list, maxSentences = 4, maxChars = 480) {
  const paras = [];
  let cur = [];
  let len = 0;
  for (const s of list) {
    cur.push(s);
    len += s.length + 1;
    if (cur.length >= maxSentences || len >= maxChars) {
      paras.push(cur.join(' '));
      cur = [];
      len = 0;
    }
  }
  if (cur.length) paras.push(cur.join(' '));
  return paras;
}

function polish(s) {
  let t = fixQuotes(fixPunctuation(s));
  // Cümle sonunda asılı kalan bağlaç/edatları temizle ("… çıktı ve." → "… çıktı.")
  t = t.replace(/\s+(ve|veya|ama|fakat|ancak|ki|de|da|ile|için|gibi|çünkü|oysa|lakin)\s*([.!?…])$/i, '$2');
  t = t.replace(/\s+(ve|veya|ama|fakat|ancak|ki|çünkü|oysa|lakin)\s*$/i, '');
  return ensureTerminal(capitalizeSentences(t));
}

function toStory(rawText) {
  const text = String(rawText || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b\u200c\u200d\ufeff]/g, '');

  const lines = text.split('\n').map(cleanLine);
  const out = [];
  let para = [];
  let list = [];

  const flushPara = () => {
    if (!para.length) return;
    const joined = fixQuotes(fixPunctuation(para.join(' ')));
    const sentences = splitSentences(joined).flatMap(splitRunOn);
    for (const part of splitDialogue(sentences)) {
      out.push(part.type === 'dialogue' ? `— ${polish(part.text)}` : polish(part.text));
    }
    para = [];
  };

  const flushList = () => {
    if (!list.length) return;
    out.push(list.join('\n'));
    list = [];
  };

  const flushAll = () => {
    flushPara();
    flushList();
  };

  for (const line of lines) {
    if (!line) {
      flushAll();
      continue;
    }

    if (SCENE_BREAK.test(line)) {
      flushAll();
      out.push('---');
      continue;
    }

    if (isHeadingLine(line)) {
      flushAll();
      out.push(`## ${line.replace(/^#{1,6}\s*/, '').trim()}`);
      continue;
    }

    const isDash = /^[-–—]\s+/.test(line);
    const isBullet = /^[*•·]\s+/.test(line);
    const isNumbered = /^\d{1,2}[.)]\s+/.test(line);

    if (isDash || isBullet || isNumbered) {
      const body = line.replace(/^([-–—*•·]|\d{1,2}[.)])\s+/, '').trim();
      const isDialogue = isDash && (SPEECH_VERB.test(body) || /["“]/.test(body));
      if (isDialogue) {
        flushAll();
        out.push(`— ${polish(body)}`);
      } else {
        flushPara();
        list.push(`- ${body}`);
      }
      continue;
    }

    flushList();
    para.push(line);
  }
  flushAll();

  return out.join('\n\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

module.exports = { toStory };
