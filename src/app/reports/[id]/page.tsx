import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getReport } from "@/lib/reports";
import ReportEditor from "@/components/ReportEditor";

export default async function ReportPage({ params }: PageProps<"/reports/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const report = await getReport(user.id, id);
  if (!report) notFound();
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/dashboard" className="text-sm text-stone-600 hover:text-stone-900">← All reports</Link>
      <ReportEditor report={report} />
    </div>
  );
}
