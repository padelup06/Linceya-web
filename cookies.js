/**
 * Linceya Cookie Consent
 * - GDPR / CNIL compliant
 * - 3 categories: necessary (always on), analytics, marketing
 * - localStorage versioning so we can invalidate consent later
 *
 * Public API (after page load):
 *   window.linceyaConsent.hasConsent('analytics')   -> bool
 *   window.linceyaConsent.openSettings()             -> open modal
 *   window.linceyaConsent.onConsent('analytics', fn) -> call fn when granted
 *   window.linceyaConsent.reset()                    -> clear consent + reload
 *
 * Usage example for Google Analytics (add later in your <head>):
 *   <script>
 *     window.linceyaConsent.onConsent('analytics', function() {
 *       // load GA / gtag here
 *     });
 *   </script>
 */
(function() {
  'use strict';

  var STORAGE_KEY = 'linceya_cookie_consent_v1';

  function getStoredConsent() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !parsed.timestamp) return null;
      return parsed;
    } catch (e) { return null; }
  }

  function saveConsent(consent) {
    try {
      var data = Object.assign({}, consent, {
        timestamp: Date.now(),
        version: 1
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  var css = [
    '.lcc-banner{position:fixed;bottom:14px;left:14px;right:14px;max-width:560px;margin:0 auto;background:#0E1B35;color:#F2EDE2;border:1px solid rgba(180,138,74,0.3);border-radius:12px;padding:14px 16px;box-shadow:0 10px 28px rgba(0,0,0,0.35);z-index:9999;font-family:Archivo,system-ui,sans-serif;display:none}',
    '.lcc-banner.show{display:block;animation:lcc-up .4s ease}',
    '@keyframes lcc-up{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}',
    '.lcc-text{font-size:12.5px;line-height:1.5;color:rgba(242,237,226,0.82);margin-bottom:12px}',
    '.lcc-text strong{color:#D4B87A;font-weight:700;letter-spacing:.04em;margin-right:6px}',
    '.lcc-text a{color:#D4B87A;text-decoration:underline}',
    '.lcc-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}',
    '.lcc-btn{font-family:Archivo,system-ui,sans-serif;font-size:12px;font-weight:600;letter-spacing:.03em;padding:7px 14px;border-radius:999px;border:1px solid transparent;cursor:pointer;transition:all .18s}',
    '.lcc-btn-secondary{background:transparent;color:rgba(242,237,226,0.7);border-color:rgba(255,255,255,0.18)}',
    '.lcc-btn-secondary:hover{color:#F2EDE2;border-color:rgba(255,255,255,0.35)}',
    '.lcc-btn-primary{background:linear-gradient(135deg,#D4B87A 0%,#B48A4A 100%);color:#0E1B35;border-color:transparent}',
    '.lcc-btn-primary:hover{filter:brightness(1.08);transform:translateY(-1px)}',
    '.lcc-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);z-index:10000;display:none;align-items:center;justify-content:center;padding:20px}',
    '.lcc-overlay.show{display:flex}',
    '.lcc-modal{background:#FFFFFF;color:#0E1B35;border-radius:18px;max-width:540px;width:100%;max-height:85vh;overflow-y:auto;padding:32px;font-family:Archivo,system-ui,sans-serif;box-shadow:0 24px 60px rgba(0,0,0,0.4)}',
    '.lcc-modal-title{font-family:"Archivo Black",Archivo,sans-serif;font-size:22px;line-height:1.1;letter-spacing:-.01em;margin-bottom:8px;text-transform:uppercase}',
    '.lcc-modal-sub{font-size:14px;line-height:1.55;color:#6B7489;margin-bottom:24px}',
    '.lcc-cat{border-top:1px solid #E8E2D0;padding:18px 0}',
    '.lcc-cat:last-of-type{border-bottom:1px solid #E8E2D0;margin-bottom:24px}',
    '.lcc-cat-row{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:6px}',
    '.lcc-cat-name{font-weight:700;font-size:14px}',
    '.lcc-cat-desc{font-size:13px;line-height:1.5;color:#6B7489}',
    '.lcc-toggle{position:relative;width:40px;height:22px;border-radius:22px;background:#D8D0BE;cursor:pointer;transition:background .2s;flex-shrink:0}',
    '.lcc-toggle::after{content:"";position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:white;transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,0.2)}',
    '.lcc-toggle.on{background:#B48A4A}',
    '.lcc-toggle.on::after{transform:translateX(18px)}',
    '.lcc-toggle.disabled{cursor:not-allowed;opacity:.7}',
    '.lcc-modal-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}',
    '.lcc-modal-actions .lcc-btn-secondary{color:#6B7489;border-color:#D8D0BE}',
    '.lcc-modal-actions .lcc-btn-secondary:hover{color:#0E1B35;border-color:#B48A4A}',
    '@media (max-width:540px){.lcc-banner{left:8px;right:8px;bottom:8px;padding:14px}.lcc-text{font-size:12px;margin-bottom:10px}.lcc-actions{gap:6px}.lcc-btn{flex:1;padding:8px 10px;font-size:11.5px}.lcc-modal{padding:24px 22px}.lcc-modal-actions{flex-direction:column-reverse}.lcc-modal-actions .lcc-btn{width:100%}}'
  ].join('');

  var I18N = {
    fr: {
      cookies: 'COOKIES',
      banner: 'Nous utilisons des cookies pour améliorer votre expérience.',
      learn: 'En savoir plus',
      customize: 'Choisir', reject: 'Refuser', accept: 'Accepter',
      modalTitle: 'Préférences cookies',
      modalSub: 'Choisissez les catégories que vous autorisez. Vous pouvez modifier vos préférences à tout moment depuis le pied de page.',
      necName: 'Strictement nécessaires',
      necDesc: 'Indispensables au fonctionnement du site (sécurité, protection anti-bot Cloudflare). Toujours actifs.',
      anaName: 'Mesure d\'audience',
      anaDesc: 'Nous aident à comprendre comment le site est utilisé pour l\'améliorer (Google Analytics).',
      mktName: 'Marketing',
      mktDesc: 'Pour mesurer l\'efficacité de nos campagnes publicitaires (Meta Pixel, etc.).',
      rejectAll: 'Tout refuser', save: 'Enregistrer mes choix',
      privacyPath: '/privacy-policy.html'
    },
    en: {
      cookies: 'COOKIES',
      banner: 'We use cookies to enhance your experience.',
      learn: 'Learn more',
      customize: 'Customize', reject: 'Reject', accept: 'Accept',
      modalTitle: 'Cookie preferences',
      modalSub: 'Choose the categories you allow. You can update your preferences anytime from the footer.',
      necName: 'Strictly necessary',
      necDesc: 'Essential for site operation (security, Cloudflare anti-bot protection). Always active.',
      anaName: 'Analytics',
      anaDesc: 'Help us understand how the site is used to improve it (Google Analytics).',
      mktName: 'Marketing',
      mktDesc: 'To measure the effectiveness of our advertising campaigns (Meta Pixel, etc.).',
      rejectAll: 'Reject all', save: 'Save my choices',
      privacyPath: '/en/privacy-policy.html'
    },
    es: {
      cookies: 'COOKIES',
      banner: 'Usamos cookies para mejorar tu experiencia.',
      learn: 'Más info',
      customize: 'Elegir', reject: 'Rechazar', accept: 'Aceptar',
      modalTitle: 'Preferencias de cookies',
      modalSub: 'Elige las categorías que autorizas. Puedes modificar tus preferencias en cualquier momento desde el pie de página.',
      necName: 'Estrictamente necesarias',
      necDesc: 'Indispensables para el funcionamiento del sitio (seguridad, protección anti-bot de Cloudflare). Siempre activas.',
      anaName: 'Medición de audiencia',
      anaDesc: 'Nos ayudan a entender cómo se usa el sitio para mejorarlo (Google Analytics).',
      mktName: 'Marketing',
      mktDesc: 'Para medir la eficacia de nuestras campañas publicitarias (Meta Pixel, etc.).',
      rejectAll: 'Rechazar todo', save: 'Guardar mis opciones',
      privacyPath: '/es/privacy-policy.html'
    }
  };
  var lang = (document.documentElement.lang || 'fr').slice(0,2).toLowerCase();
  var t = I18N[lang] || I18N.fr;

  var bannerHTML =
    '<div class="lcc-text"><strong>' + t.cookies + '</strong>' + t.banner + ' <a href="' + t.privacyPath + '">' + t.learn + '</a>.</div>' +
    '<div class="lcc-actions">' +
      '<button class="lcc-btn lcc-btn-secondary" data-action="customize">' + t.customize + '</button>' +
      '<button class="lcc-btn lcc-btn-secondary" data-action="reject">' + t.reject + '</button>' +
      '<button class="lcc-btn lcc-btn-primary" data-action="accept">' + t.accept + '</button>' +
    '</div>';

  var modalHTML =
    '<div class="lcc-modal" role="dialog" aria-modal="true" aria-labelledby="lcc-modal-title">' +
      '<div class="lcc-modal-title" id="lcc-modal-title">' + t.modalTitle + '</div>' +
      '<div class="lcc-modal-sub">' + t.modalSub + '</div>' +
      '<div class="lcc-cat">' +
        '<div class="lcc-cat-row">' +
          '<div class="lcc-cat-name">' + t.necName + '</div>' +
          '<div class="lcc-toggle on disabled" data-cat="necessary"></div>' +
        '</div>' +
        '<div class="lcc-cat-desc">' + t.necDesc + '</div>' +
      '</div>' +
      '<div class="lcc-cat">' +
        '<div class="lcc-cat-row">' +
          '<div class="lcc-cat-name">' + t.anaName + '</div>' +
          '<div class="lcc-toggle" data-cat="analytics"></div>' +
        '</div>' +
        '<div class="lcc-cat-desc">' + t.anaDesc + '</div>' +
      '</div>' +
      '<div class="lcc-cat">' +
        '<div class="lcc-cat-row">' +
          '<div class="lcc-cat-name">' + t.mktName + '</div>' +
          '<div class="lcc-toggle" data-cat="marketing"></div>' +
        '</div>' +
        '<div class="lcc-cat-desc">' + t.mktDesc + '</div>' +
      '</div>' +
      '<div class="lcc-modal-actions">' +
        '<button class="lcc-btn lcc-btn-secondary" data-action="reject-all">' + t.rejectAll + '</button>' +
        '<button class="lcc-btn lcc-btn-primary" data-action="save">' + t.save + '</button>' +
      '</div>' +
    '</div>';

  function injectStyles() {
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  function createBanner() {
    var b = document.createElement('div');
    b.className = 'lcc-banner';
    b.setAttribute('role', 'dialog');
    b.setAttribute('aria-label', 'Préférences cookies');
    b.innerHTML = bannerHTML;
    document.body.appendChild(b);
    return b;
  }

  function createOverlay() {
    var o = document.createElement('div');
    o.className = 'lcc-overlay';
    o.innerHTML = modalHTML;
    document.body.appendChild(o);
    return o;
  }

  var listeners = { analytics: [], marketing: [] };

  function fireListeners(consent) {
    Object.keys(listeners).forEach(function(cat) {
      if (consent[cat]) {
        var queue = listeners[cat];
        listeners[cat] = [];
        queue.forEach(function(cb) {
          try { cb(); } catch (e) { console.error('linceyaConsent listener error', e); }
        });
      }
    });
  }

  function init() {
    injectStyles();
    var banner = createBanner();
    var overlay = createOverlay();
    var modal = overlay.querySelector('.lcc-modal');

    var stored = getStoredConsent();
    var currentConsent = stored || { necessary: true, analytics: false, marketing: false };

    function showBanner() { banner.classList.add('show'); }
    function hideBanner() { banner.classList.remove('show'); }
    function showModal() {
      modal.querySelectorAll('.lcc-toggle').forEach(function(t) {
        var cat = t.dataset.cat;
        if (currentConsent[cat]) t.classList.add('on');
        else if (cat !== 'necessary') t.classList.remove('on');
      });
      overlay.classList.add('show');
    }
    function hideModal() { overlay.classList.remove('show'); }

    function applyAndSave(consent) {
      currentConsent = Object.assign({}, consent);
      saveConsent(consent);
      fireListeners(consent);
      // Émet un event global pour les scripts qui veulent réagir à TOUTES
      // les transitions (granted ET denied), pas seulement aux "granted"
      // comme le fait fireListeners. Utilisé par analytics.js pour
      // basculer Consent Mode v2 de GA4 dans les deux sens.
      try {
        window.dispatchEvent(new CustomEvent('linceyaConsentChange', {
          detail: Object.assign({}, consent)
        }));
      } catch (_) {}
      hideBanner();
      hideModal();
    }

    banner.querySelector('[data-action="accept"]').addEventListener('click', function() {
      applyAndSave({ necessary: true, analytics: true, marketing: true });
    });
    banner.querySelector('[data-action="reject"]').addEventListener('click', function() {
      applyAndSave({ necessary: true, analytics: false, marketing: false });
    });
    banner.querySelector('[data-action="customize"]').addEventListener('click', showModal);

    modal.querySelectorAll('.lcc-toggle:not(.disabled)').forEach(function(t) {
      t.addEventListener('click', function() { t.classList.toggle('on'); });
    });

    modal.querySelector('[data-action="reject-all"]').addEventListener('click', function() {
      applyAndSave({ necessary: true, analytics: false, marketing: false });
    });
    modal.querySelector('[data-action="save"]').addEventListener('click', function() {
      var consent = { necessary: true };
      modal.querySelectorAll('.lcc-toggle[data-cat]').forEach(function(t) {
        var cat = t.dataset.cat;
        if (cat === 'necessary') return;
        consent[cat] = t.classList.contains('on');
      });
      applyAndSave(consent);
    });

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay && getStoredConsent()) hideModal();
    });

    if (!stored) {
      setTimeout(showBanner, 500);
    } else {
      fireListeners(currentConsent);
    }

    window.linceyaConsent = {
      hasConsent: function(cat) { return !!currentConsent[cat]; },
      openSettings: showModal,
      onConsent: function(cat, cb) {
        if (currentConsent[cat]) {
          try { cb(); } catch (e) { console.error(e); }
        } else if (listeners[cat]) {
          listeners[cat].push(cb);
        }
      },
      reset: function() {
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
        location.reload();
      }
    };

    document.querySelectorAll('[data-cookies-settings]').forEach(function(el) {
      el.addEventListener('click', function(e) {
        e.preventDefault();
        showModal();
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
