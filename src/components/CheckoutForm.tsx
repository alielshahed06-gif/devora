'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { PAYMENT_METHOD_AR } from '../lib/labels';
import { formatPriceAr } from '../lib/money';
import { useCart } from './CartProvider';
import { Empty } from './ProductCard';
import { Icon } from './Icon';

interface Quote { ok: boolean; errors: { message: string }[]; lines: { productId: string; name: string; qty: number; size: string | null; color: string | null; lineSale: number }[]; subtotalOriginal: number; productDiscounts: number; tierRate: number; tierDiscount: number; couponDiscount: number; couponError: string | null; shippingFee: number; freeShipping: boolean; total: number }
interface Method { code: string; name: string; description: string }
interface Branch { id: string; name: string; address: string; hours: string }

export function CheckoutForm() {
  const router = useRouter();
  const { cart, loaded, clear } = useCart();
  const [authed, setAuthed] = useState<boolean | undefined>(undefined);
  const [methods, setMethods] = useState<Method[] | null>(null);
  const [methodsError, setMethodsError] = useState('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesError, setBranchesError] = useState('');
  const [delivery, setDelivery] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  const [coupon, setCoupon] = useState('');
  const [couponApplied, setCouponApplied] = useState('');
  const [pay, setPay] = useState('');
  const [q, setQ] = useState<Quote | null>(null);
  const [qErr, setQErr] = useState('');
  const [err, setErr] = useState<{ message: string; details: string[] } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api<{ user: unknown }>('/api/v1/auth/me').then((r) => setAuthed(r.ok && !!r.data.user));
    void api<{ methods: Method[] }>('/api/v1/payment-methods').then((r) => {
      if (!r.ok) { setMethods([]); setMethodsError(r.message); return; }
      setMethods(r.data.methods); if (r.data.methods[0]) setPay(r.data.methods[0].code);
    });
    void api<{ branches: Branch[] }>('/api/v1/branches').then((r) => {
      if (!r.ok) { setBranches([]); setBranchesError(r.message); return; }
      setBranches(r.data.branches);
    });
  }, []);

  const items = useMemo(() => cart.map((i) => ({ productId: i.productId, qty: i.qty, size: i.size, color: i.color })), [cart]);
  useEffect(() => {
    if (!loaded || !items.length) return;
    let live = true;
    void api<{ quote: Quote }>('/api/v1/cart/quote', { method: 'POST', body: { items, couponCode: couponApplied, deliveryMethod: delivery } }).then((r) => {
      if (!live) return;
      if (r.ok) { setQ(r.data.quote); setQErr(''); } else { setQ(null); setQErr(r.message); }
    });
    return () => { live = false; };
  }, [loaded, items, couponApplied, delivery]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!e.currentTarget.reportValidity()) return;
    setBusy(true); setErr(null);
    const f = new FormData(e.currentTarget), s = (k: string) => String(f.get(k) ?? '');
    const r = await api<{ order: { id: string } }>('/api/v1/orders', { method: 'POST', body: { items, couponCode: couponApplied, deliveryMethod: delivery, city: s('city'), address: s('address'), branchId: s('branchId') || null, customerName: s('customerName'), customerPhone: s('customerPhone'), notes: s('notes'), paymentMethod: pay } });
    if (!r.ok) { setBusy(false); setErr({ message: r.status === 401 ? 'انتهت الجلسة، سجّل الدخول من جديد.' : r.message, details: Array.isArray(r.details) ? (r.details as unknown[]).map(String) : [] }); return; }
    clear();
    router.push(`/orders/${r.data.order.id}?placed=1`);
  }

  if (!loaded || authed === undefined || methods === null) return <div className="spin" role="status">جاري التحميل…</div>;
  if (!cart.length) return <Empty title="سلتك فارغة" text="أضف منتجات أولًا." href="/categories" action="تصفّح الأقسام" />;
  if (!authed) return <div className="card"><h1>إتمام الطلب</h1><p>يجب تسجيل الدخول لإتمام الطلب.</p><Link className="btn" href="/login?next=/checkout">تسجيل الدخول</Link> <Link className="btn ghost" href="/register">إنشاء حساب</Link></div>;

  const selected = methods.find((m) => m.code === pay);
  return (
    <form onSubmit={submit} className="layout2" noValidate>
      <div className="card">
        <h1>إتمام الطلب</h1>
        {methodsError && <div className="msg err" role="alert">{methodsError}</div>}
        <label>الاسم<input name="customerName" required minLength={2} maxLength={80} autoComplete="name" /></label>
        <label>رقم الموبايل<input name="customerPhone" required inputMode="tel" autoComplete="tel" dir="ltr" placeholder="01xxxxxxxxx" /></label>
        <fieldset style={{ border: 0, padding: 0, margin: '1rem 0 0' }}><legend><b>طريقة الاستلام</b></legend>
          <label className="radio"><input type="radio" name="dm" checked={delivery === 'DELIVERY'} onChange={() => setDelivery('DELIVERY')} /> توصيل للعنوان</label>
          <label className="radio"><input type="radio" name="dm" checked={delivery === 'PICKUP'} onChange={() => setDelivery('PICKUP')} /> استلام من فرع</label>
        </fieldset>
        {delivery === 'DELIVERY' ? <>
          <label>المدينة / المحافظة<input name="city" required minLength={2} maxLength={80} /></label>
          <label>العنوان بالتفصيل<textarea name="address" required minLength={5} maxLength={300} /></label>
        </> : branches.length ? <label>الفرع<select name="branchId" required>{branches.map((b) => <option key={b.id} value={b.id}>{b.name} — {b.address}</option>)}</select></label>
          : branchesError ? <div className="msg err" role="alert"><Icon name="x" /> {branchesError}</div> : <div className="msg warn"><Icon name="alert" /> لا توجد فروع متاحة للاستلام حاليًا.</div>}
        <label>ملاحظات (اختياري)<textarea name="notes" maxLength={500} /></label>
        <fieldset style={{ border: 0, padding: 0, margin: '1rem 0 0' }}><legend><b>طريقة الدفع</b></legend>
          {methods.length === 0 && <div className="msg warn"><Icon name="alert" /> لا توجد وسائل دفع متاحة حاليًا. حاول لاحقًا.</div>}
          {methods.map((m) => <label className="radio" key={m.code}><input type="radio" name="pm" checked={pay === m.code} onChange={() => setPay(m.code)} /> {PAYMENT_METHOD_AR[m.code] ?? m.name}</label>)}
          {selected && selected.code !== 'COD' && <div className="msg warn" role="status"><Icon name="info" /> {selected.description || 'بعد إنشاء الطلب ستُطلب منك بيانات التحويل، ولا يُعتبر الطلب مدفوعًا حتى يتحقق الفريق من الدفعة.'}</div>}
        </fieldset>
      </div>
      <div>
        <div className="summary"><h3>ملخص الطلب</h3>
          {qErr && <div className="msg err" role="alert"><Icon name="x" /> {qErr}</div>}
          {q && <>
            {q.errors.map((x, i) => <div key={i} className="msg err" role="alert"><Icon name="x" /> {x.message}</div>)}
            <dl>
              {q.lines.map((l) => <div className="l" key={l.productId + (l.size ?? '') + (l.color ?? '')}><span>{l.name} × {l.qty}</span><span>{formatPriceAr(l.lineSale)}</span></div>)}
              {q.productDiscounts > 0 && <div className="l save"><span>خصومات المنتجات</span><span>− {formatPriceAr(q.productDiscounts)}</span></div>}
              {q.tierDiscount > 0 && <div className="l save"><span>خصم إجمالي الطلب ({q.tierRate}٪)</span><span>− {formatPriceAr(q.tierDiscount)}</span></div>}
              {q.couponDiscount > 0 && <div className="l save"><span>كود الخصم</span><span>− {formatPriceAr(q.couponDiscount)}</span></div>}
              <div className="l"><span>الشحن</span><span>{delivery === 'PICKUP' ? 'استلام من الفرع' : q.freeShipping ? 'مجاني' : formatPriceAr(q.shippingFee)}</span></div>
              <div className="l total"><span>المبلغ النهائي</span><span>{formatPriceAr(q.total)}</span></div>
            </dl>
            {q.couponError && <div className="msg err" role="alert">{q.couponError}</div>}
          </>}
          <label>كود الخصم<input value={coupon} onChange={(e) => setCoupon(e.target.value)} maxLength={20} dir="ltr" /></label>
          <div className="rowbtns"><button type="button" className="btn ghost sm" onClick={() => setCouponApplied(coupon.trim().toUpperCase())}>تطبيق</button></div>
          <small className="muted">الأسعار والإجماليات تُحسب على الخادم وهي ما سيُسجَّل في الطلب.</small>
        </div>
        {err && <div className="msg err" role="alert"><Icon name="x" /> {err.message}{err.details.length > 0 && <ul>{err.details.map((d, i) => <li key={i}>{d}</li>)}</ul>}</div>}
        <p><button className="btn" type="submit" disabled={busy || !pay || (delivery === 'PICKUP' && !branches.length) || !q?.ok} style={{ width: '100%' }}>{busy ? 'جاري إنشاء الطلب…' : 'تأكيد الطلب'}</button></p>
      </div>
    </form>
  );
}
