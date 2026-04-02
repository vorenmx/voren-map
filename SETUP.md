# 3D Map Setup Guide

## Migrating to a new Cursor + Google account (Voren)

Use **hola@voren.com.mx** for both Cursor sign-in and Google Cloud / Firebase.

### Cursor

1. In Cursor: **Settings → Account** (or the account menu) → sign out, then sign in with `hola@voren.com.mx`.
2. Open this repo from disk (`File → Open Folder`) or clone it again so the workspace is tied to the new account.

### Google Cloud & Firebase

1. Go to [Firebase Console](https://console.firebase.google.com) while logged in as `hola@voren.com.mx`.
2. Create a **new** Firebase project. This repo expects project ID **`voren-map`** (see `.firebaserc`). If Google assigns a different ID, run `firebase use <your-id>` or edit `.firebaserc`.
3. Enable **Firestore**, **Storage**, **Authentication** (if you use it), **Functions**, and **Hosting** for that project.
4. In the same GCP project (Google Cloud Console → **APIs & Services → Enabled APIs**), enable:

| API | Why |
| --- | --- |
| **Places API (New)** | Node extractor (`places:searchText`) and frontend Places Autocomplete / `Place` |
| **Maps JavaScript API** | Map, Advanced Markers, `libraries=places,marker` |

5. **Credentials → Create credentials → API key**
   - **Browser key** (for `frontend/.env`): restrict to **HTTP referrers** (`http://localhost:5173/*`, your `*.web.app` / custom domain). Enable only **Maps JavaScript API** and **Places API (New)** on that key if you use “API restrictions”.
   - **Server key** (for root `.env` `GOOGLE_MAPS_API_KEY`): restrict to **Places API (New)** only (optional: IP). Used only by `node index.js`, not shipped to the browser.

   You may use one key for local dev; production should use the split above.

6. **Maps Platform → Map Management**: create a **Map ID** (vector) and set `VITE_GOOGLE_MAPS_MAP_ID` in `frontend/.env`.

7. Copy Firebase web app config into `frontend/.env` (see `frontend/.env.example`).

### Authentication (Firebase)

1. **Sign-in method:** Firebase Console → **Build → Authentication → Sign-in method** → enable **Email/Password**. This app has no self-service registration UI; add users under **Authentication → Users** (or use the Admin SDK).
2. **Authorized domains:** **Authentication → Settings → Authorized domains** must include every host you use, for example:
   - `localhost`
   - `voren-map.firebaseapp.com`
   - `voren-map.web.app`
   - Any **custom domain** connected to Hosting  
   Missing domains cause sign-in / ID token errors (including for the `importCsv` function, which expects a **Bearer** ID token).

### Env files (after keys exist)

- **Project root** `.env`: `GOOGLE_MAPS_API_KEY` (+ `INEGI_DENUE_TOKEN` if you run DENUE).
- **`frontend/.env`**: all `VITE_*` variables from `frontend/.env.example`.

Do not commit `.env` files; they are gitignored.

---

## Prerequisites

- Node.js 20+
- Firebase CLI: `npm install -g firebase-tools`
- Firebase project under `hola@voren.com.mx` (see above)
- Google Maps / Places keys as above

---

## 1. Firebase project ID

Default in `.firebaserc`: **`voren-map`**. If your console project ID differs, either:

```bash
firebase use your-actual-project-id
```

or edit `.firebaserc`.

Console: `https://console.firebase.google.com/project/<your-project-id>`

---

## 2. Configure Google Maps API keys

Root `.env`:

```
GOOGLE_MAPS_API_KEY=your_server_places_key
```

`frontend/.env`:

```
VITE_GOOGLE_MAPS_API_KEY=your_browser_key
VITE_GOOGLE_MAPS_MAP_ID=your_map_id
```

Use the same browser key for local Vite if you accept referrer `http://localhost:5173/*`.

---

## 3. Link Firebase CLI

```bash
firebase login
firebase use voren-map
```

(Replace with your real project ID if different.)

---

## 4. Generate the Merged CSV

From the project root:

```bash
node index.js
# or, if you already have raw JSON cached:
node index.js --merge
```

This produces `output/merged_mexico_YYYY-MM-DD.csv`.

---

## 5. Upload CSV to Firebase Storage

Via the Firebase console:

1. Go to Storage → Upload file
2. Create a folder `csvs/`
3. Upload `output/merged_mexico_YYYY-MM-DD.csv` as `csvs/merged.csv`

Or via CLI (requires gsutil). Use the bucket name from **Firebase Console → Storage** (often `PROJECT_ID.firebasestorage.app` or `PROJECT_ID.appspot.com`):

```bash
gsutil cp output/merged_mexico_*.csv gs://voren-map.firebasestorage.app/csvs/merged.csv
```

---

## 6. Deploy Firebase Functions

```bash
cd functions && npm install
firebase deploy --only functions
```

If deploy fails with **missing permission on the build service account**, Cloud Build cannot push to Artifact Registry. For project **voren-map** (number `810909701841`), fix IAM per [Cloud Functions troubleshooting — build service account](https://cloud.google.com/functions/docs/troubleshooting#build-service-account) and [Cloud Build service account updates](https://cloud.google.com/build/docs/cloud-build-service-account-updates). Typical mitigations:

- In **Google Cloud Console → Cloud Build → Settings**, ensure the legacy **Cloud Build service account** usage is allowed if your org still supports it, **or**
- Grant **`roles/cloudbuild.builds.builder`** to the default compute service account `810909701841-compute@developer.gserviceaccount.com`, **or**
- Configure a **custom build service account** with read access to the GCF sources bucket and read/write to the `gcf-artifacts` Artifact Registry repo.

Then run `firebase deploy --only functions` again.

---

## 7. Import CSV into Firestore

After `importCsv` is deployed successfully, get its **HTTPS URL** from **Firebase Console → Functions → importCsv** (2nd gen functions may show a `*.run.app` URL instead of `cloudfunctions.net`).

The function requires a valid **Firebase ID token** (same project as the web app). Example with `curl` (replace `ID_TOKEN` and the URL):

```bash
curl -sS -H "Authorization: Bearer ID_TOKEN" "https://REGION-PROJECT_ID.cloudfunctions.net/importCsv?file=csvs/merged.csv&clear=true"
```

To obtain a token, sign in through the hosted app or local dev and read the current user’s ID token from the Firebase client SDK (e.g. `getIdToken()` on the signed-in user). A plain browser tab **without** the `Authorization` header receives **401**.

- `file` — Storage path to the CSV (default: `csvs/merged.csv`)
- `clear=true` — deletes existing documents before importing (safe for re-runs)

**Live Hosting URL for this project:** [https://voren-map.web.app](https://voren-map.web.app)

---

## 8. Build & Deploy Frontend

```bash
cd frontend
npm install
npm run build
cd ..
firebase deploy --only hosting
```

The app will be live at: `https://YOUR_PROJECT_ID.web.app` (for **voren-map**: `https://voren-map.web.app`).

---

## Google Cloud APIs (`voren-map`)

Use the **same** GCP project as Firebase (`voren-map`). With [gcloud](https://cloud.google.com/sdk) authenticated as a user who owns the project:

```bash
gcloud config set project voren-map
gcloud services enable maps-backend.googleapis.com places.googleapis.com
```

Then **APIs & Services → Credentials**: create a **browser** API key restricted to HTTP referrers (`http://localhost:5173/*`, `https://voren-map.web.app/*`) and to **Maps JavaScript API** + **Places API (New)**. Set `VITE_GOOGLE_MAPS_API_KEY` (and create a **Map ID** under Maps Platform → Map Management for `VITE_GOOGLE_MAPS_MAP_ID`). You can reuse the Firebase web API key for Maps **only after** those APIs are enabled and the key’s restrictions allow them.

### Migrating Firestore data from an old project

Firebase does not move projects between accounts. Export from the **old** project’s Firestore to Cloud Storage, copy the export to a bucket the **new** project can read, then [import into Firestore](https://firebase.google.com/docs/firestore/manage-data/export-import) in `voren-map`. Align **Authentication** users with Firestore documents that use `userId` / UID fields (see Authentication section above).

---

## 9. Local Development

```bash
cd frontend
npm run dev
# open http://localhost:5173
```

For local functions emulation:

```bash
firebase emulators:start --only functions,firestore,storage
```

---

## Project Structure

```
voren-map/
├── frontend/              # Vue 3 + Vite app
│   ├── src/
│   │   ├── firebase/      # Firebase SDK init
│   │   ├── composables/   # useShops, useDeckLayers
│   │   └── components/    # MapView, FilterPanel, ShopTooltip
│   └── dist/              # Built app (gitignored)
├── functions/             # Firebase Cloud Functions
│   └── index.js           # importCsv HTTP function
├── output/                # Generated CSVs
├── firebase.json          # Firebase config
├── firestore.rules        # Firestore security rules
└── storage.rules          # Storage security rules
```
