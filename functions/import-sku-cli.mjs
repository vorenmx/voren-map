/**
 * One-off CLI: import ../data/sku-es.csv → inventory_items (voren-map).
 *
 * Requires Application Default Credentials for voren-map, e.g.:
 *   gcloud auth application-default login   # as hola@voren.com.mx
 *   gcloud config set project voren-map
 *
 * Usage (from functions/):
 *   node import-sku-cli.mjs
 *   node import-sku-cli.mjs --file ../data/sku-es.csv
 *   node import-sku-cli.mjs --clear
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import { importSkuCsv } from './importInventory.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const clearFirst = args.includes('--clear');
const fileIdx = args.indexOf('--file');
const filePath = path.resolve(
  root,
  fileIdx >= 0 && args[fileIdx + 1] ? args[fileIdx + 1] : 'data/sku-es.csv'
);

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

admin.initializeApp({ projectId: 'voren-map' });
const db = admin.firestore();

const csvText = fs.readFileSync(filePath, 'utf8');
console.log(`Importing ${filePath} (clear=${clearFirst})…`);

const result = await importSkuCsv(db, csvText, { clearFirst });
console.log(JSON.stringify({ success: true, ...result }, null, 2));
process.exit(0);
