### AI Form Coach – Coaching de Calisthénie Automatisé

---

## Description du projet

**AI Form Coach** est une application de **coaching de calisthénie automatisé** basée sur la vision par ordinateur.  
L’objectif est de :

- **Analyser automatiquement la technique d’exercices de calisthénie** (front lever, planche, human flag, handstand, etc.) à partir de vidéos.
- **Détecter les poses**, extraire les **points clés du corps** (keypoints) via **MediaPipe**, puis
- **Évaluer la qualité de la posture** grâce à un moteur de scoring dédié, et
- **Fournir un retour détaillé** à l’utilisateur : notes par critère, axes d’amélioration, feedback textuel.

En résumé : **« Créer une application de coaching de calisthénie automatisé avec MediaPipe »**, avec :

- Un **frontend React** moderne.
- Un **backend Node/Express + MongoDB** pour l’API et la persistance.
- Des **services Python** (détection & scoring) orchestrés via Docker.
- Une **intégration MediaPipe** côté frontend pour l’analyse locale ou pour enrichir les données envoyées au backend.

---

## Stack technologique

### 1. Frontend – ReactJS (Vite, React 19)

- **Localisation** : `apps/frontend`
- **Tech principal** : ReactJS + Vite

**Dépendances clés** (extrait de `apps/frontend/package.json`) :

- `react`, `react-dom` (v19)  
- `react-router-dom` : routing (pages `Landing`, `Dashboard`, `Login`, `Register`, etc.)
- `i18next`, `react-i18next`, `i18next-browser-languagedetector` : internationalisation.
- `@mediapipe/tasks-vision` : intégration MediaPipe côté navigateur.
- Vite (`vite`, `@vitejs/plugin-react`) : bundler / dev server rapide.
- ESLint pour la qualité du code.

**Avantages** :

- **Réactivité & SPA moderne** : transitions fluides, dashboard interactif.
- **DX excellente** avec Vite (hot reload très rapide).
- **Intégration MediaPipe** directement dans le navigateur (latence réduite, pas besoin d’envoyer toutes les frames au serveur).
- **i18n intégré** (`src/i18n.js`) pour gérer plusieurs langues, pratique pour un produit global.

**Inconvénients** :

- **Bundle potentiellement lourd** avec MediaPipe si mal découpé.
- **Gestion de la performance** importante : le traitement vidéo + React peut être coûteux sur des machines modestes.
- **Complexité d’état** : coordination entre vidéo, keypoints, analyses et affichage des résultats peut devenir difficile sans architecture claire (context, hooks personnalisés, etc.).

**Rôle dans le projet** :

- Interface utilisateur (pages `Landing`, `Dashboard`, `AnalysisDetail`, `Blog`, `Login`, `Register`, etc.).
- Composants d’analyse :
  - `PoseSandbox.jsx` : sandbox de pose / test.
  - Composants d’analytique (`AnalysisDashboard.jsx`, `CircularScore.jsx`, `MetricBar.jsx`, `metricConfig.js`, `scoreTheme.js`).
  - `PoseResultPanel.jsx`, `PoseKeypointsPanel.jsx`, `AnalyzeStepper.jsx` pour guider l’utilisateur à travers le processus d’analyse.
- Appelle le backend via `src/lib/api.js` (HTTP/REST).

---

### 2. Backend – Express.js + MongoDB

- **Localisation** : `apps/api`
- **Tech principal** : Node.js + Express
- **Type de module** : CommonJS (`"type": "commonjs"`)

**Dépendances clés** (extrait de `apps/api/package.json`) :

- `express` : serveur HTTP / API.
- `mongoose` : ODM MongoDB.
- `jsonwebtoken`, `bcrypt`, `cookie-parser` : auth & gestion de sessions / tokens.
- `cors`, `dotenv` : configuration & sécurité.
- `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` : gestion des fichiers (upload vidéo, etc.).
- `axios` : appels sortants (probablement vers les services Python de détection/scoring).
- `uuid` : identifiants uniques.
- `zod` : validation de schémas.

**Avantages** :

- **Écosystème Node très riche**, facile d’ajouter des middlewares (auth, logs, validation).
- **Intégration naturelle avec le frontend React** (JSON/REST).
- **Mongoose** simplifie l’accès à Mongo (schémas, validations).
- Bonne flexibilité pour orchestrer les services Python via HTTP (detection/scoring).

**Inconvénients** :

