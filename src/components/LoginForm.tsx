"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions";

export default function LoginForm() {
  const [error, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action} className="mt-6 space-y-3">
      <input name="email" type="email" required placeholder="Email" className="input" autoComplete="email" />
      <input name="password" type="password" required placeholder="Password" className="input" autoComplete="current-password" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn w-full" disabled={pending}>{pending ? "Logging in…" : "Log in"}</button>
    </form>
  );
}
