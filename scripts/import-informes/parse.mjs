import mammoth from 'mammoth';
import path from 'node:path';

export function stripAccents(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
export function norm(s) {
  return stripAccents((s || '').toLowerCase()).replace(/\s+/g, ' ').trim();
}

// Map a numbered heading title -> canonical section key (accent/number tolerant).
const SECTION_MAP = [
  [/contexto/, 'contexto'],
  [/marcas de refacc/, 'marcas_refacciones'],
  [/marcas de moto/, 'marcas_motos'],
  [/tipo de servicios/, 'servicios'],
  [/refaccion/, 'refacciones_rotacion'],
  [/perfil/, 'perfil'],
  [/proveedor/, 'proveedores'],
  [/pain|problemas/, 'pain_points'],
  [/oportunidad/, 'oportunidades'],
  [/volumen/, 'volumen_compra'],
  [/observaciones/, 'observaciones'],
  [/probabilidad/, 'probabilidad_venta'],
  [/seguimiento/, 'seguimiento'],
];

function classifyHeading(title) {
  const t = norm(title);
  if (t.includes('informacion del negocio')) return 'header';
  for (const [re, key] of SECTION_MAP) if (re.test(t)) return key;
  return null;
}

export function dateFromFilename(file) {
  const m = path.basename(file).match(/^(\d{2})_(\d{2})_(\d{4})\.docx$/i);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`; // YYYY-MM-DD
}

export function phone10(s) {
  const d = (s || '').replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-10) : null;
}

function parseHeaderBlock(block) {
  const get = (labelRe) => {
    const m = block.match(new RegExp(labelRe + '\\s*:?\\s*(.+)', 'i'));
    return m && m[1] ? m[1].trim() : '';
  };
  const nombre = get('nombre del negocio');
  const direccion = get('direcci[oó]n');
  const contacto_cargo = get('cargo');
  const persona_entrevistada = get('persona entrevistad[ao]') || get('persona entrevista');
  const whatsapp = get('whatsapp');

  // Contact person "Nombre:" (exclude "Nombre del negocio")
  let contacto_nombre = '';
  const nm = block.match(/(?:^|\n)\s*nombre\s*:\s*(?!del negocio)(.+)/i);
  if (nm) contacto_nombre = nm[1].trim();

  // "Contacto principal: X" inline
  const cp = block.match(/contacto(?:\s+principal)?\s*:\s*(.+)/i);
  const contacto_principal = cp && cp[1] ? cp[1].trim() : '';
  if (!contacto_nombre && contacto_principal && !/^\s*$/.test(contacto_principal)) {
    contacto_nombre = contacto_principal;
  }

  const telefonos = [...block.matchAll(/tel[eé]fono\s*:\s*(.+)/ig)]
    .map((m) => m[1].trim())
    .filter((t) => t && !/sin contacto|no lo proporciona|no proporciona|no hay/i.test(t));

  return { nombre, direccion, contacto_nombre, contacto_cargo, persona_entrevistada, whatsapp, telefonos };
}

const ALCALDIAS = [
  'alvaro obregon', 'azcapotzalco', 'benito juarez', 'coyoacan', 'cuajimalpa',
  'cuauhtemoc', 'gustavo a madero', 'iztacalco', 'iztapalapa', 'magdalena contreras',
  'miguel hidalgo', 'milpa alta', 'tlahuac', 'tlalpan', 'venustiano carranza', 'xochimilco',
];

export function municipalityFromAddress(direccion) {
  const n = norm(direccion);
  for (const a of ALCALDIAS) if (n.includes(a)) return a;
  return null;
}

function parseRecord(recordText) {
  const lines = recordText.split(/\r?\n/);
  const headingRe = /^\s*(\d{1,2})[.)]\s*(.+?)\s*$/;
  const headings = [];
  lines.forEach((ln, i) => {
    const m = ln.match(headingRe);
    if (m) headings.push({ i, num: +m[1], title: m[2], key: classifyHeading(m[2]) });
  });

  const sections = {};
  let headerBlock = '';
  for (let h = 0; h < headings.length; h++) {
    const start = headings[h].i;
    const end = h + 1 < headings.length ? headings[h + 1].i : lines.length;
    const key = headings[h].key;
    if (key === 'header') {
      headerBlock = lines.slice(start, end).join('\n');
      continue;
    }
    if (!key) continue;
    const inline = headings[h].title.includes(':')
      ? headings[h].title.split(':').slice(1).join(':').trim()
      : '';
    const body = [inline, ...lines.slice(start + 1, end)].map((s) => s.trim()).filter(Boolean).join('\n').trim();
    sections[key] = sections[key] ? `${sections[key]}\n${body}` : body;
  }

  const header = parseHeaderBlock(headerBlock || recordText);
  return { negocio: header, ...sections, raw_text: recordText.trim() };
}

export async function parseDocx(file) {
  const { value: text } = await mammoth.extractRawText({ path: file });
  const startRe = /(?:^|\n)[ \t]*\d{1,2}[.)]\s*Informaci[oó]n del negocio/gi;
  const idxs = [];
  let m;
  while ((m = startRe.exec(text)) !== null) {
    // push index at the digit (skip leading newline)
    const at = m.index + (text[m.index] === '\n' ? 1 : 0);
    idxs.push(at);
  }
  if (idxs.length === 0) return [];
  const records = [];
  for (let k = 0; k < idxs.length; k++) {
    const slice = text.slice(idxs[k], k + 1 < idxs.length ? idxs[k + 1] : text.length);
    const rec = parseRecord(slice);
    if (rec.negocio?.nombre) records.push(rec);
  }
  return records;
}