- La **gestion des erreurs** et de la **concurrence** doit être bien pensée (timeouts vers services Python, erreurs réseau, etc.).
- Node n’est pas le plus adapté pour le **CPU-bound** lourd (mais ici, ce rôle est délégué aux services Python).
- **Complexité de configuration** avec S3, JWT, cookies, etc. si mal isolée.

**Rôle dans le projet** :

- API principale (port **3000** en Docker).
- Routes HTTP (exemples) :
  - `src/routes/pose.js` : endpoints liés à l’analyse de pose (upload, lancement de scoring, récupération de résultats).
  - `src/routes/uploads.js` : gestion des fichiers (upload de vidéos/images).
  - `src/routes/auth.js` : authentification (login/register).
- Modèles MongoDB :
  - `src/models/User.js` : utilisateurs, mots de passe hashés, etc.
  - `src/models/Analysis.js` : stocke résultats d’analyses (scores, métriques, métadonnées).
- Intégration S3 (`src/s3.js`) : stockage ou pré-signature pour les fichiers (vidéos/frames).
- Intégration scoring & feedback :
  - `src/scoring.js`, `src/feedback.js`
  - Fichiers `improvementFeedback.json` / `improvementFeedback.en.json` : base textuelle de feedback d’amélioration.

---

### 3. Base de données – MongoDB

- **Orchestration via Docker** dans `infra/docker-compose.yml`, service `mongo`.
- Exposé en local sur `27017:27017`.

**Avantages** :

- **Flexible** pour stocker des documents d’analyse (keypoints, scores, métadonnées variées).
- Permet de stocker des structures variées par exercice / par pose sans migration lourde.
- S’intègre très bien avec Node via Mongoose.

**Inconvénients** :

- Nécessite une **maintenance** pour les index, la taille des collections de logs, etc.
- Si les schémas ne sont pas pensés dès le début, on peut rapidement accumuler de la dette de structure.

**Rôle** :

- Stockage des utilisateurs, des sessions/jetons si nécessaire.
- Stockage des analyses : type d’exercice (front lever, planche…), date, scores, métriques détaillées, feedback généré.

---

### 4. MediaPipe – Détection des poses (frontend + services)

#### a) Côté frontend

- Utilisation de `@mediapipe/tasks-vision` dans `apps/frontend`.
- Fichiers clés (non exhaustif) :
  - `src/lib/poseLandmarkerFactory.js` : fabrique MediaPipe Pose Landmarker.
  - `src/lib/poseAugment.js`, `poseSandboxUtils.js` : logique de transformation/augmentation de keypoints, sandbox, etc.

**Objectif** : **extraire les keypoints** (positions des articulations) directement dans le navigateur, limiter les transferts de données brutes (vidéo).

**Avantages** :

- **Latence réduite**, traitement local.
- Respect plus fort de la **confidentialité** (moins de vidéo brute sur le réseau).
- Permet des retours temps réel (ou quasi temps réel) à l’utilisateur.

**Inconvénients** :

- Charge CPU côté client : dépend de la machine de l’utilisateur.
- Complexité JS/WebGL/WebAssembly et taille des modèles MediaPipe.

#### b) Côté services (Python)

- **Détection** : `services/detection`
  - `app/main.py` : API/serveur de détection.
  - `app/poses/*.py` : règles de détection par type de pose (`lever_back.py`, `lever_front.py`, `planche.py`, `handstand.py`, etc.).
  - `app/pose_rules.py`, `pose_features.py`, `dataset.py`, `pose_logging.py` : logique de features, dataset, logs.
  - Exposé sur **port 8000** (Docker).

- **Scoring** : `services/scoring`
  - `app/main.py`, `pipeline.py`, `engine.py` : moteur de scoring.
  - Dossier `app/poses/` avec :
    - `specs/*.py` : spécifications des poses (critères attendus : angles, alignements…).
    - `evaluators/*.py` : calcul concret des scores par figure (`front_lever.py`, `back_lever.py`, `planche.py`, `handstand.py`, etc.).
  - Dossier `app/scoring/metrics/*.py` : métriques (line metrics, symmetry, compression, extension…).
  - Dossier `app/figures/` : représentation géométrique ou config des figures.
  - Exposé sur **port 8001** (Docker map `8001:8000`).

**Avantages** :

- **Python** est bien adapté à la manipulation math/numérique et aux bibliothèques scientifiques.
- Séparation claire : détection (features/keypoints) vs scoring (évaluation métier).
- Facile d’étendre de nouvelles poses en ajoutant un spec + evaluator.

**Inconvénients** :

- Deux services supplémentaires à maintenir (detection + scoring).
- Latence réseau API interne (négligeable en local, mais à considérer en prod).
- Besoin de coordonner les versions de modèles/règles entre front, detection et scoring.

