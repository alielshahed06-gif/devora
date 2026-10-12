import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getPublicCategory, getPublicProduct } from '../../../server/catalog';
import { AddToCart } from '../../../components/AddToCart';

type P = { params: Promise<{ id: string }> };
export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: P) { const p = await getPublicProduct((await params).id); return { title: p ? `${p.name} — Dev-X Book Store` : 'منتج — Dev-X Book Store' }; }

export default async function ProductPage({ params }: P) {
  const p = await getPublicProduct((await params).id);
  if (!p) notFound();
  const cat = await getPublicCategory(p.category);
  return (
    <div className="layout2">
      <div className="card"><div className="pimg big">{p.images[0] ? <Image src={p.images[0]} alt={p.name} width={800} height={800} sizes="(max-width: 900px) 100vw, 50vw" priority unoptimized={p.images[0].startsWith('https://')} style={{ width: '100%', height: 'auto', borderRadius: 12 }} /> : <div className="empty">لا توجد صورة لهذا المنتج</div>}</div></div>
      <div className="card">
        {cat && <p className="muted"><Link href={`/category/${cat.id}`}>{cat.name}</Link></p>}
        <h1>{p.name}</h1>
        {p.description && <p>{p.description}</p>}
        <AddToCart product={p} />
      </div>
    </div>
  );
}
