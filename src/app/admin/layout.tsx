import type { Metadata } from "next";

import { AdminAccessGate } from "@/components/admin/admin-access-gate";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata({
  title: "Admin | Yuzu Cigar Club",
  description: "Private Yuzu Cigar Club operations console for authorized administrators.",
  path: "/admin",
});

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminAccessGate>{children}</AdminAccessGate>;
}
