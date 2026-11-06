'use strict';

const crypto = require('crypto');

const SECTION_START = /^\s*1[.)]\s*Ana Karakterler/i;
const SECTION_END = /^\s*3[.)]\s*Aile Bağları/i;
const YAN_START = /^\s*2[.)]\s*Yan Karakterler/i;
const FAMILY_RE = /^([A-ZÇĞİÖŞÜ][A-Za-zÇĞİÖŞÜçğıöşü\s]{1,28}?)\s+Ailesi\s*$/;
const CHAR_RE = /^([A-ZÇĞİÖŞÜ][^:]{1,60}?)\s*:\s*(.{10,})$/;

const YAN_FAMILY = 'Yan Karakterler';

function splitName(raw) {
  const m = raw.match(/^(.+?)\s*[–—-]\s*(.+)$/);
  if (m) return { name: m[1].trim(), nickname: m[2].trim() };
  return { name: raw.trim(), nickname: '' };
}

// "Dede ve Babaanne" gibi birleşik başlıkları ayrı kişilere böler.
function splitPair(name) {
  if (/\s+ve\s+/i.test(name)) {
    return name.split(/\s+ve\s+/i).map((s) => s.trim()).filter(Boolean);
  }
  return [name];
}

function traitsFrom(description) {
  return description
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2 && s.length <= 110)
    .slice(0, 4);
}

// Takma ad varsa onu özellik başlığı yapar: "Anne" → başlık "Anne Terliği".
function featuresFrom(nickname, description) {
  return [{
    id: crypto.randomUUID(),
    title: nickname || 'Genel Özellik',
    detail: description,
  }];
}

function extractCharacters(text) {
  const lines = String(text || '').split(/\r?\n/);
  const out = [];
  const seen = new Set();
  let inSection = false;
  let role = 'ana';
  let family = '';

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (SECTION_START.test(line)) {
      inSection = true;
      role = 'ana';
      family = '';
      continue;
    }
    if (!inSection) continue;
    if (SECTION_END.test(line)) break;

    if (YAN_START.test(line)) {
      role = 'yan';
      family = YAN_FAMILY;
      continue;
    }

    const fam = line.match(FAMILY_RE);
    if (fam) {
      family = fam[1].trim();
      continue;
    }

    const cm = line.match(CHAR_RE);
    if (!cm) continue;

    const { name, nickname } = splitName(cm[1]);
    const description = cm[2].trim();
    const names = splitPair(name);

    for (const n of names) {
      const key = n.toLocaleLowerCase('tr-TR');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: crypto.randomUUID(),
        name: n,
        nickname,
        family: role === 'yan' ? YAN_FAMILY : family || 'Aile',
        role,
        storyId: null,
        description,
        features: featuresFrom(nickname, description),
        traits: traitsFrom(description),
        note: '',
        image: '',
        source: 'world',
      });
    }
  }

  return out;
}

module.exports = { extractCharacters, YAN_FAMILY };
