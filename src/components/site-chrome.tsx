"use client";

import { usePathname } from "next/navigation";

import { AgeGate } from "@/components/age-gate";
import { CartProvider } from "@/components/cart-provider";
import { FloatingConcierge } from "@/components/floating-concierge";
import { LivePageEditor } from "@/components/live-page-editor";
import { PageFade } from "@/components/motion-primitives";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  const isAuth = pathname.startsWith("/auth");

  if (isAdmin || isAuth) {
    return <CartProvider>{children}</CartProvider>;
  }

  return (
    <CartProvider>
      <AgeGate />
      <SiteHeader />
      <PageFade key={pathname} duration={0.28}>
        <main>{children}</main>
      </PageFade>
      <SiteFooter />
      <LivePageEditor />
      <FloatingConcierge />
    </CartProvider>
  );
}
