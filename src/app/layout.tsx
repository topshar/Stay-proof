import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "StayProof: condition reports your tenant signs",
  description: "Turn move-in photos into a signed, room-by-room condition report with your own Claude. Compare at move-out.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="border-b border-stone-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-brand text-sm text-white">SP</span>
              StayProof
            </Link>
            <nav className="flex items-center gap-4 text-sm text-stone-600">
              <Link href="/dashboard" className="hover:text-stone-900">Dashboard</Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-stone-200 py-6 text-center text-xs text-stone-500">
          StayProof. Your Claude writes the report. We keep it safe, signed and ready for move-out.
        </footer>
      </body>
    </html>
  );
}
