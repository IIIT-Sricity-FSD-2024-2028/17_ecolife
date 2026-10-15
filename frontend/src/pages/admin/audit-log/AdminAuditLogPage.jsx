import { AuditLogView } from '../../org/org-admin/AuditLogPage';
import { useAdminAuditLogs, useAdminAuditActions, fetchAllAdminAuditLogs } from '../../../hooks/useAdminData';

export function AdminAuditLogPage() {
  return (
    <AuditLogView
      subtitle="Every action across every organization and the admin portal. Append-only."
      useLogs={useAdminAuditLogs}
      useActions={useAdminAuditActions}
      fetchAll={fetchAllAdminAuditLogs}
      showOrg
      filenamePrefix="tropos-platform-audit-log"
    />
  );
}
