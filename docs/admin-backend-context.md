# STI Sync — Admin Backend Context

> **Scope:** Backend integration patterns for the SAO Administrator role.
> **Primary domain:** `src/app/modules/events/`, `src/app/modules/payables/`, `src/app/modules/organizations/`, `src/app/modules/attendance/`
> **Route prefix:** `/home/*`
> **Prerequisite:** Read [`docs/database-schema.md`](file:///c:/VSCODE%20PROJECTS/STI%20Sync%20Web/docs/database-schema.md) first.

---

## 1. Admin Data Flow Architecture

The SAO Admin operates with **unrestricted read access** across all Firestore collections. Admin hooks do not apply `organizationId` filters — they consume full collection streams.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ADMIN DATA LAYER                             │
│                                                                     │
│  Firestore Collections          Admin Hooks              UI Pages   │
│  ─────────────────────          ──────────────           ────────── │
│  /events ─────────────────── usePendingProposals() ──→ EventApprovals│
│  /events ─────────────────── useEventStream() ────────→ Dashboard    │
│  /organizations ──────────── useOrganizationStream() ─→ Organizations│
│  /attendance ─────────────── useAttendanceStream() ───→ Attendance   │
│  /payables ───────────────── usePayableStream() ──────→ EventDetail  │
│                                                                     │
│  WebSocket Hub                                                      │
│  ─────────────                                                      │
│  ATTENDANCE_SCANNED ──────── live feed ──────────────→ Attendance    │
│  GATE_ACCESS_DENIED ──────── alert stream ───────────→ Dashboard     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Pending Event Proposals — Live Stream Processing

### Hook: `usePendingProposals()`

**Location:** `src/app/modules/events/hooks/usePendingProposals.ts`

**Purpose:** Subscribes to all events where `proposalStatus === 'pending_review'`, ordered by `createdAt` descending. This powers the admin's Event Approvals page with a real-time queue.

```typescript
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import type { EventDocument } from '../types/event.types';

export function usePendingProposals() {
  const [proposals, setProposals] = useState<EventDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'events'),
      where('proposalStatus', '==', 'pending_review'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        const docs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as EventDocument));
        setProposals(docs);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { proposals, loading, error };
}
```

### Consuming Page: `EventApprovals.tsx`

The admin page (thin wrapper in `src/app/admin/pages/EventApprovals.tsx`) renders the `EventApprovalsDashboard` component from `src/app/modules/events/components/EventApprovalsDashboard.tsx`.

```typescript
// src/app/admin/pages/EventApprovals.tsx — thin wrapper
import { EventApprovalsDashboard } from '../../modules/events';

export function EventApprovals() {
  return <EventApprovalsDashboard />;
}
```

Inside the dashboard component:

```typescript
const { proposals, loading, error } = usePendingProposals();

// Render proposal cards with:
// - Organization name + event title
// - Submission date
// - "Review" button → opens EventProposalReview modal
// - "Fast Track" badge if proposal.fastTrack === true
```

---

## 3. Admin Event Approval — Atomic State Writes

### Hook: `useEventMutations()`

**Location:** `src/app/modules/events/hooks/useEventMutations.ts`

When the admin approves or rejects a proposal, the mutation must atomically update the event document:

#### Approval Flow

```typescript
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../../services/firebase';

export function useEventMutations() {

  async function approveEvent(eventId: string, adminUserId: string): Promise<void> {
    const eventRef = doc(db, 'events', eventId);
    await updateDoc(eventRef, {
      proposalStatus: 'approved',
      approvedBy: adminUserId,
      approvedAt: Timestamp.now(),
      rejectionReason: null,
      updatedAt: Timestamp.now()
    });
    // After Firestore write succeeds, fire WebSocket notification
    // so officer panels receive instant status update
    websocketHub.send({
      type: 'EVENT_STATUS_CHANGED',
      payload: {
        eventId,
        previousStatus: 'pending_review',
        newStatus: 'approved',
        updatedBy: adminUserId,
        reason: null
      }
    });
  }

  async function rejectEvent(
    eventId: string,
    adminUserId: string,
    reason: string
  ): Promise<void> {
    const eventRef = doc(db, 'events', eventId);
    await updateDoc(eventRef, {
      proposalStatus: 'rejected',
      rejectionReason: reason,
      updatedAt: Timestamp.now()
    });
    websocketHub.send({
      type: 'EVENT_STATUS_CHANGED',
      payload: {
        eventId,
        previousStatus: 'pending_review',
        newStatus: 'rejected',
        updatedBy: adminUserId,
        reason
      }
    });
  }

  return { approveEvent, rejectEvent };
}
```

**Atomicity Note:** These are single-document updates, which are inherently atomic in Firestore. If a future requirement needs multi-document atomicity (e.g., approve event + create payable records), use `writeBatch()` or `runTransaction()`.

---

## 4. SAO Event Creation Wizard — Admin Backend Integration

### Entry Point

`src/app/modules/events/components/SaoEventCreationModal.tsx`

The 7-step wizard collects form data across steps and persists the complete `EventDocument` on final publish. Each step operates on an in-memory `formData` object passed via props — no intermediate Firestore writes occur until the admin clicks "Create & Publish Event" on Step 7 or "Save as Draft" on any step.

### Write Strategies

| Action | Firestore Operation | `proposalStatus` |
|--------|-------------------|-------------------|
| Save as Draft | `addDoc()` or `updateDoc()` | `'draft'` |
| Create & Publish Event | `addDoc()` + payables generation | `'approved'` (admin-created events skip review) |

### Step 5 — Student Payables Backend Calculation

**Component:** `src/app/modules/payables/components/PayableCalculatorModal.tsx`

When the admin enables the "Student Payables" toggle in Step 5 of the event wizard, the following calculation pipeline executes:

```typescript
// ─── Inputs ───
const totalBudget: number = formData.budget.totalBudget;          // From Step 5 budget line items
const participantCount: number = formData.expectedParticipantCount; // From Step 3

// ─── Auto-Calculation ───
const suggestedFeePerStudent: number = Math.ceil(totalBudget / participantCount);

// ─── Admin Override ───
// The admin can accept the suggested fee OR manually enter a custom fee
const adminFeeOverride: number = customFee ?? suggestedFeePerStudent;

// ─── Collection Projection ───
const totalExpectedCollection: number = adminFeeOverride * participantCount;
const surplus: number = totalExpectedCollection - totalBudget;
```

#### Fields Written to Event Document

```typescript
{
  studentPayablesEnabled: true,
  suggestedFeePerStudent,          // Auto-calculated
  adminFeeOverride,                // Admin's final fee decision
  totalExpectedCollection           // Projected total
}
```

#### Payables Record Generation (on Publish)

When the event is published with `studentPayablesEnabled: true`, the system generates one `/payables` document per eligible student:

```typescript
import { writeBatch, collection, doc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../services/firebase';

async function generatePayableRecords(
  eventId: string,
  organizationId: string,
  students: StudentInfo[],
  adminFeeOverride: number
): Promise<void> {
  const batch = writeBatch(db);

  for (const student of students) {
    const payableRef = doc(collection(db, 'payables'));
    batch.set(payableRef, {
      eventId,
      studentId: student.userId,
      organizationId,
      studentName: student.name,
      studentNumber: student.studentNumber,
      course: student.course,
      yearLevel: student.yearLevel,
      amountDue: adminFeeOverride,
      amountPaid: 0,
      paymentStatus: 'unpaid',
      paidAt: null,
      paymentMethod: null,
      paymentReference: null,
      processedBy: null,
      qrTicketUnlocked: false,           // ← DEFAULT: locked until payment confirmed
      transactions: [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
  }

  await batch.commit();  // Atomic batch write — all or nothing
}
```

**QR Lock Policy:** Every generated payable starts with `qrTicketUnlocked: false`. The student cannot pass QR gate scanning until an admin confirms payment, which flips this flag to `true`. See Section 5 below.

---

## 5. Payment Confirmation — Admin QR Unlock Flow

### Hook: `usePayableMutations()`

**Location:** `src/app/modules/payables/hooks/usePayableMutations.ts`

When the admin clicks "Mark as Paid" on a student's payable record:

```typescript
async function confirmPayment(
  payableId: string,
  eventId: string,
  studentId: string,
  studentName: string,
  adminUserId: string,
  adminName: string,
  method: 'cash' | 'gcash' | 'bank_transfer',
  reference: string | null
): Promise<void> {
  const payableRef = doc(db, 'payables', payableId);
  const now = Timestamp.now();

  const transaction: PaymentTransaction = {
    transactionId: crypto.randomUUID(),
    type: 'payment',
    amount: payableDoc.amountDue,         // Full payment
    method,
    reference,
    note: null,
    processedBy: adminUserId,
    processedByName: adminName,
    timestamp: now
  };

  await updateDoc(payableRef, {
    paymentStatus: 'paid',
    amountPaid: payableDoc.amountDue,
    paidAt: now,
    paymentMethod: method,
    paymentReference: reference,
    processedBy: adminUserId,
    qrTicketUnlocked: true,              // ← UNLOCKS QR gate access
    transactions: arrayUnion(transaction),
    updatedAt: now
  });

  // Fire WebSocket to instantly unlock the gate for this student
  websocketHub.send({
    type: 'PAYMENT_CONFIRMED',
    payload: {
      payableId,
      eventId,
      studentId,
      studentName,
      qrTicketUnlocked: true
    }
  });
}
```

### Reverse Payment (Mark as Unpaid)

```typescript
async function reversePayment(
  payableId: string,
  adminUserId: string,
  adminName: string,
  note: string
): Promise<void> {
  const payableRef = doc(db, 'payables', payableId);
  const now = Timestamp.now();

  const transaction: PaymentTransaction = {
    transactionId: crypto.randomUUID(),
    type: 'reversal',
    amount: 0,
    method: null,
    reference: null,
    note,
    processedBy: adminUserId,
    processedByName: adminName,
    timestamp: now
  };

  await updateDoc(payableRef, {
    paymentStatus: 'unpaid',
    amountPaid: 0,
    paidAt: null,
    paymentMethod: null,
    paymentReference: null,
    processedBy: null,
    qrTicketUnlocked: false,             // ← RE-LOCKS QR gate access
    transactions: arrayUnion(transaction),
    updatedAt: now
  });
}
```

---

## 6. Admin Attendance Monitoring

### Hook: `useAttendanceStream()`

**Location:** `src/app/modules/attendance/hooks/useAttendanceStream.ts`

Admin version — no `organizationId` filter, full cross-org visibility:

```typescript
export function useAttendanceStream(filters?: {
  eventId?: string;
  sessionId?: string;
  dateRange?: { start: Timestamp; end: Timestamp };
}) {
  const [records, setRecords] = useState<AttendanceDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let q = query(
      collection(db, 'attendance'),
      orderBy('scannedAt', 'desc')
    );

    if (filters?.eventId) {
      q = query(q, where('eventId', '==', filters.eventId));
    }
    if (filters?.sessionId) {
      q = query(q, where('sessionId', '==', filters.sessionId));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecords(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceDocument)));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [filters?.eventId, filters?.sessionId]);

  return { records, loading };
}
```

### WebSocket: Live Gate Feed

The admin attendance monitoring page also subscribes to the `ATTENDANCE_SCANNED` WebSocket message for instant scan-by-scan updates without waiting for Firestore snapshot latency:

```typescript
useEffect(() => {
  const handler = (msg: WebSocketMessage<AttendanceScanPayload>) => {
    if (msg.type === 'ATTENDANCE_SCANNED') {
      // Immediately prepend to the live feed UI
      // The Firestore snapshot will sync the persistent state within ~1-2s
      setLiveFeed(prev => [msg.payload, ...prev]);
    }
  };
  websocketHub.on('ATTENDANCE_SCANNED', handler);
  return () => websocketHub.off('ATTENDANCE_SCANNED', handler);
}, []);
```

---

## 7. Admin Event Detail View — Payables Integration

### Component: `EventDetailView.tsx`

**Location:** `src/app/modules/events/components/EventDetailView.tsx`

This modal has two tabs:

#### Overview Tab
Displays event metadata cards. If `studentPayablesEnabled === true`, it also renders:
- **Collection progress bar:** `totalCollected / totalExpectedCollection`
- **Paid/Unpaid counters** with QR lock indicators
- **Unpaid students quick list** — clicking navigates to the Payables tab

```typescript
// Collection metrics derived from payables stream
const { payables } = usePayableStream({ eventId });
const paidCount = payables.filter(p => p.paymentStatus === 'paid').length;
const unpaidCount = payables.filter(p => p.paymentStatus === 'unpaid').length;
const totalCollected = payables.reduce((sum, p) => sum + p.amountPaid, 0);
```

#### Student Payables Tab
Renders `StudentPayablesPanel` from `src/app/modules/payables/components/StudentPayablesPanel.tsx`:
- Search + filter pills (All / Paid / Unpaid)
- Full student table with payment status, QR ticket status
- Row action menu: "Mark as Paid" / "Mark as Unpaid"
- Confirmation modal with QR unlock notice

---

<!-- AGENT-UPDATED: 2026-06-15 — Implemented useOrganizationStream and useOrganizationMutations hooks in src/app/modules/organizations/ -->

## 8. Admin Organization Management

### Hook: `useOrganizationStream()`

**Location:** `src/app/modules/organizations/hooks/useOrganizationStream.ts`

Admin reads all organizations without filters:

```typescript
export function useOrganizationStream() {
  const [organizations, setOrganizations] = useState<OrganizationDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'organizations'),
      orderBy('name', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOrganizations(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as OrganizationDocument)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { organizations, loading };
}
```

### Mutations: `useOrganizationMutations()`

```typescript
export function useOrganizationMutations() {

  async function createOrganization(data: Omit<OrganizationDocument, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'organizations'), {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    return docRef.id;
  }

  async function updateOrganization(orgId: string, updates: Partial<OrganizationDocument>): Promise<void> {
    await updateDoc(doc(db, 'organizations', orgId), {
      ...updates,
      updatedAt: Timestamp.now()
    });
  }

  return { createOrganization, updateOrganization };
}
```

---

## 9. Hook Naming Convention

All admin-facing hooks follow this pattern:

| Hook | Collection | Filter | Purpose |
|------|-----------|--------|---------|
| `usePendingProposals()` | `events` | `proposalStatus === 'pending_review'` | Admin review queue |
| `useEventStream(filters?)` | `events` | Optional filters | General event listing |
| `usePayableStream({ eventId })` | `payables` | By event | Event payables dashboard |
| `useAttendanceStream(filters?)` | `attendance` | Optional event/session | Attendance monitoring |
| `useOrganizationStream()` | `organizations` | None (all docs) | Org management |
| `useEventMutations()` | `events` | N/A | Approve/reject/create writes |
| `usePayableMutations()` | `payables` | N/A | Payment confirm/reverse writes |
| `useOrganizationMutations()` | `organizations` | N/A | Org create/update writes |
| `useOrganizationStream()` | `organizations` | None (all docs) | Org management — live list |
| `useOrganizationTypes()` | `organization_types` | None (all docs) | Live org type list for dropdowns |
| `useOrganizationRules()` | `system_settings` | Doc ID = `organization_rules` | Live registration rules |
| `useAdviserProfile()` | `sas_admins` | By Auth UID | Live adviser profile for UI display |

All hooks return `{ data, loading, error }` (read hooks) or async mutation functions (write hooks). All read hooks include `useEffect` cleanup via `onSnapshot` unsubscribe.

---

<!-- AGENT-UPDATED: 2026-06-12 — Added Section 10: Authentication & Adviser Profile module -->

## 10. Authentication & Adviser Profile — `src/app/modules/auth/`

### Overview

Handles Firebase Authentication for the SAO Adviser login flow and manages the adviser's Firestore profile from the `sas_admins` collection.

**Module path:** `src/app/modules/auth/`

```
auth/
├── types/
│   └── adviser.types.ts     # SasAdminDocument, SasAdminUpdatePayload
├── services/
│   └── auth.service.ts      # signInAdviser, signOutAdviser, getAdviserProfile, createAdviserProfile, updateAdviserProfile
├── hooks/
│   └── useAdviserProfile.ts # Real-time profile subscription
└── index.ts                 # Barrel exports
```

---

### Service: `auth.service.ts`

**Location:** `src/app/modules/auth/services/auth.service.ts`

| Function | Description |
|----------|-------------|
| `signInAdviser(email, password)` | Firebase Auth `signInWithEmailAndPassword` — returns `UserCredential` |
| `signOutAdviser()` | Firebase Auth `signOut` |
| `getAdviserProfile(uid)` | One-shot `getDoc` on `/sas_admins/{uid}` — returns `SasAdminDocument \| null` |
| `createAdviserProfile(uid, data)` | `setDoc` — creates or overwrites a profile document |
| `updateAdviserProfile(uid, updates)` | `updateDoc` — partial profile update, auto-sets `updatedAt` |

**Login validation sequence (in `SASAdminLogin.tsx`):**
1. Call `signInAdviser(email, password)` → get `uid` from `UserCredential`
2. Call `getAdviserProfile(uid)` → verify profile exists and `isActive === true`
3. If either check fails → show error, do NOT navigate
4. On success → `navigate('/home')`

---

### Hook: `useAdviserProfile()`

**Location:** `src/app/modules/auth/hooks/useAdviserProfile.ts`

**Purpose:** Composes `onAuthStateChanged` with `onSnapshot` to provide a live, reactive adviser profile for any component that needs to display user info (e.g., TopNav, Sidebar user badge).

```typescript
const { profile, user, loading, error } = useAdviserProfile();

// profile.displayName  → "Riselle Mae B. Lucanas"
// profile.position     → "SAO Adviser"
// profile.avatarUrl    → Firebase Storage URL or null
// profile.isActive     → true
```

**Cleanup contract:** Both the `onAuthStateChanged` unsubscribe and the Firestore `onSnapshot` unsubscribe are called in the `useEffect` cleanup function.

**Usage example (TopNav or Sidebar):**
```typescript
import { useAdviserProfile } from '../../modules/auth';

function TopNav() {
  const { profile, loading } = useAdviserProfile();
  if (loading) return <Skeleton />;
  return <span>{profile?.displayName ?? 'SAO Adviser'}</span>;
}
```

---

<!-- AGENT-UPDATED: 2026-06-18 — Added Section 11: Finance & SAO Ledger module -->

## 11. Finance & SAO Ledger — `src/app/modules/finance/`

### Overview

Handles the institutional SAO budget ledger, recording allocations, manual expenses, carry-over balances, and transfers from student collections into the `sao_ledger` Firestore collection.

**Module path:** `src/app/modules/finance/`

```
finance/
├── types/
│   └── finance.types.ts     # SaoLedgerDocument, TransactionType, TransactionSource
├── services/
│   └── finance.service.ts   # addLedgerTransaction
├── hooks/
│   └── useFinanceStream.ts  # useSaoLedger
└── index.ts                 # Barrel exports
```

### Service: `finance.service.ts`

| Function | Description |
|----------|-------------|
| `addLedgerTransaction(data)` | Appends a new `SaoLedgerDocument` to the `/sao_ledger` collection. Automatically stamps `createdAt: serverTimestamp()`. |

### Hook: `useSaoLedger()`

**Purpose:** Subscribes to `/sao_ledger` ordered by `date` ascending. Consumers (like the `BudgetFundSettings` page) use this chronologically ordered stream to dynamically compute the running balance of the SAO fund, eliminating the need to store denormalized balances in Firestore which could lead to race conditions.

```typescript
const { data: rawTransactions, loading } = useSaoLedger();

// Dynamic running balance computation example:
const transactions = rawTransactions.map((tx, idx, arr) => {
  const runningBalance = arr.slice(0, idx + 1).reduce((s, curr) => {
    return curr.type === "income" ? s + curr.amount : s - curr.amount;
  }, 0);
  return { ...tx, balance: runningBalance };
});
```

---

## 12. Financial Liquidations Review & Certificate Management System

### Financial Liquidations Review (`FinancialLiquidations.tsx`)
- Service: `liquidation.service.ts`
- Hook: `useLiquidationStream()`
- Enables SAO Advisers to review officer-submitted liquidation reports, verify receipt documents lightbox previews, inspect variances against approved event budgets, and execute `approveLiquidation()`, `rejectLiquidation()`, or `returnLiquidation()` actions.

### Certificate Management & PDF Export (`src/app/admin/components/certificates/`)
- Services & Hooks: `certificate.service.ts`, `useCertificateStream.ts`
- **Template Editor (`TemplateEditor.tsx`)**: Visual drag-and-drop canvas supporting landscape and portrait orientation, dynamic placeholder tokens (`{student_name}`, `{event_name}`, `{date}`, etc.), image overlays, and signatory canvas positioning.
- **Certificate Issuance & Export (`ExportModal.tsx`, `GenerateCertificates.tsx`)**: Bulk PDF rendering via `jspdf` & `html2canvas` for landscape certificate generation and automatic issuance to student profiles.

---

## 13. Event Approval & Automated Payables Denormalization

### Workflow (`EventProposalReview.tsx` & `event.service.ts`)
- **Approval Action (`approveEvent`)**: When an SAO Admin approves an event proposal (`proposalStatus: 'approved'`), the system automatically invokes `generatePayablesForEvent()`.
- **Targeted Student Matching**: Queries active students matching the event's target departments and year levels.
- **Denormalized Roster Generation**: Each document written to `/payables` explicitly stores:
  - `studentName`: Student's full name (e.g. `"Lei Concordia"`)
  - `studentSchoolId`: Official 11-digit STI Student ID (e.g. `"02000123456"`)
  - `qrTicketUnlocked`: `false` (Defaults to **Locked 🔒** until admin unlocks or records payment)
- **In-Context Access & Sync**:
  - Embedded **Student Payables & QR Access Control** panel inside [EventProposalReview.tsx](file:///c:/VSCODE%20PROJECTS/STI%20Sync%20Web/src/app/admin/components/EventProposalReview.tsx).
  - Includes a **Sync Roster Data** button to backfill missing denormalized fields or generate roster records on existing test events.