---

## Architecture d’ensemble

Le projet suit une architecture en **multi-apps / multi-services** :

- `apps/frontend` : SPA React (UI).
- `apps/api` : API Node/Express, orchestrateur métier.
- `services/detection` : service Python de détection (features & règles de pose).
- `services/scoring` : service Python de scoring (calcul de score, métriques).
- `infra/docker-compose.yml` : orchestration des services et de Mongo.

### Vue globale des flux

1. **Utilisateur** envoie une vidéo / image ou capture en direct dans le **frontend**.
2. **Frontend** :
   - Option 1 : Extrait des keypoints avec **MediaPipe** côté client, puis envoie un JSON de keypoints au backend.
   - Option 2 : Uploade la vidéo / image vers le backend, qui se charge de la détection/scoring.
3. **API Node/Express** (`apps/api`) :
   - Reçoit soit la vidéo (via routes `uploads` / `pose`), soit les keypoints.
   - Stocke éventuellement la ressource (S3, disque local, etc.).
   - Appelle :
     - le **service `detection`** pour récupérer des keypoints ou features,
     - puis le **service `scoring`** pour calculer les scores de la pose.
   - Enregistre les résultats dans **MongoDB** (`Analysis`).
   - Retourne la réponse JSON au frontend (scores, métriques, feedback).
4. **Frontend** affiche :
   - Un **dashboard d’analyse** (`AnalysisDashboard`, `PoseResultPanel`, `CircularScore`, `MetricBar`, etc.).
   - Un **feedback textuel** basé sur `improvementFeedback*.json` (par ex. : « Rapproche un peu plus ton bassin de la ligne des épaules. »).

---

## Démarrage & installation

### 1. Prérequis

- **Git**
- **Docker** & **Docker Compose**
- **Node.js** (version recommandée : 18+)
- **npm** (ou équivalent `pnpm` / `yarn`)

Préparer un fichier `.env` à la racine du projet (inspiré de `.env.example`) avec, par exemple :

- Paramètres API / Mongo :
  - `MONGO_URI` (si nécessaire, sinon valeur interne Docker)
  - `JWT_SECRET`
- Paramètres S3 :
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_S3_BUCKET`
  - Autres variables selon la configuration de `apps/api/src/s3.js`
- URLs internes des services de détection et scoring (si configurables) :
  - `DETECTION_URL` (ex. `http://detection:8000`)
  - `SCORING_URL` (ex. `http://scoring:8000`)

> Se référer à `.env.example` pour la liste exacte des variables.

---

### 2. Lancer l’infrastructure Docker (Mongo + services Python + API Node)

Le fichier `infra/docker-compose.yml` définit les services :

- `mongo` (port 27017)
- `detection` (port 8000)
- `scoring` (port 8001)
- `api` (port 3000)

**Étapes** :

1. Ouvrir un terminal à la racine du projet :

```bash
cd /Users/lubin.danilo/ai-form-coach
```

2. Créer et renseigner ton `.env` si ce n’est pas déjà fait :

```bash
cp .env.example .env
# puis éditer .env avec tes valeurs
```

3. Lancer les services :

```bash
cd infra
docker compose up --build
```

Cela va :

- Télécharger l’image Mongo.
- Builder les Dockerfile :
  - `services/detection/Dockerfile`
  - `services/scoring/Dockerfile`
  - `apps/api/Dockerfile`
- Démarrer les conteneurs :
  - Mongo : `27017:27017`
  - Detection : `8000:8000`
  - Scoring : `8001:8000`
  - API : `3000:3000`

4. Vérifier que les services tournent (logs Docker, ou `docker ps`).

> En production, adapter `docker-compose.yml`, les variables d’environnement et la configuration réseau selon le contexte d’hébergement.

---

### 3. Lancer le frontend (React/Vite)

Dans un **autre** terminal :

1. Aller dans le dossier frontend :

```bash
cd /Users/lubin.danilo/ai-form-coach/apps/frontend
```

2. Installer les dépendances :

```bash
npm install
```

3. Lancer le serveur de développement :

```bash
npm run dev
```

4. Ouvrir le navigateur à l’URL affichée par Vite (généralement `http://localhost:5173`).

5. Vérifier que le frontend communique bien avec l’API (qui tourne via Docker sur `http://localhost:3000`).

---

### 4. Lancer uniquement l’API en local (hors Docker) – optionnel

Pour développer l’API sans orchestrer tous les services via Docker :

