import Link from "next/link";

const steps = [
  {
    title: "Show Claude the property",
    body: "Drop your move-in photos into your own Claude and say \"make a condition report for 12 Park St\". Claude reads every photo.",
  },
  {
    title: "Review it in StayProof",
    body: "The room-by-room report lands here. Fix a rating, add a note, then send one link to your tenant.",
  },
  {
    title: "Both sign. Compare at move-out.",
    body: "Landlord and tenant sign the same record. At move-out, see every item side by side and settle the deposit on facts.",
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <p className="text-sm font-medium text-brand">For landlords, property managers and tenants</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
        End deposit fights with a condition report both sides signed.
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-stone-600">
        Your Claude turns move-in photos into a detailed, room-by-room report in a minute. StayProof stores it, gets it
        signed by landlord and tenant, and lines it up against move-out so nobody argues from memory.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/dashboard" className="btn">Open dashboard</Link>
        <Link href="/login" className="btn-ghost">Log in</Link>
      </div>

      <div className="mt-16 grid gap-4 sm:grid-cols-3">
        {steps.map((s, i) => (
          <div key={s.title} className="card p-5">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand">{i + 1}</div>
            <h2 className="mt-3 font-semibold">{s.title}</h2>
            <p className="mt-1 text-sm text-stone-600">{s.body}</p>
          </div>
        ))}
      </div>

      <p className="mt-12 text-sm text-stone-500">
        No AI runs inside StayProof. The thinking happens in the Claude plan you already pay for, connected over MCP.
      </p>
    </div>
  );
}
