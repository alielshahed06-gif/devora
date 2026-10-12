import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const br = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const out = []; const ok = (n, c, d = '') => { out.push(`${c ? 'PASS' : 'FAIL'} ${n} ${d}`); };
const errs = [];
async function mk(w = 1280, h = 900) { const ctx = await br.newContext({ viewport: { width: w, height: h }, locale: 'ar-EG' }); const pg = await ctx.newPage(); pg.on('pageerror', (e) => errs.push('pageerror: ' + e.message)); pg.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); }); return [ctx, pg]; }
const go = async (pg, p) => { await pg.goto('http://localhost:8765/index.html?p=' + encodeURIComponent(p)); await pg.waitForFunction(() => window.__ready); await pg.waitForTimeout(400); };
const [ctx, pg] = await mk();
// shots
for (const [n, p] of [['home', '/'], ['categories', '/categories'], ['category-books', '/category/books'], ['search-offers', '/search?offers=1'], ['product-t1', '/product/t1'], ['product-b1', '/product/b1'], ['cart-empty', '/cart']]) { await go(pg, p); await pg.screenshot({ path: `shot-new-${n}.png`, fullPage: false }); }
// content checks
await go(pg, '/'); ok('home h1', (await pg.textContent('h1')).includes('كل اللي محتاجه'));
ok('home has 8+8 cards', (await pg.locator('.pcard').count()) === 16, String(await pg.locator('.pcard').count()));
ok('tier chips (3)', (await pg.locator('.strip .chip').count()) === 3);
ok('all imgs load', await pg.evaluate(async () => { const im = [...document.images]; await Promise.all(im.map((i) => i.complete ? 1 : new Promise((r) => { i.onload = i.onerror = r; }))); return im.every((i) => i.naturalWidth > 0); }));
ok('RTL', await pg.evaluate(() => getComputedStyle(document.body).direction === 'rtl'));
await go(pg, '/category/books'); ok('books category = 3', (await pg.locator('.pcard').count()) === 3);
await go(pg, '/category/nope'); ok('bad category 404', (await pg.locator('#nf').count()) === 1);
await go(pg, '/search?q=' + encodeURIComponent('ستيكر')); const n1 = await pg.locator('.pcard').count(); ok('search ستيكر', n1 >= 3, String(n1));
await go(pg, '/search?offers=1&sort=price_asc'); const prices = await pg.$$eval('.pcard .price', (e) => e.map((x) => x.textContent)); ok('offers = 17', prices.length === 17, String(prices.length));
// header search form
await go(pg, '/'); await pg.fill('.topsearch input', 'مج'); await pg.press('.topsearch input', 'Enter'); await pg.waitForFunction(() => window.__ready); await pg.waitForTimeout(300); ok('topbar search navigates', (await pg.textContent('h1')) === 'البحث' && (await pg.locator('.pcard').count()) > 0, await pg.locator('.pcard').count() + ' results');
// cart flow
await go(pg, '/product/t1');
ok('add disabled until size', await pg.locator('#main button.btn >> text=أضف إلى السلة').isDisabled());
await pg.click('.chip-btn:has-text("M")'); ok('add enabled after size', await pg.locator('button:has-text("أضف إلى السلة")').isEnabled());
await pg.click('.qty button[aria-label="زيادة"]'); await pg.click('button:has-text("أضف إلى السلة")'); await pg.waitForTimeout(200);
ok('toast shown', (await pg.locator('#toast').isVisible()) && (await pg.textContent('#toast')).includes('أُضيف'));
ok('badge = 2', (await pg.textContent('.cart-link b')) === '2');
await go(pg, '/product/b1'); await pg.click('button:has-text("أضف إلى السلة")');
await go(pg, '/cart'); ok('cart persisted across navigation (2 lines)', (await pg.locator('.line').count()) === 2, String(await pg.locator('.line').count()));
const total = await pg.textContent('.summary .l.total span:last-child'); console.log('total text', total);
// 2 x 350 (t1) + 150 (b1) = 850 -> tier 10% -> 765
ok('total = 765 ج.م (700+150, tier 10%)', total.replace(/[^\d٠-٩]/g, '').length > 0 && (await pg.textContent('.summary')).includes('٧٦٥'), total);
ok('tier row visible', (await pg.textContent('.summary')).includes('خصم إجمالي الطلب (10٪)'));
ok('checkout disabled + honest notice', (await pg.locator('button:has-text("إتمام الطلب")').isDisabled()) && (await pg.textContent('#main')).includes('غير متاحين بعد'));
await pg.click('.line:first-child .qty button[aria-label="زيادة"]'); await pg.waitForTimeout(150); ok('qty +1 -> badge 4', (await pg.textContent('.cart-link b')) === '4');
for (let i = 0; i < 12; i++) await pg.click('.line:first-child .qty button[aria-label="زيادة"]');
ok('stock cap (error toast)', (await pg.textContent('#toast')).includes('المتاح'));
await pg.screenshot({ path: 'shot-new-cart.png' });
await pg.reload(); await pg.waitForFunction(() => window.__ready); await pg.waitForTimeout(300); ok('cart survives reload', (await pg.locator('.line').count()) === 2);
await pg.click('.line:last-child button:has-text("حذف")'); await pg.waitForTimeout(150); ok('remove line', (await pg.locator('.line').count()) === 1);
await pg.click('.line button:has-text("حذف")'); await pg.waitForTimeout(150); ok('empty cart message', (await pg.textContent('#main')).includes('سلتك فارغة'));
// corrupt storage
await pg.evaluate(() => localStorage.setItem('dx_cart', '{bad')); await pg.reload(); await pg.waitForFunction(() => window.__ready); await pg.waitForTimeout(200); ok('corrupt storage tolerated', (await pg.textContent('#main')).includes('سلتك فارغة'));
// disabled nav items not links
await go(pg, '/'); ok('backend pages shown disabled', (await pg.locator('.sidebar a[aria-disabled=true]').count()) === 6);
// mobile
const [c2, m] = await mk(390, 800); for (const [n, p] of [['home', '/'], ['product-t1', '/product/t1'], ['cart', '/cart']]) { await go(m, p); await m.screenshot({ path: `shot-new-m-${n}.png` }); }
ok('mobile: no horizontal overflow (home)', await (async () => { await go(m, '/'); return m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1); })());
// original for comparison
const [c3, o] = await mk(); await o.goto('file:///home/claude/s3/devx-planc/reference/original-ui/dev-x-book-store-8-2.html#/'); await o.waitForTimeout(2500); await o.screenshot({ path: 'shot-orig-home.png' });
for (const [n, h] of [['categories', '#/categories'], ['product-t1', '#/product/t1'], ['category-books', '#/category/books']]) { await o.goto('file:///home/claude/s3/devx-planc/reference/original-ui/dev-x-book-store-8-2.html' + h); await o.waitForTimeout(1500); await o.screenshot({ path: `shot-orig-${n}.png` }); }
await br.close();
console.log(out.join('\n')); console.log('JS errors:', errs.length ? errs : 'none');
