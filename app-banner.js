// Bandeau "Ouvrir/Installer l'app" — Android, et iOS là où Apple ne le fait
// pas lui-même.
//
// Équivalent home-made du Smart App Banner Apple (qui n'existe pas sur
// Chrome Android — Google l'a déprécié en 2019). Injecte un bandeau fixe en
// haut de page avec un lien vers le store, et persiste le dismiss dans
// localStorage pour ne pas re-afficher à chaque visite.
//
// Sur iOS, la bannière native d'Apple (meta `apple-itunes-app`) ne s'affiche
// QUE dans Safari lui-même. Jamais dans Chrome/Firefox iOS, jamais dans un
// navigateur intégré à une app (Snapchat, Instagram, TikTok…) — c'est-à-dire
// jamais pour un visiteur venu d'un réseau social, soit l'essentiel du trafic
// mobile. On prend donc le relais dans ces contextes-là, et uniquement
// là : dans Safari on laisse la native, sinon on empilerait deux bannières.
//
// Utilisation : <script src="/app-banner.js" defer></script> dans le head.

(function () {
  var ua = navigator.userAgent || '';

  /// Sur quel store envoyer ce visiteur, ou null s'il ne faut rien afficher.
  ///
  /// Isolée et sans effet de bord pour être vérifiable en collant une chaîne
  /// User-Agent dans la console.
  function plateformeCible(ua) {
    if (/Android/i.test(ua)) return 'android';
    if (!/iPhone|iPad|iPod/i.test(ua)) return null;

    // App installée sur l'écran d'accueil : elle EST déjà là.
    if (window.navigator.standalone === true) return null;

    // Navigateurs tiers : moteur WebKit imposé par Apple, mais pas la
    // bannière native.
    if (/CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|DuckDuckGo/i.test(ua)) return 'ios';

    // Navigateurs intégrés aux apps (WKWebView), reconnus à leur marqueur.
    if (/FBAN|FBAV|FB_IAB|Instagram|Snapchat|Line\/|Twitter|LinkedInApp|Pinterest|TikTok|musical_ly|MicroMessenger|GSA\//i.test(ua)) {
      return 'ios';
    }

    // WKWebView générique : un vrai Safari porte TOUJOURS les jetons
    // `Version/` et `Safari/`. Leur absence trahit une webview embarquée.
    if (!/Safari\//.test(ua) || !/Version\//.test(ua)) return 'ios';

    // Safari : sa bannière native fait le travail, on ne double pas.
    //
    // Limite connue et assumée : SFSafariViewController (la vue Safari que
    // certaines apps ouvrent) envoie un User-Agent Safari complet alors
    // qu'Apple n'y affiche PAS la bannière. Aucun moyen fiable de l'en
    // distinguer côté client — ces visiteurs-là restent sans bandeau.
    return null;
  }

  var plateforme = plateformeCible(ua);
  if (!plateforme) return;

  // Skip si dismiss < 30 jours.
  try {
    var dismissedAt = localStorage.getItem('lnc_app_banner_dismissed_at');
    if (dismissedAt) {
      var THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
      if (Date.now() - parseInt(dismissedAt, 10) < THIRTY_DAYS_MS) return;
    }
  } catch (_) {
    // localStorage indispo (mode privé) → on affiche quand même.
  }

  var STORE_URL = plateforme === 'ios'
    ? 'https://apps.apple.com/app/id6760952174'
    : 'https://play.google.com/store/apps/details?id=com.padelup.padelup';

  // Le site est trilingue et le bandeau se chargeait sur les 33 pages
  // anglaises et les 33 espagnoles — en français.
  //
  // Le TITRE n'est volontairement pas traduit : c'est le nom de la fiche
  // store, identique sur les trois storefronts (vérifié via l'API iTunes).
  // Un bandeau qui annonce autre chose que ce que le visiteur va trouver sur
  // le store désoriente plus qu'il n'aide.
  var TEXTES = {
    fr: {sous: "Ouvrir dans l'app Linceya", cta: 'Installer', fermer: 'Fermer'},
    en: {sous: 'Open in the Linceya app', cta: 'Install', fermer: 'Close'},
    es: {sous: 'Abrir en la app Linceya', cta: 'Instalar', fermer: 'Cerrar'},
  };

  // Toutes les pages du site portent un <html lang>. Repli sur le français,
  // langue d'origine du site, si l'attribut manque ou est inconnu.
  var codeLangue = (document.documentElement.getAttribute('lang') || '')
    .slice(0, 2)
    .toLowerCase();
  var t = TEXTES[codeLangue] || TEXTES.fr;

  // Construit l'élément DOM directement (pas innerHTML pour éviter
  // d'éventuels conflits CSP).
  var style = document.createElement('style');
  style.textContent = [
    '#lnc-app-banner {',
    '  position: fixed;',
    '  top: 0; left: 0; right: 0;',
    '  z-index: 99999;',
    '  background: #FFFFFF;',
    '  border-bottom: 1px solid rgba(14, 27, 53, 0.12);',
    '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
    '  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);',
    '  animation: lnc-slide-down 280ms ease-out;',
    '}',
    '@keyframes lnc-slide-down {',
    '  from { transform: translateY(-100%); }',
    '  to { transform: translateY(0); }',
    '}',
    '#lnc-app-banner .lnc-row {',
    '  display: flex;',
    '  align-items: center;',
    '  gap: 12px;',
    '  padding: 10px 12px;',
    '  max-width: 680px;',
    '  margin: 0 auto;',
    '}',
    '#lnc-app-banner .lnc-close {',
    '  background: transparent;',
    '  border: none;',
    '  padding: 6px 8px;',
    '  font-size: 22px;',
    '  line-height: 1;',
    '  color: rgba(14, 27, 53, 0.5);',
    '  cursor: pointer;',
    '  flex-shrink: 0;',
    '}',
    '#lnc-app-banner .lnc-icon {',
    '  width: 44px;',
    '  height: 44px;',
    '  border-radius: 10px;',
    '  flex-shrink: 0;',
    '  background: #F2EDE2;',
    '  object-fit: cover;',
    '}',
    '#lnc-app-banner .lnc-text {',
    '  flex: 1;',
    '  min-width: 0;',
    '  line-height: 1.3;',
    '}',
    '#lnc-app-banner .lnc-title {',
    '  font-size: 13px;',
    '  font-weight: 600;',
    '  color: #0E1B35;',
    '  white-space: nowrap;',
    '  overflow: hidden;',
    '  text-overflow: ellipsis;',
    '}',
    '#lnc-app-banner .lnc-subtitle {',
    '  font-size: 11px;',
    '  color: rgba(14, 27, 53, 0.55);',
    '  margin-top: 2px;',
    '}',
    // Dégradé or vertical + texte --on-gold : le traitement canonique des
    // boutons store du site (`.btn-store` dans index.html). Le bouton était
    // resté en #1E47F0, le bleu d'avant la refonte Noir & Or — seul élément
    // bleu de la page.
    //
    // Une seule différence assumée avec `.btn-store` : le dégradé s'arrête à
    // #B58A3C au lieu de descendre jusqu'à #8E6825. Sur ce libellé de 12px,
    // #1E1503 sur le brun le plus sombre tombe à 3,6:1 — sous le seuil de
    // 4,5:1 exigé pour du texte courant. En s'arrêtant plus haut, le pire
    // point du bouton reste à 5,7:1.
    '#lnc-app-banner .lnc-cta {',
    '  background: linear-gradient(180deg, #F8E9B6 0%, #DDBC6E 45%, #B58A3C 100%);',
    '  color: #1E1503;',
    '  padding: 7px 14px;',
    '  border-radius: 8px;',
    '  font-size: 12px;',
    '  font-weight: 700;',
    '  text-decoration: none;',
    '  text-transform: uppercase;',
    '  letter-spacing: 0.04em;',
    '  flex-shrink: 0;',
    '  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8),',
    '              inset 0 -2px 4px rgba(90, 60, 10, 0.35);',
    '}',
  ].join('\n');
  document.head.appendChild(style);

  function build() {
    var banner = document.createElement('div');
    banner.id = 'lnc-app-banner';

    var row = document.createElement('div');
    row.className = 'lnc-row';

    var close = document.createElement('button');
    close.className = 'lnc-close';
    close.setAttribute('aria-label', t.fermer);
    close.innerHTML = '&times;';
    close.onclick = function () {
      banner.remove();
      // Reset le padding du body (cf. syncBodyPadding plus bas).
      document.body.style.paddingTop = '';
      window.removeEventListener('resize', syncBodyPadding);
      try {
        localStorage.setItem(
          'lnc_app_banner_dismissed_at',
          String(Date.now())
        );
      } catch (_) {}
    };

    var icon = document.createElement('img');
    icon.className = 'lnc-icon';
    icon.src = '/favicon-96x96.png';
    icon.alt = 'Linceya';

    var text = document.createElement('div');
    text.className = 'lnc-text';
    var title = document.createElement('div');
    title.className = 'lnc-title';
    title.textContent = 'Linceya — Coach IA Padel';
    var subtitle = document.createElement('div');
    subtitle.className = 'lnc-subtitle';
    subtitle.textContent = t.sous;
    text.appendChild(title);
    text.appendChild(subtitle);

    var cta = document.createElement('a');
    cta.className = 'lnc-cta';
    cta.href = STORE_URL;
    cta.textContent = t.cta;
    // Les deux stores affichent "OUVRIR" d'eux-mêmes si l'app est déjà
    // installée — pas besoin de tenter un deep link (`intent://` côté
    // Android, schéma custom côté iOS) qui complique la vie et échoue
    // justement dans les navigateurs intégrés qu'on vise ici.

    row.appendChild(close);
    row.appendChild(icon);
    row.appendChild(text);
    row.appendChild(cta);
    banner.appendChild(row);

    document.body.insertBefore(banner, document.body.firstChild);

    // Push le contenu du body vers le bas pour qu'il ne soit pas caché
    // par le bandeau fixed (qui flotte au-dessus avec un z-index élevé).
    // On mesure la hauteur réelle APRÈS insertion pour tenir compte des
    // tailles dynamiques (responsive, font scaling, etc).
    syncBodyPadding();
    // Resync à chaque resize au cas où la hauteur du bandeau change
    // (rotation portrait/paysage, font scaling système).
    window.addEventListener('resize', syncBodyPadding);
  }

  // Lit le bandeau via DOM query (au lieu d'une closure) pour rester
  // simple et résilient au lifecycle (close → re-build hypothétique).
  //
  // 2 ajustements nécessaires pour que le bandeau ne cache rien :
  //   1. padding-top sur body → pousse le contenu normal (in-flow) vers
  //      le bas.
  //   2. top: <height> sur les éléments fixed/sticky en haut (nav, header)
  //      → sinon ils restent à top:0 et notre bandeau (z-index 99999) les
  //      cache. Le site Linceya a son `<nav>` en `position: fixed; top: 0`.
  function syncBodyPadding() {
    var b = document.getElementById('lnc-app-banner');
    var h = (b && b.isConnected) ? b.offsetHeight : 0;
    document.body.style.paddingTop = h ? h + 'px' : '';
    // Push les nav/header fixés au-dessous du bandeau.
    document.querySelectorAll('nav, header').forEach(function (el) {
      var pos = getComputedStyle(el).position;
      if (pos === 'fixed' || pos === 'sticky') {
        el.style.top = h ? h + 'px' : '';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
