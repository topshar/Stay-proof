"use client";

import { useState, useTransition } from "react";
import { deleteReportAction } from "@/app/actions";

/** Two-step delete (no browser confirm dialog, which some embedded browsers block). */
export default function DeleteReportButton({ reportId, label = "Delete report" }: { reportId: string; label?: string }) {
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  if (!asking)
    return (
      <button type="button" className="text-sm text-stone-500 hover:text-red-600 print:hidden" onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  return (
    <span className="inline-flex items-center gap-2 text-sm print:hidden">
      <span className="text-stone-600">Delete for good?</span>
      <button
        type="button"
        disabled={pending}
        className="rounded-md bg-red-600 px-2.5 py-1 text-white hover:bg-red-700 disabled:opacity-50"
        onClick={() => start(async () => { await deleteReportAction(reportId); })}
      >
        {pending ? "Deleting…" : "Yes, delete"}
      </button>
      <button type="button" className="text-stone-500 hover:text-stone-900" onClick={() => setAsking(false)}>
        Cancel
      </button>
    </span>
  );
}
