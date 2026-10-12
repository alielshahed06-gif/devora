import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient, type PaymentMethodConfig } from '@prisma/client';
import { POST as login } from '../../src/app/api/v1/auth/login/route';
import { POST as changeAdminPassword } from '../../src/app/api/v1/auth/password/route';
import { POST as logout } from '../../src/app/api/v1/auth/logout/route';
import { POST as quoteCart } from '../../src/app/api/v1/cart/quote/route';
import { GET as listPublicPayments } from '../../src/app/api/v1/payment-methods/route';
import { GET as listBranches } from '../../src/app/api/v1/branches/route';
import { GET as listProducts } from '../../src/app/api/v1/products/route';
import { GET as listCategories } from '../../src/app/api/v1/categories/route';
import { GET as getProduct } from '../../src/app/api/v1/products/[id]/route';
import { POST as createAdminProduct } from '../../src/app/api/v1/admin/products/route';
import { PATCH as updateProduct } from '../../src/app/api/v1/admin/products/[id]/route';
import { PATCH as updateCategory } from '../../src/app/api/v1/admin/categories/[id]/route';
import { GET as listAdminCategories } from '../../src/app/api/v1/admin/categories/route';
import { PATCH as updateStoreSettings } from '../../src/app/api/v1/admin/settings/route';
import { GET as listCoupons, POST as createCoupon } from '../../src/app/api/v1/admin/coupons/route';
import { PATCH as updateCoupon } from '../../src/app/api/v1/admin/coupons/[code]/route';
import { GET as listTiers, POST as createTier } from '../../src/app/api/v1/admin/discount-tiers/route';
import { DELETE as deleteTier, PATCH as updateTier } from '../../src/app/api/v1/admin/discount-tiers/[id]/route';
import { GET as listAdminBranches, POST as createBranch } from '../../src/app/api/v1/admin/branches/route';
import { PATCH as updateBranch } from '../../src/app/api/v1/admin/branches/[id]/route';
import { PATCH as updatePaymentMethod } from '../../src/app/api/v1/admin/payment-methods/[code]/route';
import { GET as listAdminOrders } from '../../src/app/api/v1/admin/orders/route';
import { getPublicCategory } from '../../src/server/catalog';
import { GET as getAdminOrder, PATCH as updateOrder } from '../../src/app/api/v1/admin/orders/[id]/route';
import { GET as listCustomerOrders, POST as submitOrder } from '../../src/app/api/v1/orders/route';
import { hashPassword } from '../../src/server/auth/password';
import { createOrder } from '../../src/server/orders/createOrder';
import { createPrismaOrderRunner } from '../../src/server/orders/prismaStore';
import { parseCheckout } from '../../src/server/validate';

const rawTestUrl = process.env.TEST_DATABASE_URL;
if (rawTestUrl) {
  const url = new URL(rawTestUrl);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || !/(^|[-_])test($|[-_])/i.test(databaseName)) {
    throw new Error('TEST_DATABASE_URL must target a dedicated local database whose name contains "test".');
  }
}

const db = rawTestUrl ? new PrismaClient({ datasourceUrl: rawTestUrl }) : null;

