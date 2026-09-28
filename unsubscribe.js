(function () {
  'use strict';
  var form = document.getElementById('unsubscribe-form');
  var status = document.getElementById('unsubscribe-status');
  var button = form.querySelector('button');
  var config = window.EVENTIAL_MAILING_LIST || {};
  // A second personal link opened in the same tab must never reuse the old token.
  window.addEventListener('hashchange', function () { window.location.reload(); });
  // Fragments are not sent in page requests or referrers. Never put email in a link.
  var token = new URLSearchParams(window.location.hash.slice(1)).get('token');
  if (!token || !/^[0-9a-f]{64}$/.test(token)) {
    status.textContent = 'Open the personal unsubscribe link in your newsletter, or email us below for help.';
    return;
  }
  if (!config.unsubscribeEndpoint) {
    status.textContent = 'Unsubscribe is temporarily unavailable. Please email us below.';
    return;
  }
  form.hidden = false;
  var busy = false;
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (busy) return;
    busy = true;
    button.disabled = true;
    status.textContent = 'Saving your preference…';
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 15000);
    try {
      var response = await fetch(config.unsubscribeEndpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token }), signal: controller.signal,
        credentials: 'omit', referrerPolicy: 'no-referrer'
      });
      var result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save your preference. Please try again.');
      document.getElementById('unsubscribe-heading').textContent = 'You’re unsubscribed';
      document.getElementById('unsubscribe-description').textContent = 'You will no longer receive Evential mailing-list emails.';
      status.textContent = 'Your email preference has been saved.';
      form.hidden = true;
    } catch (error) {
      status.textContent = error.name === 'AbortError' || error instanceof TypeError
        ? 'Could not connect. Please try again or email us below.' : error.message;
    } finally {
      clearTimeout(timeout);
      busy = false;
      button.disabled = false;
    }
  });
})();
