"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="text-muted underline-offset-2 hover:underline"
    >
      Print
    </button>
  );
}
