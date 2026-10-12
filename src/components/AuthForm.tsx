'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { api, safeNext } from '../lib/api';
import { Icon } from './Icon';
import { useAuth, type AuthUser } from './AuthProvider';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const { setUser } = useAuth();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setErr('');
    const f = new FormData(e.currentTarget), s = (k: string) => String(f.get(k) ?? '');
    const body = mode === 'login' ? { identifier: s('identifier'), password: s('password') } : { name: s('name'), phone: s('phone'), email: s('email'), password: s('password') };
    const r = await api<{ user: AuthUser }>(`/api/v1/auth/${mode}`, { method: 'POST', body });
    if (!r.ok) { setBusy(false); setErr(r.status === 400 ? 'راجع البيانات المدخلة (الاسم، رقم موبايل مصري صحيح، كلمة مرور 8 أحرف على الأقل).' : r.message); return; }
    setUser(r.data.user);
    router.push(safeNext(new URLSearchParams(window.location.search).get('next')));
  }
  return (
    <div className="card" style={{ maxWidth: 460, margin: '0 auto' }}>
      <h1>{mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب'}</h1>
      <form onSubmit={submit} noValidate>
        {mode === 'register' && <>
          <label className="field">الاسم<input name="name" required minLength={2} maxLength={80} autoComplete="name" /></label>
          <label className="field">رقم الموبايل<input name="phone" required inputMode="tel" autoComplete="tel" placeholder="01xxxxxxxxx" dir="ltr" /></label>
          <label className="field">البريد الإلكتروني (اختياري)<input name="email" type="email" autoComplete="email" dir="ltr" /></label>
        </>}
        {mode === 'login' && <label className="field">رقم الموبايل أو البريد الإلكتروني<input name="identifier" required autoComplete="username" dir="ltr" /></label>}
        <label className="field">كلمة المرور<input name="password" type="password" required minLength={mode === 'register' ? 8 : 1} maxLength={128} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
        {err && <div className="msg err" role="alert"><Icon name="x" /> {err}</div>}
        <button className="btn" type="submit" disabled={busy} style={{ width: '100%' }}>{busy ? 'جاري التنفيذ…' : mode === 'login' ? 'دخول' : 'إنشاء الحساب'}</button>
      </form>
      <p className="muted">{mode === 'login' ? <>ليس لديك حساب؟ <Link href="/register">أنشئ حسابًا</Link></> : <>لديك حساب؟ <Link href="/login">سجّل الدخول</Link></>}</p>
    </div>
  );
}
