import { onRequest } from 'firebase-functions/v2/https';
import { onDocumentWritten, onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import admin from 'firebase-admin';
import { GeoPoint } from 'firebase-admin/firestore';
import Papa from 'papaparse';
import {
  buildCrmSnapshot,
  buildWeeklySnapshot,
  generateWeeklyInsights,
  generateCumulativeInsights,
} from './crmInsights.js';
import { applyMovement } from './inventory.js';
import { publishItemToCatalog } from './catalog.js';
import { findDuplicates, chooseKeeper } from './dedupe.js';
import extraAllowedEmails from './allowed-google-emails.json' with { type: 'json' };

const getAuth    = () => admin.auth();
const getStorage = () => admin.storage();

const PROJECT_ID =
  process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'voren-map';

// ── Secrets ───────────────────────────────────────────────────────────────
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

const ALLOWED_DOMAIN = 'voren.com.mx';
const EXTRA_ALLOWED = new Set(extraAllowedEmails.map((e) => e.toLowerCase().trim()));
function isAllowedEmail(email) {
  if (typeof email !== 'string') return false;
  const normalized = email.toLowerCase().trim();
  return normalized.endsWith(`@${ALLOWED_DOMAIN}`) || EXTRA_ALLOWED.has(normalized);
}

/**
 * Reads the Firebase ID token from the `__session` cookie. Firebase Hosting
 * rewrites to functions strip the Authorization header (and every cookie except
 * `__session`), so same-origin ERP calls carry the token here instead.
 */
function getSessionToken(req) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === '__session') {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}

/**
 * Verifies a Firebase ID token and enforces the @voren.com.mx domain. The token
 * comes from the Authorization header (direct calls / local dev) or, when the
 * request is proxied through Hosting, from the `__session` cookie. Returns the
 * decoded token, or writes an error response and returns null.
 */
