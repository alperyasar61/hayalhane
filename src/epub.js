'use strict';

// Sıfır ek bağımlılıkla EPUB 3 üretici (jszip dışında).
// Hikâye taslağını bölüm bölüm, sahne planını ve karakter kartlarını tek bir
// yeniden akıtılabilir (reflowable) EPUB dosyasına yazar.

const JSZip = require('jszip');

const XML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => XML_ESCAPES[ch]);
}

// EPUB içi dosya adları için güvenli, Türkçe karakterleri koruyan slug.
function slug(text, fallback) {
  const s = String(text || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıöşü]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' }[c]))
    .replace(/[âîû]/g, (c) => ({ â: 'a', î: 'i', û: 'u' }[c]))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return s || fallback;
}

function xhtmlPage(title, bodyHtml, lang) {
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}" lang="${lang}">
<head>
  <meta charset="utf-8" />
  <title>${esc(title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css" />
</head>
<body>
${bodyHtml}
</body>
</html>
`;
}

const STYLE_CSS = `@charset "utf-8";

body {
  font-family: Georgia, "Times New Roman", serif;
  line-height: 1.6;
  margin: 0 5%;
  text-align: justify;
  hyphens: auto;
}

h1, h2, h3 {
  font-family: "Segoe UI", Helvetica, Arial, sans-serif;
  line-height: 1.25;
  text-align: left;
  page-break-after: avoid;
}

h1 { font-size: 1.7em; margin: 1.2em 0 0.6em; }
h2 { font-size: 1.3em; margin: 1.4em 0 0.5em; }
h3 { font-size: 1.05em; margin: 1.2em 0 0.4em; }

p { margin: 0 0 0.85em; text-indent: 1.2em; }
p.noindent, .meta p, .card p { text-indent: 0; }

.title-page { text-align: center; margin-top: 22%; }
.title-page h1 { text-align: center; font-size: 2.1em; margin-bottom: 0.4em; }
.title-page .byline { font-style: italic; color: #666; text-indent: 0; }

.meta { font-size: 0.85em; color: #666; font-style: italic; margin-bottom: 0.9em; }
.meta p { margin: 0 0 0.2em; }

ul { margin: 0 0 0.9em 1.2em; padding: 0; }
li { margin-bottom: 0.3em; }

.card { margin-bottom: 1.6em; page-break-inside: avoid; }
.card h2 { margin-top: 0; }
.card .note { font-size: 0.9em; color: #555; }
.card .note p { text-indent: 0; margin-bottom: 0.3em; }

.scene { margin-bottom: 1.4em; page-break-inside: avoid; }
`;

// Taslağı paragraflara böler; çok uzun blokları cümle sınırından kırar.
function draftParagraphs(draft) {
  const out = [];
  for (const block of String(draft || '').split(/\n{2,}/)) {
    const text = block.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    out.push(text);
  }
  return out;
}

/**
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.author
 * @param {string} opts.language
 * @param {string} opts.draft
 * @param {Array}  opts.scenes
 * @param {Array}  opts.characters
 * @param {boolean} opts.includeScenes
 * @param {boolean} opts.includeCharacters
 * @returns {Promise<Buffer>}
 */
async function buildEpub(opts) {
  const {
    title = 'İsimsiz Hikâye',
    author = 'Hayalhâne',
    language = 'tr',
    draft = '',
    scenes = [],
    characters = [],
    includeScenes = true,
    includeCharacters = true,
  } = opts || {};

  const lang = /^[a-z]{2}(-[A-Za-z0-9]+)?$/.test(language) ? language : 'tr';
  const bookId = `urn:uuid:${require('crypto').randomUUID()}`;
  const modified = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  const chapters = []; // { id, href, title, html }
  const addChapter = (id, href, chapterTitle, bodyHtml) => {
    chapters.push({ id, href, title: chapterTitle, html: xhtmlPage(chapterTitle, bodyHtml, lang) });
  };

  // 1) Başlık sayfası
  addChapter(
    'titlepage',
    'title.xhtml',
    title,
    `<div class="title-page">
  <h1>${esc(title)}</h1>
  <p class="byline">${esc(author)}</p>
</div>`,
  );

  // 2) Hikâye metni — paragraflar
  const paras = draftParagraphs(draft);
  if (paras.length) {
    const body = paras.map((p) => `  <p>${esc(p)}</p>`).join('\n');
    addChapter('story', 'story.xhtml', 'Hikâye', `<h1>Hikâye</h1>\n${body}`);
  }

  // 3) Sahne planı
  if (includeScenes && scenes.length) {
    const parts = ['<h1>Sahne Planı</h1>'];
    scenes.forEach((s, i) => {
      const meta = [
        s.purpose,
        s.estimatedMinutes ? `~${s.estimatedMinutes} dk` : '',
        s.words ? `${s.words} kelime` : '',
      ].filter(Boolean);
      parts.push(`<div class="scene">`);
      parts.push(`  <h2>${i + 1}. ${esc(s.title || 'Sahne')}</h2>`);
      if (meta.length) parts.push(`  <div class="meta"><p>${esc(meta.join(' · '))}</p></div>`);
      if (s.summary) parts.push(`  <p class="noindent">${esc(s.summary)}</p>`);
      const beats = (s.beats || []).filter((b) => String(b || '').trim());
      if (beats.length) {
        parts.push('  <ul>');
        for (const beat of beats) parts.push(`    <li>${esc(beat)}</li>`);
        parts.push('  </ul>');
      }
      parts.push('</div>');
    });
    addChapter('scenes', 'scenes.xhtml', 'Sahne Planı', parts.join('\n'));
  }

  // 4) Karakter kartları
  if (includeCharacters && characters.length) {
    const parts = ['<h1>Karakterler</h1>'];
    for (const c of characters) {
      const name = [c.name, c.nickname ? `“${c.nickname}”` : ''].filter(Boolean).join(' ');
      const meta = [c.family, c.role === 'yan' ? 'Yan karakter' : 'Ana karakter'].filter(Boolean);
      parts.push('<div class="card">');
      parts.push(`  <h2>${esc(name || 'İsimsiz')}</h2>`);
      if (meta.length) parts.push(`  <div class="meta"><p>${esc(meta.join(' · '))}</p></div>`);
      if (c.description) parts.push(`  <p class="noindent">${esc(c.description)}</p>`);
      const feats = (c.features || []).filter((f) => f && (f.title || f.detail));
      if (feats.length) {
        parts.push('  <ul>');
        for (const f of feats) {
          parts.push(`    <li><strong>${esc(f.title || 'Özellik')}:</strong> ${esc(f.detail || '')}</li>`);
        }
        parts.push('  </ul>');
      }
      if (c.note) {
        const lines = String(c.note).split('\n').map((l) => l.trim()).filter(Boolean);
        if (lines.length) {
          parts.push('  <div class="note">');
          for (const line of lines) parts.push(`    <p>${esc(line)}</p>`);
          parts.push('  </div>');
        }
      }
      parts.push('</div>');
    }
    addChapter('characters', 'characters.xhtml', 'Karakterler', parts.join('\n'));
  }

  // Benzersiz dosya adları
  const used = new Set();
  for (const ch of chapters) {
    let href = ch.href;
    let n = 2;
    while (used.has(href)) {
      href = ch.href.replace(/\.xhtml$/, `-${n}.xhtml`);
      n += 1;
    }
    used.add(href);
    ch.href = href;
  }

  const zip = new JSZip();

  // mimetype — ilk ve sıkıştırılmamış olmalı
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  zip.folder('META-INF').file(
    'container.xml',
    `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml" />
  </rootfiles>
</container>
`,
  );

  const oebps = zip.folder('OEBPS');
  oebps.file('style.css', STYLE_CSS);

  const manifestItems = [
    '    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav" />',
    '    <item id="css" href="style.css" media-type="text/css" />',
  ];
  const spineItems = [];
  const navList = [];

  chapters.forEach((ch, i) => {
    oebps.file(ch.href, ch.html);
    manifestItems.push(`    <item id="${ch.id}" href="${ch.href}" media-type="application/xhtml+xml" />`);
    spineItems.push(`    <itemref idref="${ch.id}" />`);
    navList.push(`      <li><a href="${ch.href}">${esc(ch.title)}</a></li>`);
  });

  oebps.file(
    'nav.xhtml',
    `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}" lang="${lang}">
<head>
  <meta charset="utf-8" />
  <title>İçindekiler</title>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>İçindekiler</h1>
    <ol>
${navList.join('\n')}
    </ol>
  </nav>
</body>
</html>
`,
  );

  oebps.file(
    'content.opf',
    `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="${lang}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${bookId}</dc:identifier>
    <dc:title>${esc(title)}</dc:title>
    <dc:creator>${esc(author)}</dc:creator>
    <dc:language>${lang}</dc:language>
    <dc:description>Hayalhâne ile oluşturuldu</dc:description>
    <meta property="dcterms:modified">${modified}</meta>
  </metadata>
  <manifest>
${manifestItems.join('\n')}
  </manifest>
  <spine>
${spineItems.join('\n')}
  </spine>
</package>
`,
  );

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
}

module.exports = { buildEpub, slug };
