export const dynamic = 'force-dynamic';
// Liveness only. DB readiness check is added in Stage 2 together with the Prisma client singleton.
export function GET() {
  return Response.json({ ok: true, service: 'devx-store', stage: 1, time: new Date().toISOString() });
}
