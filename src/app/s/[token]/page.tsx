import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getReportByToken } from "@/lib/reports";
import ReportView, { SignatureBlock } from "@/components/ReportView";
import TenantNote from "@/components/TenantNote";
import TenantSignForm from "@/components/TenantSignForm";
import PrintButton from "@/components/PrintButton";

export const metadata: Metadata = { title: "Condition report to review · StayProof", robots: { index: false } };

export default async function TenantPage({ params }: PageProps<"/s/[token]">) {
  const { token } = await params;
  const report = await getReportByToken(token);
  if (!report) notFound();
  const open = report.status === "awaiting_tenant";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {open ? (
        <section className="card mb-6 bg-brand-soft p-5 print:hidden">
          <p className="font-semibold">{report.landlord_signed_name} has asked you to review and sign this report.</p>
          <p className="mt-1 text-sm text-stone-700">
            It records the condition of the property when you moved in, and protects your deposit at move-out. Check each
            item. If something isn&apos;t right, tap &ldquo;I disagree / add a note&rdquo;. Then sign at the bottom.
          </p>
        </section>
      ) : (
        <section className="card mb-6 flex flex-wrap items-center justify-between gap-3 border-emerald-300 bg-emerald-50/60 p-5 print:hidden">
          <p className="font-semibold text-emerald-900">Signed by both parties. Keep this link or save a PDF copy.</p>
          <PrintButton />
        </section>
      )}

      <ReportView
        report={report}
        token={token}
        itemExtra={open ? (item) => <TenantNote token={token} itemId={item.id} initial={item.tenant_note} /> : undefined}
      />
      <SignatureBlock report={report} />
      {open && <TenantSignForm token={token} defaultName={report.tenant_name} />}
    </div>
  );
}
