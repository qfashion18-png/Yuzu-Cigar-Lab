"use client";

import Link from "@/components/static-link";
import { ExternalLink, ShieldAlert } from "lucide-react";

import { BackupAuthPanel } from "@/components/backup-auth-panel";
import { useBackupAuth } from "@/components/backup-auth-provider";
import { Button } from "@/components/ui/button";
import { resolveAdminAppUrl } from "@/lib/admin-access";
import { isBackupAdminAllowedForEnvironment } from "@/lib/backup-auth";

export function AdminAccessGate({ children }: { children?: React.ReactNode }) {
  const auth = useBackupAuth();
  const adminAppUrl = resolveAdminAppUrl();
  const backupAdminAllowed = isBackupAdminAllowedForEnvironment({
    nodeEnv: process.env.NODE_ENV,
    featureFlag: process.env.NEXT_PUBLIC_ENABLE_BACKUP_ADMIN,
  });
  const gateHeading = auth.isAdmin
    ? "Open the authenticated backend admin."
    : auth.isCognitoConfigured
      ? "Production admin access requires Cognito."
      : backupAdminAllowed
        ? "Admin access requires the backup admin account."
        : "Production admin access requires Cognito.";
  const gateCopy = auth.isAdmin
    ? "This static storefront does not ship backend console code, inventory operations, or seeded admin data. Use the configured backend admin app for production operations."
    : auth.isCognitoConfigured
      ? "Sign in here with your Yuzu Cognito credentials. The API will use your verified Cognito groups for member, concierge, and admin access."
      : backupAdminAllowed
        ? "Local backup admin can unlock the backend hand-off during development, but it does not load or mutate admin data. Configure Cognito and NEXT_PUBLIC_ADMIN_APP_URL for live admin operations."
        : "Local backup admin is disabled for production builds unless NEXT_PUBLIC_ENABLE_BACKUP_ADMIN is explicitly set for a break-glass deployment.";

  if (!auth.isReady) {
    return (
      <main className="grid min-h-screen place-items-center bg-yuzu-night px-5 text-yuzu-cream">
        <div className="text-sm uppercase tracking-[0.22em] text-yuzu-gold">Loading admin access</div>
      </main>
    );
  }

  if (children && auth.isAdmin && auth.authSource === "cognito") {
    return <>{children}</>;
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,rgba(15,83,55,0.34),transparent_34rem),#030504] px-5 py-10 text-yuzu-cream">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <section className="border border-yuzu-line bg-yuzu-panel p-6">
          <ShieldAlert className="text-yuzu-gold" />
          <h1 className="mt-5 font-heading text-4xl text-yuzu-cream">{gateHeading}</h1>
          <p className="mt-4 text-sm leading-6 text-yuzu-muted">{gateCopy}</p>
          <p className="mt-4 text-sm leading-6 text-yuzu-muted">
            Editorial newsroom tools remain in this app at <a href="/admin/newsroom">/admin/newsroom</a>, and reviewed event importing lives at{" "}
            <a href="/admin/events">/admin/events</a>. Those routes are not the backend operations console.
          </p>
          {auth.isAdmin && adminAppUrl ? (
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                className="h-11 bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light"
                render={<a href={adminAppUrl} rel="noreferrer" target="_blank" />}
              >
                <ExternalLink data-icon="inline-start" />
                Open Backend Admin
              </Button>
              <Button
                className="h-11 border-yuzu-line text-yuzu-cream"
                render={<Link href="/admin/newsroom" />}
                variant="outline"
              >
                Open Newsroom Agent
              </Button>
              <Button
                className="h-11 border-yuzu-line text-yuzu-cream"
                render={<Link href="/admin/events" />}
                variant="outline"
              >
                Open Event Agent
              </Button>
            </div>
          ) : null}
          {auth.isAdmin && !adminAppUrl ? (
            <p className="mt-5 border border-yuzu-line bg-yuzu-night/60 p-4 text-sm leading-6 text-yuzu-muted">
              Backend admin URL is not configured for this static deployment. Set NEXT_PUBLIC_ADMIN_APP_URL to enable the authenticated admin hand-off.
              Editorial flows are still available at <a href="/admin/newsroom">/admin/newsroom</a> and <a href="/admin/events">/admin/events</a>.
            </p>
          ) : null}
        </section>
        {backupAdminAllowed || auth.isCognitoConfigured ? <BackupAuthPanel adminAppUrl={adminAppUrl} intent="admin" /> : null}
      </div>
    </main>
  );
}
