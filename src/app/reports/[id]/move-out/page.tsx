import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getReport } from "@/lib/reports";
import MoveOutEditor from "@/components/MoveOutEditor";
import PrintButton from "@/components/PrintButton";

export default async function MoveOutPage({ params }: PageProps<"/reports/[id]/move-out">) {
  const { id } = await params;
  const user = await requireUser();
  const report = await getReport(user.id, id);
  if (!report) notFound();
  if (report.status !== "signed") redirect(`/reports/${id}`);
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/reports/${id}`} className="text-sm text-stone-600 hover:text-stone-900">← Signed move-in report</Link>
        <PrintButton />
      </div>
      <MoveOutEditor report={report} />
    </div>
  );
}
