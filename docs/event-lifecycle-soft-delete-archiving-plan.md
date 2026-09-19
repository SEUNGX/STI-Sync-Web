# STI Sync Web — Event Lifecycle, Soft Deletion, Archiving & Financial Waiver Blueprint

> **Status:** Draft Architecture Specification  
> **Target Systems:** Admin Portal (SAS), Officer Portal, Mobile Scanner Client, Student Mobile App  
> **Database:** Google Cloud Firestore (`/events`, `/payables`, `/financial_liquidations`, `/attendance_records`, `/organizations`, `/students`)

---

## 1. Executive Summary & Core Philosophy

In an institutional enterprise system like **STI Sync**, data represents legal, academic, and financial obligations. Deleting records permanently (**hard delete**) leads to cascade corruptions (e.g., student clearance blockers, broken audit trails, missing receipts, and untracked financial transactions).

This blueprint establishes a standard architecture for:
1. **Event Editability & Locking Constraints** — Defining exactly when an event can be edited, when it is locked, and what happens when major fields change.
2. **Admin-Created Events vs. Officer-Created Events** — Handling institutional SAS campus events (`hostingOrgId = 'sas'`) versus student organization proposals.
3. **Event Cancellation & Financial Auto-Waiver Engine** — Automated atomic cancellation that voids unpaid fees, revokes scanner QR codes, handles refund/credit workflows, and voids student fines.
4. **Soft Deletion (`isDeleted`) vs. Academic Archiving (`status = 'ARCHIVED'`)** — System-wide pattern for hiding retracted data vs. sealing historical academic years.
5. **A Phased Implementation Roadmap** — A structured step-by-step plan to implement these safeguards cleanly without regressions.

---

## 2. Event Lifecycle & Editability State Machine

Events transition through six distinct lifecycle stages. Each stage enforces strict read/write boundaries:

```
┌──────────────┐     Submit     ┌────────────────┐    Approve    ┌────────────────┐
│ 1. DRAFT     │ ─────────────> │ 2. PENDING     │ ────────────> │ 3. APPROVED /  │
│ (Full Edit)  │ <───────────── │    REVIEW      │               │    PUBLISHED   │
└──────────────┘    Withdraw    │ (Locked Review)│               │ (Restricted)   │
                                └────────────────┘               └──────┬─────────┘
                                                                        │ Start
                                                                        ▼
┌──────────────┐   AY Rollover  ┌────────────────┐     End       ┌────────────────┐
│ 6. ARCHIVED  │ <───────────── │ 5. COMPLETED   │ <──────────── │ 4. ONGOING     │
│ (Read-Only)  │                │ (Locked/Audit) │               │ (Live Scan)    │
└──────────────┘                └────────────────┘               └────────────────┘
       ▲                               ▲
       │                               │ Cancel (from Stage 2, 3, or 4)
       │                        ┌──────┴─────────┐
       └─────────────────────── │ 7. CANCELLED   │ ──(Auto-Waiver Engine)
                                │ (Fines Waived) │
                                └────────────────┘
```

---

### 2.1 Editability Matrix by Stage

| Stage | Who Can Edit? | Editable Fields | Prohibited Fields | Deletion Rule |
| :--- | :--- | :--- | :--- | :--- |
| **1. Draft** | Event Creator (Officer / Admin) | **All fields** (Title, Category, Venue, Date, Sessions, Budget, Fees, Scanners) | None | **Soft Delete** (or Hard Delete allowed before first submission) |
| **2. Pending Review** | SAS Admin only (Adviser notes & corrections) | Remarks, Admin Fee Overrides | Officers cannot edit unless they click **"Withdraw Proposal"** back to Draft | Soft Delete (Admin rejection or Officer withdrawal) |
| **3. Approved / Published** | SAS Admin (Full), Officer (Restricted) | **Minor Fields**: Description, Thumbnail, Poster, Contact Person, Refreshments note | **Major Fields**: Date, Venue, Fines/Fees, Target Course/Year. *(Major edits require change request or admin re-approval)* | Cannot delete directly; Must trigger **"Cancel Event"** with mandatory justification |
| **4. Ongoing (Live)** | None (Strictly Locked) | Only live attendance scanning & late-entry logging | All event metadata (Venue, Budget, Fines, Schedule) are **100% Locked** | Emergency Cancel by Admin only |
| **5. Completed** | None (100% Read-Only) | Post-event notes / summary only | All core metadata locked; Financial Liquidation & Certificates become active | Cannot delete; Read-only for reporting |
| **6. Cancelled** | None (Historical Record) | Reason for cancellation (Admin view only) | Entire record locked | Retained for audit trail; marked `isDeleted: true` in public lists |
| **7. Archived** | None (Immutable History) | None | 100% Immutable across all roles | Stored in historical registry |

