import { db } from "@/lib/db";
import { checkS3 } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Safe diagnostics: reports which settings exist and whether the database works, never their values.
export async function GET() {
  const demoEmail = (process.env.DEMO_EMAIL ?? "demo@stayproof.app").toLowerCase();
  const out: Record<string, unknown> = {
    database_url_set: Boolean(process.env.DATABASE_URL ?? process.env.POSTGRES_URL),
    session_secret_set: Boolean(process.env.SESSION_SECRET),
  };
  try {
    const sql = await db();
    const [{ users }] = await sql<{ users: number }[]>`select count(*)::int as users from users`;
    const [demo] = await sql`select 1 from users where email = ${demoEmail}`;
    Object.assign(out, { database: "ok", users, demo_account_ready: Boolean(demo), photo_storage: await checkS3() });
  } catch (e) {
    out.database = "error";
    out.error = e instanceof Error ? e.message.replace(/postgres(ql)?:\/\/\S+/gi, "[url]") : String(e);
  }
  return Response.json(out, { status: out.database === "ok" ? 200 : 500 });
}
