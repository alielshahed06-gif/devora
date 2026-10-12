import React from 'react';
import { createRoot } from 'react-dom/client';
import { CartProvider } from '@src/components/CartProvider';
import { Topbar } from '@src/components/Topbar';
import { Sidebar, HomeBack } from '@src/components/Sidebar';
import { Footer } from '@src/components/Footer';
import Home from '@src/app/page';
import Categories from '@src/app/categories/page';
import CategoryPage from '@src/app/category/[id]/page';
import Search from '@src/app/search/page';
import ProductPage from '@src/app/product/[id]/page';
import CartPage from '@src/app/cart/page';
import Policy from '@src/app/policy/[key]/page';

document.addEventListener('submit', (e) => { const f = e.target as HTMLFormElement; if (f.getAttribute('action') === '/search') { e.preventDefault(); const q = new URLSearchParams(new FormData(f) as any); for (const [k, v] of [...q]) if (!v) q.delete(k); location.search = '?p=' + encodeURIComponent('/search?' + q); } });
const full = new URLSearchParams(location.search).get('p') || '/';
const [path, qs] = full.split('?'); const sp = Object.fromEntries(new URLSearchParams(qs || ''));
const seg = path.split('/').filter(Boolean);
let page: any;
try {
  if (path === '/') page = <Home />;
  else if (path === '/categories') page = <Categories />;
  else if (seg[0] === 'category') page = await (CategoryPage as any)({ params: Promise.resolve({ id: seg[1] }) });
  else if (path === '/search') page = await (Search as any)({ searchParams: Promise.resolve(sp) });
  else if (seg[0] === 'product') page = await (ProductPage as any)({ params: Promise.resolve({ id: seg[1] }) });
  else if (path === '/cart') page = <CartPage />;
  else if (seg[0] === 'policy') page = await (Policy as any)({ params: Promise.resolve({ key: seg[1] }) });
  else page = <div id="nf">404</div>;
} catch (e) { page = <div id="nf">404</div>; }
createRoot(document.getElementById('root')!).render(<CartProvider><Topbar /><div className="shell"><Sidebar /><div className="col"><HomeBack /><main id="main" className="main">{page}</main><Footer /></div></div></CartProvider>);
(window as any).__ready = true;
