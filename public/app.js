'use strict';

/* ---------------- state ---------------- */
const state = {
  world: null,
  stories: [],
  activeStoryId: null,
  characters: [],
  notes: [],
  analysis: null,
  dirty: false,
};

const $ = (sel) => document.querySelector(sel);
const el = {
  editor: $('#editor'),
  wordCount: $('#wordCount'),
  micBtn: $('#micBtn'),
  micLabel: $('#micLabel'),
  micState: $('#micState'),
  interim: $('#interim'),
  analysisBody: $('#analysisBody'),
  sceneList: $('#sceneList'),
  sceneEmpty: $('#sceneEmpty'),
  sceneCount: $('#sceneCount'),
  charList: $('#charList'),
  charEmpty: $('#charEmpty'),
  charCount: $('#charCount'),
  charSearch: $('#charSearch'),
  charStoryFilter: $('#charStoryFilter'),
  storyTitleInput: $('#storyTitleInput'),
  sceneStorySelect: $('#sceneStorySelect'),
  storyFileInput: $('#storyFileInput'),
  sideStoryList: $('#sideStoryList'),
  sideStoryCount: $('#sideStoryCount'),
  crumbStory: $('#crumbStory'),
  crumbView: $('#crumbView'),
  saveStatus: $('#saveStatus'),
  toast: $('#toast'),
  worldInfo: $('#worldInfo'),
  worldName: $('#worldName'),
  worldStats: $('#worldStats'),
  worldText: $('#worldText'),
  dropzone: $('#dropzone'),
  worldFile: $('#worldFile'),
  openBackups: $('#openBackups'),
  backupModal: $('#backupModal'),
  backupList: $('#backupList'),
  closeBackups: $('#closeBackups'),
  treeWrap: $('#treeWrap'),
  treeLegend: $('#treeLegend'),
};

/* ---------------- stories ---------------- */
function newStoryId() {
  return (crypto.randomUUID && crypto.randomUUID()) || 's-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

function makeStory(title) {
  return { id: newStoryId(), title: (title || '').trim(), draft: '', scenes: [] };
}

function activeStory() {
  return state.stories.find((s) => s.id === state.activeStoryId) || state.stories[0] || null;
}

// Başlık boşsa listede okunabilir bir yer tutucu gösterilir; kayda yazılmaz.
function storyLabel(s) {
  return (s && s.title && s.title.trim()) || 'Adsız hikâye';
}

function storyTitle(id) {
  const s = state.stories.find((x) => x.id === id);
  return s ? storyLabel(s) : 'Hikâye atanmamış';
}

function ensureStories() {
  if (!Array.isArray(state.stories) || !state.stories.length) {
    state.stories = [makeStory('')];
  }
  state.stories = state.stories.map((s) => ({
    id: s.id || newStoryId(),
    title: typeof s.title === 'string' ? s.title.trim() : '',
    draft: typeof s.draft === 'string' ? s.draft : '',
    scenes: Array.isArray(s.scenes) ? s.scenes : [],
  }));
  if (!state.stories.some((s) => s.id === state.activeStoryId)) {
    state.activeStoryId = state.stories[0].id;
  }
}

function renderStorySelect() {
  ensureStories();
  if (el.sceneStorySelect) {
    el.sceneStorySelect.innerHTML = state.stories
      .map((s) => `<option value="${esc(s.id)}"${s.id === state.activeStoryId ? ' selected' : ''}>${esc(storyLabel(s))}</option>`)
      .join('');
  }
  renderSidebarStories();
  syncStoryTitleInput();
  renderCharStoryFilter();
}

// Sol menüdeki hikâye listesi: tıklayınca o hikâyeye geçilir.
function renderSidebarStories() {
  if (!el.sideStoryList) return;
  el.sideStoryCount.textContent = String(state.stories.length).padStart(2, '0');
  el.sideStoryList.innerHTML = state.stories
    .map((s) => {
      const words = countWords(s.draft || '');
      const active = s.id === state.activeStoryId;
      const label = storyLabel(s);
      const untitled = !(s.title || '').trim();
      return `
        <div class="side-story ${active ? 'active' : ''}" data-story="${esc(s.id)}">
          <button class="side-story-main" data-act="open" title="${esc(label)}">
            <span class="project-nav-icon">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></svg>
            </span>
            <span class="project-nav-copy">
              <strong class="${untitled ? 'untitled' : ''}">${esc(label)}</strong>
              <small>${words} kelime · ${s.scenes.length} sahne</small>
            </span>
          </button>
          <button class="side-story-del" data-act="delete" title="Bu hikâyeyi sil" aria-label="Bu hikâyeyi sil">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/></svg>
          </button>
        </div>`;
    })
    .join('');
  if (el.crumbStory) el.crumbStory.textContent = activeStory() ? storyLabel(activeStory()) : 'Hikâye';
}

el.sideStoryList.addEventListener('click', (e) => {
  const row = e.target.closest('.side-story');
  if (!row) return;
  const id = row.dataset.story;
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'delete') {
    deleteStory(id);
    return;
  }
  switchStory(id);
  document.querySelector('.tab[data-view="write"]').click();
});

function deleteStory(id) {
  const s = state.stories.find((x) => x.id === id);
  if (!s) return;
  const charCount = state.characters.filter((c) => c.storyId === id).length;
  const words = countWords(s.draft || '');
  const last = state.stories.length === 1;
  const msg =
    `“${storyLabel(s)}” tamamen silinsin mi?\n\n` +
    `• ${words} kelime metin\n` +
    `• ${s.scenes.length} sahne\n` +
    `• ${charCount} karakter (resimleri ve özellikleriyle)\n\n` +
    (last ? 'Bu tek hikâye. Silinince yerine boş bir hikâye açılır.\n\n' : '') +
    'Bu işlem geri alınamaz.';
  if (!confirm(msg)) return;

  state.characters = state.characters.filter((c) => c.storyId !== id);
  if (last) {
    const fresh = makeStory('');
    state.stories = [fresh];
    state.activeStoryId = fresh.id;
  } else {
    state.stories = state.stories.filter((x) => x.id !== id);
    if (state.activeStoryId === id) state.activeStoryId = state.stories[0].id;
  }
  const next = activeStory();
  el.editor.value = next ? next.draft : '';
  updateWordCount();
  state.analysis = null;
  renderAnalysis();
  clearPendingSpeech();
  lastInserted = null;
  renderStorySelect();
  renderScenes();
  renderCharacters();
  scheduleSave();
  syncStoryTitleInput(true);
  toast(`“${storyLabel(s)}” silindi.`);
}

function addStory() {
  const s = makeStory('');
  state.stories.push(s);
  state.activeStoryId = s.id;
  el.editor.value = '';
  updateWordCount();
  renderStorySelect();
  renderScenes();
  renderCharacters();
  scheduleSave();
  document.querySelector('.tab[data-view="write"]').click();
  syncStoryTitleInput(true);
  el.storyTitleInput.focus();
  el.storyTitleInput.select();
  toast('Yeni hikâye açıldı. Adını yaz.');
}

function renderCharStoryFilter() {
  if (!el.charStoryFilter) return;
  const current = el.charStoryFilter.value || 'all';
  el.charStoryFilter.innerHTML =
    '<option value="all">Tüm hikâyeler</option>' +
    state.stories.map((s) => `<option value="${esc(s.id)}">${esc(storyLabel(s))}</option>`).join('');
  el.charStoryFilter.value = [...el.charStoryFilter.options].some((o) => o.value === current) ? current : 'all';
}

function switchStory(id) {
  if (id === state.activeStoryId) return;
  state.activeStoryId = id;
  const s = activeStory();
  el.editor.value = s ? s.draft : '';
  updateWordCount();
  renderStorySelect();
  syncStoryTitleInput(true);
  renderScenes();
  renderCharacters();
  scheduleSave();
}
// Sahneler her zaman etkin hikâyenin altında tutulur.
Object.defineProperty(state, 'scenes', {
  get() {
    const s = activeStory();
    return s ? s.scenes : [];
  },
  set(value) {
    const s = activeStory();
    if (s) s.scenes = Array.isArray(value) ? value : [];
  },
});

/* ---------------- helpers ---------------- */
let toastTimer;
function toast(msg, isError = false) {
  el.toast.textContent = msg;
  el.toast.classList.toggle('err', isError);
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.toast.hidden = true; }, 3200);
}

function setStatus(text, cls = '') {
  el.saveStatus.textContent = text;
  el.saveStatus.className = 'status ' + cls;
}

function countWords(text) {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

function updateWordCount() {
  el.wordCount.textContent = `${countWords(el.editor.value)} kelime`;
}

/* ---------------- tabs ---------------- */
const VIEW_LABELS = {
  write: 'Yaz & Konuş',
  world: 'Dünya Dosyası',
  characters: 'Karakterler',
  scenes: 'Sahneler',
  notes: 'Notlar',
};

function showView(view) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === view));
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + view));
  if (el.crumbView) el.crumbView.textContent = VIEW_LABELS[view] || view;
  if (view === 'notes') renderNotes();
  if (view === 'notes') renderNotes();
}

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => showView(tab.dataset.view));
});

/* ---------------- persistence ---------------- */
let saveTimer;
function scheduleSave() {
  state.dirty = true;
  setStatus('kaydediliyor…', 'saving');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveProject, 700);
}

async function saveProject() {
  try {
    const s = activeStory();
    if (s) s.draft = el.editor.value;
    const res = await fetch('/api/project', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        world: state.world,
        stories: state.stories,
        activeStoryId: state.activeStoryId,
        characters: state.characters,
        notes: state.notes,
      }),
    });
    if (!res.ok) throw new Error('kayıt başarısız');
    state.dirty = false;
    setStatus('kaydedildi', 'saved');
  } catch (err) {
    setStatus('kayıt hatası', '');
    toast('Proje kaydedilemedi: ' + err.message, true);
  }
}

async function loadProject() {
  try {
    const res = await fetch('/api/project');
    const data = await res.json();
    state.world = data.world || null;
    state.stories = Array.isArray(data.stories) ? data.stories : [];
    state.activeStoryId = data.activeStoryId || null;
    state.characters = Array.isArray(data.characters) ? data.characters : [];
    state.notes = Array.isArray(data.notes) ? data.notes : [];
    ensureStories();
    const s = activeStory();
    if (s && s.draft) {
      el.editor.value = s.draft;
      updateWordCount();
    }
    renderStorySelect();
    renderWorld();
    renderScenes();
    renderCharacters();
    renderNotes();
    if (!state.characters.length && state.world) await autoExtractCharacters();
    setStatus('hazır');
  } catch {
    setStatus('hazır');
  }
}

/* ---------------- yedekler ---------------- */
function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

async function openBackupModal() {
  el.backupModal.hidden = false;
  el.backupList.innerHTML = '<div class="backup-empty">Yükleniyor…</div>';
  try {
    const res = await fetch('/api/backups');
    const list = await res.json();
    if (!Array.isArray(list) || !list.length) {
      el.backupList.innerHTML = '<div class="backup-empty">Henüz yedek yok. Proje kaydedildikçe yedekler burada birikir.</div>';
      return;
    }
    el.backupList.innerHTML = list.map((b) => {
      const rich = b.chars > 0 || b.scenes > 0;
      return `<div class="backup-row">
        <div class="backup-meta">
          <strong>${esc(fmtDate(b.savedAt))}</strong>
          <small class="${rich ? 'rich' : ''}">${b.stories} hikâye · ${b.chars} karakter · ${b.scenes} sahne · ${fmtBytes(b.size)}</small>
        </div>
        <button class="btn ghost small" data-restore="${esc(b.file)}">Geri yükle</button>
      </div>`;
    }).join('');
  } catch (err) {
    el.backupList.innerHTML = `<div class="backup-empty">Yedekler okunamadı: ${esc(err.message)}</div>`;
  }
}

