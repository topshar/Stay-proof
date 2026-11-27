"use client";

export default function PrintButton() {
  return (
    <button type="button" className="btn-ghost print:hidden" onClick={() => window.print()}>
      Print / save as PDF
    </button>
  );
}
