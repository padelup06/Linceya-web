// Bandeau "Ouvrir/Installer l'app" pour Android.
//
// Équivalent home-made du Smart App Banner Apple (qui n'existe pas sur
// Chrome Android — Google l'a déprécié en 2019). Détecte Android, injecte
// un bandeau fixe en haut de page avec un lien Play Store, et persiste
// le dismiss dans localStorage pour ne pas re-afficher à chaque visite.
//
// On skip iOS car Safari affiche déjà le Smart App Banner natif Apple
// via le meta tag `apple-itunes-app`.
//
// Utilisation : <script src="/app-banner.js" defer></script> dans le head.

(function () {
  var ua = navigator.userAgent || '';
  // Skip iOS — Apple Smart App Banner s'affiche déjà via le meta tag.
  if (/iPhone|iPad|iPod/i.test(ua)) return;
  // Skip non-Android (desktop, autres mobiles).
  if (!/Android/i.test(ua)) return;
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

  var PLAY_STORE_URL =
    'https://play.google.com/store/apps/details?id=com.padelup.padelup';

  // Construit l'élément DOM directement (pas innerHTML pour éviter
  // d'éventuels conflits CSP).
  var style = document.createElement('style');
  style.textContent = [
    '#lnc-android-banner {',
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
    '#lnc-android-banner .lnc-row {',
    '  display: flex;',
    '  align-items: center;',
    '  gap: 12px;',
    '  padding: 10px 12px;',
    '  max-width: 680px;',
    '  margin: 0 auto;',
    '}',
    '#lnc-android-banner .lnc-close {',
    '  background: transparent;',
    '  border: none;',
    '  padding: 6px 8px;',
    '  font-size: 22px;',
    '  line-height: 1;',
    '  color: rgba(14, 27, 53, 0.5);',
    '  cursor: pointer;',
    '  flex-shrink: 0;',
    '}',
    '#lnc-android-banner .lnc-icon {',
    '  width: 44px;',
    '  height: 44px;',
    '  border-radius: 10px;',
    '  flex-shrink: 0;',
    '  background: #F2EDE2;',
    '  object-fit: cover;',
    '}',
    '#lnc-android-banner .lnc-text {',
    '  flex: 1;',
    '  min-width: 0;',
    '  line-height: 1.3;',
    '}',
    '#lnc-android-banner .lnc-title {',
    '  font-size: 13px;',
    '  font-weight: 600;',
    '  color: #0E1B35;',
    '  white-space: nowrap;',
    '  overflow: hidden;',
    '  text-overflow: ellipsis;',
    '}',
    '#lnc-android-banner .lnc-subtitle {',
    '  font-size: 11px;',
    '  color: rgba(14, 27, 53, 0.55);',
    '  margin-top: 2px;',
    '}',
    '#lnc-android-banner .lnc-cta {',
    '  background: #1E47F0;',
    '  color: #FFFFFF;',
    '  padding: 7px 14px;',
    '  border-radius: 8px;',
    '  font-size: 12px;',
    '  font-weight: 700;',
    '  text-decoration: none;',
    '  text-transform: uppercase;',
    '  letter-spacing: 0.04em;',
    '  flex-shrink: 0;',
    '}',
  ].join('\n');
  document.head.appendChild(style);

  function build() {
    var banner = document.createElement('div');
    banner.id = 'lnc-android-banner';

    var row = document.createElement('div');
    row.className = 'lnc-row';

    var close = document.createElement('button');
    close.className = 'lnc-close';
    close.setAttribute('aria-label', 'Fermer');
    close.innerHTML = '&times;';
    close.onclick = function () {
      banner.remove();
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
    subtitle.textContent = "Ouvrir dans l'app Linceya";
    text.appendChild(title);
    text.appendChild(subtitle);

    var cta = document.createElement('a');
    cta.className = 'lnc-cta';
    cta.href = PLAY_STORE_URL;
    cta.textContent = 'Installer';
    // Le Play Store affichera "OUVRIR" si l'app est déjà installée — pas
    // besoin de tenter un deep link `intent://` qui complique la vie
    // (et qui fail sur les browsers in-app type Facebook/Instagram).

    row.appendChild(close);
    row.appendChild(icon);
    row.appendChild(text);
    row.appendChild(cta);
    banner.appendChild(row);

    document.body.insertBefore(banner, document.body.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
