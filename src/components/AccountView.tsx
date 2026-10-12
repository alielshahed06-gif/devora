'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from './AuthProvider';

interface Me { user: { id: string; name: string; email: string | null; phone: string | null; role: string } | null }
export function AccountView() {
  const router = useRouter();
  const { setUser } = useAuth();
  const [me, setMe] = useState<Me['user'] | undefined>(undefined);
  const [logoutError, setLogoutError] = useState('');
  useEffect(() => { void api<Me>('/api/v1/auth/me').then((r) => setMe(r.ok ? r.data.user : null)); }, []);
  if (me === undefined) return <div className="spin" role="status">جاري التحميل…</div>;
  if (!me) return <div className="card"><h1>حسابي</h1><p>سجّل الدخول للوصول إلى حسابك وطلباتك.</p><Link className="btn" href="/login?next=/account">تسجيل الدخول</Link> <Link className="btn ghost" href="/register">إنشاء حساب</Link></div>;
  return (
    <div className="card">
      <h1>أهلاً، {me.name}</h1>
      <p className="muted" dir="ltr" style={{ textAlign: 'start' }}>{[me.phone, me.email].filter(Boolean).join(' · ')}</p>
      {logoutError && <div className="msg err" role="alert">{logoutError}</div>}
      <p><Link className="btn" href="/orders">طلباتي</Link> {(me.role === 'ADMIN' || me.role === 'STAFF') && <Link className="btn ghost" href="/admin">لوحة الإدارة</Link>} <button type="button" className="btn secondary" onClick={async () => { const r = await api('/api/v1/auth/logout', { method: 'POST', body: {} }); if (!r.ok) { setLogoutError(r.message); return; } setUser(null); router.push('/'); }}>تسجيل الخروج</button></p>
    </div>
  );
}