---

## 3. Admin-Created Events vs. Officer Proposals

STI Sync supports two distinct sources of events, each with distinct permission rules:

```
                            EVENT ORIGIN
                                 │
         ┌───────────────────────┴───────────────────────┐
         ▼                                               ▼
┌──────────────────────────────┐        ┌──────────────────────────────┐
│   SAS ADMIN CAMPUS EVENT     │        │  OFFICER CLUB PROPOSAL       │
│   (hostingOrgId = 'sas')     │        │  (hostingOrgId = org.id)     │
├──────────────────────────────┤        ├──────────────────────────────┤
│ • Auto-Approved on creation  │        │ • Starts in 'draft' status   │
│ • Cross-Org Scanner pool     │        │ • Requires SAO Admin review  │
│ • Institutional budget fund  │        │ • Club internal budget       │
│ • Admin override on fees     │        │ • Org officer scanners       │
│ • Campus-wide student target │        │ • Club member/course target  │
└──────────────────────────────┘        └──────────────────────────────┘
```

### 3.1 Divergence Rules
1. **Approval Workflow**:
   - **Admin Events (`hostingOrgId = 'sas'`)**: Bypasses `pending` review. Immediately transitions from `draft` to `approved`/`published`.
   - **Officer Proposals (`hostingOrgId = org.id`)**: Strictly requires SAO approval before becoming visible to students or scanner apps.
2. **Scanner Assignment**:
   - Admin events can recruit and assign scanners across **any recognized student organization**.
   - Officer events can only assign scanners from their own appointed organization officer roster.
3. **Cancellation Authority**:
   - SAO Admin can cancel **both** Admin events and Officer events.
   - Officers can only cancel their own organization's events (and only before the event is `ongoing`).

---

## 4. Event Cancellation & Financial Auto-Waiver Engine

When an approved or upcoming event is **Cancelled**, it triggers a transactional ripple effect across student payables, attendance records, scanner tickets, and financial liquidations.

```
                           EVENT CANCELLED
                                  │
      ┌───────────────────────────┼───────────────────────────┐
      ▼                           ▼                           ▼
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│ 1. PAYABLES &     │   │ 2. ATTENDANCE &   │   │ 3. FINANCIAL      │
│    FINES WAIVER   │   │    QR TICKETS     │   │    LIQUIDATIONS   │
├───────────────────┤   ├───────────────────┤   ├───────────────────┤
│ • Unpaid fees →   │   │ • Scanner QR      │   │ • Attached drafts │
│   'waived' status │   │   tokens revoked  │   │   marked 'void'   │
│ • Fines cancelled │   │ • Scan code       │   │ • Budget ledger   │
│ • Paid fees flagged│  │   deactivated     │   │   holds released  │
│   for Refund/Credit│  │ • Logs preserved  │   │ • Admin notified  │
└───────────────────┘   └───────────────────┘   └───────────────────┘
```

### 4.1 Step-by-Step Cancellation Workflow (Automated Batch Transaction)

When an event is marked as `status = 'cancelled'` (with a required `cancellationReason` string):

```typescript
interface EventCancellationPayload {
  eventId: string;
  cancelledBy: string;         // User UID
  cancelledByRole: 'admin' | 'officer';
  cancellationReason: string;  // Minimum 10 characters
  refundPolicy: 'refund_cash' | 'credit_next_event' | 'no_fees_collected';
  notifyAttendees: boolean;
}
```

