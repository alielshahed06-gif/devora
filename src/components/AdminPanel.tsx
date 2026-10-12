'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { CONFIG_STATUS_AR, dt, NEXT_STATUSES, ORDER_STATUS_AR, PAYMENT_METHOD_AR, PAYMENT_STATUS_AR } from '../lib/labels';
import { formatPriceAr } from '../lib/money';
import { BranchesAdmin, CouponsAdmin, DiscountTiersAdmin, StorefrontSettingsForm } from './AdminModules';

type Tab = 'orders' | 'payments' | 'products' | 'categories' | 'coupons' | 'tiers' | 'branches' | 'settings';
interface OrderRow { id: string; number: number; customerName: string; customerPhone: string; status: string; paymentStatus: string; paymentMethod: string; total: number; createdAt: string }
interface OrderFull extends OrderRow {
  deliveryMethod: string; deliveryCity: string | null; deliveryAddress: string | null; notes: string; couponCode: string | null;
  subtotalOriginal: number; productDiscounts: number; tierDiscount: number; couponDiscount: number; shippingFee: number;
  items: { id: string; name: string; size: string; color: string; qty: number; unitSale: number; lineSale: number }[];
  history: { id: string; status: string; at: string }[];
  payments: { id: string; method: string; reference: string; senderPhone: string; status: string; amount: number }[];
}
interface Cfg { code: string; name: string; enabled: boolean; status: string; integrationNotes: string }
interface Prod { id: string; legacyId: string | null; name: string; description: string; price: number; salePrice: number | null; active: boolean; category: { id: string; name: string }; images: { id: string; url: string; sort: number }[]; variants: { id: string; size: string; color: string; stock: number; priceOverride: number | null }[] }
interface CategoryOption { id: string; name: string; active: boolean; sort: number }
interface CategoryRow extends CategoryOption { description: string; imageUrl: string | null; _count: { products: number } }
const STATUSES = Object.keys(CONFIG_STATUS_AR);

export function AdminPanel() {
  const [role, setRole] = useState<string | null | undefined>(undefined);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [tab, setTab] = useState<Tab>('orders');
  useEffect(() => { void api<{ user: { role: string; mustChangePassword: boolean } | null }>('/api/v1/auth/me').then((r) => { setRole(r.ok ? r.data.user?.role ?? null : null); setMustChangePassword(r.ok && !!r.data.user?.mustChangePassword); }); }, []);
  if (role === undefined) return <div className="spin" role="status">جاري التحميل…</div>;
  if (role !== 'ADMIN' && role !== 'STAFF') return <div className="card"><h1>لوحة الإدارة</h1><p>هذه الصفحة للمصرّح لهم فقط.</p><Link className="btn" href="/login?next=/admin">تسجيل الدخول</Link></div>;
  if (role === 'ADMIN' && mustChangePassword) return <PasswordChange onComplete={() => setMustChangePassword(false)} />;
  return (
    <div className="card">
      <h1>لوحة الإدارة</h1>
      <div className="tabs" role="tablist">{(['orders', 'payments', 'products', 'categories', 'coupons', 'tiers', 'branches', 'settings'] as Tab[]).filter((t) => role === 'ADMIN' || t === 'orders').map((t) => <button key={t} type="button" role="tab" aria-selected={tab === t} className="btn ghost sm" onClick={() => setTab(t)}>{t === 'orders' ? 'الطلبات' : t === 'payments' ? 'وسائل الدفع' : t === 'products' ? 'المنتجات' : t === 'categories' ? 'التصنيفات' : t === 'coupons' ? 'الكوبونات' : t === 'tiers' ? 'شرائح الخصم' : t === 'branches' ? 'الفروع' : 'إعدادات المتجر'}</button>)}</div>
      {tab === 'orders' && <Orders isAdmin={role === 'ADMIN'} />}
      {tab === 'payments' && role === 'ADMIN' && <Payments />}
      {tab === 'products' && role === 'ADMIN' && <Products />}
      {tab === 'categories' && role === 'ADMIN' && <Categories />}
      {tab === 'coupons' && role === 'ADMIN' && <CouponsAdmin />}
      {tab === 'tiers' && role === 'ADMIN' && <DiscountTiersAdmin />}
      {tab === 'branches' && role === 'ADMIN' && <BranchesAdmin />}
      {tab === 'settings' && role === 'ADMIN' && <StoreSettings />}
    </div>
  );
}

