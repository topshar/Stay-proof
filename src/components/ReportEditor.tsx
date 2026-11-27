"use client";

import { useState, useTransition, type ReactNode } from "react";
import type { Report } from "@/lib/reports";
import {
  addItemAction,
  addRoomAction,
  deleteItemAction,
  deleteReportAction,
  deleteRoomAction,
  renameRoomAction,
  updateItemAction,
  updateReportAction,
} from "@/app/actions";
import { conditionClass } from "./ConditionBadge";

const CONDITIONS = ["excellent", "good", "fair", "poor", "damaged"] as const;
type Condition = (typeof CONDITIONS)[number];

function useSaver() {
  const [pending, start] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      setSavedAt(Date.now());
    });
  return { pending, savedAt, run };
}

function AutoField({
  value,
  onSave,
  multiline,
  className,
  placeholder,
  type = "text",
  label,
}: {
  value: string;
  onSave: (v: string) => void;
  multiline?: boolean;
  className?: string;
  placeholder?: string;
  type?: string;
  label?: string;
}) {
  const common = {
    defaultValue: value,
    placeholder,
    "aria-label": label ?? placeholder,
    className: className ?? "input",
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const v = e.currentTarget.value;
      if (v !== value) onSave(v);
    },
  };
  return multiline ? <textarea rows={2} {...common} /> : <input type={type} {...common} />;
}

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-stone-500">{label}</span>
      {children}
    </label>
  );
}

export default function ReportEditor({ report }: { report: Report }) {
  const { pending, savedAt, run } = useSaver();
  const id = report.id;
  const all = report.rooms.flatMap((r) => r.items);
  const counts = CONDITIONS.map((c) => [c, all.filter((i) => i.condition === c).length] as const).filter(([, n]) => n > 0);

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-brand">Move-in condition report · {report.status}</p>
          <AutoField
            key={`addr-${report.property_address}`}
            value={report.property_address}
            label="Property address"
            className="mt-1 w-full rounded-md border border-transparent bg-transparent px-1 text-2xl font-semibold hover:border-stone-300 focus:border-brand focus:bg-white focus:outline-none"
            onSave={(v) => run(() => updateReportAction(id, { property_address: v }))}
          />
        </div>
        <span className="pt-2 text-xs text-stone-500" aria-live="polite">
          {pending ? "Saving…" : savedAt ? "All changes saved" : "Changes save automatically"}
        </span>
      </div>

      <div className="card mt-4 grid gap-3 p-4 sm:grid-cols-2">
        <Labeled label="Landlord">
          <AutoField key={`ll-${report.landlord_name}`} value={report.landlord_name} placeholder="Landlord name"
            onSave={(v) => run(() => updateReportAction(id, { landlord_name: v }))} />
        </Labeled>
        <Labeled label="Inspection date">
          <AutoField key={`d-${report.inspection_date}`} type="date" value={report.inspection_date}
            onSave={(v) => v && run(() => updateReportAction(id, { inspection_date: v }))} />
        </Labeled>
        <Labeled label="Tenant">
          <AutoField key={`tn-${report.tenant_name}`} value={report.tenant_name} placeholder="Tenant name"
            onSave={(v) => run(() => updateReportAction(id, { tenant_name: v }))} />
        </Labeled>
        <Labeled label="Tenant email">
          <AutoField key={`te-${report.tenant_email}`} type="email" value={report.tenant_email} placeholder="tenant@example.com"
            onSave={(v) => run(() => updateReportAction(id, { tenant_email: v }))} />
        </Labeled>
        <div className="sm:col-span-2">
          <Labeled label="Overall summary">
            <AutoField key={`s-${report.summary}`} multiline value={report.summary} placeholder="Overall condition of the property"
              onSave={(v) => run(() => updateReportAction(id, { summary: v }))} />
          </Labeled>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-700">
          {report.rooms.length} rooms · {all.length} items
        </span>
        {counts.map(([c, n]) => (
          <span key={c} className={`rounded-full px-2 py-0.5 capitalize ${conditionClass(c)}`}>
            {n} {c}
          </span>
        ))}
      </div>

      <div className="mt-6 space-y-5">
        {report.rooms.map((room) => (
          <section key={room.id} className="card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-stone-200 bg-stone-50 px-4 py-2">
              <AutoField
                key={`rn-${room.name}`}
                value={room.name}
                label="Room name"
                className="flex-1 rounded border border-transparent bg-transparent px-1 py-1 font-semibold hover:border-stone-300 focus:border-brand focus:bg-white focus:outline-none"
                onSave={(v) => run(() => renameRoomAction(id, room.id, v))}
              />
              <button
                type="button"
                className="text-xs text-stone-500 hover:text-red-600"
                onClick={() => confirm(`Delete ${room.name} and its items?`) && run(() => deleteRoomAction(id, room.id))}
              >
                Delete room
              </button>
            </div>
            <ul className="divide-y divide-stone-100">
              {room.items.map((item) => (
                <li key={item.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[180px_130px_1fr_auto] sm:items-start">
                  <AutoField key={`in-${item.name}`} value={item.name} label="Item"
                    onSave={(v) => run(() => updateItemAction(id, item.id, { name: v }))} />
                  <select
                    aria-label="Condition"
                    value={item.condition}
                    onChange={(e) => run(() => updateItemAction(id, item.id, { condition: e.target.value as Condition }))}
                    className={`input capitalize ${conditionClass(item.condition)}`}
                  >
                    {CONDITIONS.map((c) => (
                      <option key={c} value={c} className="bg-white text-stone-900">{c}</option>
                    ))}
                  </select>
                  <AutoField key={`no-${item.notes}`} multiline value={item.notes} placeholder="Notes" label="Notes"
                    onSave={(v) => run(() => updateItemAction(id, item.id, { notes: v }))} />
                  <button
                    type="button"
                    aria-label={`Remove ${item.name}`}
                    className="justify-self-end px-2 py-2 text-stone-400 hover:text-red-600"
                    onClick={() => run(() => deleteItemAction(id, item.id))}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <div className="px-4 py-2">
              <button type="button" className="text-sm text-brand hover:underline" onClick={() => run(() => addItemAction(id, room.id, ""))}>
                + Add item
              </button>
            </div>
          </section>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button type="button" className="btn-ghost" onClick={() => run(() => addRoomAction(id, ""))}>+ Add room</button>
        <button
          type="button"
          className="text-sm text-stone-500 hover:text-red-600"
          onClick={() => confirm("Delete this whole report? This cannot be undone.") && run(() => deleteReportAction(id))}
        >
          Delete report
        </button>
      </div>
    </div>
  );
}
