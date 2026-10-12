import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { CartProvider } from '../components/CartProvider';
import { Topbar } from '../components/Topbar';
import { Sidebar, HomeBack } from '../components/Sidebar';
import { Footer } from '../components/Footer';
import { isDemoCatalogEnabled } from '../server/catalog';
import { AdminAccess } from '../components/AdminAccess';
import { getStorefrontSettings } from '../server/storefront-settings';
import { AuthProvider } from '../components/AuthProvider';

export const metadata: Metadata = {
  title: 'Dev-X Book Store',
  description: 'Dev-X Book Store — كتب وتيشرتات ونوت بوك ومنتجات متنوعة لعشاق التعلّم والتقنية.',
  openGraph: { type: 'website', siteName: 'Dev-X Book Store', title: 'Dev-X Book Store', locale: 'ar_EG' },
};
export const viewport: Viewport = { themeColor: '#041F60', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

// Arabic RTL is the default (as in the original UI). English/LTR is NOT implemented yet (backlog D-015).
export default async function RootLayout({ children }: { children: ReactNode }) {
  const storefront = await getStorefrontSettings();
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <script id="theme-preference" dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('devx-theme');document.documentElement.dataset.theme=t==='dark'?'dark':'light'}catch{}" }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AuthProvider>
          <CartProvider>
            <Topbar settings={storefront} />
            {storefront.announcement && <div className="store-announcement" role="status">{storefront.announcement}</div>}
            {isDemoCatalogEnabled() && <div className="msg warn" role="status">وضع تجريبي محلي: بيانات المنتجات للعرض فقط، وإتمام الطلب يتطلب قاعدة بيانات مُعدّة.</div>}
            <div className="shell">
              <Sidebar />
              <div className="col">
                <HomeBack />
                <main id="main" className="main">{children}</main>
                <Footer settings={storefront} />
              </div>
              <AdminAccess />
            </div>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
