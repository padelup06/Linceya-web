/**
 * Linceya — Google Analytics 4 avec Consent Mode v2.
 *
 * Conformité RGPD / CNIL :
 * - Tous les consentements partent en "denied" par défaut.
 * - GA4 démarre immédiatement mais n'envoie que des pings anonymes
 *   (no cookies, no PII) tant que l'user n'a pas accepté.
 * - cookies.js bascule sur "granted" quand l'user accepte analytics
 *   ou marketing dans la bannière.
 *
 * Custom events exposés :
 *   window.linceyaTrack.appDownloadClick(store)   // 'apple' | 'google'
 *   window.linceyaTrack.checkoutClick(plan)       // 'monthly' | 'annual'
 *   window.linceyaTrack.contactSubmit()
 *   window.linceyaTrack.event(name, params)       // event custom
 */
(function() {
  'use strict';

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // IDs des plateformes — remplis-les quand tu auras créé chaque pixel.
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  var GA_ID = 'G-Q4S2XFZENT';
  var META_PIXEL_ID = '';     // 16 chiffres — https://business.facebook.com → Events Manager
  var TIKTOK_PIXEL_ID = 'D83L7EBC77U7C4HA8BM0';   // https://ads.tiktok.com → Events Manager
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // 1. Init dataLayer + gtag stub (sync, avant le chargement de gtag.js)
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;

  // 2. Consent Mode v2 — defaults DENIED pour conformité RGPD
  //    https://developers.google.com/tag-platform/security/guides/consent
  gtag('consent', 'default', {
    'ad_storage': 'denied',
    'ad_user_data': 'denied',
    'ad_personalization': 'denied',
    'analytics_storage': 'denied',
    'functionality_storage': 'granted',  // strictement nécessaire
    'security_storage': 'granted',       // strictement nécessaire
    'wait_for_update': 500               // attend cookies.js 500ms max
  });

  // 3. Charge gtag.js depuis Google (async, ne bloque pas le rendu)
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  document.head.appendChild(s);

  // 4. Configure GA4
  gtag('js', new Date());
  gtag('config', GA_ID, {
    'anonymize_ip': true,              // anonymisation IP (CNIL recommandé)
    'allow_google_signals': false,     // pas de remarketing tant que consent pas donné
    'cookie_flags': 'SameSite=None;Secure'
  });

  // ── Meta Pixel (Facebook + Instagram ads) ────────────────────────
  // Chargé uniquement après consent marketing (RGPD). Stub présent dès
  // le départ pour pouvoir queue les events avant le load.
  var metaLoaded = false;
  function initMetaPixel() {
    if (metaLoaded || !META_PIXEL_ID) return;
    metaLoaded = true;
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
    document,'script','https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', META_PIXEL_ID);
    window.fbq('track', 'PageView');
  }

  // ── TikTok Pixel ─────────────────────────────────────────────────
  var tiktokLoaded = false;
  function initTikTokPixel() {
    if (tiktokLoaded || !TIKTOK_PIXEL_ID) return;
    tiktokLoaded = true;
    !function (w, d, t) {
      w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify",
      "instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie",
      "holdConsent","revokeConsent","grantConsent"];ttq.setAndDefer=function(t,e){
      t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
      for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
      ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
      ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",
      o=n&&n.partner;ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=r;ttq._t=ttq._t||{};
      ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};
      n=document.createElement("script");n.type="text/javascript";n.async=!0;
      n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];
      e.parentNode.insertBefore(n,e)};
      ttq.load(TIKTOK_PIXEL_ID);
      ttq.page();
    }(window, document, 'ttq');
  }

  // 5. Helpers de tracking custom — appelés depuis les boutons clés du site.
  // Forwardent vers GA4 + Meta Pixel + TikTok Pixel quand chargés.
  window.linceyaTrack = {
    appDownloadClick: function(store) {
      gtag('event', 'app_download_click', {
        'store': store,           // 'apple' ou 'google'
        'event_category': 'engagement'
      });
      if (window.fbq) window.fbq('trackCustom', 'AppDownloadClick', { store: store });
      if (window.ttq) window.ttq.track('ClickButton', { content_name: 'app_download_' + store });
    },
    checkoutClick: function(plan) {
      var value = plan === 'annual' ? 99.99 : 9.99;
      gtag('event', 'begin_checkout', {
        'plan': plan,             // 'monthly' ou 'annual'
        'currency': 'EUR',
        'value': value
      });
      // Meta Pixel standard event "InitiateCheckout"
      if (window.fbq) window.fbq('track', 'InitiateCheckout', {
        currency: 'EUR', value: value, content_name: 'Linceya Premium ' + plan
      });
      // TikTok Pixel standard event "InitiateCheckout"
      if (window.ttq) window.ttq.track('InitiateCheckout', {
        value: value, currency: 'EUR', content_id: 'linceya_premium_' + plan
      });
    },
    contactSubmit: function() {
      gtag('event', 'contact_submit', { 'event_category': 'engagement' });
      if (window.fbq) window.fbq('track', 'Contact');
      if (window.ttq) window.ttq.track('Contact');
    },
    event: function(name, params) {
      gtag('event', name, params || {});
    }
  };

  // 6. Hook sur cookies.js — quand le consentement bouge, on bascule
  //    Consent Mode GA4 + on charge Meta/TikTok seulement si marketing accepté.
  function syncConsent() {
    if (!window.linceyaConsent) return;
    var analytics = window.linceyaConsent.hasConsent('analytics');
    var marketing = window.linceyaConsent.hasConsent('marketing');
    gtag('consent', 'update', {
      'analytics_storage': analytics ? 'granted' : 'denied',
      'ad_storage': marketing ? 'granted' : 'denied',
      'ad_user_data': marketing ? 'granted' : 'denied',
      'ad_personalization': marketing ? 'granted' : 'denied'
    });
    // Marketing consent → on charge les pixels publicitaires
    // (Meta + TikTok). Ils restent inertes tant que consent pas donné.
    if (marketing) {
      initMetaPixel();
      initTikTokPixel();
    }
  }

  // Auto-tracking des clics App Store / Play Store partout sur le site,
  // sans avoir à toucher au HTML de chaque page. On délègue sur document
  // pour catcher les futurs boutons ajoutés dynamiquement.
  function setupAutoTracking() {
    document.addEventListener('click', function(e) {
      var link = e.target.closest('a[href]');
      if (!link) return;
      var href = link.href || '';
      if (href.indexOf('apps.apple.com') !== -1) {
        window.linceyaTrack.appDownloadClick('apple');
      } else if (href.indexOf('play.google.com') !== -1) {
        window.linceyaTrack.appDownloadClick('google');
      }
    }, { passive: true });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupAutoTracking);
  } else {
    setupAutoTracking();
  }

  // cookies.js peut être chargé avant ou après analytics.js (defer/async).
  // On écoute l'event custom 'linceyaConsentChange' émis par cookies.js
  // à chaque update — couvre granted ET denied dans les 2 sens.
  window.addEventListener('linceyaConsentChange', syncConsent);

  // Cas où l'user a déjà consenti à un précédent visit : cookies.js a
  // restauré currentConsent depuis localStorage SANS dispatch d'event.
  // On poll pour attraper l'init initial.
  var attempts = 0;
  var poll = setInterval(function() {
    if (window.linceyaConsent) {
      clearInterval(poll);
      syncConsent();
    } else if (++attempts > 20) {
      clearInterval(poll);
    }
  }, 100);
})();
