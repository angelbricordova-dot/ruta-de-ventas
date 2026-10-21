"use client";

/** Marca: las paradas de la ruta suben como una venta y terminan en el pin del cliente. */
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="flex-none">
      <rect width="64" height="64" rx="16" fill="#2257a8" />
      <path d="M12 48 L24 36 L32 42 L46 26" fill="none" stroke="#9cc2f5" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M46 31c0 0-8-7.7-8-13.6a8 8 0 0 1 16 0c0 5.9-8 13.6-8 13.6z" fill="#fff" />
      <circle cx="46" cy="17.6" r="3" fill="#2257a8" />
      <circle cx="12" cy="48" r="3.4" fill="#fff" />
      <circle cx="24" cy="36" r="3.4" fill="#fff" />
      <circle cx="32" cy="42" r="3.4" fill="#fff" />
    </svg>
  );
}
