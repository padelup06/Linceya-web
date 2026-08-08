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
 *   window.linceyaTrack.checkoutClick(plan)       // 'monthly' | 'annual' | 'elite'
 *   window.linceyaTrack.contactSubmit()
 *   window.linceyaTrack.plan(plan)                // descripteur du palier
 *   window.linceyaTrack.event(name, params)       // event custom
 */
(function() {
  'use strict';

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // IDs des plateformes — remplis-les quand tu auras créé chaque pixel.
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  var GA_ID = 'G-Q4S2XFZENT';
  var META_PIXEL_ID = '1746089276583500';   // dataset « Linceya Web » — https://business.facebook.com → Gestionnaire d'événements
  var TIKTOK_PIXEL_ID = 'D83L7EBC77U7C4HA8BM0';   // https://ads.tiktok.com → Events Manager
  var X_PIXEL_ID = 're8do';   // https://ads.x.com → Outils → Gestionnaire d'événements
  // X n'accepte pas de noms d'événements : chaque conversion doit être créée
  // dans son gestionnaire, qui renvoie un identifiant de la forme
  // « tw-<pixel>-<event> ». Ces identifiants ne se devinent PAS — un
  // identifiant fabriqué est rejeté en silence, sans le moindre message.
  // Attention à la ressemblance avec le pixel : un caractère les sépare.
  var X_EVENTS = {
    checkout: 'tw-re8do-re8ds',  // « Checkout initiated », type Add to cart
    purchase: 'tw-re8do-re8du',  // « Abonnement souscrit », type Purchase
    appDownload: ''              // aucune conversion créée pour ça à ce jour
  };
  var SNAPCHAT_PIXEL_ID = '4caca82b-9d91-43a1-b02d-7793717cb09f';   // https://ads.snapchat.com → Gestionnaire d'événements → Pixel Snap
  // Google Ads. Le site mesure déjà tout correctement via GA4 ; deux chemins
  // existent donc, et ils ne s'excluent pas :
  //   a) importer les conversions GA4 dans Google Ads — zéro code, mais
  //      attribution passée par le modèle GA4, donc plus tardive ;
  //   b) renseigner ces trois valeurs pour une remontée directe, plus fidèle,
  //      que Google recommande désormais pour l'optimisation des enchères.
  // L'étiquette se lit dans Google Ads → Objectifs → Conversions → l'action.
  var GOOGLE_ADS_ID = '';               // AW-XXXXXXXXX
  var GOOGLE_ADS_LABEL_CHECKOUT = '';   // étiquette de l'action « début de paiement »
  var GOOGLE_ADS_LABEL_PURCHASE = '';   // étiquette de l'action « achat »
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // ── Pages dont l'URL porte un secret ─────────────────────────────
  // Deux pages du site reçoivent des données sensibles en paramètres :
  // /activate (email du client + code d'activation Premium à 6 chiffres) et
  // /welcome-premium (code d'échange de session Supabase, ou jeton d'accès
  // en fragment). Or TOUTES les régies transmettent l'URL courante avec leur
  // pageview : GA4 dans `page_location`, TikTok via ttq.page(), Meta via
  // fbq PageView. Poser un simple tag sur ces pages enverrait donc des
  // identifiants d'authentification et une donnée personnelle à trois tiers.
  //
  // Ces deux drapeaux, posés par la page AVANT le chargement de ce fichier,
  // ferment les deux fuites :
  //   window.linceyaPageLocation — URL de substitution envoyée à GA4 en lieu
  //                                et place de l'adresse réelle.
  //   window.linceyaNoAdPixels   — n'initialise jamais les pixels
  //                                publicitaires sur cette page.
  //
  // Le second est volontairement radical plutôt que chirurgical : le SDK
  // TikTok lit `location.href` lui-même, on ne peut pas lui mentir depuis
  // ici. Ne rien charger est la seule garantie. Ces pages sont en noindex,
  // arrivent après le paiement, et la conversion est déjà comptée sur la
  // page de retour Stripe : leur valeur publicitaire est nulle.
  var pageLocationOverride = typeof window.linceyaPageLocation === 'string'
    ? window.linceyaPageLocation
    : null;
  var adPixelsBlocked = window.linceyaNoAdPixels === true;

  // Consentement marketing courant. Nécessaire parce qu'un SDK publicitaire
  // déjà chargé ne se décharge pas : si le visiteur revient sur son accord en
  // cours de visite, il faut le faire taire activement.
  var marketingGranted = false;

  // ── Cookies posés par les régies ─────────────────────────────────
  // Faire taire les SDK ne suffit pas : leurs cookies restent sur la machine
  // du visiteur. Un retrait qui laisse les traces en place n'est pas un
  // retrait, et la politique de confidentialité promet l'inverse.
  //
  // `_tt_enable_cookie` est le piège de cette liste : TikTok en pose DEUX,
  // et celui-là survit à un nettoyage qui ne viserait que `_ttp`.
  var MARKETING_COOKIES = [
    '_fbp', '_fbc',                      // Meta
    '_ttp', '_tt_enable_cookie',         // TikTok — les deux, pas seulement _ttp
    '_scid', '_scid_r',                  // Snapchat — first-party, donc effaçables
    '_gcl_au', '_gcl_aw', '_gcl_dc'      // Google Ads (conversion linker)
  ];
  // Les cookies de X (`personalization_id`, `muc_ads`) sont posés sur SON
  // domaine : inaccessibles depuis le nôtre. Ne rien promettre à leur sujet.
  // Même remarque pour `sc_at`, que Snapchat pose sur le sien : seuls ses
  // cookies first-party (`_scid`, `_scid_r`) sont à notre portée.

  /**
   * Efface un cookie.
   *
   * Un cookie ne s'efface que si le domaine ET le chemin correspondent
   * exactement à ceux de la pose — or `document.cookie` ne les expose pas en
   * lecture. On balaie donc les combinaisons plausibles : hôte courant, hôte
   * préfixé d'un point (la forme qu'emploient les régies pour couvrir les
   * sous-domaines), domaine apex, et sans domaine du tout.
   */
  function deleteCookie(name) {
    var host = window.location.hostname;
    var domains = [null, host, '.' + host];
    var parts = host.split('.');
    if (parts.length > 2) {
      var apex = parts.slice(-2).join('.');
      domains.push(apex, '.' + apex);
    }
    var expired = '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    for (var i = 0; i < domains.length; i++) {
      try {
        document.cookie = name + expired + (domains[i] ? '; domain=' + domains[i] : '');
      } catch (_) {}
    }
  }

  function purgeMarketingCookies() {
    for (var i = 0; i < MARKETING_COOKIES.length; i++) deleteCookie(MARKETING_COOKIES[i]);
  }

  /**
   * Cookies GA4. `_ga_<identifiant de flux>` porte un suffixe qui dépend de la
   * propriété : une liste figée le raterait. On balaie donc les cookies
   * réellement présents et on filtre par préfixe.
   */
  function purgeAnalyticsCookies() {
    try {
      var all = document.cookie ? document.cookie.split(';') : [];
      for (var i = 0; i < all.length; i++) {
        var name = all[i].split('=')[0].replace(/^\s+|\s+$/g, '');
        if (name === '_ga' || name.indexOf('_ga_') === 0) deleteCookie(name);
      }
    } catch (_) {}
  }

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
  var gaConfig = {
    'anonymize_ip': true,              // anonymisation IP (CNIL recommandé)
    'allow_google_signals': false,     // pas de remarketing tant que consent pas donné
    'cookie_flags': 'SameSite=None;Secure'
  };
  // Substitution posée DANS le `config`, et pas par un `gtag('set', …)` en
  // amont : un `set` empilé avant le `gtag('js', …)` n'est garanti nulle part
  // par la documentation Google, et s'il était ignoré la vraie URL — donc le
  // secret — partirait sans que rien ne le signale. Ici, la valeur fait
  // partie de la commande qui déclenche le pageview.
  if (pageLocationOverride) gaConfig.page_location = pageLocationOverride;
  gtag('config', GA_ID, gaConfig);

  // Google Ads partage la balise gtag deja chargee pour GA4 : aucun script
  // supplementaire, aucune requete de plus. Et le Consent Mode v2 configure
  // plus haut s applique automatiquement — `ad_storage` reste refuse tant que
  // l utilisateur n a pas accepte le marketing, sans code specifique.
  if (GOOGLE_ADS_ID) gtag('config', GOOGLE_ADS_ID);

  // ── Meta Pixel (Facebook + Instagram ads) ────────────────────────
  // Chargé uniquement après consent marketing (RGPD). Stub présent dès
  // le départ pour pouvoir queue les events avant le load.
  var metaLoaded = false;
  function initMetaPixel() {
    if (adPixelsBlocked || metaLoaded || !META_PIXEL_ID) return;
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
    // Garde en tete de fonction plutot qu au site d appel : c est le seul
    // moyen d etre sur qu aucun chemin present ou futur (file d attente de
    // consentement, appel depuis une page) ne puisse charger le SDK sur une
    // page dont l URL porte un secret.
    if (adPixelsBlocked || tiktokLoaded || !TIKTOK_PIXEL_ID) return;
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

  // ── Pixel X (ex-Twitter) ─────────────────────────────────────────
  var xLoaded = false;
  function initXPixel() {
    if (adPixelsBlocked || xLoaded || !X_PIXEL_ID) return;
    xLoaded = true;
    !function(e,t,n,s,u,a){e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):
    s.queue.push(arguments)},s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,
    u.src='https://static.ads-twitter.com/uwt.js',a=t.getElementsByTagName(n)[0],
    a.parentNode.insertBefore(u,a))}(window,document,'script');
    window.twq('config', X_PIXEL_ID);
  }

  // ── Pixel Snapchat ───────────────────────────────────────────────
  var snapchatLoaded = false;
  function initSnapchatPixel() {
    if (adPixelsBlocked || snapchatLoaded || !SNAPCHAT_PIXEL_ID) return;
    snapchatLoaded = true;
    // Le snippet officiel de Snap est recopié ici avec UNE correction : il
    // écrit `r=t.createElement(s)` sans déclarer `r`. Ce fichier tourne en
    // 'use strict', où une affectation à une variable non déclarée lève une
    // ReferenceError — le pixel ne se chargerait jamais, et l'erreur
    // remonterait dans la console sans que rien n'indique la cause. D'où le
    // `var r`. Ne pas « restaurer » le snippet d'origine en le recopiant.
    (function(e, t, n) {
      if (e.snaptr) return;
      var a = e.snaptr = function() {
        a.handleRequest ? a.handleRequest.apply(a, arguments) : a.queue.push(arguments);
      };
      a.queue = [];
      var s = 'script';
      var r = t.createElement(s);
      r.async = !0;
      r.src = n;
      var u = t.getElementsByTagName(s)[0];
      u.parentNode.insertBefore(r, u);
    })(window, document, 'https://sc-static.net/scevent.min.js');
    window.snaptr('init', SNAPCHAT_PIXEL_ID);
    window.snaptr('track', 'PAGE_VIEW');
  }

  /**
   * Une conversion publicitaire, diffusee a toutes les regies chargees.
   *
   * Les pages n appellent plus `fbq` ou `ttq` elles-memes : elles decrivaient
   * la meme vente en trois dialectes, dans trois fichiers, et ajouter une
   * regie obligeait a les rouvrir tous. Ici, une seule.
   *
   * `kind` vaut 'checkout' (depart vers le paiement) ou 'purchase' (encaisse).
   */
  function adConversion(kind, info, txnId) {
    // Dernier rempart : aucun envoi publicitaire si le consentement a été
    // retiré. Indispensable pour X, qui n'expose aucune méthode de révocation,
    // et utile pour toute régie ajoutée plus tard qui n'en aurait pas non plus.
    if (!marketingGranted) return;
    var isPurchase = kind === 'purchase';
    try {
      if (window.fbq) {
        window.fbq('track', isPurchase ? 'Subscribe' : 'InitiateCheckout',
          isPurchase
            ? { currency: 'EUR', value: info.value, predicted_ltv: info.ltv }
            : { currency: 'EUR', value: info.value, content_name: info.label });
      }
    } catch (_) {}
    try {
      if (window.ttq) {
        window.ttq.track(isPurchase ? 'Subscribe' : 'InitiateCheckout',
          { value: info.value, currency: 'EUR', content_id: info.contentId });
      }
    } catch (_) {}
    try {
      var xEvent = isPurchase ? X_EVENTS.purchase : X_EVENTS.checkout;
      if (window.twq && xEvent) {
        // Structure `contents` telle que X la documente. Un objet incomplet
        // est accepte mais prive son optimisation d une partie du signal.
        window.twq('event', xEvent, {
          value: info.value,
          currency: 'EUR',
          conversion_id: txnId || undefined,
          contents: [{
            content_type: 'product',
            content_id: info.contentId,
            content_name: info.label,
            content_price: info.value,
            num_items: 1
          }]
        });
      }
    } catch (_) {}
    try {
      if (window.snaptr) {
        // Snap nomme ses paramètres autrement que les autres régies : `price`
        // et non `value`, `number_items` et non `num_items`. Recopier le
        // vocabulaire de Meta ici ferait remonter une conversion sans montant,
        // acceptée en silence, et l'optimisation à la valeur serait aveugle.
        //
        // PURCHASE plutôt que SUBSCRIBE, alors que Meta et TikTok reçoivent
        // « Subscribe » : les deux existent chez Snap, mais PURCHASE est celui
        // que ses enchères à la valeur savent optimiser partout. Un seul des
        // deux doit partir, sinon la vente est comptée en double.
        window.snaptr('track', isPurchase ? 'PURCHASE' : 'START_CHECKOUT', {
          price: info.value,
          currency: 'EUR',
          item_ids: [info.contentId],
          item_category: info.label,
          number_items: 1,
          transaction_id: txnId || undefined
        });
      }
    } catch (_) {}
    try {
      var label = isPurchase ? GOOGLE_ADS_LABEL_PURCHASE : GOOGLE_ADS_LABEL_CHECKOUT;
      if (GOOGLE_ADS_ID && label) {
        gtag('event', 'conversion', {
          send_to: GOOGLE_ADS_ID + '/' + label,
          value: info.value,
          currency: 'EUR',
          transaction_id: txnId || ''
        });
      }
    } catch (_) {}
  }

  // ── Catalogue des paliers vendus ─────────────────────────────────
  // Source de vérité unique des montants remontés aux régies. Ce sont les
  // prix du paiement WEB (Stripe sur linceya.com) : sur les stores mobiles
  // l'Élite est à 49,99 €, ce tarif-là n'a rien à faire ici.
  // Les trois checkout.html (fr/en/es) lisent cette table via
  // linceyaTrack.plan() — sinon le prix serait recopié dans quatre fichiers
  // et c'est exactement comme ça qu'un 9,99 € en dur avait survécu partout.
  var PLAN_CATALOG = {
    monthly: { value: 9.99,  label: 'Linceya Premium', ltv: 119.88 },
    annual:  { value: 99.99, label: 'Linceya Premium', ltv: 99.99  },
    elite:   { value: 44.99, label: 'Linceya Élite',   ltv: 539.88 }
  };

  // Palier inconnu (lien ancien, paramètre tronqué, visiteur qui bricole
  // l'URL) → on retombe sur le mensuel, le moins cher : mieux vaut
  // sous-estimer une conversion que gonfler le CA remonté aux régies.
  // contentId garde le préfixe historique 'linceya_premium_' pour que le
  // begin_checkout et le purchase d'un même achat portent le même
  // identifiant côté TikTok (sinon le funnel ne se recolle plus).
  function planInfo(plan) {
    // hasOwnProperty et pas PLAN_CATALOG[plan] : la valeur vient de l'URL,
    // et ?plan=toString ferait remonter une méthode héritée d'Object — donc
    // un montant undefined envoyé aux régies.
    var known = Object.prototype.hasOwnProperty.call(PLAN_CATALOG, plan);
    var key = known ? plan : 'monthly';
    var d = PLAN_CATALOG[key];
    return {
      key: key,
      value: d.value,
      label: d.label,
      ltv: d.ltv,
      contentId: 'linceya_premium_' + key
    };
  }

  // 5. Helpers de tracking custom — appelés depuis les boutons clés du site.
  // Forwardent vers GA4 + Meta Pixel + TikTok Pixel quand chargés.
  window.linceyaTrack = {
    // Exposé pour les pages de paiement : elles ont besoin du montant, du
    // libellé et de l'identifiant produit du palier acheté.
    plan: planInfo,
    // Diffusion d'une conversion a toutes les regies. Utilise par les trois
    // checkout.html, qui n ont ainsi plus a connaitre le moindre SDK.
    adConversion: adConversion,
    appDownloadClick: function(store) {
      gtag('event', 'app_download_click', {
        'store': store,           // 'apple' ou 'google'
        'event_category': 'engagement'
      });
      if (window.fbq) window.fbq('trackCustom', 'AppDownloadClick', { store: store });
      if (window.ttq) window.ttq.track('ClickButton', { content_name: 'app_download_' + store });
      // Conditionne a une conversion REELLEMENT creee cote X. La version
      // precedente fabriquait « tw-<pixel>-click », un identifiant qui
      // n existe pas : X l aurait rejete sans rien signaler.
      try {
        if (window.twq && X_EVENTS.appDownload) {
          window.twq('event', X_EVENTS.appDownload, { contents: [{ content_name: 'app_download_' + store }] });
        }
      } catch (_) {}
    },
    checkoutClick: function(plan) {
      // Le ternaire précédent ne connaissait que 'annual' : tout le reste,
      // Élite compris, était valorisé 9,99 € au lieu de 44,99 €. La table
      // évite que l'ajout d'un palier repasse en silence au tarif mensuel.
      // TOUT vient de la table, pas seulement le montant. Concatener
      // l argument brut dans l identifiant produit — comme le faisait ce code
      // — casse precisement ce que le prefixe est cense garantir : pour un
      // palier inconnu, TikTok recevait un begin_checkout
      // « linceya_premium_<n importe quoi> » puis un purchase
      // « linceya_premium_monthly », deux identifiants differents, donc un
      // funnel qui ne se recolle jamais.
      var info = planInfo(plan);
      gtag('event', 'begin_checkout', {
        'plan': info.key,         // 'monthly', 'annual' ou 'elite', normalise
        'currency': 'EUR',
        'value': info.value
      });
      adConversion('checkout', info);
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

    // Le Consent Mode empêche GA4 d'écrire de NOUVEAUX cookies, mais n'efface
    // pas ceux d'un accord précédent. Sans appel explicite, `_ga` survivrait
    // au refus.
    if (!analytics) purgeAnalyticsCookies();
    marketingGranted = marketing;

    if (marketing) {
      // Accord : on charge les pixels, puis on lève une éventuelle
      // suspension posée lors d'un refus précédent dans la même visite.
      initMetaPixel();
      initTikTokPixel();
      initXPixel();
      initSnapchatPixel();
      try { if (window.fbq) window.fbq('consent', 'grant'); } catch (_) {}
      try { if (window.ttq && window.ttq.grantConsent) window.ttq.grantConsent(); } catch (_) {}
      return;
    }

    // RETRAIT. GA4 s'arrête tout seul via le `consent update` ci-dessus, mais
    // un SDK publicitaire déjà chargé, lui, continue : il faut le faire taire.
    // Sans ce bloc, un visiteur qui acceptait puis se ravisait restait suivi
    // jusqu'au rechargement de la page — un retrait qui ne retire rien.
    //
    // Les deux régies qui exposent une API de consentement l'utilisent. Ni X
    // ni Snapchat n'en publient : c'est `marketingGranted` qui les musèle, en
    // amont de chaque envoi (cf. `adConversion`). Leur pageview initial, lui,
    // est déjà parti — d'où l'importance de ne charger ces SDK qu'APRÈS
    // l'accord, jamais avant.
    try { if (window.fbq) window.fbq('consent', 'revoke'); } catch (_) {}
    try { if (window.ttq && window.ttq.revokeConsent) window.ttq.revokeConsent(); } catch (_) {}
    purgeMarketingCookies();
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
  //
  // Ce cas n'était rattrapé que par le poll ci-dessous : les pixels pub ne
  // partaient donc qu'au bout de ~100 ms. Toute page qui trackait dès son
  // DOMContentLoaded — la page de retour Stripe, celle qui compte — trouvait
  // window.ttq encore undefined et perdait sa conversion. On synchronise
  // maintenant dès que l'API de consentement est là, sans attendre un tick.
  //
  // On s'inscrit en plus dans la file d'attente 'marketing' de cookies.js.
  // Deux raisons : elle est vidée AVANT le dispatch de 'linceyaConsentChange',
  // et elle est servie dans l'ordre d'inscription. analytics.js étant chargé
  // avant le code des pages, on y est premier — les pixels existent donc déjà
  // quand une page track sa conversion depuis son propre onConsent().
  function bindConsent() {
    if (!window.linceyaConsent) return false;
    syncConsent();
    try {
      window.linceyaConsent.onConsent('marketing', function() {
        initMetaPixel();
        initTikTokPixel();
        initXPixel();
        initSnapchatPixel();
      });
    } catch (_) {}
    return true;
  }

  // cookies.js peut malgré tout arriver après nous selon les pages et le
  // cache : on garde le sondage en filet de sécurité (2 s max).
  if (!bindConsent()) {
    var attempts = 0;
    var poll = setInterval(function() {
      if (bindConsent() || ++attempts > 20) clearInterval(poll);
    }, 100);
  }
})();
