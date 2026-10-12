'use client';

import { useSyncExternalStore, useState } from 'react';

const subscribe = (callback: () => void) => {
  window.addEventListener('devx-theme-change', callback);
  return () => window.removeEventListener('devx-theme-change', callback);
};
const getTheme = () => document.documentElement.dataset.theme === 'dark';
const getServerTheme = () => false;

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, getTheme, getServerTheme);
  const [error, setError] = useState('');

  function toggle() {
    const next = !dark;
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    window.dispatchEvent(new Event('devx-theme-change'));
    try {
      window.localStorage.setItem('devx-theme', next ? 'dark' : 'light');
      setError('');
    } catch {
      setError('تعذر حفظ تفضيل المظهر على هذا الجهاز.');
    }
  }

  return (
    <span className="theme-control">
      <button className="icon-btn theme-toggle" type="button" onClick={toggle} aria-label={dark ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن'} title={dark ? 'الوضع الفاتح' : 'الوضع الداكن'}>
        {dark ? '☀️' : '🌙'}
      </button>
      {error && <span className="theme-error" role="status">{error}</span>}
    </span>
  );
}
