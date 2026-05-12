import type { Metadata, Viewport } from "next";
import Script from "next/script";

import { BackupAuthProvider } from "@/components/backup-auth-provider";
import { PwaRegister } from "@/components/pwa-register";
import { SiteChrome } from "@/components/site-chrome";
import { ageGateBootstrapScript } from "@/lib/age-gate-bootstrap";
import { siteUrl } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Yuzu Cigar Club | Membership, Storefront, Digital Humidor",
  description:
    "A premium cigar club storefront with Medusa-ready commerce, adult compliance, memberships, events, and a PWA digital humidor.",
  openGraph: {
    title: "Yuzu Cigar Club | Membership, Storefront, Digital Humidor",
    description:
      "A premium cigar club storefront with Medusa-ready commerce, adult compliance, memberships, events, and a PWA digital humidor.",
    url: "/",
    siteName: "Yuzu Cigar Club",
    type: "website",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/assets/yuzu-logo-192.png",
    apple: "/assets/yuzu-logo-180.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#030504",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full" suppressHydrationWarning>
      <body className="min-h-full">
        <Script
          id="yuzu-age-gate-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: ageGateBootstrapScript }}
        />
        <BackupAuthProvider>
          <PwaRegister />
          <SiteChrome>{children}</SiteChrome>
        </BackupAuthProvider>
      </body>
    </html>
  );
}
