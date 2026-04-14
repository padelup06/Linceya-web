# padelup-web

Site marketing public **apppadelup.com**.

## Stack

- HTML/CSS/JS statique (aucune build step)
- Hébergé sur GitHub Pages (cf. `CNAME`)
- Domaine `apppadelup.com` — DNS chez Cloudflare

## Pages

| Fichier | Rôle |
|---|---|
| `index.html` | Landing |
| `pricing.html` | Tarifs |
| `premium.html` | Détail offre Premium |
| `checkout.html` | Tunnel Stripe |
| `contact.html` | Contact |
| `delete-account.html` | Conformité Apple/Play store — suppression de compte |
| `privacy-policy.html` | Politique de confidentialité (RGPD) |

Les `ps_*.png` sont les screenshots produits affichés sur la landing.

## Déploiement

Push sur `main` → GitHub Pages publie automatiquement.

## Repos liés

- [padelup-app](https://github.com/padelup06/padelup-app) — app Flutter
- [padelup-dashboard](https://github.com/padelup06/padelup-dashboard) — dashboard clubs
- [padelup-server](https://github.com/padelup06/padelup-server) — backend FastAPI
