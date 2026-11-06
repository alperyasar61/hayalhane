'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const mammoth = require('mammoth');
const { analyze, breakdown } = require('./src/analyzer');
const { toMarkdown } = require('./src/markdown');
const { toStory } = require('./src/story');
const { extractCharacters } = require('./src/characters');
const { extractKinships, buildNote } = require('./src/kinship');
const { buildEpub } = require('./src/epub');
const llm = require('./src/llm');

const app = express();
const PORT = process.env.PORT || 4173;
const DATA_DIR = path.join(__dirname, 'data');
const PROJECT_FILE = path.join(DATA_DIR, 'project.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const BACKUP_KEEP = 40;

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(BACKUP_DIR, { recursive: true });

app.use(express.json({ limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Tarayıcıda kullanılan kütüphaneler node_modules'ten servis edilir.
const VENDOR = {
  'cytoscape.min.js': 'cytoscape/dist/cytoscape.min.js',
  'fuse.min.mjs': 'fuse.js/dist/fuse.min.mjs',
  'tesseract.min.js': 'tesseract.js/dist/tesseract.min.js',
  'tesseract-worker.min.js': 'tesseract.js/dist/worker.min.js',
  'sortable.min.js': 'sortablejs/Sortable.min.js',
};
app.get('/vendor/:file', (req, res, next) => {
  const rel = VENDOR[req.params.file];
  if (!rel) return next();
  res.sendFile(path.join(__dirname, 'node_modules', rel), (err) => {
    if (err) next(err);
  });
});

function readProject() {
  try {
    return JSON.parse(fs.readFileSync(PROJECT_FILE, 'utf8'));
  } catch {
    return { world: null, draft: '', scenes: [], characters: [], stories: [], activeStoryId: null, notes: [], updatedAt: null };
  }
}

// Projedeki toplam yazı/sahne miktarı — veri kaybı koruması için.
function contentWeight(project) {
  const stories = Array.isArray(project && project.stories) ? project.stories : [];
  let chars = 0;
  let scenes = 0;
  for (const s of stories) {
    chars += typeof s.draft === 'string' ? s.draft.trim().length : 0;
    scenes += Array.isArray(s.scenes) ? s.scenes.length : 0;
  }
  return { chars, scenes };
}

function pruneBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('project-') && f.endsWith('.json'))
      .sort();
    for (const f of files.slice(0, Math.max(0, files.length - BACKUP_KEEP))) {
      fs.unlinkSync(path.join(BACKUP_DIR, f));
    }
  } catch { /* yedek temizliği kritik değil */ }
}

function backupProject(raw) {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.writeFileSync(path.join(BACKUP_DIR, `project-${stamp}.json`), raw, 'utf8');
    pruneBackups();
  } catch { /* yedekleme başarısız olsa da kayıt devam etsin */ }
}

// Önce geçici dosyaya yaz, sonra taşı: yarım kalan yazma projeyi bozmaz.
function writeProject(project) {
  project.updatedAt = new Date().toISOString();
  const json = JSON.stringify(project, null, 2);
  const tmp = `${PROJECT_FILE}.tmp`;
  fs.writeFileSync(tmp, json, 'utf8');
  fs.renameSync(tmp, PROJECT_FILE);
  return project;
}

function normalizeStory(raw, index) {
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    id: typeof s.id === 'string' && s.id ? s.id : require('crypto').randomUUID(),
    // Başlığı kullanıcı verir; boş bırakılabilir.
    title: typeof s.title === 'string' ? s.title.trim() : '',
    draft: typeof s.draft === 'string' ? s.draft : '',
    scenes: Array.isArray(s.scenes) ? s.scenes : [],
  };
}

function normalizeCharacter(raw, stories, backfill = false) {
  const char = raw && typeof raw === 'object' ? raw : {};
  const ids = new Set((stories || []).map((s) => s.id));
  let features = Array.isArray(char.features) ? char.features : [];
  // Eski kayıtlarda özellik yok: takma adı başlık yapıp tanıtımı gövdeye koy.
  if (backfill && !features.length && (char.nickname || char.description)) {
    features = [{
      id: require('crypto').randomUUID(),
      title: char.nickname || 'Genel Özellik',
      detail: char.description || '',
    }];
  }
  return {
    ...char,
    storyId: typeof char.storyId === 'string' && ids.has(char.storyId) ? char.storyId : (stories[0] ? stories[0].id : null),
    features,
    image: typeof char.image === 'string' ? char.image : '',
  };
}