function Categories() {
  const [rows, setRows] = useState<CategoryRow[] | null>(null);
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    const result = await api<{ categories: CategoryRow[] }>('/api/v1/admin/categories');
    if (!result.ok) { setMessage(result.message); return; }
    setRows(result.data.categories); setMessage('');
  }, []);
  useEffect(() => {
    let active = true;
    void api<{ categories: CategoryRow[] }>('/api/v1/admin/categories').then((result) => {
      if (!active) return;
      if (!result.ok) { setMessage(result.message); return; }
      setRows(result.data.categories);
    });
    return () => { active = false; };
  }, []);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const result = await api('/api/v1/admin/categories', { method: 'POST', body: {
      id: String(form.get('id') ?? '').trim(), name: String(form.get('name') ?? '').trim(),
      description: String(form.get('description') ?? '').trim(), imageUrl: String(form.get('imageUrl') ?? '').trim() || null,
      sort: Number(form.get('sort') ?? 0), active: form.get('active') === 'on',
    } });
    setMessage(result.ok ? 'تم إنشاء التصنيف.' : result.message);
    if (result.ok) { formElement.reset(); void load(); }
  }
  async function save(event: FormEvent<HTMLFormElement>, category: CategoryRow) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await api(`/api/v1/admin/categories/${encodeURIComponent(category.id)}`, { method: 'PATCH', body: {
      name: String(form.get('name') ?? '').trim(), description: String(form.get('description') ?? '').trim(),
      imageUrl: String(form.get('imageUrl') ?? '').trim() || null, sort: Number(form.get('sort')),
      active: form.get('active') === 'on',
    } });
    setMessage(result.ok ? 'تم حفظ التصنيف.' : result.message);
    if (result.ok) void load();
  }
  if (!rows) return <div className="card"><div className="spin" role="status">جاري تحميل التصنيفات…</div>{message && <div className="msg err" role="alert">{message}</div>}</div>;
  return <>
    {message && <div className={`msg ${message.startsWith('تم') ? 'ok' : 'err'}`} role={message.startsWith('تم') ? 'status' : 'alert'}>{message}</div>}
    <form className="card" onSubmit={(event) => void create(event)}>
      <h2>إضافة تصنيف</h2>
      <div className="filters">
        <label>معرّف ثابت (slug)<input name="id" minLength={2} maxLength={40} pattern="[a-z0-9-]+" required /></label>
        <label>اسم التصنيف<input name="name" minLength={2} maxLength={80} required /></label>
        <label>ترتيب العرض<input name="sort" type="number" min="0" max="100000" step="1" defaultValue="0" /></label>
      </div>
      <label>وصف التصنيف<input name="description" maxLength={500} /></label>
      <label>رابط الصورة (محلي أو HTTPS)<input name="imageUrl" maxLength={1000} /></label>
      <label className="radio"><input type="checkbox" name="active" defaultChecked /> منشور في المتجر</label>
      <button className="btn sm" type="submit">إضافة التصنيف</button>
    </form>
    <h2 className="sec">التصنيفات الحالية</h2>
    {rows.map((category) => <form key={category.id} className="card" style={{ marginBottom: '.8rem' }} onSubmit={(event) => void save(event, category)}>
      <h3>{category.name} <span className={`badge ${category.active ? 'ver' : 'out'}`}>{category.active ? 'منشور' : 'مخفي'}</span></h3>
      <p className="muted">المعرّف: <code>{category.id}</code> · عدد المنتجات: {category._count.products}</p>
      <div className="filters">
        <label>الاسم<input name="name" defaultValue={category.name} minLength={2} maxLength={80} required /></label>
        <label>ترتيب العرض<input name="sort" type="number" min="0" max="100000" step="1" defaultValue={category.sort} required /></label>
      </div>
      <label>الوصف<input name="description" defaultValue={category.description} maxLength={500} /></label>
      <label>رابط الصورة<input name="imageUrl" defaultValue={category.imageUrl ?? ''} maxLength={1000} /></label>
      <label className="radio"><input type="checkbox" name="active" defaultChecked={category.active} /> منشور</label>
      <button className="btn sm" type="submit">حفظ التغييرات</button>
    </form>)}
  </>;
}

