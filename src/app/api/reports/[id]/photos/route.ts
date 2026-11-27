import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { savePhoto } from "@/lib/storage";

export const dynamic = "force-dynamic";
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request, ctx: RouteContext<"/api/reports/[id]/photos">) {
  const { id } = await ctx.params;
  const user = await getUser();
  if (!user) return Response.json({ error: "Not logged in" }, { status: 401 });
  const sql = await db();
  const [report] = await sql`select status from reports where id = ${id} and user_id = ${user.id}`;
  if (!report) return Response.json({ error: "Report not found" }, { status: 404 });
  if (report.status !== "draft") return Response.json({ error: "This report is signed and locked" }, { status: 409 });

  const form = await req.formData();
  const file = form.get("file");
  const roomId = String(form.get("roomId") ?? "") || null;
  if (!(file instanceof File)) return Response.json({ error: "No file" }, { status: 400 });
  if (!file.type.startsWith("image/")) return Response.json({ error: "Only images can be uploaded" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "Image is too large" }, { status: 413 });
  if (roomId) {
    const [room] = await sql`select 1 from rooms where id = ${roomId} and report_id = ${id}`;
    if (!room) return Response.json({ error: "Room not found" }, { status: 404 });
  }
  const photoId = await savePhoto(id, roomId, new Uint8Array(await file.arrayBuffer()), file.type);
  await sql`update reports set updated_at = now() where id = ${id}`;
  return Response.json({ id: photoId });
}
