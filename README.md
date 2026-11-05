# Marketplace C2C Cameroun

Marketplace web de revente entre particuliers (vêtements, chaussures, wax, électronique...),
pensée pour le Cameroun puis l'Afrique francophone. Paiement Mobile Money séquestré, bilingue
FR/EN, mobile d'abord.

Pour l'architecture détaillée, les conventions de code et l'état d'avancement du projet, voir
[`CLAUDE.md`](./CLAUDE.md).

## Démarrage rapide (développement local)

Prérequis : Node.js 20+, Docker Desktop, pnpm (via corepack).

```bash
corepack enable
corepack prepare pnpm@9.12.0 --activate

cp .env.example .env
pnpm install

pnpm docker:up          # Postgres, Redis, MinIO
pnpm db:migrate
pnpm db:seed

pnpm dev                # API sur :4000, Web sur :3000
```

Comptes de démonstration (créés par `pnpm db:seed`) : voir [`CLAUDE.md`](./CLAUDE.md#commandes).

## Déploiement en production (VPS)

Cette section décrit un déploiement sur un VPS simple (ex: 2 Go RAM minimum) avec Docker
Compose, Nginx en reverse proxy, et Cloudflare devant pour le TLS et la protection DDoS de base.

### 1. Prérequis sur le VPS

- Un VPS Linux (Ubuntu 22.04/24.04 recommandé) avec Docker et Docker Compose installés.
- Un nom de domaine, avec deux sous-domaines pointant vers l'IP du VPS via Cloudflare (proxy
  activé, nuage orange) :
  - `www.votredomaine.com` (ou `votredomaine.com`) → le site web.
  - `api.votredomaine.com` → l'API.
- Un compte Cloudflare R2 (stockage des photos) et ses identifiants S3-compatibles.
- Si vous souhaitez activer le suivi d'erreurs : un projet Sentry et son DSN.

### 2. Préparer le serveur

```bash
ssh votre-utilisateur@votre-vps

sudo apt update && sudo apt install -y docker.io docker-compose-plugin git
sudo usermod -aG docker $USER   # puis se reconnecter

git clone <url-du-repo> marketplace
cd marketplace
cp .env.example .env
```

### 3. Configurer `.env` pour la production

Éditer `.env` et renseigner au minimum :

- `POSTGRES_PASSWORD` : un mot de passe fort et unique (ne jamais garder la valeur par défaut).
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `PAYMENT_WEBHOOK_SECRET` : générer des secrets
  aléatoires forts, par exemple avec `openssl rand -hex 32`.
- `WEB_URL=https://www.votredomaine.com`, `API_URL=https://api.votredomaine.com`.
- `NEXT_PUBLIC_API_URL=https://api.votredomaine.com`, `NEXT_PUBLIC_WEB_URL=https://www.votredomaine.com`.
- `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` : valeurs de votre
  bucket Cloudflare R2. Mettre `S3_FORCE_PATH_STYLE=false` et `S3_PUBLIC_URL` sur le domaine
  public du bucket (ou un domaine personnalisé R2).
- `SMS_PROVIDER` : reste `console` jusqu'à l'intégration d'un vrai fournisseur SMS (les codes
  OTP seront alors uniquement visibles dans les logs du conteneur `api` — brancher un vrai
  fournisseur avant un vrai lancement public).
- `PAYMENT_PROVIDER` : reste `mock` jusqu'au choix et à l'intégration d'un agrégateur Mobile
  Money réel (MTN MoMo / Orange Money).
- `SENTRY_DSN` : laisser vide pour désactiver, ou renseigner le DSN d'un projet Sentry pour
  activer la capture d'erreurs côté API.
- Ajouter en bas du fichier :
  ```
  API_DOMAIN=api.votredomaine.com
  WEB_DOMAIN=www.votredomaine.com
  ```

### 4. Lancer les services

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml exec api pnpm prisma:deploy
docker compose -f docker-compose.prod.yml exec api pnpm prisma:seed   # optionnel: catégories/villes de base
```

`docker-compose.prod.yml` démarre Postgres, Redis, l'API, le site web, et un conteneur Nginx qui
route par sous-domaine (`API_DOMAIN` → API, `WEB_DOMAIN` → web) sur le port 80. Aucun port autre
que 80 n'est exposé publiquement.

### 5. Configurer Cloudflare

- Mode SSL/TLS : "Flexible" au minimum (Cloudflare en HTTPS, origine en HTTP) pour démarrer
  rapidement. Pour plus de sécurité, passer à "Full" en ajoutant un certificat sur le VPS
  (Let's Encrypt via un conteneur `certbot` additionnel, ou un certificat d'origine Cloudflare
  importé dans Nginx) — non inclus dans cette configuration minimale.
- Vérifier que les deux enregistrements DNS (`www`/racine et `api`) sont bien en proxy
  Cloudflare (nuage orange), pas seulement en DNS (nuage gris), pour profiter de la protection
  et de la mise en cache.
- Activer "Always Use HTTPS" et "Automatic HTTPS Rewrites" dans Cloudflare.

### 6. Vérifier le déploiement

```bash
curl https://api.votredomaine.com/health
# -> {"status":"ok",...}
```

Ouvrir `https://www.votredomaine.com` dans un navigateur et tester le parcours d'inscription
(le code OTP apparaît dans `docker compose -f docker-compose.prod.yml logs api` tant qu'aucun
fournisseur SMS réel n'est branché).

### 7. Sauvegardes

La base de données est le seul état critique non reconstructible (les photos sont sur R2, déjà
redondant). Mettre en place une sauvegarde régulière, par exemple :

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > backup-$(date +%F).sql.gz
```

À planifier via une tâche cron sur le VPS, avec copie vers un stockage distant (ex: le même
bucket R2, dans un dossier séparé).

### 8. Mettre à jour après un nouveau déploiement

```bash
git pull
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml exec api pnpm prisma:deploy
```

## Limites connues à lever avant un vrai lancement public

- `SmsProvider` et `PaymentProvider` sont en mode mock/console — un vrai fournisseur SMS et un
  vrai agrégateur Mobile Money (MTN MoMo / Orange Money) doivent être branchés derrière les
  interfaces déjà en place (voir [`CLAUDE.md`](./CLAUDE.md)).
- Le TLS Cloudflare "Flexible" décrit ci-dessus n'est pas le plus sécurisé ; passer à "Full
  (strict)" avec un certificat sur l'origine avant un lancement public.
- Le score Lighthouse mobile n'a pas été mesuré avec un vrai navigateur dans cet environnement
  de développement (voir [`CLAUDE.md`](./CLAUDE.md) pour le détail des optimisations déjà en
  place et de ce qui reste à vérifier manuellement).
