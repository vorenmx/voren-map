# Odoo CRM Integration — Setup Guide

This document covers the one-time manual configuration needed in Odoo and Firebase
before the integration goes live.

The integration uses the **Odoo JSON-2 REST API** (`/json/2`), available on Odoo 19+.
Access to the external API requires an **Odoo Custom pricing plan** (not available on
One App Free or Standard plans).

---

## 1. Create Custom Fields in Odoo

Go to **Settings → Technical → Custom Fields** (developer mode must be active).
Select the model **`crm.lead`** and create each field below.

> Enable developer mode: `Settings → Activate the developer mode`
> (or append `?debug=1` to any Odoo URL).

| Field name | Field type | Label |
|---|---|---|
| `x_voren_shop_id` | Char | Voren Shop ID |
| `x_shop_type` | Char | Tipo de tienda |
| `x_score_general` | Integer | Score general |
| `x_score_pains` | Integer | Score pains |
| `x_score_probabilidad` | Integer | Prob. de venta |
| `x_score_satisfaccion` | Integer | Satisf. proveedores |
| `x_tamano_tienda` | Char | Tamaño tienda |
| `x_credito` | Char | Crédito |
| `x_metodo_pago` | Char | Método de pago |
| `x_entrega` | Char | Entrega |
| `x_principal_proveedor` | Char | Proveedor principal |
| `x_contacto_personal` | Char | Contacto personal del tomador de decisión |
| `x_comentarios` | Text | Comentarios |
| `x_visitado_por` | Char | Visitado por |
| `x_fuente_datos` | Char | Fuente de datos |
| `x_google_maps_url` | Char | Google Maps URL |
| `x_purchases` | Integer | Compras |
| `x_average_order` | Float | Pedido promedio |

Optionally add the custom fields to the CRM Lead form view via
**Settings → Technical → User Interface → Views** (edit the `crm.lead` form).

---

## 2. Create a Dedicated Bot User and API Key

### 2a. Create a bot user (recommended)

1. Go to **Settings → Users & Companies → Users → New**.
2. Name it `Voren Map Bot` (or similar).
3. Set **Access Rights**: CRM — User, Contacts — User.
4. Leave the password empty (disables password login for security).
5. Save.

### 2b. Generate an API Key

1. Log in as the bot user (or use an admin account for testing).
2. Open **Preferences** (top-right avatar menu) → **Account Security** tab.
3. Click **New API Key**.
4. Enter a **description** (e.g. `voren-map-integration`) and set a **duration**.

> **Important — key expiry:** Odoo 19 API keys expire. The maximum duration is
> **3 months**. You must rotate the key before it expires by generating a new one
> and running `firebase functions:secrets:set ODOO_API_KEY` again with the new value.
> Set a calendar reminder for 2 months 3 weeks from creation.

5. Click **Generate Key** and **copy the key immediately** — it is shown only once.

---

## 3. Set Firebase Function Secrets

Run these three commands from the project root (Firebase CLI must be installed and logged in).
When prompted, paste the corresponding value.

```bash
firebase functions:secrets:set ODOO_URL
# Value: https://yourcompany.odoo.com   (no trailing slash)

firebase functions:secrets:set ODOO_DB
# Value: yourcompany   (Odoo database name — only needed if your Odoo hosts multiple databases)

firebase functions:secrets:set ODOO_API_KEY
# Value: <paste the API key from step 2b>
```

Verify a secret was stored correctly:
```bash
firebase functions:secrets:access ODOO_URL
```

### Rotating the API key (every ~3 months)

1. In Odoo, generate a new API key following step 2b.
2. Run: `firebase functions:secrets:set ODOO_API_KEY` and paste the new key.
3. Redeploy functions: `firebase deploy --only functions`
4. Delete the old key in Odoo (Preferences → Account Security).

---

## 4. Deploy the Cloud Functions

```bash
firebase deploy --only functions
```

Expected: `syncToOdoo` and `reconcileOdoo` appear in the deployed functions list
alongside the existing `importCsv` and `backfillVisitedByEmail`.

---

## 5. Test End-to-End

1. Open the Voren Map app.
2. Click any shop pin and press **Exitosa** in the Status Visita section.
3. Within ~10 seconds, check **Firebase Console → Functions → Logs** for:
   `syncShopToOdoo: created lead <id> for shop <shopId>`
4. In Odoo CRM, confirm a new lead appeared with all the custom fields populated.

If a sync fails, the error is stored in `visited_stores/{shopId}.odoo_sync_error`
in Firestore. The daily `reconcileOdoo` function retries all failed/missed records
automatically at 08:00 MX time.

---

## Field mapping reference

| Odoo field | Source |
|---|---|
| `partner_name` | `shops.name` or `shops.company_name` |
| `phone` | `shops.phone` |
| `email_from` | `shops.email` |
| `website` | `shops.website` |
| `street` | `shops.formatted_address` or `shops.street` |
| `city` | `shops.municipality` |
| `state_id` | Looked up by `shops.state` name (Mexico states) |
| `country_id` | Mexico (fixed, id = 156) |
| `x_voren_shop_id` | Firestore document ID |
| `x_shop_type` | `shops.shop_type` |
| `x_score_general` | `visited_stores.score_general` |
| `x_score_pains` | `visited_stores.score_pains` |
| `x_score_probabilidad` | `visited_stores.score_probabilidad` |
| `x_score_satisfaccion` | `visited_stores.score_satisfaccion` |
| `x_tamano_tienda` | `visited_stores.tamano_tienda` |
| `x_credito` | `visited_stores.credito` |
| `x_metodo_pago` | `visited_stores.metodo_pago` (joined with `, `) |
| `x_entrega` | `visited_stores.entrega` |
| `x_principal_proveedor` | `visited_stores.principal_proveedor` (joined with `, `) |
| `x_contacto_personal` | `visited_stores.contacto_personal` |
| `x_comentarios` | `visited_stores.comentarios` |
| `x_visitado_por` | `visited_stores.visitedByEmail` |
| `x_fuente_datos` | `shops.source` |
| `x_google_maps_url` | `shops.google_maps_url` |
| `x_purchases` | `shops.purchases` |
| `x_average_order` | `shops.average_order` |

---

## Troubleshooting: `PERMISSION_DENIED` on `syncToOdoo` (Firestore)

Gen2 Cloud Functions run as the **default Compute Engine service account**:

`810909701841-compute@developer.gserviceaccount.com`

If Firebase logs show `Error: 7 PERMISSION_DENIED` when reading `shops` or writing `visited_stores`, that account needs Firestore access.

### Fix in Google Cloud Console

1. Open [IAM](https://console.cloud.google.com/iam-admin/iam?project=voren-map) for project `voren-map`.
2. Find **Compute Engine default service account** (`…-compute@developer.gserviceaccount.com`).
3. Click **Edit principal** (pencil) → **Add another role**.
4. Add **Cloud Datastore User** (`roles/datastore.user`).
5. Save. Wait ~1 minute, then mark a shop as **Exitosa** again.

### Fix with gcloud (optional)

```bash
gcloud projects add-iam-policy-binding voren-map \
  --member="serviceAccount:810909701841-compute@developer.gserviceaccount.com" \
  --role="roles/datastore.user"
```

### Alternative: App Engine default service account

If you prefer the classic Firebase App Engine identity, [create an App Engine application](https://console.cloud.google.com/appengine?project=voren-map) once (any region). That creates `voren-map@appspot.gserviceaccount.com`. You can then point Gen2 functions at that service account in code (requires redeploy and re-granting secret access to that account).
