import type { Metadata } from "next";

import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata({
  title: "Authentication | Yuzu Cigar Club",
  description: "Private authentication callback and logout routes for Yuzu Cigar Club member accounts.",
  path: "/auth",
});

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
