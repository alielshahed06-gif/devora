import type { Prisma } from "@prisma/client";
/** Append-only audit trail; written inside the same transaction as the change it describes. */
export const audit = (tx: Prisma.TransactionClient, actorId: string, action: string, entity: string, entityId: string | null, before: unknown, after: unknown) =>
  tx.auditLog.create({ data: { actorId, action, entity, entityId, before: (before ?? undefined) as Prisma.InputJsonValue | undefined, after: (after ?? undefined) as Prisma.InputJsonValue | undefined } });