const apiRequest = (path: string, method = 'GET', body?: unknown, cookie?: string) => new Request(`http://shop.test${path}`, {
  method,
  headers: {
    host: 'shop.test',
    ...(method === 'GET' ? {} : { origin: 'http://shop.test', 'content-type': 'application/json' }),
    ...(cookie ? { cookie } : {}),
  },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

test('PostgreSQL order concurrency, storefront, admin and coupon transactions', { skip: !db }, async () => {
  if (!db) return;
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();
  const categoryId = `it-${suffix.toLowerCase()}`;
  const couponCode = `IT_${suffix}`;
  const managedCouponCode = `UI_${suffix}`;
  const phone = `010${randomUUID().replace(/\D/g, '').slice(0, 8)}`;
  const productIds: string[] = [];
  const userIds: string[] = [];
  const tierIds: string[] = [];
  const branchIds: string[] = [];
  let previousCod: PaymentMethodConfig | null = null;
  let previousStoreSettings: Awaited<ReturnType<PrismaClient['storeSetting']['findMany']>> = [];
  let previousStorefront: Awaited<ReturnType<PrismaClient['storeSetting']['findUnique']>> = null;
  let storeSettingsTouched = false;
  let codTouched = false;
  let createdCategory = false;

  try {
    previousCod = await db.paymentMethodConfig.findUnique({ where: { code: 'COD' } });
    previousStoreSettings = await db.storeSetting.findMany({ where: { key: { in: ['shippingFee', 'freeShippingMin'] } } });
    previousStorefront = await db.storeSetting.findUnique({ where: { key: 'storefront' } });
    await db.category.create({ data: { id: categoryId, name: `Integration ${suffix}` } });
    createdCategory = true;
    await db.paymentMethodConfig.upsert({
      where: { code: 'COD' },
      create: { code: 'COD', name: 'Cash on delivery', enabled: true, status: 'READY' },
      update: { enabled: true, status: 'READY' },
    });
    codTouched = true;
    const createProduct = async (name: string, stock: number) => {
      const product = await db.product.create({
        data: {
          name, categoryId, price: 10_000, active: true,
          variants: { create: { size: 'M', stock } },
        },
        include: { variants: true },
      });
      productIds.push(product.id);
      return product;
    };
    const mainProduct = await createProduct(`Concurrency ${suffix}`, 20);
    const limitedProduct = await createProduct(`Limited ${suffix}`, 1);
    const couponProduct = await createProduct(`Coupon ${suffix}`, 5);
    const admin = await db.user.create({
      data: { name: 'Integration Admin', email: `admin-${suffix}@example.test`.toLowerCase(), role: 'ADMIN', mustChangePassword: true, passwordHash: await hashPassword('IntegrationPassword123!') },
      select: { id: true },
    });
    userIds.push(admin.id);
    const customer = await db.user.create({
      data: { name: 'Integration Customer', phone, email: `customer-${suffix}@example.test`.toLowerCase(), passwordHash: await hashPassword('IntegrationPassword123!') },
      select: { id: true },
    });
    userIds.push(customer.id);
    await db.coupon.create({
      data: { code: couponCode, label: 'Integration test', type: 'FIXED', value: 100, maxUses: 1 },
    });
    assert.equal((await listAdminOrders(apiRequest('/api/v1/admin/orders'))).status, 401, 'protected admin APIs reject unauthenticated requests');

    const adminLogin = await login(apiRequest('/api/v1/auth/login', 'POST', { identifier: `admin-${suffix}@example.test`, password: 'IntegrationPassword123!' }));
    assert.equal(adminLogin.status, 200);
    const bootstrapAdminCookie = adminLogin.headers.get('set-cookie')?.split(';', 1)[0];
    assert.ok(bootstrapAdminCookie);
    const blockedBeforeRotation = await listAdminOrders(apiRequest('/api/v1/admin/orders', 'GET', undefined, bootstrapAdminCookie));
    assert.equal(blockedBeforeRotation.status, 403, 'bootstrap admins cannot access admin APIs before password rotation');
    const weakPasswordChange = await changeAdminPassword(apiRequest('/api/v1/auth/password', 'POST', {
      currentPassword: 'IntegrationPassword123!', newPassword: 'short',
    }, bootstrapAdminCookie));
    assert.equal(weakPasswordChange.status, 400);
    const passwordChange = await changeAdminPassword(apiRequest('/api/v1/auth/password', 'POST', {
      currentPassword: 'IntegrationPassword123!', newPassword: 'IntegrationReplacementPass456!',
    }, bootstrapAdminCookie));
    assert.equal(passwordChange.status, 200);
    const adminCookie = passwordChange.headers.get('set-cookie')?.split(';', 1)[0];
    assert.ok(adminCookie);
    const replacementLogin = await login(apiRequest('/api/v1/auth/login', 'POST', {
      identifier: `admin-${suffix}@example.test`, password: 'IntegrationReplacementPass456!',
    }));
    assert.equal(replacementLogin.status, 200, 'the replacement password works on a subsequent login');
    const replacementCookie = replacementLogin.headers.get('set-cookie')?.split(';', 1)[0];
    assert.ok(replacementCookie);
    const staleAdminSession = await listAdminOrders(apiRequest('/api/v1/admin/orders', 'GET', undefined, bootstrapAdminCookie));
    assert.equal(staleAdminSession.status, 401, 'password rotation invalidates the bootstrap session');
    const customerLogin = await login(apiRequest('/api/v1/auth/login', 'POST', { identifier: phone, password: 'IntegrationPassword123!' }));
    assert.equal(customerLogin.status, 200);
    const customerCookie = customerLogin.headers.get('set-cookie')?.split(';', 1)[0];
    assert.ok(customerCookie);
    const forbiddenProduct = await createAdminProduct(apiRequest('/api/v1/admin/products', 'POST', {
      name: `Forbidden ${suffix}`, categoryId, price: 1_000, variants: [{ size: '', color: '', stock: 1 }],
    }, customerCookie));
    assert.equal(forbiddenProduct.status, 403, 'customers cannot create administrator products');
    const publicPaymentMethods = await listPublicPayments();
    const publicPaymentPayload = await publicPaymentMethods.json() as { methods: { code: string }[] };
    assert.deepEqual(publicPaymentPayload.methods.map((method) => method.code), ['COD']);
    const enableUnverifiedGateway = await updatePaymentMethod(apiRequest('/api/v1/admin/payment-methods/FAWRY', 'PATCH', {
      status: 'READY', enabled: true, integrationNotes: 'No provider integration exists',
    }, adminCookie), { params: Promise.resolve({ code: 'FAWRY' }) });
    assert.equal(enableUnverifiedGateway.status, 422, 'admin cannot mark an unintegrated online provider ready');
    const settingResponse = await updateStoreSettings(apiRequest('/api/v1/admin/settings', 'PATCH', {
      shippingFee: 1_234, freeShippingMin: 50_000,
    }, adminCookie));
    assert.equal(settingResponse.status, 200);
    storeSettingsTouched = true;
    const storefrontChange = await updateStoreSettings(apiRequest('/api/v1/admin/settings', 'PATCH', {
      storefront: {
        storeName: `Integration Store ${suffix}`, homeTitle: `Integration Home ${suffix}`,
        announcement: `Local notice ${suffix}`, supportPhone: '+201000000000',
        socialLinks: { instagram: 'https://instagram.com/example' },
      },
    }, adminCookie));
    assert.equal(storefrontChange.status, 200);
    const storefrontRoute = await import('../../src/app/api/v1/storefront/route');
    const storefrontResponse = await storefrontRoute.GET();
    const storefrontPayload = await storefrontResponse.json() as { settings: { storeName: string; homeTitle: string; announcement: string; socialLinks: { instagram: string } } };
    assert.equal(storefrontPayload.settings.storeName, `Integration Store ${suffix}`);
    assert.equal(storefrontPayload.settings.homeTitle, `Integration Home ${suffix}`);
    assert.equal(storefrontPayload.settings.announcement, `Local notice ${suffix}`);
    assert.equal(storefrontPayload.settings.socialLinks.instagram, 'https://instagram.com/example');

    const tierCreate = await createTier(apiRequest('/api/v1/admin/discount-tiers', 'POST', { minTotal: 10_000, ratePct: 10 }, adminCookie));
    assert.equal(tierCreate.status, 201);
    const tierCreatePayload = await tierCreate.json() as { tier: { id: string } };
    tierIds.push(tierCreatePayload.tier.id);
    assert.equal((await createTier(apiRequest('/api/v1/admin/discount-tiers', 'POST', { minTotal: 0, ratePct: 101 }, adminCookie))).status, 400);
    assert.equal((await updateTier(apiRequest(`/api/v1/admin/discount-tiers/${tierIds[0]}`, 'PATCH', { minTotal: 10_000, ratePct: 12 }, adminCookie), {
      params: Promise.resolve({ id: tierIds[0] }),
    })).status, 200);
    assert.equal((await listTiers(apiRequest('/api/v1/admin/discount-tiers', 'GET', undefined, adminCookie))).status, 200);
    const tierQuoteResponse = await quoteCart(apiRequest('/api/v1/cart/quote', 'POST', { items: [{ productId: mainProduct.id, qty: 1, size: 'M' }] }));
    const tierQuotePayload = await tierQuoteResponse.json() as { quote: { tierRate: number; tierDiscount: number } };
    assert.equal(tierQuotePayload.quote.tierRate, 12);
    assert.equal(tierQuotePayload.quote.tierDiscount, 1_200, 'admin tier settings affect server-side pricing');

    const managedCoupon = await createCoupon(apiRequest('/api/v1/admin/coupons', 'POST', {
      code: managedCouponCode, label: 'Managed Integration', type: 'PERCENT', value: 10, minOrder: 0,
      active: true, startsAt: null, expiresAt: '2099-12-31', maxUses: 5,
      categoryIds: [categoryId], productIds: [mainProduct.id],
    }, adminCookie));
    assert.equal(managedCoupon.status, 201);
    assert.equal((await createCoupon(apiRequest('/api/v1/admin/coupons', 'POST', {
      code: `BAD_${suffix}`, label: 'Invalid', type: 'PERCENT', value: 101, minOrder: 0,
      active: true, startsAt: null, expiresAt: null, maxUses: null, categoryIds: [], productIds: [],
    }, adminCookie))).status, 400);
    const managedCouponQuoteResponse = await quoteCart(apiRequest('/api/v1/cart/quote', 'POST', {
      items: [{ productId: mainProduct.id, qty: 1, size: 'M' }], couponCode: managedCouponCode,
    }));
    const managedCouponQuote = await managedCouponQuoteResponse.json() as { quote: { couponDiscount: number; couponError: string | null } };
    assert.equal(managedCouponQuote.quote.couponError, null);
    assert.equal(managedCouponQuote.quote.couponDiscount, 880, 'eligible coupon applies after the configured tier discount');
    assert.equal((await updateCoupon(apiRequest(`/api/v1/admin/coupons/${managedCouponCode}`, 'PATCH', {
      label: 'Disabled Integration', type: 'PERCENT', value: 10, minOrder: 0, active: false, startsAt: null,
      expiresAt: null, maxUses: 5, categoryIds: [categoryId], productIds: [mainProduct.id],
    }, adminCookie), { params: Promise.resolve({ code: managedCouponCode }) })).status, 200);
    assert.equal((await listCoupons(apiRequest('/api/v1/admin/coupons', 'GET', undefined, adminCookie))).status, 200);
    const disabledCouponQuoteResponse = await quoteCart(apiRequest('/api/v1/cart/quote', 'POST', {
      items: [{ productId: mainProduct.id, qty: 1, size: 'M' }], couponCode: managedCouponCode,
    }));
    const disabledCouponQuote = await disabledCouponQuoteResponse.json() as { quote: { couponError: string | null } };
    assert.equal(disabledCouponQuote.quote.couponError, 'كود الخصم غير صحيح.');
    assert.equal((await deleteTier(apiRequest(`/api/v1/admin/discount-tiers/${tierIds[0]}`, 'DELETE', undefined, adminCookie), {
      params: Promise.resolve({ id: tierIds[0] }),
    })).status, 200);

    const branchCreate = await createBranch(apiRequest('/api/v1/admin/branches', 'POST', {
      name: `Branch ${suffix}`, address: 'Test address', hours: '10:00-18:00', phone: '+201000000000',
      mapUrl: 'https://maps.example.test/branch', active: true, pickupEnabled: true, sort: 1,
    }, adminCookie));
    assert.equal(branchCreate.status, 201);
    const branchCreatePayload = await branchCreate.json() as { branch: { id: string } };
    branchIds.push(branchCreatePayload.branch.id);
    assert.equal((await listAdminBranches(apiRequest('/api/v1/admin/branches', 'GET', undefined, adminCookie))).status, 200);
    assert.equal((await listBranches()).status, 200);
    assert.equal((await updateBranch(apiRequest(`/api/v1/admin/branches/${branchIds[0]}`, 'PATCH', { pickupEnabled: false }, adminCookie), {
      params: Promise.resolve({ id: branchIds[0] }),
    })).status, 200);
    const pickupBranches = await listBranches();
    const pickupBranchesPayload = await pickupBranches.json() as { branches: { id: string }[] };
    assert.ok(!pickupBranchesPayload.branches.some((branch) => branch.id === branchIds[0]));
    const invalidPickup = await submitOrder(apiRequest('/api/v1/orders', 'POST', {
      items: [{ productId: mainProduct.id, qty: 1, size: 'M' }], deliveryMethod: 'PICKUP', branchId: branchIds[0],
      customerName: 'Integration Customer', customerPhone: phone, paymentMethod: 'COD',
    }, customerCookie));
    assert.equal(invalidPickup.status, 422, 'disabled pickup branches cannot accept checkout orders');
    assert.equal((await db.productVariant.findUniqueOrThrow({ where: { id: mainProduct.variants[0].id } })).stock, 20);
    assert.equal((await updateBranch(apiRequest(`/api/v1/admin/branches/${branchIds[0]}`, 'PATCH', { pickupEnabled: true }, adminCookie), {
      params: Promise.resolve({ id: branchIds[0] }),
    })).status, 200);

    const adminCategories = await listAdminCategories(apiRequest('/api/v1/admin/categories', 'GET', undefined, adminCookie));
    assert.equal(adminCategories.status, 200);
    const adminCategoriesPayload = await adminCategories.json() as { categories: { id: string; active: boolean }[] };
    assert.ok(adminCategoriesPayload.categories.some((category) => category.id === categoryId && category.active));
    const hideCategory = await updateCategory(apiRequest(`/api/v1/admin/categories/${categoryId}`, 'PATCH', {
      description: 'Hidden during integration test', imageUrl: 'https://images.example.test/category.jpg', active: false,
    }, adminCookie), { params: Promise.resolve({ id: categoryId }) });
    assert.equal(hideCategory.status, 200);
    const hiddenCategories = await listCategories();
    const hiddenCategoriesPayload = await hiddenCategories.json() as { categories: { id: string }[] };
    assert.ok(!hiddenCategoriesPayload.categories.some((category) => category.id === categoryId));
    const hiddenProducts = await listProducts(apiRequest(`/api/v1/products?category=${categoryId}`));
    const hiddenProductsPayload = await hiddenProducts.json() as { products: { id: string }[] };
    assert.ok(!hiddenProductsPayload.products.some((product) => product.id === mainProduct.id));
    assert.equal((await db.category.findUniqueOrThrow({ where: { id: categoryId } })).imageUrl, 'https://images.example.test/category.jpg');
    const publishCategory = await updateCategory(apiRequest(`/api/v1/admin/categories/${categoryId}`, 'PATCH', {
      active: true,
    }, adminCookie), { params: Promise.resolve({ id: categoryId }) });
    assert.equal(publishCategory.status, 200);

    const catalogResponse = await listProducts(apiRequest(`/api/v1/products?category=${categoryId}&q=${encodeURIComponent(mainProduct.name)}`));
    assert.equal(catalogResponse.status, 200);
    const catalogPayload = await catalogResponse.json() as { products: { id: string }[] };
    assert.ok(catalogPayload.products.some((product) => product.id === mainProduct.id));
    const publicCategory = await getPublicCategory(categoryId);
    assert.equal(publicCategory?.description, 'Hidden during integration test');
    assert.equal(publicCategory?.imageUrl, 'https://images.example.test/category.jpg');
    const productResponse = await getProduct(apiRequest(`/api/v1/products/${mainProduct.id}`), { params: Promise.resolve({ id: mainProduct.id }) });
    assert.equal(productResponse.status, 200);

    const quoteResponse = await quoteCart(apiRequest('/api/v1/cart/quote', 'POST', {
      items: [{ productId: mainProduct.id, qty: 1, size: 'M' }], deliveryMethod: 'DELIVERY',
    }));
    assert.equal(quoteResponse.status, 200);
    const quotePayload = await quoteResponse.json() as { items: { unitSale: number; stock: number }[]; quote: { shippingFee: number } };
    assert.equal(quotePayload.items[0].unitSale, 10_000);
    assert.equal(quotePayload.items[0].stock, 20);
    assert.equal(quotePayload.quote.shippingFee, 1_234, 'administrator shipping settings affect the server quote');

    const draftResponse = await createAdminProduct(apiRequest('/api/v1/admin/products', 'POST', {
      name: `Draft ${suffix}`, description: 'Admin integration draft', categoryId, price: 5_000, salePrice: null,
      legacyId: null, images: [], variants: [{ size: '', color: '', stock: 2, priceOverride: null }],
    }, adminCookie));
    assert.equal(draftResponse.status, 201);
    const draftPayload = await draftResponse.json() as { product: { id: string } };
    const draftId = draftPayload.product.id;
    productIds.push(draftId);
    const draftDetail = await getProduct(apiRequest(`/api/v1/products/${draftId}`), { params: Promise.resolve({ id: draftId }) });
    assert.equal(draftDetail.status, 404, 'new products stay private until published');
    const draftRow = await db.product.findUniqueOrThrow({ where: { id: draftId }, include: { variants: true } });
    const duplicateVariant = await updateProduct(apiRequest(`/api/v1/admin/products/${draftId}`, 'PATCH', {
      name: `Must Roll Back ${suffix}`, active: true,
      variants: [{ size: '', color: '', stock: 1 }],
    }, adminCookie), { params: Promise.resolve({ id: draftId }) });
    assert.equal(duplicateVariant.status, 409);
    const rolledBackProduct = await db.product.findUniqueOrThrow({ where: { id: draftId }, include: { variants: true } });
    assert.equal(rolledBackProduct.active, false, 'a duplicate variant rolls back the full product update');
    assert.equal(rolledBackProduct.name, `Draft ${suffix}`);
    assert.equal(rolledBackProduct.variants.length, 1);
    const editResponse = await updateProduct(apiRequest(`/api/v1/admin/products/${draftId}`, 'PATCH', {
      name: `Published ${suffix}`, description: 'Published by integration test', price: 5_500, salePrice: 4_500, active: true,
      variants: [
        { id: draftRow.variants[0].id, size: 'M', color: 'Blue', stock: 7, priceOverride: 4_200 },
        { size: 'S', color: 'Red', stock: 3, priceOverride: null },
      ],
      images: ['/products/b1.jpg', 'https://images.example.test/integration-book.jpg'],
    }, adminCookie), { params: Promise.resolve({ id: draftId }) });
    assert.equal(editResponse.status, 200);
    const publishedProduct = await getProduct(apiRequest(`/api/v1/products/${draftId}`), { params: Promise.resolve({ id: draftId }) });
    assert.equal(publishedProduct.status, 200);
    const publishedPayload = await publishedProduct.json() as { product: { name: string; salePrice: number | null; variants: { size: string; color: string; stock: number }[] } };
    assert.equal(publishedPayload.product.name, `Published ${suffix}`);
    assert.equal(publishedPayload.product.salePrice, 4_500);
    assert.deepEqual(publishedPayload.product.variants.map(({ size, color, stock }) => ({ size, color, stock })).sort((a, b) => a.size.localeCompare(b.size)), [
      { size: 'M', color: 'Blue', stock: 7 },
      { size: 'S', color: 'Red', stock: 3 },
    ]);
    const editedProduct = await db.product.findUniqueOrThrow({ where: { id: draftId }, include: { variants: true, images: { orderBy: { sort: 'asc' } } } });
    assert.equal(editedProduct.variants.find((variant) => variant.size === 'M')?.priceOverride, 4_200);
    assert.deepEqual(editedProduct.images.map((image) => image.url), ['/products/b1.jpg', 'https://images.example.test/integration-book.jpg']);

    const runner = createPrismaOrderRunner(db);
    const checkout = (productId: string, address: string, coupon = '') => parseCheckout({
      items: [{ productId, qty: 1, size: 'M' }],
      deliveryMethod: 'DELIVERY',
      city: 'Cairo',
      address,
      customerName: 'Integration Customer',
      customerPhone: phone,
      paymentMethod: 'COD',
      couponCode: coupon,
    });

    const first = await createOrder(runner, checkout(mainProduct.id, '1 Test Street'), null);
    await db.product.update({ where: { id: mainProduct.id }, data: { price: 12_000 } });
    const retry = await createOrder(runner, checkout(mainProduct.id, '1 Test Street'), null);
    assert.equal(retry.duplicate, true);
    assert.equal(retry.id, first.id);
    assert.equal(retry.total, first.total, 'a retry must return the originally accepted total');

    const sameTotalDifferentRequest = await createOrder(runner, checkout(mainProduct.id, '2 Test Street'), null);
    assert.equal(sameTotalDifferentRequest.duplicate, false);
    assert.notEqual(sameTotalDifferentRequest.id, first.id);

    const identicalConcurrent = await Promise.all([
      createOrder(runner, checkout(mainProduct.id, '3 Test Street'), null),
      createOrder(runner, checkout(mainProduct.id, '3 Test Street'), null),
    ]);
    assert.equal(identicalConcurrent.filter((order) => !order.duplicate).length, 1);
    assert.equal(identicalConcurrent[0].id, identicalConcurrent[1].id);

    const stockRace = await Promise.allSettled([
      createOrder(runner, checkout(limitedProduct.id, '4 Test Street'), null),
      createOrder(runner, checkout(limitedProduct.id, '5 Test Street'), null),
    ]);
    assert.equal(stockRace.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal((await db.productVariant.findUniqueOrThrow({ where: { id: couponProduct.variants[0].id } })).stock, 5);
    assert.equal((await db.productVariant.findUniqueOrThrow({ where: { id: limitedProduct.variants[0].id } })).stock, 0);

    const couponRace = await Promise.allSettled([
      runner.run(async (tx) => {
        assert.equal(await tx.reserveStock(couponProduct.variants[0].id, 1), true);
        if (!(await tx.consumeCoupon(couponCode))) throw new Error('coupon limit reached');
      }),
      runner.run(async (tx) => {
        assert.equal(await tx.reserveStock(couponProduct.variants[0].id, 1), true);
        if (!(await tx.consumeCoupon(couponCode))) throw new Error('coupon limit reached');
      }),
    ]);
    assert.equal(couponRace.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal((await db.coupon.findUniqueOrThrow({ where: { code: couponCode } })).uses, 1);
    assert.equal((await db.productVariant.findUniqueOrThrow({ where: { id: couponProduct.variants[0].id } })).stock, 4,
      'the losing coupon transaction must roll its stock reservation back');

    const checkoutResponse = await submitOrder(apiRequest('/api/v1/orders', 'POST', {
      items: [{ productId: mainProduct.id, qty: 1, size: 'M' }], deliveryMethod: 'DELIVERY', city: 'Cairo',
      address: `6 Test Street ${suffix}`, customerName: 'Integration Customer', customerPhone: phone, paymentMethod: 'COD',
    }, customerCookie));
    assert.equal(checkoutResponse.status, 201);
    const checkoutPayload = await checkoutResponse.json() as { order: { id: string; total: number; paymentStatus: string } };
    assert.equal(checkoutPayload.order.paymentStatus, 'AWAITING_PAYMENT');
    assert.equal((await db.productVariant.findUniqueOrThrow({ where: { id: mainProduct.variants[0].id } })).stock, 16);
    const customerOrdersResponse = await listCustomerOrders(apiRequest('/api/v1/orders', 'GET', undefined, customerCookie));
    assert.equal(customerOrdersResponse.status, 200);
    const adminOrdersResponse = await listAdminOrders(apiRequest('/api/v1/admin/orders', 'GET', undefined, adminCookie));
    assert.equal(adminOrdersResponse.status, 200);
    const invalidDateFilter = await listAdminOrders(apiRequest('/api/v1/admin/orders?from=2026-02-30', 'GET', undefined, adminCookie));
    assert.equal(invalidDateFilter.status, 400, 'invalid calendar dates are rejected instead of silently ignored');
    const reversedDateFilter = await listAdminOrders(apiRequest('/api/v1/admin/orders?from=2026-02-02&to=2026-02-01', 'GET', undefined, adminCookie));
    assert.equal(reversedDateFilter.status, 400, 'date ranges must be ordered');
    const adminOrdersPayload = await adminOrdersResponse.json() as { orders: { id: string }[] };
    assert.ok(adminOrdersPayload.orders.some((order) => order.id === checkoutPayload.order.id));
    const detailResponse = await getAdminOrder(apiRequest(`/api/v1/admin/orders/${checkoutPayload.order.id}`, 'GET', undefined, adminCookie), {
      params: Promise.resolve({ id: checkoutPayload.order.id }),
    });
    assert.equal(detailResponse.status, 200);
    const statusResponse = await updateOrder(apiRequest(`/api/v1/admin/orders/${checkoutPayload.order.id}`, 'PATCH', { status: 'PREPARING' }, adminCookie), {
      params: Promise.resolve({ id: checkoutPayload.order.id }),
    });
    assert.equal(statusResponse.status, 200);
    const deliveryResponse = await updateOrder(apiRequest(`/api/v1/admin/orders/${checkoutPayload.order.id}`, 'PATCH', { status: 'OUT_FOR_DELIVERY' }, adminCookie), {
      params: Promise.resolve({ id: checkoutPayload.order.id }),
    });
    assert.equal(deliveryResponse.status, 200);
    const deliveredResponse = await updateOrder(apiRequest(`/api/v1/admin/orders/${checkoutPayload.order.id}`, 'PATCH', { status: 'DELIVERED' }, adminCookie), {
      params: Promise.resolve({ id: checkoutPayload.order.id }),
    });
    assert.equal(deliveredResponse.status, 200);
    const paidCancellation = await updateOrder(apiRequest(`/api/v1/admin/orders/${checkoutPayload.order.id}`, 'PATCH', { status: 'CANCELLED' }, adminCookie), {
      params: Promise.resolve({ id: checkoutPayload.order.id }),
    });
    assert.equal(paidCancellation.status, 409, 'a delivered COD order cannot be cancelled without a refund');
    assert.equal((await db.productVariant.findUniqueOrThrow({ where: { id: mainProduct.variants[0].id } })).stock, 16);

    const orderCountBeforeUnavailablePayment = await db.order.count({ where: { customerPhone: phone } });
    const unavailablePayment = await submitOrder(apiRequest('/api/v1/orders', 'POST', {
      items: [{ productId: mainProduct.id, qty: 1, size: 'M' }], deliveryMethod: 'DELIVERY', city: 'Cairo',
      address: `Payment Test ${suffix}`, customerName: 'Integration Customer', customerPhone: phone, paymentMethod: 'FAWRY',
    }, customerCookie));
    assert.equal(unavailablePayment.status, 422, 'unconfigured online payments stay unavailable');
    assert.equal(await db.order.count({ where: { customerPhone: phone } }), orderCountBeforeUnavailablePayment);
    assert.equal((await db.productVariant.findUniqueOrThrow({ where: { id: mainProduct.variants[0].id } })).stock, 16);

    const cancellation = await submitOrder(apiRequest('/api/v1/orders', 'POST', {
      items: [{ productId: mainProduct.id, qty: 1, size: 'M' }], deliveryMethod: 'DELIVERY', city: 'Cairo',
      address: `7 Test Street ${suffix}`, customerName: 'Integration Customer', customerPhone: phone, paymentMethod: 'COD',
    }, customerCookie));
    assert.equal(cancellation.status, 201);
    const cancellationPayload = await cancellation.json() as { order: { id: string } };
    const cancelResponse = await updateOrder(apiRequest(`/api/v1/admin/orders/${cancellationPayload.order.id}`, 'PATCH', { status: 'CANCELLED' }, adminCookie), {
      params: Promise.resolve({ id: cancellationPayload.order.id }),
    });
    assert.equal(cancelResponse.status, 200);
    assert.equal((await db.productVariant.findUniqueOrThrow({ where: { id: mainProduct.variants[0].id } })).stock, 16,
      'cancelling a reserved order restores inventory exactly once');
    const orderCount = await db.order.count({ where: { customerPhone: phone } });
    const rejectedCheckout = await submitOrder(apiRequest('/api/v1/orders', 'POST', {
      items: [{ productId: limitedProduct.id, qty: 2, size: 'M' }], deliveryMethod: 'DELIVERY', city: 'Cairo',
      address: `8 Test Street ${suffix}`, customerName: 'Integration Customer', customerPhone: phone, paymentMethod: 'COD',
    }, customerCookie));
    assert.equal(rejectedCheckout.status, 409);
    assert.equal(await db.order.count({ where: { customerPhone: phone } }), orderCount, 'a failed checkout creates no order row');
    assert.equal((await db.productVariant.findUniqueOrThrow({ where: { id: limitedProduct.variants[0].id } })).stock, 0,
      'a failed checkout cannot decrement stock below zero');

    const logoutResponse = await logout(apiRequest('/api/v1/auth/logout', 'POST', {}, replacementCookie));
    assert.equal(logoutResponse.status, 200);
    assert.equal((await listAdminOrders(apiRequest('/api/v1/admin/orders', 'GET', undefined, replacementCookie))).status, 401,
      'logout revokes the current server-side session');
    assert.equal((await listAdminOrders(apiRequest('/api/v1/admin/orders', 'GET', undefined, adminCookie))).status, 401,
      'logout revokes other existing sessions for the same administrator');
  } finally {
    try {
      await Promise.all(branchIds.map((id) => db.branch.deleteMany({ where: { id } })));
      await Promise.all(tierIds.map((id) => db.discountTier.deleteMany({ where: { id } })));
      await db.order.deleteMany({ where: { customerPhone: phone } });
      await db.coupon.deleteMany({ where: { code: { in: [couponCode, managedCouponCode] } } });
      await db.product.deleteMany({ where: { id: { in: productIds } } });
      await db.user.deleteMany({ where: { id: { in: userIds } } });
      if (createdCategory) await db.category.deleteMany({ where: { id: categoryId } });
      if (codTouched && previousCod) {
        await db.paymentMethodConfig.update({
          where: { code: 'COD' },
          data: {
            name: previousCod.name,
            description: previousCod.description,
            enabled: previousCod.enabled,
            sort: previousCod.sort,
            status: previousCod.status,
            integrationNotes: previousCod.integrationNotes,
          },
        });
      } else if (codTouched) {
        await db.paymentMethodConfig.deleteMany({ where: { code: 'COD' } });
      }
      if (storeSettingsTouched) {
        await db.storeSetting.deleteMany({ where: { key: { in: ['shippingFee', 'freeShippingMin'] } } });
        if (previousStoreSettings.length) {
          await db.storeSetting.createMany({
            data: previousStoreSettings.map(({ key, value, updatedAt }) => ({
              key,
              value: value === null ? Prisma.JsonNull : value,
              updatedAt,
            })),
          });
        }
        await db.storeSetting.deleteMany({ where: { key: 'storefront' } });
        if (previousStorefront) {
          await db.storeSetting.create({
            data: {
              key: 'storefront',
              value: previousStorefront.value === null ? Prisma.JsonNull : previousStorefront.value,
              updatedAt: previousStorefront.updatedAt,
            },
          });
        }
      }
    } finally {
      await db.$disconnect();
    }
  }
});