// Eski tek hikâyeli kayıtları yeni çok hikâyeli yapıya taşır.
function migrate(project) {
  const p = project && typeof project === 'object' ? project : {};
  if (!Array.isArray(p.stories) || !p.stories.length) {
    const id = require('crypto').randomUUID();
    p.stories = [{
      id,
      title: '',
      draft: typeof p.draft === 'string' ? p.draft : '',
      scenes: Array.isArray(p.scenes) ? p.scenes : [],
    }];
    p.activeStoryId = id;
  }
  p.stories = p.stories.map(normalizeStory);
  if (!p.stories.some((s) => s.id === p.activeStoryId)) p.activeStoryId = p.stories[0].id;

  p.characters = (Array.isArray(p.characters) ? p.characters : []).map((c) => normalizeCharacter(c, p.stories, true));
  if (!Array.isArray(p.notes)) p.notes = [];
  return p;
}

app.get('/api/project', (req, res) => {
  res.json(migrate(readProject()));
});

app.put('/api/project', (req, res) => {
  const incoming = req.body || {};
  const stories = Array.isArray(incoming.stories) ? incoming.stories.map(normalizeStory) : [];
  const activeStoryId = stories.some((s) => s.id === incoming.activeStoryId)
    ? incoming.activeStoryId
    : (stories[0] ? stories[0].id : null);
  const active = stories.find((s) => s.id === activeStoryId) || null;

  const project = {
    world: incoming.world ?? null,
    stories,
    activeStoryId,
    characters: (Array.isArray(incoming.characters) ? incoming.characters : []).map((c) => normalizeCharacter(c, stories)),
    // Üst seviye alanlar etkin hikâyenin kopyasıdır (eski istemciler için).
    draft: active ? active.draft : '',
    scenes: active ? active.scenes : [],
    notes: Array.isArray(incoming.notes) ? incoming.notes : [],
  };

  // Kayıt öncesi: diskteki kopya daha doluysa yedekle (yanlışlıkla veri kaybını önler).
  try {
    const raw = fs.readFileSync(PROJECT_FILE, 'utf8');
    const before = contentWeight(JSON.parse(raw));
    const after = contentWeight(project);
    if (before.chars > after.chars || before.scenes > after.scenes) backupProject(raw);
  } catch { /* dosya yoksa yedeklenecek bir şey de yok */ }

  res.json(writeProject(project));
});

app.get('/api/backups', (req, res) => {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('project-') && f.endsWith('.json'))
      .sort()
      .reverse();
    res.json(files.map((f) => {
      const full = path.join(BACKUP_DIR, f);
      let weight = { chars: 0, scenes: 0 };
      let stories = 0;
      try {
        const p = JSON.parse(fs.readFileSync(full, 'utf8'));
        weight = contentWeight(p);
        stories = Array.isArray(p.stories) ? p.stories.length : 0;
      } catch { /* bozuk yedek: yine de listele */ }
      return {
        file: f,
        size: fs.statSync(full).size,
        savedAt: fs.statSync(full).mtime.toISOString(),
        stories,
        chars: weight.chars,
        scenes: weight.scenes,
      };
    }));
  } catch {
    res.json([]);
  }
});

app.post('/api/backups/restore', (req, res) => {
  const file = typeof (req.body || {}).file === 'string' ? path.basename(req.body.file) : '';
  if (!file || !/^project-[\w.-]+\.json$/.test(file)) {
    return res.status(400).json({ error: 'Geçersiz yedek dosyası.' });
  }
  const full = path.join(BACKUP_DIR, file);
  if (!fs.existsSync(full)) return res.status(404).json({ error: 'Yedek bulunamadı.' });
  try {
    const restored = JSON.parse(fs.readFileSync(full, 'utf8'));
    // Geri yüklemeden önce mevcut durumu da yedekle.
    try { backupProject(fs.readFileSync(PROJECT_FILE, 'utf8')); } catch { /* yok */ }
    res.json(migrate(writeProject(restored)));
  } catch {
    res.status(422).json({ error: 'Yedek dosyası okunamadı.' });
  }
});

app.get('/api/engine', (req, res) => {
  res.json(llm.providerInfo());
});

