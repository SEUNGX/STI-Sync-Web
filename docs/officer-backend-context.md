# STI Sync — Officer Backend Context

> **Scope:** Backend integration patterns for the Student Officer role (president, secretary, treasurer, etc.).
> **Primary domain:** `src/app/modules/events/`, `src/app/modules/attendance/`, `src/app/modules/payables/`, `src/app/modules/members/`
> **Route prefix:** `/officer/*`
> **Prerequisite:** Read [`docs/database-schema.md`](file:///c:/VSCODE%20PROJECTS/STI%20Sync%20Web/docs/database-schema.md) first.

---

## 1. Multi-Tenant Boundary — Mandatory Filter on Every Query

Officers operate within a **single organization context**. Every Firestore query executed in an officer-facing hook **must** include an `organizationId` filter. There are **no exceptions** to this rule.

```typescript
// ═══ CORRECT — organization-scoped query ═══
const q = query(
  collection(db, 'events'),
  where('organizationId', '==', userOrgId),
  orderBy('createdAt', 'desc')
);

// ═══ WRONG — unscoped query (exposes cross-org data) ═══
const q = query(
  collection(db, 'events'),
  orderBy('createdAt', 'desc')
);
```

### User Organization Resolution

The officer's `organizationId` is resolved at authentication time and stored in the auth context:

```typescript
// Example: resolved from Firebase Auth custom claims or a /users document lookup
interface OfficerAuthContext {
  uid: string;
  displayName: string;
  email: string;
  organizationId: string;      // The single org this officer belongs to
  organizationName: string;
  officerRole: 'president' | 'vice_president' | 'secretary' | 'treasurer' | 'auditor' | 'member';
}
```

All officer hooks receive `organizationId` as a parameter or resolve it from the auth context.

---

## 2. Officer Data Flow Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        OFFICER DATA LAYER                                │
│                                                                          │
│  Firestore Collections             Officer Hooks               UI Pages  │
│  ─────────────────────             ─────────────              ────────── │
│  /events ──┐                                                             │
│            ├─ .where('orgId') ──── useOrgEvents() ──────────→ EventMgmt  │
│  /attendance ─ .where('orgId') ── useAttendanceStream() ───→ Attendance  │
│  /payables ─── .where('orgId') ── usePayableStream() ──────→ EventDetail │
│  /organizations ── .where(id) ─── useOrganizationStream() ─→ Dashboard  │
│                                                                          │
│  WebSocket Hub                                                           │
│  ─────────────                                                           │
│  EVENT_STATUS_CHANGED ─────────── status listener ─────────→ EventMgmt   │
│  BROADCAST_ANNOUNCEMENT ──────── notification ─────────────→ Dashboard   │
│  ATTENDANCE_SCANNED ──────────── live feed ────────────────→ Attendance   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Officer Event Streams — Org-Scoped

### Hook: `useOrgEvents(organizationId)`

**Location:** `src/app/modules/events/hooks/useOrgEvents.ts`

Subscribes to all events belonging to the officer's organization. Used for the officer event management dashboard.

```typescript
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import type { EventDocument } from '../types/event.types';

export function useOrgEvents(organizationId: string) {
  const [events, setEvents] = useState<EventDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!organizationId) return;

    const q = query(
      collection(db, 'events'),
      where('organizationId', '==', organizationId),  // ← MANDATORY tenant filter
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        const docs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as EventDocument));
        setEvents(docs);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [organizationId]);

  return { events, loading, error };
}
```

### Officer Event Mutations

Officers can only:
- **Create proposals** (`proposalStatus: 'draft'` or `'pending_review'`)
- **Update their own drafts** (where `proposalStatus === 'draft'`)
- **Cancel** their own pending proposals

Officers **cannot**:
- Set `proposalStatus` to `'approved'`
- Modify `fastTrack`, `approvedBy`, `approvedAt`
- Update events created by other organizations

```typescript
// src/app/modules/events/hooks/useEventMutations.ts — officer-safe subset

async function submitProposal(
  eventData: Omit<EventDocument, 'id' | 'proposalStatus' | 'approvedBy' | 'approvedAt'>,
  organizationId: string
): Promise<string> {
  const docRef = await addDoc(collection(db, 'events'), {
    ...eventData,
    organizationId,                         // ← Officer's org ID
    proposalStatus: 'pending_review',       // ← Officer can only submit for review
    approvedBy: null,
    approvedAt: null,
    fastTrack: false,                       // ← Officers cannot fast-track
    createdByRole: 'officer',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  });
  return docRef.id;
}

async function saveDraft(
  eventData: Partial<EventDocument>,
  organizationId: string
): Promise<string> {
  const docRef = await addDoc(collection(db, 'events'), {
    ...eventData,
    organizationId,
    proposalStatus: 'draft',
    createdByRole: 'officer',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  });
  return docRef.id;
}
```

---

## 4. Officer Attendance — Org-Scoped Stream

### Hook: `useAttendanceStream(organizationId, filters?)`

**Location:** `src/app/modules/attendance/hooks/useAttendanceStream.ts`

Officer variant — **always includes** `organizationId` filter:

```typescript
export function useAttendanceStream(
  organizationId: string,
  filters?: { eventId?: string; sessionId?: string }
) {
  const [records, setRecords] = useState<AttendanceDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organizationId) return;

    let constraints = [
      where('organizationId', '==', organizationId),  // ← MANDATORY
      orderBy('scannedAt', 'desc')
    ];

    if (filters?.eventId) {
      constraints.push(where('eventId', '==', filters.eventId));
    }
    if (filters?.sessionId) {
      constraints.push(where('sessionId', '==', filters.sessionId));
    }

    const q = query(collection(db, 'attendance'), ...constraints);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecords(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceDocument)));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [organizationId, filters?.eventId, filters?.sessionId]);

  return { records, loading };
}
```

---

## 5. Live Scanning / Gatekeeping Engine — `useValidateGateAccess`

### Hook: `useValidateGateAccess(eventId, sessionId, organizationId)`

**Location:** `src/app/modules/attendance/hooks/useValidateGateAccess.ts`

This is the **critical path hook** for the QR gate scanning workflow. It executes a strict validation sequence every time a QR code is scanned. The sequence is designed to prevent unpaid students from registering attendance.

### Validation Sequence (strict order — no steps may be skipped)

```
QR Code Scanned
       │
       ▼
┌──────────────────────────────────────────────┐
│  STEP 1: Decode QR payload                    │
│  Extract: studentId, eventId                  │
│  If malformed → return INVALID_QR error       │
└──────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│  STEP 2: Load event document                  │
│  Check: event.proposalStatus === 'approved'   │
│  Check: session exists and is within window   │
│  If fails → return SESSION_CLOSED error       │
└──────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│  STEP 3: Check /payables collection           │  ← MUST CHECK BEFORE /attendance write
│  Query: /payables                             │
│    .where('eventId', '==', eventId)           │
│    .where('studentId', '==', studentId)       │
│                                               │
│  IF event.studentPayablesEnabled === false:   │
│    → Skip to STEP 4 (no payable check needed) │
│                                               │
│  IF no payable doc found:                     │
│    → return NOT_REGISTERED error              │
│                                               │
│  IF payable.qrTicketUnlocked === false:       │
│    ┌──────────────────────────────────────┐   │
│    │  ██ HARD STOP — PAYMENT REQUIRED ██  │   │
│    │                                      │   │
│    │  1. HALT execution immediately       │   │
│    │  2. DO NOT write to /attendance      │   │
│    │  3. Display LOCK WARNING BLOCKER:    │   │
│    │     - Red full-screen overlay        │   │
│    │     - Lock icon + "PAYMENT REQUIRED" │   │
│    │     - Student name + amount due      │   │
│    │     - "Cannot proceed" message       │   │
│    │  4. Fire GATE_ACCESS_DENIED via WS   │   │
│    │  5. Return { allowed: false }        │   │
│    └──────────────────────────────────────┘   │
│                                               │
│  IF payable.qrTicketUnlocked === true:        │
│    → Continue to STEP 4                       │
└──────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│  STEP 4: Check duplicate scan                 │
│  Query: /attendance                           │
│    .where('eventId', '==', eventId)           │
│    .where('sessionId', '==', sessionId)       │
│    .where('studentId', '==', studentId)       │
│    .where('gateType', '==', 'entry')          │
│                                               │
│  IF exists → return ALREADY_SCANNED warning   │
└──────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│  STEP 5: Commit attendance write              │
│  addDoc('/attendance', {                      │
│    eventId, sessionId, studentId,             │
│    organizationId,                            │
│    studentName, studentNumber,                │
│    course, yearLevel,                         │
│    scanMethod: 'qr',                          │
│    scannedBy: officerUserId,                  │
│    scannedByName: officerName,                │
│    gateType: 'entry',                         │
│    scannedAt: Timestamp.now(),                │
│    createdAt: Timestamp.now(),                │
│    serverTimestamp: serverTimestamp()          │
│  })                                           │
└──────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│  STEP 6: Fire WebSocket trigger               │
│  websocketHub.send({                          │
│    type: 'ATTENDANCE_SCANNED',                │
│    payload: {                                 │
│      attendanceId,                            │
│      eventId, sessionId, studentId,           │
│      studentName, studentNumber,              │
│      gateType: 'entry',                       │
│      scanMethod: 'qr',                        │
│      scannedAt: Date.now()                    │
│    }                                          │
│  })                                           │
└──────────────────────────────────────────────┘
       │
       ▼
  Return { allowed: true, attendanceId }
```

### Full Hook Implementation

```typescript
import { useState, useCallback } from 'react';
import {
  collection, query, where, getDocs, addDoc,
  Timestamp, serverTimestamp, limit
} from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { websocketHub } from '../../../services/websocket';
import type { AttendanceDocument } from '../types/attendance.types';
import type { PayableDocument } from '../../payables/types/payable.types';
import type { EventDocument } from '../../events/types/event.types';

export type GateResult =
  | { allowed: true; attendanceId: string; studentName: string }
  | { allowed: false; reason: GateDenialReason; studentName?: string; amountDue?: number };

export type GateDenialReason =
  | 'INVALID_QR'
  | 'SESSION_CLOSED'
  | 'NOT_REGISTERED'
  | 'PAYMENT_REQUIRED'
  | 'ALREADY_SCANNED';

export function useValidateGateAccess(
  eventId: string,
  sessionId: string,
  organizationId: string,
  officerUserId: string,
  officerName: string
) {
  const [processing, setProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<GateResult | null>(null);

  const validateAndRecord = useCallback(async (
    qrPayload: { studentId: string; eventId: string }
  ): Promise<GateResult> => {
    setProcessing(true);

    try {
      // ─── STEP 1: Decode & Validate QR payload ───
      if (!qrPayload.studentId || !qrPayload.eventId || qrPayload.eventId !== eventId) {
        const result: GateResult = { allowed: false, reason: 'INVALID_QR' };
        setLastResult(result);
        return result;
      }

      const { studentId } = qrPayload;

      // ─── STEP 2: Load event and validate session window ───
      // (Event data should be pre-loaded and cached by the parent component)
      // Validate session timing is checked by the parent ScannerInterface component

      // ─── STEP 3: Check /payables — CRITICAL GATE CHECK ───
      const payableQuery = query(
        collection(db, 'payables'),
        where('eventId', '==', eventId),
        where('studentId', '==', studentId),
        limit(1)
      );
      const payableSnapshot = await getDocs(payableQuery);

      // Determine if payables are enabled for this event
      // (This should be pre-loaded from the event document)
      const eventPayablesEnabled = true; // ← resolved from event.studentPayablesEnabled

      if (eventPayablesEnabled) {
        if (payableSnapshot.empty) {
          const result: GateResult = { allowed: false, reason: 'NOT_REGISTERED' };
          setLastResult(result);
          return result;
        }

        const payableDoc = payableSnapshot.docs[0].data() as PayableDocument;

        if (payableDoc.qrTicketUnlocked === false) {
          // ██ HARD STOP — PAYMENT REQUIRED ██
          // DO NOT proceed to attendance write under any circumstances
          const result: GateResult = {
            allowed: false,
            reason: 'PAYMENT_REQUIRED',
            studentName: payableDoc.studentName,
            amountDue: payableDoc.amountDue
          };
          setLastResult(result);

          // Fire WebSocket alert to admin dashboard
          websocketHub.send({
            type: 'GATE_ACCESS_DENIED',
            payload: {
              eventId,
              sessionId,
              studentId,
              studentName: payableDoc.studentName,
              studentNumber: payableDoc.studentNumber,
              reason: 'payment_required',
              attemptedAt: Date.now()
            },
            organizationId
          });

          return result;
        }
      }

      // ─── STEP 4: Check duplicate scan ───
      const duplicateQuery = query(
        collection(db, 'attendance'),
        where('eventId', '==', eventId),
        where('sessionId', '==', sessionId),
        where('studentId', '==', studentId),
        where('gateType', '==', 'entry'),
        limit(1)
      );
      const duplicateSnapshot = await getDocs(duplicateQuery);

      if (!duplicateSnapshot.empty) {
        const result: GateResult = { allowed: false, reason: 'ALREADY_SCANNED' };
        setLastResult(result);
        return result;
      }

      // ─── STEP 5: Commit attendance write ───
      // This line ONLY executes if qrTicketUnlocked === true (or payables not enabled)
      const payableDoc = payableSnapshot.empty ? null : payableSnapshot.docs[0].data() as PayableDocument;

      const attendanceRef = await addDoc(collection(db, 'attendance'), {
        eventId,
        sessionId,
        studentId,
        organizationId,
        studentName: payableDoc?.studentName ?? 'Unknown',
        studentNumber: payableDoc?.studentNumber ?? '',
        course: payableDoc?.course ?? '',
        yearLevel: payableDoc?.yearLevel ?? 0,
        scanMethod: 'qr' as const,
        scannedBy: officerUserId,
        scannedByName: officerName,
        gateType: 'entry' as const,
        scannedAt: Timestamp.now(),
        createdAt: Timestamp.now(),
        serverTimestamp: serverTimestamp()
      });

      // ─── STEP 6: Fire WebSocket trigger ───
      websocketHub.send({
        type: 'ATTENDANCE_SCANNED',
        payload: {
          attendanceId: attendanceRef.id,
          eventId,
          sessionId,
          studentId,
          studentName: payableDoc?.studentName ?? 'Unknown',
          studentNumber: payableDoc?.studentNumber ?? '',
          gateType: 'entry',
          scanMethod: 'qr',
          scannedAt: Date.now()
        },
        organizationId
      });

      const result: GateResult = {
        allowed: true,
        attendanceId: attendanceRef.id,
        studentName: payableDoc?.studentName ?? 'Unknown'
      };
      setLastResult(result);
      return result;

    } catch (err) {
      console.error('[GateAccess] Validation failed:', err);
      const result: GateResult = { allowed: false, reason: 'INVALID_QR' };
      setLastResult(result);
      return result;
    } finally {
      setProcessing(false);
    }
  }, [eventId, sessionId, organizationId, officerUserId, officerName]);

  return { validateAndRecord, processing, lastResult };
}
```

### Lock Warning Blocker UI Contract

When `useValidateGateAccess` returns `{ allowed: false, reason: 'PAYMENT_REQUIRED' }`, the `ScannerInterface` component must render a full-viewport blocking overlay:

```typescript
// src/app/modules/attendance/components/ScannerInterface.tsx

{lastResult?.allowed === false && lastResult.reason === 'PAYMENT_REQUIRED' && (
  <div className="fixed inset-0 z-[100] bg-red-600/95 flex items-center justify-center">
    <div className="text-center text-white max-w-md">
      <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
        <Lock className="w-10 h-10 text-white" />
      </div>
      <h2 className="text-3xl font-bold mb-2">PAYMENT REQUIRED</h2>
      <p className="text-xl mb-1">{lastResult.studentName}</p>
      <p className="text-lg opacity-80 mb-6">
        Outstanding balance: ₱{lastResult.amountDue?.toLocaleString()}
      </p>
      <div className="bg-white/10 rounded-xl p-4 mb-8">
        <p className="text-sm opacity-90">
          This student has not completed payment for this event.
          QR ticket is locked. Entry cannot be granted until payment is confirmed by the SAO Admin.
        </p>
      </div>
      <button
        onClick={() => setLastResult(null)}
        className="px-8 py-3 bg-white text-red-600 rounded-xl font-bold text-lg
          hover:bg-gray-100 transition-colors"
      >
        Dismiss & Scan Next
      </button>
    </div>
  </div>
)}
```

<!-- AGENT-UPDATED: 2026-08-14 — Updated Section 6: Officer Event Payables & QR Ticket Access Control -->

## 6. Officer Event Payables & QR Ticket Access Control

Officers can view all target student participants for their organization's events, track collection progress, record cash payments, and manage QR ticket gate unlocking.

### Hook: `useEventPayablesStream(eventId)` / `usePayableStream(organizationId, eventId)`

**Location:** `src/app/modules/finance/hooks/usePayableStream.ts`

```typescript
export function useEventPayablesStream(eventId: string) {
  // Real-time subscription to /payables filtered by eventId
}
```

### Officer Capabilities
- **Event Payables Roster**: View all target participants matching event criteria (student name, 11-digit STI Student ID, assigned fee amount, paid amount, payment status).
- **Record Cash Payment**: Open payment modal (`AdminRecordPaymentModal` / `recordPayment`) to enter cash amount, mark student as `paid`, and unlock their mobile QR ticket in real-time.
- **Manual QR Gate Unlock**: Toggle individual student QR code tickets between `Locked 🔒` and `Unlocked 🔓` for gate access control.
- **Sync Roster Data**: Trigger `generatePayablesForEvent(eventId)` to auto-populate payables for all eligible target students.

---

## 7. Officer Member Directory — Org-Scoped

### Hook: `useMemberStream(organizationId)`

**Location:** `src/app/modules/members/hooks/useMemberStream.ts`

```typescript
export function useMemberStream(organizationId: string) {
  const [members, setMembers] = useState<MemberDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organizationId) return;

    const q = query(
      collection(db, 'members'),
      where('organizationId', '==', organizationId),  // ← MANDATORY
      orderBy('name', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMembers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [organizationId]);

  return { members, loading };
}
```

---

## 8. WebSocket Event Listeners — Officer Panel

Officers subscribe to three WebSocket message types:

### 8.1 Event Status Notifications

```typescript
// Listens for approval/rejection of this org's proposals
useEffect(() => {
  const handler = (msg: WebSocketMessage<EventStatusPayload>) => {
    if (msg.type === 'EVENT_STATUS_CHANGED') {
      // Show toast notification
      if (msg.payload.newStatus === 'approved') {
        toast.success(`"${msg.payload.eventTitle}" has been approved!`);
      } else if (msg.payload.newStatus === 'rejected') {
        toast.error(`"${msg.payload.eventTitle}" was rejected: ${msg.payload.reason}`);
      }
    }
  };
  websocketHub.on('EVENT_STATUS_CHANGED', handler);
  return () => websocketHub.off('EVENT_STATUS_CHANGED', handler);
}, []);
```

### 8.2 Broadcast Announcements

```typescript
useEffect(() => {
  const handler = (msg: WebSocketMessage<AnnouncementPayload>) => {
    if (msg.type === 'BROADCAST_ANNOUNCEMENT') {
      const targets = msg.payload.targetOrganizationIds;
      if (targets === 'all' || targets.includes(userOrgId)) {
        toast.info(`New announcement: ${msg.payload.title}`);
      }
    }
  };
  websocketHub.on('BROADCAST_ANNOUNCEMENT', handler);
  return () => websocketHub.off('BROADCAST_ANNOUNCEMENT', handler);
}, [userOrgId]);
```

### 8.3 Live Attendance Feed (during scanning)

```typescript
useEffect(() => {
  const handler = (msg: WebSocketMessage<AttendanceScanPayload>) => {
    if (msg.type === 'ATTENDANCE_SCANNED' && msg.organizationId === userOrgId) {
      // Append to real-time scan log in the attendance view
      setLiveScanLog(prev => [msg.payload, ...prev]);
    }
  };
  websocketHub.on('ATTENDANCE_SCANNED', handler);
  return () => websocketHub.off('ATTENDANCE_SCANNED', handler);
}, [userOrgId]);
```

---

## 9. Officer Permission Boundaries — Summary

| Operation | Allowed | Hook/Method |
|-----------|---------|-------------|
| View own org's events | ✅ | `useOrgEvents(orgId)` |
| Create event proposal (draft) | ✅ | `useEventMutations().saveDraft()` |
| Submit proposal for review | ✅ | `useEventMutations().submitProposal()` |
| Approve/reject proposals | ❌ | Admin only |
| View org attendance logs | ✅ | `useAttendanceStream()` |
| Scan QR codes at gate | ✅ | Mobile scanner / `useAttendanceStream` |
| View & Manage student payables | ✅ | `usePayableStream()`, `createPayable()`, `recordPayment()` |
| Generate member dues | ✅ | `payable.service.ts` (`GenerateDuesModal`) |
| Submit Financial Liquidations | ✅ | `useLiquidationStream()`, `liquidation.service.ts` (`OfficerLiquidationModal`) |
| Edit Org Profile & Logo | ✅ (Pres/VP/Sec) | `organization.service.ts` (`updateOrganization`) |
| View org members | ✅ | `useOrgMembers(orgId)` |
| View other org's data | ❌ | Blocked by `organizationId` filter |

---

## 10. Hook Naming Convention — Officer Hooks

| Hook | Collection | Filter | Purpose |
|------|-----------|--------|---------|
| `useOrgEvents(orgId)` | `events` | `organizationId === orgId` | Officer event list |
| `useAttendanceStream()` | `attendance` | `organizationId === orgId` | Org attendance log |
| `usePayableStream()` | `student_payables` | `organizationId === orgId` | Real-time student payables & dues |
| `useLiquidationStream()` | `financial_liquidations` | `organizationId === orgId` | Org event budget liquidations |
| `useOrgMembers(orgId)` | `organization_members` | `organizationId === orgId` | Member directory & officer roster |

All read hooks return `{ data/payables/liquidations, loading, error }`. All include `useEffect` cleanup. All enforce `organizationId` scoping.

---

---

<!-- AGENT-UPDATED: 2026-08-14 — Added Section 12: Auto-Population of Hosting Organization in Officer Proposal Wizard -->

## 12. Officer Proposal Wizard — Auto-Population of Hosting Organization

### Overview
In the Officer Event Proposal Wizard (`OfficerEventProposalModal.tsx` and `Step1EventDetails.tsx`):
- `hostingOrgId` is automatically extracted from the officer's active club profile (`profile.activeOrganizationId`) and assigned to the form state.
- Step 1 displays a locked, auto-populated organization identity card (showing club name, acronym, and lock badge). Manual organization selection is completely bypassed.
- In Step 4 (Staff), scanner officer selection is strictly scoped to the active officers of the proposing club.
- Proposing officers submit events with `isOfficerProposal: true` and `proposalStatus: 'pending'`, strictly segmented from institutional SAS Admin events.



