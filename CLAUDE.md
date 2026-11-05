# Marketplace C2C Cameroun — CLAUDE.md

Marketplace web de revente entre particuliers (vêtements, chaussures, wax, électronique...),
pensée pour le Cameroun. Mobile d'abord, paiement Mobile Money en séquestre, bilingue FR/EN.

## Architecture

Monorepo pnpm workspaces + Turborepo.

```
apps/web     Next.js 14 (App Router, TS) + Tailwind. Affichage, SSR/SEO, PWA, i18n (next-intl).
apps/api     NestJS (TS). Monolithe modulaire, toute la logique métier.
packages/shared  Types, enums, DTO et constantes partagés entre web et api.
```

- Base de données : PostgreSQL + Prisma (`apps/api/prisma/schema.prisma`).
- Cache / files de tâches : Redis + BullMQ (traitement photos, notifications, tâches planifiées).
- Stockage fichiers : S3-compatible — MinIO en local, Cloudflare R2 en production.
- Recherche : PostgreSQL full-text search, isolée derrière `SearchService` (api) pour pouvoir
  basculer vers Meilisearch plus tard sans toucher au reste du code.
- Temps réel : Socket.IO (chat) — à partir de la Phase 3.
- Argent : tous les montants sont des entiers en XAF (FCFA), jamais de décimales. Toujours
  recalculés côté serveur.

## Conventions

- TypeScript strict partout. Pas de `any` interdit explicitement mais à éviter.
- Enums, DTO-shapes et constantes métier (statuts, catégories, villes, regex téléphone) vivent
  dans `packages/shared` et sont importés par les deux apps — ne jamais les dupliquer.
- API : validation des entrées avec `class-validator` + `ValidationPipe` global
  (`whitelist`, `forbidNonWhitelisted`, `transform`). Web : validation avec `zod` côté formulaires
  critiques.
- Auth : connexion par téléphone + OTP (SMS). JWT access (courte durée) + refresh token opaque
  (haute entropie, haché en SHA-256, stocké en base, rotation à chaque refresh).
  Garde globale `JwtAuthGuard` (toutes les routes protégées par défaut) — utiliser `@Public()`
  pour les routes ouvertes (ex: `/health`, `/auth/otp/*`). `@Roles(Role.ADMIN)` + `RolesGuard`
  pour les routes admin.
- Providers externes (SMS, paiement, notifications) : toujours derrière une interface
  (`SmsProvider`, `PaymentProvider`, `NotificationChannel`...) avec une implémentation
  "console"/mock pour le développement. Ne jamais coder en dur un fournisseur précis dans la
  logique métier.
- Toute transition de statut de commande passe par la machine à états centralisée
  (`packages/shared/src/order-state-machine.ts`) et est journalisée (`OrderStatusHistory`).
- Webhooks de paiement : toujours idempotents (table `WebhookEvent`), signature vérifiée, montants
  recalculés côté serveur (jamais confiance dans le payload client/webhook pour le montant final).
- Scripts npm/pnpm : toujours cross-platform (pas de syntaxe bash-only), car développement sous
  Windows 10 + Docker Desktop.
- Commentaires : uniquement quand le "pourquoi" n'est pas évident (contrainte cachée, workaround).

## Commandes

Depuis la racine du repo :

```bash
corepack enable && corepack prepare pnpm@9.12.0 --activate   # une seule fois

cp .env.example .env                 # puis ajuster si besoin
pnpm install

pnpm docker:up                       # postgres, redis, minio (+ api/web si utilisés via docker)
pnpm db:migrate                      # applique les migrations Prisma (apps/api)
pnpm db:seed                         # catégories, villes, utilisateurs de démo

pnpm dev                             # lance web (3000) + api (4000) en parallèle via Turborepo
pnpm build                           # build toutes les apps
pnpm lint                            # lint toutes les apps
pnpm typecheck                       # typecheck toutes les apps
pnpm test                            # tests unitaires toutes les apps
pnpm test:e2e                        # tests e2e (api) — nécessite docker:up

pnpm docker:down                     # arrête les services
```

Comptes de démonstration (seed) :
- Admin : `+237600000001`
- Vendeur : `+237600000002`
- Acheteur : `+237600000003`
En développement, le code OTP est affiché dans les logs de l'API (`SmsProvider` console).