#### The Engine Executes:
1. **Payables Auto-Waiver**:
   - Query all `/payables` where `eventId == targetEventId`.
   - For all items with `status == 'pending'` or `status == 'overdue'`:
     - Update `status = 'waived'`.
     - Update `waivedAt = serverTimestamp()`.
     - Update `waivedReason = "Event Cancelled: " + cancellationReason`.
2. **Paid Fees & Refund Handling**:
   - For records where `status == 'paid'` or `paidAmount > 0`:
     - Update `status = 'refund_pending'`.
     - Record `refundDue = paidAmount`.
     - Flag in Officer & Admin **Finance Center** under `"Pending Event Refunds"`.
3. **Scanner Ticket Invalidation**:
   - Set `enableQRTickets = false`.
   - Revoke `scannerActivationCode`.
   - Update all corresponding student gate passes to `ticketStatus = 'cancelled'`.
4. **Attendance Log Preservation**:
   - Any check-ins already recorded (e.g. if cancelled during Day 1 of a 2-day event) are retained for audit, but flagged `sessionStatus = 'event_cancelled'`.
5. **Liquidation Abort**:
   - If a liquidation report was created in `/financial_liquidations`, its status is updated to `returned` / `voided` with notes stating the parent event was cancelled.
6. **Audit & Notifications**:
   - Create entry in `/audit_logs`.
   - Push in-app and mobile notifications to all targeted students and assigned officers.

---

## 5. System-Wide Soft Delete & Archiving Matrix

Beyond Events, every primary entity in STI Sync follows the unified soft-deletion and archiving schema:

```typescript
// Base Entity Extension for Soft Deletion & Archiving
interface ArchivableEntity {
  isDeleted?: boolean;          // true = hidden from normal views (Soft Deleted)
  deletedAt?: Timestamp | null;
  deletedBy?: string | null;    // UID of user who deleted/retracted
  deleteReason?: string | null;

  archived?: boolean;           // true = closed due to Semester/AY Rollover
  archivedAt?: Timestamp | null;
  academicYear?: string;        // e.g., "2026-2027"
  semesterId?: string;          // FK → /semesters
}
```

### 5.1 Domain Module Rules

| Entity / Collection | Soft Delete Trigger | Auto-Waiver / Cascade Actions | Archive Trigger | Lock Conditions |
| :--- | :--- | :--- | :--- | :--- |
| **`/events`** | Cancelled / Retracted proposal | Waives unpaid fees/fines; revokes QR tickets; voids pending liquidations | End-of-Semester Rollover | Locked once `ongoing` or `completed` |
| **`/payables`** | Erroneous fee assignment | Adjusts student balance; updates ledger | End of Academic Year | Locked once `paid` or `waived` |
| **`/students`** | Erroneous registration / Duplicate entry | Soft-delete hides from roster; clears active queue | Graduation / Transfer out | Locked if account is `SUSPENDED` |
| **`/organizations`** | De-recognized club / Dissolved org | Suspends officer permissions; locks club treasury | End of Academic Year accreditation | Locked if status is `suspended` |
| **`/documents`** | Rescinded memo / Outdated guidelines | Hides from club document feed; logs recall reason | Annual archiving | Locked once `signed` or `approved` |
| **`/announcements`** | Retracted announcement / Expired notice | Removes from public banner & student dashboard | End of Semester | Read-only after posting |

---

## 6. Phased Implementation Roadmap

To roll this out safely without breaking existing live streams or UI components, the implementation is organized into **5 actionable phases**:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   PHASE 1    │ ──> │   PHASE 2    │ ──> │   PHASE 3    │ ──> │   PHASE 4    │ ──> │   PHASE 5    │
│ Foundations  │     │ Editability  │     │ Cancellation │     │ UI & Action  │     │ Archive Hub  │
│  & Schema    │     │  & Guards    │     │  & Auto-Waive│     │   Modals     │     │ & Rollover   │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

---

### Phase 1: Foundation & Data Schema Extension
*Goal: Prepare types, interfaces, Firestore security rules, and helper utilities.*