// Tüm projeyi tek dosya olarak indir — disk arızası / makine değişimi için.
app.get('/api/project/export', (req, res) => {
  const project = migrate(readProject());
  const stamp = new Date().toISOString().slice(0, 10);
  const body = JSON.stringify({ format: 'hayalhane-project', version: 1, exportedAt: new Date().toISOString(), project }, null, 2);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="hayalhane-yedek-${stamp}.json"`);
  res.send(body);
});

// Dışa aktarılan projeyi geri yükle. Mevcut durum önce yedeklenir.
app.post('/api/project/import', (req, res) => {
  const body = req.body || {};
  const incoming = body.project && typeof body.project === 'object' ? body.project : body;
  if (!incoming || typeof incoming !== 'object' || (!incoming.stories && !incoming.characters && !incoming.world)) {
    return res.status(400).json({ error: 'Bu dosya bir Hayalhâne yedeği gibi görünmüyor.' });
  }
  try {
    try { backupProject(fs.readFileSync(PROJECT_FILE, 'utf8')); } catch { /* yok */ }
    res.json(migrate(writeProject(incoming)));
  } catch {
    res.status(422).json({ error: 'Yedek dosyası okunamadı.' });
  }
});

app.post('/api/analyze', async (req, res) => {
  const { text, worldText } = req.body || {};
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Analiz için metin gerekli.' });
  }

  const local = analyze(text, worldText || '');
  const remote = await llm.review(text, worldText || '');

  if (remote) {
    local.engine = llm.providerInfo().provider;
    if (remote.summary) local.summary = String(remote.summary);
    if (remote.genre) local.genre = { ...local.genre, genre: String(remote.genre) };
    if (Array.isArray(remote.strengths)) local.strengths = remote.strengths.map(String);
    if (Array.isArray(remote.issues)) local.issues = remote.issues.map(String);
    if (Array.isArray(remote.questions)) local.questions = remote.questions.map(String);
    if (Array.isArray(remote.suggestions) && remote.suggestions.length) {
      local.suggestions = remote.suggestions.slice(0, 4).map((s) => ({
        id: require('crypto').randomUUID(),
        status: 'pending',
        type: String(s.type || 'sahne'),
        title: String(s.title || 'Öneri'),
        detail: String(s.detail || ''),
        draft: s.draft ? `\n\n${String(s.draft).trim()}` : '',
      }));
    }
  } else {
    local.engine = 'mock';
  }

  res.json(local);
});

app.post('/api/breakdown', (req, res) => {
  const { text } = req.body || {};
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Sahneleme için metin gerekli.' });
  }
  res.json({ scenes: breakdown(text) });
});

// Yüklenen dosyadan düz metin çıkarır (.docx / .pdf / düz metin).
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tif', '.tiff']);

// Taranmış PDF veya resimlerden OCR ile metin çıkarır (tesseract.js, tur+eng).
// Dil verisi ve çekirdek tamamen yerelden yüklenir; hiçbir şey indirilmez.
async function ocrImage(buf) {
  const { createWorker } = require('tesseract.js');
  const worker = await createWorker(['tur', 'eng'], 1, {
    langPath: path.join(__dirname, 'assets', 'tessdata'),
    cachePath: path.join(__dirname, 'assets', 'tessdata'),
    gzip: false,
    cacheMethod: 'none',
    logger: () => {},
  });
  try {
    const { data } = await worker.recognize(buf);
    return data.text || '';
  } finally {
    await worker.terminate();
  }
}

async function readDocument(buf, ext) {
  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ buffer: buf });
    return result.value;
  }
  if (ext === '.pdf') {
    const { PDFParse } = require('pdf-parse');
    const parser = new PDFParse({ data: new Uint8Array(buf) });
    let text = '';
    try {
      const result = await parser.getText({ pageJoiner: '\n\n' });
      text = result.text || '';
    } finally {
      await parser.destroy();
    }
    // Metin katmanı yoksa (taranmış PDF) OCR'a düş.
    if (text.replace(/\s+/g, '').length < 20) {
      const ocr = await ocrImage(buf);
      if (ocr.trim()) return ocr;
    }
    return text;
  }
  if (IMAGE_EXTS.has(ext)) {
    return ocrImage(buf);
  }
  if (ext === '.doc') {
    throw Object.assign(new Error('Eski .doc formatı desteklenmiyor. Lütfen .docx olarak kaydet.'), { status: 415 });
  }
  return buf.toString('utf8');
}

app.post('/api/world', express.raw({ type: '*/*', limit: '25mb' }), async (req, res) => {
  const filename = String(req.query.filename || 'world.txt');
  const ext = path.extname(filename).toLowerCase();
  const buf = req.body;

  if (!buf || !buf.length) {
    return res.status(400).json({ error: 'Dosya boş.' });
  }

  try {
    let text = await readDocument(buf, ext);

    text = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!text) {
      return res.status(422).json({ error: 'Dosyadan metin çıkarılamadı.' });
    }

    const markdown = toMarkdown(text, filename);
    const story = toStory(text);

    const project = readProject();
    project.world = {
      filename,
      chars: text.length,
      words: text.trim().split(/\s+/).length,
      text,
      markdown,
      story,
      loadedAt: new Date().toISOString(),
    };
    writeProject(project);

    res.json({
      filename,
      chars: text.length,
      words: project.world.words,
      text,
      markdown,
      story,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: `Dosya okunamadı: ${err.message}` });
  }
});

// Hikâye dosyasını (Word/PDF/metin) düz metne çevirir; dünya dosyasına dokunmaz.
app.post('/api/document', express.raw({ type: '*/*', limit: '25mb' }), async (req, res) => {
  const filename = String(req.query.filename || 'hikaye.txt');
  const ext = path.extname(filename).toLowerCase();
  const buf = req.body;
  if (!buf || !buf.length) return res.status(400).json({ error: 'Dosya boş.' });
  try {
    let text = await readDocument(buf, ext);
    text = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!text) return res.status(422).json({ error: 'Dosyadan metin çıkarılamadı.' });
    res.json({ filename, text, chars: text.length, words: text.split(/\s+/).filter(Boolean).length });
  } catch (err) {
    res.status(err.status || 500).json({ error: `Dosya okunamadı: ${err.message}` });
  }
});

// Türkçe aksansız yazılmış metni aksanlı hâle çevirir (deasciify).
// "Kardesim ogretmen dedi" -> "Kardeşim öğretmen dedi"
app.post('/api/deasciify', (req, res) => {
  const { text } = req.body || {};
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Düzeltmek için metin gerekli.' });
  }
  const Deasciifier = require('turkish-deasciifier');
  const d = new Deasciifier();
  const fixed = d.deasciify(text);
  res.json({ text: fixed, changed: fixed !== text });
});

app.post('/api/markdown', (req, res) => {  const { text, filename } = req.body || {};
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Dönüştürmek için metin gerekli.' });
  }
  res.json({ markdown: toMarkdown(text, filename || '') });
});

app.post('/api/story', (req, res) => {
  const { text } = req.body || {};
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Hikâyeleştirmek için metin gerekli.' });
  }
  res.json({ story: toStory(text) });
});

app.post('/api/characters', (req, res) => {
  const { text } = req.body || {};
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Karakter çıkarmak için metin gerekli.' });
  }
  res.json({ characters: extractCharacters(text) });
});

// Aile bağlarını dünya metninden çıkarır ve her karakter için öneri notu üretir.
// Var olan notlar istemci tarafında korunur; burada yalnızca öneri döner.
app.post('/api/kinships', (req, res) => {
  const { text, characters } = req.body || {};
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Aile bağları için metin gerekli.' });
  }
  const list = Array.isArray(characters) ? characters : [];
  const kinships = extractKinships(text, list.map((c) => c && c.name).filter(Boolean));
  const notes = {};
  for (const c of list) {
    if (!c || !c.id) continue;
    const note = buildNote(c, list, kinships);
    if (note) notes[c.id] = note;
  }
  res.json({ general: kinships.general, caveat: kinships.caveat, byName: kinships.byName, notes });
});

app.get('/api/world/markdown', (req, res) => {
  const project = readProject();
  if (!project.world) {
    return res.status(404).json({ error: 'Yüklü dünya dosyası yok.' });
  }
  const md = project.world.markdown || toMarkdown(project.world.text, project.world.filename);
  const base = path.basename(project.world.filename, path.extname(project.world.filename));
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(base)}.md"`);
  res.send(md);
});

