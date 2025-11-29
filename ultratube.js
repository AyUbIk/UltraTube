// ====== CONFIG (edit these if you know what you're doing) ======
// NOTE: For security, DO NOT place your real BOT_TOKEN here in production.
// Recommended: deploy serverless proxy and use CLIENT_API (safer).
const CONFIG = {
  // If using direct (INSECURE) mode, paste your bot token here (not recommended):
  BOT_TOKEN: "6787668633:AAFHgLFRdkbDpOgEpjPTMW9U6bXsmmLp07A", // <-- Оставьте пустым, если не понимаете риски
  CHAT_ID: "6924098464",   // <-- Оставьте пустым или заполните для локального теста (например: -1001234567890)

  // Where the client will post for secure sending. Deploy the serverless function and set URL here.
  // Example: "https://your-vercel-fn.vercel.app/api/send"
  CLIENT_API: "/api/send",

  // timeout for fetch (ms)
  TIMEOUT: 10000
};

// ====== UI refs ======
const videoInput = document.getElementById('videoInput');
const pasteBtn = document.getElementById('pasteBtn');
const sendQuick = document.getElementById('sendQuick');
const sendSecure = document.getElementById('sendSecure');
const status = document.getElementById('status');
const headlineText = document.getElementById('headlineText');
const saveHeadline = document.getElementById('saveHeadline');
const clientConf = document.getElementById('clientConf');

const LS_KEY = 'uv_headline_v1';

// Fill client config preview
function renderClientConf() {
  const cfg = {
    BOT_TOKEN: CONFIG.BOT_TOKEN ? '***REDACTED***' : '',
    CHAT_ID: CONFIG.CHAT_ID || '',
    CLIENT_API: CONFIG.CLIENT_API,
  };
  if (clientConf) clientConf.textContent = JSON.stringify(cfg, null, 2);
}
renderClientConf();

// Load saved headline if present
if (localStorage.getItem(LS_KEY)) {
  headlineText.textContent = localStorage.getItem(LS_KEY);
  saveHeadline.checked = true;
} else {
  saveHeadline.checked = false;
}

saveHeadline.addEventListener('change', () => {
  if (saveHeadline.checked) {
    localStorage.setItem(LS_KEY, headlineText.textContent.trim());
  } else {
    localStorage.removeItem(LS_KEY);
  }
});

// Save editable headline while typing (debounced)
let saveTimeout = null;
headlineText.addEventListener('input', () => {
  if (saveHeadline.checked) {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      localStorage.setItem(LS_KEY, headlineText.textContent.trim());
    }, 400);
  }
});

// Paste from clipboard (graceful fallback)
pasteBtn.addEventListener('click', async () => {
  if (!navigator.clipboard) {
    videoInput.focus();
    return;
  }
  try {
    const text = await navigator.clipboard.readText();
    videoInput.value = text;
    videoInput.focus();
  } catch (e) {
    // permission denied or not supported
    videoInput.focus();
  }
});

function setStatus(msg, type) {
  if (!status) return;
  status.className = 'status';
  if (type) status.classList.add(type);
  status.textContent = msg;
}

// validate simple URL: allow any non-empty input (accept any link/scheme)
function validateUrl(v) {
  if (!v) return false;
  return true;
}

async function requestWithTimeout(resource, options = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);
  try {
    const resp = await fetch(resource, { ...options, signal: controller.signal });
    clearTimeout(id);
    return resp;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

function setButtonsDisabled(disabled) {
  [sendSecure, sendQuick, pasteBtn].forEach(btn => { if (btn) btn.disabled = disabled; });
}

// Quick direct send — insecure (uses BOT_TOKEN in client)
sendQuick.addEventListener('click', async () => {
  const url = videoInput.value.trim();
  if (!validateUrl(url)) { setStatus('Неверная ссылка', 'error'); return; }
  if (!CONFIG.BOT_TOKEN || !CONFIG.CHAT_ID) {
    setStatus('Direct mode требует BOT_TOKEN и CHAT_ID в конфиге (опасно).', 'error');
    return;
  }

  // Removed browser confirm() so quick mode will not show a confirmation popup.

  setStatus('Отправка (быстрый режим)...');
  setButtonsDisabled(true);
  const api = `https://api.telegram.org/bot${encodeURIComponent(CONFIG.BOT_TOKEN)}/sendMessage`;
  const params = new URLSearchParams({ chat_id: CONFIG.CHAT_ID, text: url });
  try {
    const res = await requestWithTimeout(`${api}?${params.toString()}`, { method: 'GET' });
    if (res.ok) { setStatus('Отправлено ✅', 'success'); videoInput.value = ''; }
    else {
      const j = await res.json().catch(() => null);
      setStatus('Ошибка: ' + (j?.description || res.statusText), 'error');
    }
  } catch (e) {
    setStatus('Сеть/тайм-аут: ' + (e.message || e.name), 'error');
  } finally {
    setButtonsDisabled(false);
  }
});

// Secure send — recommended: sends to CLIENT_API which should be a serverless proxy
sendSecure.addEventListener('click', async () => {
  const url = videoInput.value.trim();
  if (!validateUrl(url)) { setStatus('Неверная ссылка', 'error'); return; }

  setStatus('Отправка (рекомендуется)...');
  setButtonsDisabled(true);
  try {
    const res = await requestWithTimeout(CONFIG.CLIENT_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: url })
    });
    if (res.ok) { setStatus('Отправлено ✅', 'success'); videoInput.value = ''; }
    else {
      const j = await res.json().catch(() => null);
      setStatus('Ошибка прокси: ' + (j?.message || res.statusText), 'error');
    }
  } catch (e) {
    setStatus('Сеть/тайм-аут: ' + (e.message || e.name), 'error');
  } finally {
    setButtonsDisabled(false);
  }
});

// Allow pressing Enter to send (secure)
videoInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); sendSecure.click(); } });

// Expose small helper for debugging in console (only in dev)
window.UV = {
  CONFIG,
  renderClientConf
};
