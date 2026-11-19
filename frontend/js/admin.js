(() => {
  const { $, $$, esc, api, toast, setErrors, busy } = U;
  const call = async (url, opts) => {
    try { return await api(url, opts); }
    catch (e) { if (e.status === 401 && url !== '/api/admin/login') showLogin(); throw e; }
  };
  const F = (name, label, type = 'text', extra = {}) => ({ name, label, type, ...extra });
  const STATUS = [['attending', 'Attending'], ['maybe', 'Maybe'], ['not_attending', 'Not attending'], ['cancelled', 'Cancelled']];
  const TABS = [['dash', 'Overview'], ['rsvps', 'Registrations'], ['event', 'Event and live stream'], ['schedules', 'Schedule'],
    ['speakers', 'Speakers and organizers'], ['gallery', 'Images and videos'], ['announcements', 'Announcements'], ['messages', 'Messages']];
  let charts = [];

  /* ---------- auth ---------- */
  function showLogin() { $('#appView').hidden = true; $('#loginView').hidden = false; $('#email').focus(); }
  async function showApp(user) {
    $('#loginView').hidden = true; $('#appView').hidden = false;
    $('#who').textContent = user.name;
    $('#tabs').innerHTML = TABS.map(([id, label]) => `<button role="tab" data-t="${id}" aria-selected="false">${label}</button>`).join('');
    $$('#tabs button').forEach((b) => b.addEventListener('click', () => go(b.dataset.t)));
    go('dash');
  }
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { const u = await busy($('button', e.target), () => call('/api/admin/login', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) })); e.target.reset(); showApp(u); }
    catch (err) { toast(err.message, 'err'); }
  });
  $('#logout').addEventListener('click', async () => { await call('/api/admin/logout', { method: 'POST' }).catch(() => {}); showLogin(); });

  /* ---------- generic form + modal ---------- */
  const val = (v) => (v == null ? '' : v);
  function fieldHTML(f, values) {
    const v = values?.[f.name], id = 'f_' + f.name, cls = `field ${f.full ? 'full' : ''}`;
    const req = f.required ? ' <span class="req">*</span>' : '';
    if (f.type === 'checkbox') return `<div class="field check full"><input type="checkbox" id="${id}" name="${f.name}" ${v ? 'checked' : ''}><label for="${id}">${esc(f.label)}</label></div>`;
    let input;
    if (f.type === 'textarea') input = `<textarea id="${id}" name="${f.name}">${esc(val(v))}</textarea>`;
    else if (f.type === 'select') input = `<select id="${id}" name="${f.name}">${f.options.map(([k, l]) => `<option value="${esc(k)}" ${String(val(v)) === String(k) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    else if (f.type === 'image') input = `<div class="imgfield"><input id="${id}" name="${f.name}" value="${esc(val(v))}" placeholder="https://... or upload"><button type="button" class="btn btn-line" data-up="${id}">Upload</button><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-file="${id}"></div>`;
    else if (f.type === 'datetime-local') input = `<input id="${id}" name="${f.name}" type="datetime-local" value="${esc(String(val(v)).replace(' ', 'T').slice(0, 16))}">`;
    else if (f.type === 'time') input = `<input id="${id}" name="${f.name}" type="time" value="${esc(String(val(v)).slice(0, 5))}">`;
    else input = `<input id="${id}" name="${f.name}" type="${f.type}" value="${esc(val(v))}">`;
    return `<div class="${cls}"><label for="${id}">${esc(f.label)}${req}</label>${input}${f.hint ? `<p class="hint">${esc(f.hint)}</p>` : ''}</div>`;
  }
  const readForm = (form, fields) => Object.fromEntries(fields.map((f) => [f.name, f.type === 'checkbox' ? form.elements[f.name].checked : form.elements[f.name].value]));
  function wireUploads(root) {
    $$('[data-up]', root).forEach((b) => b.addEventListener('click', () => $(`[data-file="${b.dataset.up}"]`, root).click()));
    $$('[data-file]', root).forEach((inp) => inp.addEventListener('change', async () => {
      if (!inp.files[0]) return;
      const fd = new FormData(); fd.append('file', inp.files[0]);
      try { const r = await call('/api/admin/upload', { method: 'POST', body: fd }); $('#' + inp.dataset.file).value = r.url; toast('Image uploaded.'); }
      catch (err) { toast(err.message, 'err'); }
      inp.value = '';
    }));
  }

  function openForm({ title, fields, values, onSave, saveLabel = 'Save' }) {
    const dlg = $('#dlg'), form = $('#dlgForm');
    form.innerHTML = `<h2>${esc(title)}</h2><div class="form-grid">${fields.map((f) => fieldHTML(f, values)).join('')}</div>
      <div class="modal-actions"><button type="button" class="btn btn-line" id="dlgCancel">Cancel</button><button type="submit" class="btn btn-dark">${saveLabel}</button></div>`;
    wireUploads(form);
    $('#dlgCancel').onclick = () => dlg.close();
    form.onsubmit = async (e) => {
      e.preventDefault();
      setErrors(form);
      try { await busy($('[type=submit]', form), () => onSave(readForm(form, fields))); dlg.close(); }
      catch (err) { setErrors(form, err.details); toast(err.message, 'err'); }
    };
    dlg.showModal();
  }

  const table = (heads, rows) => `<div class="tablewrap"><table><thead><tr>${heads.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td colspan="${heads.length}" class="muted">Nothing here yet.</td></tr>`}</tbody></table></div>`;
  const dt = (s) => esc(String(s || '').slice(0, 16));

  /* ---------- tabs ---------- */
  function go(id) {
    CURRENT = id;
    charts.forEach((c) => c.destroy()); charts = [];
    $$('#tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.t === id));
    $('#main').innerHTML = '<p class="muted"><span class="spin"></span> Loading</p>';
    (VIEWS[id])().catch((e) => { if (e.status !== 401) $('#main').innerHTML = `<p class="closed">${esc(e.message)}</p>`; });
  }

  async function dash() {
    const s = await call('/api/admin/stats');
    const b = s.byStatus;
    $('#main').innerHTML = `<h2>Overview</h2><div class="stats">
      <div class="stat"><b>${s.totalRegistrations}</b><span>Registrations (not cancelled)</span></div>
      <div class="stat"><b>${b.attending}</b><span>Confirmed attending</span></div>
      <div class="stat"><b>${s.attendingGuests}${s.capacity ? ' / ' + s.capacity : ''}</b><span>Confirmed guests${s.capacity ? ' of capacity' : ''}</span></div>
      <div class="stat"><b>${b.maybe}</b><span>Maybe</span></div>
      <div class="stat"><b>${b.not_attending}</b><span>Declined</span></div>
      <div class="stat"><b>${b.cancelled}</b><span>Cancelled</span></div>
      <div class="stat"><b>${s.messages}</b><span>Contact messages</span></div></div>
      <div class="charts"><div class="panel"><h3>RSVPs by status</h3><canvas id="c1"></canvas></div>
      <div class="panel"><h3>Registrations, last 30 days</h3><canvas id="c2"></canvas></div></div>`;
    if (!window.Chart) { $('.charts').innerHTML = '<p class="muted">Charts could not load. Check your internet connection.</p>'; return; }
    charts.push(new Chart($('#c1'), { type: 'doughnut', data: { labels: ['Attending', 'Maybe', 'Not attending', 'Cancelled'], datasets: [{ data: [b.attending, b.maybe, b.not_attending, b.cancelled], backgroundColor: ['#1d6b45', '#f4b223', '#1e7f8c', '#b3261e'] }] }, options: { plugins: { legend: { position: 'bottom' } } } }));
    charts.push(new Chart($('#c2'), { type: 'bar', data: { labels: s.byDay.map((d) => d.d.slice(5)), datasets: [{ label: 'New RSVPs', data: s.byDay.map((d) => d.n), backgroundColor: '#0f5560' }] }, options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { display: false } } } }));
  }

  async function rsvps() {
    $('#main').innerHTML = `<h2>Registrations</h2><div class="tools">
      <input type="search" id="q" placeholder="Search name, email, organization or reference" aria-label="Search registrations" style="min-width:300px">
      <select id="st" aria-label="Filter by status"><option value="">All statuses</option>${STATUS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
      <a class="btn btn-line" id="csv"><i class="fa-solid fa-file-csv"></i> Export CSV</a>
      <button class="btn btn-line" id="rem" title="Sends a reminder email to attending and maybe RSVPs if the event starts within 24 hours"><i class="fa-regular fa-bell"></i> Send reminders now</button></div>
      <div id="rt"></div>`;
    let timer;
    const load = async () => {
      const qs = new URLSearchParams({ q: $('#q').value, status: $('#st').value }).toString();
      $('#csv').href = '/api/admin/rsvps/export.csv?' + qs;
      const rows = await call('/api/admin/rsvps?' + qs);
      $('#rt').innerHTML = table(['Reference', 'Attendee', 'Contact', 'Status', 'Guests', 'Registered', ''], rows.map((r) => `<tr>
        <td>${esc(r.reference_no)}</td><td><strong>${esc(r.full_name)}</strong><br><span class="muted">${esc(r.organization)}</span></td>
        <td>${esc(r.email)}<br><span class="muted">${esc(r.phone)}</span></td><td><span class="badge ${r.status}">${esc(STATUS.find((s) => s[0] === r.status)[1])}</span></td>
        <td>${r.guests}</td><td>${dt(r.created_at)}</td>
        <td><div class="actions"><button class="btn btn-line" data-e="${r.id}">Edit</button><button class="btn btn-danger" data-d="${r.id}">Delete</button></div></td></tr>`).join(''));
      $$('#rt [data-e]').forEach((b) => b.addEventListener('click', () => {
        const r = rows.find((x) => x.id === +b.dataset.e);
        openForm({ title: 'Edit registration ' + r.reference_no, values: r, fields: [
          F('full_name', 'Full name', 'text', { full: true }), F('phone', 'Contact number'), F('organization', 'Organization or school'),
          F('status', 'Status', 'select', { options: STATUS }), F('guests', 'Attendees', 'number'), F('message', 'Message', 'textarea', { full: true }),
          F('notify', 'Email the attendee about this change', 'checkbox')],
        onSave: async (d) => { const x = await call('/api/admin/rsvps/' + r.id, { method: 'PUT', body: d }); toast(x.emailSent ? 'Saved and attendee emailed.' : 'Saved.'); load(); } });
      }));
      $$('#rt [data-d]').forEach((b) => b.addEventListener('click', async () => {
        if (!confirm('Delete this registration permanently?')) return;
        await call('/api/admin/rsvps/' + b.dataset.d, { method: 'DELETE' }); toast('Registration deleted.'); load();
      }));
    };
    $('#q').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(load, 250); });
    $('#st').addEventListener('change', load);
    $('#rem').addEventListener('click', async () => { try { const r = await busy($('#rem'), () => call('/api/admin/reminders/run', { method: 'POST' })); toast(r.note); } catch (e) { toast(e.message, 'err'); } });
    await load();
  }

  async function eventView() {
    const ev = await call('/api/admin/event');
    const groups = [
      ['Basics', [F('title', 'Event name', 'text', { required: true, full: true }), F('tagline', 'Tagline', 'text', { full: true }), F('short_intro', 'Short introduction', 'textarea', { full: true }), F('description', 'Full description', 'textarea', { full: true }),
        F('purpose', 'Purpose and background', 'textarea', { full: true }), F('objectives', 'Objectives', 'textarea', { full: true, hint: 'One objective per line.' }), F('organizer_info', 'About the organizers', 'textarea', { full: true })]],
      ['Date and registration', [F('start_at', 'Starts', 'datetime-local', { required: true }), F('end_at', 'Ends', 'datetime-local', { required: true }), F('tz_offset', 'Time zone offset', 'text', { hint: 'For example +08:00 for the Philippines.' }),
        F('capacity', 'Capacity (guests)', 'number', { hint: 'Leave blank for no limit.' }), F('rsvp_open', 'Registration is open', 'checkbox')]],
      ['Venue', [F('venue_name', 'Venue name'), F('venue_address', 'Address', 'text'), F('transport_info', 'Transportation', 'textarea', { full: true }), F('landmarks', 'Nearby landmarks', 'textarea', { full: true }),
        F('venue_notes', 'Visitor information', 'textarea', { full: true }), F('venue_image', 'Venue image', 'image', { full: true }), F('map_embed_url', 'Google Maps embed link (optional)', 'text', { full: true, hint: 'Leave blank to show a map from the address.' })]],
      ['Media and live stream', [F('hero_image', 'Hero background image', 'image', { full: true }), F('promo_video_url', 'Promotional video link (YouTube or Vimeo)', 'text', { full: true }),
        F('live_stream_url', 'Live stream link (YouTube or Vimeo)', 'text', { full: true, hint: 'Leave blank until the stream is ready. The site shows a placeholder.' }), F('live_stream_note', 'Live stream message', 'text', { full: true })]],
      ['Contact and social', [F('contact_email', 'Organizer email', 'email'), F('contact_phone', 'Organizer phone'), F('facebook_url', 'Facebook link'), F('instagram_url', 'Instagram link'), F('x_url', 'X link'), F('youtube_url', 'YouTube link')]],
    ];
    const all = groups.flatMap((g) => g[1]);
    $('#main').innerHTML = `<h2>Event and live stream</h2><form class="event-form" id="evf" novalidate>${groups.map(([t, fs]) => `<fieldset><legend>${t}</legend><div class="form-grid">${fs.map((f) => fieldHTML(f, ev)).join('')}</div></fieldset>`).join('')}
      <button class="btn btn-dark" type="submit">Save event details</button></form>`;
    const form = $('#evf'); wireUploads(form);
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); setErrors(form);
      try { await busy($('[type=submit]', form), () => call('/api/admin/event', { method: 'PUT', body: readForm(form, all) })); toast('Event details saved.'); }
      catch (err) { setErrors(form, err.details); toast(err.message, 'err'); }
    });
  }

  // CRUD view for schedules, speakers, announcements and gallery
  function resource(name, title, noun, heads, row, fieldsFn, defaults = {}) {
    return async () => {
      const items = await call('/api/admin/' + name);
      const fields = await fieldsFn();
      $('#main').innerHTML = `<h2>${title}</h2><div class="tools"><button class="btn btn-dark" id="add"><i class="fa-solid fa-plus"></i> Add ${noun}</button></div>
        ${table([...heads, ''], items.map((it) => `<tr>${row(it)}<td><div class="actions"><button class="btn btn-line" data-e="${it.id}">Edit</button><button class="btn btn-danger" data-d="${it.id}">Delete</button></div></td></tr>`).join(''))}`;
      const form = (it) => openForm({ title: it ? `Edit ${noun}` : `Add ${noun}`, fields, values: it || defaults,
        onSave: async (d) => { await call(`/api/admin/${name}${it ? '/' + it.id : ''}`, { method: it ? 'PUT' : 'POST', body: d }); toast('Saved.'); go(CURRENT); } });
      $('#add').onclick = () => form(null);
      $$('#main [data-e]').forEach((b) => b.addEventListener('click', () => form(items.find((x) => x.id === +b.dataset.e))));
      $$('#main [data-d]').forEach((b) => b.addEventListener('click', async () => {
        if (!confirm(`Delete this ${noun}?`)) return;
        await call(`/api/admin/${name}/${b.dataset.d}`, { method: 'DELETE' }); toast('Deleted.'); go(CURRENT);
      }));
    };
  }
  let CURRENT = 'dash';

  const VIEWS = {
    dash, rsvps, event: eventView,
    schedules: resource('schedules', 'Schedule', 'session', ['Date', 'Time', 'Session', 'Location', 'Highlight'],
      (s) => `<td>${esc(s.day_date)}</td><td>${esc(s.start_time.slice(0, 5))}${s.end_time ? ' to ' + esc(s.end_time.slice(0, 5)) : ''}</td><td><strong>${esc(s.title)}</strong></td><td>${esc(s.location)}</td><td>${s.is_highlight ? 'Yes' : ''}</td>`,
      async () => { const sp = await call('/api/admin/speakers'); return [F('title', 'Session title', 'text', { required: true, full: true }), F('day_date', 'Date', 'date', { required: true }), F('location', 'Location'),
        F('start_time', 'Starts', 'time', { required: true }), F('end_time', 'Ends', 'time'), F('speaker_id', 'Speaker', 'select', { options: [['', 'None'], ...sp.map((p) => [p.id, p.name])] }),
        F('description', 'Description', 'textarea', { full: true }), F('is_highlight', 'Highlight this session', 'checkbox')]; }),
    speakers: resource('speakers', 'Speakers and organizers', 'person', ['Name', 'Role', 'Type', 'Order'],
      (p) => `<td><strong>${esc(p.name)}</strong></td><td>${esc(p.role_title)}</td><td>${esc(p.type)}</td><td>${p.sort_order}</td>`,
      async () => [F('name', 'Name', 'text', { required: true }), F('role_title', 'Position'), F('type', 'Type', 'select', { options: [['speaker', 'Speaker'], ['organizer', 'Organizer'], ['performer', 'Performer'], ['guest', 'Special guest']] }),
        F('sort_order', 'Display order', 'number'), F('photo_url', 'Photo', 'image', { full: true }), F('bio', 'Biography', 'textarea', { full: true })], { sort_order: 0 }),
    gallery: resource('gallery', 'Images and videos', 'item', ['Type', 'Preview', 'Caption', 'Order'],
      (g) => `<td>${esc(g.media_type)}</td><td>${g.media_type === 'image' ? `<img src="${esc(g.url)}" alt="" style="height:44px;border-radius:4px">` : esc(g.url)}</td><td>${esc(g.caption)}</td><td>${g.sort_order}</td>`,
      async () => [F('media_type', 'Type', 'select', { options: [['image', 'Image'], ['video', 'Video (YouTube or Vimeo link)']] }), F('sort_order', 'Display order', 'number'),
        F('url', 'Image upload or link', 'image', { required: true, full: true, hint: 'For a video, paste the YouTube or Vimeo link.' }), F('caption', 'Caption', 'text', { full: true })], { sort_order: 0 }),
    announcements: resource('announcements', 'Announcements', 'announcement', ['Title', 'Pinned', 'Posted'],
      (a) => `<td><strong>${esc(a.title)}</strong><br><span class="muted">${esc(a.body.slice(0, 90))}</span></td><td>${a.is_pinned ? 'Yes' : ''}</td><td>${dt(a.created_at)}</td>`,
      async () => [F('title', 'Title', 'text', { required: true, full: true }), F('body', 'Message', 'textarea', { required: true, full: true }), F('is_pinned', 'Pin to the top', 'checkbox')]),
    messages: async () => {
      const m = await call('/api/admin/messages');
      $('#main').innerHTML = `<h2>Messages</h2>${table(['From', 'Subject', 'Message', 'Sent', ''], m.map((x) => `<tr><td><strong>${esc(x.name)}</strong><br><a href="mailto:${esc(x.email)}">${esc(x.email)}</a></td><td>${esc(x.subject)}</td><td style="white-space:pre-wrap;max-width:420px">${esc(x.message)}</td><td>${dt(x.created_at)}</td><td><button class="btn btn-danger" data-d="${x.id}">Delete</button></td></tr>`).join(''))}`;
      $$('#main [data-d]').forEach((b) => b.addEventListener('click', async () => { if (!confirm('Delete this message?')) return; await call('/api/admin/messages/' + b.dataset.d, { method: 'DELETE' }); go('messages'); }));
    },
  };

  (async () => { try { showApp(await call('/api/admin/me')); } catch { showLogin(); } })();
})();
