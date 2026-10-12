import { getUser } from "@/server/auth/guard";
import { handle, ok } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const user = await getUser(req);
  return ok({ user: user ? { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, mustChangePassword: user.mustChangePassword } : null });
});