## État du projet / phases

1. **Socle** ✅ — monorepo, Docker, Prisma, auth OTP + JWT, squelette web i18n/PWA.
2. **Annonces, photos, recherche, favoris** ✅ — CRUD annonces avec machine à états simple
   (DRAFT→PUBLISHED/HIDDEN/SOLD), upload photos (S3/MinIO + BullMQ + sharp: 3 tailles WebP,
   EXIF supprimé), recherche plein texte Postgres (`SearchService`, curseur + tri + filtres),
   favoris, catégories/villes. Pages web: accueil (annonces récentes), recherche/filtres,
   détail d'annonce (SSR + OG tags pour SEO/WhatsApp), publication en 3 étapes avec aperçu
   photos, favoris. Vérifié par tests unitaires + e2e + un parcours complet en conditions
   réelles (login → créer → uploader → publier → rechercher → favori → retirer).
3. **Messagerie temps réel et offres** ✅ — conversations liées à une annonce (REST pour
   l'historique/liste, Socket.IO namespace `/chat` pour l'envoi temps réel), authentification
   du socket par JWT à la connexion, rooms par conversation (`conversation:<id>`), offres de
   prix (seul l'acheteur propose, seul le vendeur répond, une offre ne peut être traitée deux
   fois), compteur de messages non lus. Limite connue: un participant ne reçoit les nouveaux
   messages en temps réel que s'il a ouvert cette conversation (room jointe) — une notification
   cross-conversation complète arrivera avec le système de notifications (Phase 5). Pages web:
   liste des conversations, chat temps réel avec bulles de message/offre et boutons
   accepter/refuser. Vérifié par tests unitaires + un parcours complet avec deux clients
   Socket.IO réels (texte, offre, acceptation, rejets d'autorisation, rejet de connexion sans
   JWT valide).
4. **Commandes, séquestre, paiements (mock), livraison** ✅ — machine à états centralisée
   (`packages/shared/src/order-state-machine.ts`, réutilisée telle quelle) :
   CREATED → PAID_HELD → SHIPPED → DELIVERED → RELEASED, avec CANCELLED (avant paiement) et
   DISPUTED → REFUNDED/RELEASED (résolution admin). Chaque transition passe par la méthode
   privée `OrdersService.transition()`, journalisée dans `OrderStatusHistory`, avec effets de
   bord par statut (ledger, mise à jour de l'annonce, versement/remboursement mock).
   `PaymentProvider` (interface) + `MockPaymentProvider` : webhook idempotent (`WebhookEvent`,
   clé `provider+eventId`), signature HMAC-SHA256 vérifiée (`X-Signature`, corps brut capturé
   via `rawBody: true`), montant toujours recalculé/vérifié côté serveur (jamais confiance dans
   le payload). Registre comptable (`LedgerEntry`: CAPTURE, HOLD, COMMISSION, PAYOUT, REFUND).
   Commission et délai d'auto-libération configurables en base (`PlatformSettingsService` /
   `AppSetting`, repli sur l'env). Tâche planifiée horaire (`OrdersSchedulerService`,
   `@nestjs/schedule`) confirme automatiquement la réception et libère les fonds des commandes
   expédiées dont le délai est dépassé. Livraison: mode choisi à la commande, frais forfaitaires
   (`DELIVERY_FEES_XAF`), numéro de suivi obligatoire sauf remise en main propre. Pages web:
   tunnel de paiement (récapitulatif + confirmation), mes achats/mes ventes, détail de commande
   avec actions contextuelles par rôle (expédier, confirmer réception, annuler, litige) et
   historique des transitions. Vérifié par 19 tests unitaires dédiés (état machine + registre
   comptable, cas nominal et transitions invalides, idempotence/sécurité webhook, litiges) et un
   parcours complet en conditions réelles (paiement, expédition, livraison, versement calculé,
   annulation, litige + remboursement admin).