async function verifyCaller(req, res) {
  const authHeader = req.headers.authorization;
  const idToken = authHeader?.startsWith('Bearer ')
    ? authHeader.split('Bearer ')[1]
    : getSessionToken(req);
  if (!idToken) {
    res.status(401).json({ error: 'Unauthorized: missing credentials' });
    return null;
  }
  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(idToken);
  } catch {
    res.status(403).json({ error: 'Forbidden: invalid or expired token' });
    return null;
  }
  const callerEmail = decoded.email?.toLowerCase()?.trim();
  if (!callerEmail || !isAllowedEmail(callerEmail)) {
    res.status(403).json({ error: 'Forbidden: account not authorized' });
    return null;
  }
  return decoded;
}

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
    if (!(await verifyCaller(req, res))) return;

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

      // 5. Resolve target doc for each row to AVOID duplicates on re-import.
      // Priority: google_place_id -> denue_id -> name+municipality+phone(10).
      // Existing docs are matched and merged (CRM/pipeline fields preserved).
      const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const phone10 = (s) => {
        const d = String(s || '').replace(/\D/g, '');
        return d.length >= 10 ? d.slice(-10) : '';
      };

      const existingSnap = await getDb()
        .collection(COLLECTION)
        .select('google_place_id', 'denue_id', 'name', 'municipality', 'phone')
        .get();
      const byPlace = new Map();
      const byDenue = new Map();
      const byComposite = new Map();
      existingSnap.forEach((d) => {
        const pid = d.get('google_place_id');
        const did = d.get('denue_id');
        const ph = phone10(d.get('phone'));
        if (pid) byPlace.set(pid, d.id);
        if (did) byDenue.set(did, d.id);
        if (ph) byComposite.set(`${norm(d.get('name'))}|${norm(d.get('municipality'))}|${ph}`, d.id);
      });

      const resolved = new Map(); // docId -> document (last row wins for same key)
      let newCount = 0;
      let matchedCount = 0;
      for (const doc of documents) {
        const ph = phone10(doc.phone);
        const composite = ph ? `${norm(doc.name)}|${norm(doc.municipality)}|${ph}` : '';
        let id = null;
        if (doc.google_place_id && byPlace.has(doc.google_place_id)) id = byPlace.get(doc.google_place_id);
        else if (doc.denue_id && byDenue.has(doc.denue_id)) id = byDenue.get(doc.denue_id);
        else if (composite && byComposite.has(composite)) id = byComposite.get(composite);

        if (id) {
          matchedCount++;
        } else {
          id = getDb().collection(COLLECTION).doc().id;
          newCount++;
          if (doc.google_place_id) byPlace.set(doc.google_place_id, id);
          if (doc.denue_id) byDenue.set(doc.denue_id, id);
          if (composite) byComposite.set(composite, id);
        }
        resolved.set(id, doc);
      }

      // 6. Batch write (merge) in chunks of BATCH_SIZE
      const entries = [...resolved.entries()];
      let written = 0;
      for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const batch = getDb().batch();
        entries.slice(i, i + BATCH_SIZE).forEach(([id, doc]) => {
          batch.set(getDb().collection(COLLECTION).doc(id), doc, { merge: true });
        });
        await batch.commit();
        written += Math.min(BATCH_SIZE, entries.length - i);
        console.log(`  Written ${written}/${entries.length}`);
      }

      res.json({
        success: true,
        file: filePath,
        parsed: rows.length,
        written: entries.length,
        new: newCount,
        updated: matchedCount,
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
    if (!(await verifyCaller(req, res))) return;

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

// ── Anti-duplicados: evita guardar tiendas repetidas ───────────────────────

/**
 * Cuando se CREA una tienda en `shops`, comprueba si ya existe otra con el
 * mismo teléfono, la misma dirección, o el mismo nombre a menos de 150 m.
 * Si es duplicado, conserva el registro original (más antiguo / más completo)
 * y elimina el recién creado (y su lead en `visited_stores`, si lo tuviera).
 *
 * Funciona para cualquier vía de alta: importCsv, alta manual, etc.
 */
export const evitarDuplicadoTienda = onDocumentCreated(
  { document: 'shops/{shopId}' },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const id = event.params.shopId;
    const cand = snap.data();
    if (!cand) return;

    try {
      const dups = await findDuplicates(getDb(), cand, id);
      if (dups.length === 0) return;

      const keeperId = chooseKeeper([{ id, data: cand }, ...dups]);
      if (keeperId === id) return; // este doc es el que se conserva; los otros se auto-eliminan

      // Red de seguridad: nunca borrar una tienda que ya tiene una visita
      // registrada (visited_status). Evita destruir un lead real por un falso
      // positivo del detector de duplicados.
      const leadSnap = await getDb().collection(VISITED_STORES).doc(id).get();
      if (leadSnap.exists && leadSnap.data()?.visited_status) {
        console.warn(
          `evitarDuplicadoTienda: ${id} parece duplicado de ${keeperId} pero tiene visita registrada; NO se elimina.`
        );
        return;
      }

      const motivo = dups[0].on;
      await getDb().collection(COLLECTION).doc(id).delete();
      await getDb().collection(VISITED_STORES).doc(id).delete().catch(() => {});
      console.warn(
        `evitarDuplicadoTienda: ${id} es duplicado por ${motivo} de ${keeperId}; eliminado.`
      );
    } catch (err) {
      console.error('evitarDuplicadoTienda error:', err);
    }
  }
);

// ── CRM: initialize a lead's pipeline stage on first successful visit ───────

/**
 * When a store is marked `visita_exitosa` and has no pipeline stage yet, seed
 * `pipeline_stage='nuevo'` so it enters the CRM pipeline automatically. Also
 * stamps `crm_updated_at` on meaningful changes. Guards against infinite loops
 * by only writing when a change is actually needed.
 */
export const inicializarLeadCrm = onDocumentWritten(
  { document: 'visited_stores/{shopId}' },
  async (event) => {
    const shopId = event.params.shopId;
    const after = event.data?.after?.data();
    if (!after) return;

    const isExitosa = after.visited_status === 'visita_exitosa';
    if (!isExitosa) return;
    if (after.pipeline_stage) return; // already in the pipeline

    await getDb().collection(VISITED_STORES).doc(shopId).set(
      {
        pipeline_stage: 'nuevo',
        crm_updated_at: new Date().toISOString(),
      },
      { merge: true }
    );
    console.log(`inicializarLeadCrm: lead ${shopId} -> etapa 'nuevo'`);
  }
);

// ── CRM AI insights (Anthropic Opus) ───────────────────────────────────────

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Weekly "what did we do" report over the last 7 days. Stored in
 * `crm_semanal/{YYYY-MM-DD}`.
 */
async function runWeeklyInsights() {
  const db = getDb();
  const sinceMs = Date.now() - WEEK_MS;
  const snapshot = await buildWeeklySnapshot(db, sinceMs);
  const { modelo, insights } = await generateWeeklyInsights(ANTHROPIC_API_KEY.value(), snapshot);

  const fecha = new Date().toISOString().slice(0, 10);
  const payload = {
    generadoEn: new Date().toISOString(),
    modelo,
    estadisticas: snapshot,
    insights,
  };
  await db.collection('crm_semanal').doc(fecha).set(payload, { merge: true });
  return payload;
}

/**
 * Cumulative report produced by LLM-merging the previous cumulative report with
 * the latest weekly one (no full historical re-analysis). Current pipeline
 * totals are attached via a cheap aggregation (no extra LLM call) so the health
 * pills stay accurate. Stored in `crm_acumulado/{YYYY-MM-DD}`.
 */
async function runCumulativeInsights(weeklyPayload) {
  const db = getDb();
  const fecha = new Date().toISOString().slice(0, 10);

  // Previous cumulative = latest doc from a *different* day, so same-day
  // regenerations don't double-count semanasIncluidas.
  const prevSnap = await db
    .collection('crm_acumulado')
    .orderBy('generadoEn', 'desc')
    .limit(2)
    .get();
  const prevDoc = prevSnap.docs.find((d) => d.id !== fecha);
  const prevInsights = prevDoc ? prevDoc.data().insights || null : null;

  const weeklyForMerge = {
    ventana: weeklyPayload.estadisticas?.ventana,
    insights: weeklyPayload.insights,
    numeros: {
      actividad: weeklyPayload.estadisticas?.actividad,
      leadsTocados: weeklyPayload.estadisticas?.leadsTocados?.total,
      nuevos: weeklyPayload.estadisticas?.leadsTocados?.nuevos,
      ganados: weeklyPayload.estadisticas?.ganados?.total,
      perdidos: weeklyPayload.estadisticas?.perdidos?.total,
      valorGanado: weeklyPayload.estadisticas?.ganados?.valorEstimado,
    },
  };

  const { modelo, insights } = await generateCumulativeInsights(
    ANTHROPIC_API_KEY.value(),
    prevInsights,
    weeklyForMerge
  );

  // Cheap full aggregation (no LLM) for accurate current totals.
  const estadisticas = await buildCrmSnapshot(db);

  const payload = {
    generadoEn: new Date().toISOString(),
    modelo,
    estadisticas,
    insights,
  };
  await db.collection('crm_acumulado').doc(fecha).set(payload, { merge: true });
  return payload;
}

/**
 * On-demand CRM analysis via Firestore job queue. The ERP "Regenerar" button
 * creates a doc here; procesarAnalisisCrmJob runs the analysis server-side.
 * Avoids HTTP/IAM issues with private functions under Domain Restricted Sharing.
 */
export const procesarAnalisisCrmJob = onDocumentCreated(
  {
    document: 'crm_analysis_jobs/{jobId}',
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: 300,
    memory: '512MiB',
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const ref = snap.ref;
    const data = snap.data();
    if (data?.status !== 'pending') return;

    await ref.update({ status: 'running', startedAt: new Date().toISOString() });
    try {
      const semanal = await runWeeklyInsights();
      const acumulado = await runCumulativeInsights(semanal);
      await ref.update({
        status: 'done',
        finishedAt: new Date().toISOString(),
        semanalFecha: semanal.generadoEn?.slice(0, 10),
        acumuladoFecha: acumulado.generadoEn?.slice(0, 10),
      });
    } catch (err) {
      console.error('procesarAnalisisCrmJob error:', err);
      await ref.update({
        status: 'error',
        error: err.message,
        finishedAt: new Date().toISOString(),
      });
    }
  }
);

/**
 * Legacy HTTP endpoint (curl / direct calls). Auth: Bearer token or __session
 * cookie. The ERP UI uses the Firestore job queue instead (see above).
 */
export const generarAnalisisCrm = onRequest(
  {
    timeoutSeconds: 300,
    memory: '512MiB',
    secrets: [ANTHROPIC_API_KEY],
    cors: true,
    // Private: public (allUsers) invoker fails under Domain Restricted Sharing.
    // ERP Hosting rewrites /api/generarAnalisisCrm → this function instead.
    invoker: 'private',
  },
  async (req, res) => {
    if (!(await verifyCaller(req, res))) return;
    try {
      const semanal = await runWeeklyInsights();
      const acumulado = await runCumulativeInsights(semanal);
      res.json({ success: true, semanal, acumulado });
    } catch (err) {
      console.error('generarAnalisisCrm error:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

/**
 * Weekly CRM analysis — Mondays 08:00 Mexico City time. Produces the weekly
 * report and updates the cumulative report.
 */
export const analisisCrmProgramado = onSchedule(
  {
    schedule: 'every monday 08:00',
    timeZone: 'America/Mexico_City',
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: 300,
    memory: '512MiB',
  },
  async () => {
    try {
      const semanal = await runWeeklyInsights();
      const acumulado = await runCumulativeInsights(semanal);
      console.log(
        `analisisCrmProgramado: semanal+acumulado guardados (${acumulado.modelo})`
      );
    } catch (err) {
      console.error('analisisCrmProgramado error:', err);
    }
  }
);

// ── Inventory (Almacen) ─────────────────────────────────────────────────────

/**
 * Applies each new inventory movement to the per-warehouse stock row in a
 * transaction. Movements are an immutable ledger; stock is derived here.
 */
export const aplicarMovimientoInventario = onDocumentCreated(
  { document: 'inventory_movements/{movId}' },
  async (event) => {
    const mov = event.data?.data();
    if (!mov) return;
    try {
      const result = await applyMovement(getDb(), mov);
      await event.data.ref.set(
        { aplicado: true, aplicado_en: new Date().toISOString(), resultado: result },
        { merge: true }
      );
      console.log(
        `aplicarMovimientoInventario: ${mov.tipo} ${mov.cantidad} de ${mov.itemId} en ${mov.almacenId} -> ${result.nueva}`
      );
    } catch (err) {
      console.error('aplicarMovimientoInventario error:', err);
      await event.data.ref.set(
        { aplicado: false, error: err.message },
        { merge: true }
      );
    }
  }
);

/**
 * Publishes a public-safe catalog mirror when a sellable item or its stock
 * changes. Currently a stub: it computes the public payload and logs it. Wire
 * the cross-project write once the e-commerce Firebase project exists.
 */
export const publicarCatalogo = onDocumentWritten(
  { document: 'inventory_items/{itemId}' },
  async (event) => {
    const itemId = event.params.itemId;
    const after = event.data?.after?.data();
    try {
      await publishItemToCatalog(getDb(), itemId, after);
    } catch (err) {
      console.error('publicarCatalogo error:', err);
    }
  }
);
