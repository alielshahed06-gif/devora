'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '../lib/api';
import { useAuth, type AuthUser } from './AuthProvider';

export function AdminAccess() {
  const router = useRouter();
  const pathname = usePathname();
  const { user: authUser, setUser } = useAuth();
  const user = authUser ?? null;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    const result = await api<{ user: AuthUser }>('/api/v1/auth/login', {
      method: 'POST',
      body: { identifier: String(form.get('identifier') ?? ''), password: String(form.get('password') ?? '') },
    });
    setBusy(false);
    if (!result.ok) { setError(result.message); return; }
    if (result.data.user.role !== 'ADMIN' && result.data.user.role !== 'STAFF') {
      const logout = await api('/api/v1/auth/logout', { method: 'POST', body: {} });
      setUser(logout.ok ? null : result.data.user);
      setError('هذا الحساب لا يملك صلاحية دخول الإدارة.');
      return;
    }
    setUser(result.data.user);
    setOpen(false);
    setNotice(result.data.user.mustChangePassword ? 'غيّر كلمة مرور المدير المؤقتة للمتابعة.' : '');
    router.push('/admin');
    router.refresh();
  }

  async function signOut() {
    setBusy(true); setError('');
    const result = await api('/api/v1/auth/logout', { method: 'POST', body: {} });
    setBusy(false);
    if (!result.ok) { setError(result.message); return; }
    setUser(null); setNotice('تم تسجيل الخروج من الإدارة.');
    if (pathname.startsWith('/admin')) router.push('/');
    router.refresh();
  }

  return (
    <>
      <div className="admin-access">
        <button className="admin-access-btn" type="button" onClick={user?.role === 'ADMIN' || user?.role === 'STAFF' ? () => void signOut() : () => { setError(''); setOpen(true); }}>
          {busy ? 'جارٍ التنفيذ…' : user?.role === 'ADMIN' || user?.role === 'STAFF' ? 'خروج الإدارة' : 'دخول الإدارة'}
        </button>
        {(error || notice) && !open && <p className={error ? 'msg err' : 'msg ok'} role={error ? 'alert' : 'status'}>{error || notice}</p>}
      </div>
      {open && (
        <div className="modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className="card admin-login" role="dialog" aria-modal="true" aria-labelledby="admin-login-title">
            <button type="button" className="admin-modal-close" onClick={() => setOpen(false)} aria-label="إغلاق">×</button>
            <h2 id="admin-login-title">دخول الإدارة</h2>
            <p className="muted">استخدم البريد الإلكتروني وكلمة مرور حساب المدير.</p>
            <form onSubmit={(event) => void signIn(event)}>
              <label className="field">البريد الإلكتروني<input name="identifier" type="email" autoComplete="username" dir="ltr" required maxLength={120} /></label>
              <label className="field">كلمة مرور المدير<input name="password" type="password" autoComplete="current-password" required maxLength={128} /></label>
              {error && <div className="msg err" role="alert">{error}</div>}
              <button className="btn" type="submit" disabled={busy}>{busy ? 'جارٍ التحقق…' : 'دخول آمن'}</button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
