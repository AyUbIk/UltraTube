  // ====== CONFIG (edit these if you know what you're doing) ======
    // Recommended: leave BOT_TOKEN empty and deploy serverless proxy.
    const CONFIG = {
      // If using direct (INSECURE) mode, paste your bot token here (not recommended):
      BOT_TOKEN: "6787668633:AAFHgLFRdkbDpOgEpjPTMW9U6bXsmmLp07A", // <-- Поставь токен только если понимаешь риски
      CHAT_ID: "6924098464",   // <-- Поставь chat id (например: -1001234567890 или 12345678)

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

    // Load saved headline if present
    if (localStorage.getItem('uv_headline')) headlineText.innerText = localStorage.getItem('uv_headline');
    saveHeadline.checked = !!localStorage.getItem('uv_headline');

    saveHeadline.addEventListener('change', ()=>{
      if (saveHeadline.checked) localStorage.setItem('uv_headline', headlineText.innerText);
      else localStorage.removeItem('uv_headline');
    });

    headlineText.addEventListener('input', ()=>{
      if (saveHeadline.checked) localStorage.setItem('uv_headline', headlineText.innerText);
    });

    pasteBtn.addEventListener('click', async ()=>{
      try{
        const text = await navigator.clipboard.readText();
        videoInput.value = text;
      }catch(e){
        // fallback: focus so user can paste manually
        videoInput.focus();
      }
    });

    function setStatus(msg, type){
      status.className = 'status';
      if(type) status.classList.add(type);
      status.textContent = msg;
    }

    function validateUrl(v){
      if(!v) return false;
      try{
        const u = new URL(v);
        return ['http:','https:'].includes(u.protocol);
      }catch(e){return false}
    }

    async function requestWithTimeout(resource, options = {}){
      const controller = new AbortController();
      const id = setTimeout(()=>controller.abort(), CONFIG.TIMEOUT);
      try{
        const resp = await fetch(resource, {...options, signal: controller.signal});
        clearTimeout(id);
        return resp;
      }catch(e){
        clearTimeout(id);
        throw e;
      }
    }

    // Quick direct send — insecure (uses BOT_TOKEN in client)
    sendQuick.addEventListener('click', async ()=>{
      const url = videoInput.value.trim();
      if(!validateUrl(url)){ setStatus('Неверная ссылка', 'error'); return; }
      if(!CONFIG.BOT_TOKEN || !CONFIG.CHAT_ID){
        setStatus('Direct mode требует BOT_TOKEN и CHAT_ID в конфиге (опасно).', 'error');
        return;
      }
      setStatus('Отправка (быстрый режим)...');
      const api = `https://api.telegram.org/bot${encodeURIComponent(CONFIG.BOT_TOKEN)}/sendMessage`;
      const params = new URLSearchParams({chat_id: CONFIG.CHAT_ID, text: url});
      try{
        const res = await requestWithTimeout(`${api}?${params.toString()}`, {method:'GET'});
        if(res.ok){ setStatus('Отправлено ✅', 'success'); videoInput.value=''; }
        else{ const j = await res.json().catch(()=>null); setStatus('Ошибка: '+(j?.description||res.statusText), 'error'); }
      }catch(e){ setStatus('Сеть/тайм-аут: '+e.message, 'error'); }
    });

    // Secure send — recommended: sends to CLIENT_API which should be a serverless proxy
    sendSecure.addEventListener('click', async ()=>{
      const url = videoInput.value.trim();
      if(!validateUrl(url)){ setStatus('Неверная ссылка', 'error'); return; }
      setStatus('Отправка (рекомендуется)...');

      try{
        const res = await requestWithTimeout(CONFIG.CLIENT_API, {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({text:url})
        });
        if(res.ok){ setStatus('Отправлено ✅', 'success'); videoInput.value=''; }
        else{ const j = await res.json().catch(()=>null); setStatus('Ошибка прокси: '+(j?.message||res.statusText), 'error'); }
      }catch(e){ setStatus('Сеть/тайм-аут: '+e.message, 'error'); }
    });

    // Allow pressing Enter to send (secure)
    videoInput.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); sendSecure.click(); } });
