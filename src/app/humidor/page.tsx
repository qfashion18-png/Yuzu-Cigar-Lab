import type { Metadata } from "next";

import { HumidorDashboard } from "@/components/humidor-dashboard";

export const metadata: Metadata = {
  title: "Digital Humidor | Yuzu Cigar Club",
  description:
    "Track cigar inventory, aging windows, tasting notes, humidity logs, and reorder reminders in the Yuzu digital humidor.",
  alternates: {
    canonical: "/humidor",
  },
  openGraph: {
    title: "Digital Humidor | Yuzu Cigar Club",
    description:
      "Track cigar inventory, aging windows, tasting notes, humidity logs, and reorder reminders in the Yuzu digital humidor.",
    url: "/humidor",
  },
};

export default function HumidorPage() {
  return <HumidorDashboard />;
}
