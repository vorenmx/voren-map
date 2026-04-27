import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { onRequest } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import admin from 'firebase-admin';
import { GeoPoint } from 'firebase-admin/firestore';
import Papa from 'papaparse';
import { createOrUpdateLead, deleteLead } from './odooClient.js';

const getAuth    = () => admin.auth();
const getStorage = () => admin.storage();

const PROJECT_ID =
  process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'voren-map';

// ── Odoo secrets (set via: firebase functions:secrets:set ODOO_URL etc.) ──
const ODOO_URL     = defineSecret('ODOO_URL');
const ODOO_DB      = defineSecret('ODOO_DB');
const ODOO_API_KEY = defineSecret('ODOO_API_KEY');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALLOWED_IMPORT_EMAILS = JSON.parse(
  readFileSync(path.join(__dirname, 'allowed-google-emails.json'), 'utf8')
);
const allowedImportEmailSet = new Set(
  ALLOWED_IMPORT_EMAILS.map((e) => String(e).toLowerCase().trim())
);

// Firestore triggers can leave only *named* apps registered (admin.apps.length > 0)
// while admin.firestore() still requires the default [DEFAULT] app. Ensure it exists.
let _db;
function getDb() {
  if (!_db) {
    try {
      admin.app();
    } catch {
      admin.initializeApp({ projectId: PROJECT_ID });
    }
    _db = admin.firestore();
  }
  return _db;
}

const COLLECTION = 'shops';
const VISITED_STORES = 'visited_stores';
const LEGACY_VISITED_BY_EMAIL = 'gonzalo@voren.com.mx';
const BATCH_SIZE = 400;
const VISITED_BACKFILL_CHUNK = 500;

