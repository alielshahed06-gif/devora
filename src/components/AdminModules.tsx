'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api } from '../lib/api';

type Choice = { id: string; name: string; active: boolean };
type Coupon = {
  code: string; label: string; type: 'PERCENT' | 'FIXED'; value: number; minOrder: number; active: boolean;
  startsAt: string | null; expiresAt: string | null; maxUses: number | null; uses: number;
  categoryIds: string[]; productIds: string[];
};
type Branch = { id: string; name: string; address: string; hours: string; phone: string; mapUrl: string; active: boolean; pickupEnabled: boolean; sort: number };
type Tier = { id: string; minTotal: number; ratePct: number };
type Message = { ok: boolean; text: string };

function MessageBox({ message }: { message: Message | null }) {
  return message ? <div className={`msg ${message.ok ? 'ok' : 'err'}`} role={message.ok ? 'status' : 'alert'}>{message.text}</div> : null;
}

function useMessage() {
  const [message, setMessage] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);
  return { message, setMessage, busy, setBusy };
}

function SelectChoices({ name, label, options, selected = [] }: { name: string; label: string; options: Choice[]; selected?: string[] }) {
  return <label>{label}<select name={name} multiple size={Math.min(5, Math.max(2, options.length))} defaultValue={selected}>
    {options.map((option) => <option key={option.id} value={option.id}>{option.name}{option.active ? '' : ' (غير منشور)'}</option>)}
  </select></label>;
}

function CouponFields({ coupon, categories, products, includeCode, onSubmit, message, busy }: {
  coupon?: Coupon; categories: Choice[]; products: (Choice & { categoryId: string })[]; includeCode: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void; message?: Message | null; busy?: boolean;
}) {
  return <form className="card" onSubmit={onSubmit}>
    {includeCode && <label>كود الخصم<input name="code" minLength={3} maxLength={20} pattern="[A-Z0-9_-]+" required /></label>}
    <label>اسم العرض<input name="label" minLength={2} maxLength={100} defaultValue={coupon?.label ?? ''} required /></label>
    <div className="filters">
      <label>نوع الخصم<select name="type" defaultValue={coupon?.type ?? 'PERCENT'}><option value="PERCENT">نسبة مئوية</option><option value="FIXED">مبلغ ثابت</option></select></label>
      <label>قيمة الخصم (% أو ج.م)<input name="value" type="number" min="0.01" step="0.01" defaultValue={coupon ? (coupon.type === 'FIXED' ? coupon.value / 100 : coupon.value) : ''} required /></label>
      <label>الحد الأدنى للطلب (ج.م)<input name="minOrder" type="number" min="0" step="0.01" defaultValue={coupon ? coupon.minOrder / 100 : 0} required /></label>
      <label>أقصى استخدامات (فارغ بلا حد)<input name="maxUses" type="number" min="1" step="1" defaultValue={coupon?.maxUses ?? ''} /></label>
      <label>يبدأ بتاريخ<input name="startsAt" type="date" defaultValue={dateValue(coupon?.startsAt)} /></label>
      <label>ينتهي بتاريخ<input name="expiresAt" type="date" defaultValue={dateValue(coupon?.expiresAt)} /></label>
    </div>
    <div className="filters">
      <SelectChoices name="categoryIds" label="تصنيفات مؤهلة (اختياري)" options={categories} selected={coupon?.categoryIds} />
      <SelectChoices name="productIds" label="منتجات مؤهلة (اختياري)" options={products} selected={coupon?.productIds} />
    </div>
    <label className="radio"><input type="checkbox" name="active" defaultChecked={coupon?.active ?? true} /> الكوبون فعال</label>
    <MessageBox message={message ?? null} />
    <button className="btn sm" type="submit" disabled={busy}>{busy ? 'جارٍ الحفظ…' : includeCode ? 'إنشاء الكوبون' : 'حفظ الكوبون'}</button>
  </form>;
}

function dateValue(value: string | null | undefined) {
  return value ? value.slice(0, 10) : '';
}

function couponInput(form: FormData, code?: string) {
  const type = String(form.get('type')) as Coupon['type'];
  const amount = Number(form.get('value'));
  const uses = String(form.get('maxUses') ?? '').trim();
  return {
    ...(code ? { code } : {}),
    label: String(form.get('label') ?? '').trim(),
    type,
    value: type === 'FIXED' ? Math.round(amount * 100) : Math.round(amount),
    minOrder: Math.round(Number(form.get('minOrder')) * 100),
    active: form.get('active') === 'on',
    startsAt: String(form.get('startsAt') ?? '') || null,
    expiresAt: String(form.get('expiresAt') ?? '') || null,
    maxUses: uses ? Number(uses) : null,
    categoryIds: form.getAll('categoryIds').map(String),
    productIds: form.getAll('productIds').map(String),
  };
}