- [x] **Task 1.1**: Update `event.types.ts` with `isDeleted`, `deletedAt`, `deletedBy`, `cancellationReason`, `isArchived`, and `refundStatus`.
- [x] **Task 1.2**: Update `payable.types.ts` to support `status: 'waived' | 'refund_pending' | 'refunded'`, `waivedAt`, `waivedReason`.
- [x] **Task 1.3**: Update Firestore security rules to enforce that non-admin users cannot mutate `completed` or `archived` events.
- [x] **Task 1.4**: Create centralized helper `isEventEditable(event, userRole)` to share identical validation rules between Frontend and Backend services.

---

### Phase 2: Event Editability Rules & Field Lock Guards
*Goal: Enforce lifecycle locking in the Event Creation/Edit Wizard and Admin Proposal Review.*

- [x] **Task 2.1**: **Edit Protection in UI**:
  - In `SaoEventCreationModal.tsx` and Officer `OfficerEventProposalModal.tsx`, check `isEventEditable(event)`.
  - Disable editing for `ongoing`, `completed`, or `cancelled` events.
- [x] **Task 2.2**: **Major vs. Minor Field Locking for Approved Events**:
  - If event is `approved`, lock Date, Venue, Fines, and Target Audience fields.
  - Display alert banner: *"This event is already approved. Major changes require SAO review."*
- [x] **Task 2.3**: **Proposal Withdrawal Workflow**:
  - Add **"Withdraw Proposal"** button in Officer Portal for `pending` proposals, resetting status back to `draft` so officers can make adjustments safely.

---

### Phase 3: Event Cancellation & Financial Auto-Waiver Engine
*Goal: Build the transactional service that cancels events and clears financial liabilities.*

- [x] **Task 3.1**: Create `cancelEventTransaction(payload: EventCancellationPayload)` in `event.service.ts`:
  - Run atomic batch update setting event status to `'cancelled'`.
  - Query all associated `/payables` and batch-update unpaid records to `'waived'`.
  - Identify all paid records and mark them `'refund_pending'`.
- [x] **Task 3.2**: Invalidate active QR scanner activation code and student gate passes.
- [x] **Task 3.3**: Mark attached `/financial_liquidations` as `'voided'`.
- [x] **Task 3.4**: Write comprehensive automated unit tests for `cancelEventTransaction` ensuring zero leftover active fines or dangling payables.

---

### Phase 4: UI Implementation (Admin & Officer Cancellation Modals)
*Goal: Create user-friendly interfaces with clear warnings and confirmation steps.*

- [x] **Task 4.1**: Build `CancelEventModal.tsx` (Shared Admin & Officer Component):
  - Requires explicit cancellation reason input (min 10 chars).
  - Displays impact summary: *"This will automatically waive X unpaid student fines and revoke Y active QR passes."*
  - Select refund policy for already collected fees (Cash Refund / Credit Note).
- [x] **Task 4.2**: Update `EventApprovals.tsx` and `EventManagement.tsx` table filters:
  - Add **"Cancelled"** filter tab with clear red-pill badges.
  - Display cancellation reason tooltip on hover.
- [x] **Task 4.3**: Update Student Portal / Mobile App to show cancelled event banner with notification: *"Event Cancelled — Any pending fine for this event has been waived."*

---

### Phase 5: Archiving Hub & Semester Rollover Integration
*Goal: Connect event histories with semester rollover and build an Admin Trash/Archive Center.*

- [x] **Task 5.1**: Integrate with `AcademicSemesterSettings.tsx` Rollover Service:
  - When a semester is closed / rolled over, automatically mark all `completed` events for that semester as `archived = true`.
- [x] **Task 5.2**: Build **Admin Archive & Trash Recovery Center** in `ArchiveCenter.tsx`:
  - View soft-deleted records across Events, Students, Announcements, and Documents.
  - Provide SAO Admin **"Restore"** and **"Permanent Purge"** controls with audit logging.
- [x] **Task 5.3**: End-to-end testing with simulated live data streams.

---

## 7. Next Steps & Execution

To proceed with Phase 1 whenever ready:
1. Review the proposed state machine and financial waiver rules.
2. We will start by updating the TypeScript type definitions and core service interfaces (`event.types.ts`, `payable.types.ts`, `academic.types.ts`).
3. Build the core transaction engine (`cancelEventTransaction`) before connecting the frontend modal components.