function parseNumber(val) {
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function parseInteger(val) {
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

/**
 * HTTP-triggered function to import the merged CSV from Firebase Storage into Firestore.
 *
 * Usage: GET /importCsv?file=csvs/merged_mexico_2026-03-05.csv
 *
 * Query params:
 *   file  — Storage object path (default: csvs/merged.csv)
 *   clear — set to "true" to delete the existing /shops collection first
 */
export const importCsv = onRequest(
  { timeoutSeconds: 540, memory: '1GiB' },
  async (req, res) => {
    // Verify Firebase Auth ID token — only authenticated users may trigger imports
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized: missing Bearer token' });
      return;
    }
    let decoded;
    try {
      decoded = await getAuth().verifyIdToken(authHeader.split('Bearer ')[1]);
    } catch {
      res.status(403).json({ error: 'Forbidden: invalid or expired token' });
      return;
    }
    const callerEmail = decoded.email?.toLowerCase()?.trim();
    if (!callerEmail || !allowedImportEmailSet.has(callerEmail)) {
      res.status(403).json({ error: 'Forbidden: account not authorized for import' });
      return;
    }

    const filePath = req.query.file || 'csvs/merged.csv';
    const clearFirst = req.query.clear === 'true';

    try {
      // 1. Download CSV from Storage
      const bucket = getStorage().bucket();
      const file = bucket.file(filePath);
      const [exists] = await file.exists();
      if (!exists) {
        res.status(404).json({ error: `File not found in Storage: ${filePath}` });
        return;
      }

      const [contents] = await file.download();
      const csvText = contents.toString('utf8');

      // 2. Parse CSV
      const { data: rows, errors } = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
      });

      if (errors.length > 0) {
        console.warn('CSV parse warnings:', errors.slice(0, 5));
      }

      console.log(`Parsed ${rows.length} rows from ${filePath}`);

      // 3. Optionally clear existing documents
      if (clearFirst) {
        console.log('Clearing existing /shops collection...');
        const existing = await getDb().collection(COLLECTION).listDocuments();
        const deleteBatches = [];
        for (let i = 0; i < existing.length; i += BATCH_SIZE) {
          const batch = getDb().batch();
          existing.slice(i, i + BATCH_SIZE).forEach((ref) => batch.delete(ref));
          deleteBatches.push(batch.commit());
        }
        await Promise.all(deleteBatches);
        console.log(`Deleted ${existing.length} documents`);
      }

      // 4. Map rows to Firestore documents
      const documents = rows
        .filter((row) => row.Latitude && row.Longitude)
        .map((row) => ({
          name: row['Name'] || '',
          company_name: row['Company Name'] || '',
          shop_type: row['Shop Type'] || '',
          street: row['Street'] || '',
          street_number: row['Street Number'] || '',
          interior_number: row['Interior Number'] || '',
          neighborhood: row['Neighborhood'] || '',
          formatted_address: row['Full Address'] || '',
          zip: row['Zip'] || '',
          locality: row['Locality'] || '',
          municipality: row['Municipality'] || '',
          state: row['State'] || '',
          country: row['Country'] || 'Mexico',
          phone: row['Phone'] || '',
          email: row['Email'] || '',
          website: row['Website'] || '',
          latitude: parseNumber(row['Latitude']),
          longitude: parseNumber(row['Longitude']),
          location: new GeoPoint(
            parseNumber(row['Latitude']),
            parseNumber(row['Longitude'])
          ),
          rating: parseNumber(row['Google Rating']),
          review_count: parseInteger(row['Review Count']),
          business_status: row['Business Status'] || '',
          business_hours: row['Business Hours'] || '',
          employee_range: row['Employee Range'] || '',
          scian_description: row['SCIAN Activity'] || '',
          google_maps_url: row['Google Maps URL'] || '',
          source: row['Data Source'] || '',
          denue_id: row['DENUE ID'] || '',
          google_place_id: row['Google Place ID'] || '',
          purchases: parseInteger(row['purchases']) ?? parseInteger(row['Purchases']) ?? null,
          average_order: parseNumber(row['average order']) ?? parseNumber(row['Average Order']) ?? null,
          imported_at: new Date().toISOString(),
        }));

      console.log(`Writing ${documents.length} valid documents to Firestore...`);

      // 5. Batch write in chunks of BATCH_SIZE
      let written = 0;
      for (let i = 0; i < documents.length; i += BATCH_SIZE) {
        const batch = getDb().batch();
        const chunk = documents.slice(i, i + BATCH_SIZE);
        chunk.forEach((doc) => {
          const ref = getDb().collection(COLLECTION).doc();
          batch.set(ref, doc);
        });
        await batch.commit();
        written += chunk.length;
        console.log(`  Written ${written}/${documents.length}`);
      }

      res.json({
        success: true,
        file: filePath,
        parsed: rows.length,
        written: documents.length,
        skipped: rows.length - documents.length,
      });
    } catch (err) {
      console.error('importCsv error:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

/**
 * One-time backfill: merge `visitedByEmail` for legacy "visitada" documents that lack it.
 * Same auth as importCsv: Authorization: Bearer <Firebase ID token>.
 *
 * Response: { success, updated, skipped, totalVisitada }
 */
export const backfillVisitedByEmail = onRequest(
  { timeoutSeconds: 300, memory: '512MiB' },
  async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized: missing Bearer token' });
      return;
    }
    let decoded;
    try {
      decoded = await getAuth().verifyIdToken(authHeader.split('Bearer ')[1]);
    } catch {
      res.status(403).json({ error: 'Forbidden: invalid or expired token' });
      return;
    }
    const callerEmail = decoded.email?.toLowerCase()?.trim();
    if (!callerEmail || !allowedImportEmailSet.has(callerEmail)) {
      res.status(403).json({ error: 'Forbidden: account not authorized' });
      return;
    }

    try {
      const snapshot = await getDb()
        .collection(VISITED_STORES)
        .where('status', '==', 'visitada')
        .get();

      const refs = [];
      snapshot.docs.forEach((d) => {
        const v = d.data().visitedByEmail;
        if (v == null || String(v).trim() === '') {
          refs.push(d.ref);
        }
      });

      const totalVisitada = snapshot.size;
      const skipped = totalVisitada - refs.length;
      let updated = 0;

      for (let i = 0; i < refs.length; i += VISITED_BACKFILL_CHUNK) {
        const batch = getDb().batch();
        const chunk = refs.slice(i, i + VISITED_BACKFILL_CHUNK);
        chunk.forEach((ref) => {
          batch.set(
            ref,
            { visitedByEmail: LEGACY_VISITED_BY_EMAIL },
            { merge: true }
          );
        });
        await batch.commit();
        updated += chunk.length;
        console.log(
          `backfillVisitedByEmail: committed ${updated}/${refs.length}`
        );
      }

      res.json({
        success: true,
        updated,
        skipped,
        totalVisitada,
      });
    } catch (err) {
      console.error('backfillVisitedByEmail error:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ── Helpers shared by syncToOdoo and reconcileOdoo ────────────────────────

function getOdooConfig() {
  return {
    url:    ODOO_URL.value(),
    db:     ODOO_DB.value(),
    apiKey: ODOO_API_KEY.value(),
  };
}

async function syncShopToOdoo(shopId, visitedData) {
  const db = getDb();

  // Fetch the corresponding shop document for address / contact fields
  const shopSnap = await db.collection(COLLECTION).doc(shopId).get();
  const shopData = shopSnap.exists ? shopSnap.data() : {};

  const config = getOdooConfig();
  const { leadId, action } = await createOrUpdateLead(config, shopId, visitedData, shopData);

  // Write the Odoo lead ID back to Firestore for idempotency tracking
  await db.collection(VISITED_STORES).doc(shopId).set(
    { odoo_lead_id: String(leadId), odoo_sync_error: null, odoo_synced_at: new Date().toISOString() },
    { merge: true }
  );

  console.log(`syncShopToOdoo: ${action} lead ${leadId} for shop ${shopId}`);
  return { leadId, action };
}

// ── Real-time sync: triggers whenever a visited_stores doc is written ─────

// Fields written back by the sync function itself — changes to only these
// fields must be skipped to prevent an infinite trigger loop.
const SYNC_META_FIELDS = new Set(['odoo_lead_id', 'odoo_sync_error', 'odoo_synced_at']);

function onlySyncMetaChanged(before, after) {
  const allKeys = new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after || {}),
  ]);
  for (const key of allKeys) {
    if (SYNC_META_FIELDS.has(key)) continue;
    if (JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key])) return false;
  }
  return true;
}

