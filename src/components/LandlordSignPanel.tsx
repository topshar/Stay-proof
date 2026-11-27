"use client";

import { useState, useTransition } from "react";
import { landlordSignAction } from "@/app/actions";

export default function LandlordSignPanel({ reportId, defaultName }: { reportId: string; defaultName: string }) {
  const [name, setName] = useState(defaultName);
  const [agree, setAgree] = useState(false);
  const [pending, start] = useTransition();
  return (
    <section className="card mt-8 space-y-3 border-brand/40 p-5">
      <h2 className="font-semibold">Sign and send to tenant</h2>
      <p className="text-sm text-stone-600">
        Signing locks the report and creates a private link for your tenant to review, add notes and countersign.
        You can take it back for edits until the tenant signs.
      </p>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" aria-label="Landlord name"
        className="input font-serif text-lg italic" />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1" />
        <span>I confirm this report accurately records the condition of the property.</span>
      </label>
      <button className="btn" disabled={!agree || !name.trim() || pending}
        onClick={() => start(async () => { await landlordSignAction(reportId, name); })}>
        {pending ? "Signing…" : "Sign and get tenant link"}
      </button>
    </section>
  );
}
