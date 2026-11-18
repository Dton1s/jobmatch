import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaInstallBanner } from "@/components/PwaInstallBanner";
import { PlayStoreUpdatePrompt } from "@/components/PlayStoreUpdatePrompt";

export const metadata: Metadata = {
  metadataBase: new URL("https://job-match.es"),
  title: { default: "Job Match · Trabajo y Empleo", template: "%s" },
  description: "Encuentra empleo que encaja contigo o conecta con candidatos para tus ofertas.",
  alternates: { canonical: "/" },
  openGraph: { type: "website", url: "https://job-match.es/", siteName: "Job Match", title: "Job Match · Trabajo y Empleo", description: "Encuentra empleo que encaja contigo o conecta con candidatos para tus ofertas." },
  twitter: { card: "summary", title: "Job Match · Trabajo y Empleo", description: "Encuentra empleo que encaja contigo o conecta con candidatos para tus ofertas." },
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
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Job Match" },
};
export const viewport: Viewport = { themeColor: "#f8f7f4", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body><PwaInstallBanner /><PlayStoreUpdatePrompt />{children}</body></html>;
}
