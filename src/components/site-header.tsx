"use client";

import Link from "@/components/static-link";
import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { MailCheck, Menu, Search, ShoppingCart, UserRound } from "lucide-react";

import { useBackupAuth } from "@/components/backup-auth-provider";
import { BrandMark } from "@/components/brand-mark";
import { useCart } from "@/components/cart-provider";
import { NewsletterSignupForm } from "@/components/newsletter-signup-form";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { commerceNav, navItems } from "@/lib/data";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();
  const auth = useBackupAuth();
  const visibleCommerceNav = auth.isAdmin ? commerceNav : commerceNav.filter((item) => item.href !== "/admin");
  const allNav = [...navItems, ...visibleCommerceNav];
  const { itemCount } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [joinSheetOpen, setJoinSheetOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setIsScrolled(latest > 12);
  });

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const openJoinSheet = () => {
    setJoinSheetOpen(true);
  };

  const handleMobileJoin = () => {
    closeMobileMenu();
    openJoinSheet();
  };

  const handleMobileSignOut = () => {
    closeMobileMenu();
    auth.signOut();
  };

  if (pathname?.startsWith("/admin")) {
    return null;
  }

  return (
    <motion.header
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, ease: "easeOut" }}
      className={cn(
        "sticky top-0 z-40 border-b border-yuzu-line/55 backdrop-blur-xl transition-colors duration-300",
        isScrolled
          ? "bg-yuzu-night/98 shadow-[0_16px_42px_rgba(0,0,0,0.38)]"
          : "bg-yuzu-night/92 shadow-[0_12px_34px_rgba(0,0,0,0.28)]"
      )}
    >
      <div className="mx-auto flex h-18 max-w-[1520px] items-center gap-4 px-5 lg:h-20 lg:px-10">
        <BrandMark compact />
        <nav className="ml-auto hidden items-center gap-6 lg:flex">
          {navItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "nav-link relative flex h-18 items-center text-[0.74rem] font-bold uppercase tracking-[0.16em] text-yuzu-cream/76 transition hover:text-yuzu-gold lg:h-20",
                  isActive && "text-yuzu-gold"
                )}
              >
                {item.label}
                {isActive && (
                  <motion.span
                    layoutId="site-header-active-nav"
                    className="absolute bottom-0 left-0 h-px w-full bg-yuzu-gold shadow-[0_0_18px_rgba(220,169,58,0.72)]"
                    transition={{ type: "spring", stiffness: 380, damping: 34 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2 lg:ml-6">
          <Button variant="ghost" size="icon-lg" aria-label="Search catalog" render={<Link href="/shop#catalog" />}>
            <Search data-icon="inline-start" />
          </Button>
          <Link
            href="/account"
            className="hidden h-10 items-center border border-yuzu-line/75 px-5 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-yuzu-cream transition hover:border-yuzu-gold hover:text-yuzu-gold md:flex"
          >
            {auth.isSignedIn ? auth.session?.membership.tier ?? "Account" : "Log in"}
          </Link>
          {auth.isMember ? (
            <button
              type="button"
              className="hidden h-10 items-center border border-yuzu-gold px-5 text-[0.72rem] font-black uppercase tracking-[0.16em] text-yuzu-gold transition hover:bg-yuzu-gold hover:text-yuzu-ink md:flex"
              onClick={auth.signOut}
            >
              Sign Out
            </button>
          ) : (
            <button
              type="button"
              className="hidden h-10 items-center bg-yuzu-gold px-5 text-[0.72rem] font-black uppercase tracking-[0.16em] text-yuzu-ink shadow-[0_12px_28px_rgba(221,170,61,0.16)] transition hover:bg-yuzu-gold-light md:flex"
              onClick={openJoinSheet}
            >
              Join Now
            </button>
          )}
          <Link href="/cart" className="relative grid size-10 place-items-center text-yuzu-cream" aria-label={`Cart with ${itemCount} items`}>
            <ShoppingCart />
            <motion.span
              key={itemCount}
              initial={false}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 520, damping: 24 }}
              className="absolute right-0 top-1 grid size-5 place-items-center rounded-full bg-yuzu-gold text-[0.62rem] font-black text-yuzu-ink"
            >
              <span aria-live="polite">{itemCount}</span>
            </motion.span>
          </Link>
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger
              render={
                <Button className="lg:hidden" variant="outline" size="icon-lg" aria-label="Open navigation">
                  <Menu data-icon="inline-start" />
                </Button>
              }
            />
            <SheetContent className="border-yuzu-line bg-yuzu-forest text-yuzu-cream">
              <SheetHeader className="shrink-0 pr-10">
                <SheetTitle className="text-yuzu-cream">Yuzu Cigar Club</SheetTitle>
                <SheetDescription className="text-yuzu-muted">
                  Premium boxes, membership, and digital humidor tools.
                </SheetDescription>
              </SheetHeader>
              <nav className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 pb-2">
                {allNav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMobileMenu}
                    className={cn(
                      "border border-yuzu-line/60 px-4 py-3 text-sm font-bold uppercase tracking-[0.18em] text-yuzu-cream",
                      pathname === item.href && "border-yuzu-gold bg-yuzu-gold/10 text-yuzu-gold"
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="mt-auto flex shrink-0 gap-2 p-4">
                <Link
                  href="/account"
                  onClick={closeMobileMenu}
                  className="grid size-10 place-items-center border border-yuzu-line text-yuzu-cream"
                  aria-label="Account"
                >
                  <UserRound />
                </Link>
                {auth.isMember ? (
                  <button
                    type="button"
                    className="flex flex-1 items-center justify-center border border-yuzu-gold text-sm font-black uppercase tracking-[0.18em] text-yuzu-gold"
                    onClick={handleMobileSignOut}
                  >
                    Sign Out
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleMobileJoin}
                    className="flex flex-1 items-center justify-center bg-yuzu-gold text-sm font-black uppercase tracking-[0.18em] text-yuzu-ink"
                  >
                    Join Now
                  </button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      <Sheet open={joinSheetOpen} onOpenChange={setJoinSheetOpen}>
        <SheetContent className="w-full border-yuzu-line bg-yuzu-forest text-yuzu-cream sm:max-w-md">
          <SheetHeader className="border-b border-yuzu-line/70 p-5 pr-12">
            <div className="grid size-11 place-items-center border border-yuzu-gold/55 bg-yuzu-gold/10 text-yuzu-gold">
              <MailCheck className="size-5" />
            </div>
            <SheetTitle className="mt-4 font-heading text-3xl leading-tight text-yuzu-cream">
              Join the club.
            </SheetTitle>
            <SheetDescription className="text-sm leading-6 text-yuzu-muted">
              Get journal highlights, curated box drops, and monthly membership details when you want them.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
            <NewsletterSignupForm
              source="join-now-header"
              defaultMonthlyInterest
              className="pt-1"
            />
          </div>
        </SheetContent>
      </Sheet>
    </motion.header>
  );
}
