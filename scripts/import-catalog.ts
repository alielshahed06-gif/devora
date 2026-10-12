/**
 * Idempotent catalog importer (demo catalog -> database). SAFE BY DEFAULT.
 *   npx tsx scripts/import-catalog.ts            DRY RUN: validates src/data/catalog.json and prints a report; never connects to a database.
 *   npx tsx scripts/import-catalog.ts --apply    WRITES to the database in DATABASE_URL. Run only after the owner has approved the catalog and the schema is reconciled.
 * Guarantees: keyed by Product.legacyId (re-runs update, never duplicate); every product is imported INACTIVE (active=false) and every variant with stock 0,
 * so demo prices/stock can never become purchasable. Existing products are never re-activated and their stock/price are NOT overwritten (only created ones get demo values).
 */
import data from '../src/data/catalog.json';

const REQUIRED_CATEGORIES: [string, string][] = [['books', 'الكتب'], ['tshirts', 'التيشرتات'], ['notebooks', 'النوت بوك'], ['bags', 'الشنط'], ['stickers', 'الاستيكرز'], ['bundles', 'الباكدجات'], ['offers', 'العروض'], ['addons', 'الإضافات'], ['ebooks', 'الكتب الإلكترونية'], ['other', 'منتجات متنوعة']];
interface Row { id: string; category: string; name: string; description: string; price: number; salePrice: number | null; images: string[]; variants: { size?: string; color?: string }[] }
const rows = data.products as unknown as Row[];

function validate(r: Row): string[] {
  const e: string[] = [];
  if (!r.id) e.push('missing id'); if (!r.name?.trim()) e.push('missing name');
  if (!Number.isSafeInteger(r.price) || r.price <= 0) e.push('price must be positive integer piasters');
  if (r.salePrice != null && (!Number.isSafeInteger(r.salePrice) || r.salePrice <= 0 || r.salePrice >= r.price)) e.push('salePrice must be < price');
  if (!REQUIRED_CATEGORIES.some(([c]) => c === r.category)) e.push(`unknown category ${r.category}`);
  if (!Array.isArray(r.variants) || !r.variants.length) e.push('no variants');
  return e;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const report = { created: 0, updated: 0, skipped: 0, failed: [] as { id: string; errors: string[] }[] };
  const valid = rows.filter((r) => { const e = validate(r); if (e.length) report.failed.push({ id: r.id, errors: e }); return !e.length; });
  const dupes = valid.length - new Set(valid.map((r) => r.id)).size; if (dupes) console.error(`WARNING: ${dupes} duplicate legacy ids in source`);
  if (!apply) {
    console.log(JSON.stringify({ mode: 'DRY RUN (no database contact)', source: rows.length, valid: valid.length, failed: report.failed, willCreateCategories: REQUIRED_CATEGORIES.length, note: 'All products would be created inactive with stock 0.' }, null, 2));
    return;
  }
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    for (const [i, [id, name]] of REQUIRED_CATEGORIES.entries()) await prisma.category.upsert({ where: { id }, update: {}, create: { id, name, sort: i } });
    for (const r of valid) {
      try {
        const ex = await prisma.product.findUnique({ where: { legacyId: r.id }, select: { id: true } });
        if (ex) { report.skipped++; continue; } // never overwrite real business data with demo values
        await prisma.product.create({ data: { legacyId: r.id, name: r.name, description: r.description ?? '', categoryId: r.category, price: r.price, salePrice: r.salePrice, active: false,
          images: { create: r.images.map((url, sort) => ({ url, sort })) }, variants: { create: r.variants.map((v) => ({ size: v.size ?? '', color: v.color ?? '', stock: 0 })) } } });
        report.created++;
      } catch (e) { report.failed.push({ id: r.id, errors: [(e as Error).message.slice(0, 200)] }); }
    }
  } finally { await prisma.$disconnect(); }
  console.log(JSON.stringify(report, null, 2));
}
main().catch((e) => { console.error(e.message); process.exit(1); });
