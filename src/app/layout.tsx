import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaInstallBanner } from "@/components/PwaInstallBanner";

export const metadata: Metadata = {
  metadataBase: new URL("https://jobmatch.nebuladigitalstudio.es"),
  title: { default: "JobMatch · Empleo cerca de ti", template: "%s" },
  description: "Encuentra trabajo cerca de ti o conecta con talento local. Desliza, conecta y habla directamente.",
  alternates: { canonical: "/" },
  openGraph: { type: "website", url: "https://jobmatch.nebuladigitalstudio.es/", siteName: "JobMatch", title: "JobMatch · Empleo cerca de ti", description: "Conecta con oportunidades de empleo y talento local." },
  twitter: { card: "summary", title: "JobMatch · Empleo cerca de ti", description: "Conecta con oportunidades de empleo y talento local." },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "JobMatch" },
};
export const viewport: Viewport = { themeColor: "#f8f7f4", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body><PwaInstallBanner />{children}</body></html>;
}
