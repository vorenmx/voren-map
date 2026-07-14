/**
 * Read-only detail of the remaining name+municipality lead groups.
 * Shows what each group shares: name / phone / address.
 */
import admin from 'firebase-admin';

admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: 'voren-map' });
const db = admin.firestore();

function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}
function phone10(s) { const d = String(s || '').replace(/\D/g, ''); return d.length >= 10 ? d.slice(-10) : ''; }
function chunk(a, n) { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; }
function addr(shop, l) {
  const parts = [
    shop.formatted_address || l.formatted_address,
    shop.street ? `${shop.street} ${shop.street_number || ''}`.trim() : '',
    shop.neighborhood || l.neighborhood,
  ].filter(Boolean);
  return parts[0] || parts.slice(1).join(', ') || '';
}

async function main() {
  const snap = await db.collection('visited_stores').where('visited_status', '==', 'visita_exitosa').get();
  const leads = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const refs = leads.map((l) => db.collection('shops').doc(l.id));
  const shopById = new Map();
  for (const g of chunk(refs, 300)) {
    const snaps = await db.getAll(...g);
    snaps.forEach((s) => { if (s.exists) shopById.set(s.id, s.data()); });
  }

  const enriched = leads.map((l) => {
    const shop = shopById.get(l.id) || {};
    return {
      id: l.id,
      name: l.name || shop.name || shop.company_name || '',
      phone: l.phone || shop.phone || '',
      municipality: l.municipality || shop.municipality || '',
      address: addr(shop, l),
      owner: l.crm_owner_email || l.visitedByEmail || '',
    };
  });

  const m = new Map();
  for (const e of enriched) {
    const n = norm(e.name);
    if (!n) continue;
    const k = `${n}|${norm(e.municipality)}`;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(e);
  }
  const groups = [...m.entries()].filter(([, v]) => v.length > 1);

  console.log(`\n===== ${groups.length} grupos por nombre+municipio =====`);
  let gi = 0;
  for (const [k, v] of groups) {
    gi++;
    const names = new Set(v.map((e) => norm(e.name)));
    const phones = v.map((e) => phone10(e.phone)).filter(Boolean);
    const phonesSet = new Set(phones);
    const addrs = v.map((e) => norm(e.address)).filter(Boolean);
    const addrsSet = new Set(addrs);

    const sameName = names.size === 1;
    const samePhone = phonesSet.size === 1 && phones.length === v.length;
    const somePhoneShared = phonesSet.size < phones.length && phones.length > 1;
    const sameAddr = addrsSet.size === 1 && addrs.length === v.length;
    const someAddrShared = addrsSet.size < addrs.length && addrs.length > 1;

    const tags = [];
    tags.push(sameName ? 'NOMBRE=igual' : 'NOMBRE=variante');
    if (samePhone) tags.push('TEL=igual');
    else if (somePhoneShared) tags.push('TEL=algunos-iguales');
    else if (phones.length === 0) tags.push('TEL=ninguno');
    else tags.push('TEL=distintos');
    if (sameAddr) tags.push('DIR=igual');
    else if (someAddrShared) tags.push('DIR=algunas-iguales');
    else if (addrs.length === 0) tags.push('DIR=ninguna');
    else tags.push('DIR=distintas');

    const likelyDup = sameName && (samePhone || sameAddr);
    console.log(`\n[${gi}] "${v[0].name}" (${v[0].municipality || 's/municipio'}) x${v.length}  -> ${tags.join(' | ')}  ${likelyDup ? '**PROBABLE DUPLICADO**' : '(probable distinto)'}`);
    v.forEach((e) => console.log(`     - ${e.id} | tel:${phone10(e.phone) || '-'} | dir:${e.address || '-'} | ${e.owner}`));
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e.message || e); process.exit(1); });