export function CouponsAdmin() {
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);
  const [categories, setCategories] = useState<Choice[]>([]);
  const [products, setProducts] = useState<(Choice & { categoryId: string })[]>([]);
  const state = useMessage();
  const { setMessage } = state;
  const load = async () => {
    const result = await api<{ coupons: Coupon[]; categories: Choice[]; products: (Choice & { categoryId: string })[] }>('/api/v1/admin/coupons');
    if (!result.ok) { state.setMessage({ ok: false, text: result.message }); return; }
    setCoupons(result.data.coupons); setCategories(result.data.categories); setProducts(result.data.products);
  };
  useEffect(() => {
    let active = true;
    void api<{ coupons: Coupon[]; categories: Choice[]; products: (Choice & { categoryId: string })[] }>('/api/v1/admin/coupons').then((result) => {
      if (!active) return;
      if (!result.ok) { setMessage({ ok: false, text: result.message }); return; }
      setCoupons(result.data.coupons); setCategories(result.data.categories); setProducts(result.data.products);
    });
    return () => { active = false; };
  }, [setMessage]);
  async function submit(event: FormEvent<HTMLFormElement>, code?: string) {
    event.preventDefault(); state.setBusy(true); state.setMessage(null);
    const form = new FormData(event.currentTarget);
    const result = await api(code ? `/api/v1/admin/coupons/${encodeURIComponent(code)}` : '/api/v1/admin/coupons', {
      method: code ? 'PATCH' : 'POST', body: couponInput(form, code ? undefined : String(form.get('code') ?? '').trim()),
    });
    state.setBusy(false); state.setMessage({ ok: result.ok, text: result.ok ? 'تم حفظ الكوبون.' : result.message });
    if (result.ok) await load();
  }
  if (!coupons) return <div className="spin" role="status">جاري تحميل الكوبونات…</div>;
  return <>
    <h2>إضافة كوبون</h2>
    <CouponFields includeCode categories={categories} products={products} onSubmit={(event) => void submit(event)} message={state.message} busy={state.busy} />
    <h2 className="sec">الكوبونات الحالية</h2>
    {coupons.length === 0 && <div className="msg warn">لا توجد كوبونات بعد.</div>}
    {coupons.map((coupon) => <section key={coupon.code} className="card" style={{ marginBlock: '.8rem' }}>
      <h3>{coupon.code} — {coupon.label}</h3>
      <p className="muted">الاستخدامات: {coupon.uses}{coupon.maxUses ? ` / ${coupon.maxUses}` : ' (بلا حد)'} · {coupon.active ? 'فعال' : 'معطّل'}</p>
      <CouponFields coupon={coupon} includeCode={false} categories={categories} products={products} onSubmit={(event) => void submit(event, coupon.code)} message={state.message} busy={state.busy} />
    </section>)}
  </>;
}

export function DiscountTiersAdmin() {
  const [tiers, setTiers] = useState<Tier[] | null>(null);
  const state = useMessage();
  const { setMessage } = state;
  const load = async () => {
    const result = await api<{ tiers: Tier[] }>('/api/v1/admin/discount-tiers');
    if (!result.ok) { state.setMessage({ ok: false, text: result.message }); return; }
    setTiers(result.data.tiers);
  };
  useEffect(() => {
    let active = true;
    void api<{ tiers: Tier[] }>('/api/v1/admin/discount-tiers').then((result) => {
      if (!active) return;
      if (!result.ok) { setMessage({ ok: false, text: result.message }); return; }
      setTiers(result.data.tiers);
    });
    return () => { active = false; };
  }, [setMessage]);
  async function save(event: FormEvent<HTMLFormElement>, id?: string) {
    event.preventDefault(); state.setBusy(true); state.setMessage(null);
    const form = new FormData(event.currentTarget);
    const body = { minTotal: Math.round(Number(form.get('minTotal')) * 100), ratePct: Number(form.get('ratePct')) };
    const result = await api(id ? `/api/v1/admin/discount-tiers/${id}` : '/api/v1/admin/discount-tiers', { method: id ? 'PATCH' : 'POST', body });
    state.setBusy(false); state.setMessage({ ok: result.ok, text: result.ok ? 'تم حفظ شريحة الخصم.' : result.message });
    if (result.ok) await load();
  }
  async function remove(id: string) {
    if (!window.confirm('حذف شريحة الخصم؟ لن تتغير الطلبات السابقة.')) return;
    const result = await api(`/api/v1/admin/discount-tiers/${id}`, { method: 'DELETE' });
    state.setMessage({ ok: result.ok, text: result.ok ? 'تم حذف الشريحة.' : result.message });
    if (result.ok) await load();
  }
  if (!tiers) return <div className="spin" role="status">جاري تحميل شرائح الخصم…</div>;
  const form = (tier?: Tier) => <form className="card" onSubmit={(event) => void save(event, tier?.id)}>
    <div className="filters">
      <label>الحد الأدنى للطلب (ج.م)<input name="minTotal" type="number" min="0.01" step="0.01" defaultValue={tier ? tier.minTotal / 100 : ''} required /></label>
      <label>نسبة الخصم %<input name="ratePct" type="number" min="1" max="100" step="1" defaultValue={tier?.ratePct ?? ''} required /></label>
    </div>
    <MessageBox message={state.message} />
    <div className="rowbtns"><button className="btn sm" type="submit" disabled={state.busy}>{state.busy ? 'جارٍ الحفظ…' : tier ? 'حفظ' : 'إضافة شريحة'}</button>
      {tier && <button className="btn secondary sm" type="button" onClick={() => void remove(tier.id)}>حذف</button>}</div>
  </form>;
  return <>
    <p className="muted">ترتيب التطبيق تلقائيًا من أعلى حد طلب إلى أدناه؛ تظهر الشرائح بهذا الترتيب في واجهة المتجر.</p>
    <h3>إضافة شريحة</h3>{form()}
    <h3 className="sec">الشرائح الحالية</h3>
    {tiers.length === 0 && <div className="msg warn">لا توجد شرائح خصم.</div>}
    {[...tiers].sort((a, b) => a.minTotal - b.minTotal).map((tier) => <div key={tier.id} style={{ marginBlock: '.7rem' }}>{form(tier)}</div>)}
  </>;
}

