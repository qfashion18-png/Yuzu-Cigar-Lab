import type { Metadata } from "next";

import { AdminAccessGate } from "@/components/admin/admin-access-gate";
import { NewsroomAgentPanel } from "@/components/newsroom-agent-panel";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata({
  title: "Newsroom Agent | Yuzu Cigar Club",
  description: "Draft and publish Yuzu Cigar Club news stories from official cigar-industry source notes.",
  path: "/admin/newsroom",
});

export default function AdminNewsroomPage() {
  return (
    <AdminAccessGate>
      <NewsroomAgentPanel />
    </AdminAccessGate>
  );
}
