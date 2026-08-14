# STI Sync — Comprehensive Financial System & Ledger Guide

> **Document Type:** System Architecture & Operational Guide  
> **Scope:** Web Management Portal & Mobile Client Synchronization  
> **Last Updated:** August 2026  

---

## 1. Executive Summary & Core Financial Principles

The STI Sync Financial Subsystem is designed around two non-negotiable core principles:

1. **Strict Financial Independence between Admin (School/SAO) and Organizations (Clubs):**
   - School-level finances and student organization funds operate in completely separate ledgers with separate approval authorities, balance tracking, and transaction sources.
   - School-covered event expenses are deducted strictly from the **SAO Institutional Budget**. When students pay for school-wide events or admin-level fines, the money is credited strictly to the **SAO Institutional Budget**.
   - Club-covered event expenses or activities are deducted strictly from that **specific Club's Fund**. When club members pay for club event fees, membership dues, or club fines, the funds are credited strictly to that **specific Club's Fund**.
2. **Dynamic / Real-Time Student Payable Synchronization:**
   - Payables are not static one-off snapshots. When events or dues are created, eligible students are assigned payables.
   - Crucially, when new students register or transition to `ACTIVE` status after an event has already started/published, the system dynamically evaluates their eligibility (by department, year level, semester, and club membership) and generates their missing payables so they appear immediately in their mobile app.

---

## 2. Ledger Architecture & Schema Design

```
                     ┌────────────────────────────────────────┐
                     │          FINANCIAL SUB-SYSTEM          │
                     └───────────────────┬────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
   ┌───────────────────────────┐                   ┌───────────────────────────┐
   │    SAO SCHOOL BUDGET      │                   │   CLUB / ORG FUND LEDGER  │
   │      (/sao_ledger)        │                   │  (/organization_ledger)   │
   ├───────────────────────────┤                   ├───────────────────────────┤
   │ • Institutional Allocs    │                   │ • Org Allocations         │
   │ • Carry-Over Balances     │                   │ • Org Sponsorships        │
   │ • School Event Expenses   │                   │ • Club Event Expenses     │
   │ • Admin Event Collections │                   │ • Membership Dues Paid    │
   │ • Admin Fines Paid        │                   │ • Club Event Fees Paid    │
   └───────────────────────────┘                   └───────────────────────────┘
```

### 2.1 SAO School Budget Ledger (`/sao_ledger/{docId}`)

Used by Admin SAO to track institutional funds allocated for campus operations and school-wide events.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique Firestore document ID |
| `semesterId` | `string \| null` | Foreign key to `/semesters` |
| `date` | `Timestamp` | Transaction timestamp |
| `description` | `string` | Human-readable explanation |
| `eventId` | `string \| null` | Optional FK to `/events` if linked to an event |
| `type` | `'income' \| 'expense'` | Cash flow direction |
| `source` | `'allocation' \| 'student_collection' \| 'manual_expense' \| 'carry_over'` | Categorization of funds |
| `amount` | `number` | Transaction value in PHP (₱) |
| `addedBy` | `string` | Admin user identifier or system agent |
| `collectionId` | `string?` | Optional reference to collection batch or payable |
| `createdAt` | `Timestamp` | Server audit timestamp |

### 2.2 Organization / Club Fund Ledger (`/organization_ledger/{docId}`)

Maintained independently per student organization (`organizationId`).

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique Firestore document ID |
| `organizationId` | `string` | Foreign key to `/organizations` |
| `semesterId` | `string \| null` | Foreign key to `/semesters` |
| `date` | `Timestamp` | Transaction timestamp |
| `description` | `string` | Human-readable description of income or expense |
| `eventId` | `string \| null` | Optional FK to `/events` (club events) |
| `type` | `'income' \| 'expense'` | Cash flow direction |
| `source` | `'allocation' \| 'student_collection' \| 'manual_expense' \| 'carry_over' \| 'sponsorship'` | Origin of funds |
| `amount` | `number` | Transaction value in PHP (₱) |
| `addedBy` | `string` | Officer student ID / user ID |
| `collectionId` | `string?` | Reference to payable collection or member payment |
| `createdAt` | `Timestamp` | Server audit timestamp |

---

## 3. Student Payables Lifecycle & Gate Control

All individual student debts exist in the central `/payables` collection. Each payable document contains clear pointers indicating whether it belongs to an organization or the school:

```typescript
export type PayableType = 
  | 'membership_due'   // Belongs to Club (organizationId)
  | 'event_fee'        // Belongs to School OR Club (determined by organizationId)
  | 'org_fine'         // Belongs to Club
  | 'admin_fine'       // Belongs to School (organizationId: null)
  | 'custom';

export interface PayableDocument {
  id: string;
  studentId: string;           // Auth UID or School ID
  studentName: string;
  studentSchoolId: string;     // Official STI Student Number
  type: PayableType;
  label: string;
  description: string;
  organizationId: string | null;   // null = Admin/SAO; string = Specific Club
  organizationName: string | null;
  semesterId: string;
  eventId: string | null;
  assignedAmount: number;
  paidAmount: number;
  status: 'pending' | 'partial' | 'paid' | 'overdue' | 'waived';
  dueDate: Timestamp | null;
  paidAt: Timestamp | null;
  recordedBy: string | null;
  paymentMethod: string | null;
  qrTicketUnlocked: boolean;       // true = student QR ticket unlocks for gate scanner
  transferredToBudget?: boolean;
  transferredAt?: Timestamp | null;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 3.1 Cash Flow Routing Matrix

| Payable Type | Context | On Expense Incurred | On Student Payment Recorded |
|---|---|---|---|
| **School Event Fee** | `organizationId === null` | Deducted from `sao_ledger` (Expense) | Added to `sao_ledger` (Income / `student_collection`) |
| **Admin Fine** | `organizationId === null` | N/A | Added to `sao_ledger` (Income / `student_collection`) |
| **Club Event Fee** | `organizationId === 'org-xxx'` | Deducted from `organization_ledger` (Expense) | Added to `organization_ledger` (Income / `student_collection`) |
| **Membership Due** | `organizationId === 'org-xxx'` | N/A | Added to `organization_ledger` (Income / `student_collection`) |
| **Club Fine** | `organizationId === 'org-xxx'` | N/A | Added to `organization_ledger` (Income / `student_collection`) |

---

## 4. Late-Registration & Active-Status Synchronization Engine

### 4.1 The Challenge
When events are scheduled and approved, payables are initially generated for currently active students. However:
- A new student may register weeks into the semester.
- A student registration may be sitting in `PendingVerification` and get approved later.
- A student may be added to a club midway through the term.

### 4.2 Dynamic Synchronization Algorithm

```
[Trigger: Student Created OR Status changed to ACTIVE OR Added to Org]
                                 │
                                 ▼
         [Query Active Semester & Student Metadata]
         (departmentId, yearLevel, courseCode, semesterId)
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
       [Query Active Events]            [Query Org Memberships]
       - semesterId == active           - studentId == student.id
       - studentPayablesEnabled == true - status == 'active'
       - dept & year level match                 │
                 │                               │
                 ▼                               ▼
       [Check Existing Payables]        [Check Existing Payables]
       where studentId + eventId        where studentId + orgId + 'membership_due'
                 │                               │
                 ▼                               ▼
      ┌────────────────────┐          ┌────────────────────┐
      │ Missing Payables?  │          │ Missing Dues?      │
      └─────────┬──────────┘          └─────────┬──────────┘
                │ YES                           │ YES
                ▼                               ▼
      [Create Event Payable Doc]      [Create Membership Due Doc]
      (status: 'pending')             (status: 'pending')
      (qrTicketUnlocked: false)       (qrTicketUnlocked: false)
                │                               │
                └───────────────┬───────────────┘
                                │
                                ▼
         [Real-time Stream Updates Student Mobile App]
```

### 4.3 Trigger Points in Codebase
1. **Admin Manual Add (`createStudentManually`)**:
   - Immediately runs `syncStudentPayablesForActiveEvents(newStudent)`.
2. **Admin Verification Approval (`updateStudentStatus(id, 'ACTIVE')`)**:
   - Executes synchronization upon status transition to `ACTIVE`.
3. **Club Member Enrollment (`AddMemberModal` / `addMember`)**:
   - Evaluates and creates membership dues and any club-specific active event payables.

---

## 5. Security Rules & Data Integrity

- **Idempotency**: All payable sync routines query `payables` using compound matching (`studentId + eventId` or `studentId + organizationId + semesterId + type`) to prevent duplicate charge generation.
- **Audit Trails**: Every ledger entry records `addedBy` and `createdAt` timestamps.
- **Gate Safety**: Scanners block check-ins if `qrTicketUnlocked === false` for paid events.