function StoreSettings() {
  const [settings, setSettings] = useState<{ shippingFee: number; freeShippingMin: number | null; storefront: {
    storeName: string; logoUrl: string; tagline: string; homeTitle: string; homeDescription: string; announcement: string;
    supportPhone: string; supportTechnicalPhone: string; supportEmail: string; footerText: string; socialLinks: { facebook: string; instagram: string; whatsapp: string };
  } } | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const result = await api<{ settings: NonNullable<typeof settings> }>('/api/v1/admin/settings');
    if (!result.ok) { setMessage(result.message); return; }
    setSettings(result.data.settings); setMessage('');
  }, []);
  useEffect(() => {
    let active = true;
    void api<{ settings: NonNullable<typeof settings> }>('/api/v1/admin/settings').then((result) => {
      if (!active) return;
      if (!result.ok) { setMessage(result.message); return; }
      setSettings(result.data.settings); setMessage('');
    });
    return () => { active = false; };
  }, []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fee = Number(form.get('shippingFee'));
    const thresholdText = String(form.get('freeShippingMin') ?? '').trim();
    const threshold = thresholdText ? Number(thresholdText) : null;
    if (!Number.isFinite(fee) || fee < 0 || (threshold !== null && (!Number.isFinite(threshold) || threshold <= 0))) {
      setMessage('تحقق من رسوم الشحن وحد الشحن المجاني.'); return;
    }
    setBusy(true); setMessage('');
    const result = await api('/api/v1/admin/settings', {
      method: 'PATCH',
      body: { shippingFee: Math.round(fee * 100), freeShippingMin: threshold === null ? null : Math.round(threshold * 100) },
    });
    setBusy(false);
    if (!result.ok) { setMessage(result.message); return; }
    setMessage('تم حفظ الإعدادات وستُستخدم مباشرة في تسعير الطلبات.');
    await load();
  }
  if (!settings) return <div className="card"><div className="spin" role="status">جاري تحميل الإعدادات…</div>{message && <div className="msg err" role="alert">{message}</div>}</div>;
  return <>
    <section className="card">
    <h2>الشحن والتوصيل</h2>
    <p className="muted">تُحفظ المبالغ بالجنيه وتُحوّل إلى قروش صحيحة، وتؤثر مباشرة في عرض السعر وإنشاء الطلب.</p>
    <form onSubmit={(event) => void save(event)}>
      <label className="field">رسوم الشحن (ج.م)<input name="shippingFee" type="number" min="0" step="0.01" defaultValue={settings.shippingFee / 100} required /></label>
      <label className="field">حد الشحن المجاني (ج.م، فارغ لتعطيله)<input name="freeShippingMin" type="number" min="0.01" step="0.01" defaultValue={settings.freeShippingMin === null ? '' : settings.freeShippingMin / 100} /></label>
      {message && <div className={`msg ${message.startsWith('تم') ? 'ok' : 'err'}`} role={message.startsWith('تم') ? 'status' : 'alert'}>{message}</div>}
      <button className="btn" type="submit" disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'حفظ قواعد الشحن'}</button>
    </form>
    </section>
    <StorefrontSettingsForm settings={settings.storefront} />
  </>;
}

function PasswordChange({ onComplete }: { onComplete: () => void }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get('currentPassword') ?? '');
    const newPassword = String(form.get('newPassword') ?? '');
    if (newPassword !== String(form.get('confirmPassword') ?? '')) { setMessage('تأكيد كلمة المرور غير مطابق.'); return; }
    setBusy(true); setMessage('');
    const result = await api('/api/v1/auth/password', { method: 'POST', body: { currentPassword, newPassword } });
    setBusy(false);
    if (!result.ok) { setMessage(result.message); return; }
    onComplete();
  }
  return (
    <section className="card password-rotation">
      <h1>تغيير كلمة مرور المدير</h1>
      <p>هذه خطوة إلزامية قبل استخدام لوحة الإدارة. اختر كلمة مرور جديدة لا تقل عن 12 حرفًا.</p>
      <form onSubmit={(event) => void submit(event)}>
        <label className="field">كلمة المرور الحالية<input name="currentPassword" type="password" autoComplete="current-password" required /></label>
        <label className="field">كلمة المرور الجديدة<input name="newPassword" type="password" minLength={12} maxLength={128} autoComplete="new-password" required /></label>
        <label className="field">تأكيد كلمة المرور الجديدة<input name="confirmPassword" type="password" minLength={12} maxLength={128} autoComplete="new-password" required /></label>
        {message && <div className="msg err" role="alert">{message}</div>}
        <button className="btn" type="submit" disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'حفظ كلمة المرور والمتابعة'}</button>
      </form>
    </section>
  );
}

