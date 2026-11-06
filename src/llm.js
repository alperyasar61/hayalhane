'use strict';

/**
 * Yorum motoru.
 * Sağlayıcı seçimi ortam değişkenleriyle yapılır; hiçbiri yoksa yerel (mock) motor çalışır.
 *
 *   AI_PROVIDER=openai   OPENAI_API_KEY=...   OPENAI_MODEL=gpt-4o-mini
 *   AI_PROVIDER=gemini   GEMINI_API_KEY=...   GEMINI_MODEL=gemini-2.0-flash
 *   AI_PROVIDER=ollama   OLLAMA_URL=http://127.0.0.1:11434  OLLAMA_MODEL=llama3.1
 */

const SYSTEM_PROMPT = `Sen deneyimli bir oyun senaryo editörüsün. Türkçe yazıyorsun.
Sana bir taslak metin ve varsa dünya dosyası verilir. Görevin: metni yorumlamak, güçlü yanlarını ve eksiklerini söylemek,
sahneleme önerileri sunmak. Yorumların kısa, somut ve uygulanabilir olmalı. Övgü dağıtma, doğrudan konuş.

Yanıtı SADECE şu JSON şemasıyla ver:
{
  "summary": "1-2 cümlelik özet",
  "genre": "tür tahmini",
  "strengths": ["..."],
  "issues": ["..."],
  "questions": ["..."],
  "suggestions": [
    { "type": "karakter|sahne|diyalog|tempo|dünya", "title": "kısa başlık", "detail": "neden ve nasıl", "draft": "metne eklenecek 1-3 cümlelik taslak (Türkçe)" }
  ]
}
En fazla 4 öneri ver.`;

function providerInfo() {
  const p = (process.env.AI_PROVIDER || '').toLowerCase();
  if (p === 'openai' && process.env.OPENAI_API_KEY) {
    return { provider: 'openai', model: process.env.OPENAI_MODEL || 'gpt-4o-mini', ready: true };
  }
  if (p === 'gemini' && process.env.GEMINI_API_KEY) {
    return { provider: 'gemini', model: process.env.GEMINI_MODEL || 'gemini-2.0-flash', ready: true };
  }
  if (p === 'ollama') {
    return { provider: 'ollama', model: process.env.OLLAMA_MODEL || 'llama3.1', ready: true };
  }
  return { provider: 'mock', model: 'yerel kural motoru', ready: true };
}

function buildUserPrompt(text, worldText) {
  const world = worldText && worldText.trim()
    ? `\n\nDÜNYA DOSYASI:\n${worldText.slice(0, 6000)}`
    : '\n\nDÜNYA DOSYASI: (yok)';
  return `TASLAK METİN:\n${text.slice(0, 12000)}${world}`;
}

function extractJson(raw) {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Yanıtta JSON bulunamadı.');
  return JSON.parse(raw.slice(start, end + 1));
}

async function callOpenAI(text, worldText, info) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: info.model,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(text, worldText) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return extractJson(data.choices[0].message.content);
}

async function callGemini(text, worldText, info) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${info.model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: buildUserPrompt(text, worldText) }] }],
      generationConfig: { temperature: 0.7, responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return extractJson(raw);
}

async function callOllama(text, worldText, info) {
  const base = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
  const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: info.model,
      stream: false,
      format: 'json',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(text, worldText) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return extractJson(data.message?.content || '');
}

/**
 * Yorum üretir. Sağlayıcı hata verirse null döner; çağıran taraf yerel motora düşer.
 */
async function review(text, worldText) {
  const info = providerInfo();
  if (info.provider === 'mock') return null;

  try {
    if (info.provider === 'openai') return await callOpenAI(text, worldText, info);
    if (info.provider === 'gemini') return await callGemini(text, worldText, info);
    if (info.provider === 'ollama') return await callOllama(text, worldText, info);
  } catch (err) {
    console.warn('[llm] sağlayıcı hatası, yerel motora düşülüyor:', err.message);
    return null;
  }
  return null;
}

module.exports = { review, providerInfo };