export function BranchesAdmin() {
  const [branches, setBranches] = useState<Branch[] | null>(null);
  const state = useMessage();
  const { setMessage } = state;
  const load = async () => {
    const result = await api<{ branches: Branch[] }>('/api/v1/admin/branches');
    if (!result.ok) { state.setMessage({ ok: false, text: result.message }); return; }
    setBranches(result.data.branches);
  };
  useEffect(() => {
    let active = true;
    void api<{ branches: Branch[] }>('/api/v1/admin/branches').then((result) => {
      if (!active) return;
      if (!result.ok) { setMessage({ ok: false, text: result.message }); return; }
      setBranches(result.data.branches);
    });
    return () => { active = false; };
  }, [setMessage]);
  async function save(event: FormEvent<HTMLFormElement>, id?: string) {
    event.preventDefault(); state.setBusy(true); state.setMessage(null);
    const form = new FormData(event.currentTarget);
    const body = {
      name: String(form.get('name') ?? '').trim(), address: String(form.get('address') ?? '').trim(),
      hours: String(form.get('hours') ?? '').trim(), phone: String(form.get('phone') ?? '').trim(),
      mapUrl: String(form.get('mapUrl') ?? '').trim(), active: form.get('active') === 'on',
      pickupEnabled: form.get('pickupEnabled') === 'on', sort: Number(form.get('sort')),
    };
    const result = await api(id ? `/api/v1/admin/branches/${id}` : '/api/v1/admin/branches', { method: id ? 'PATCH' : 'POST', body });
    state.setBusy(false); state.setMessage({ ok: result.ok, text: result.ok ? 'تم حفظ الفرع.' : result.message });
    if (result.ok) await load();
  }
  if (!branches) return <div className="spin" role="status">جاري تحميل الفروع…</div>;
  const form = (branch?: Branch): ReactNode => <form className="card" onSubmit={(event) => void save(event, branch?.id)}>
    <div className="filters">
      <label>اسم الفرع<input name="name" minLength={2} maxLength={100} defaultValue={branch?.name} required /></label>
      <label>العنوان<input name="address" maxLength={300} defaultValue={branch?.address} /></label>
      <label>ساعات العمل<input name="hours" maxLength={160} defaultValue={branch?.hours} /></label>
      <label>الهاتف<input name="phone" maxLength={100} defaultValue={branch?.phone} dir="ltr" /></label>
      <label>رابط الخريطة (HTTPS)<input name="mapUrl" maxLength={1000} defaultValue={branch?.mapUrl} dir="ltr" /></label>
      <label>ترتيب العرض<input name="sort" type="number" min="0" max="100000" defaultValue={branch?.sort ?? 0} required /></label>
    </div>
    <label className="radio"><input name="active" type="checkbox" defaultChecked={branch?.active ?? true} /> الفرع متاح</label>
    <label className="radio"><input name="pickupEnabled" type="checkbox" defaultChecked={branch?.pickupEnabled ?? true} /> متاح للاستلام عند الطلب</label>
    <MessageBox message={state.message} />
    <button className="btn sm" type="submit" disabled={state.busy}>{state.busy ? 'جارٍ الحفظ…' : branch ? 'حفظ الفرع' : 'إضافة الفرع'}</button>
  </form>;
  return <>
    <h2>إضافة فرع</h2>{form()}
    <h2 className="sec">الفروع الحالية</h2>
    {branches.length === 0 && <div className="msg warn">لا توجد فروع مسجلة.</div>}
    {branches.map((branch) => <div key={branch.id} style={{ marginBlock: '.8rem' }}><h3>{branch.name}</h3>{form(branch)}</div>)}
  </>;
}

