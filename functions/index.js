import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, GeoPoint } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getAuth } from 'firebase-admin/auth';
import Papa from 'papaparse';

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();
const COLLECTION = 'shops';
const BATCH_SIZE = 400;

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
    try {
      await getAuth().verifyIdToken(authHeader.split('Bearer ')[1]);
    } catch {
      res.status(403).json({ error: 'Forbidden: invalid or expired token' });
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
        const existing = await db.collection(COLLECTION).listDocuments();
        const deleteBatches = [];
        for (let i = 0; i < existing.length; i += BATCH_SIZE) {
          const batch = db.batch();
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
        const batch = db.batch();
        const chunk = documents.slice(i, i + BATCH_SIZE);
        chunk.forEach((doc) => {
          const ref = db.collection(COLLECTION).doc();
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
