# Database Schema (PostgreSQL 16, Prisma 6)

Files: `prisma/schema.prisma`, `prisma/migrations/20261010000000_init/migration.sql` (21 tables, 11 enums). Applied successfully to a local PG16 and checked by `scripts/verify-migration.sh`. **`prisma validate/generate` were NOT run (CLI unavailable offline).**

## Entities and why (each maps to a real source feature)
| Table | Source feature |
|---|---|
| User, Address | register/login/account/saved addresses/prefs/points |
| Branch | `/branches`, pickup at checkout (15 names, empty details) |
| Category | 4 fixed ids: books, tshirts, notebooks, other |
| Product, ProductImage, ProductVariant | catalog, size/colour/stock, per-variant price override, up to 4 images |
| Review, WishlistItem | ratings/comments (one per user/product, "verified" if purchased), hearts |
| Coupon, DiscountTier | `/admin` coupons; order-total tiers |
| PaymentMethodConfig, StoreSetting | enabled methods; shipping fee, free-shipping min, support contacts, policies, receiving accounts |
| Order, OrderItem, OrderStatusHistory | orders with immutable snapshot of names/prices |
| PaymentAttempt | customer submits transfer reference → admin reviews |
| Notification | bell + order updates |
| Ticket | complaints/inquiries (+reply, status) |
| PasswordRecoveryRequest | `/recover` (admin-assisted in source) |
| AuditLog | required for admin actions (not in source UI; added deliberately) |
Deferred (no source evidence): Governorate/DeliveryArea, Survey/Response, EbookEntitlement, Bundle/Add-on, WebhookEvent, Cart/CartItem (cart is browser-side), Inventory movement ledger.

## Money
Integer **piasters** (`Int`, max ≈ 21.4M EGP per column – fine). Percent math: `round(amount*rate/100)` half-up. Fixed coupon value in piasters.

## Constraints (SQL, beyond Prisma)
`stock >= 0`; `price > 0`; `salePrice` null or `0 < sale < price`; rating 1..5; tier rate 1..100; `qty > 0`; `total >= 0`; delivery orders need an address and pickup orders need a branch; coupon value valid. Unique: `User.phone`, `User.email`, `Product.legacyId`, `(productId,size,color)`, `(productId,userId)` review, `(method,reference)` payment reference, `Order.number` (sequence restarted at 1001 → "DX-1001").

## Statuses (separate axes)
* `Order.status`: CONFIRMED → PREPARING → OUT_FOR_DELIVERY | READY_FOR_PICKUP → DELIVERED; CANCELLED (restores stock).
* `Order.paymentStatus`: AWAITING_PAYMENT → PENDING_REVIEW → PAID (COD stays AWAITING until delivery handling decided in Stage 3).
* `PaymentAttempt.status`: SUBMITTED / ACCEPTED / REJECTED.

## Transactions & concurrency
Create order: `BEGIN`; load variants `FOR UPDATE` (or `UPDATE … SET stock=stock-$qty WHERE id=$v AND stock>=$qty RETURNING` and fail on 0 rows); conditional coupon update `uses=uses+1 WHERE uses<maxUses`; insert order/items/history; `COMMIT`. Quote is recomputed server-side inside the transaction. Cancel/reactivate adjust stock in a transaction with the same guard.

## Indexes
Order(userId,createdAt), (status), (paymentStatus), (customerPhone); Product(categoryId,active), (createdAt); Notification(userId,read,createdAt); Ticket(status,createdAt); AuditLog(entity,entityId),(createdAt). Product text search: add `pg_trgm`/FTS in Stage 2 (original does substring match on name+description).

## Migration approach
`prisma migrate deploy` in CI/prod; `prisma migrate dev` locally; every future change = new migration folder; keep the CHECK constraints in each SQL (Prisma cannot model them — re-add after any `migrate dev` that regenerates). Seed (Stage 2): from `reference/extracted/*.json`, converting EGP → piasters, `legacyId` = original id, empty `size/color` → `''`, order sequence starts 1001.

## Known risks
Hand-written SQL may drift from `schema.prisma` (default of `Order.number`, index names). Run `prisma migrate diff` first thing in Stage 2.
