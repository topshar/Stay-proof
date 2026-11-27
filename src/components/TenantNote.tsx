"use client";

import { useState, useTransition } from "react";
import { tenantNoteAction } from "@/app/actions";

export default function TenantNote({ token, itemId, initial }: { token: string; itemId: string; initial: string }) {
  const [open, setOpen] = useState(Boolean(initial));
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  if (!open)
    return (
      <button type="button" className="mt-2 text-xs text-amber-700 hover:underline" onClick={() => setOpen(true)}>
        I disagree / add a note
      </button>
    );
  return (
    <div className="mt-2">
      <textarea
        rows={2}
        defaultValue={initial}
        placeholder="What's different from this description?"
        aria-label="Tenant note"
        className="input border-amber-300 bg-amber-50"
        onBlur={(e) => {
          const v = e.currentTarget.value;
          if (v !== saved) start(async () => { await tenantNoteAction(token, itemId, v); setSaved(v); });
        }}
      />
      <p className="mt-1 text-xs text-stone-500">{pending ? "Saving…" : saved ? "Note saved. The landlord can see it." : ""}</p>
    </div>
  );
}
