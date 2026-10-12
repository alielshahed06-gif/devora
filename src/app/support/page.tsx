import { validEmailAddress, validHttpsUrl, validPhoneLink } from '../../lib/storefront-contacts';
import { getStorefrontSettings } from '../../server/storefront-settings';

export const metadata = { title: 'الدعم والتواصل — Dev-X Book Store' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const settings = await getStorefrontSettings();
  const phone = validPhoneLink(settings.supportPhone);
  const technicalPhone = validPhoneLink(settings.supportTechnicalPhone);
  const email = validEmailAddress(settings.supportEmail);
  const socialLinks = Object.entries(settings.socialLinks)
    .map(([name, value]) => [name, validHttpsUrl(value)] as const)
    .filter((entry): entry is readonly [string, string] => entry[1] !== null);
  const socialLabels: Record<string, string> = { facebook: 'Facebook', instagram: 'Instagram', whatsapp: 'WhatsApp' };
  const hasContacts = phone || technicalPhone || email || socialLinks.length > 0;

  return (
    <section className="card">
      <h1>الدعم والتواصل</h1>
      {hasContacts ? <>
        <p>يمكنك التواصل عبر وسائل الاتصال المعلنة التالية:</p>
        <div className="foot-col">
          {phone && <a href={phone.href}>{phone.label}</a>}
          {technicalPhone && <a href={technicalPhone.href}>الدعم الفني: {technicalPhone.label}</a>}
          {email && <a href={`mailto:${email}`}>{email}</a>}
          {socialLinks.map(([name, url]) => <a key={name} href={url} target="_blank" rel="noreferrer">{socialLabels[name] ?? name}</a>)}
        </div>
      </> : <div className="msg warn" role="status">لم يضف المتجر بيانات تواصل للدعم بعد.</div>}
    </section>
  );
}
