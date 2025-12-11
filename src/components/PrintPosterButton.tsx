// src/components/PrintPosterButton.tsx
"use client";

export default function PrintPosterButton() {
  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <button
      type="button"
      onClick={handlePrint}
      className="inline-flex items-center rounded-full border border-neutral-400 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
    >
      Print or save as PDF
    </button>
  );
}