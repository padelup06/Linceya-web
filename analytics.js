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

  var GA_ID = 'G-Q4S2XFZENT';

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

  // 5. Helpers de tracking custom — appelés depuis les boutons clés du site
  window.linceyaTrack = {
    appDownloadClick: function(store) {
      gtag('event', 'app_download_click', {
        'store': store,           // 'apple' ou 'google'
        'event_category': 'engagement'
      });
    },
    checkoutClick: function(plan) {
      gtag('event', 'begin_checkout', {
        'plan': plan,             // 'monthly' ou 'annual'
        'currency': 'EUR',
        'value': plan === 'annual' ? 99.99 : 9.99
      });
    },
    contactSubmit: function() {
      gtag('event', 'contact_submit', {
        'event_category': 'engagement'
      });
    },
    event: function(name, params) {
      gtag('event', name, params || {});
    }
  };

  // 6. Hook sur cookies.js — quand le consentement bouge, on bascule
  //    Consent Mode en "granted" pour les bonnes catégories.
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
