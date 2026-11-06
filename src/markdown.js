'use strict';

/**
 * Düz metni yapay zekânın rahat okuduğu Markdown'a çevirir.
 * Başlık, liste ve paragraf yapısını tahmin eder; satır sonu/boşluk gürültüsünü temizler.
 */

const HEADING_HINTS = /^(bölüm|bolum|kısım|kisim|perde|sahne|chapter|part|act|scene|prolog|epilog|önsöz|onsuz|giriş|giris|sonuç|sonuc)\b/i;

function isHeading(line) {
  const t = line.trim();
  if (!t) return false;
  if (/^#{1,6}\s/.test(t)) return true;
  if (t.length > 90) return false;
  if (/[.!?…,;:]$/.test(t)) return false;

  const letters = t.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g, '');
  if (letters.length >= 3 && letters === letters.toLocaleUpperCase('tr-TR')) return true;
  if (HEADING_HINTS.test(t)) return true;
  return false;
}

function isListItem(line) {
  return /^\s*([-*•·–—]|\d{1,2}[.)])\s+\S/.test(line);
}

function cleanLine(line) {
  return line
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function toMarkdown(rawText, filename = '') {
  const text = String(rawText || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b\u200c\u200d\ufeff]/g, '');

  const lines = text.split('\n').map(cleanLine);
  const out = [];
  let listBuffer = [];
  let paragraphBuffer = [];

  const flushList = () => {
    if (!listBuffer.length) return;
    out.push(listBuffer.join('\n'));
    listBuffer = [];
  };

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    out.push(paragraphBuffer.join(' '));
    paragraphBuffer = [];
  };

  const flushAll = () => {
    flushParagraph();
    flushList();
  };

  for (const line of lines) {
    if (!line) {
      flushAll();
      continue;
    }

    if (isHeading(line)) {
      flushAll();
      const level = /^#{1,6}\s/.test(line) ? line.match(/^#+/)[0].length : 2;
      const title = line.replace(/^#{1,6}\s*/, '').replace(/^[-*•·–—]\s*/, '').trim();
      out.push(`${'#'.repeat(Math.min(level, 4))} ${title}`);
      continue;
    }

    if (isListItem(line)) {
      flushParagraph();
      const item = line.replace(/^\s*([-*•·–—]|\d{1,2}[.)])\s+/, '').trim();
      listBuffer.push(`- ${item}`);
      continue;
    }

    flushList();
    paragraphBuffer.push(line);
  }
  flushAll();

  const body = out.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();

  const header = [
    '---',
    `kaynak: ${filename || 'yapıştırılan metin'}`,
    `dönüştürme: ${new Date().toISOString().slice(0, 10)}`,
    '---',
    '',
  ].join('\n');

  return header + body + '\n';
}

module.exports = { toMarkdown };
