/**
 * Creates `visited_stores` leads (+ their `informes` subdoc) for the businesses
 * that have an informe but exist in NEITHER `shops` NOR `visited_stores`.
 *
 * Mirrors the field structure written by import.mjs so the new leads behave
 * exactly like imported ones in the CRM/Clientes views.
 *
 * DRY-RUN by default; pass --apply to write. Idempotent: uses a deterministic
 * doc id (informe_<slug>) so re-running merges instead of duplicating.
 *
 * Usage: node add-missing-leads.mjs [--apply]
 * Requires ADC (gcloud auth application-default login as an @voren.com.mx user).
 */
import fs from 'node:fs';
import path from 'node:path';
import admin from 'firebase-admin';
import { norm } from './parse.mjs';
import { loadIndex, matchRecord, getDb } from './match.mjs';

const APPLY = process.argv.includes('--apply');
const OUT_DIR = path.join(process.cwd(), 'out');
const DRYRUN = path.join(OUT_DIR, 'dryrun.json');
const VENDEDOR_EMAIL = 'gonzalo@voren.com.mx';

// Alcaldia (normalized) -> display form matching existing municipality values.
const MUNI_DISPLAY = {
  'alvaro obregon': 'Álvaro Obregón', azcapotzalco: 'Azcapotzalco', 'benito juarez': 'Benito Juárez',
  coyoacan: 'Coyoacán', cuajimalpa: 'Cuajimalpa', cuauhtemoc: 'Cuauhtémoc',
  'gustavo a madero': 'Gustavo A. Madero', iztacalco: 'Iztacalco', iztapalapa: 'Iztapalapa',
  'magdalena contreras': 'La Magdalena Contreras', 'miguel hidalgo': 'Miguel Hidalgo',
  'milpa alta': 'Milpa Alta', tlahuac: 'Tláhuac', tlalpan: 'Tlalpan',
  'venustiano carranza': 'Venustiano Carranza', xochimilco: 'Xochimilco',
};

function slug(s) {
  return norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'sin-nombre';
}

// The real alcaldía appears near the END of the address (before the postal code
// / city), so pick the LAST-occurring match. Avoids picking a street named after
// an alcaldía (e.g. "Av. Benito Juarez" in an Iztapalapa address).
function bestMuni(direccion) {
  const n = norm(direccion);
  let best = null;
  let bestIdx = -1;
  for (const a of Object.keys(MUNI_DISPLAY)) {
    const idx = n.lastIndexOf(a);
    if (idx > bestIdx) { bestIdx = idx; best = a; }
  }
  return best ? MUNI_DISPLAY[best] : null;
}

// First usable phone from the informe (raw form kept for display/matching).
function firstPhone(rec) {
  const t = (rec.negocio?.telefonos || []).find((x) => /\d{7,}/.test(String(x)));
  return t || null;
}

// Extract a 1..10 sale-probability score from free text, if present.
function probScore(rec) {
  const m = String(rec.probabilidad_venta || '').match(/\b(10|[1-9])\b/);
  return m ? Number(m[1]) : null;
}

function tsFromFecha(fecha) {
  if (!fecha) return null;
  const m = String(fecha).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return admin.firestore.Timestamp.fromDate(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

async function main() {
  if (!fs.existsSync(DRYRUN)) {
    console.error(`No existe ${DRYRUN}. Corre primero: node import.mjs`);
    process.exit(1);
  }
  const records = JSON.parse(fs.readFileSync(DRYRUN, 'utf8')).map((r) => r.rec).filter(Boolean);

  console.log('Cargando shops y visited_stores desde Firestore…');
  const [shopsIdx, visitedIdx] = await Promise.all([loadIndex('shops'), loadIndex('visited_stores')]);
  console.log(`shops: ${shopsIdx.shops.length} | visited_stores: ${visitedIdx.shops.length}`);

  const missing = records.filter((rec) => {
    const mShops = matchRecord(rec, shopsIdx);
    const mVisited = matchRecord(rec, visitedIdx);
    return !mShops.shopId && !mVisited.shopId;
  });
  console.log(`\nNegocios a crear (no existen en ninguna colección): ${missing.length}\n`);

  const db = getDb();
  let created = 0;
  for (const rec of missing) {
    const nombre = rec.negocio?.nombre || 'SIN NOMBRE';
    const id = `informe_${slug(nombre)}`;
    const municipality = bestMuni(rec.negocio?.direccion);
    const phone = firstPhone(rec);

    const lead = {
      userId: null,
      shopId: id,
      name: nombre,
      company_name: '',
      shop_type: 'Repair',
      source: 'informe_import',
      latitude: null,
      longitude: null,
      formatted_address: rec.negocio?.direccion || null,
      street: null,
      municipality,
      state: 'Ciudad de México',
      phone,
      website: null,
      status: 'visitada',
      visited_status: 'visita_exitosa',
      visitedAt: tsFromFecha(rec.fecha),
      statusAt: admin.firestore.FieldValue.serverTimestamp(),
      visitedByEmail: VENDEDOR_EMAIL,
      crm_owner_email: VENDEDOR_EMAIL,
      pipeline_stage: 'nuevo',
      crm_updated_at: new Date().toISOString(),
      responsable_compras_nombre: rec.negocio?.contacto_nombre || rec.negocio?.persona_entrevistada || null,
      responsable_compras_telefono: phone,
      score_probabilidad: probScore(rec),
    };

    const informeId = (rec.fecha ? `${rec.fecha}_` : 'gonzalo_') + slug(nombre);
    const informe = {
      fecha: rec.fecha || null,
      fuente: rec.fuente,
      vendedor_email: VENDEDOR_EMAIL,
      negocio: rec.negocio,
      contexto: rec.contexto || '',
      perfil: rec.perfil || '',
      servicios: rec.servicios || '',
      marcas_motos: rec.marcas_motos || '',
      marcas_refacciones: rec.marcas_refacciones || '',
      refacciones_rotacion: rec.refacciones_rotacion || '',
      proveedores: rec.proveedores || '',
      pain_points: rec.pain_points || '',
      oportunidades: rec.oportunidades || '',
      volumen_compra: rec.volumen_compra || '',
      observaciones: rec.observaciones || '',
      probabilidad_venta: rec.probabilidad_venta || '',
      seguimiento: rec.seguimiento || '',
      raw_text: rec.raw_text,
      match: { metodo: 'no_match_creado', score: 0 },
      importado_en: admin.firestore.FieldValue.serverTimestamp(),
    };

    console.log(`- ${nombre}  [${rec.fecha || rec.fuente}]  tel:${phone || '—'}  muni:${municipality || '—'}  -> visited_stores/${id}`);
    if (APPLY) {
      await db.collection('visited_stores').doc(id).set(lead, { merge: true });
      await db.collection('visited_stores').doc(id).collection('informes').doc(informeId).set(informe, { merge: true });
      created++;
    }
  }

  if (!APPLY) {
    console.log('\n[DRY-RUN] No se escribió nada. Ejecuta con --apply para crear los leads.');
  } else {
    console.log(`\n[APPLY] Listo. Leads creados/actualizados: ${created}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
