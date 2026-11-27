import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listReports } from "@/lib/reports";
import { appOrigin } from "@/lib/origin";
import { logoutAction } from "@/app/actions";
import CopyField from "@/components/CopyField";

const STATUS: Record<string, [string, string]> = {
  draft: ["Draft", "bg-stone-100 text-stone-700"],
  awaiting_tenant: ["Awaiting tenant", "bg-amber-100 text-amber-800"],
  signed: ["Signed", "bg-emerald-100 text-emerald-800"],
};

export default async function Dashboard() {
  const user = await requireUser();
  const [list, origin] = await Promise.all([listReports(user.id), appOrigin()]);
  const mcpUrl = `${origin}/mcp/${user.api_key}`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Condition reports</h1>
          <p className="text-sm text-stone-600">Signed in as {user.name} ({user.email})</p>
        </div>
        <form action={logoutAction}>
          <button className="btn-ghost">Log out</button>
        </form>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <section>
          {list.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="font-medium">No reports yet</p>
              <p className="mt-1 text-sm text-stone-600">
                Connect Claude (right), then send it your move-in photos and ask: &ldquo;Make a condition report for this property.&rdquo;
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {list.map((r) => (
                <li key={r.id}>
                  <Link href={`/reports/${r.id}`} className="card block p-4 hover:border-brand">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{r.property_address}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS[r.status]?.[1] ?? "bg-stone-100 text-stone-700"}`}>
                        {STATUS[r.status]?.[0] ?? r.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-stone-600">
                      {r.tenant_name ? `Tenant: ${r.tenant_name} · ` : ""}Inspected {r.inspection_date} · {r.room_count} rooms ·{" "}
                      {r.item_count} items
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="card h-fit p-5">
          <h2 className="font-semibold">Connect your Claude</h2>
          <p className="mt-1 text-sm text-stone-600">This is your private connector link. Treat it like a password.</p>
          <div className="mt-3">
            <CopyField value={mcpUrl} />
          </div>
          <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-stone-700">
            <li>In Claude, open Settings, then Connectors.</li>
            <li>Choose &ldquo;Add custom connector&rdquo;, name it StayProof and paste the link.</li>
            <li>In a new chat, turn StayProof on, attach your move-in photos and ask for a condition report.</li>
          </ol>
        </aside>
      </div>
    </div>
  );
}
