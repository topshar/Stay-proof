"use client";

import { useState, useTransition } from "react";
import { tenantSignAction } from "@/app/actions";

export default function TenantSignForm({ token, defaultName }: { token: string; defaultName: string }) {
  const [name, setName] = useState(defaultName);
  const [comment, setComment] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="card mt-6 space-y-3 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const ok = await tenantSignAction(token, name, comment);
          if (!ok) setError("Couldn't sign. The report may already be signed or was taken back for edits. Reload the page.");
        });
      }}
    >
      <h2 className="font-semibold">Sign as tenant</h2>
      <p className="text-sm text-stone-600">
        Add a note to any item above if you disagree. Your notes become part of the signed record.
      </p>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-stone-500">Overall comment (optional)</span>
        <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} className="input" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-stone-500">Type your full name to sign</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required className="input font-serif text-lg italic" />
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1" />
        <span>I have read this report and, together with my notes, agree it records the condition of the property at move-in.</span>
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn" disabled={!agree || !name.trim() || pending}>{pending ? "Signing…" : "Sign report"}</button>
    </form>
  );
}
