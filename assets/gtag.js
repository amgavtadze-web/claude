// Loads the Google tag using the Ads / GA4 IDs from config.js (shared by all pages).
(function () {
  var cfg = window.ALPHA_CONFIG || {};
  var adsId = (cfg.adsConversionSendTo || '').split('/')[0];
  var ids = [adsId, cfg.ga4Id].filter(function (id) { return id && id.indexOf('XXXX') === -1; });

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  if (!ids.length) return;

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ids[0]);
  document.head.appendChild(s);

  window.gtag('js', new Date());
  ids.forEach(function (id) { window.gtag('config', id); });
})();
