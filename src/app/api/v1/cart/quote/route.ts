import { handle, ok, readJson, assertSameOrigin } from "@/server/http";
import { buildQuote } from "@/server/orders/createOrder";
import { readStore } from "@/server/orders/prismaStore";
import { parseQuote } from "@/server/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Server-side price quote. The client never supplies prices or totals. */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const b = parseQuote(await readJson(req));
  const { q, byRef } = await buildQuote(readStore(), b.items, b.couponCode, b.deliveryMethod);
  const items = b.items.map((item) => {
    const product = byRef.get(item.productId)!;
    const line = q.lines.find((candidate) =>
      candidate.productId === product.id && candidate.size === item.size && candidate.color === item.color);
    const variant = product.variants.find((candidate) =>
      candidate.size === (item.size ?? '') && candidate.color === (item.color ?? ''));
    return {
      cartProductId: item.productId,
      productId: product.id,
      name: product.name,
      size: item.size,
      color: item.color,
      qty: item.qty,
      unitOriginal: line?.unitOriginal ?? 0,
      unitSale: line?.unitSale ?? 0,
      lineSale: (line?.unitSale ?? 0) * item.qty,
      stock: variant?.stock ?? 0,
    };
  });
  return ok({ quote: q, items });
});
