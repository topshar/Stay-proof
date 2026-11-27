import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export default async function LoginPage() {
  if (await getUser()) redirect("/dashboard");
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-semibold">Log in</h1>
      <p className="mt-1 text-sm text-stone-600">Landlord and property manager accounts.</p>
      <LoginForm />
      <p className="mt-6 rounded-md bg-brand-soft p-3 text-xs text-stone-700">
        Reviewer test account: <b>demo@depositguard.app</b> / <b>movein2026</b>
      </p>
    </div>
  );
}
