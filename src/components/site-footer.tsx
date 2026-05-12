"use client";

import { usePathname } from "next/navigation";

import Link from "@/components/static-link";

import { BrandMark } from "@/components/brand-mark";
import { commerceNav, complianceStack, navItems } from "@/lib/data";

export function SiteFooter() {
  const pathname = usePathname();
  const footerCommerceNav = commerceNav.filter((item) => item.href !== "/admin");

  if (pathname?.startsWith("/admin")) {
    return null;
  }

  return (
    <footer className="border-t border-yuzu-line/70 bg-[linear-gradient(180deg,rgba(7,17,13,0.72),#030504)]">
      <div className="mx-auto grid max-w-[1520px] gap-10 px-5 py-12 md:grid-cols-[1.1fr_0.85fr_0.85fr_1.25fr] lg:px-10">
        <div className="flex flex-col gap-5">
          <BrandMark />
          <p className="max-w-sm text-sm leading-6 text-yuzu-muted">
            Premium cigar boxes, member pricing, digital humidor tracking, and compliance-first checkout for the modern aficionado.
          </p>
        </div>
        <div>
          <h3 className="footer-title">Club</h3>
          <div className="mt-4 flex flex-col gap-2">
            {navItems.slice(0, 7).map((item) => (
              <Link key={item.href} href={item.href} className="footer-link">
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h3 className="footer-title">Storefront</h3>
          <div className="mt-4 flex flex-col gap-2">
            {footerCommerceNav.map((item) => (
              <Link key={item.href} href={item.href} className="footer-link">
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="grid gap-5">
          <div>
            <h3 className="footer-title">Compliance Stack</h3>
            <ul className="mt-4 grid gap-2 text-sm text-yuzu-muted">
              {complianceStack.slice(0, 4).map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 h-px w-3 shrink-0 bg-yuzu-gold/70" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-yuzu-line/55 px-5 py-5 text-center text-xs uppercase tracking-[0.16em] text-yuzu-muted">
        Copyright 2026 Yuzu Cigar Club. Tobacco products are for adults 21+ only.
      </div>
    </footer>
  );
}
