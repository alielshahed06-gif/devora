import { notFound } from 'next/navigation';
import { searchProducts, SORTS, type SortKey } from '../../../lib/catalog';
import { Empty, ProductGrid } from '../../../components/ProductCard';
import Image from 'next/image';
import { getPublicCatalog, getPublicCategory } from '../../../server/catalog';

type P = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: Pick<P, 'params'>) { const c = await getPublicCategory((await params).id); return { title: `${c?.name ?? 'القسم'} — Dev-X Book Store` }; }

export default async function CategoryPage({ params, searchParams }: P) {
  const id = (await params).id;
  const [c, catalog] = await Promise.all([getPublicCategory(id), getPublicCatalog()]);
  if (!c) notFound();
  const sp = await searchParams, s = Array.isArray(sp.sort) ? sp.sort[0] : sp.sort;
  const sort = (SORTS.some(([k]) => k === s) ? s : '') as SortKey;
  const list = searchProducts(catalog.products, { category: c.id, sort });
  return (
    <>
      <section className="category-intro">
        {c.imageUrl && <div className="category-cover"><Image src={c.imageUrl} alt={c.name} fill sizes="(max-width: 700px) 96px, 140px" unoptimized={c.imageUrl.startsWith('https://')} /></div>}
        <div><h1>{c.name}</h1>{c.description && <p>{c.description}</p>}</div>
      </section>
      <form className="filters" action="" method="get"><div><label htmlFor="s">الترتيب</label><select id="s" name="sort" defaultValue={sort}>{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div><button className="btn" type="submit">تطبيق</button></form>
      {list.length ? <ProductGrid list={list} /> : <Empty title="لا توجد منتجات في هذا القسم" text="سيتم إضافة منتجات قريبًا." href="/categories" action="كل الأقسام" />}
    </>
  );
}
