import type { Metadata } from "next";

import { HumidorDashboard } from "@/components/humidor-dashboard";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Digital Humidor | Yuzu Cigar Club",
  description:
    "Track cigar inventory, aging windows, tasting notes, humidity logs, and reorder reminders in the Yuzu digital humidor.",
  path: "/humidor",
  image: "/refs/mobile-layout.png",
  imageAlt: "Yuzu digital humidor mobile dashboard",
  keywords: ["digital humidor", "cigar inventory tracker", "cigar aging notes"],
});

export default function HumidorPage() {
  return <HumidorDashboard />;
}