async function restoreBackup(file) {
  if (!confirm('Bu yedek geri yüklenecek ve mevcut proje değişecek. Devam edilsin mi?')) return;
  try {
    const res = await fetch('/api/backups/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file }),
    });
    if (!res.ok) throw new Error('geri yükleme başarısız');
    el.backupModal.hidden = true;
    await loadProject();
    toast('Yedek geri yüklendi.');
  } catch (err) {
    toast('Yedek geri yüklenemedi: ' + err.message, true);
  }
}

if (el.openBackups) el.openBackups.addEventListener('click', openBackupModal);
if (el.closeBackups) el.closeBackups.addEventListener('click', () => { el.backupModal.hidden = true; });
if (el.backupModal) {
  el.backupModal.addEventListener('click', (e) => {
    if (e.target === el.backupModal) el.backupModal.hidden = true;
  });
}
if (el.backupList) {
  el.backupList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-restore]');
    if (btn) restoreBackup(btn.dataset.restore);
  });
}

/* ---------------- editor ---------------- */
el.editor.addEventListener('input', () => {
  const s = activeStory();
  if (s) s.draft = el.editor.value;
  updateWordCount();
  scheduleSave();
});

// Hikâye adı doğrudan yazılır; her tuşta kaydedilir.
let titleInputStoryId = null;

function syncStoryTitleInput(force = false) {
  const s = activeStory();
  if (!el.storyTitleInput) return;
  // Kullanıcı yazarken değeri geri yazmak imleci sona atar; o yüzden dokunmuyoruz.
  if (!force && document.activeElement === el.storyTitleInput && titleInputStoryId === state.activeStoryId) return;
  el.storyTitleInput.value = s ? s.title : '';
  titleInputStoryId = state.activeStoryId;
}

el.storyTitleInput.addEventListener('input', () => {
  const s = activeStory();
  if (!s) return;
  titleInputStoryId = s.id;
  s.title = el.storyTitleInput.value;
  renderSidebarStories();
  renderCharStoryFilter();
  renderScenes();
  scheduleSave();
});

el.storyTitleInput.addEventListener('blur', () => {
  const s = activeStory();
  if (!s) return;
  // Alan başka bir hikâyeden kalmışsa (hikâye değiştirildiyse) yazma, sadece eşitle.
  if (titleInputStoryId !== s.id) {
    syncStoryTitleInput(true);
    return;
  }
  // Boş bırakılabilir: adı kullanıcı verir, zorla isim üretilmez.
  s.title = el.storyTitleInput.value.trim();
  el.storyTitleInput.value = s.title;
  renderStorySelect();
  renderScenes();
  renderCharacters();
  scheduleSave();
});

$('#sideAddStory').addEventListener('click', addStory);

$('#clearText').addEventListener('click', () => {
  if (!el.editor.value.trim() || confirm('Metin temizlensin mi?')) {
    el.editor.value = '';
    updateWordCount();
    scheduleSave();
  }
});

/* ---------------- sesli okuma (TTS) ---------------- */
const synth = window.speechSynthesis;
let speaking = false;
let speakQueue = [];

function pickTurkishVoice() {
  if (!synth) return null;
  const voices = synth.getVoices();
  return voices.find((v) => /^tr/i.test(v.lang))
    || voices.find((v) => /turkish/i.test(v.name))
    || null;
}

function stopSpeaking() {
  if (!synth) return;
  speakQueue = [];
  synth.cancel();
  speaking = false;
  const btn = $('#speakBtn');
  if (btn) btn.textContent = '🔊 Sesli oku';
}

function speakText(text) {
  if (!synth) {
    toast('Bu tarayıcı sesli okumayı desteklemiyor.', true);
    return;
  }
  const clean = String(text || '').trim();
  if (!clean) {
    toast('Okunacak metin yok.', true);
    return;
  }
  stopSpeaking();

  // Uzun metni cümlelere böl; tek seferde 200+ karakter Chrome'da kesiliyor.
  const chunks = clean
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?…])\s+/)
    .reduce((acc, sentence) => {
      const last = acc[acc.length - 1];
      if (last && (last + ' ' + sentence).length <= 200) acc[acc.length - 1] = last + ' ' + sentence;
      else acc.push(sentence);
      return acc;
    }, []);

  const voice = pickTurkishVoice();
  speakQueue = chunks.slice();
  speaking = true;
  const btn = $('#speakBtn');
  if (btn) btn.textContent = '⏹ Durdur';

  const next = () => {
    if (!speaking) return;
    const chunk = speakQueue.shift();
    if (!chunk) { stopSpeaking(); return; }
    const u = new SpeechSynthesisUtterance(chunk);
    u.lang = 'tr-TR';
    if (voice) u.voice = voice;
    u.rate = 1;
    u.pitch = 1;
    u.onend = next;
    u.onerror = next;
    synth.speak(u);
  };
  next();
}

$('#speakBtn').addEventListener('click', () => {
  if (speaking) stopSpeaking();
  else speakText(el.editor.value);
});

// Sekme kapanırken sesi kes.
window.addEventListener('beforeunload', stopSpeaking);

// Kaydedilmemiş değişiklik varsa hemen diske yaz (debounce'u beklemeden).
// keepalive yalnızca sayfa kapanırken gerekir; 64 KB sınırı olduğu için
// büyük projelerde normal istek kullanılır (sekme gizlenirken sayfa hâlâ canlıdır).
function flushSave(useKeepalive = false) {
  if (!state.dirty) return;
  const s = activeStory();
  if (s) s.draft = el.editor.value;
  clearTimeout(saveTimer);
  const body = JSON.stringify({
    world: state.world,
    stories: state.stories,
    activeStoryId: state.activeStoryId,
    characters: state.characters,
    notes: state.notes,
  });
  state.dirty = false;
  try {
    fetch('/api/project', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body,
      ...(useKeepalive && body.length < 60000 ? { keepalive: true } : {}),
    }).catch(() => { state.dirty = true; });
  } catch {
    state.dirty = true;
  }
}

// Sekme gizlenince / kapanırken kaydet. visibilitychange mobilde de güvenilir çalışır.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushSave(false);
});
window.addEventListener('pagehide', () => flushSave(true));

/* ---------------- Türkçe karakter düzeltme ---------------- */
$('#deasciifyBtn').addEventListener('click', async () => {
  const text = el.editor.value;
  if (!text.trim()) {
    toast('Düzeltilecek metin yok.', true);
    return;
  }
  const btn = $('#deasciifyBtn');
  btn.disabled = true;
  try {
    const res = await fetch('/api/deasciify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Düzeltme başarısız.');
    if (!data.changed) {
      toast('Metin zaten düzgün görünüyor.');
      return;
    }
    el.editor.value = data.text;
    updateWordCount();
    scheduleSave();
    toast('Türkçe harfler düzeltildi.');
  } catch (err) {
    toast(err.message, true);
  } finally {
    btn.disabled = false;
  }
});

$('#deleteStoryBtn').addEventListener('click', () => {
  if (state.activeStoryId) deleteStory(state.activeStoryId);
});

// Ortak indirme yardımcısı: POST eder, blob'u dosya olarak kaydeder.
async function downloadExport(url, fallbackName, okMessage) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storyId: state.activeStoryId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Dışa aktarma başarısız.');
  }
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') || '';
  const m = /filename="([^"]+)"/.exec(cd);
  const name = m ? decodeURIComponent(m[1]) : fallbackName;
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
  toast(okMessage);
}

$('#exportDocx').addEventListener('click', async () => {
  const btn = $('#exportDocx');
  btn.disabled = true;
  try {
    await downloadExport('/api/export/docx', 'hayalhane.docx', 'Word dosyası indirildi.');
  } catch (err) {
    toast(err.message, true);
  } finally {
    btn.disabled = false;
  }
});

$('#exportEpub').addEventListener('click', async () => {
  const btn = $('#exportEpub');
  btn.disabled = true;
  try {
    await downloadExport('/api/export/epub', 'hayalhane.epub', 'EPUB dosyası indirildi.');
  } catch (err) {
    toast(err.message, true);
  } finally {
    btn.disabled = false;
  }
});

/* ---------------- PDF (yazdırma) ---------------- */
function buildPrintHtml() {
  const s = activeStory();
  const title = (s && s.title.trim()) || 'Adsız hikâye';
  const draft = (s && s.draft) || '';
  const scenes = (s && s.scenes) || [];
  const chars = state.characters || [];

  const paras = draft
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n');

  const sceneHtml = scenes.length
    ? `<h2>Sahne Planı</h2>\n<ol class="scenes">${scenes
        .map((sc) => `<li><strong>${esc(sc.title || 'Sahne')}</strong>${sc.summary ? `<div>${esc(sc.summary)}</div>` : ''}</li>`)
        .join('')}</ol>`
    : '';

  const charHtml = chars.length
    ? `<h2>Karakterler</h2>\n${chars
        .map((c) => {
          const feats = (c.features || [])
            .filter((f) => f.title || f.detail)
            .map((f) => `<li><strong>${esc(f.title || '')}</strong>${f.detail ? ` — ${esc(f.detail)}` : ''}</li>`)
            .join('');
          return `<div class="char"><h3>${esc(c.name || 'İsimsiz')}${c.nickname ? ` <span class="nick">(${esc(c.nickname)})</span>` : ''}</h3>${
            c.family ? `<div class="fam">${esc(c.family)}</div>` : ''
          }${feats ? `<ul>${feats}</ul>` : ''}${c.note ? `<p class="note">${esc(c.note)}</p>` : ''}</div>`;
        })
        .join('\n')}`
    : '';

  return `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { size: A4; margin: 20mm 18mm; }
  body { font-family: Georgia, 'Times New Roman', serif; font-size: 11.5pt; line-height: 1.65; color: #111; }
  h1 { font-size: 22pt; margin: 0 0 4pt; }
  h2 { font-size: 14pt; margin: 22pt 0 8pt; border-bottom: 1px solid #ccc; padding-bottom: 3pt; page-break-after: avoid; }
  h3 { font-size: 12pt; margin: 12pt 0 3pt; }
  p { margin: 0 0 9pt; text-align: justify; }
  .sub { color: #666; font-size: 10pt; margin-bottom: 18pt; }
  .scenes li { margin-bottom: 7pt; }
  .char { page-break-inside: avoid; margin-bottom: 10pt; }
  .nick { font-weight: normal; color: #666; font-size: 10pt; }
  .fam { color: #666; font-size: 9.5pt; margin-bottom: 3pt; }
  .note { font-size: 10pt; color: #333; }
  ul { margin: 3pt 0 6pt 16pt; padding: 0; }
  li { margin-bottom: 2pt; }
</style></head>
<body>
<h1>${esc(title)}</h1>
<div class="sub">Hayalhâne · ${new Date().toLocaleDateString('tr-TR')}</div>
${paras || '<p><em>Metin boş.</em></p>'}
${sceneHtml}
${charHtml}
</body></html>`;
}

$('#exportPdf').addEventListener('click', () => {
  const w = window.open('', '_blank');
  if (!w) {
    toast('Yazdırma penceresi engellendi. Tarayıcı adres çubuğundaki açılır pencere iznini ver.', true);
    return;
  }
  w.document.write(buildPrintHtml());
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
  toast('Yazdırma penceresi açıldı — “PDF olarak kaydet” seç.');
});

/* ---------------- proje indir / yükle ---------------- */
$('#exportProject').addEventListener('click', async () => {
  const btn = $('#exportProject');
  btn.disabled = true;
  try {
    const res = await fetch('/api/project/export');
    if (!res.ok) throw new Error('Proje indirilemedi.');
    const blob = await res.blob();
    const cd = res.headers.get('Content-Disposition') || '';
    const m = /filename="([^"]+)"/.exec(cd);
    const name = m ? decodeURIComponent(m[1]) : 'hayalhane-yedek.json';
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
    toast('Proje yedeği indirildi.');
  } catch (err) {
    toast(err.message, true);
  } finally {
    btn.disabled = false;
  }
});

$('#importProject').addEventListener('click', () => $('#importProjectInput').click());

