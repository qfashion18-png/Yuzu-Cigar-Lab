"use client";

import { usePathname } from "next/navigation";

import { AgeGate } from "@/components/age-gate";
import { CartProvider } from "@/components/cart-provider";
import { FloatingConcierge } from "@/components/floating-concierge";
import { LivePageEditor } from "@/components/live-page-editor";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  const isAuth = pathname.startsWith("/auth");

  if (isAdmin || isAuth) {
    return <>{children}</>;
  }

  return (
    <CartProvider>
      <AgeGate />
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
      <LivePageEditor />
      <FloatingConcierge />
    </CartProvider>
  );
}
