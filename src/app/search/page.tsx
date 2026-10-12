import { searchProducts, SORTS, type SortKey } from '../../lib/catalog';
import { Empty, ProductGrid } from '../../components/ProductCard';
import { getPublicCatalog } from '../../server/catalog';
export const metadata = { title: 'البحث — Dev-X Book Store' };
export const dynamic = 'force-dynamic';

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

// Server-rendered, plain GET form (works without JS). Filters mirror the original: q, category, sort, available, offers.
export default async function Search({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = one(sp.q).slice(0, 100), category = one(sp.category), offers = one(sp.offers) === '1', available = one(sp.available) === '1';
  const sort = (SORTS.some(([k]) => k === one(sp.sort)) ? one(sp.sort) : '') as SortKey;
  const catalog = await getPublicCatalog();
  const list = searchProducts(catalog.products, { q, category: catalog.categories.some((c) => c.id === category) ? category : '', offers, available, sort });
  return (
    <>
      <h1>{offers ? 'العروض' : 'البحث'}</h1>
      <form className="filters" action="/search" method="get">
        <div><label htmlFor="q">اسم المنتج</label><input id="q" name="q" defaultValue={q} /></div>
        <div><label htmlFor="c">القسم</label><select id="c" name="category" defaultValue={category}><option value="">الكل</option>{catalog.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label htmlFor="s">الترتيب</label><select id="s" name="sort" defaultValue={sort}>{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div><label><input type="checkbox" name="available" value="1" defaultChecked={available} style={{ width: 'auto', minHeight: 0 }} /> المتاح فقط</label><label><input type="checkbox" name="offers" value="1" defaultChecked={offers} style={{ width: 'auto', minHeight: 0 }} /> العروض فقط</label></div>
        <button className="btn" type="submit">تطبيق</button>
      </form>
      {list.length ? <><p className="muted">{list.length} نتيجة</p><ProductGrid list={list} /></> : <Empty title="لا توجد نتائج" text="جرّب كلمات أخرى أو غيّر التصفية." href="/search" action="مسح التصفية" />}
    </>
  );
}
