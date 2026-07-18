# Storefront ↔ ERP integration (vorencommx ↔ voren-map)

## Data flow

1. **Catalog (ERP → storefront)**  
   `voren-map` `inventory_items` + `inventory_stock` → Cloud Function `publicarCatalogo` / `publicarCatalogoStock` → `vorencommx` Firestore `catalogo/{itemId}`.

2. **Orders (storefront → ERP)**  
   Paid order on voren.com.mx → POST `ingestEcommerceOrder` → `orders/{orderId}` + `inventory_movements` salidas → stock decrements → catalog availability re-published.

## Cross-project catalog access (Option B — no JSON keys)

Org policies often block “Generate private key”. Instead:

1. Note the **voren-map** Cloud Functions runtime SA (usually  
   `PROJECT_NUMBER-compute@developer.gserviceaccount.com`).
2. In **vorencommx → IAM → Grant access**, add that email with role  
   **Cloud Datastore User**.
3. Catalog functions use Application Default Credentials + `projectId: vorencommx`.

No `STORE_SERVICE_ACCOUNT` secret is required.

## One-time Firebase secret (voren-map project)

```bash
# Shared webhook secret (generate a long random string)
firebase functions:secrets:set ECOMMERCE_INGEST_SECRET
```

The same value is also stored in **vorencommx** Secret Manager as `ECOMMERCE_INGEST_SECRET`
(so storefront Cloud Functions can read it without committing the secret). Local copy for
operators: `voren-map/.ecommerce_ingest_secret.local` (gitignored).

## Import SKU master into ERP

1. Upload the CSV (repo copy at `data/sku-es.csv`, bobina 14 image already fixed):

```bash
gsutil cp data/sku-es.csv gs://voren-map.firebasestorage.app/csvs/sku-es.csv
```

2. Call the function via the **ERP Hosting rewrite** (function is private — org
   policy blocks public invokers). Auth: Bearer Firebase ID token of an
   `@voren.com.mx` user (or `__session` cookie from the ERP):

```bash
curl -sS -H "Authorization: Bearer ID_TOKEN" \
  "https://voren-erp.web.app/api/importInventoryCsv?file=csvs/sku-es.csv"
```

3. In ERP **Almacén**, set `precio_venta` and register `entrada` stock for each SKU.

## Storefront contract (implement in vorencommx)

### Read catalog

```js
// vorencommx Firestore
db.collection('catalogo').doc(itemId) // or query all
// fields: sku, nombre, grupo, precio, imagen_url, disponible,
// especificacion, funcionalidad, medidas, compatibilidad, comentarios
```

### On order paid — POST webhook

```http
POST https://voren-erp.web.app/api/ingestEcommerceOrder
X-Voren-Ingest-Secret: <ECOMMERCE_INGEST_SECRET>
Content-Type: application/json

{
  "orderId": "ORD-123",
  "customer": {
    "nombre": "Juan Pérez",
    "email": "juan@example.com",
    "telefono": "5512345678",
    "direccion": "CDMX"
  },
  "items": [
    { "sku": "VR-ACES-00001", "cantidad": 2, "precio": 199 }
  ],
  "total": 398,
  "currency": "MXN",
  "paidAt": "2026-07-16T18:00:00.000Z"
}
```

Use the Hosting URL (not `cloudfunctions.net`) — the function is `invoker: private`
because org policy blocks `allUsers`.

Idempotent: repeating the same `orderId` returns `status: "already_exists"` and does not double-decrement stock.

## Deploy (voren-map)

```bash
firebase deploy --only functions,firestore:rules,hosting:erp
```