$('#importProjectInput').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (!confirm(`“${file.name}” yüklensin mi?\n\nMevcut proje önce otomatik yedeklenir, sonra bu dosyadaki hâline döner.`)) return;
  try {
    const text = await file.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('Dosya geçerli bir JSON değil.');
    }
    const res = await fetch('/api/project/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Proje yüklenemedi.');
    await loadProject();
    toast('Proje geri yüklendi.');
  } catch (err) {
    toast(err.message, true);
  }
});

/* ---------------- speech recognition ---------------- */
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let listening = false;
let manualStop = false;
let restartTimer = null;
let lastInserted = null; // { start, end } — mikrofonla eklenen son parça
let pendingSpeech = '';

/* --- düzeltme sözlüğü: yanlış duyulan → doğrusu --- */
const DICT_KEY = 'hayalhane.speechDict';
const DEFAULT_DICT = [
  { from: 'hayal hane', to: 'Hayalhâne' },
  { from: 'hayalhane', to: 'Hayalhâne' },
  { from: 'tasvir i hayal', to: 'Tasvir-i Hayal' },
  { from: 'anne terligi', to: 'anne terliği' },
  { from: 'baba anne', to: 'babaanne' },
  { from: 'anne anne', to: 'anneanne' },
  { from: 'buyuk baba', to: 'büyükbaba' },
  { from: 'buyuk anne', to: 'büyük anne' },
];

// Sıradan Türkçe kelimeler: karakter adıyla eşleşse bile büyük harfe çevrilmez.
const COMMON_WORDS = new Set([
  'anne', 'baba', 'hala', 'teyze', 'amca', 'dayı', 'dede', 'nine', 'enişte',
  'babaanne', 'anneanne', 'büyükbaba', 'büyükanne', 'kardeş', 'abi', 'abla',
  'oğul', 'kız', 'gelin', 'damat', 'torun', 'yeğen', 'eş', 'karı', 'koca',
]);

let speechDict = loadDict();

function loadDict() {
  try {
    const raw = localStorage.getItem(DICT_KEY);
    if (!raw) return DEFAULT_DICT.slice();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_DICT.slice();
    return parsed.filter((d) => d && typeof d.from === 'string' && typeof d.to === 'string');
  } catch {
    return DEFAULT_DICT.slice();
  }
}

function saveDict() {
  try { localStorage.setItem(DICT_KEY, JSON.stringify(speechDict)); } catch { /* yoksay */ }
}

function dictToText() {
  return speechDict.map((d) => `${d.from} = ${d.to}`).join('\n');
}

function textToDict(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && line.includes('='))
    .map((line) => {
      const i = line.indexOf('=');
      return { from: line.slice(0, i).trim(), to: line.slice(i + 1).trim() };
    })
    .filter((d) => d.from && d.to);
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Konuşma tanıma servisi Türkçede isimleri sık yanlış duyar; sözlük + karakter
// adları üzerinden düzeltiyoruz.
function speechVocabulary() {
  const names = new Set();
  for (const c of state.characters || []) {
    if (c.name) names.add(c.name);
    if (c.nickname) names.add(c.nickname);
  }
  for (const d of speechDict) if (d.to) names.add(d.to);
  return [...names].filter((n) => n && n.length >= 3 && !COMMON_WORDS.has(trLower(n)));
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

function trLower(s) {
  return s.toLocaleLowerCase('tr');
}

function applySpeechDict(text) {
  let out = text;
  for (const d of speechDict) {
    if (!d.from) continue;
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(d.from)}(?![\\p{L}\\p{N}])`, 'giu');
    out = out.replace(re, d.to);
  }
  return out;
}

// Sözlükte olmayan ama bir karakter adına çok yakın kelimeleri düzeltir.
function fixNearNames(text) {
  const vocab = speechVocabulary();
  if (!vocab.length) return text;
  return text.replace(/[\p{L}]{3,}/gu, (word) => {
    const lw = trLower(word);
    if (COMMON_WORDS.has(lw)) return word;
    let best = null;
    let bestDist = Infinity;
    for (const name of vocab) {
      const ln = trLower(name);
      if (ln === lw) return name;
      const limit = ln.length >= 7 ? 2 : 1;
      const dist = levenshtein(lw, ln);
      if (dist <= limit && dist < bestDist) {
        best = name;
        bestDist = dist;
      }
    }
    return best || word;
  });
}

function correctSpeech(text) {
  return fixNearNames(applySpeechDict(text));
}

// Birden çok alternatiften sözlüğe/karakter adlarına en çok uyanı seçer.
function pickBestAlternative(result) {
  let best = result[0].transcript;
  let bestScore = -1;
  for (let i = 0; i < result.length; i++) {
    const t = result[i].transcript;
    const fixed = correctSpeech(t);
    let score = result[i].confidence || 0;
    if (fixed !== t) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}

const COMMANDS = [
  { re: /^(yeni paragraf|paragraf|satır başı)\.?$/i, run: () => insertText('\n\n') },
  { re: /^(nokta)\.?$/i, run: () => insertText('. ') },
  { re: /^(virgül)\.?$/i, run: () => insertText(', ') },
  { re: /^(soru işareti)\.?$/i, run: () => insertText('? ') },
  { re: /^(ünlem|ünlem işareti)\.?$/i, run: () => insertText('! ') },
  { re: /^(son kelimeyi sil|kelimeyi sil|geri al)\.?$/i, run: deleteLastWord },
  { re: /^(analiz et|analiz)\.?$/i, run: () => runAnalysis() },
  { re: /^(sahnelere böl|sahnele)\.?$/i, run: () => runBreakdown() },
  { re: /^(hikâyeleştir|hikayelestir|düzenle)\.?$/i, run: () => runStory() },
  { re: /^(mikrofonu kapat|dinlemeyi bitir|dur)\.?$/i, run: () => stopListening() },
];

function insertText(text) {
  const start = el.editor.selectionStart ?? el.editor.value.length;
  const end = el.editor.selectionEnd ?? el.editor.value.length;
  const before = el.editor.value.slice(0, start);
  const after = el.editor.value.slice(end);
  el.editor.value = before + text + after;
  const pos = start + text.length;
  el.editor.setSelectionRange(pos, pos);
  el.editor.focus();
  updateWordCount();
  scheduleSave();
  return { start, end: pos };
}

function deleteLastWord() {
  const v = el.editor.value.replace(/\s+$/, '');
  const idx = v.search(/\S+$/);
  el.editor.value = idx >= 0 ? v.slice(0, idx) : '';
  el.editor.setSelectionRange(el.editor.value.length, el.editor.value.length);
  updateWordCount();
  scheduleSave();
}

// Mikrofonla eklenen son parçayı metinden çıkarır.
function undoLastSpeech() {
  if (!lastInserted) {
    toast('Geri alınacak mikrofon kaydı yok.', true);
    return;
  }
  const { start, end } = lastInserted;
  el.editor.value = el.editor.value.slice(0, start) + el.editor.value.slice(end);
  el.editor.setSelectionRange(start, start);
  lastInserted = null;
  updateWordCount();
  scheduleSave();
  toast('Son mikrofon parçası geri alındı.');
}

function showPendingSpeech(text) {
  pendingSpeech = text;
  $('#speechPendingText').textContent = text;
  $('#speechPending').hidden = false;
}

function clearPendingSpeech() {
  pendingSpeech = '';
  $('#speechPending').hidden = true;
  $('#speechPendingText').textContent = '';
}

function commitSpeech(text) {
  const needsSpace = el.editor.value.length > 0 && !/\s$/.test(el.editor.value);
  const inserted = insertText((needsSpace ? ' ' : '') + text);
  lastInserted = inserted;
}

function handleFinalTranscript(text) {
  const clean = correctSpeech(text.trim());
  if (!clean) return;

  if ($('#voiceCommands').checked) {
    for (const cmd of COMMANDS) {
      if (cmd.re.test(clean)) {
        cmd.run();
        return;
      }
    }
  }

  if ($('#confirmSpeech').checked) {
    showPendingSpeech(clean);
    return;
  }

  commitSpeech(clean);
}

function setMicUI(on) {
  el.micBtn.classList.toggle('recording', on);
  el.micLabel.textContent = on ? 'Dinliyorum… (durdur)' : 'Mikrofonu Aç';
  el.micState.textContent = on ? 'kayıt' : 'kapalı';
  el.micState.style.color = on ? 'var(--bad)' : '';
}

function startListening() {
  if (!SpeechRecognition) {
    toast('Bu tarayıcı konuşma tanımayı desteklemiyor. Chrome veya Edge kullan.', true);
    return;
  }
  if (listening) return;

  manualStop = false;
  recognition = new SpeechRecognition();
  recognition.lang = 'tr-TR';
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 3;

  // Çevrimdışı (cihaz üstü) tanıma — Chrome 138+ deneysel API.
  const offline = $('#offlineSpeech').checked;
  if (offline) {
    if (!('processLocally' in recognition)) {
      toast('Bu tarayıcı çevrimdışı tanımayı desteklemiyor. Chrome 138+ gerekir.', true);
      $('#offlineSpeech').checked = false;
    } else {
      recognition.processLocally = true;
      if ('availableOnDevice' in recognition) {
        recognition.availableOnDevice('tr-TR').then((status) => {
          if (status === 'downloadable' || status === 'downloading') {
            toast('Türkçe dil paketi indiriliyor; ilk seferde biraz sürebilir.');
          } else if (status === 'unavailable') {
            toast('Türkçe çevrimdışı dil paketi yok. Çevrimiçi moda dönülüyor.', true);
            $('#offlineSpeech').checked = false;
          }
        }).catch(() => { /* yoksay */ });
      }
    }
  }

  recognition.onstart = () => {
    listening = true;
    setMicUI(true);
  };

  recognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        handleFinalTranscript(pickBestAlternative(result));
      } else {
        interim += result[0].transcript;
      }
    }
    if (interim) {
      el.interim.hidden = false;
      el.interim.textContent = correctSpeech(interim);
    } else {
      el.interim.hidden = true;
      el.interim.textContent = '';
    }
  };

  recognition.onerror = (event) => {
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      manualStop = true;
      toast('Mikrofon izni verilmedi. Tarayıcı adres çubuğundan izin ver.', true);
    } else if (event.error === 'no-speech') {
      return;
    } else if (event.error === 'network') {
      toast('Konuşma tanıma servisine ulaşılamadı (internet gerekli).', true);
    } else if (event.error === 'language-not-supported') {
      toast('Türkçe dil paketi bulunamadı. Çevrimdışı modu kapatıp tekrar dene.', true);
      $('#offlineSpeech').checked = false;
    }
  };

  recognition.onend = () => {
    listening = false;
    el.interim.hidden = true;
    if (!manualStop && $('#autoRestart').checked) {
      clearTimeout(restartTimer);
      restartTimer = setTimeout(() => {
        try { recognition.start(); } catch { /* zaten çalışıyor */ }
      }, 350);
    } else {
      setMicUI(false);
    }
  };

  try {
    recognition.start();
  } catch {
    toast('Mikrofon başlatılamadı.', true);
  }
}

function stopListening() {
  manualStop = true;
  clearTimeout(restartTimer);
  if (recognition) {
    try { recognition.stop(); } catch { /* yoksay */ }
  }
  listening = false;
  setMicUI(false);
}

el.micBtn.addEventListener('click', () => {
  if (listening) stopListening();
  else startListening();
});

$('#undoSpeech').addEventListener('click', undoLastSpeech);

$('#speechAccept').addEventListener('click', () => {
  if (pendingSpeech) commitSpeech(pendingSpeech);
  clearPendingSpeech();
});

$('#speechReject').addEventListener('click', clearPendingSpeech);

/* --- sözlük paneli --- */
function refreshDictCount() {
  $('#dictCount').textContent = `${speechDict.length} kural`;
}

$('#openDict').addEventListener('click', () => {
  $('#dictText').value = dictToText();
  refreshDictCount();
  $('#dictPanel').hidden = false;
  $('#dictText').focus();
});

$('#closeDict').addEventListener('click', () => { $('#dictPanel').hidden = true; });

$('#saveDict').addEventListener('click', () => {
  speechDict = textToDict($('#dictText').value);
  saveDict();
  refreshDictCount();
  toast(`${speechDict.length} düzeltme kuralı kaydedildi.`);
});

$('#resetDict').addEventListener('click', () => {
  speechDict = DEFAULT_DICT.slice();
  saveDict();
  $('#dictText').value = dictToText();
  refreshDictCount();
  toast('Sözlük varsayılana döndü.');
});

/* ---------------- analysis ---------------- */
async function runAnalysis() {
  const text = el.editor.value.trim();
  if (!text) {
    toast('Önce bir metin yaz ya da konuş.', true);
    return;
  }
  const btn = $('#analyzeBtn');
  btn.disabled = true;
  btn.textContent = 'Analiz ediliyor…';
  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        worldText: state.world ? (state.world.markdown || state.world.text || '') : '',
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'analiz başarısız');
    state.analysis = data;
    renderAnalysis();
  } catch (err) {
    toast('Analiz hatası: ' + err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Analiz Et';
  }
}

function renderAnalysis() {
  const a = state.analysis;
  if (!a) {
    el.analysisBody.innerHTML = '<div class="empty"><p>Henüz analiz yok.</p></div>';
    return;
  }

  const parts = [];

  parts.push(`<div class="stat-row">
    <div class="stat"><b>${a.stats.words}</b>kelime</div>
    <div class="stat"><b>${a.stats.sentences}</b>cümle</div>
    <div class="stat"><b>${a.stats.paragraphs}</b>paragraf</div>
    <div class="stat"><b>${a.stats.readingMinutes} dk</b>okuma</div>
  </div>`);

  if (a.genre && a.genre.genre !== 'Belirsiz') {
    parts.push(`<div class="genre-chip">Tür: <strong>${esc(a.genre.genre)}</strong> · %${a.genre.confidence} uyum</div>`);
  }

  if (a.engine) {
    parts.push(`<div class="muted" style="margin:-6px 0 12px">Yorum motoru: ${esc(a.engine)}</div>`);
  }

  if (a.summary) {
    parts.push(`<div class="block"><h3>Özet</h3><p class="muted">${esc(a.summary)}</p></div>`);
  }

  if (a.characters?.length) {
    parts.push(`<div class="block"><h3>Karakterler</h3><ul>${a.characters
      .map((c) => `<li>${esc(c.name)} <span class="muted">(${c.count}×)</span></li>`)
      .join('')}</ul></div>`);
  }

  if (a.strengths?.length) {
    parts.push(`<div class="block"><h3>Güçlü yanlar</h3><ul>${a.strengths
      .map((s) => `<li class="ok">${esc(s)}</li>`)
      .join('')}</ul></div>`);
  }

  if (a.issues?.length) {
    parts.push(`<div class="block"><h3>Eksikler</h3><ul>${a.issues
      .map((s) => `<li class="bad">${esc(s)}</li>`)
      .join('')}</ul></div>`);
  }

  if (a.suggestions?.length) {
    parts.push(`<div class="block"><h3>Öneriler — onayına sunuldu</h3>${a.suggestions
      .map((s) => `
        <div class="suggestion ${s.status}" data-id="${s.id}">
          <div class="s-head">
            <span class="s-type">${esc(s.type)}</span>
            <span class="s-title">${esc(s.title)}</span>
          </div>
          <p>${esc(s.detail)}</p>
          ${s.draft ? `<p class="muted" style="border-left:2px solid var(--line);padding-left:9px;font-style:italic">${esc(s.draft.trim())}</p>` : ''}
          <div class="s-actions">
            <button class="btn primary small" data-act="approve">Onayla ve ekle</button>
            <button class="btn ghost small" data-act="reject">Reddet</button>
          </div>
        </div>`)
      .join('')}</div>`);
  }

  if (a.questions?.length) {
    parts.push(`<div class="block"><h3>Düşünmen için sorular</h3><ul>${a.questions
      .map((q) => `<li>${esc(q)}</li>`)
      .join('')}</ul></div>`);
  }

  el.analysisBody.innerHTML = parts.join('');
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

el.analysisBody.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const card = btn.closest('.suggestion');
  const id = card.dataset.id;
  const suggestion = state.analysis?.suggestions?.find((s) => s.id === id);
  if (!suggestion) return;

  if (btn.dataset.act === 'approve') {
    if (suggestion.draft) {
      insertText(suggestion.draft);
      toast('Öneri metne eklendi.');
    } else {
      toast('Bu öneri metin taslağı içermiyor.');
    }
    suggestion.status = 'approved';
  } else {
    suggestion.status = 'rejected';
  }
  renderAnalysis();
});

$('#analyzeBtn').addEventListener('click', runAnalysis);
$('#clearAnalysis').addEventListener('click', () => {
  state.analysis = null;
  renderAnalysis();
});

/* ---------------- breakdown ---------------- */
async function runBreakdown() {
  const text = el.editor.value.trim();
  if (!text) {
    toast('Önce bir metin yaz ya da konuş.', true);
    return;
  }
  const btn = $('#breakdownBtn');
  btn.disabled = true;
  btn.textContent = 'Bölünüyor…';
  try {
    const res = await fetch('/api/breakdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'sahneleme başarısız');
    if (!data.scenes.length) {
      toast('Sahne çıkarılamadı; metni biraz daha uzat.', true);
      return;
    }
    state.scenes = [...state.scenes, ...data.scenes];
    renderScenes();
    scheduleSave();
    document.querySelector('.tab[data-view="scenes"]').click();
    toast(`${data.scenes.length} sahne oluşturuldu.`);
  } catch (err) {
    toast('Sahneleme hatası: ' + err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sahnelere Böl';
  }
}

$('#breakdownBtn').addEventListener('click', runBreakdown);

/* ---------------- hikâye dosyası aç ---------------- */
$('#openStoryFile').addEventListener('click', () => el.storyFileInput.click());

el.storyFileInput.addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const s = activeStory();
  if (!s) return;
  if (s.draft.trim() && !confirm(`“${storyLabel(s)}” hikâyesinin metni dosyayla değiştirilsin mi?`)) return;

  const btn = $('#openStoryFile');
  btn.disabled = true;
  btn.textContent = 'Açılıyor…';
  try {
    const res = await fetch(`/api/document?filename=${encodeURIComponent(file.name)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: file,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'dosya okunamadı');
    s.draft = data.text;
    el.editor.value = data.text;
    updateWordCount();
    scheduleSave();
    toast(`“${file.name}” açıldı: ${data.words} kelime. Mikrofonla devam edebilirsin.`);
  } catch (err) {
    toast('Dosya açılamadı: ' + err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Hikâye dosyası aç';
  }
});

