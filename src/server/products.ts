/** Public product view-model: only storefront-safe fields leave the server. */
export const PRODUCT_INCLUDE = { images: { orderBy: { sort: "asc" as const } }, variants: true, category: true };

interface Row {
  id: string; legacyId: string | null; name: string; description: string; price: number; salePrice: number | null; createdAt: Date;
  category: { id: string; name: string }; images: { url: string; alt: string }[]; variants: { id: string; size: string; color: string; priceOverride: number | null; stock: number }[];
}
export const publicProduct = (p: Row) => ({
  id: p.id, legacyId: p.legacyId, name: p.name, description: p.description, price: p.price, salePrice: p.salePrice, createdAt: p.createdAt,
  category: { id: p.category.id, name: p.category.name }, images: p.images.map((i) => ({ url: i.url, alt: i.alt })),
  variants: p.variants.map((v) => ({ id: v.id, size: v.size, color: v.color, price: v.priceOverride, stock: v.stock })),
  inStock: p.variants.some((v) => v.stock > 0),
});
