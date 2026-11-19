// Shared helpers for public pages and admin
window.U = (() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (u) => (/^(https?:\/\/|\/uploads\/)/i.test(u || '') ? u : '');
  const nl2p = (t) => String(t || '').split(/\n+/).filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join('');

  async function api(url, opts = {}) {
    const headers = { 'X-Requested-With': 'XMLHttpRequest' };
    if (opts.body && !(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    const res = await fetch(url, { credentials: 'same-origin', ...opts, headers, body: opts.body && !(opts.body instanceof FormData) ? JSON.stringify(opts.body) : opts.body });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong. Please try again.'), { details: data.details, status: res.status });
    return data;
  }

  function toast(msg, type = 'ok') {
    let box = $('#toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite'); document.body.append(box); }
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.textContent = msg;
    box.append(t);
    setTimeout(() => t.remove(), 5000);
  }

  // Turn a YouTube/Vimeo page link into an embeddable player URL ('' if unsupported)
  function embed(url) {
    const yt = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|live\/|shorts\/))([\w-]{11})/.exec(url || '');
    if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
    const vm = /vimeo\.com\/(?:video\/)?(\d+)/.exec(url || '');
    return vm ? `https://player.vimeo.com/video/${vm[1]}` : '';
  }

  // Event times are stored as wall-clock strings ("YYYY-MM-DD HH:MM:SS") plus a UTC offset.
  const wall = (s, opts) => new Date(String(s).replace(' ', 'T') + 'Z').toLocaleString('en-PH', { timeZone: 'UTC', ...opts });
  const instant = (s, off) => new Date(String(s).replace(' ', 'T') + (off || '+00:00'));
  const time12 = (t) => wall('1970-01-01 ' + t, { hour: 'numeric', minute: '2-digit' });

  function setErrors(form, details = {}) {
    $$('.err', form).forEach((e) => e.remove());
    $$('[aria-invalid]', form).forEach((e) => e.removeAttribute('aria-invalid'));
    for (const [k, msg] of Object.entries(details)) {
      const f = form.elements[k];
      if (!f) continue;
      f.setAttribute('aria-invalid', 'true');
      const p = document.createElement('p');
      p.className = 'err';
      p.textContent = msg;
      f.closest('.field')?.append(p);
    }
    const first = $('[aria-invalid]', form);
    first?.focus();
  }

  async function busy(btn, fn) {
    const label = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spin" aria-hidden="true"></span> Working';
    try { return await fn(); } finally { btn.disabled = false; btn.innerHTML = label; }
  }

  return { $, $$, esc, safeUrl, nl2p, api, toast, embed, wall, instant, time12, setErrors, busy };
})();
