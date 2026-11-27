import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { photoResponse } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Landlord (logged in, owns the report) or tenant (has the share token) can view a photo.
export async function GET(req: Request, ctx: RouteContext<"/api/photos/[id]">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const token = new URL(req.url).searchParams.get("t") ?? "";
  const sql = await db();
  const [row] = await sql<
    { id: string; storage: string; storage_key: string; content_type: string; data: Buffer | null; user_id: string; share_token: string; status: string }[]
  >`select p.id, p.storage, p.storage_key, p.content_type, p.data, r.user_id, r.share_token, r.status
    from photos p join reports r on r.id = p.report_id where p.id = ${id}`;
  if (!row) return new Response("Not found", { status: 404 });
  const tenantOk = token && token === row.share_token && row.status !== "draft";
  if (!tenantOk) {
    const user = await getUser();
    if (!user || user.id !== row.user_id) return new Response("Not found", { status: 404 });
  }
  return photoResponse(row);
}