export function StorefrontSettingsForm({ settings }: { settings: {
  storeName: string; logoUrl: string; tagline: string; homeTitle: string; homeDescription: string; announcement: string;
  supportPhone: string; supportTechnicalPhone: string; supportEmail: string; footerText: string; socialLinks: { facebook: string; instagram: string; whatsapp: string };
} }) {
  const state = useMessage();
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); state.setBusy(true); state.setMessage(null);
    const form = new FormData(event.currentTarget);
    const result = await api('/api/v1/admin/settings', { method: 'PATCH', body: {
      storefront: {
        storeName: String(form.get('storeName') ?? '').trim(), logoUrl: String(form.get('logoUrl') ?? '').trim(),
        tagline: String(form.get('tagline') ?? '').trim(), homeTitle: String(form.get('homeTitle') ?? '').trim(),
        homeDescription: String(form.get('homeDescription') ?? '').trim(), announcement: String(form.get('announcement') ?? '').trim(),
        supportPhone: String(form.get('supportPhone') ?? '').trim(), supportTechnicalPhone: String(form.get('supportTechnicalPhone') ?? '').trim(),
        supportEmail: String(form.get('supportEmail') ?? '').trim(),
        footerText: String(form.get('footerText') ?? '').trim(),
        socialLinks: { facebook: String(form.get('facebook') ?? '').trim(), instagram: String(form.get('instagram') ?? '').trim(), whatsapp: String(form.get('whatsapp') ?? '').trim() },
      },
    } });
    state.setBusy(false); state.setMessage({ ok: result.ok, text: result.ok ? 'تم حفظ بيانات المتجر؛ ستظهر التغييرات مباشرة في الواجهة.' : result.message });
  }
  return <form className="card" onSubmit={(event) => void save(event)}>
    <h2>هوية المتجر ومحتوى الواجهة</h2>
    <div className="filters">
      <label>اسم المتجر<input name="storeName" maxLength={100} defaultValue={settings.storeName} required /></label>
      <label>رابط الشعار (محلي أو HTTPS)<input name="logoUrl" maxLength={1000} defaultValue={settings.logoUrl} dir="ltr" /></label>
      <label>رقم التواصل<input name="supportPhone" maxLength={30} defaultValue={settings.supportPhone} dir="ltr" /></label>
      <label>رقم الدعم الفني<input name="supportTechnicalPhone" maxLength={30} defaultValue={settings.supportTechnicalPhone} dir="ltr" /></label>
      <label>بريد التواصل<input name="supportEmail" type="email" maxLength={120} defaultValue={settings.supportEmail} dir="ltr" /></label>
      <label>رابط Facebook<input name="facebook" maxLength={1000} defaultValue={settings.socialLinks.facebook} dir="ltr" /></label>
      <label>رابط Instagram<input name="instagram" maxLength={1000} defaultValue={settings.socialLinks.instagram} dir="ltr" /></label>
      <label>رابط WhatsApp<input name="whatsapp" maxLength={1000} defaultValue={settings.socialLinks.whatsapp} dir="ltr" /></label>
    </div>
    <label>وصف مختصر<input name="tagline" maxLength={300} defaultValue={settings.tagline} /></label>
    <label>عنوان الصفحة الرئيسية<input name="homeTitle" minLength={2} maxLength={160} defaultValue={settings.homeTitle} required /></label>
    <label>مقدمة الصفحة الرئيسية<textarea name="homeDescription" maxLength={600} defaultValue={settings.homeDescription} /></label>
    <label>شريط إعلان المتجر (اتركه فارغًا للإخفاء)<input name="announcement" maxLength={240} defaultValue={settings.announcement} /></label>
    <label>نص الفوتر<textarea name="footerText" maxLength={500} defaultValue={settings.footerText} /></label>
    <MessageBox message={state.message} />
    <button className="btn" type="submit" disabled={state.busy}>{state.busy ? 'جارٍ الحفظ…' : 'حفظ هوية ومحتوى المتجر'}</button>
  </form>;
}