function Orders({ isAdmin }: { isAdmin: boolean }) {
  const [rows, setRows] = useState<OrderRow[] | null>(null);
  const [sel, setSel] = useState<OrderFull | null>(null);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [query, setQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchApplied, setSearchApplied] = useState({ query: '', from: '', to: '' });
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [loadError, setLoadError] = useState('');
  const [detailError, setDetailError] = useState('');
  const load = useCallback(async () => {
    const params = new URLSearchParams({ ...(filter ? { paymentStatus: filter } : {}), ...(statusFilter ? { status: statusFilter } : {}), ...(searchApplied.query ? { q: searchApplied.query } : {}), ...(searchApplied.from ? { from: searchApplied.from } : {}), ...(searchApplied.to ? { to: searchApplied.to } : {}) });
    const r = await api<{ orders: OrderRow[] }>(`/api/v1/admin/orders?${params}`);
    if (!r.ok) { setRows([]); setLoadError(r.message); return; }
    setRows(r.data.orders); setLoadError('');
  }, [filter, statusFilter, searchApplied]);
  useEffect(() => {
    let live = true;
    const params = new URLSearchParams({ ...(filter ? { paymentStatus: filter } : {}), ...(statusFilter ? { status: statusFilter } : {}), ...(searchApplied.query ? { q: searchApplied.query } : {}), ...(searchApplied.from ? { from: searchApplied.from } : {}), ...(searchApplied.to ? { to: searchApplied.to } : {}) });
    void api<{ orders: OrderRow[] }>(`/api/v1/admin/orders?${params}`).then((r) => {
      if (!live) return;
      if (!r.ok) { setRows([]); setLoadError(r.message); return; }
      setRows(r.data.orders); setLoadError('');
    });
    return () => { live = false; };
  }, [filter, statusFilter, searchApplied]);
  const open = async (id: string) => {
    const r = await api<{ order: OrderFull }>(`/api/v1/admin/orders/${id}`);
    if (!r.ok) { setDetailError(r.message); return; }
    setDetailError(''); setSel(r.data.order);
  };
  async function setStatus(status: string) { if (!sel) return; const r = await api(`/api/v1/admin/orders/${sel.id}`, { method: 'PATCH', body: { status } }); setMsg({ type: r.ok ? 'ok' : 'err', text: r.ok ? 'تم التحديث.' : r.message }); void open(sel.id); void load(); }
  async function review(id: string, decision: 'ACCEPT' | 'REJECT') { if (!sel || !window.confirm(decision === 'ACCEPT' ? 'تأكيد أنك تحققت من وصول المبلغ فعليًا؟' : 'رفض هذه الدفعة؟')) return; const r = await api(`/api/v1/admin/payments/${id}`, { method: 'PATCH', body: { decision } }); setMsg({ type: r.ok ? 'ok' : 'err', text: r.ok ? 'تم.' : r.message }); void open(sel.id); void load(); }
  return <>
    <form className="filters order-filters" onSubmit={(event) => { event.preventDefault(); setSearchApplied({ query, from: fromDate, to: toDate }); }}>
      <label>بحث بالرقم أو العميل<input value={query} onChange={(event) => setQuery(event.target.value)} maxLength={100} placeholder="DX-1001 أو اسم أو هاتف" /></label>
      <label>حالة الطلب<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">كل الحالات</option>{Object.entries(ORDER_STATUS_AR).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>حالة الدفع<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="">كل حالات الدفع</option>{Object.entries(PAYMENT_STATUS_AR).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>من تاريخ<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
      <label>إلى تاريخ<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
      <button className="btn sm" type="submit">تطبيق البحث</button>
    </form>
    {msg && <div className={`msg ${msg.type}`} role={msg.type === 'err' ? 'alert' : 'status'}>{msg.text}</div>}
    {loadError && <div className="msg err" role="alert">{loadError} <button className="btn ghost sm" type="button" onClick={() => void load()}>إعادة المحاولة</button></div>}
    {detailError && <div className="msg err" role="alert">{detailError}</div>}
    {!rows ? <div className="spin" role="status">جاري التحميل…</div> : <div className="tblwrap"><table className="t"><thead><tr><th>#</th><th>العميل</th><th>الحالة</th><th>الدفع</th><th>الإجمالي</th><th /></tr></thead><tbody>
      {rows.map((o) => <tr key={o.id}><td>DX-{o.number}</td><td>{o.customerName}<br /><span className="muted" dir="ltr">{o.customerPhone}</span></td><td>{ORDER_STATUS_AR[o.status]}</td><td>{PAYMENT_METHOD_AR[o.paymentMethod]} · {PAYMENT_STATUS_AR[o.paymentStatus]}</td><td>{formatPriceAr(o.total)}</td><td><button type="button" className="btn ghost sm" onClick={() => void open(o.id)}>فتح</button></td></tr>)}
      {rows.length === 0 && <tr><td colSpan={6}>لا توجد طلبات.</td></tr>}</tbody></table></div>}
    {sel && <div className="card" style={{ marginTop: '1rem' }}>
      <h3>DX-{sel.number} — {dt(sel.createdAt)}</h3>
      <p>{sel.customerName} · <span dir="ltr">{sel.customerPhone}</span></p>
      <p>{sel.deliveryMethod === 'PICKUP' ? 'استلام من الفرع' : `${sel.deliveryCity ?? ''} — ${sel.deliveryAddress ?? ''}`}</p>
      {sel.notes && <p>ملاحظات العميل: {sel.notes}</p>}
      <ul>{sel.items.map((i) => <li key={i.id}>{i.name}{i.size && ` · ${i.size}`}{i.color && ` · ${i.color}`} × {i.qty} — {formatPriceAr(i.unitSale)} للوحدة ({formatPriceAr(i.lineSale)})</li>)}</ul>
      <div className="order-breakdown">
        <div className="l"><span>الإجمالي قبل التخفيض</span><span>{formatPriceAr(sel.subtotalOriginal)}</span></div>
        <div className="l"><span>تخفيض المنتجات والشرائح</span><span>{formatPriceAr(sel.productDiscounts + sel.tierDiscount)}</span></div>
        <div className="l"><span>تخفيض الكوبون {sel.couponCode && `(${sel.couponCode})`}</span><span>{formatPriceAr(sel.couponDiscount)}</span></div>
        <div className="l"><span>الشحن</span><span>{formatPriceAr(sel.shippingFee)}</span></div>
        <div className="l"><b>الإجمالي</b><b>{formatPriceAr(sel.total)}</b></div>
      </div>
      <h4>سجل الحالة</h4><ol>{sel.history.map((entry) => <li key={entry.id}>{ORDER_STATUS_AR[entry.status] ?? entry.status} — {dt(entry.at)}</li>)}</ol>
      <div className="rowbtns">{NEXT_STATUSES[sel.status]?.filter((s) => s !== 'CANCELLED' || (sel.paymentStatus !== 'PAID' && sel.paymentStatus !== 'PENDING_REVIEW')).map((s) => <button key={s} type="button" className={s === 'CANCELLED' ? 'btn secondary sm' : 'btn sm'} onClick={() => void setStatus(s)}>{ORDER_STATUS_AR[s]}</button>)}</div>
      {sel.paymentStatus === 'PAID' && <div className="msg warn">لا يمكن إلغاء طلب مدفوع قبل تنفيذ مسار الاسترداد.</div>}
      {sel.paymentStatus === 'PENDING_REVIEW' && <div className="msg warn">راجع الدفعة المعلّقة قبل إلغاء الطلب.</div>}
      {sel.payments.length > 0 && <><h3>دفعات مُرسلة</h3><ul>{sel.payments.map((p) => <li key={p.id}><span dir="ltr">{p.reference}</span> · {PAYMENT_METHOD_AR[p.method]} · {formatPriceAr(p.amount)} · {p.status}{isAdmin && p.status === 'SUBMITTED' && <span className="rowbtns"><button type="button" className="btn sm" onClick={() => void review(p.id, 'ACCEPT')}>تأكيد الدفع</button><button type="button" className="btn secondary sm" onClick={() => void review(p.id, 'REJECT')}>رفض</button></span>}</li>)}</ul></>}
    </div>}
  </>;
}