1. Lancer MongoDB (via Docker seul ou une instance locale).
2. Démarrer les services Python manuellement (en suivant leurs `requirements.txt` respectifs).
3. Démarrer l’API Node en local.

Exemple pour l’API :

```bash
cd /Users/lubin.danilo/ai-form-coach/apps/api
npm install
npm start   # lance src/index.js
```

Assure-toi que :

- `MONGO_URI` pointe vers ta base.
- Les URLs des services `detection` et `scoring` sont correctes (ex. `http://localhost:8000`, `http://localhost:8001`).

---

## Fonctionnement des appels API

### 1. API HTTP entre frontend et backend Node/Express

Le frontend utilise un wrapper dans `apps/frontend/src/lib/api.js` pour :

- Configurer une **URL de base** (par ex. `http://localhost:3000` en dev).
- Fournir des fonctions telles que :
  - `login`, `register` (via `apps/api/src/routes/auth.js`).
  - `uploadPose`, `analyzePose`, etc. (via `apps/api/src/routes/pose.js` et `uploads.js`).
  - Récupérer des **analyses existantes** pour peupler le `Dashboard`.

#### Schéma d’appel typique (logique générale)

1. **Upload / analyse** :
   - Le frontend envoie soit :
     - un fichier (FormData) vers une route du type `/pose/analyze`,  
     - soit les keypoints JSON vers une route du type `/pose/analyze-keypoints`.
2. **Backend** :
   - Stocke la ressource (S3/FS).
   - Appelle detection/scoring (voir ci-dessous).
   - Sauvegarde l’`Analysis` dans Mongo.
   - Retourne `analysisId`, `scores`, `metrics`, `feedback`.
3. **Frontend** :
   - Redirige vers une page de détail (`/analysis/:id` → `AnalysisDetail.jsx`).
   - Utilise `AnalysisDashboard` et co. pour visualiser les scores.

### 2. API HTTP entre backend Node/Express et services Python

L’API Node agit comme **orchestrateur** :

- Vers `services/detection` (port 8000) :
  - Endpoint type `POST /detect` avec :
    - soit la vidéo (ou un chemin vers la vidéo),
    - soit une série d’images/frames,
    - ou un identifiant interne.
  - Réponse : keypoints, features, debug infos.

- Vers `services/scoring` (port 8001) :
  - Endpoint type `POST /score` avec :
    - type de pose (front_lever, planche, etc.),
    - keypoints/metrics en entrée,
    - métadonnées (angle caméra, latéralité…).
  - Réponse : scores (globaux + par critère), métriques détaillées, éventuelle “confiance”.

Les appels sont assurés via `axios` dans le code Node (`apps/api/src/scoring.js`, `apps/api/src/routes/pose.js`).

### 3. Exemple de schémas JSON (conceptuel)

- **Requête frontend → API** :

```json
{
  "exercise": "front_lever",
  "keypoints": [
    { "name": "left_shoulder", "x": 0.42, "y": 0.31, "z": -0.12 },
    { "name": "right_shoulder", "x": 0.58, "y": 0.30, "z": -0.11 }
  ]
}
```

- **Réponse API → frontend** :

```json
{
  "analysisId": "uuid-...",
  "exercise": "front_lever",
  "overallScore": 82,
  "metrics": {
    "horizontal_alignment": 90,
    "core_engagement": 75,
    "leg_extension": 85
  },
  "feedback": [
    "Garde le tronc plus gainé pour réduire la cambrure.",
    "Essaye de mieux aligner les hanches avec les épaules."
  ]
}
```

Ces structures exactes dépendent des implémentations dans `services/scoring/app/scoring/metrics/*.py` et `apps/api/src/feedback.js`, mais ce schéma illustre la logique.

---

## Structure du projet (vue d’ensemble)

- `apps/`
  - `frontend/`
    - `src/`
      - `App.jsx`, `index.css`, `styles.css`
      - `components/pose/` (UI d’analyse, dashboards)
      - `components/landing/` (`LandingDemoCard.jsx`, etc.)
      - `pages/` (`Landing.jsx`, `Dashboard.jsx`, `AnalysisDetail.jsx`, `Login.jsx`, `Register.jsx`, `Blog.jsx`)
      - `lib/` (`api.js`, `poseLandmarkerFactory.js`, `poseAugment.js`, `poseSandboxUtils.js`)
      - `i18n.js` (internationalisation)
  - `api/`
    - `src/`
      - `index.js` (bootstrap de l’API Express)
      - `routes/` (`pose.js`, `auth.js`, `uploads.js`)
      - `models/` (`User.js`, `Analysis.js`)
      - `middleware/` (`auth.js`)
      - `lib/` (`scoreLabel.js`, `s3.js`, `scoring.js`, `feedback.js`)
      - `improvementFeedback*.json` (templates de feedback)
