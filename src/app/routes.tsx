import { createBrowserRouter } from "react-router";
import { Layout } from "./admin/components/layout/Layout";
import { Dashboard } from "./admin/pages/Dashboard";
import { Organizations } from "./admin/pages/Organizations";
import { EventApprovals } from "./admin/pages/EventApprovals";
import { AttendanceMonitoring } from "./admin/pages/AttendanceMonitoring";
import { FinancialLiquidations } from "./admin/pages/FinancialLiquidations";
import { StudentRegistry } from "./admin/pages/StudentRegistry";
import { ReportsAnalytics } from "./admin/pages/ReportsAnalytics";
import { Certificates } from "./admin/pages/Certificates";
import { Announcements } from "./admin/pages/Announcements";
import { AuditLogs } from "./admin/pages/AuditLogs";
import { SystemSettings } from "./admin/pages/SystemSettings";
import { AcademicSemesterSettings } from "./admin/pages/AcademicSemesterSettings";
import { BudgetFundSettings } from "./admin/pages/BudgetFundSettings";
import { AdminDocuments } from "./admin/pages/AdminDocuments";
import { AdminDocumentReview } from "./admin/pages/AdminDocumentReview";

// Auth Pages
import LandingPage from "./auth/LandingPage";
import SASAdminLogin from "./auth/SASAdminLogin";
import OfficerLogin from "./auth/OfficerLogin";

// Officer Components
import { OfficerLayout } from "./officer/components/OfficerLayout";
import OfficerDashboardPage from "./officer/pages/OfficerDashboardPage";
import OrganizationProfile from "./officer/pages/OrganizationProfile";
import EventManagement from "./officer/pages/EventManagement";
import AttendanceLogs from "./officer/pages/AttendanceLogs";
import OfficerCertificates from "./officer/pages/OfficerCertificates";
import FinancialLiquidation from "./officer/pages/FinancialLiquidation";
import FinanceCenter from "./officer/pages/FinanceCenter";
import OfficerDocuments from "./officer/pages/OfficerDocuments";
import MemberDirectory from "./officer/pages/MemberDirectory";
import OfficerAnnouncements from "./officer/pages/OfficerAnnouncements";
import OfficerSettings from "./officer/pages/OfficerSettings";

// Error Page
import ErrorPage from "./ErrorPage";

export const router = createBrowserRouter([
  // Global Routes - Landing & Auth
  {
    path: "/",
    Component: LandingPage,
    ErrorBoundary: ErrorPage,
  },
  {
    path: "/admin/login",
    Component: SASAdminLogin,
    ErrorBoundary: ErrorPage,
  },
  {
    path: "/officer/login",
    Component: OfficerLogin,
    ErrorBoundary: ErrorPage,
  },

  // SAS Admin Routes - /home is the admin dashboard
  {
    path: "/home",
    Component: Layout,
    ErrorBoundary: ErrorPage,
    children: [
      { index: true, Component: Dashboard },
      { path: "organizations", Component: Organizations },
      { path: "event-approvals", Component: EventApprovals },
      { path: "attendance", Component: AttendanceMonitoring },
      { path: "liquidations", Component: FinancialLiquidations },
      { path: "students", Component: StudentRegistry },
      { path: "reports", Component: ReportsAnalytics },
      { path: "certificates", Component: Certificates },
      { path: "announcements", Component: Announcements },
      { path: "audit-logs", Component: AuditLogs },
      { path: "settings", Component: SystemSettings },
      { path: "academic-semester", Component: AcademicSemesterSettings },
      { path: "budget-fund", Component: BudgetFundSettings },
      { path: "documents", Component: AdminDocuments },
      { path: "documents/:docId/review", Component: AdminDocumentReview },
    ],
  },

  // Officer Routes
  {
    path: "/officer",
    Component: OfficerLayout,
    ErrorBoundary: ErrorPage,
    children: [
      { path: "dashboard", Component: OfficerDashboardPage },
      { path: "events", Component: EventManagement },
      { path: "attendance", Component: AttendanceLogs },
      { path: "certificates", Component: OfficerCertificates },
      { path: "liquidation", Component: FinancialLiquidation },
      { path: "finance", Component: FinanceCenter },
      { path: "documents", Component: OfficerDocuments },
      { path: "members", Component: MemberDirectory },
      { path: "organization", Component: () => <OfficerSettings defaultTab="organization" /> },
      { path: "announcements", Component: OfficerAnnouncements },
      { path: "settings", Component: OfficerSettings },
    ],
  },

  // Catch-all 404 route
  {
    path: "*",
    Component: ErrorPage,
  },
]);
