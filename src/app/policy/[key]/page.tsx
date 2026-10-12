import { notFound } from 'next/navigation';
import { policies } from '../../../lib/catalog';

type P = { params: Promise<{ key: string }> };
export async function generateMetadata({ params }: P) { const p = policies[(await params).key]; return { title: `${p?.title ?? 'السياسات'} — Dev-X Book Store` }; }

export default async function PolicyPage({ params }: P) {
  const p = Object.prototype.hasOwnProperty.call(policies, (await params).key) ? policies[(await params).key] : null;
  if (!p) notFound();
  return <div className="card"><h1>{p.title}</h1>{p.text.split('\n').map((l, i) => <p key={i}>{l}</p>)}</div>;
}
