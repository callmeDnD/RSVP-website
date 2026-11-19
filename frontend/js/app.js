(() => {
  const { $, $$, esc, safeUrl, nl2p, api, toast, embed, wall, instant, time12, setErrors, busy } = U;
  let S; // site data
  const cal = { y: 0, m: 0, sel: '' };

  const dayKey = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const longDate = (s) => wall(s + ' 00:00:00', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  async function init() {
    try { S = await api('/api/site'); }
    catch (e) { $('#loader').classList.add('done'); $('#heroTitle').textContent = 'This event is not available yet'; $('#heroTag').textContent = e.message; return; }
    render();
    $('#loader').classList.add('done');
  }

  function render() {
    const ev = S.event;
    document.title = ev.title;
    $('meta[name=description]').content = ev.short_intro || ev.tagline || ev.title;
    $('#brand').textContent = ev.title;
    $('#heroTitle').textContent = ev.title;
    $('#heroTag').textContent = ev.tagline || '';
    if (safeUrl(ev.hero_image)) $('#home').style.backgroundImage = `url("${safeUrl(ev.hero_image)}")`;
    const sameDay = ev.start_at.slice(0, 10) === ev.end_at.slice(0, 10);
    const dateTxt = sameDay
      ? `${wall(ev.start_at, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}, ${wall(ev.start_at, { hour: 'numeric', minute: '2-digit' })} to ${wall(ev.end_at, { hour: 'numeric', minute: '2-digit' })}`
      : `${wall(ev.start_at, { month: 'long', day: 'numeric' })} to ${wall(ev.end_at, { month: 'long', day: 'numeric', year: 'numeric' })}`;
    $('#heroWhen').textContent = dateTxt;
    $('#heroVenue').textContent = [ev.venue_name, ev.venue_address].filter(Boolean).join(', ');
    $('#footTitle').textContent = ev.title;
    $('#footWhen').textContent = dateTxt;
    $('#copyName').textContent = ev.title;
    $('#year').textContent = new Date().getFullYear();

    const start = instant(ev.start_at, ev.tz_offset), end = instant(ev.end_at, ev.tz_offset);
    const f = (d) => d.toISOString().replace(/[-:]|\.\d{3}/g, '');
    const gcal = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(ev.title) +
      `&dates=${f(start)}/${f(end)}&details=` + encodeURIComponent(ev.short_intro || ev.tagline || '') +
      '&location=' + encodeURIComponent([ev.venue_name, ev.venue_address].filter(Boolean).join(', '));
    $('#gcalBtn').href = $('#gcalBtn2').href = gcal;
    countdown(start, end);

    // announcements
    $('#notices').innerHTML = S.announcements.map((a) => `<div class="notice"><div class="wrap"><p><strong>${esc(a.title)}.</strong> ${esc(a.body)}</p></div></div>`).join('');

    // about
    $('#introText').innerHTML = nl2p(ev.short_intro);
    $('#descText').innerHTML = nl2p(ev.description);
    $('#purposeText').innerHTML = nl2p(ev.purpose);
    $('#objectives').innerHTML = String(ev.objectives || '').split(/\n+/).filter(Boolean).map((o) => `<li>${esc(o)}</li>`).join('');
    $('#organizerText').innerHTML = nl2p(ev.organizer_info);
    const KIND = { speaker: 'Speaker', organizer: 'Organizer', performer: 'Performer', guest: 'Special guest' };
    $('#people').innerHTML = S.speakers.map((p) => {
      const ph = safeUrl(p.photo_url);
      const initials = p.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
      return `<article class="person"><div class="ph" ${ph ? `style="background-image:url('${esc(ph)}')" role="img" aria-label="Photo of ${esc(p.name)}"` : 'aria-hidden="true"'}>${ph ? '' : esc(initials)}</div>
        <span class="kind">${KIND[p.type] || 'Speaker'}</span><h3>${esc(p.name)}</h3><p class="role">${esc(p.role_title)}</p><p>${esc(p.bio)}</p></article>`;
    }).join('') || '<p class="empty">Speakers will be announced soon.</p>';

    // schedule
    const days = [...new Set(S.schedule.map((s) => s.day_date))];
    const first = days[0] || ev.start_at.slice(0, 10);
    cal.sel = first; cal.y = +first.slice(0, 4); cal.m = +first.slice(5, 7) - 1;
    drawCal(); drawDay();
    $('#calPrev').onclick = () => { cal.m--; if (cal.m < 0) { cal.m = 11; cal.y--; } drawCal(); };
    $('#calNext').onclick = () => { cal.m++; if (cal.m > 11) { cal.m = 0; cal.y++; } drawCal(); };

    gallery(ev);
    live(ev);
    venue(ev);
    contactBlock(ev);
    share();
    seats();
    if (!ev.rsvp_open) {
      $('#rsvpPanel').innerHTML = '<p class="closed">Registration is closed. Contact the organizers if you still want to attend.</p>';
    }
  }

  function countdown(start, end) {
    const box = $('#countdownBox');
    const tick = () => {
      const ms = start - Date.now();
      if (ms <= 0) {
        box.innerHTML = `<p class="countdown-msg">${Date.now() > end ? 'This event has ended.' : 'The event is happening now.'}</p>`;
        return false;
      }
      const s = Math.floor(ms / 1000);
      const v = [Math.floor(s / 86400), Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60];
      if (!box.firstElementChild || box.firstElementChild.className !== 'countdown') {
        box.innerHTML = '<div class="countdown" role="timer">' + ['days', 'hours', 'minutes', 'seconds'].map((l) => `<div><span>00</span><small>${l}</small></div>`).join('') + '</div>';
      }
      $$('.countdown span', box).forEach((el, i) => { el.textContent = String(v[i]).padStart(2, '0'); });
      return true;
    };
    if (tick()) { const t = setInterval(() => { if (!tick()) clearInterval(t); }, 1000); }
  }

  function drawCal() {
    const { y, m } = cal;
    $('#calTitle').textContent = new Date(Date.UTC(y, m, 1)).toLocaleString('en-PH', { timeZone: 'UTC', month: 'long', year: 'numeric' });
    const withItems = new Set(S.schedule.map((s) => s.day_date));
    const lead = new Date(Date.UTC(y, m, 1)).getUTCDay(), n = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    let h = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => `<span class="dow">${d}</span>`).join('') + '<i></i>'.repeat(lead);
    for (let d = 1; d <= n; d++) {
      const k = dayKey(y, m, d), has = withItems.has(k);
      h += `<button data-d="${k}" class="${has ? 'has' : ''} ${k === cal.sel ? 'sel' : ''}" ${has ? '' : 'disabled'} aria-label="${esc(longDate(k))}${has ? ', has sessions' : ''}" ${k === cal.sel ? 'aria-pressed="true"' : ''}>${d}</button>`;
    }
    $('#calGrid').innerHTML = h;
    $$('#calGrid button.has').forEach((b) => b.addEventListener('click', () => { cal.sel = b.dataset.d; drawCal(); drawDay(); }));
  }

  function drawDay() {
    const items = S.schedule.filter((s) => s.day_date === cal.sel);
    $('#dayTitle').textContent = items.length ? longDate(cal.sel) : 'No sessions on this date';
    const now = Date.now(), tz = S.event.tz_offset;
    $('#timeline').innerHTML = items.map((s) => {
      const a = instant(`${s.day_date} ${s.start_time}`, tz), b = s.end_time ? instant(`${s.day_date} ${s.end_time}`, tz) : a;
      const live = now >= a && now <= b;
      return `<li class="${s.is_highlight ? 'hl' : ''} ${live ? 'now' : ''}"><div class="t-time">${time12(s.start_time)}${s.end_time ? ' to ' + time12(s.end_time) : ''}</div>
        <h3>${esc(s.title)}${s.is_highlight ? '<span class="tag">Highlight</span>' : ''}${live ? '<span class="tag">Happening now</span>' : ''}</h3>
        ${s.description ? `<p>${esc(s.description)}</p>` : ''}
        <div class="meta">${s.location ? `<span><i class="fa-solid fa-location-dot"></i> ${esc(s.location)}</span>` : ''}${s.speaker_name ? `<span><i class="fa-solid fa-microphone"></i> ${esc(s.speaker_name)}</span>` : ''}</div></li>`;
    }).join('');
  }

  function gallery(ev) {
    const imgs = S.gallery.filter((g) => g.media_type === 'image' && safeUrl(g.url));
    const vids = S.gallery.filter((g) => g.media_type === 'video' && embed(g.url));
    const promo = embed(ev.promo_video_url);
    $('#promo').innerHTML = promo ? `<h3>Event introduction</h3><iframe class="video" src="${esc(promo)}" title="Event promotional video" loading="lazy" allowfullscreen></iframe>` : '';
    $('#gal').innerHTML = imgs.map((g, i) => `<button data-i="${i}" aria-label="Open photo: ${esc(g.caption || 'event photo')}"><img src="${esc(safeUrl(g.url))}" alt="${esc(g.caption || 'Event photo')}" loading="lazy"></button>`).join('');
    $('#vids').innerHTML = vids.map((g) => `<div><iframe class="video" src="${esc(embed(g.url))}" title="${esc(g.caption || 'Event video')}" loading="lazy" allowfullscreen></iframe>${g.caption ? `<p class="vcap">${esc(g.caption)}</p>` : ''}</div>`).join('');
    $('#galEmpty').hidden = !!(imgs.length || vids.length || promo);
    const lb = $('#lightbox');
    $$('#gal button').forEach((b) => b.addEventListener('click', () => {
      const g = imgs[+b.dataset.i];
      $('img', lb).src = safeUrl(g.url); $('img', lb).alt = g.caption || 'Event photo'; $('p', lb).textContent = g.caption || '';
      lb.showModal();
    }));
    $('#lbClose').onclick = () => lb.close();
    lb.addEventListener('click', (e) => { if (e.target === lb) lb.close(); });
  }

  function live(ev) {
    const url = embed(ev.live_stream_url);
    $('#liveNote').textContent = ev.live_stream_note || 'Watch the event live from anywhere.';
    const box = $('#liveBox');
    if (url) { box.classList.add('on'); box.innerHTML = `<iframe src="${esc(url)}" title="Live stream" allowfullscreen></iframe>`; }
    else if (safeUrl(ev.live_stream_url)) box.innerHTML = `<div><i class="fa-solid fa-tower-broadcast"></i><a class="btn btn-primary" href="${esc(safeUrl(ev.live_stream_url))}" target="_blank" rel="noopener">Watch the live stream</a></div>`;
    else box.innerHTML = '<div><i class="fa-solid fa-tower-broadcast"></i><strong>The live stream starts with the event.</strong><br>The link will be posted here.</div>';
  }

  function venue(ev) {
    const addr = [ev.venue_name, ev.venue_address].filter(Boolean).join(', ');
    $('#venueName').textContent = ev.venue_name || 'Venue to be announced';
    $('#venueAddr').textContent = ev.venue_address || '';
    const dl = [['Getting there', ev.transport_info], ['Nearby landmarks', ev.landmarks], ['Good to know', ev.venue_notes]].filter((x) => x[1]);
    $('#venueFacts').innerHTML = dl.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
    $('#dirBtn').href = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(addr);
    const custom = /^https:\/\/www\.google\.com\/maps\/embed/.test(ev.map_embed_url || '') ? ev.map_embed_url : '';
    $('#map').src = custom || 'https://www.google.com/maps?q=' + encodeURIComponent(addr) + '&output=embed';
    if (safeUrl(ev.venue_image)) { $('#venueImg').src = safeUrl(ev.venue_image); $('#venueImg').hidden = false; }
  }

  function contactBlock(ev) {
    $('#contactList').innerHTML = [
      ev.contact_email && `<li><i class="fa-solid fa-envelope"></i><a href="mailto:${esc(ev.contact_email)}">${esc(ev.contact_email)}</a></li>`,
      ev.contact_phone && `<li><i class="fa-solid fa-phone"></i><a href="tel:${esc(ev.contact_phone.replace(/[^\d+]/g, ''))}">${esc(ev.contact_phone)}</a></li>`,
    ].filter(Boolean).join('');
    const soc = [['facebook_url', 'fa-brands fa-facebook-f', 'Facebook'], ['instagram_url', 'fa-brands fa-instagram', 'Instagram'], ['x_url', 'fa-brands fa-x-twitter', 'X'], ['youtube_url', 'fa-brands fa-youtube', 'YouTube']];
    $('#social').innerHTML = soc.filter(([k]) => safeUrl(ev[k])).map(([k, ic, n]) => `<a href="${esc(safeUrl(ev[k]))}" target="_blank" rel="noopener" aria-label="${n} page"><i class="${ic}"></i></a>`).join('');
  }

  function share() {
    const u = encodeURIComponent(location.origin + location.pathname), t = encodeURIComponent(S.event.title);
    $('#shFb').href = `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    $('#shX').href = `https://twitter.com/intent/tweet?url=${u}&text=${t}`;
    $('#shLi').href = `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
    const copy = async () => { try { await navigator.clipboard.writeText(location.origin + location.pathname); toast('Link copied.'); } catch { toast('Copy failed. Copy the address from your browser.', 'err'); } };
    $('#shCopy').onclick = copy;
    $('#shIg').onclick = async () => { await copy(); toast('Paste it into your Instagram story or post.'); };
  }

  function seats() {
    const cap = S.event.capacity;
    $('#seats').textContent = cap ? `${Math.max(cap - S.seatsTaken, 0)} of ${cap} seats left.` : '';
  }

  // forms
  $('#status').addEventListener('change', (e) => {
    const g = $('#guests'); g.disabled = e.target.value === 'not_attending'; if (g.disabled) g.value = 0; else if (!+g.value) g.value = 1;
  });

  $('#rsvpForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target, body = Object.fromEntries(new FormData(form));
    if (form.elements.guests.disabled) body.guests = 0;
    const local = {};
    if (!body.full_name.trim()) local.full_name = 'Enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) local.email = 'Enter a valid email address.';
    if (!/^[0-9+()\-.\s]{7,25}$/.test(body.phone.trim())) local.phone = 'Enter a valid contact number.';
    setErrors(form, local);
    if (Object.keys(local).length) return;
    try {
      const r = await busy($('#rsvpSubmit'), () => api('/api/rsvp', { method: 'POST', body }));
      $('#rsvpPanel').innerHTML = `<div class="success" style="padding-left:20px"><h3>You are registered</h3><p>Your reference number:</p><div class="ref">${esc(r.reference)}</div>
        <p>${r.emailSent ? 'We sent a confirmation to your email. Check spam if you do not see it.' : 'Save this reference number. Email confirmations are not switched on for this site right now.'}</p>
        <p><a href="/manage">Update or cancel your RSVP</a></p></div>`;
      toast('RSVP saved.');
      S.seatsTaken += body.status === 'attending' ? +body.guests : 0; seats();
    } catch (err) {
      setErrors(form, err.details); toast(err.message, 'err');
    }
  });

  $('#contactForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    setErrors(form);
    try {
      await busy($('button', form), () => api('/api/contact', { method: 'POST', body: Object.fromEntries(new FormData(form)) }));
      form.reset(); toast('Message sent. We will reply by email.');
    } catch (err) { setErrors(form, err.details); toast(err.message, 'err'); }
  });

  // mobile menu
  const btn = $('#menuBtn'), list = $('#navList');
  btn.addEventListener('click', () => { const o = list.classList.toggle('open'); btn.setAttribute('aria-expanded', o); });
  list.addEventListener('click', (e) => { if (e.target.closest('a')) { list.classList.remove('open'); btn.setAttribute('aria-expanded', false); } });

  init();
})();
