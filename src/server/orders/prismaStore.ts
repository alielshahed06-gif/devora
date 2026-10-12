import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from '../../lib/prisma';
import type { NewOrder, OrderRunner, OrderTx } from './createOrder';
import type { ConfigStatus } from './rules';

type Tx = Prisma.TransactionClient;

function makeTx(tx: Tx): OrderTx {
  return {
    async findProducts(refs) {
      const rows = await tx.product.findMany({ where: { OR: [{ id: { in: refs } }, { legacyId: { in: refs } }] }, include: { variants: true } });
      return rows.map((p) => ({ id: p.id, legacyId: p.legacyId, name: p.name, categoryId: p.categoryId, price: p.price, salePrice: p.salePrice, active: p.active,
        variants: p.variants.map((v) => ({ id: v.id, size: v.size, color: v.color, priceOverride: v.priceOverride, stock: v.stock })) }));
    },
    async pricingConfig() {
      const [tiers, coupons, settings] = await Promise.all([tx.discountTier.findMany(), tx.coupon.findMany({ where: { active: true } }), tx.storeSetting.findMany({ where: { key: { in: ['shippingFee', 'freeShippingMin'] } } })]);
      const num = (k: string) => { const v = settings.find((s) => s.key === k)?.value; return typeof v === 'number' && Number.isFinite(v) ? v : null; };
      return {
        tiers: tiers.map((t) => ({ min: t.minTotal, rate: t.ratePct })),
        coupons: coupons.map((c) => ({ code: c.code, label: c.label, type: c.type === 'PERCENT' ? 'percent' as const : 'fixed' as const, value: c.value, minOrder: c.minOrder, active: c.active,
          startsAt: c.startsAt?.toISOString() ?? null, expiresAt: c.expiresAt?.toISOString() ?? null, maxUses: c.maxUses, uses: c.uses, categories: c.categoryIds, productIds: c.productIds })),
        shippingFee: num('shippingFee'), freeShippingMin: num('freeShippingMin'),
      };
    },
    async paymentConfig(code) {
      const c = await tx.paymentMethodConfig.findUnique({ where: { code: code as never } });
      return c ? { code: c.code, enabled: c.enabled, status: c.status as ConfigStatus } : null;
    },
    async branchActive(id) { return !!(await tx.branch.findFirst({ where: { id, active: true, pickupEnabled: true }, select: { id: true } })); },
    async reserveStock(variantId, qty) { return (await tx.productVariant.updateMany({ where: { id: variantId, stock: { gte: qty } }, data: { stock: { decrement: qty } } })).count === 1; },
    async consumeCoupon(code) { return (await tx.$executeRaw`UPDATE "Coupon" SET "uses" = "uses" + 1 WHERE "code" = ${code} AND ("maxUses" IS NULL OR "uses" < "maxUses")`) === 1; },
    async lockDuplicateRequest(fingerprint) {
      const key = Buffer.from(fingerprint, 'hex').readBigInt64BE(0);
      await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_advisory_xact_lock(${key}) IS NULL AS locked`;
    },
    async findRecentDuplicate(userId, phone, method, since, fingerprint) {
      const match = await tx.order.findFirst({
        where: {
          userId, customerPhone: phone, paymentMethod: method as never, requestFingerprint: fingerprint,
          createdAt: { gte: since }, status: { not: 'CANCELLED' },
        },
        select: { id: true, number: true, total: true },
        orderBy: { createdAt: 'desc' },
      });
      return match ? { id: match.id, number: match.number, total: match.total } : null;
    },
    async insertOrder(o: NewOrder) {
      const { items, ...rest } = o;
      const created = await tx.order.create({
        data: { ...rest, paymentMethod: rest.paymentMethod as never, status: 'CONFIRMED', paymentStatus: 'AWAITING_PAYMENT',
          items: { create: items }, history: { create: { status: 'CONFIRMED' } } },
        select: { id: true, number: true },
      });
      return created;
    },
  };
}
/** Interactive transaction at the default isolation; stock safety comes from the conditional UPDATE, not from read-then-write. */
export function createPrismaOrderRunner(client: PrismaClient = prisma): OrderRunner {
  return { run: (fn) => client.$transaction((tx) => fn(makeTx(tx)), { timeout: 15_000, maxWait: 5_000 }) };
}

export const prismaOrderRunner = createPrismaOrderRunner();

/** Non-transactional read access for quoting (reads only). */
export const readStore = (): OrderTx => makeTx(prisma as unknown as Tx);
