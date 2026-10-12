import Link from 'next/link';
import Image from 'next/image';
import { discountPct, isAvailable, type Product } from '../lib/catalog';
import { formatPriceAr } from '../lib/money';

export function ProductCard({ p }: { p: Product }) {
  const sale = p.salePrice != null, avail = isAvailable(p);
  return (
    <article className="pcard">
      <div className="tags">{sale && <span className="badge off">خصم {discountPct(p)}٪</span>}{!avail && <span className="badge out">غير متاح</span>}</div>
      <Link className="body" href={`/product/${p.id}`}>
        <div className="pimg">{p.images[0] ? <Image src={p.images[0]} alt={p.name} fill sizes="(max-width: 700px) 50vw, (max-width: 1100px) 33vw, 25vw" unoptimized={p.images[0].startsWith('https://')} /> : <span className="muted">لا توجد صورة</span>}</div>
        <div className="pinfo"><h3>{p.name}</h3><div><span className={`price${sale ? ' sale' : ''}`}>{formatPriceAr(p.salePrice ?? p.price)}</span>{sale && <span className="old">{formatPriceAr(p.price)}</span>}</div></div>
      </Link>
    </article>
  );
}

export function ProductGrid({ list }: { list: Product[] }) {
  return <div className="grid">{list.map((p) => <ProductCard key={p.id} p={p} />)}</div>;
}

export function Empty({ title, text, href, action }: { title: string; text: string; href?: string; action?: string }) {
  return <div className="empty"><div className="big" aria-hidden="true">📦</div><h3>{title}</h3><p>{text}</p>{href && <Link className="btn" href={href}>{action}</Link>}</div>;
}
