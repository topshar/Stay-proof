import type { ReactNode } from "react";
import type { Item, PublicReport } from "@/lib/reports";
import ConditionBadge from "./ConditionBadge";

export function photoUrl(id: string, token?: string) {
  return `/api/photos/${id}${token ? `?t=${token}` : ""}`;
}

export function PhotoStrip({ photos, token }: { photos: { id: string }[]; token?: string }) {
  if (photos.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 px-4 pt-3">
      {photos.map((p) => (
        <a key={p.id} href={photoUrl(p.id, token)} target="_blank" rel="noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl(p.id, token)} alt="Room photo" className="h-24 w-32 rounded-md border border-stone-200 object-cover" loading="lazy" />
        </a>
      ))}
    </div>
  );
}

function fmt(ts: string | null) {
  if (!ts) return "";
  return new Date(ts).toLocaleString("en-AU", {
    day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
    timeZone: "Australia/Sydney", timeZoneName: "short",
  });
}

export function SignatureBlock({ report }: { report: PublicReport }) {
  const sig = (role: string, name: string | null, at: string | null) => (
    <div className="rounded-lg border border-stone-200 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{role}</p>
      {name ? (
        <>
          <p className="mt-2 font-serif text-2xl italic text-stone-900">{name}</p>
          <p className="mt-1 text-xs text-stone-600">Signed {fmt(at)}</p>
        </>
      ) : (
        <p className="mt-2 text-sm text-stone-500">Not signed yet</p>
      )}
    </div>
  );
  return (
    <section className="card mt-6 p-5">
      <h2 className="font-semibold">Signatures</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {sig("Landlord / agent", report.landlord_signed_name, report.landlord_signed_at)}
        {sig("Tenant", report.tenant_signed_name, report.tenant_signed_at)}
      </div>
      {report.tenant_comment && (
        <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          <b>Tenant comment:</b> {report.tenant_comment}
        </p>
      )}
      {report.fingerprint && (
        <p className="mt-3 break-all text-xs text-stone-500">
          Document fingerprint (SHA-256 of the signed content): <span className="font-mono">{report.fingerprint}</span>
        </p>
      )}
    </section>
  );
}

export default function ReportView({
  report,
  token,
  itemExtra,
}: {
  report: PublicReport;
  token?: string;
  itemExtra?: (item: Item) => ReactNode;
}) {
  const items = report.rooms.flatMap((r) => r.items);
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-brand">Move-in condition report</p>
      <h1 className="mt-1 text-2xl font-semibold">{report.property_address}</h1>
      <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
        <div><dt className="inline text-stone-500">Landlord: </dt><dd className="inline">{report.landlord_name || "—"}</dd></div>
        <div><dt className="inline text-stone-500">Tenant: </dt><dd className="inline">{report.tenant_name || "—"}</dd></div>
        <div><dt className="inline text-stone-500">Inspected: </dt><dd className="inline">{report.inspection_date}</dd></div>
      </dl>
      {report.summary && <p className="mt-3 text-sm text-stone-700">{report.summary}</p>}
      <p className="mt-2 text-xs text-stone-500">{report.rooms.length} rooms · {items.length} items</p>

      <div className="mt-5 space-y-4">
        {report.rooms.map((room) => (
          <section key={room.id} className="card overflow-hidden break-inside-avoid">
            <h2 className="border-b border-stone-200 bg-stone-50 px-4 py-2 font-semibold">{room.name}</h2>
            <PhotoStrip photos={room.photos} token={token} />
            <ul className="divide-y divide-stone-100">
              {room.items.map((item) => (
                <li key={item.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{item.name}</span>
                    <ConditionBadge condition={item.condition} />
                  </div>
                  {item.notes && <p className="mt-1 text-sm text-stone-600">{item.notes}</p>}
                  {itemExtra
                    ? itemExtra(item)
                    : item.tenant_note && (
                        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                          <b>Tenant note:</b> {item.tenant_note}
                        </p>
                      )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
