import { PrismaClient } from '@prisma/client';

const databaseUrl = process.env.DATABASE_URL;
if (process.env.NODE_ENV === 'production' || !databaseUrl) throw new Error('Local seeding requires a non-production local DATABASE_URL.');
const target = new URL(databaseUrl);
if (!['localhost', '127.0.0.1', '::1'].includes(target.hostname) || target.pathname !== '/devx_store_dev') {
  throw new Error('Refusing to seed a database other than the isolated local devx_store_dev database.');
}

const prisma = new PrismaClient();
const categories = [
  { id: 'local-books', name: 'كتب تجريبية محلية', sort: 10 },
  { id: 'local-apparel', name: 'ملابس تجريبية محلية', sort: 20 },
  { id: 'local-stationery', name: 'قرطاسية تجريبية محلية', sort: 30 },
];

async function main() {
  for (const category of categories) {
    await prisma.category.upsert({ where: { id: category.id }, update: {}, create: category });
  }

  const products = [
    { legacyId: 'local-fiction-001', categoryId: 'local-books', name: 'رواية مدينة الورق — عينة محلية', description: 'منتج خيالي للاختبار المحلي فقط.', price: 15000, salePrice: 12000, size: '', color: '', stock: 20, image: '/products/b1.jpg' },
    { legacyId: 'local-shirt-001', categoryId: 'local-apparel', name: 'قميص المطور — عينة محلية', description: 'قميص تجريبي بمقاسات وألوان للاختبار.', price: 25000, salePrice: null, size: 'M', color: 'كحلي', stock: 8, image: '/products/o1.jpg' },
    { legacyId: 'local-notebook-001', categoryId: 'local-stationery', name: 'دفتر الأفكار — عينة محلية', description: 'دفتر خيالي للاختبار المحلي فقط.', price: 8000, salePrice: null, size: '', color: 'أزرق', stock: 35, image: '/products/n1.jpg' },
  ];
  for (const item of products) {
    const product = await prisma.product.upsert({
      where: { legacyId: item.legacyId },
      update: {},
      create: {
        legacyId: item.legacyId, categoryId: item.categoryId, name: item.name, description: item.description,
        price: item.price, salePrice: item.salePrice, active: true,
      },
    });
    await prisma.productVariant.upsert({
      where: { productId_size_color: { productId: product.id, size: item.size, color: item.color } },
      update: {},
      create: { productId: product.id, size: item.size, color: item.color, stock: item.stock },
    });
    const image = await prisma.productImage.findFirst({ where: { productId: product.id, url: item.image } });
    if (!image) await prisma.productImage.create({ data: { productId: product.id, url: item.image, alt: item.name, sort: 0 } });
  }

  await prisma.paymentMethodConfig.upsert({
    where: { code: 'COD' },
    update: {},
    create: { code: 'COD', name: 'الدفع عند الاستلام', description: 'نقدًا عند التسليم', enabled: true, sort: 0, status: 'READY' },
  });
  console.log('Local fictional sample catalog and COD configuration are ready.');
}

main().catch(() => { console.error('Local seed failed; check the database schema, generated Prisma client, and local database availability.'); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
