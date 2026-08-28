# STI Sync — Agent Routing Protocol

> **Purpose:** Execution protocol for AI coding agents working on the STI Sync codebase. Follow this document before writing a single line of code. It eliminates wasted context tokens by routing you to the exact files, schemas, and domain rules relevant to the request.

testtest
---

## 1. Context Routing — Mandatory Pre-Execution Phase

Before modifying any source file, execute this decision sequence in order:

### Phase 1: Request Analysis
1. Parse the user's request and extract the **target entity** (e.g., `events`, `organizations`, `attendance`, `payables`, `certificates`, `announcements`).
2. Extract the **target role** — is this an Admin (SAO) feature or an Officer feature?
3. Extract the **operation type** — read (display/query), write (create/update/delete), or real-time (live stream subscription).

### Phase 2: Schema Binding
1. Open [`docs/database-schema.md`](file:///c:/VSCODE%20PROJECTS/STI%20Sync%20Web/docs/database-schema.md).
2. Locate the Firestore collection definition that matches the target entity.
3. Identify every field that the request touches. If a field does not exist in the schema, **halt and ask the user** before inventing new fields.
4. If the request involves real-time triggers, locate the matching WebSocket message type in the Message Schema Matrix.

### Phase 3: Context Document Routing
| Condition | Route To |
|-----------|----------|
| User is SAO Admin **or** request involves admin-only fields (e.g., `adminFeeOverride`, `fastTrack`, `approvalStatus` writes) | [`docs/admin-backend-context.md`](file:///c:/VSCODE%20PROJECTS/STI%20Sync%20Web/docs/admin-backend-context.md) |
| User is Student Officer **or** request involves org-scoped queries, event proposals, gate scanning, member management | [`docs/officer-backend-context.md`](file:///c:/VSCODE%20PROJECTS/STI%20Sync%20Web/docs/officer-backend-context.md) |
| Request spans both roles (e.g., shared module like certificates) | Read **both** context documents; implement shared logic in `src/app/modules/<entity>/` with role-conditional branching via `isAdmin` prop |

### Phase 4: File Scoping
1. Navigate to `src/app/modules/<entity>/` — this is your **exclusive working directory**.
2. Do **not** scatter entity logic across `admin/pages/`, `officer/pages/`, or any other directory.
3. The `src/app/admin/` and `src/app/officer/` folders are **portal shells only** — they contain layouts, sidebars, and route wiring. They import from `modules/<entity>/` and render those components.

---

## 2. Architecture Rules

### 2.1 Directory Structure Contract

```
src/
├── app/
│   ├── admin/                          # Portal shell — layout + route config ONLY
│   │   ├── components/
│   │   │   └── layout/
│   │   │       ├── Layout.tsx          # Admin shell (Sidebar + TopNav + <Outlet />)
│   │   │       ├── Sidebar.tsx
│   │   │       └── TopNav.tsx
│   │   └── pages/                      # Thin page wrappers — import from modules/
│   │       ├── Dashboard.tsx
│   │       ├── Organizations.tsx       # → renders <OrganizationList /> from modules/organizations/
│   │       ├── EventApprovals.tsx      # → renders <EventApprovalsDashboard /> from modules/events/
│   │       ├── AttendanceMonitoring.tsx # → renders <AttendanceMonitor /> from modules/attendance/
│   │       ├── FinancialLiquidations.tsx
│   │       ├── StudentRegistry.tsx
│   │       ├── ReportsAnalytics.tsx
│   │       ├── Certificates.tsx        # → renders <CertificateModule isAdmin /> from modules/certificates/
│   │       ├── Announcements.tsx
│   │       ├── AuditLogs.tsx
│   │       ├── AdminDocuments.tsx
│   │       ├── SystemSettings.tsx
│   │       ├── AcademicSemesterSettings.tsx
│   │       └── BudgetFundSettings.tsx
│   │
│   ├── officer/                        # Portal shell — layout + route config ONLY
│   │   ├── components/
│   │   │   ├── OfficerLayout.tsx       # Officer shell (<Outlet />)
│   │   │   ├── OfficerSidebar.tsx
│   │   │   └── OfficerTopNav.tsx
│   │   └── pages/                      # Thin page wrappers — import from modules/
│   │       ├── OfficerDashboardPage.tsx
│   │       ├── EventManagement.tsx     # → renders <EventManagementDashboard /> from modules/events/
│   │       ├── AttendanceLogs.tsx      # → renders <AttendanceLogViewer /> from modules/attendance/
│   │       ├── OfficerCertificates.tsx # → renders <CertificateModule /> from modules/certificates/
│   │       ├── FinancialLiquidation.tsx
│   │       ├── FinanceCenter.tsx
│   │       ├── OfficerDocuments.tsx
│   │       ├── MemberDirectory.tsx
│   │       ├── OfficerAnnouncements.tsx
│   │       └── OfficerSettings.tsx
│   │
│   ├── modules/                        # ════ SCREAMING ARCHITECTURE — entity domains ════
│   │   ├── events/
│   │   │   ├── components/
│   │   │   │   ├── EventApprovalsDashboard.tsx
│   │   │   │   ├── EventManagementDashboard.tsx
│   │   │   │   ├── EventDetailView.tsx
│   │   │   │   ├── EventProposalReview.tsx
│   │   │   │   ├── SaoEventCreationModal.tsx
│   │   │   │   ├── OfficerEventProposalModal.tsx
│   │   │   │   └── wizard/
│   │   │   │       ├── Step1EventDetails.tsx
│   │   │   │       ├── Step2Schedule.tsx
│   │   │   │       ├── Step3Participants.tsx
│   │   │   │       ├── Step4Staff.tsx
│   │   │   │       ├── Step5Budget.tsx
│   │   │   │       ├── Step6Documents.tsx
│   │   │   │       └── Step7Publish.tsx
│   │   │   ├── utils/
│   │   │   │   └── event-validation.ts        # Steps 1–7 validation engine, session overlap & venue collision checks
│   │   │   ├── hooks/
│   │   │   │   ├── useEventStream.ts          # onSnapshot() for /events collection
│   │   │   │   ├── usePendingProposals.ts     # Admin: pending event proposal stream
│   │   │   │   ├── useOrgEvents.ts            # Officer: org-scoped event stream
│   │   │   │   ├── useEventCreation.ts        # Wizard creation & proposal state controller
│   │   │   │   └── useEventMutations.ts       # create / update / approve / reject writes
│   │   │   ├── services/
│   │   │   │   ├── event.service.ts           # Firestore CRUD for /events
│   │   │   │   └── event-config.service.ts    # Firestore CRUD for event types, categories, venues
│   │   │   ├── types/
│   │   │   │   └── event.types.ts             # EventDocument, Session, BudgetLine interfaces
│   │   │   └── index.ts                       # Public barrel exports
│   │   │
│   │   ├── organizations/
│   │   │   ├── components/
│   │   │   │   ├── OrganizationList.tsx
│   │   │   │   ├── CreateOrganizationModal.tsx
│   │   │   │   └── CreateClubModal.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useOrganizationStream.ts   # onSnapshot() for /organizations
│   │   │   │   └── useOrganizationMutations.ts
│   │   │   ├── services/
│   │   │   │   └── organization.service.ts
│   │   │   ├── types/
│   │   │   │   └── organization.types.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── attendance/
│   │   │   ├── components/
│   │   │   │   ├── AttendanceMonitor.tsx       # Admin: cross-org attendance view
│   │   │   │   ├── AttendanceLogViewer.tsx     # Officer: org-scoped attendance
│   │   │   │   └── ScannerInterface.tsx        # QR scanning UI
│   │   │   ├── hooks/
│   │   │   │   ├── useAttendanceStream.ts      # onSnapshot() for /attendance
│   │   │   │   ├── useValidateGateAccess.ts   # Officer: QR gate validation engine
│   │   │   │   └── useAttendanceMutations.ts
│   │   │   ├── services/
│   │   │   │   └── attendance.service.ts
│   │   │   ├── types/
│   │   │   │   └── attendance.types.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── payables/
│   │   │   ├── components/
│   │   │   │   ├── StudentPayablesPanel.tsx    # Payables tab in EventDetailView
│   │   │   │   ├── PaymentConfirmationModal.tsx
│   │   │   │   └── PayableCalculatorModal.tsx  # Step 5 student payables calculator
│   │   │   ├── hooks/
│   │   │   │   ├── usePayableStream.ts         # onSnapshot() for /payables
│   │   │   │   └── usePayableMutations.ts      # Mark paid/unpaid, toggle qrTicketUnlocked
│   │   │   ├── services/
│   │   │   │   └── payable.service.ts
│   │   │   ├── types/
│   │   │   │   └── payable.types.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── certificates/
│   │   │   ├── components/
│   │   │   │   ├── CertificateModule.tsx       # Entry point — accepts isAdmin prop
│   │   │   │   ├── CertificateDashboard.tsx
│   │   │   │   ├── TemplateLibrary.tsx
│   │   │   │   ├── TemplateEditor.tsx
│   │   │   │   ├── GenerateCertificates.tsx
│   │   │   │   ├── PreviewModal.tsx
│   │   │   │   └── ExportModal.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useCertificateStream.ts
│   │   │   ├── services/
│   │   │   │   └── certificate.service.ts
│   │   │   ├── types/
│   │   │   │   └── certificate.types.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── announcements/
│   │   │   ├── components/
│   │   │   │   ├── AnnouncementsDashboard.tsx  # Admin view
│   │   │   │   └── OfficerAnnouncementsFeed.tsx # Officer view
│   │   │   ├── hooks/
│   │   │   │   └── useAnnouncementStream.ts
│   │   │   ├── services/
│   │   │   │   └── announcement.service.ts
│   │   │   ├── types/
│   │   │   │   └── announcement.types.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── documents/
│   │   │   ├── components/
│   │   │   │   ├── AdminDocumentReview.tsx
│   │   │   │   ├── AdminDocumentsDashboard.tsx
│   │   │   │   └── OfficerDocumentsDashboard.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useDocumentStream.ts
│   │   │   ├── services/
│   │   │   │   └── document.service.ts
│   │   │   ├── types/
│   │   │   │   └── document.types.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── finance/
│   │   │   ├── components/
│   │   │   │   ├── FinancialLiquidationsDashboard.tsx  # Admin
│   │   │   │   ├── OfficerFinanceLiquidation.tsx       # Officer
│   │   │   │   └── OfficerFinanceCenter.tsx            # Officer
│   │   │   ├── hooks/
│   │   │   │   └── useFinanceStream.ts
│   │   │   ├── services/
│   │   │   │   └── finance.service.ts
│   │   │   ├── types/
│   │   │   │   └── finance.types.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── academic/
│   │   │   ├── hooks/
│   │   │   │   └── useAcademicStream.ts
│   │   │   ├── services/
│   │   │   │   └── academic.service.ts
│   │   │   ├── types/
│   │   │   │   └── academic.types.ts
│   │   │   └── index.ts
│   │   │
│   │   │
<!-- AGENT-UPDATED: 2026-06-25 — Added `documents` module directory to Section 2.1 -->
│   │   ├── documents/
│   │   │   ├── hooks/
│   │   │   │   ├── useDocumentCategories.ts  # onSnapshot() for /document_categories
│   │   │   │   ├── useDocumentSettings.ts    # onSnapshot() for /system_settings/document_settings
│   │   │   │   └── useDocumentStream.ts      # onSnapshot() hooks: useIncomingDocuments, useSentDocuments, useOfficerSubmissions, useOfficerInbox
│   │   │   ├── services/
│   │   │   │   ├── document_category.service.ts # CRUD for /document_categories
│   │   │   │   ├── document_settings.service.ts # Read/write /system_settings/document_settings
│   │   │   │   └── document.service.ts       # CRUD for /documents (EDMS core: createDocument, reviewDocument, markDocumentRead, getNextReferenceNumber)
│   │   │   ├── types/
│   │   │   │   └── document.types.ts         # DocumentCategoryDocument, DocumentSettingsDocument, DocumentDocument, DocStatus, DocFileType, DocDistribution
│   │   │   └── index.ts                       # Barrel exports
│   │   │
<!-- AGENT-UPDATED: 2026-06-12 — Added `auth` and `academic` module directories to Section 2.1 -->
│   │   └── members/
│   │       ├── components/
│   │       │   ├── StudentRegistryDashboard.tsx   # Admin
│   │       │   └── MemberDirectoryDashboard.tsx   # Officer
│   │       ├── hooks/
│   │       │   └── useMemberStream.ts
│   │       ├── services/
│   │       │   └── member.service.ts
│   │       ├── types/
│   │       │   └── member.types.ts
│   │       └── index.ts
│   │
│   │   └── auth/                         # Firebase Auth + adviser profile
│   │       ├── hooks/
│   │       │   └── useAdviserProfile.ts  # onAuthStateChanged + onSnapshot for /sas_admins/{uid}
│   │       ├── services/
│   │       │   └── auth.service.ts       # signInAdviser, signOutAdviser, getAdviserProfile, createAdviserProfile, updateAdviserProfile
│   │       ├── types/
│   │       │   └── adviser.types.ts      # SasAdminDocument, SasAdminUpdatePayload
│   │       └── index.ts                  # Barrel exports
│   │
│   ├── components/                     # Shared UI primitives (role-agnostic)
│   │   ├── ui/                         # shadcn-style primitives
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── input.tsx
│   │   │   ├── tabs.tsx
│   │   │   └── ...
│   │   └── figma/
│   │       └── ImageWithFallback.tsx
│   │
│   ├── auth/                           # Login / landing pages
│   │   ├── LandingPage.tsx
│   │   ├── SASAdminLogin.tsx
│   │   └── OfficerLogin.tsx
│   │
│   ├── routes.tsx                      # React Router route definitions
│   ├── App.tsx                         # Root component
│   └── ErrorPage.tsx
│
├── services/                           # Initialization engines (global singletons)
│   ├── firebase.ts                     # Firebase app init, Firestore/Auth/Storage instances
│   ├── cloudinary.ts                   # APP-WIDE upload engine — uploadToCloudinary() for ALL image/file uploads
│   └── websocket.ts                    # WebSocket client hub — connection, reconnect, dispatch
│
├── styles/
│   ├── theme.css                       # CSS custom properties, base typography
│   └── fonts.css                       # Font imports
│
└── imports/                            # Figma-imported assets
    └── ...
```

### 2.2 Module Internal Convention

Every module under `src/app/modules/<entity>/` follows this internal layout:

```
<entity>/
├── components/      # All React components for this domain
│   └── ...          # Including wizard steps, modals, dashboards
├── hooks/           # Custom React hooks — real-time streams + mutations
│   ├── use<Entity>Stream.ts       # onSnapshot() read subscription
│   └── use<Entity>Mutations.ts    # Firestore write operations
├── services/        # Pure Firestore logic — no React dependencies
│   └── <entity>.service.ts        # addDoc, updateDoc, deleteDoc, query builders
├── types/           # TypeScript interfaces and type guards
│   └── <entity>.types.ts          # Document interfaces matching database-schema.md
└── index.ts         # Barrel exports — public API for this module
```

---

## 3. Technology Mandates

### 3.1 State Management
- **FORBIDDEN:** Zustand, Redux, Jotai, Recoil, MobX, or any global state library.
- **REQUIRED:** Localized React state (`useState`, `useReducer`) driven by custom real-time hooks.
- **Pattern:** Each hook subscribes to a Firestore `onSnapshot()` listener and exposes `{ data, loading, error }`. Components consume these hooks directly.

### 3.2 Routing
- **Library:** React Router v7 — `import { ... } from "react-router"` (not `"react-router-dom"`).
- **Router:** `createBrowserRouter()` in `src/app/routes.tsx`.
- **Convention:** Admin routes under `/home/*`, officer routes under `/officer/*`.

### 3.3 Real-Time Data
- **Primary:** Firestore `onSnapshot()` for all persistent data synchronization.
- **Secondary:** WebSocket for ephemeral, low-latency triggers (gate scan events, broadcast announcements).
- **Init files:** `src/services/firebase.ts` and `src/services/websocket.ts`.

### 3.4 Cleanup Contract
Every `onSnapshot()` subscription and WebSocket listener **must** return an unsubscribe function, which is called in the hook's `useEffect` cleanup:

```typescript
// hooks/useEventStream.ts
export function useEventStream(filters?: EventFilters) {
  const [events, setEvents] = useState<EventDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const q = buildEventQuery(filters);
    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EventDocument)));
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return () => unsubscribe();  // ← MANDATORY cleanup
  }, [filters]);

  return { events, loading, error };
}
```

### 3.5 Styling
- Tailwind CSS v4 — no `tailwind.config.js`.
- Design tokens in `src/styles/theme.css`.
- Follow `docs/admin-design-patterns.md` and `docs/officer-design-patterns.md` for role-specific styling.

### 3.6 Icons & Images
- Icons: `lucide-react` only.
- Images: Figma asset imports via `import img from "figma:asset/hash.png"`.
- Use `<ImageWithFallback />` instead of raw `<img>` tags.

<!-- AGENT-UPDATED: 2026-06-17 — Documented Cloudinary as the store for user-uploaded images (student photos). -->
<!-- AGENT-UPDATED: 2026-06-17 — Cloudinary is the APP-WIDE upload standard for ALL forms (logos, covers, receipts, docs), not just student photos. Added `src/services/cloudinary.ts`. -->
### 3.7 User-Uploaded Images & Files (Cloudinary — APP-WIDE STANDARD)

**This applies to EVERY form in the app that uploads an image or file** — not just
student photos. Examples: student selfie/school-ID photos, **organization & club logos**,
event cover images, certificate template backgrounds, liquidation receipts, document
attachments, adviser avatars, and any future upload field.

**Rules (mandatory):**
- **All uploads go through `src/services/cloudinary.ts`** via `uploadToCloudinary(file, { folder })`. Do **not** call the Cloudinary endpoint directly, and do **not** use Firebase Storage for user uploads.
- **Firestore stores ONLY the returned `secureUrl`** (a string) in the relevant `*Url` field — never the binary, never a `blob:`/`object` URL. (e.g. `logoUrl`, `coverImageUrl`, `profilePhotoUrl`, `avatarUrl`.)
- **Never store a `URL.createObjectURL()` blob URL** in Firestore — it is temporary and dies on refresh. Upload first, then store the `secureUrl`.
- Use a sensible `folder` per domain to keep the media library organised: `students/profile`, `students/school-id`, `organizations/logos`, `events/covers`, `finance/receipts`, etc.
- Disable the form's submit/next button while an upload is in flight; surface upload errors inline.

**Config & security:**
- Cloud name `djwlkcgnx`, **unsigned** upload preset `sti_sync_uploads`, uploaded from the browser via `axios`.
- This is a frontend app — anything in code ships to the browser. **Never** place the Cloudinary **API Secret** (or API Key, or any signed-upload credential) in client code. Unsigned presets require only the cloud name + preset name (both already in `cloudinary.ts`).

**Two upload patterns (both valid):**
- **Upload-on-select (UI layer):** call `uploadToCloudinary` the moment the file is chosen, show progress, store the `secureUrl` in form state. Block the form's Next/Submit while uploading. — Reference: `AddStudentManuallyModal.tsx` → `PhotoStep` (→ `profilePhotoUrl` / `schoolIdPhotoUrl`).
- **Upload-on-submit (service layer):** keep the raw `File` in form state, pass it to the service, which uploads then writes the `secureUrl` to Firestore in the same call. — Reference: `organization.service.ts` `createOrganization()` (logo `File` → `organizations/logos` → `logoUrl`). Used by `CreateClubModal.tsx`.

> Note: Firebase Storage is **no longer used** for user uploads — `organization.service.ts` was migrated from `firebase/storage` to Cloudinary. `storage` is still exported from `services/firebase.ts` but should not be used for new upload features.

---

## 4. Self-Documentation Update Rule

> **This is non-negotiable.** If you modify any of the following, you **must** update the corresponding documentation file in the **same execution run**, before presenting the result to the user.

| What Changed | Update Target |
|-------------|---------------|
| New Firestore collection or field added | `docs/database-schema.md` — add the field/collection with type and description |
| New WebSocket message type | `docs/database-schema.md` — add to Message Schema Matrix |
| New admin-facing hook, service, or backend flow | `docs/admin-backend-context.md` — document the hook signature and data flow |
| New officer-facing hook, service, or backend flow | `docs/officer-backend-context.md` — document the hook signature and data flow |
| New module directory created | `docs/agent.md` — update the directory tree in Section 2.1 |
| Route added or changed | `docs/agent.md` — update the route table if one exists, and update `src/app/routes.tsx` |
| New image/file upload field added to any form | Upload via `src/services/cloudinary.ts` (§3.7); store only `secureUrl` in the matching `*Url` field in `docs/database-schema.md` |

### Update Format
When updating a doc, append to the relevant section with a change marker:

```markdown
<!-- AGENT-UPDATED: 2026-06-12 — Added `notifications` collection -->
```

---

## 5. Execution Checklist

Run this checklist mentally before every code generation task:

- [ ] **Phase 1:** Identified entity + role + operation type
- [ ] **Phase 2:** Verified all fields exist in `database-schema.md`
- [ ] **Phase 3:** Read the correct backend context document (`admin-backend-context.md` or `officer-backend-context.md`)
- [ ] **Phase 4:** Confirmed working directory is `src/app/modules/<entity>/`
- [ ] **State check:** No global state libraries introduced
- [ ] **Cleanup check:** Every `onSnapshot()` and WebSocket listener has `useEffect` cleanup
- [ ] **Import check:** Using `"react-router"` (not `"react-router-dom"`)
- [ ] **Doc update check:** If schemas or flows changed, docs are updated in this run

---

## 6. Anti-Patterns — Hard Stops

If you catch yourself doing any of the following, **stop and restructure:**

| Anti-Pattern | Correct Approach |
|-------------|-----------------|
| Creating a new file in `admin/components/` for entity logic | Move to `modules/<entity>/components/` |
| Using `collection("events")` directly in a component | Create or use `modules/events/services/event.service.ts` |
| Adding Zustand/Redux store | Use a custom hook with `useState` + `onSnapshot()` |
| Hardcoding Firestore field names in JSX | Reference the type from `modules/<entity>/types/` |
| Subscribing to `onSnapshot()` without cleanup | Add `return () => unsubscribe()` in `useEffect` |
| Importing from `"react-router-dom"` | Use `"react-router"` |
| Creating admin-only toggle in officer component | Hide it entirely; officer must not see admin controls |
| Skipping doc update after schema change | Update docs before finishing the task |

---

<!-- AGENT-UPDATED: 2026-08-01 — Documented student_payables, financial_liquidations, certificate_templates, issued_certificates, and organization profile services -->
<!-- AGENT-UPDATED: 2026-08-01 — Implemented automated payables denormalization on event approval and database sync helper in EventPayablesQRControl -->
<!-- AGENT-UPDATED: 2026-08-28 — Implemented 7-step validation engine, real-time internal/external session conflict detection, interactive mini-calendar widget, cascading sections filtering, dynamic treasury balance verification, and multi-format document uploads -->

