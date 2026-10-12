import Link from 'next/link';
import { policies } from '../lib/catalog';
import { validEmailAddress, validHttpsUrl, validPhoneLink } from '../lib/storefront-contacts';
import type { StorefrontSettings } from '../server/storefront-settings';

export function Footer({ settings }: { settings: StorefrontSettings }) {
  const phone = validPhoneLink(settings.supportPhone);
  const technicalPhone = validPhoneLink(settings.supportTechnicalPhone);
  const email = validEmailAddress(settings.supportEmail);
  const socialLinks = Object.entries(settings.socialLinks)
    .map(([name, value]) => [name, validHttpsUrl(value)] as const)
    .filter((entry): entry is readonly [string, string] => entry[1] !== null);
  return (
    <footer id="foot" className="foot">
      <div className="foot-in">
        <div className="foot-col foot-brand"><b>{settings.storeName}</b>{settings.footerText.trim() && <p>{settings.footerText}</p>}
          {phone && <a href={phone.href}>{phone.label}</a>}
          {technicalPhone && <a href={technicalPhone.href}>الدعم الفني: {technicalPhone.label}</a>}
          {email && <a href={`mailto:${email}`}>{email}</a>}
          {socialLinks.length > 0 && <div className="social-links">{socialLinks.map(([name, url]) => <a key={name} href={url} target="_blank" rel="noreferrer">{name}</a>)}</div>}
        </div>
        <div className="foot-col"><h4>روابط مهمة</h4><Link href="/categories">الأقسام</Link><Link href="/search?offers=1">العروض</Link><Link href="/cart">السلة</Link><Link href="/orders">طلباتي</Link><Link href="/support">الدعم والتواصل</Link></div>
        <div className="foot-col"><h4>السياسات</h4>{Object.entries(policies).map(([k, v]) => <Link key={k} href={`/policy/${k}`}>{v.title}</Link>)}</div>
      </div>
      <div className="foot-bot"><span>© {new Date().getFullYear()} {settings.storeName} — جميع الحقوق محفوظة</span></div>
    </footer>
  );
}
