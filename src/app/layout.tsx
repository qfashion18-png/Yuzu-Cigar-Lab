import type { Metadata, Viewport } from "next";

import { BackupAuthProvider } from "@/components/backup-auth-provider";
import { PwaRegister } from "@/components/pwa-register";
import { SiteChrome } from "@/components/site-chrome";
import { ageGateBootstrapScript } from "@/lib/age-gate-bootstrap";
import { buildRootMetadata } from "@/lib/seo";
import "./globals.css";

export const metadata: Metadata = buildRootMetadata();

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
        <script
          id="yuzu-age-gate-bootstrap"
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
