import { prisma } from '@/lib/prisma';
import { categories as demoCategories, getCategory, getProduct, policies, products as demoProducts, tiers as demoTiers, type Category, type Product } from '@/lib/catalog';

export interface PublicCatalog {
  categories: Category[];
  products: Product[];
  tiers: { min: number; rate: number }[];
  demo: boolean;
}

export function shouldUseDemoCatalog(sourceValue: string | undefined, nodeEnv: string | undefined, databaseUrl: string | undefined): boolean {
  const source = sourceValue ?? 'auto';
  if (!['auto', 'database', 'demo'].includes(source)) throw new Error('CATALOG_SOURCE must be auto, database, or demo.');
  if (source === 'demo' && nodeEnv === 'production') {
    throw new Error('The demo catalog is disabled in production; set CATALOG_SOURCE=database.');
  }
  return source === 'demo' || (source === 'auto' && nodeEnv !== 'production' && !databaseUrl);
}

export const isDemoCatalogEnabled = () => shouldUseDemoCatalog(process.env.CATALOG_SOURCE, process.env.NODE_ENV, process.env.DATABASE_URL);

function toProduct(p: {
  id: string; categoryId: string; name: string; description: string; price: number; salePrice: number | null; createdAt: Date;
  images: { url: string }[]; variants: { size: string; color: string; priceOverride: number | null; stock: number }[];
}): Product {
  return {
    id: p.id,
    category: p.categoryId,
    name: p.name,
    description: p.description,
    price: p.price,
    salePrice: p.salePrice,
    images: p.images.map((image) => image.url),
    createdAt: p.createdAt.toISOString(),
    variants: p.variants.map((variant) => ({
      size: variant.size || undefined,
      color: variant.color || undefined,
      price: variant.priceOverride ?? undefined,
      stock: variant.stock,
    })),
  };
}

export async function getPublicCatalog(): Promise<PublicCatalog> {
  if (isDemoCatalogEnabled()) {
    return { categories: demoCategories, products: demoProducts, tiers: demoTiers, demo: true };
  }

  const [dbCategories, dbProducts, dbTiers] = await Promise.all([
    prisma.category.findMany({ where: { active: true }, orderBy: { sort: 'asc' }, select: { id: true, name: true, description: true, imageUrl: true } }),
    prisma.product.findMany({
      where: { active: true, category: { is: { active: true } } },
      include: { images: { orderBy: { sort: 'asc' } }, variants: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.discountTier.findMany({ orderBy: { minTotal: 'asc' } }),
  ]);
  return {
    categories: dbCategories,
    products: dbProducts.map(toProduct),
    tiers: dbTiers.map((tier) => ({ min: tier.minTotal, rate: tier.ratePct })),
    demo: false,
  };
}

export async function getPublicProduct(id: string): Promise<Product | undefined> {
  if (isDemoCatalogEnabled()) return getProduct(id);
  const product = await prisma.product.findFirst({
    where: { active: true, category: { is: { active: true } }, OR: [{ id }, { legacyId: id }] },
    include: { images: { orderBy: { sort: 'asc' } }, variants: true },
  });
  return product ? toProduct(product) : undefined;
}

export async function getPublicCategory(id: string): Promise<Category | undefined> {
  if (isDemoCatalogEnabled()) return getCategory(id);
  return (await prisma.category.findFirst({ where: { id, active: true }, select: { id: true, name: true, description: true, imageUrl: true } })) ?? undefined;
}

export { policies };
