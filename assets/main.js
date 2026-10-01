(function () {
  'use strict';

  var cfg = window.ALPHA_CONFIG || {};
  var TRACKING_KEYS = ['gclid', 'gbraid', 'wbraid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  var STORAGE_KEY = 'alpha_attribution';

  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function storageGet(key) {
    try { return JSON.parse(window.localStorage.getItem(key) || 'null'); } catch (e) { return null; }
  }
  function storageSet(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
  }

  function track(event, params) {
    if (typeof window.gtag === 'function') window.gtag('event', event, params || {});
  }

  // --- Apply config to the page ---
  function applyConfig() {
    if (cfg.phone) {
      $all('.js-phone').forEach(function (a) { a.href = 'tel:+' + cfg.phone; });
    }
    if (cfg.phoneDisplay) {
      $all('.js-phone-text').forEach(function (el) { el.textContent = cfg.phoneDisplay; });
    }
    $all('.js-whatsapp').forEach(function (a) {
      if (cfg.whatsapp) a.href = 'https://wa.me/' + cfg.whatsapp;
      else a.remove();
    });
    if (cfg.address) {
      $all('.js-address').forEach(function (el) { el.textContent = 'მისამართი: ' + cfg.address; });
    }
    if (cfg.mapQuery) {
      $all('.js-map').forEach(function (f) {
        f.src = 'https://www.google.com/maps?q=' + encodeURIComponent(cfg.mapQuery) + '&z=15&output=embed';
      });
    }
    if (cfg.downPaymentMinPercent) {
      $all('.js-down-payment').forEach(function (el) { el.textContent = cfg.downPaymentMinPercent + '%'; });
    }
    $all('.js-year').forEach(function (el) { el.textContent = new Date().getFullYear(); });
  }

  // --- Attribution: keep gclid / UTM for the whole visit ---
  function captureAttribution() {
    var params = new URLSearchParams(window.location.search);
    var current = {};
    var found = false;
    TRACKING_KEYS.forEach(function (k) {
      var v = params.get(k);
      if (v) { current[k] = v; found = true; }
    });
    if (found) {
      current.landing_url = window.location.href;
      current.captured_at = new Date().toISOString();
      storageSet(STORAGE_KEY, current);
      return current;
    }
    return storageGet(STORAGE_KEY) || {};
  }

  // --- Phone helpers (Georgian mobile: 5XX XX XX XX) ---
  function phoneDigits(value) {
    var d = String(value || '').replace(/\D/g, '');
    if (d.indexOf('995') === 0 && d.length > 9) d = d.slice(3);
    if (d.charAt(0) === '0' && d.length === 10) d = d.slice(1);
    return d.slice(0, 9);
  }
  function formatPhone(d) {
    var parts = [d.slice(0, 3), d.slice(3, 5), d.slice(5, 7), d.slice(7, 9)];
    return parts.filter(Boolean).join(' ');
  }
  function isValidPhone(d) { return /^5\d{8}$/.test(d); }

  // --- Forms ---
  function setFieldError(input, hasError) {
    var field = input.closest('.field');
    if (field) field.classList.toggle('field--error', hasError);
    input.setAttribute('aria-invalid', hasError ? 'true' : 'false');
  }

  function validate(form) {
    var ok = true;
    var name = form.elements.name;
    var phone = form.elements.phone;
    var nameOk = name.value.trim().length >= 2;
    setFieldError(name, !nameOk);
    var phoneOk = isValidPhone(phoneDigits(phone.value));
    setFieldError(phone, !phoneOk);
    if (!nameOk) { ok = false; name.focus(); }
    else if (!phoneOk) { ok = false; phone.focus(); }
    return ok;
  }

  function sendLead(payload) {
    if (!cfg.leadEndpoint) {
      console.info('[alpha] leadEndpoint არ არის მითითებული — ლიდი:', payload);
      return Promise.resolve();
    }
    return fetch(cfg.leadEndpoint, {
      method: 'POST',
      // text/plain avoids a CORS preflight (works with Google Apps Script)
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      keepalive: true
    }).then(function (res) {
      if (!res.ok && res.type !== 'opaque') throw new Error('HTTP ' + res.status);
    });
  }

  function reportConversion(callback) {
    var done = false;
    function finish() { if (!done) { done = true; callback(); } }
    if (typeof window.gtag === 'function' && cfg.adsConversionSendTo && cfg.adsConversionSendTo.indexOf('XXXX') === -1) {
      window.gtag('event', 'conversion', { send_to: cfg.adsConversionSendTo, event_callback: finish });
      setTimeout(finish, 1200);
    } else {
      finish();
    }
  }

  function initForms(attribution) {
    $all('.js-lead-form').forEach(function (form) {
      var phone = form.elements.phone;
      var status = form.querySelector('.form-status');
      var started = false;

      phone.addEventListener('input', function () {
        phone.value = formatPhone(phoneDigits(phone.value));
      });

      form.addEventListener('focusin', function () {
        if (!started) { started = true; track('form_start', { form_id: form.dataset.formId }); }
      });
      $all('input', form).forEach(function (input) {
        input.addEventListener('input', function () { setFieldError(input, false); });
      });

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (form.classList.contains('is-loading')) return;
        if (form.elements.website && form.elements.website.value) return; // honeypot
        if (!validate(form)) return;

        var apt = form.querySelector('input[name="apartment"]:checked');
        var payload = Object.assign({
          name: form.elements.name.value.trim(),
          phone: '+995' + phoneDigits(phone.value),
          apartment: apt ? apt.value : '',
          form_id: form.dataset.formId,
          page: window.location.href.split('#')[0],
          referrer: document.referrer,
          submitted_at: new Date().toISOString()
        }, attribution);

        form.classList.add('is-loading');
        status.textContent = '';
        status.classList.remove('form-status--error');

        sendLead(payload).then(function () {
          track('generate_lead', { form_id: payload.form_id, apartment: payload.apartment });
          storageSet('alpha_lead_sent', { at: payload.submitted_at });
          reportConversion(function () {
            window.location.href = (cfg.thankYouUrl || 'thank-you.html') + '?apt=' + encodeURIComponent(payload.apartment);
          });
        }).catch(function () {
          form.classList.remove('is-loading');
          status.classList.add('form-status--error');
          status.textContent = 'გაგზავნა ვერ მოხერხდა. სცადეთ თავიდან ან დაგვირეკეთ: ' + (cfg.phoneDisplay || '');
        });
      });
    });

    // Apartment cards preselect the option in the hero form
    $all('.js-pick').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var radio = document.querySelector('.js-lead-form input[name="apartment"][value="' + btn.dataset.apartment + '"]');
        if (radio) radio.checked = true;
        track('select_apartment', { apartment: btn.dataset.apartment });
        setTimeout(function () {
          var name = document.querySelector('#form input[name="name"]');
          if (name) name.focus({ preventScroll: true });
        }, 400);
      });
    });
  }

  // --- Click tracking (calls, WhatsApp) ---
  function initClickTracking() {
    $all('[data-track]').forEach(function (el) {
      el.addEventListener('click', function () {
        var kind = el.dataset.track;
        track(kind.indexOf('whatsapp') === 0 ? 'whatsapp_click' : 'phone_click', { location: kind });
        if (kind.indexOf('call') === 0 && cfg.adsCallConversionSendTo && typeof window.gtag === 'function') {
          window.gtag('event', 'conversion', { send_to: cfg.adsCallConversionSendTo });
        }
      });
    });
  }

  // --- Installment calculator ---
  function initCalculator() {
    var price = document.querySelector('.js-calc-price');
    var down = document.querySelector('.js-calc-down');
    var months = document.querySelector('.js-calc-months');
    if (!price || !down || !months) return;

    if (cfg.downPaymentMinPercent) { down.min = cfg.downPaymentMinPercent; if (+down.value < cfg.downPaymentMinPercent) down.value = cfg.downPaymentMinPercent; }
    if (cfg.maxInstallmentMonths) { months.max = cfg.maxInstallmentMonths; months.value = cfg.maxInstallmentMonths; }

    var usd = function (n) { return '$' + Math.round(n).toLocaleString('en-US'); };

    function update() {
      var p = +price.value, d = +down.value, m = +months.value;
      document.querySelector('.js-calc-price-out').textContent = usd(p);
      document.querySelector('.js-calc-down-out').textContent = d + '% (' + usd(p * d / 100) + ')';
      document.querySelector('.js-calc-months-out').textContent = m + ' თვე';
      document.querySelector('.js-calc-monthly').textContent = usd(p * (1 - d / 100) / m);
    }
    [price, down, months].forEach(function (el) { el.addEventListener('input', update); });
    update();
  }

  // --- Header shadow on scroll ---
  function initHeader() {
    var header = document.querySelector('.header');
    var onScroll = function () { header.classList.toggle('header--scrolled', window.scrollY > 8); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  applyConfig();
  initForms(captureAttribution());
  initClickTracking();
  initCalculator();
  initHeader();
})();
