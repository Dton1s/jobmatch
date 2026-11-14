import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JobMatch · Empleo cerca de ti",
  description: "Encuentra trabajo cerca de ti o conecta con talento local. Desliza, conecta y habla directamente.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "JobMatch" },
};
export const viewport: Viewport = { themeColor: "#f8f7f4", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