5. **Avis, litiges, notifications** ✅ — Avis: un par commande et par partie, uniquement après
   `RELEASED`, note de l'autre partie calculée côté `UsersController` (`GET /users/:id/profile`,
   moyenne + liste). Litiges: `DisputesService` enrichit la machine à états de la Phase 4
   (`OrdersService.markDisputed`/`resolveDispute`, réutilisés tels quels) avec l'entité `Dispute`
   complète — motif + description à l'ouverture, photos (upload S3 direct, pas de redimension-
   nement BullMQ nécessaire pour ce cas d'usage), fil de messages (`DisputeMessage`, passage
   automatique à `UNDER_REVIEW` dès qu'un admin répond), résolution admin uniquement
   (`RELEASE`/`REFUND`, `@Roles(Role.ADMIN)`). Notifications: `NotificationChannel` IN_APP
   (toujours, persistée en base) + EMAIL (`ConsoleEmailChannel`, dev; envoi asynchrone via
   BullMQ, no-op silencieux si l'utilisateur n'a pas d'email) ; SMS/WhatsApp restent des valeurs
   d'enum prêtes à recevoir un adaptateur mais non implémentées (pas de fournisseur choisi).
   Déclencheurs effectivement branchés: nouveau message, nouvelle offre, offre acceptée/refusée,
   commande payée/expédiée/libérée/annulée, litige ouvert (vendeur + tous les admins) et résolu,
   avis reçu. Non branchés par choix (documentés, pas oubliés): `ORDER_CREATED` et
   `ORDER_DELIVERED` (redondants avec `ORDER_PAID`/`ORDER_RELEASED` dans ce flux),
   `ORDER_AUTO_RELEASE_SOON` (demanderait une requête planifiée séparée), `SELLER_VERIFICATION_
   RESULT`/`LISTING_MODERATED` (pas encore de point de déclenchement — arrivent en Phase 6 avec
   le back-office KYC/modération). Pages web: profil public vendeur (annonces + avis + note
   moyenne), formulaire d'avis sur la commande, détail de litige (fil de discussion + photo +
   résolution admin), notifications avec marquage lu. Vérifié par 15 nouveaux tests unitaires
   (67 au total sur l'API) et un parcours complet en conditions réelles (avis, litige avec
   photo + réponse admin + remboursement, emails déclenchés une fois l'adresse renseignée).
6. **Back-office admin** ✅ — Tableau de bord (`GET /admin/stats`: utilisateurs, annonces,
   annonces publiées, commandes, volume XAF transigé, litiges ouverts, vérifications en
   attente, signalements ouverts). Modération d'annonces: un admin peut masquer n'importe
   quelle annonce (`AdminService`/`ListingsService.moderateHide`, bypass de la propriété,
   notifie le vendeur). KYC: `SellerVerificationService` — soumission CNI + selfie (upload S3
   direct), un dossier actif à la fois (resoumission possible après refus), approbation/refus
   admin avec notification. Signalements: `ReportsService` — tout utilisateur signale une
   annonce, l'admin rejette ou "agit" (masque l'annonce via le même `moderateHide`, donc même
   notification). Gestion des litiges: réutilise `GET /admin/disputes` et la résolution de la
   Phase 5. Pages web: `/admin` (dashboard), `/admin/listings`, `/admin/kyc`, `/admin/disputes`,
   `/admin/reports` (toutes protégées côté client par `AdminGuard`, qui vérifie le rôle via
   `/auth/me` — l'application stricte du rôle reste côté API via `@Roles(Role.ADMIN)`), et
   `/verification` côté vendeur pour soumettre son KYC. Vérifié par 9 nouveaux tests unitaires
   (76 au total sur l'API) et un parcours complet en conditions réelles (KYC soumis → approuvé,
   signalement → annonce masquée → notification → compteurs du dashboard mis à jour).
7. **Durcissement** ✅ — Sécurité: rate limiting déjà en place depuis la Phase 1 pour OTP/connexion
   (`@Throttle` ciblé) et global (`ThrottlerModule.forRoot`, 100 req/min), étendu à la création
   d'annonces (20/min) en Phase 7; `helmet()` et CORS strict déjà actifs; tous les montants et
   droits recalculés/vérifiés côté serveur (voir chaque module); `@sentry/node` branché en
   no-op tant que `SENTRY_DSN` est vide (`src/common/sentry.ts`, capturé dans
   `AllExceptionsFilter` pour les erreurs 5xx uniquement — pas les 4xx métier attendues). Tests
   e2e des parcours principaux: `test/main-flows.e2e-spec.ts` exécute un parcours complet réel
   (inscription OTP → publication avec photo traitée par le vrai worker BullMQ/sharp → achat →
   confirmation par webhook signé → expédition → confirmation de réception/versement → avis),
   contre la vraie base de données et Redis, sans aucun mock de la logique métier (seul le
   `SmsProvider` est substitué pour récupérer le code OTP sans lire les logs). Performance:
   bonnes pratiques déjà en place (images via `next/image` partout, pages mobile-first, taille
   de premier chargement ~100-134 kB par page) — **le score Lighthouse mobile réel n'a pas été
   mesuré** dans cet environnement sans navigateur graphique (à vérifier manuellement avant mise
   en production, voir README). Prod: `docker-compose.prod.yml` (Postgres, Redis, API, Web,
   Nginx — pas de MinIO, R2 utilisé directement) + `nginx/default.conf.template` routé par
   sous-domaine (`API_DOMAIN`/`WEB_DOMAIN`, substitués par l'entrypoint officiel de l'image
   nginx) plutôt que par préfixe de chemin, pour ne pas entrer en conflit avec le chemin par
   défaut de Socket.IO (`/socket.io/`). `README.md` détaille le déploiement VPS complet
   (variables d'env, Cloudflare, sauvegardes, mise à jour).

Mettre à jour cette section (et ce fichier en général) à la fin de chaque phase.

## Pièges connus

- **Port Postgres 5433, pas 5432** : si une instance PostgreSQL est déjà installée nativement
  sur la machine Windows (service `postgresql-x64-*`), elle occupe le port 5432 et intercepte
  les connexions destinées au conteneur Docker. Le `docker-compose.yml` mappe donc Postgres sur
  `5433` côté hôte (le réseau interne Docker continue d'utiliser `postgres:5432`). Si ce port
  est lui aussi pris sur une autre machine, changer `POSTGRES_PORT` dans `.env`.
- **Images MinIO** : `minio/minio` et `minio/mc` sur Docker Hub nécessitent désormais une
  authentification. Le projet utilise `quay.io/minio/minio` pour le serveur, et le service
  `minio-init` réutilise cette même image (son binaire `mc` intégré) pour créer le bucket —
  pas besoin de l'image `minio/mc` séparée.
- **`packages/shared` est un package compilé** : son `package.json` pointe vers `dist/index.js`
  (pas les sources `.ts` directement). Il faut `pnpm --filter @marketplace/shared build` (ou
  `pnpm build`/`pnpm dev` à la racine, qui le font automatiquement via Turborepo) avant que
  `apps/api` ou `apps/web` puissent le résoudre. Ne jamais faire pointer son `main`/`types` vers
  les sources `.ts` : cela a déjà causé un bug où `tsc`, en résolvant `@marketplace/shared` via
  `node_modules` en dehors du `rootDir` d'`apps/api`, écrivait des `.js`/`.d.ts` compilés
  directement dans `packages/shared/src`, à côté des sources. Après le fix (jest sans
  `moduleNameMapper` pointant vers les sources, `rootDir` explicite, pas d'`incremental`), le
  problème n'a plus été reproduit en isolant chaque commande (`build`, `typecheck`, `test`,
  `test:e2e` de chaque package) — mais si des fichiers `.js`/`.d.ts` réapparaissent dans
  `packages/*/src`, les supprimer et relancer `pnpm --filter @marketplace/shared build`. Le
  `.gitignore` les exclut désormais explicitement (`packages/*/src/**/*.js` etc.) en filet de
  sécurité pour qu'ils ne soient jamais commités même si le problème resurgit.
- **`apps/api` tourne avec `ts-node-dev` en développement** (pas `nest start --watch`) : plus
  robuste dans ce monorepo pnpm avec un package workspace. Le build de production reste
  `nest build` (via `tsc`), vérifié indépendamment et fonctionnel.
- **Pas d'`"incremental": true`** dans `apps/api/tsconfig.json` : un cache `.tsbuildinfo` périmé
  peut faire croire à `tsc` que rien n'a changé et produire un build vide sans erreur visible.
- **BullMQ : passer des options de connexion, jamais une instance `ioredis` toute faite** dans
  `BullModule.forRootAsync` (`app.module.ts`). BullMQ ne ferme pas une connexion qu'on lui a
  fournie soi-même, ce qui laissait un handle Redis ouvert après les tests e2e (warning Jest
  "did not exit"). Avec `connection: { host, port, password }`, BullMQ gère tout le cycle de vie.
- **Annonces de démonstration (seed)** : les photos utilisent `placehold.co` (pas d'upload S3
  réel nécessaire pour peupler la base). `placehold.co` est dans `next.config.js` →
  `images.remotePatterns`. Le vrai pipeline d'upload (S3 + BullMQ + sharp) est testé via le
  parcours vendeur normal, pas via le seed.
- **`prisma migrate dev` ne marche pas dans ce terminal non-interactif** : il refuse de
  s'exécuter ("non-interactive environment"). À la place, écrire le fichier
  `prisma/migrations/<horodatage>_<nom>/migration.sql` à la main puis lancer
  `prisma migrate deploy` (conçu pour du non-interactif) pour l'appliquer et mettre à jour
  l'historique des migrations.
- **Le webhook de paiement a besoin du corps brut (`rawBody`)** pour vérifier la signature
  HMAC: `NestFactory.create(AppModule, { rawBody: true })` dans `main.ts`, puis
  `@Req() req: RawBodyRequest<Request>` et `req.rawBody.toString('utf8')` dans le contrôleur.
  Le webhook vit dans `OrdersController` (pas un `PaymentsController` séparé) pour éviter une
  dépendance circulaire entre `OrdersModule` et `PaymentsModule`.
- **`forceExit: true` dans `apps/api/test/jest-e2e.json`** : le scheduler de `@nestjs/schedule`
  (tâche horaire d'auto-libération) laisse un timer ouvert après `app.close()` dans les tests
  e2e (warning Jest "did not exit", sans faire échouer les tests). `forceExit` est la solution
  standard pour ce genre de handle résiduel dans des tests d'intégration.
- **Un process Windows garde le moteur Prisma verrouillé** (`EPERM` sur
  `query_engine-windows.dll.node`) si un serveur `ts-node-dev` tourne encore pendant
  `prisma generate`. Toujours arrêter les process `node` du dev server avant de regénérer le
  client après une modification de `schema.prisma`.
- **`.dockerignore` est indispensable** (ajouté en Phase 7, aurait dû l'être dès la Phase 1) :
  sans lui, `COPY apps/api ./apps/api` / `COPY packages/shared ./packages/shared` dans les
  Dockerfiles embarquent le `node_modules` de l'hôte — sous Windows, `packages/shared/node_modules/
  typescript` est un symlink vers un **chemin absolu Windows** (`/c/Users/...`), qui devient un
  lien mort dans le conteneur Linux et fait échouer `pnpm --filter @marketplace/shared build`
  avec `MODULE_NOT_FOUND`. Confirmé et corrigé en testant réellement `docker build` (pas
  seulement en relisant le Dockerfile) — toujours vérifier un Dockerfile par un vrai build, pas
  seulement visuellement.
- **Les Dockerfiles doivent copier `tsconfig.base.json`** à la racine du contexte de build : le
  `tsconfig.json` de `packages/shared` l'`extends` depuis la racine du monorepo, et sans ce
  fichier `tsc` échoue avec `TS5083: Cannot read file '/app/tsconfig.base.json'`. Même leçon:
  tout nouveau fichier de config partagé à la racine doit aussi être ajouté aux `COPY` des
  Dockerfiles (`apps/api/Dockerfile`, `apps/web/Dockerfile`). **Les deux correctifs ont été
  confirmés par un `docker compose -f docker-compose.prod.yml build` complet et réussi
  (images `marketplace-prod-api` et `marketplace-prod-web` construites sans erreur).**
- **Nginx en prod route par sous-domaine, pas par préfixe `/api/`** : Socket.IO utilise un
  chemin fixe (`/socket.io/`) indépendant du préfixe d'URL de connexion, donc un reverse proxy
  qui stripperait un préfixe `/api/` casserait silencieusement le WebSocket en production.
  `API_DOMAIN`/`WEB_DOMAIN` (routage par `server_name`) évite complètement le problème.
