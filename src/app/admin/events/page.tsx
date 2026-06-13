import type { Metadata } from "next";

import { AdminAccessGate } from "@/components/admin/admin-access-gate";
import { EventImportAgentPanel } from "@/components/event-import-agent-panel";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata({
  title: "Event Import Agent | Yuzu Cigar Club",
  description: "Draft and approve local cigar event imports for the Yuzu Cigar Club events guide.",
  path: "/admin/events",
});

export default function AdminEventsPage() {
  return (
    <AdminAccessGate>
      <EventImportAgentPanel />
    </AdminAccessGate>
  );
}
