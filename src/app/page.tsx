import Link from 'next/link';
import Image from 'next/image';
import { isAvailable, searchProducts } from '../lib/catalog';
import { formatPriceAr } from '../lib/money';
import { HeroScene } from '../components/HeroScene';
import { ProductGrid } from '../components/ProductCard';
import { Icon } from '../components/Icon';
import { getPublicCatalog } from '../server/catalog';
import { getStorefrontSettings } from '../server/storefront-settings';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [catalog, storefront] = await Promise.all([getPublicCatalog(), getStorefrontSettings()]);
  const newest = searchProducts(catalog.products, { sort: 'newest' });
  const offers = newest.filter((p) => p.salePrice != null && isAvailable(p)).slice(0, 8);
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <h1>{storefront.homeTitle}</h1>
          <p>{storefront.homeDescription}</p>
          <div className="actions">
            <Link className="btn cta main" href="/categories"><Icon name="grid" /><span>تسوّق دلوقتي</span></Link>
            <Link className="btn cta alt" href="/search?offers=1"><Icon name="tag" /><span>العروض والخصومات</span></Link>
          </div>
        </div>
        <HeroScene />
      </section>
      <div className="strip"><b>خصم على إجمالي طلبك:</b> {[...catalog.tiers].sort((a, b) => a.min - b.min).map((t) => <span className="chip" key={t.min}><em>{t.rate}٪</em> من {formatPriceAr(t.min)}</span>)}</div>
      <div className="sec-head"><h2>الأقسام</h2></div>
      <div className="grid cats">{catalog.categories.map((c) => {
        const cover = catalog.products.find((p) => p.category === c.id && p.images[0]);
        const imageUrl = c.imageUrl ?? cover?.images[0];
        return <Link key={c.id} className="cat" href={`/category/${c.id}`}>{imageUrl ? <span className="ico ph"><Image src={imageUrl} alt="" fill sizes="68px" unoptimized={imageUrl.startsWith('https://')} /></span> : <span className="ico"><Icon name={c.id} /></span>}<span>{c.name}{c.description && <small>{c.description}</small>}</span></Link>;
      })}</div>
      {offers.length > 0 && <><div className="sec-head"><h2>العروض</h2><Link href="/search?offers=1">عرض الكل</Link></div><ProductGrid list={offers} /></>}
      <div className="sec-head"><h2>أحدث المنتجات</h2><Link href="/search?sort=newest">عرض الكل</Link></div>
      <ProductGrid list={newest.slice(0, 8)} />
    </>
  );
}
