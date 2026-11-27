import type { Item, PublicReport } from "@/lib/reports";
import ConditionBadge from "./ConditionBadge";
import { PhotoStrip } from "./ReportView";

const SEVERITY: Record<string, number> = { excellent: 0, good: 1, fair: 2, poor: 3, damaged: 4 };

export function changeOf(item: Item): "worse" | "same" | "better" | "pending" {
  if (!item.move_out_condition) return "pending";
  const d = SEVERITY[item.move_out_condition] - SEVERITY[item.condition];
  return d > 0 ? "worse" : d < 0 ? "better" : "same";
}

export function money(cents: number) {
  return (cents / 100).toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: cents % 100 ? 2 : 0 });
}

export function ChangeChip({ change }: { change: ReturnType<typeof changeOf> }) {
  const map = {
    worse: ["Worse", "bg-red-600 text-white"],
    same: ["No change", "bg-stone-100 text-stone-600"],
    better: ["Better", "bg-emerald-100 text-emerald-800"],
    pending: ["Not checked", "border border-dashed border-stone-300 text-stone-500"],
  } as const;
  const [label, cls] = map[change];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

/** Read-only side-by-side comparison, used on the tenant's link. */
export function ComparisonView({ report, token }: { report: PublicReport; token?: string }) {
  const all = report.rooms.flatMap((r) => r.items);
  const deductions = all.reduce((n, i) => n + i.deduction_cents, 0);
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold">Move-out comparison</h2>
      <p className="mt-1 text-sm text-stone-600">
        Move-out inspected {report.move_out_date}. Each item shows its signed move-in condition next to its move-out condition.
      </p>
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        <span className="card px-3 py-2">Worse than move-in: <b>{all.filter((i) => changeOf(i) === "worse").length}</b></span>
        <span className="card px-3 py-2">Proposed deductions: <b className="text-red-700">{money(deductions)}</b></span>
        {report.bond_cents > 0 && (
          <span className="card px-3 py-2">
            Refund of bond: <b className="text-emerald-700">{money(Math.max(0, report.bond_cents - deductions))}</b> of {money(report.bond_cents)}
          </span>
        )}
      </div>
      <div className="mt-4 space-y-4">
        {report.rooms.map((room) => (
          <div key={room.id} className="card overflow-hidden break-inside-avoid">
            <h3 className="border-b border-stone-200 bg-stone-50 px-4 py-2 font-semibold">{room.name}</h3>
            {(room.photos.length > 0 || room.move_out_photos.length > 0) && (
              <div className="grid border-b border-stone-100 pb-3 md:grid-cols-2">
                <div>
                  <p className="px-4 pt-3 text-xs uppercase tracking-wide text-stone-400">Move-in photos</p>
                  <PhotoStrip photos={room.photos} token={token} />
                </div>
                <div>
                  <p className="px-4 pt-3 text-xs uppercase tracking-wide text-stone-400">Move-out photos</p>
                  <PhotoStrip photos={room.move_out_photos} token={token} />
                </div>
              </div>
            )}
            <ul className="divide-y divide-stone-100">
              {room.items.map((i) => (
                <li key={i.id} className={`grid gap-2 px-4 py-3 md:grid-cols-[160px_1fr_1fr_90px] ${changeOf(i) === "worse" ? "bg-red-50/60" : ""}`}>
                  <div className="flex flex-wrap items-start gap-2">
                    <span className="font-medium">{i.name}</span>
                    <ChangeChip change={changeOf(i)} />
                  </div>
                  <div className="text-sm">
                    <ConditionBadge condition={i.condition} /> <span className="text-stone-600">{i.notes}</span>
                  </div>
                  <div className="text-sm">
                    {i.move_out_condition ? <ConditionBadge condition={i.move_out_condition} /> : null}{" "}
                    <span className="text-stone-600">{i.move_out_notes}</span>
                  </div>
                  <div className="text-right text-sm font-medium text-red-700">{i.deduction_cents ? money(i.deduction_cents) : ""}</div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
