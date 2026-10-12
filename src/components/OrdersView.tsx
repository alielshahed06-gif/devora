'use client';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { dt, ORDER_STATUS_AR, PAYMENT_METHOD_AR, PAYMENT_STATUS_AR } from '../lib/labels';
import { formatPriceAr } from '../lib/money';
import { Empty } from './ProductCard';
import { Icon } from './Icon';

interface Row { id: string; number: number; status: string; paymentStatus: string; paymentMethod: string; total: number; createdAt: string }
export function OrdersList() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  useEffect(() => { void api<{ orders: Row[] }>('/api/v1/orders').then((r) => { if (r.ok) setRows(r.data.orders); else if (r.status === 401) setNeedLogin(true); else setRows([]); }); }, []);
  if (needLogin) return <div className="card"><h1>طلباتي</h1><p>سجّل الدخول لعرض طلباتك.</p><Link className="btn" href="/login?next=/orders">تسجيل الدخول</Link></div>;
  if (!rows) return <div className="spin" role="status">جاري التحميل…</div>;
  if (!rows.length) return <Empty title="لا توجد طلبات بعد" text="ستظهر طلباتك هنا بعد إتمام أول طلب." href="/categories" action="تصفّح الأقسام" />;
  return <div className="card"><h1>طلباتي</h1><div className="tblwrap"><table className="t"><thead><tr><th>رقم الطلب</th><th>التاريخ</th><th>الحالة</th><th>الدفع</th><th>الإجمالي</th></tr></thead><tbody>
    {rows.map((o) => <tr key={o.id}><td><Link href={`/orders/${o.id}`}>DX-{o.number}</Link></td><td>{dt(o.createdAt)}</td><td>{ORDER_STATUS_AR[o.status] ?? o.status}</td><td>{PAYMENT_STATUS_AR[o.paymentStatus] ?? o.paymentStatus}</td><td>{formatPriceAr(o.total)}</td></tr>)}
  </tbody></table></div></div>;
}

interface Detail extends Row { items: { id: string; name: string; size: string; color: string; qty: number; lineSale: number }[]; history: { id: string; status: string; at: string }[]; deliveryMethod: string; subtotalOriginal: number; productDiscounts: number; tierDiscount: number; couponDiscount: number; shippingFee: number }
const MANUAL = ['FAWRY', 'INSTAPAY', 'WALLET', 'VODAFONE_CASH', 'ORANGE_CASH', 'ETISALAT_CASH'];

export function OrderDetail({ id }: { id: string }) {
  const [o, setO] = useState<Detail | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'login' | 'missing'>('loading');
  const [msg, setMsg] = useState<{ t: 'ok' | 'err'; s: string } | null>(null);
  const placed = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('placed') === '1';
  const load = () => api<{ order: Detail }>(`/api/v1/orders/${id}`).then((r) => { if (r.ok) { setO(r.data.order); setState('ready'); } else setState(r.status === 401 ? 'login' : 'missing'); });
  useEffect(() => { void load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function sendRef(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setMsg(null);
    const f = new FormData(e.currentTarget);
    const r = await api(`/api/v1/orders/${id}/payment`, { method: 'POST', body: { reference: String(f.get('reference') ?? ''), senderPhone: String(f.get('senderPhone') ?? '') } });
    if (r.ok) { setMsg({ t: 'ok', s: 'تم استلام بيانات التحويل وهي قيد المراجعة. لا يُعتبر الطلب مدفوعًا قبل التحقق.' }); void load(); } else setMsg({ t: 'err', s: r.message });
  }
  if (state === 'loading') return <div className="spin" role="status">جاري التحميل…</div>;
  if (state === 'login') return <div className="card"><p>سجّل الدخول لعرض الطلب.</p><Link className="btn" href={`/login?next=/orders/${id}`}>تسجيل الدخول</Link></div>;
  if (state === 'missing' || !o) return <Empty title="الطلب غير موجود" text="تأكد من الرابط." href="/orders" action="طلباتي" />;
  return (
    <div className="card">
      {placed && <div className="msg ok" role="status"><Icon name="check" /> تم إنشاء طلبك بنجاح.</div>}
      <h1>الطلب DX-{o.number}</h1>
      <p><b>{ORDER_STATUS_AR[o.status] ?? o.status}</b> · {PAYMENT_METHOD_AR[o.paymentMethod] ?? o.paymentMethod} · <b>{PAYMENT_STATUS_AR[o.paymentStatus] ?? o.paymentStatus}</b></p>
      <div className="tblwrap"><table className="t"><tbody>{o.items.map((i) => <tr key={i.id}><td>{i.name}{(i.size || i.color) && <span className="muted"> ({[i.size, i.color].filter(Boolean).join(' · ')})</span>}</td><td>× {i.qty}</td><td>{formatPriceAr(i.lineSale)}</td></tr>)}</tbody></table></div>
      <dl className="summary">
        {o.productDiscounts > 0 && <div className="l save"><span>خصومات المنتجات</span><span>− {formatPriceAr(o.productDiscounts)}</span></div>}
        {o.tierDiscount > 0 && <div className="l save"><span>خصم الإجمالي</span><span>− {formatPriceAr(o.tierDiscount)}</span></div>}
        {o.couponDiscount > 0 && <div className="l save"><span>كود الخصم</span><span>− {formatPriceAr(o.couponDiscount)}</span></div>}
        <div className="l"><span>الشحن</span><span>{formatPriceAr(o.shippingFee)}</span></div>
        <div className="l total"><span>الإجمالي</span><span>{formatPriceAr(o.total)}</span></div>
      </dl>
      {MANUAL.includes(o.paymentMethod) && o.paymentStatus === 'AWAITING_PAYMENT' && o.status !== 'CANCELLED' && (
        <form onSubmit={sendRef}><h3>أرسل بيانات التحويل</h3>
          <label>رقم/مرجع العملية<input name="reference" required minLength={4} maxLength={64} dir="ltr" /></label>
          <label>رقم الموبايل المُحوِّل (اختياري)<input name="senderPhone" inputMode="tel" dir="ltr" /></label>
          <p><button className="btn" type="submit">إرسال للمراجعة</button></p></form>
      )}
      {o.paymentStatus === 'PENDING_REVIEW' && <div className="msg warn" role="status"><Icon name="info" /> دفعتك قيد المراجعة من الفريق.</div>}
      {msg && <div className={`msg ${msg.t}`} role={msg.t === 'err' ? 'alert' : 'status'}>{msg.s}</div>}
      <h3>سجل الحالة</h3><ul>{o.history.map((h) => <li key={h.id}>{ORDER_STATUS_AR[h.status] ?? h.status} — <span className="muted">{dt(h.at)}</span></li>)}</ul>
    </div>
  );
}