// Hikâyeyi Word (.docx) olarak dışa aktarır: başlık, taslak, sahne planı, karakter kartları.
app.post('/api/export/docx', async (req, res) => {
  const { storyId } = req.body || {};
  const project = readProject();
  const stories = Array.isArray(project.stories) ? project.stories : [];
  const story = stories.find((s) => s.id === storyId) || stories[0];
  if (!story) return res.status(404).json({ error: 'Dışa aktarılacak hikâye yok.' });

  const {
    Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  } = require('docx');

  const title = (story.title || '').trim() || 'İsimsiz Hikâye';
  const chars = (project.characters || []).filter((c) => !c.storyId || c.storyId === story.id);
  const scenes = Array.isArray(story.scenes) ? story.scenes : [];
  const draft = String(story.draft || '').trim();

  const children = [
    new Paragraph({ text: title, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 320 },
      children: [new TextRun({ text: `Hayalhâne · ${new Date().toLocaleDateString('tr-TR')}`, italics: true, size: 18, color: '777777' })],
    }),
  ];

  if (draft) {
    children.push(new Paragraph({ text: 'Hikâye', heading: HeadingLevel.HEADING_1 }));
    for (const para of draft.split(/\n{2,}/)) {
      const line = para.trim();
      if (!line) continue;
      children.push(new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: line, size: 22 })] }));
    }
  }

  if (scenes.length) {
    children.push(new Paragraph({ text: 'Sahne Planı', heading: HeadingLevel.HEADING_1, pageBreakBefore: true }));
    scenes.forEach((s, i) => {
      children.push(new Paragraph({
        spacing: { before: 200, after: 60 },
        children: [new TextRun({ text: `${i + 1}. ${s.title || 'Sahne'}`, bold: true, size: 24 })],
      }));
      const meta = [s.purpose, s.estimatedMinutes ? `~${s.estimatedMinutes} dk` : '', s.words ? `${s.words} kelime` : '']
        .filter(Boolean).join(' · ');
      if (meta) {
        children.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: meta, italics: true, size: 18, color: '777777' })] }));
      }
      if (s.summary) children.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: s.summary, size: 21 })] }));
      for (const beat of (s.beats || [])) {
        children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: String(beat), size: 20 })] }));
      }
    });
  }

  if (chars.length) {
    children.push(new Paragraph({ text: 'Karakterler', heading: HeadingLevel.HEADING_1, pageBreakBefore: true }));
    for (const c of chars) {
      const name = [c.name, c.nickname ? `“${c.nickname}”` : ''].filter(Boolean).join(' ');
      children.push(new Paragraph({
        spacing: { before: 220, after: 60 },
        children: [new TextRun({ text: name || 'İsimsiz', bold: true, size: 24 })],
      }));
      const meta = [c.family, c.role === 'yan' ? 'Yan karakter' : 'Ana karakter'].filter(Boolean).join(' · ');
      if (meta) {
        children.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: meta, italics: true, size: 18, color: '777777' })] }));
      }
      if (c.description) children.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: c.description, size: 21 })] }));
      for (const f of (c.features || [])) {
        if (!f || !(f.title || f.detail)) continue;
        children.push(new Paragraph({
          bullet: { level: 0 },
          children: [
            new TextRun({ text: `${f.title || 'Özellik'}: `, bold: true, size: 20 }),
            new TextRun({ text: String(f.detail || ''), size: 20 }),
          ],
        }));
      }
      if (c.note) {
        for (const line of String(c.note).split('\n')) {
          if (!line.trim()) continue;
          children.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: line, size: 19, color: '555555' })] }));
        }
      }
    }
  }

  const doc = new Document({ sections: [{ properties: {}, children }] });
  const buf = await Packer.toBuffer(doc);
  const safe = title.replace(/[\\/:*?"<>|]/g, '-').slice(0, 80);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safe)}.docx"`);
  res.send(buf);
});

// Hikâyeyi EPUB 3 olarak dışa aktarır: başlık sayfası, taslak, sahne planı, karakter kartları.
app.post('/api/export/epub', async (req, res) => {
  const { storyId, includeScenes = true, includeCharacters = true } = req.body || {};
  const project = readProject();
  const stories = Array.isArray(project.stories) ? project.stories : [];
  const story = stories.find((s) => s.id === storyId) || stories[0];
  if (!story) return res.status(404).json({ error: 'Dışa aktarılacak hikâye yok.' });

  const title = (story.title || '').trim() || 'İsimsiz Hikâye';
  const chars = (project.characters || []).filter((c) => !c.storyId || c.storyId === story.id);

  try {
    const buf = await buildEpub({
      title,
      author: 'Hayalhâne',
      language: 'tr',
      draft: story.draft || '',
      scenes: Array.isArray(story.scenes) ? story.scenes : [],
      characters: chars,
      includeScenes: includeScenes !== false,
      includeCharacters: includeCharacters !== false,
    });
    const safe = title.replace(/[\\/:*?"<>|]/g, '-').slice(0, 80);
    res.setHeader('Content-Type', 'application/epub+zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safe)}.epub"`);
    res.send(buf);
  } catch (err) {
    console.error('EPUB hatası:', err);
    res.status(500).json({ error: 'EPUB oluşturulamadı: ' + err.message });
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Hayalhâne hazır: http://127.0.0.1:${PORT}`);
  console.log('UYARI: Bu sürüm üretim öncesidir (pre-production) — gerçek verilerle kullanmadan önce yedek al.');
});
