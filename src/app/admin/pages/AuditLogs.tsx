import { useState, useMemo } from "react";
import { Shield, AlertTriangle, Search, Download, Filter, Calendar, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { useAuditLogs } from "../../modules/audit/hooks/useAuditStream";
import { AuditActionType } from "../../modules/audit/types/audit.types";

export function AuditLogs() {
  const { data: auditLogs = [], loading } = useAuditLogs(200);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("ALL");

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (selectedType !== "ALL" && log.actionType !== selectedType) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const user = (log.performedBy || "").toLowerCase();
        const action = (log.action || "").toLowerCase();
        const details = (log.details || "").toLowerCase();
        const ip = (log.ipAddress || "").toLowerCase();
        if (!user.includes(q) && !action.includes(q) && !details.includes(q) && !ip.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [auditLogs, selectedType, searchQuery]);

  const stats = useMemo(() => {
    const total = auditLogs.length;
    const eventActions = auditLogs.filter((l) => l.actionType === "Event Actions").length;
    const financialActions = auditLogs.filter((l) => l.actionType === "Financial Actions").length;
    const accountActions = auditLogs.filter((l) => l.actionType === "Account Actions").length;
    const academicActions = auditLogs.filter((l) => l.actionType === "Academic Actions").length;
    return { total, eventActions, financialActions, accountActions, academicActions };
  }, [auditLogs]);

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      alert("No logs to export.");
      return;
    }
    const headers = ["Timestamp", "User / Actor", "Role", "Action", "Action Type", "Details", "IP Address"];
    const rows = filteredLogs.map((l) => {
      const date = l.createdAt?.toDate ? l.createdAt.toDate().toLocaleString() : new Date().toLocaleString();
      return [
        `"${date}"`,
        `"${l.performedBy || ""}"`,
        `"${l.userRole || ""}"`,
        `"${l.action || ""}"`,
        `"${l.actionType || ""}"`,
        `"${(l.details || "").replace(/"/g, '""')}"`,
        `"${l.ipAddress || ""}"`,
      ];
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `STI_Sync_Audit_Logs_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getBadgeStyle = (type: AuditActionType) => {
    switch (type) {
      case "Event Actions":
        return "bg-[#0E4EBD] text-white";
      case "Financial Actions":
        return "bg-green-600 text-white";
      case "Account Actions":
        return "bg-purple-600 text-white";
      case "Academic Actions":
        return "bg-amber-600 text-white";
      case "Organization Actions":
        return "bg-cyan-700 text-white";
      case "Document Actions":
        return "bg-indigo-600 text-white";
      default:
        return "bg-gray-600 text-white";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#001A4D]">Audit Logs</h2>
          <p className="text-gray-500 text-sm">Monitor all system activities and administrative actions</p>
        </div>
        <Button onClick={handleExportCSV} variant="outline" className="border-[#0E4EBD] text-[#0E4EBD] cursor-pointer">
          <Download className="w-4 h-4 mr-2" />
          Export CSV Logs
        </Button>
      </div>

      {/* Search and Filter */}
      <Card className="border-[#E0E0E0]">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search logs by user, action, details, or IP..."
                className="pl-9 border-[#E0E0E0] focus-visible:ring-[#1E70E8]"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-[#001A4D] font-medium"
              >
                <option value="ALL">All Action Types</option>
                <option value="Event Actions">Event Actions</option>
                <option value="Financial Actions">Financial Actions</option>
                <option value="Account Actions">Account Actions</option>
                <option value="Academic Actions">Academic Actions</option>
                <option value="Organization Actions">Organization Actions</option>
                <option value="Document Actions">Document Actions</option>
                <option value="System Actions">System Actions</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Card className="border-[#E0E0E0]">
          <CardContent className="p-4">
            <div className="text-xs text-gray-500 font-semibold mb-1 uppercase">Total Logs</div>
            <div className="text-2xl font-bold text-[#001A4D]">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="border-[#E0E0E0]">
          <CardContent className="p-4">
            <div className="text-xs text-gray-500 font-semibold mb-1 uppercase">Event Actions</div>
            <div className="text-2xl font-bold text-[#0E4EBD]">{stats.eventActions}</div>
          </CardContent>
        </Card>
        <Card className="border-[#E0E0E0]">
          <CardContent className="p-4">
            <div className="text-xs text-gray-500 font-semibold mb-1 uppercase">Financial</div>
            <div className="text-2xl font-bold text-[#22C55E]">{stats.financialActions}</div>
          </CardContent>
        </Card>
        <Card className="border-[#E0E0E0]">
          <CardContent className="p-4">
            <div className="text-xs text-gray-500 font-semibold mb-1 uppercase">Account Actions</div>
            <div className="text-2xl font-bold text-purple-600">{stats.accountActions}</div>
          </CardContent>
        </Card>
        <Card className="border-[#E0E0E0]">
          <CardContent className="p-4">
            <div className="text-xs text-gray-500 font-semibold mb-1 uppercase">Academic Actions</div>
            <div className="text-2xl font-bold text-amber-600">{stats.academicActions}</div>
          </CardContent>
        </Card>
      </div>

      {/* Audit Log Table */}
      <Card className="border-[#E0E0E0]">
        <CardHeader>
          <CardTitle className="text-[#001A4D] text-lg font-bold flex items-center justify-between">
            <span>System Activity Stream</span>
            <span className="text-xs font-normal text-gray-500">Showing {filteredLogs.length} entries</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 text-[#0E4EBD] animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-500 font-medium">Streaming live audit logs...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-bold text-[#001A4D]">Timestamp</TableHead>
                    <TableHead className="font-bold text-[#001A4D]">User / Role</TableHead>
                    <TableHead className="font-bold text-[#001A4D]">Action</TableHead>
                    <TableHead className="font-bold text-[#001A4D]">Type</TableHead>
                    <TableHead className="font-bold text-[#001A4D]">Details</TableHead>
                    <TableHead className="font-bold text-[#001A4D]">IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => {
                    const formattedDate = log.createdAt?.toDate
                      ? log.createdAt.toDate().toLocaleString('en-PH', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Just now';

                    return (
                      <tr key={log.id} className="hover:bg-blue-50/30 transition-colors border-b border-gray-100">
                        <TableCell className="font-medium text-xs text-gray-600 whitespace-nowrap">
                          {formattedDate}
                        </TableCell>
                        <TableCell className="text-sm font-semibold text-[#001A4D]">
                          {log.performedBy}
                          {log.userRole && (
                            <span className="block text-[11px] text-gray-400 font-normal">{log.userRole}</span>
                          )}
                        </TableCell>
                        <TableCell className="font-bold text-[#001A4D] text-sm">
                          {log.action}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${getBadgeStyle(log.actionType)} text-[10px] font-bold border-0`}>
                            {log.actionType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-gray-700 max-w-xs">{log.details}</TableCell>
                        <TableCell className="text-xs font-mono text-gray-500">{log.ipAddress || '127.0.0.1'}</TableCell>
                      </tr>
                    );
                  })}
                  {filteredLogs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-gray-400">
                        No audit log entries found matching your criteria.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