/* ---------------- story polish ---------------- */
async function runStory() {
  const text = el.editor.value.trim();
  if (!text) {
    toast('Önce bir metin yaz ya da konuş.', true);
    return;
  }
  const btn = $('#storyBtn');
  btn.disabled = true;
  btn.textContent = 'Düzenleniyor…';
  try {
    const res = await fetch('/api/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'düzenleme başarısız');
    el.editor.value = data.story;
    updateWordCount();
    scheduleSave();
    toast('Noktalama ve paragraflar düzenlendi.');
  } catch (err) {
    toast('Hikâyeleştirme hatası: ' + err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Hikâyeleştir';
  }
}

$('#storyBtn').addEventListener('click', runStory);

/* ---------------- scenes ---------------- */
function renderScenes() {
  el.sceneCount.textContent = state.scenes.length;
  el.sceneEmpty.hidden = state.scenes.length > 0;
  if (el.sceneStorySelect) el.sceneStorySelect.value = state.activeStoryId || '';
  renderSidebarStories();

  el.sceneList.innerHTML = state.scenes
    .map((s, i) => `
      <div class="scene ${s.approved ? 'approved' : ''}" data-id="${s.id}">
        <div class="handle" title="Sürükle">⠿</div>
        <div class="s-body">
          <input class="s-title" value="${esc(s.title)}" data-field="title" />
          <textarea class="s-summary" data-field="summary" rows="2">${esc(s.summary)}</textarea>
          ${s.beats?.length ? `<ul class="beats">${s.beats.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
          <div class="s-meta">
            <span class="chip">#${i + 1}</span>
            <span class="chip purpose">${esc(s.purpose || 'Gelişme')}</span>
            <span class="chip">~${s.estimatedMinutes || 1} dk</span>
            <span class="chip">${s.words || 0} kelime</span>
          </div>
        </div>
        <div class="s-side">
          <button class="btn small ${s.approved ? 'primary' : 'ghost'}" data-act="approve">
            ${s.approved ? 'Onaylı ✓' : 'Onayla'}
          </button>
          <button class="btn ghost small" data-act="delete">Sil</button>
        </div>
      </div>`)
    .join('');
}

el.sceneList.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const card = btn.closest('.scene');
  const scene = state.scenes.find((s) => s.id === card.dataset.id);
  if (!scene) return;

  if (btn.dataset.act === 'approve') {
    scene.approved = !scene.approved;
  } else if (btn.dataset.act === 'delete') {
    state.scenes = state.scenes.filter((s) => s.id !== scene.id);
  }
  renderScenes();
  scheduleSave();
});

el.sceneList.addEventListener('input', (e) => {
  const field = e.target.dataset.field;
  if (!field) return;
  const card = e.target.closest('.scene');
  const scene = state.scenes.find((s) => s.id === card.dataset.id);
  if (!scene) return;
  scene[field] = e.target.value;
  scheduleSave();
});

/* drag & drop reorder — SortableJS (dokunmatik + animasyonlu) */
let sceneSortable = null;

async function ensureSortable() {
  if (window.Sortable) return window.Sortable;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = '/vendor/sortable.min.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return window.Sortable;
}

async function initSceneSortable() {
  const Sortable = await ensureSortable();
  if (!Sortable || sceneSortable) return;
  sceneSortable = Sortable.create(el.sceneList, {
    handle: '.handle',
    animation: 160,
    ghostClass: 'dragging',
    dragClass: 'drag-ghost',
    onEnd: () => {
      const order = [...el.sceneList.querySelectorAll('.scene')].map((n) => n.dataset.id);
      const byId = new Map(state.scenes.map((s) => [s.id, s]));
      const next = order.map((id) => byId.get(id)).filter(Boolean);
      if (next.length !== state.scenes.length) return;
      state.scenes = next;
      renderScenes();
      scheduleSave();
    },
  });
}

initSceneSortable();

// Sahne planı hikâye bazlı: seçim yapınca o hikâyenin sahneleri gösterilir.
el.sceneStorySelect.addEventListener('change', () => {
  switchStory(el.sceneStorySelect.value);
});

$('#addScene').addEventListener('click', () => {
  state.scenes.push({
    id: crypto.randomUUID(),
    title: `Sahne ${state.scenes.length + 1}`,
    summary: '',
    beats: [],
    purpose: 'Gelişme',
    estimatedMinutes: 1,
    words: 0,
    source: 'manual',
    approved: false,
  });
  renderScenes();
  scheduleSave();
  const last = el.sceneList.querySelector('.scene:last-child');
  if (last) {
    last.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    last.querySelector('.s-title')?.focus();
  }
  toast('Yeni sahne eklendi.');
});

$('#exportScenes').addEventListener('click', () => {
  if (!state.scenes.length) {
    toast('Aktarılacak sahne yok.', true);
    return;
  }
  const md = state.scenes
    .map((s, i) => `## ${i + 1}. ${s.title}\n\n${s.summary}\n\n- Amaç: ${s.purpose}\n- Süre: ~${s.estimatedMinutes} dk\n- Durum: ${s.approved ? 'onaylı' : 'taslak'}\n`)
    .join('\n');
  const blob = new Blob([`# Sahne Planı\n\n${md}`], { type: 'text/markdown;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sahne-plani.md';
  a.click();
  URL.revokeObjectURL(a.href);
});

/* ---------------- characters ---------------- */
let charFilter = 'all';
let charQuery = '';
let pendingImageCharId = null;

// Fuse.js tembel yüklenir: yalnızca arama yapıldığında indirilir.
let FuseCtor = null;
let fuseIndex = null;
let fuseIndexKey = '';

async function ensureFuse() {
  if (FuseCtor) return FuseCtor;
  try {
    const mod = await import('/vendor/fuse.min.mjs');
    FuseCtor = mod.default || mod.Fuse || mod;
  } catch {
    FuseCtor = null;
  }
  return FuseCtor;
}

function charHaystack(c) {
  return [
    c.name, c.nickname, c.family, c.description, c.note,
    storyTitle(c.storyId),
    ...(c.traits || []),
    ...(c.features || []).flatMap((f) => [f.title, f.detail]),
  ].filter(Boolean).join(' ');
}

// Arama sonucu: bulanık eşleşen karakter id'leri (skor sırasıyla).
let fuzzyHits = null;

function buildFuseIndex() {
  const key = state.characters.map((c) => c.id + '|' + charHaystack(c)).join('\u0001');
  if (key === fuseIndexKey && fuseIndex) return fuseIndex;
  fuseIndexKey = key;
  fuseIndex = new FuseCtor(state.characters, {
    includeScore: true,
    threshold: 0.42,
    ignoreLocation: true,
    minMatchCharLength: 2,
    keys: [
      { name: 'name', weight: 3 },
      { name: 'nickname', weight: 2 },
      { name: 'family', weight: 1.5 },
      { name: 'features.title', weight: 1.5 },
      { name: 'features.detail', weight: 1 },
      { name: 'description', weight: 1 },
      { name: 'note', weight: 1 },
      { name: 'traits', weight: 1 },
    ],
  });
  return fuseIndex;
}

function charMatches(c) {
  if (charFilter !== 'all' && c.role !== charFilter) return false;
  const storyFilter = el.charStoryFilter ? el.charStoryFilter.value : 'all';
  if (storyFilter !== 'all' && c.storyId !== storyFilter) return false;
  const q = charQuery.trim();
  if (!q) return true;
  // Bulanık arama hazırsa onun sonucunu kullan (Türkçe harf hatalarını tolere eder).
  if (fuzzyHits) return fuzzyHits.has(c.id);
  const hay = charHaystack(c).toLocaleLowerCase('tr-TR');
  return hay.includes(q.toLocaleLowerCase('tr-TR'));
}

function charAvatar(c) {
  if (c.image) {
    return `<span class="c-avatar has-img"><img src="${esc(c.image)}" alt="${esc(c.name)}" /></span>`;
  }
  return `<span class="c-avatar">${esc((c.name || '?').slice(0, 1))}</span>`;
}

function featureRow(c, f, i) {
  return `
    <div class="c-feature" data-feat="${i}">
      <div class="cf-head">
        <input class="cf-title" data-featfield="title" value="${esc(f.title)}" placeholder="Özellik başlığı (örn. Anne Terliği)" />
        <button class="btn ghost small" data-act="delfeat" data-feat="${i}" title="Özelliği sil">✕</button>
      </div>
      <textarea class="cf-detail" data-featfield="detail" rows="2" placeholder="Bu özellik nasıl görünür, nerede ortaya çıkar?">${esc(f.detail)}</textarea>
    </div>`;
}

function charCard(c) {
  const features = (c.features || []).length
    ? c.features.map((f, i) => featureRow(c, f, i)).join('')
    : '<p class="muted cf-none">Henüz özellik yok. “+ Özellik” ile ekle.</p>';
  return `
    <article class="char-card ${c.open ? 'open' : ''}${selectedCharIds.has(c.id) ? ' selected' : ''}" data-id="${c.id}">
      <header class="c-head" data-act="toggle">
        <input type="checkbox" class="c-select" data-act="select"${selectedCharIds.has(c.id) ? ' checked' : ''} title="Seç" aria-label="${esc(c.name)} seç" />
        ${charAvatar(c)}
        <div class="c-title">
          <strong>${esc(c.name)}</strong>
          ${c.nickname ? `<span class="c-nick">“${esc(c.nickname)}”</span>` : ''}
        </div>
        <span class="chip story">${esc(storyTitle(c.storyId))}</span>
        <span class="chip purpose">${esc(c.family)}</span>
        <span class="chip">${c.role === 'yan' ? 'yan' : 'ana'}</span>
        <span class="c-caret">▾</span>
      </header>
      <div class="c-body">
        <div class="c-identity">
          <label class="c-field">
            <span>İsim (hikâyede de değişir)</span>
            <input data-field="name" value="${esc(c.name)}" />
          </label>
          <label class="c-field">
            <span>Takma ad</span>
            <input data-field="nickname" value="${esc(c.nickname || '')}" />
          </label>
          <label class="c-field">
            <span>Hikâye</span>
            <select data-field="storyId">
              ${state.stories.map((s) => `<option value="${esc(s.id)}"${s.id === c.storyId ? ' selected' : ''}>${esc(storyLabel(s))}</option>`).join('')}
            </select>
          </label>
        </div>

        <div class="c-img-row">
          <button class="btn ghost small" data-act="image">${c.image ? 'Resmi değiştir' : '＋ Resim ekle'}</button>
          ${c.image ? '<button class="btn ghost small" data-act="delimage">Resmi kaldır</button>' : ''}
          <span class="c-img-hint">ya da resmi buraya sürükle / Ctrl+V ile yapıştır</span>
        </div>

        <div class="c-features-head">
          <span>Özellikler</span>
          <button class="btn ghost small" data-act="addfeat">+ Özellik</button>
        </div>
        <div class="c-features">${features}</div>

        <label class="c-field">
          <span>Kısa tanıtım</span>
          <textarea data-field="description" rows="3">${esc(c.description)}</textarea>
        </label>
        <label class="c-field">
          <span>Aile bağları / notlar</span>
          <textarea data-field="note" rows="2" placeholder="Örn. Doğa'nın kardeşi, Tufan'ın kuzeni…">${esc(c.note)}</textarea>
          ${c.note ? '' : '<span class="c-field-hint">Boş. “Aile bağlarını çıkar” ile metinden doldur ya da elle yaz.</span>'}
        </label>
        <div class="c-actions">
          <button class="btn ghost small" data-act="delete">Sil</button>
        </div>
      </div>
    </article>`;
}

/* ---------------- karakter toplu işlem ---------------- */
const selectedCharIds = new Set();

function renderBulkBar(visible) {
  const bar = $('#bulkBar');
  if (!bar) return;
  const n = selectedCharIds.size;
  bar.hidden = n === 0;
  if (!n) return;
  $('#bulkCount').textContent = `${n} karakter seçili`;
  const storyOpts = state.stories
    .map((s) => `<option value="${esc(s.id)}">${esc(storyLabel(s))}</option>`)
    .join('');
  $('#bulkStorySelect').innerHTML = `<option value="">Hikâyeye bağla…</option>${storyOpts}`;
  const allVisibleSelected = visible.length > 0 && visible.every((c) => selectedCharIds.has(c.id));
  $('#bulkSelectAll').textContent = allVisibleSelected ? 'Seçimi kaldır' : 'Görünenleri seç';
}

function bulkApply(fn) {
  const targets = state.characters.filter((c) => selectedCharIds.has(c.id));
  if (!targets.length) return 0;
  for (const c of targets) fn(c);
  renderCharacters();
  scheduleSave();
  return targets.length;
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('#bulkBar [data-bulk]');
  if (!btn) return;
  const act = btn.dataset.bulk;

  if (act === 'clear') {
    selectedCharIds.clear();
    renderCharacters();
  } else if (act === 'selectall') {
    const visible = state.characters.filter(charMatches);
    const allSelected = visible.length > 0 && visible.every((c) => selectedCharIds.has(c.id));
    if (allSelected) for (const c of visible) selectedCharIds.delete(c.id);
    else for (const c of visible) selectedCharIds.add(c.id);
    renderCharacters();
  } else if (act === 'delete') {
    const n = selectedCharIds.size;
    if (!confirm(`${n} karakter tamamen silinsin mi?\n\nResimleri ve özellikleriyle birlikte silinir. Bu işlem geri alınamaz.`)) return;
    state.characters = state.characters.filter((c) => !selectedCharIds.has(c.id));
    selectedCharIds.clear();
    renderCharacters();
    scheduleSave();
    toast(`${n} karakter silindi.`);
  } else if (act === 'role') {
    const role = $('#bulkRoleSelect').value;
    if (!role) return;
    const n = bulkApply((c) => { c.role = role; });
    toast(`${n} karakter “${role === 'yan' ? 'yan' : 'ana'}” olarak işaretlendi.`);
  } else if (act === 'family') {
    const family = ($('#bulkFamilyInput').value || '').trim();
    if (!family) { toast('Aile adı yaz.', true); return; }
    const n = bulkApply((c) => { c.family = family; });
    toast(`${n} karakter “${family}” ailesine taşındı.`);
  } else if (act === 'story') {
    const storyId = $('#bulkStorySelect').value;
    if (!storyId) return;
    const n = bulkApply((c) => { c.storyId = storyId; });
    toast(`${n} karakter “${storyTitle(storyId)}” hikâyesine bağlandı.`);
  }
});

/* ---------------- notlar ---------------- */
let noteFilter = 'all';

function newNote(text = '') {
  return {
    id: newStoryId(),
    title: '',
    body: text,
    tags: [],
    storyId: '',
    pinned: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function noteMatches(n) {
  if (noteFilter === 'pinned') return !!n.pinned;
  if (noteFilter === 'story') return !!n.storyId;
  if (noteFilter.startsWith('tag:')) return (n.tags || []).includes(noteFilter.slice(4));
  return true;
}

function noteSearchText(n) {
  return [n.title, n.body, (n.tags || []).join(' ')].join(' ').toLocaleLowerCase('tr');
}

function renderNotes() {
  const list = $('#noteList');
  if (!list) return;
  const all = Array.isArray(state.notes) ? state.notes : [];
  const q = ($('#noteSearch')?.value || '').trim().toLocaleLowerCase('tr');

  // Etiket filtresi düğmeleri
  const tags = [...new Set(all.flatMap((n) => n.tags || []))].sort((a, b) => a.localeCompare(b, 'tr'));
  const filters = $('#noteFilters');
  if (filters) {
    const opts = [
      ['all', 'Tümü'],
      ['pinned', '📌 Sabitlenenler'],
      ['story', 'Hikâyeye bağlı'],
      ...tags.map((t) => ['tag:' + t, '#' + t]),
    ];
    filters.innerHTML = opts
      .map(([v, label]) => `<button class="nfilter${noteFilter === v ? ' active' : ''}" data-nfilter="${esc(v)}">${esc(label)}</button>`)
      .join('');
  }

  const visible = all
    .filter(noteMatches)
    .filter((n) => !q || noteSearchText(n).includes(q))
    .sort((a, b) => {
      if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
      return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
    });

  const count = $('#noteCount');
  if (count) count.textContent = all.length;
  const stats = $('#noteStats');
  if (stats) {
    const pinned = all.filter((n) => n.pinned).length;
    stats.textContent = `${visible.length}/${all.length} not${pinned ? ` · ${pinned} sabit` : ''}`;
  }
  const empty = $('#noteEmpty');
  if (empty) {
    empty.hidden = visible.length > 0;
    empty.innerHTML = all.length
      ? '<p>Bu filtreye uyan not yok.</p><p class="muted">Aramayı temizle ya da filtreyi değiştir.</p>'
      : '<p>Henüz not yok.</p><p class="muted"><strong>＋ Not ekle</strong>\'ye bas ya da aşağıdaki hızlı ekleme kutusunu kullan.</p>';
  }

  list.innerHTML = visible.map(noteCard).join('');
}

function noteCard(n) {
  const tags = (n.tags || []).map((t) => `
    <span class="note-tag">#${esc(t)}<button data-nact="deltag" data-tag="${esc(t)}" title="Etiketi kaldır">✕</button></span>`).join('');
  const storyChip = n.storyId
    ? `<span class="chip story">${esc(storyTitle(n.storyId))}</span>`
    : '';
  const when = n.updatedAt ? fmtDate(n.updatedAt) : '';
  return `
    <article class="note-card${n.pinned ? ' pinned' : ''}" data-note="${esc(n.id)}">
      <div class="note-head">
        ${n.pinned ? '<span class="chip">📌 sabit</span>' : ''}
        ${storyChip}
        <div class="note-actions">
          <button class="btn ghost small" data-nact="pin" title="${n.pinned ? 'Sabitlemeyi kaldır' : 'Üste sabitle'}">${n.pinned ? 'Sabitlemeyi kaldır' : 'Sabitle'}</button>
          <button class="btn ghost small" data-nact="copy" title="Notu panoya kopyala">Kopyala</button>
          <button class="btn ghost small" data-nact="toeditor" title="Notu hikâye metnine ekle">Metne ekle</button>
          <button class="btn ghost small danger" data-nact="delete" title="Notu sil">Sil</button>
        </div>
      </div>
      <input class="note-title" data-nfield="title" value="${esc(n.title || '')}" placeholder="Not başlığı (isteğe bağlı)" />
      <textarea class="note-body" data-nfield="body" rows="3" placeholder="Aklındakini yaz…">${esc(n.body || '')}</textarea>
      <div class="note-foot">
        <div class="note-tags">${tags}</div>
        <input class="note-tag-input" data-nact="addtag" placeholder="+ etiket" title="Etiket yaz ve Enter'a bas" />
        <select class="note-tag-input" data-nfield="storyId" title="Notu bir hikâyeye bağla" style="width:auto">
          <option value="">Hikâye yok</option>
          ${state.stories.map((s) => `<option value="${esc(s.id)}"${s.id === n.storyId ? ' selected' : ''}>${esc(storyLabel(s))}</option>`).join('')}
        </select>
        <span class="note-meta">${esc(when)}</span>
      </div>
    </article>`;
}

function findNote(node) {
  const card = node.closest('.note-card');
  if (!card) return null;
  return (state.notes || []).find((n) => n.id === card.dataset.note) || null;
}

function addNote(text = '') {
  state.notes = Array.isArray(state.notes) ? state.notes : [];
  const n = newNote(text);
  state.notes.unshift(n);
  renderNotes();
  scheduleSave();
  return n;
}

document.addEventListener('click', (e) => {
  const fbtn = e.target.closest('[data-nfilter]');
  if (fbtn) {
    noteFilter = fbtn.dataset.nfilter;
    renderNotes();
    return;
  }

  const btn = e.target.closest('[data-nact]');
  if (!btn) return;
  const act = btn.dataset.nact;
  if (act === 'addtag') return; // input, click ile çalışmaz

  const n = findNote(btn);
  if (!n) return;

  if (act === 'pin') {
    n.pinned = !n.pinned;
    n.updatedAt = new Date().toISOString();
    renderNotes();
    scheduleSave();
  } else if (act === 'delete') {
    const preview = (n.title || n.body || '').slice(0, 40);
    if (!confirm(`Not silinsin mi?\n\n“${preview}${preview.length >= 40 ? '…' : ''}”`)) return;
    state.notes = state.notes.filter((x) => x.id !== n.id);
    renderNotes();
    scheduleSave();
    toast('Not silindi.');
  } else if (act === 'copy') {
    const text = [n.title, n.body].filter(Boolean).join('\n\n');
    navigator.clipboard?.writeText(text).then(
      () => toast('Not panoya kopyalandı.'),
      () => toast('Panoya kopyalanamadı.', true),
    );
  } else if (act === 'toeditor') {
    const text = [n.title, n.body].filter(Boolean).join('\n\n');
    if (!text.trim()) { toast('Not boş.', true); return; }
    const cur = el.editor.value;
    el.editor.value = cur.trim() ? `${cur.replace(/\s+$/, '')}\n\n${text}` : text;
    updateWordCount();
    scheduleSave();
    document.querySelector('.tab[data-view="write"]').click();
    toast('Not hikâye metnine eklendi.');
  } else if (act === 'deltag') {
    const tag = btn.dataset.tag;
    n.tags = (n.tags || []).filter((t) => t !== tag);
    n.updatedAt = new Date().toISOString();
    renderNotes();
    scheduleSave();
  }
});

document.addEventListener('input', (e) => {
  const field = e.target.dataset.nfield;
  if (!field) return;
  const n = findNote(e.target);
  if (!n) return;
  n[field] = e.target.value;
  n.updatedAt = new Date().toISOString();
  scheduleSave();
  // Başlık/gövde yazarken listeyi yeniden çizme (imleç kaybolur); yalnızca sayaç güncelle.
  const stats = $('#noteStats');
  if (stats) {
    const all = state.notes || [];
    const pinned = all.filter((x) => x.pinned).length;
    stats.textContent = `${all.length}/${all.length} not${pinned ? ` · ${pinned} sabit` : ''}`;
  }
});

document.addEventListener('change', (e) => {
  if (e.target.dataset.nfield !== 'storyId') return;
  const n = findNote(e.target);
  if (!n) return;
  n.storyId = e.target.value;
  n.updatedAt = new Date().toISOString();
  renderNotes();
  scheduleSave();
});

// Etiket ekleme: Enter veya virgül.
document.addEventListener('keydown', (e) => {
  if (e.target.dataset.nact !== 'addtag') return;
  if (e.key !== 'Enter' && e.key !== ',') return;
  e.preventDefault();
  const n = findNote(e.target);
  if (!n) return;
  const tag = e.target.value.trim().replace(/^#/, '').replace(/[,\s]+$/, '');
  if (!tag) return;
  n.tags = [...new Set([...(n.tags || []), tag])];
  n.updatedAt = new Date().toISOString();
  e.target.value = '';
  renderNotes();
  scheduleSave();
});

function exportNotes() {
  const all = state.notes || [];
  if (!all.length) { toast('Dışa aktarılacak not yok.', true); return; }
  const sorted = [...all].sort((a, b) => {
    if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
    return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
  });
  const md = ['# Notlar', '', `_${all.length} not · ${new Date().toLocaleDateString('tr-TR')}_`, ''];
  for (const n of sorted) {
    md.push(`## ${n.pinned ? '📌 ' : ''}${n.title || '(başlıksız)'}`);
    if (n.storyId) md.push(`*Hikâye: ${storyTitle(n.storyId)}*`);
    if ((n.tags || []).length) md.push(`Etiketler: ${n.tags.map((t) => '#' + t).join(' ')}`);
    md.push('', n.body || '', '');
  }
  const blob = new Blob([md.join('\n')], { type: 'text/markdown;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'hayalhane-notlar.md';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(`${all.length} not Markdown olarak indirildi.`);
}

function renderCharacters() {
  const all = state.characters || [];
  el.charCount.textContent = all.length;

  const visible = all.filter(charMatches);
  el.charEmpty.hidden = charView === 'tree' || visible.length > 0;
  el.charEmpty.innerHTML = all.length
    ? '<p>Bu filtreye uyan karakter yok.</p><p class="muted">Arama kutusunu temizle ya da filtreyi değiştir.</p>'
    : '<p>Henüz karakter yok.</p><p class="muted">Dünya dosyası yüklüyse <strong>Dünya dosyasından çıkar</strong>\'a bas ya da elle karakter ekle.</p>';

  // Silinen karakterlerin seçimini temizle.
  const liveIds = new Set(all.map((c) => c.id));
  for (const id of [...selectedCharIds]) if (!liveIds.has(id)) selectedCharIds.delete(id);
  renderBulkBar(visible);

  const byStory = new Map();
  for (const c of visible) {
    const key = c.storyId || 'none';
    if (!byStory.has(key)) byStory.set(key, []);
    byStory.get(key).push(c);
  }

  el.charList.innerHTML = [...byStory.entries()]
    .map(([storyId, members]) => {
      const groups = new Map();
      for (const c of members) {
        const key = c.family || 'Aile';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(c);
      }
      return `
        <section class="char-story">
          <h2 class="cs-head">${esc(storyTitle(storyId))} <span class="muted">${members.length} karakter</span></h2>
          ${[...groups.entries()].map(([family, list]) => `
            <section class="char-group">
              <div class="cg-head">
                <h3>${esc(family)}</h3>
                <span class="muted">${list.length} kişi · ${list.map((m) => esc(m.name)).join(', ')}</span>
              </div>
              ${list.map(charCard).join('')}
            </section>`).join('')}
        </section>`;
    })
    .join('');
}

/* ---------------- aile ağacı (cytoscape) ---------------- */
let charView = 'cards';
let cyInstance = null;
let CytoscapeCtor = null;

const FAMILY_COLORS = [
  '#5aa9e6', '#7fd6a2', '#e6b95a', '#d98cc8', '#8f9ce6',
  '#e68a5a', '#5ad6cf', '#c9d65a', '#e65a7a', '#9ae65a',
];

function familyColor(family) {
  const key = String(family || '');
  if (/^yan/i.test(key)) return '#8b93a1';
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) % 9973;
  return FAMILY_COLORS[h % FAMILY_COLORS.length];
}

async function ensureCytoscape() {
  if (CytoscapeCtor) return CytoscapeCtor;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = '/vendor/cytoscape.min.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  CytoscapeCtor = window.cytoscape;
  return CytoscapeCtor;
}

// Karakterlerden graf düğümleri/kenarları üretir.
// Kenarlar: aynı aile grubu (kardeş/kuzen) + notta geçen diğer karakter adları.
function buildGraphElements(chars) {
  const nodes = chars.map((c) => ({
    data: {
      id: c.id,
      label: c.name || '?',
      family: c.family || 'Aile',
      role: c.role === 'yan' ? 'yan' : 'ana',
      color: familyColor(c.family),
      hasImage: !!c.image,
    },
  }));

  const edges = [];
  const seen = new Set();
  const addEdge = (a, b, kind, label) => {
    if (!a || !b || a === b) return;
    const key = [a, b].sort().join('|') + '|' + kind;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ data: { id: 'e' + edges.length, source: a, target: b, kind, label } });
  };

  // 1) Aynı aile grubundaki ana karakterler kardeş kabul edilir.
  const byFamily = new Map();
  for (const c of chars) {
    if (c.role === 'yan') continue;
    const f = c.family || 'Aile';
    if (!byFamily.has(f)) byFamily.set(f, []);
    byFamily.get(f).push(c);
  }
  for (const [, members] of byFamily) {
    for (let i = 0; i < members.length; i += 1) {
      for (let j = i + 1; j < members.length; j += 1) {
        addEdge(members[i].id, members[j].id, 'sibling', 'kardeş');
      }
    }
  }

  // 2) Notlarda / açıklamalarda başka bir karakterin adı geçiyorsa bağ kur.
  const byName = new Map(chars.map((c) => [String(c.name || '').toLocaleLowerCase('tr-TR'), c]));
  const haystack = (c) => [
    c.note,
    c.description,
    c.traits,
    ...(c.features || []).map((f) => `${f.title || ''} ${f.detail || ''}`),
  ].filter(Boolean).join(' ').toLocaleLowerCase('tr-TR');

  for (const c of chars) {
    const text = haystack(c);
    if (!text) continue;
    for (const [name, other] of byName) {
      if (name.length < 2 || other.id === c.id) continue;
      if (text.includes(name)) addEdge(c.id, other.id, 'note', 'not');
    }
  }

  // 3) Hiç bağı olmayan yan karakterleri hikâyesinin ilk ana karakterine bağla.
  const linked = new Set(edges.flatMap((e) => [e.data.source, e.data.target]));
  const firstMain = new Map();
  for (const c of chars) {
    if (c.role === 'yan') continue;
    const key = c.storyId || 'none';
    if (!firstMain.has(key)) firstMain.set(key, c.id);
  }
  for (const c of chars) {
    if (c.role !== 'yan' || linked.has(c.id)) continue;
    addEdge(c.id, firstMain.get(c.storyId || 'none'), 'story', 'hikâye');
  }

  return [...nodes, ...edges];
}

function renderTreeLegend(chars) {
  const families = [...new Set(chars.map((c) => c.family || 'Aile'))];
  el.treeLegend.innerHTML = families
    .map((f) => `<span><i style="background:${familyColor(f)}"></i>${esc(f)}</span>`)
    .join('') + '<span><i style="background:#4a5a6e"></i>bağ: kardeş / not</span>';
}

async function renderTree() {
  const chars = (state.characters || []).filter(charMatches);
  if (!chars.length) {
    if (cyInstance) { cyInstance.destroy(); cyInstance = null; }
    el.treeLegend.innerHTML = '<span>Gösterilecek karakter yok.</span>';
    return;
  }
  const cy = await ensureCytoscape();
  if (!cy) return;

  const elements = buildGraphElements(chars);
  if (cyInstance) cyInstance.destroy();
  cyInstance = cy({
    container: document.getElementById('cy'),
    elements,
    style: [
      {
        selector: 'node',
        style: {
          'background-color': 'data(color)',
          'background-opacity': 0.22,
          'border-width': 2,
          'border-color': 'data(color)',
          label: 'data(label)',
          color: '#dbe4ef',
          'font-size': 11,
          'font-weight': 600,
          'text-valign': 'bottom',
          'text-margin-y': 6,
          'text-outline-width': 2,
          'text-outline-color': '#0e141c',
          width: 34,
          height: 34,
        },
      },
      { selector: 'node[role = "yan"]', style: { shape: 'round-rectangle', width: 30, height: 30 } },
      { selector: 'node:selected', style: { 'border-width': 4, 'background-opacity': 0.5 } },
      {
        selector: 'edge',
        style: {
          width: 1.6,
          'line-color': '#3a4a5e',
          'curve-style': 'bezier',
          'target-arrow-shape': 'none',
          opacity: 0.85,
        },
      },
      { selector: 'edge[kind = "note"]', style: { 'line-style': 'dashed', 'line-color': '#5a6a80' } },
      { selector: 'edge[kind = "story"]', style: { 'line-style': 'dotted', 'line-color': '#4a5a6e', opacity: 0.5 } },
    ],
    layout: { name: 'cose', animate: false, padding: 40, nodeRepulsion: 9000, idealEdgeLength: 90 },
    wheelSensitivity: 0.2,
  });

  cyInstance.on('tap', 'node', (evt) => {    const id = evt.target.id();    const c = state.characters.find((x) => x.id === id);
    if (!c) return;
    // Kart görünümüne geç ve kartı aç.
    setCharView('cards');
    c.open = true;
    renderCharacters();
    const card = el.charList.querySelector(`.char-card[data-id="${id}"]`);
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  renderTreeLegend(chars);
  window.__cy = cyInstance;
}

function setCharView(view) {
  charView = view;
  document.querySelectorAll('[data-cview]').forEach((b) => b.classList.toggle('active', b.dataset.cview === view));
  const tree = view === 'tree';
  el.treeWrap.hidden = !tree;
  el.charList.hidden = tree;
  if (tree) {
    el.charEmpty.hidden = true;
    renderTree();
  } else {
    if (cyInstance) cyInstance.resize();
    renderCharacters();
  }
}

function findChar(node) {  const card = node.closest('.char-card');
  if (!card) return null;
  return state.characters.find((x) => x.id === card.dataset.id) || null;
}

// İsim değişince hikâye metinlerinde, sahne özetlerinde ve diğer karakter
// notlarında geçen eski ismi de günceller.
function replaceNameEverywhere(oldName, newName) {
  const from = String(oldName || '').trim();
  const to = String(newName || '').trim();
  if (!from || !to || from === to) return 0;
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'gu');
  let hits = 0;
  const swap = (text) => {
    if (typeof text !== 'string' || !text) return text;
    return text.replace(pattern, () => { hits += 1; return to; });
  };

  for (const s of state.stories) {
    s.draft = swap(s.draft);
    for (const sc of s.scenes || []) {
      sc.title = swap(sc.title);
      sc.summary = swap(sc.summary);
      if (Array.isArray(sc.beats)) sc.beats = sc.beats.map(swap);
    }
  }
  if (state.world) {
    state.world.text = swap(state.world.text);
    state.world.markdown = swap(state.world.markdown);
    state.world.story = swap(state.world.story);
  }
  for (const other of state.characters) {
    other.note = swap(other.note);
    other.description = swap(other.description);
    for (const f of other.features || []) f.detail = swap(f.detail);
  }
  if (el.editor.value) el.editor.value = swap(el.editor.value);
  if (state.world && el.worldText && !el.worldInfo.hidden) el.worldText.value = currentWorldText();
  return hits;
}

el.charList.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const c = findChar(btn);
  if (!c) return;
  const act = btn.dataset.act;

  if (act === 'toggle') {
    c.open = !c.open;
    btn.closest('.char-card').classList.toggle('open', c.open);
  } else if (act === 'select') {
    if (btn.checked) selectedCharIds.add(c.id);
    else selectedCharIds.delete(c.id);
    btn.closest('.char-card').classList.toggle('selected', btn.checked);
    renderBulkBar(state.characters.filter(charMatches));
  } else if (act === 'delete') {
    if (!confirm(`${c.name} silinsin mi?`)) return;
    state.characters = state.characters.filter((x) => x.id !== c.id);
    renderCharacters();
    scheduleSave();
  } else if (act === 'addfeat') {
    c.features = c.features || [];
    c.features.push({ id: newStoryId(), title: '', detail: '' });
    c.open = true;
    renderCharacters();
    scheduleSave();
  } else if (act === 'delfeat') {
    const i = Number(btn.dataset.feat);
    c.features.splice(i, 1);
    renderCharacters();
    scheduleSave();
  } else if (act === 'image') {
    pendingImageCharId = c.id;
    $('#charImageInput').click();
  } else if (act === 'delimage') {
    c.image = '';
    renderCharacters();
    scheduleSave();
  }
});

el.charList.addEventListener('input', (e) => {
  const c = findChar(e.target);
  if (!c) return;

  const featField = e.target.dataset.featfield;
  if (featField) {
    const i = Number(e.target.closest('[data-feat]').dataset.feat);
    c.features = c.features || [];
    if (c.features[i]) c.features[i][featField] = e.target.value;
    scheduleSave();
    return;
  }

  const field = e.target.dataset.field;
  if (!field || field === 'name' || field === 'storyId') return;
  c[field] = e.target.value;
  scheduleSave();
});

// İsim ve hikâye ataması değişince listeyi ve hikâye metnini güncelle.
el.charList.addEventListener('change', (e) => {
  const c = findChar(e.target);
  if (!c) return;

  if (e.target.dataset.field === 'name') {
    const oldName = c.name;
    const newName = e.target.value.trim();
    if (!newName) { e.target.value = oldName; return; }
    c.name = newName;
    const hits = replaceNameEverywhere(oldName, newName);
    renderCharacters();
    scheduleSave();
    toast(hits
      ? `“${oldName}” → “${newName}”: hikâyede ${hits} yerde güncellendi.`
      : `“${oldName}” → “${newName}” olarak değiştirildi.`);
  } else if (e.target.dataset.field === 'storyId') {
    c.storyId = e.target.value;
    renderCharacters();
    scheduleSave();
  }
});

$('#charImageInput').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file || !pendingImageCharId) return;
  const c = state.characters.find((x) => x.id === pendingImageCharId);
  pendingImageCharId = null;
  if (!c) return;
  await applyCharImage(c, file);
});

async function applyCharImage(c, file) {
  if (!/^image\//.test(file.type)) {
    toast('Lütfen bir resim dosyası seç.', true);
    return;
  }
  try {
    c.image = await shrinkImage(file, 320);
    renderCharacters();
    scheduleSave();
    toast(`${c.name} için resim eklendi.`);
  } catch (err) {
    toast('Resim yüklenemedi: ' + err.message, true);
  }
}

// Resmi karta sürükle-bırak.
el.charList.addEventListener('dragover', (e) => {
  const card = e.target.closest('.char-card');
  if (!card || !e.dataTransfer.types.includes('Files')) return;
  e.preventDefault();
  card.classList.add('img-over');
});
el.charList.addEventListener('dragleave', (e) => {
  e.target.closest('.char-card')?.classList.remove('img-over');
});
el.charList.addEventListener('drop', async (e) => {
  const card = e.target.closest('.char-card');
  if (!card) return;
  card.classList.remove('img-over');
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (!file) return;
  e.preventDefault();
  const c = state.characters.find((x) => x.id === card.dataset.id);
  if (c) await applyCharImage(c, file);
});

// Panodan yapıştırma: açık karta Ctrl+V ile resim ekle.
document.addEventListener('paste', async (e) => {
  const items = [...(e.clipboardData?.items || [])];
  const imageItem = items.find((i) => i.type.startsWith('image/'));
  if (!imageItem) return;
  const openCard = el.charList.querySelector('.char-card.open');
  if (!openCard) return;
  const c = state.characters.find((x) => x.id === openCard.dataset.id);
  const file = imageItem.getAsFile();
  if (!c || !file) return;
  e.preventDefault();
  await applyCharImage(c, file);
});

// Resmi tarayıcıda küçültüp data URL olarak saklar (proje dosyası şişmesin).
function shrinkImage(file, maxSize) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('dosya okunamadı'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('resim açılamadı'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

el.charSearch.addEventListener('input', async () => {
  charQuery = el.charSearch.value;
  const q = charQuery.trim();
  if (!q) {
    fuzzyHits = null;
    renderCharacters();
    return;
  }
  // Önce hızlı birebir sonuç göster, sonra bulanık sonuçla güncelle.
  fuzzyHits = null;
  renderCharacters();
  const Fuse = await ensureFuse();
  if (!Fuse) return;
  if (el.charSearch.value !== charQuery) return; // kullanıcı yazmaya devam etti
  try {
    const results = buildFuseIndex().search(q);
    fuzzyHits = new Set(results.map((r) => r.item.id));
    renderCharacters();
  } catch {
    fuzzyHits = null;
  }
});

el.charStoryFilter.addEventListener('change', renderCharacters);

document.querySelectorAll('[data-cview]').forEach((b) => {
  b.addEventListener('click', () => setCharView(b.dataset.cview));
});

const treeFitBtn = $('#treeFit');
if (treeFitBtn) treeFitBtn.addEventListener('click', () => { if (cyInstance) cyInstance.fit(undefined, 40); });
const treeRelayoutBtn = $('#treeRelayout');
if (treeRelayoutBtn) {
  treeRelayoutBtn.addEventListener('click', () => {
    if (!cyInstance) return;
    cyInstance.layout({ name: 'cose', animate: true, padding: 40, nodeRepulsion: 9000, idealEdgeLength: 90 }).run();
  });
}
document.querySelectorAll('[data-cfilter]').forEach((b) => {
  b.addEventListener('click', () => {
    charFilter = b.dataset.cfilter;
    document.querySelectorAll('[data-cfilter]').forEach((x) => x.classList.toggle('active', x === b));
    renderCharacters();
  });
});

$('#addChar').addEventListener('click', () => {
  state.characters.push({
    id: newStoryId(),
    name: 'Yeni Karakter',
    nickname: '',
    family: 'Aile',
    role: 'ana',
    storyId: state.activeStoryId,
    description: '',
    features: [],
    traits: [],
    note: '',
    image: '',
    source: 'manual',
    open: true,
  });
  renderCharacters();
  scheduleSave();
});

async function autoExtractCharacters() {
  const source = state.world ? (state.world.text || state.world.markdown || '') : '';
  if (!source.trim()) return;
  try {
    const res = await fetch('/api/characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: source }),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (!data.characters?.length) return;
    state.characters = data.characters.map((c) => ({ ...c, storyId: state.activeStoryId }));
    renderCharacters();
    scheduleSave();
  } catch { /* sessizce geç */ }
}

$('#extractChars').addEventListener('click', async () => {
  const source = state.world ? (state.world.text || state.world.markdown || '') : '';
  if (!source.trim()) {
    toast('Önce Dünya Dosyası sekmesinden bir dosya yükle.', true);
    return;
  }
  const btn = $('#extractChars');
  btn.disabled = true;
  btn.textContent = 'Çıkarılıyor…';
  try {
    const res = await fetch('/api/characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: source }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'karakter çıkarılamadı');
    if (!data.characters.length) {
      toast('Karakter bulunamadı. Dosyada "1. Ana Karakterler" bölümü var mı?', true);
      return;
    }
    const existing = new Set(state.characters.map((c) => c.name.toLocaleLowerCase('tr-TR')));
    const fresh = data.characters
      .filter((c) => !existing.has(c.name.toLocaleLowerCase('tr-TR')))
      .map((c) => ({ ...c, storyId: state.activeStoryId }));
    state.characters = [...state.characters, ...fresh];
    renderCharacters();
    scheduleSave();
    toast(fresh.length
      ? `${fresh.length} karakter eklendi.`
      : 'Yeni karakter yok; hepsi zaten listede.');
  } catch (err) {
    toast('Karakter çıkarma hatası: ' + err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Dünya dosyasından çıkar';
  }
});

// Dünya metninden aile bağlarını çıkarır. Kullanıcının yazdığı notlar korunur;
// yalnızca boş notlar doldurulur, dolu notlar öneri olarak gösterilir.
$('#extractTies').addEventListener('click', async () => {
  const source = state.world ? (state.world.text || state.world.markdown || '') : '';
  if (!source.trim()) {
    toast('Önce Dünya Dosyası sekmesinden bir dosya yükle.', true);
    return;
  }
  if (!state.characters.length) {
    toast('Önce karakter çıkar ya da elle karakter ekle.', true);
    return;
  }
  const btn = $('#extractTies');
  btn.disabled = true;
  btn.textContent = 'Çıkarılıyor…';
  try {
    const res = await fetch('/api/kinships', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: source, characters: state.characters }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'aile bağları çıkarılamadı');

    let filled = 0;
    let kept = 0;
    for (const c of state.characters) {
      const suggestion = data.notes && data.notes[c.id];
      if (!suggestion) continue;
      if (String(c.note || '').trim()) { kept += 1; continue; }
      c.note = suggestion;
      filled += 1;
    }

    renderKinHint(data);
    renderCharacters();
    scheduleSave();
    toast(filled
      ? `${filled} karakterin aile bağları dolduruldu${kept ? `, ${kept} not korundu` : ''}.`
      : `Yeni not yazılmadı${kept ? `; ${kept} karakterin notu zaten dolu` : ''}.`);
  } catch (err) {
    toast('Aile bağları hatası: ' + err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Aile bağlarını çıkar';
  }
});

// Çıkarımın ne kadar güvenilir olduğunu ve bakış açısı uyarısını gösterir.
function renderKinHint(data) {
  const box = $('#kinHint');
  if (!box) return;
  const rules = (data && data.general) || [];
  const caveat = (data && data.caveat) || '';
  if (!rules.length && !caveat) { box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false;
  box.innerHTML = `
    <strong>Metinden çıkan genel aile düzeni</strong>
    ${rules.length ? `<ul>${rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
    ${caveat ? `<p class="muted">${esc(caveat)} Bu yüzden unvanlar eksik kalabilir; kartlardaki “Aile bağları / notlar” alanından düzeltebilirsin.</p>` : ''}`;
}

$('#exportChars').addEventListener('click', () => {
  if (!state.characters.length) {
    toast('Aktarılacak karakter yok.', true);
    return;
  }
  const byStory = new Map();
  for (const c of state.characters) {
    const key = c.storyId || 'none';
    if (!byStory.has(key)) byStory.set(key, []);
    byStory.get(key).push(c);
  }
  const md = [...byStory.entries()].map(([storyId, members]) => {
    const groups = new Map();
    for (const c of members) {
      const key = c.family || 'Aile';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c);
    }
    return `# ${storyTitle(storyId)}\n\n${[...groups.entries()].map(([family, list]) => `## ${family}\n\n${list
      .map((c) => {
        const feats = (c.features || []).length
          ? `\n\n${c.features.map((f) => `- **${f.title || 'Özellik'}:** ${f.detail || ''}`).join('\n')}`
          : '';
        return `### ${c.name}${c.nickname ? ` — ${c.nickname}` : ''}\n\n${c.description || ''}${feats}${c.note ? `\n\n**Aile bağları:** ${c.note}` : ''}\n`;
      })
      .join('\n')}`).join('\n')}`;
  }).join('\n\n');
  const blob = new Blob([`# Karakterler\n\n${md}`], { type: 'text/markdown;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'karakterler.md';
  a.click();
  URL.revokeObjectURL(a.href);
});

/* ---------------- world file ---------------- */
let worldTab = 'story';

function currentWorldText() {
  if (!state.world) return '';
  if (worldTab === 'story') return state.world.story || state.world.markdown || state.world.text || '';
  if (worldTab === 'md') return state.world.markdown || state.world.text || '';
  return state.world.text || '';
}

const WORLD_HINTS = {
  story: 'Hikâye görünümü: noktalama, paragraf ve diyaloglar düzenlendi. Düzenlemeler otomatik kaydedilir.',
  md: 'Markdown sürümü analizde bağlam olarak kullanılır. Düzenlemeler otomatik kaydedilir.',
  raw: 'Ham metin (dosyadan çıkan hâli). Analizde Markdown sürümü kullanılır.',
};

function renderWorld() {
  if (!state.world) {
    el.worldInfo.hidden = true;
    el.dropzone.hidden = false;
    return;
  }
  el.dropzone.hidden = true;
  el.worldInfo.hidden = false;
  el.worldName.textContent = state.world.filename;
  el.worldStats.textContent = `${state.world.words} kelime · ${state.world.chars} karakter`;
  el.worldText.value = currentWorldText();
  document.querySelectorAll('.wtab').forEach((t) => {
    t.classList.toggle('active', t.dataset.wtab === worldTab);
  });
  $('#worldHint').textContent = WORLD_HINTS[worldTab];
}

document.querySelectorAll('.wtab').forEach((t) => {
  t.addEventListener('click', () => {
    worldTab = t.dataset.wtab;
    renderWorld();
  });
});

async function uploadWorld(file) {
  if (!file) return;
  const okExt = /\.(txt|md|markdown|docx|pdf)$/i.test(file.name);
  if (!okExt) {
    toast('Desteklenen formatlar: .txt, .md, .docx, .pdf', true);
    return;
  }
  toast('Dosya okunuyor ve Markdown\'a çevriliyor…');
  try {
    const res = await fetch('/api/world?filename=' + encodeURIComponent(file.name), {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: file,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'dosya okunamadı');
    state.world = {
      filename: data.filename,
      chars: data.chars,
      words: data.words,
      text: data.text,
      markdown: data.markdown,
      story: data.story,
      loadedAt: new Date().toISOString(),
    };
    worldTab = 'story';
    renderWorld();
    scheduleSave();
    document.querySelector('.tab[data-view="world"]').click();
    toast(`Yüklendi: ${data.words} kelime · Hikâye ve Markdown hazır.`);
    if (!state.characters.length) await autoExtractCharacters();
  } catch (err) {
    toast('Yükleme hatası: ' + err.message, true);
  }
}

$('#quickUpload').addEventListener('click', () => el.worldFile.click());

$('#pickFile').addEventListener('click', (e) => {
  e.stopPropagation();
  el.worldFile.click();
});
el.dropzone.addEventListener('click', () => el.worldFile.click());
el.worldFile.addEventListener('change', (e) => {
  uploadWorld(e.target.files[0]);
  e.target.value = '';
});

['dragenter', 'dragover'].forEach((ev) =>
  el.dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    el.dropzone.classList.add('over');
  })
);
['dragleave', 'drop'].forEach((ev) =>
  el.dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    el.dropzone.classList.remove('over');
  })
);
el.dropzone.addEventListener('drop', (e) => uploadWorld(e.dataTransfer.files[0]));

el.worldText.addEventListener('input', () => {
  if (!state.world) return;
  if (worldTab === 'story') {
    state.world.story = el.worldText.value;
  } else if (worldTab === 'md') {
    state.world.markdown = el.worldText.value;
  } else {
    state.world.text = el.worldText.value;
    state.world.chars = el.worldText.value.length;
    state.world.words = countWords(el.worldText.value);
    el.worldStats.textContent = `${state.world.words} kelime · ${state.world.chars} karakter`;
  }
  scheduleSave();
});

$('#worldBreakdown').addEventListener('click', async () => {
  if (!state.world) return;
  const source = state.world.story || state.world.markdown || state.world.text || '';
  if (!source.trim()) {
    toast('Dünya dosyası boş.', true);
    return;
  }
  const btn = $('#worldBreakdown');
  btn.disabled = true;
  btn.textContent = 'Bölünüyor…';
  try {
    const res = await fetch('/api/breakdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: source }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'sahneleme başarısız');
    if (!data.scenes.length) {
      toast('Sahne çıkarılamadı.', true);
      return;
    }
    state.scenes = [...state.scenes, ...data.scenes];
    renderScenes();
    scheduleSave();
    document.querySelector('.tab[data-view="scenes"]').click();
    toast(`${data.scenes.length} sahne oluşturuldu.`);
  } catch (err) {
    toast('Sahneleme hatası: ' + err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Bu dosyayı sahnelere böl';
  }
});

$('#worldToEditor').addEventListener('click', () => {
  if (!state.world) return;
  const source = state.world.story || state.world.markdown || state.world.text || '';
  if (!source.trim()) {
    toast('Aktarılacak metin yok.', true);
    return;
  }
  if (el.editor.value.trim() && !confirm('Metin kutusundaki yazı dünya dosyasıyla değiştirilsin mi?')) return;
  el.editor.value = source;
  updateWordCount();
  scheduleSave();
  document.querySelector('.tab[data-view="write"]').click();
  toast('Dünya dosyası metin kutusuna aktarıldı.');
});

$('#downloadMd').addEventListener('click', () => {
  if (!state.world) return;
  const md = state.world.markdown || state.world.text || '';
  const base = state.world.filename.replace(/\.[^.]+$/, '');
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${base}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Markdown dosyası indirildi.');
});

$('#copyMd').addEventListener('click', async () => {
  if (!state.world) return;
  const md = state.world.markdown || state.world.text || '';
  try {
    await navigator.clipboard.writeText(md);
    toast('Markdown panoya kopyalandı.');
  } catch {
    toast('Kopyalanamadı; metni seçip elle kopyala.', true);
  }
});

$('#removeWorld').addEventListener('click', () => {
  if (!confirm('Dünya dosyası kaldırılsın mı?')) return;
  state.world = null;
  renderWorld();
  scheduleSave();
});

/* ---------------- init ---------------- */
updateWordCount();
renderAnalysis();
renderCharacters();
renderNotes();
loadProject();

/* ---------------- notlar: düğmeler ---------------- */
$('#addNote').addEventListener('click', () => {
  const n = addNote('');
  const card = el ? document.querySelector(`.note-card[data-note="${n.id}"]`) : null;
  card?.querySelector('.note-title')?.focus();
});

$('#exportNotes').addEventListener('click', exportNotes);

function quickAddNote() {
  const input = $('#quickNote');
  const text = (input.value || '').trim();
  if (!text) return;
  addNote(text);
  input.value = '';
  toast('Not eklendi.');
}
$('#quickNoteAdd').addEventListener('click', quickAddNote);
$('#quickNote').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); quickAddNote(); }
});
$('#noteSearch').addEventListener('input', renderNotes);

if (!SpeechRecognition) {
  el.micBtn.disabled = true;
  el.micLabel.textContent = 'Tarayıcı desteklemiyor';
  el.micState.textContent = 'Chrome/Edge kullan';
}