/**
 * Firestore trigger: creates or updates an Odoo CRM lead on any meaningful
 * change to a visited_stores document.
 *
 * - If a lead already exists (odoo_lead_id set): updates it with latest data.
 * - If no lead yet and visited_status = 'visita_exitosa': creates it.
 * - Skips writes that only touched sync-metadata (prevents infinite loop).
 * - Skips shops not yet marked exitosa and with no existing lead.
 */
export const syncToOdoo = onDocumentWritten(
  { document: 'visited_stores/{shopId}', secrets: [ODOO_URL, ODOO_DB, ODOO_API_KEY] },
  async (event) => {
    const shopId = event.params.shopId;
    const after  = event.data?.after?.data();
    const before = event.data?.before?.data();

    console.log(`syncToOdoo fired for shop ${shopId}, visited_status=${after?.visited_status}, odoo_lead_id=${after?.odoo_lead_id}`);

    // Skip writes triggered by the function's own sync-metadata updates
    if (onlySyncMetaChanged(before, after)) {
      console.log(`syncToOdoo: skipping shop ${shopId} — only sync metadata changed`);
      return;
    }

    const wasExitosa = before?.visited_status === 'visita_exitosa';
    const isExitosa  = after?.visited_status  === 'visita_exitosa';
    const leadId     = before?.odoo_lead_id ?? after?.odoo_lead_id;
    const hasLead    = !!leadId;

    // Unmarked from exitosa and had an Odoo lead → delete it
    if (wasExitosa && !isExitosa && hasLead) {
      console.log(`syncToOdoo: deleting lead ${leadId} for shop ${shopId} — unmarked as exitosa`);
      try {
        await deleteLead(getOdooConfig(), leadId);
        await getDb().collection(VISITED_STORES).doc(shopId).set(
          { odoo_lead_id: null, odoo_synced_at: null, odoo_sync_error: null },
          { merge: true }
        );
        console.log(`syncToOdoo: lead ${leadId} deleted for shop ${shopId}`);
      } catch (err) {
        console.error(`syncToOdoo failed to delete lead ${leadId} for shop ${shopId}:`, err);
        await getDb().collection(VISITED_STORES).doc(shopId).set(
          { odoo_sync_error: err.message },
          { merge: true }
        );
      }
      return;
    }

    if (!hasLead && !isExitosa) {
      console.log(`syncToOdoo: skipping shop ${shopId} — no lead and not exitosa`);
      return;
    }

    try {
      await syncShopToOdoo(shopId, after);
    } catch (err) {
      console.error(`syncToOdoo failed for shop ${shopId}:`, err);
      await getDb().collection(VISITED_STORES).doc(shopId).set(
        { odoo_sync_error: err.message, odoo_synced_at: null },
        { merge: true }
      );
    }
  }
);