function Payments() {
  const [rows, setRows] = useState<Cfg[] | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [loadError, setLoadError] = useState('');
  const load = async () => {
    const r = await api<{ methods: Cfg[] }>('/api/v1/admin/payment-methods');
    if (!r.ok) { setRows([]); setLoadError(r.message); return; }
    setRows(r.data.methods); setLoadError('');
  };
  useEffect(() => {
    let live = true;
    void api<{ methods: Cfg[] }>('/api/v1/admin/payment-methods').then((r) => {
      if (!live) return;
      if (!r.ok) { setRows([]); setLoadError(r.message); return; }
      setRows(r.data.methods); setLoadError('');
    });
    return () => { live = false; };
  }, []);
  async function save(e: FormEvent<HTMLFormElement>, code: string) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    const r = await api(`/api/v1/admin/payment-methods/${code}`, { method: 'PATCH', body: { status: String(f.get('status')), enabled: f.get('enabled') === 'on', integrationNotes: String(f.get('notes') ?? '') } });
    setMsg({ type: r.ok ? 'ok' : 'err', text: r.ok ? 'تم الحفظ.' : r.message }); void load();
  }
  if (!rows) return <div className="spin" role="status">جاري التحميل…</div>;
  return <>
    <div className="msg warn">الدفع عند الاستلام هو الوسيلة المتاحة حاليًا. جميع وسائل الدفع الإلكتروني تظل معطّلة حتى دمج مزوّد حقيقي واختبار التحقق الموقّع من الدفع؛ لا تكفي الملاحظات لتفعيلها.</div>
    {msg && <div className={`msg ${msg.type}`} role={msg.type === 'err' ? 'alert' : 'status'}>{msg.text}</div>}
    {loadError && <div className="msg err" role="alert">{loadError} <button className="btn ghost sm" type="button" onClick={() => void load()}>إعادة المحاولة</button></div>}
    {rows.map((c) => <form key={c.code} onSubmit={(e) => void save(e, c.code)} className="card" style={{ marginBottom: '.8rem' }}>
      <h3>{PAYMENT_METHOD_AR[c.code] ?? c.name}</h3>
      <p className="muted">{c.code === 'COD' ? 'الدفع عند التسليم؛ لا يُسجّل مدفوعًا إلا عند انتقال الطلب إلى تم التسليم.' : 'غير متاحة: لا يوجد ربط مزوّد دفع موثّق ومختبَر.'}</p>
      <label>الحالة<select name="status" defaultValue={c.status}>{STATUSES.filter((s) => c.code === 'COD' || s !== 'READY').map((s) => <option key={s} value={s}>{CONFIG_STATUS_AR[s]}</option>)}</select></label>
      <label className="radio"><input type="checkbox" name="enabled" defaultChecked={c.enabled} /> مفعّلة في المتجر</label>
      <label>ملاحظات التكامل / طريقة التحقق<textarea name="notes" defaultValue={c.integrationNotes} maxLength={2000} /></label>
      <p><button className="btn sm" type="submit">حفظ</button></p></form>)}
  </>;
}

