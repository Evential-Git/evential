(function () {
  'use strict';
  var form = document.getElementById('mailing-list-form');
  if (!form) return;
  var config = window.EVENTIAL_MAILING_LIST || {};
  var fallback = document.getElementById('mailing-list-fallback');
  var status = document.getElementById('mailing-list-status');
  var button = form.querySelector('button[type="submit"]');
  var widget;
  var token = '';
  var busy = false;
  // No active form until its backend and spam protection are configured.
  if (!config.endpoint || !config.turnstileSiteKey) return;
  try { if (new URL(config.endpoint).protocol !== 'https:') return; } catch (_) { return; }
  function clearToken() { token = ''; button.disabled = true; }
  window.eventialMailingReady = function () {
    form.hidden = false;
    fallback.hidden = true;
    widget = window.turnstile.render('#mailing-list-challenge', {
      sitekey: config.turnstileSiteKey,
      action: 'mailing-list',
      callback: function (value) { token = value; button.disabled = busy; },
      'expired-callback': clearToken,
      'error-callback': function () { clearToken(); status.textContent = 'Spam check could not load. Please reload or email contact@evential.co.'; }
    });
  };
  var script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=eventialMailingReady&render=explicit';
  script.async = true;
  script.onerror = function () { form.hidden = true; fallback.hidden = false; };
  document.head.appendChild(script);
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (busy || !form.reportValidity() || !token) return;
    busy = true;
    button.disabled = true;
    status.textContent = 'Saving your signup…';
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 25000);
    try {
      var response = await fetch(config.endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ email: form.elements.email.value, firstName: form.elements.firstName.value,
          consent: form.elements.consent.checked, website: form.elements.website.value, token: token })
      });
      var result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save your signup. Please try again.');
      status.textContent = result.message;
      form.reset();
    } catch (error) {
      status.textContent = error.name === 'AbortError' || error instanceof TypeError
        ? 'Could not connect. Please try again or email contact@evential.co.' : error.message;
    } finally {
      clearTimeout(timeout);
      busy = false;
      clearToken();
      window.turnstile.reset(widget);
    }
  });
})();