// ── One-time forced re-sync: updates ALL visita_exitosa leads in Odoo ─────

/**
 * HTTP-triggered function that re-syncs every visita_exitosa store to Odoo,
 * regardless of whether they already have an odoo_lead_id. Use this after
 * adding new fields to fieldMap.js to backfill existing leads.
 *
 * Same auth as importCsv: Authorization: Bearer <Firebase ID token>
 * Response: { success, synced, failed, total }
 */
export const forceResyncAllToOdoo = onRequest(
  {
    timeoutSeconds: 540,
    memory: '512MiB',
    secrets: [ODOO_URL, ODOO_DB, ODOO_API_KEY],
  },
  async (req, res) => {
    if (req.query.secret !== 'voren-resync-2026') {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const db = getDb();
    const snapshot = await db
      .collection(VISITED_STORES)
      .where('visited_status', '==', 'visita_exitosa')
      .get();

    console.log(`forceResyncAllToOdoo: ${snapshot.size} visita_exitosa docs to sync`);

    let synced = 0;
    let failed = 0;

    for (const docSnap of snapshot.docs) {
      const shopId = docSnap.id;
      try {
        await syncShopToOdoo(shopId, docSnap.data());
        synced++;
      } catch (err) {
        console.error(`forceResyncAllToOdoo failed for shop ${shopId}:`, err);
        await db.collection(VISITED_STORES).doc(shopId).set(
          { odoo_sync_error: err.message },
          { merge: true }
        );
        failed++;
      }
    }

    console.log(`forceResyncAllToOdoo complete: ${synced} synced, ${failed} failed`);
    res.json({ success: true, total: snapshot.size, synced, failed });
  }
);

// ── Daily reconciliation: catches any docs that syncToOdoo missed ─────────

/**
 * Runs every day at 08:00 Mexico City time (UTC-6).
 * Queries visited_stores where visited_status == 'visita_exitosa' and
 * odoo_lead_id is missing or a previous sync_error was recorded, then
 * syncs each one to Odoo.
 */
export const reconcileOdoo = onSchedule(
  {
    schedule: 'every day 08:00',
    timeZone: 'America/Mexico_City',
    secrets: [ODOO_URL, ODOO_DB, ODOO_API_KEY],
  },
  async () => {
    const db = getDb();

    // Find all visita_exitosa docs that are not yet synced or had an error
    const snapshot = await db
      .collection(VISITED_STORES)
      .where('visited_status', '==', 'visita_exitosa')
      .get();

    const pending = snapshot.docs.filter((d) => {
      const data = d.data();
      return !data.odoo_lead_id || data.odoo_sync_error;
    });

    console.log(`reconcileOdoo: ${pending.length} docs to sync out of ${snapshot.size} visita_exitosa`);

    let synced = 0;
    let failed = 0;

    for (const docSnap of pending) {
      const shopId = docSnap.id;
      try {
        await syncShopToOdoo(shopId, docSnap.data());
        synced++;
      } catch (err) {
        console.error(`reconcileOdoo failed for shop ${shopId}:`, err);
        await db.collection(VISITED_STORES).doc(shopId).set(
          { odoo_sync_error: err.message },
          { merge: true }
        );
        failed++;
      }
    }

    console.log(`reconcileOdoo complete: ${synced} synced, ${failed} failed`);
  }
);