function Products() {
  const [rows, setRows] = useState<Prod[] | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [loadError, setLoadError] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const load = async () => {
    const r = await api<{ products: Prod[] }>('/api/v1/admin/products');
    if (!r.ok) { setRows([]); setLoadError(r.message); return; }
    setRows(r.data.products); setLoadError('');
  };
  useEffect(() => {
    let live = true;
    void api<{ products: Prod[] }>('/api/v1/admin/products').then((r) => {
      if (!live) return;
      if (!r.ok) { setRows([]); setLoadError(r.message); return; }
      setRows(r.data.products); setLoadError('');
    });
    void api<{ categories: CategoryOption[] }>('/api/v1/admin/categories').then((r) => {
      if (!live) return;
      if (!r.ok) { setCategoryError(r.message); return; }
      setCategories(r.data.categories); setCategoryError('');
    });
    return () => { live = false; };
  }, []);
  async function patch(id: string, body: unknown) { const r = await api(`/api/v1/admin/products/${id}`, { method: 'PATCH', body }); setMsg({ type: r.ok ? 'ok' : 'err', text: r.ok ? 'تم الحفظ.' : r.message }); void load(); }
  async function save(e: FormEvent<HTMLFormElement>, p: Prod) {
    e.preventDefault(); const f = new FormData(e.currentTarget), egp = (k: string) => Math.round(Number(f.get(k)) * 100);
    const sale = String(f.get('sale') ?? '').trim();
    const variants: { id?: string; size: string; color: string; stock: number; priceOverride: number | null }[] = p.variants.map((v) => {
      const override = String(f.get(`p_${v.id}`) ?? '').trim();
      return { id: v.id, size: String(f.get(`z_${v.id}`) ?? ''), color: String(f.get(`c_${v.id}`) ?? ''), stock: Number(f.get(`s_${v.id}`)), priceOverride: override ? egpValue(override) : null };
    });
    const size = String(f.get('newSize') ?? '').trim(), color = String(f.get('newColor') ?? '').trim(), stock = String(f.get('newStock') ?? '').trim();
    if ((size || color || stock) && !stock) {
      setMsg({ type: 'err', text: 'أدخل مخزون المتغير الجديد أو امسح بياناته.' });
      return;
    }
    const newPriceOverride = String(f.get('newPriceOverride') ?? '').trim();
    if (stock) variants.push({ size, color, stock: Number(stock), priceOverride: newPriceOverride ? egpValue(newPriceOverride) : null });
    const images = String(f.get('images') ?? '').split(/\r?\n/).map((url) => url.trim()).filter(Boolean);
    await patch(p.id, {
      name: String(f.get('name') ?? ''),
      description: String(f.get('description') ?? ''),
      categoryId: String(f.get('categoryId') ?? ''),
      legacyId: String(f.get('legacyId') ?? '').trim() || null,
      price: egp('price'),
      salePrice: sale ? egp('sale') : null,
      images,
      variants,
    });
  }
  function egpValue(value: string) { return Math.round(Number(value) * 100); }
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form), egp = (key: string) => Math.round(Number(f.get(key)) * 100);
    const sale = String(f.get('sale') ?? '').trim();
    const result = await api('/api/v1/admin/products', {
      method: 'POST',
      body: {
        name: String(f.get('name') ?? ''),
        description: String(f.get('description') ?? ''),
        categoryId: String(f.get('categoryId') ?? ''),
        price: egp('price'),
        salePrice: sale ? egp('sale') : null,
        legacyId: String(f.get('legacyId') ?? '').trim() || null,
        images: String(f.get('images') ?? '').split(/\r?\n/).map((url) => url.trim()).filter(Boolean),
        variants: [{ size: String(f.get('size') ?? ''), color: String(f.get('color') ?? ''), stock: Number(f.get('stock')), priceOverride: String(f.get('priceOverride') ?? '').trim() ? egp('priceOverride') : null }],
      },
    });
    setMsg({ type: result.ok ? 'ok' : 'err', text: result.ok ? 'تم إنشاء المنتج كمسودة؛ راجع السعر والمخزون قبل النشر.' : result.message });
    if (result.ok) { form.reset(); void load(); }
  }
  if (!rows) return <div className="spin" role="status">جاري التحميل…</div>;
  return <>
    {msg && <div className={`msg ${msg.type}`} role={msg.type === 'err' ? 'alert' : 'status'}>{msg.text}</div>}
    {loadError && <div className="msg err" role="alert">{loadError} <button className="btn ghost sm" type="button" onClick={() => void load()}>إعادة المحاولة</button></div>}
    {categoryError && <div className="msg err" role="alert">{categoryError}</div>}
    <form className="card" style={{ marginBottom: '.8rem' }} onSubmit={(e) => void create(e)}>
      <h2>إضافة منتج</h2>
      <div className="filters">
        <div><label>اسم المنتج<input name="name" minLength={2} maxLength={160} required /></label></div>
        <div><label>القسم<select name="categoryId" required disabled={!categories.length}><option value="">اختر قسمًا</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label></div>
        <div><label>السعر (ج.م)<input name="price" type="number" step="0.01" min="0.01" required /></label></div>
        <div><label>سعر التخفيض (اختياري)<input name="sale" type="number" step="0.01" min="0.01" /></label></div>
        <div><label>معرّف قديم (اختياري)<input name="legacyId" maxLength={40} /></label></div>
        <div><label>سعر خاص للمتغير (ج.م، اختياري)<input name="priceOverride" type="number" step="0.01" min="0.01" /></label></div>
        <div><label>المقاس / النوع<input name="size" maxLength={40} /></label></div>
        <div><label>اللون<input name="color" maxLength={40} /></label></div>
        <div><label>المخزون الأولي<input name="stock" type="number" min="0" max="100000" step="1" defaultValue="0" required /></label></div>
      </div>
      <label>الوصف<textarea name="description" maxLength={4000} /></label>
      <label>روابط الصور (رابط محلي أو HTTPS، رابط واحد في كل سطر)<textarea name="images" maxLength={2000} /></label>
      <button className="btn sm" type="submit" disabled={!categories.length}>إنشاء كمسودة</button>
    </form>
    {rows.length === 0 && <div className="msg warn">لا توجد منتجات في قاعدة البيانات بعد. الاستيراد يتم بعد مراجعة واعتماد المالك.</div>}
    {rows.map((p) => <form key={p.id} onSubmit={(e) => void save(e, p)} className="card" style={{ marginBottom: '.8rem' }}>
      <h3>{p.name} <span className={`badge ${p.active ? 'ver' : 'out'}`}>{p.active ? 'منشور' : 'غير منشور'}</span></h3>
      <div className="filters">
        <div><label>اسم المنتج<input name="name" minLength={2} maxLength={160} defaultValue={p.name} required /></label></div>
        <div><label>القسم<select name="categoryId" defaultValue={p.category.id} required>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label></div>
        <div><label>السعر (ج.م)<input name="price" type="number" step="0.01" min="0.01" defaultValue={p.price / 100} required /></label></div>
        <div><label>سعر التخفيض (اختياري)<input name="sale" type="number" step="0.01" min="0.01" defaultValue={p.salePrice != null ? p.salePrice / 100 : ''} /></label></div>
      </div>
      <label>الوصف<textarea name="description" maxLength={4000} defaultValue={p.description} /></label>
      <label>معرّف المنتج (legacy ID)<input name="legacyId" maxLength={40} defaultValue={p.legacyId ?? ''} /></label>
      <label>روابط الصور بالترتيب (رابط محلي أو HTTPS، رابط واحد في كل سطر)<textarea name="images" maxLength={2000} defaultValue={p.images.map((image) => image.url).join('\n')} /></label>
      <h4>المقاسات والألوان والأسعار والمخزون</h4>
      {p.variants.map((v) => <div key={v.id} className="filters">
        <div><label>المقاس / النوع<input name={`z_${v.id}`} maxLength={40} defaultValue={v.size} /></label></div>
        <div><label>اللون<input name={`c_${v.id}`} maxLength={40} defaultValue={v.color} /></label></div>
        <div><label>السعر الخاص (ج.م، اختياري)<input name={`p_${v.id}`} type="number" step="0.01" min="0.01" defaultValue={v.priceOverride != null ? v.priceOverride / 100 : ''} /></label></div>
        <div><label>المخزون<input name={`s_${v.id}`} type="number" min="0" max="100000" step="1" defaultValue={v.stock} required /></label></div>
      </div>)}
      <fieldset className="card">
        <legend>إضافة مقاس أو لون جديد (اختياري)</legend>
        <div className="filters">
          <div><label>المقاس / النوع<input name="newSize" maxLength={40} /></label></div>
          <div><label>اللون<input name="newColor" maxLength={40} /></label></div>
          <div><label>المخزون الأولي<input name="newStock" type="number" min="0" max="100000" step="1" /></label></div>
          <div><label>السعر الخاص (ج.م، اختياري)<input name="newPriceOverride" type="number" step="0.01" min="0.01" /></label></div>
        </div>
      </fieldset>
      <div className="rowbtns"><button className="btn sm" type="submit">حفظ</button>
        <button type="button" className="btn ghost sm" onClick={() => { if (!p.active && !window.confirm('نشر المنتج للعملاء بهذا السعر والمخزون؟')) return; void patch(p.id, { active: !p.active }); }}>{p.active ? 'أرشفة / إلغاء النشر' : 'نشر'}</button></div>
    </form>)}
  </>;
}
