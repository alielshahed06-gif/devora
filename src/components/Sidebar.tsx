'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './Icon';
import { useCart } from './CartProvider';
import { useAuth } from './AuthProvider';
import { navigationVisibility } from '../lib/navigation';

const LIVE: [string, string, string][] = [['/', 'home', 'الرئيسية'], ['/categories', 'grid', 'الأقسام'], ['/search?offers=1', 'tag', 'العروض'], ['/search', 'search', 'البحث'], ['/cart', 'cart', 'السلة'], ['/orders', 'box', 'طلباتي'], ['/account', 'user', 'حسابي']];
const CUSTOMER: [string, string, string][] = [['/branches', 'pin', 'الفروع'], ['/payments', 'card', 'الدفع'], ['/support', 'chat', 'الدعم']];

export function Sidebar() {
  const path = usePathname();
  const { count } = useCart();
  const { user } = useAuth();
  const { showLogin, showAdmin } = navigationVisibility(user);
  return (
    <nav id="sidebar" className="sidebar" aria-label="القائمة الرئيسية">
      {[...LIVE, ...(showLogin ? [['/login', 'key', 'تسجيل الدخول'] as [string, string, string]] : []), ...(showAdmin ? [['/admin', 'key', 'لوحة الإدارة'] as [string, string, string]] : [])].map(([href, icon, label]) => {
        const p = href.split('?')[0], active = href.includes('?') ? false : p === '/' ? path === '/' : path === p || path.startsWith(p + '/');
        return <Link key={href} href={href} title={label} className={active ? 'active' : undefined}><Icon name={icon} /><span>{label}</span>{href === '/cart' && count > 0 && <b>{count}</b>}</Link>;
      })}
      <hr />
      {CUSTOMER.map(([href, icon, label]) => {
        const active = path === href || path.startsWith(href + '/');
        return <Link key={href} href={href} title={label} className={active ? 'active' : undefined}><Icon name={icon} /><span>{label}</span></Link>;
      })}
    </nav>
  );
}

export function HomeBack() {
  const path = usePathname();
  return <Link id="homeBack" className="homeback" href="/" hidden={path === '/'}><Icon name="home" /><span>رجوع للرئيسية</span></Link>;
}
