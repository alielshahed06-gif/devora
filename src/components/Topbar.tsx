'use client';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { Icon } from './Icon';
import { useCart } from './CartProvider';
import { ThemeToggle } from './ThemeToggle';
import Image from 'next/image';
import type { StorefrontSettings } from '../server/storefront-settings';

export function Topbar({ settings }: { settings: StorefrontSettings }) {
  const { count } = useCart();
  return (
    <header className="topbar">
      <Link href="/" className="logo" aria-label={settings.storeName}>
        {settings.logoUrl ? <Image src={settings.logoUrl} alt={settings.storeName} width={160} height={54} unoptimized /> : <>
          <b aria-hidden="true">{['D', 'e', 'v', '-', 'X'].map((ch, i) => <i key={i} className={i >= 2 ? 'x' : undefined} style={{ '--i': i } as CSSProperties}>{ch}</i>)}</b>
          <span aria-hidden="true">{[...'BOOK STORE'].map((ch, i) => <i key={i} style={{ '--j': i } as CSSProperties}>{ch === ' ' ? ' ' : ch}</i>)}</span>
        </>}
      </Link>
      <form className="topsearch" role="search" action="/search" method="get">
        <Icon name="search" />
        <input name="q" type="search" placeholder="ابحث عن كتاب أو تيشرت أو نوت بوك…" aria-label="بحث" />
      </form>
      <Link href="/cart" className="icon-btn cart-link" aria-label="السلة"><Icon name="cart" />{count > 0 && <b>{count}</b>}</Link>
      <ThemeToggle />
    </header>
  );
}
