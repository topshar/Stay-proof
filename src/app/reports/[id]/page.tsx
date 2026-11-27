import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getReport } from "@/lib/reports";
import { appOrigin } from "@/lib/origin";
import { unlockReportAction } from "@/app/actions";
import ReportEditor from "@/components/ReportEditor";
import ReportView, { SignatureBlock } from "@/components/ReportView";
import CopyField from "@/components/CopyField";
import PrintButton from "@/components/PrintButton";

export default async function ReportPage({ params }: PageProps<"/reports/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const report = await getReport(user.id, id);
  if (!report) notFound();

  if (report.status === "draft") {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Link href="/dashboard" className="text-sm text-stone-600 hover:text-stone-900">← All reports</Link>
        <ReportEditor report={report} />
      </div>
    );
  }

  const shareUrl = `${await appOrigin()}/s/${report.share_token}`;
  const notes = report.rooms.flatMap((r) => r.items).filter((i) => i.tenant_note).length;
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/dashboard" className="text-sm text-stone-600 hover:text-stone-900">← All reports</Link>
        <PrintButton />
      </div>

      {report.status === "awaiting_tenant" ? (
        <section className="card mt-4 space-y-3 border-amber-300 bg-amber-50/50 p-5 print:hidden">
          <p className="font-semibold">Waiting for the tenant to sign</p>
          <p className="text-sm text-stone-700">
            Send this private link to {report.tenant_name || "your tenant"}
            {report.tenant_email ? ` (${report.tenant_email})` : ""}. They can review every item, add notes where they
            disagree, and countersign. No account needed.
          </p>
          <CopyField value={shareUrl} />
          {notes > 0 && <p className="text-sm text-amber-900">The tenant has added {notes} note{notes > 1 ? "s" : ""} so far.</p>}
          <form action={unlockReportAction.bind(null, report.id)}>
            <button className="text-sm text-stone-600 underline hover:text-stone-900">Take back to edit (removes your signature)</button>
          </form>
        </section>
      ) : (
        <section className="card mt-4 border-emerald-300 bg-emerald-50/60 p-5 print:hidden">
          <p className="font-semibold text-emerald-900">Signed by both parties. This report is locked.</p>
          <p className="mt-1 text-sm text-stone-700">Keep it for move-out. Use Print to save a PDF copy.</p>
        </section>
      )}

      <div className="mt-6">
        <ReportView report={report} />
      </div>
      <SignatureBlock report={report} />
    </div>
  );
}
