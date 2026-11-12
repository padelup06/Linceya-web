# linceya-web

Site marketing public **linceya.com**.

## Stack

- HTML/CSS/JS statique (aucune build step)
- Hébergé sur Cloudflare Pages (projet `linceya-web`)
- Domaine `linceya.com` — DNS chez Cloudflare

## Pages

| Fichier | Rôle |
|---|---|
| `index.html` | Landing |
| `pricing.html` | Tarifs |
| `premium.html` | Ancienne adresse : redirige vers le paiement Elite |
| `checkout.html` | Tunnel Stripe |
| `contact.html` | Contact |
| `delete-account.html` | Conformité Apple/Play store — suppression de compte |
| `privacy-policy.html` | Politique de confidentialité (RGPD) |
| `app.html` | Lien `linceya.com/app` (e-mails, QR codes, réseaux) : iPhone/iPad → App Store, Android → Google Play, ordinateur → page avec les deux boutons. Ne pas renommer : l'adresse est écrite dans des e-mails déjà envoyés |

## Déploiement

Push sur `main` → Cloudflare Pages publie automatiquement.

## Repos liés

- [linceya-app](https://github.com/linceya06/linceya-app) — app Flutter
- [linceya-dashboard](https://github.com/linceya06/linceya-dashboard) — dashboard clubs
- [linceya-server](https://github.com/linceya06/linceya-server) — backend FastAPI
