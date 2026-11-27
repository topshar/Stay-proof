"use client";

import { useState, useTransition } from "react";
import type { Item, Report } from "@/lib/reports";
import { setBondAction, updateMoveOutAction } from "@/app/actions";
import ConditionBadge, { conditionClass } from "./ConditionBadge";
import PhotoUploader from "./PhotoUploader";
import { PhotoStrip } from "./ReportView";
import { ChangeChip, changeOf, money } from "./compare";

const CONDITIONS = ["excellent", "good", "fair", "poor", "damaged"] as const;
type Condition = (typeof CONDITIONS)[number];

function Row({ item, reportId, run }: { item: Item; reportId: string; run: (fn: () => Promise<unknown>) => void }) {
  const save = (patch: Parameters<typeof updateMoveOutAction>[2]) => run(() => updateMoveOutAction(reportId, item.id, patch));
  const ch = changeOf(item);
  return (
    <li className={`grid gap-3 px-4 py-3 md:grid-cols-[1fr_1fr_110px] ${ch === "worse" ? "bg-red-50/60" : ""}`}>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{item.name}</span>
          <ChangeChip change={ch} />
        </div>
        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-stone-400">Move-in</p>
        <div className="mt-1 flex items-start gap-2">
          <ConditionBadge condition={item.condition} />
          <p className="text-sm text-stone-600">{item.notes}</p>
        </div>
        {item.tenant_note && <p className="mt-1 text-xs text-amber-800">Tenant noted: {item.tenant_note}</p>}
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-stone-400 md:mt-7">Move-out</p>
        <div className="mt-1 space-y-2">
          <select
            aria-label={`Move-out condition of ${item.name}`}
            value={item.move_out_condition ?? ""}
            onChange={(e) => save({ condition: (e.target.value || null) as Condition | null })}
            className={`input ${item.move_out_condition ? "capitalize " + conditionClass(item.move_out_condition) : ""}`}
          >
            <option value="">Not checked yet</option>
            {CONDITIONS.map((c) => (
              <option key={c} value={c} className="bg-white text-stone-900">{c}</option>
            ))}
          </select>
          <textarea
            key={`mo-${item.move_out_notes}`}
            rows={2}
            defaultValue={item.move_out_notes}
            placeholder="What changed?"
            aria-label={`Move-out notes for ${item.name}`}
            className="input"
            onBlur={(e) => e.currentTarget.value !== item.move_out_notes && save({ notes: e.currentTarget.value })}
          />
        </div>
      </div>
      <label className="block md:mt-7">
        <span className="text-xs font-medium uppercase tracking-wide text-stone-400">Deduction</span>
        <div className="relative mt-1">
          <span className="pointer-events-none absolute left-3 top-2 text-sm text-stone-500">$</span>
          <input
            key={`d-${item.deduction_cents}`}
            type="number"
            min={0}
            step="1"
            inputMode="decimal"
            aria-label={`Deduction for ${item.name}`}
            defaultValue={item.deduction_cents ? item.deduction_cents / 100 : ""}
            placeholder="0"
            className="input !pl-7"
            onBlur={(e) => {
              const cents = Math.round((parseFloat(e.currentTarget.value) || 0) * 100);
              if (cents !== item.deduction_cents) save({ deduction_cents: cents });
            }}
          />
        </div>
      </label>
    </li>
  );
}

export default function MoveOutEditor({ report }: { report: Report }) {
  const [pending, start] = useTransition();
  const [onlyChanges, setOnlyChanges] = useState(false);
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); });
  const all = report.rooms.flatMap((r) => r.items);
  const checked = all.filter((i) => i.move_out_condition).length;
  const worse = all.filter((i) => changeOf(i) === "worse").length;
  const deductions = all.reduce((n, i) => n + i.deduction_cents, 0);
  const refund = Math.max(0, report.bond_cents - deductions);

  return (
    <div className="mt-4">
      <p className="text-xs font-medium uppercase tracking-wide text-brand">Move-out comparison</p>
      <h1 className="mt-1 text-2xl font-semibold">{report.property_address}</h1>
      <p className="mt-1 text-sm text-stone-600">
        Move-in {report.inspection_date} (signed by {report.landlord_signed_name} and {report.tenant_signed_name}) · Move-out{" "}
        {report.move_out_date ?? "not started"}
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs text-stone-500">Items checked</p>
          <p className="mt-1 text-xl font-semibold">{checked} / {all.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-stone-500">Worse than move-in</p>
          <p className={`mt-1 text-xl font-semibold ${worse ? "text-red-700" : ""}`}>{worse}</p>
        </div>
        <label className="card block p-4">
          <span className="text-xs text-stone-500">Bond held</span>
          <div className="relative mt-1">
            <span className="pointer-events-none absolute left-2 top-1.5 text-sm text-stone-500">$</span>
            <input
              key={`b-${report.bond_cents}`}
              type="number"
              min={0}
              aria-label="Bond held"
              defaultValue={report.bond_cents ? report.bond_cents / 100 : ""}
              placeholder="0"
              className="input !py-1 !pl-6 text-lg font-semibold"
              onBlur={(e) => {
                const c = Math.round((parseFloat(e.currentTarget.value) || 0) * 100);
                if (c !== report.bond_cents) run(() => setBondAction(report.id, c));
              }}
            />
          </div>
        </label>
        <div className="card p-4">
          <p className="text-xs text-stone-500">Deductions · Refund to tenant</p>
          <p className="mt-1 text-xl font-semibold">
            <span className="text-red-700">{money(deductions)}</span>
            <span className="text-stone-400"> · </span>
            <span className="text-emerald-700">{money(refund)}</span>
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={onlyChanges} onChange={(e) => setOnlyChanges(e.target.checked)} />
          Show only items that got worse
        </label>
        <span className="text-xs text-stone-500" aria-live="polite">{pending ? "Saving…" : "Changes save automatically"}</span>
      </div>

      <div className="mt-4 space-y-5">
        {report.rooms.map((room) => {
          const items = onlyChanges ? room.items.filter((i) => changeOf(i) === "worse") : room.items;
          if (onlyChanges && items.length === 0) return null;
          return (
            <section key={room.id} className="card overflow-hidden">
              <h2 className="border-b border-stone-200 bg-stone-50 px-4 py-2 font-semibold">{room.name}</h2>
              <div className="grid gap-2 border-b border-stone-100 pb-3 md:grid-cols-2">
                <div>
                  <p className="px-4 pt-3 text-xs font-medium uppercase tracking-wide text-stone-400">Move-in photos</p>
                  {room.photos.length ? <PhotoStrip photos={room.photos} /> : <p className="px-4 pt-2 text-xs text-stone-400">None</p>}
                </div>
                <div>
                  <p className="px-4 pt-3 text-xs font-medium uppercase tracking-wide text-stone-400">Move-out photos</p>
                  <PhotoUploader reportId={report.id} roomId={room.id} photos={room.move_out_photos} phase="move_out" />
                </div>
              </div>
              <ul className="divide-y divide-stone-100">
                {items.map((item) => (
                  <Row key={item.id} item={item} reportId={report.id} run={run} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
