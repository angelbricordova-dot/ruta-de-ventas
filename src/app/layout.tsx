import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import { Shell } from "@/components/Shell";
import "./globals.css";

const sans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-instrument-sans",
  display: "swap",
});

/** Títulos y cifras: grotesca con carácter, legible en el teléfono. */
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-bricolage",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ruta de ventas · Alejandro Lamont",
  description: "Ruta del día, prospectos y embudo de ventas por proyecto.",
  applicationName: "Ruta de ventas",
  appleWebApp: { capable: true, title: "Ruta", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${sans.variable} ${display.variable}`}>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
