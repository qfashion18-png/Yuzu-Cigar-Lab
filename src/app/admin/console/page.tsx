import { AdminAccessGate } from "@/components/admin/admin-access-gate";
import { BackendAdminConsole } from "@/components/admin/backend-admin-console";

export default function AdminConsolePage() {
  return (
    <AdminAccessGate>
      <BackendAdminConsole />
    </AdminAccessGate>
  );
}