- `services/`
  - `detection/` (Python, détection keypoints & règles)
    - `app/main.py`, `poses/*.py`, `pose_rules.py`, etc.
  - `scoring/` (Python, calcul de scores)
    - `app/main.py`, `pipeline.py`, `engine.py`
    - `app/poses/specs/*.py`, `app/poses/evaluators/*.py`
    - `app/scoring/metrics/*.py`
- `infra/`
  - `docker-compose.yml` (orchestration Mongo + services + API)
- `data/`
  - `datasets/pose_samples.csv` (dataset d’exemples de poses pour le scoring / tests)
- `.env`, `.env.example`
- `.gitignore`, etc.

---

## Bonnes pratiques & pistes d’évolution

- **Séparer clairement** la logique d’UI, les appels API et les transformations de données côté frontend (ex. hooks dédiés pour les appels à `api.js`).
- **Documenter les endpoints** de l’API (idée : Swagger/OpenAPI) pour faciliter l’intégration de clients tiers ou d’autres frontends.
- **Monitorer** les temps de réponse des services `detection` et `scoring` (logs + métriques) pour identifier les goulots d’étranglement.
- **Tester** :
  - Tests Python pour les métriques (`services/scoring/tests/test_smoke.py` déjà présent).
  - Tests API Node (ex. Jest, Supertest).
  - Tests E2E front (Playwright/Cypress) à envisager pour les scénarios complets d’analyse.

---

## Cheatsheet rapide

- **Lancer toute la stack (dev)** :

```bash
cd infra
docker compose up --build
```

- **Lancer le frontend (dev)** :

```bash
cd apps/frontend
npm install
npm run dev
```

- **Lancer uniquement l’API Node (hors Docker)** :

```bash
cd apps/api
npm install
npm start
```

Adapte les URLs, ports et variables d’environnement selon ton environnement (dev, staging, prod).

---

## Déploiement (prod) sur un VPS unique (Docker + Nginx + HTTPS)

Cette section correspond à une mise en ligne “single box” : **un VPS** héberge Docker (API + services + Mongo), et **Nginx** expose l’API en HTTPS sur un sous-domaine.

### 0) Préparer le DNS

- Créer un enregistrement **A** :
  - `api.formetry.io` → IP publique du VPS

### 1) Préparer le VPS (Ubuntu)

- Lancer le script de bootstrap (installe Docker, Nginx, Certbot, UFW) :

```bash
sudo bash infra/scripts/vps-bootstrap-ubuntu.sh
```

### 2) Cloner et configurer l’app

```bash
sudo mkdir -p /opt
sudo chown "$USER":"$USER" /opt
cd /opt
git clone <TON_URL_GITHUB> ai-form-coach
cd ai-form-coach
cp .env.example .env
nano .env
```

Variables recommandées en prod (exemples) :

- `CORS_ORIGINS=https://formetry.io,https://formetry.fr,https://www.formetry.io,https://www.formetry.fr`
- `RATE_LIMIT_PER_MINUTE=240`

> En prod, ne pas exposer Mongo/detection/scoring : ils restent dans le réseau Docker.

### 3) Lancer la stack Docker

```bash
cd /opt/ai-form-coach/infra
docker compose up --build -d
```

Vérifications :

```bash
curl -sS http://127.0.0.1:3000/health
curl -i  http://127.0.0.1:3000/ready
docker ps
```

### 4) Configurer Nginx pour l’API + HTTPS

Copier la conf Nginx fournie :

```bash
sudo mkdir -p /var/www/certbot
sudo cp /opt/ai-form-coach/infra/nginx/api.formetry.io.conf /etc/nginx/sites-available/api.formetry.io.conf
sudo ln -sf /etc/nginx/sites-available/api.formetry.io.conf /etc/nginx/sites-enabled/api.formetry.io.conf
sudo nginx -t
sudo systemctl reload nginx
```

Générer le certificat Let’s Encrypt :

```bash
sudo certbot --nginx -d api.formetry.io
```

### 5) Connecter le frontend (Vercel)

Sur Vercel, configurer en prod :

- `VITE_API_BASE_URL=https://api.formetry.io`

Puis redéployer le frontend.

### 6) Test de bout en bout (minimum)

- `https://api.formetry.io/health` → doit renvoyer `{ "status": "ok" }`
- depuis `https://formetry.io` :
  - register/login
  - appel à `/api/auth/me` (cookie JWT)

