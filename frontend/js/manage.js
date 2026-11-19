(() => {
  const { $, api, toast, setErrors, busy } = U;
  let auth = null; // { token } or { reference, email }

  async function load(creds) {
    const r = await api('/api/rsvp/lookup', { method: 'POST', body: creds });
    auth = creds;
    $('#lookupBox').hidden = true; $('#editBox').hidden = false;
    $('#refShown').textContent = r.reference_no;
    $('#emailShown').textContent = 'Registered with ' + r.email;
    const f = $('#editForm').elements;
    f.full_name.value = r.full_name; f.phone.value = r.phone; f.organization.value = r.organization || '';
    f.status.value = r.status === 'cancelled' ? 'attending' : r.status;
    f.guests.value = r.guests || 1; f.message.value = r.message || '';
    f.guests.disabled = f.status.value === 'not_attending';
    $('#cancelledNote').hidden = r.status !== 'cancelled';
    $('#cancelBtn').hidden = r.status === 'cancelled';
    history.replaceState(null, '', '/manage'); // keep the secret token out of the address bar and history
  }

  $('#lookupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await busy($('button', e.target), () => load(Object.fromEntries(new FormData(e.target)))); }
    catch (err) { toast(err.message, 'err'); }
  });

  $('#status').addEventListener('change', (e) => {
    const g = $('#guests'); g.disabled = e.target.value === 'not_attending'; if (g.disabled) g.value = 0; else if (!+g.value) g.value = 1;
  });

  $('#editForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target, body = { ...auth, ...Object.fromEntries(new FormData(form)) };
    if (form.elements.guests.disabled) body.guests = 0;
    setErrors(form);
    try {
      const r = await busy($('#saveBtn'), () => api('/api/rsvp/manage', { method: 'PUT', body }));
      $('#cancelledNote').hidden = true; $('#cancelBtn').hidden = false;
      toast(r.emailSent ? 'Saved. We emailed you the update.' : 'Your RSVP was saved.');
    } catch (err) { setErrors(form, err.details); toast(err.message, 'err'); }
  });

  $('#cancelBtn').addEventListener('click', async () => {
    if (!confirm('Cancel your RSVP? You can restore it later from this page.')) return;
    try {
      const r = await busy($('#cancelBtn'), () => api('/api/rsvp/cancel', { method: 'POST', body: auth }));
      $('#cancelledNote').hidden = false; $('#cancelBtn').hidden = true;
      toast(r.emailSent ? 'RSVP cancelled. We emailed you a confirmation.' : 'RSVP cancelled.');
    } catch (err) { toast(err.message, 'err'); }
  });

  const token = new URLSearchParams(location.search).get('token');
  if (token) load({ token }).catch((err) => toast(err.message, 'err'));
})();
