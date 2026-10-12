-- Dev-X Book Store Plan C — initial schema (hand-written in Stage 1; verify with prisma migrate diff in Stage 2)

CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'STAFF', 'ADMIN');
CREATE TYPE "AuthProvider" AS ENUM ('LOCAL', 'GOOGLE', 'FACEBOOK');
CREATE TYPE "DeliveryMethod" AS ENUM ('DELIVERY', 'PICKUP');
CREATE TYPE "OrderStatus" AS ENUM ('CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'READY_FOR_PICKUP', 'DELIVERED', 'CANCELLED');
CREATE TYPE "PaymentStatus" AS ENUM ('AWAITING_PAYMENT', 'PENDING_REVIEW', 'PAID');
CREATE TYPE "PaymentMethodCode" AS ENUM ('COD', 'FAWRY', 'INSTAPAY', 'WALLET');
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('SUBMITTED', 'ACCEPTED', 'REJECTED');
CREATE TYPE "CouponType" AS ENUM ('PERCENT', 'FIXED');
CREATE TYPE "TicketType" AS ENUM ('COMPLAINT', 'INQUIRY');
CREATE TYPE "TicketStatus" AS ENUM ('RECEIVED', 'IN_PROGRESS', 'RESOLVED');
CREATE TYPE "RecoveryStatus" AS ENUM ('OPEN', 'DONE', 'CLOSED');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "passwordHash" TEXT,
  "provider" "AuthProvider" NOT NULL DEFAULT 'LOCAL',
  "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
  "prefOrderUpdates" BOOLEAN NOT NULL DEFAULT true,
  "prefOffers" BOOLEAN NOT NULL DEFAULT false,
  "points" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE TABLE "Address" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "label" TEXT NOT NULL DEFAULT '',
  "city" TEXT NOT NULL DEFAULT '',
  "address" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Branch" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT NOT NULL DEFAULT '',
  "hours" TEXT NOT NULL DEFAULT '',
  "phone" TEXT NOT NULL DEFAULT '',
  "mapUrl" TEXT NOT NULL DEFAULT '',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sort" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Branch_name_key" ON "Branch"("name");
CREATE TABLE "Category" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sort" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Product" (
  "id" TEXT NOT NULL,
  "legacyId" TEXT,
  "categoryId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "price" INTEGER NOT NULL,
  "salePrice" INTEGER,
  "attrs" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Product_legacyId_key" ON "Product"("legacyId");
CREATE TABLE "ProductImage" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "alt" TEXT NOT NULL DEFAULT '',
  "sort" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ProductVariant" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "size" TEXT NOT NULL DEFAULT '',
  "color" TEXT NOT NULL DEFAULT '',
  "priceOverride" INTEGER,
  "stock" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProductVariant_productId_size_color_key" ON "ProductVariant"("productId", "size", "color");
CREATE TABLE "Review" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT NOT NULL DEFAULT '',
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Review_productId_userId_key" ON "Review"("productId", "userId");
CREATE TABLE "WishlistItem" (
  "userId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("userId", "productId")
);
CREATE TABLE "Coupon" (
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "type" "CouponType" NOT NULL,
  "value" INTEGER NOT NULL,
  "minOrder" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "startsAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "maxUses" INTEGER,
  "uses" INTEGER NOT NULL DEFAULT 0,
  "categoryIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "productIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  CONSTRAINT "Coupon_pkey" PRIMARY KEY ("code")
);
CREATE TABLE "DiscountTier" (
  "id" TEXT NOT NULL,
  "minTotal" INTEGER NOT NULL,
  "ratePct" INTEGER NOT NULL,
  CONSTRAINT "DiscountTier_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DiscountTier_minTotal_key" ON "DiscountTier"("minTotal");
CREATE TABLE "PaymentMethodConfig" (
  "code" "PaymentMethodCode" NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "sort" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "PaymentMethodConfig_pkey" PRIMARY KEY ("code")
);
CREATE TABLE "StoreSetting" (
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoreSetting_pkey" PRIMARY KEY ("key")
);
CREATE TABLE "Order" (
  "id" TEXT NOT NULL,
  "number" SERIAL,
  "userId" TEXT,
  "customerName" TEXT NOT NULL,
  "customerPhone" TEXT NOT NULL,
  "deliveryMethod" "DeliveryMethod" NOT NULL,
  "deliveryCity" TEXT,
  "deliveryAddress" TEXT,
  "branchId" TEXT,
  "notes" TEXT NOT NULL DEFAULT '',
  "status" "OrderStatus" NOT NULL DEFAULT 'CONFIRMED',
  "paymentMethod" "PaymentMethodCode" NOT NULL,
  "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
  "couponCode" TEXT,
  "subtotalOriginal" INTEGER NOT NULL,
  "productDiscounts" INTEGER NOT NULL,
  "tierRatePct" INTEGER NOT NULL DEFAULT 0,
  "tierDiscount" INTEGER NOT NULL DEFAULT 0,
  "couponDiscount" INTEGER NOT NULL DEFAULT 0,
  "shippingFee" INTEGER NOT NULL DEFAULT 0,
  "total" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Order_number_key" ON "Order"("number");
CREATE TABLE "OrderItem" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "productId" TEXT,
  "variantId" TEXT,
  "name" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "size" TEXT NOT NULL DEFAULT '',
  "color" TEXT NOT NULL DEFAULT '',
  "qty" INTEGER NOT NULL,
  "unitOriginal" INTEGER NOT NULL,
  "unitSale" INTEGER NOT NULL,
  "lineOriginal" INTEGER NOT NULL,
  "lineSale" INTEGER NOT NULL,
  CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "OrderStatusHistory" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "status" "OrderStatus" NOT NULL,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PaymentAttempt" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "method" "PaymentMethodCode" NOT NULL,
  "reference" TEXT NOT NULL,
  "senderPhone" TEXT NOT NULL DEFAULT '',
  "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'SUBMITTED',
  "amount" INTEGER NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentAttempt_method_reference_key" ON "PaymentAttempt"("method", "reference");
CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "orderId" TEXT,
  "title" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "read" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Ticket" (
  "id" TEXT NOT NULL,
  "type" "TicketType" NOT NULL DEFAULT 'COMPLAINT',
  "userId" TEXT,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "orderId" TEXT,
  "message" TEXT NOT NULL,
  "status" "TicketStatus" NOT NULL DEFAULT 'RECEIVED',
  "reply" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PasswordRecoveryRequest" (
  "id" TEXT NOT NULL,
  "identifier" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "contact" TEXT NOT NULL DEFAULT '',
  "status" "RecoveryStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "doneAt" TIMESTAMP(3),
  CONSTRAINT "PasswordRecoveryRequest_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT,
  "before" JSONB,
  "after" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Address_userId_idx" ON "Address"("userId");
CREATE INDEX "Product_categoryId_active_idx" ON "Product"("categoryId", "active");
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");
CREATE INDEX "ProductImage_productId_sort_idx" ON "ProductImage"("productId", "sort");
CREATE INDEX "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE INDEX "Order_paymentStatus_idx" ON "Order"("paymentStatus");
CREATE INDEX "Order_customerPhone_idx" ON "Order"("customerPhone");
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderStatusHistory_orderId_at_idx" ON "OrderStatusHistory"("orderId", "at");
CREATE INDEX "PaymentAttempt_orderId_idx" ON "PaymentAttempt"("orderId");
CREATE INDEX "Notification_userId_read_createdAt_idx" ON "Notification"("userId", "read", "createdAt");
CREATE INDEX "Ticket_status_createdAt_idx" ON "Ticket"("status", "createdAt");
CREATE INDEX "PasswordRecoveryRequest_status_idx" ON "PasswordRecoveryRequest"("status");
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_couponCode_fkey" FOREIGN KEY ("couponCode") REFERENCES "Coupon"("code") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Integrity rules that Prisma cannot express (keep in every future schema diff)
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_stock_nonneg" CHECK ("stock" >= 0);
ALTER TABLE "Product" ADD CONSTRAINT "Product_price_pos" CHECK ("price" > 0);
ALTER TABLE "Product" ADD CONSTRAINT "Product_sale_lt_price" CHECK ("salePrice" IS NULL OR ("salePrice" > 0 AND "salePrice" < "price"));
ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "DiscountTier" ADD CONSTRAINT "DiscountTier_rate_range" CHECK ("ratePct" BETWEEN 1 AND 100);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_qty_pos" CHECK ("qty" > 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_total_nonneg" CHECK ("total" >= 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_delivery_target" CHECK (("deliveryMethod" = 'DELIVERY' AND "deliveryAddress" IS NOT NULL) OR ("deliveryMethod" = 'PICKUP' AND "branchId" IS NOT NULL));
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_value_pos" CHECK ("value" > 0 AND ("type" <> 'PERCENT' OR "value" <= 100));
-- Order numbers displayed as DX-<number>; original demo started at 1001
ALTER SEQUENCE "Order_number_seq" RESTART WITH 1001;
