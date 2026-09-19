# STI Sync Mobile — Event Lifecycle, Cancellation, Refund Process & Offline Sync Specification

> **Document Version:** 1.0.0  
> **Target Systems:** STI Sync Mobile App (Student & Officer Client)  
> **Database / Backend:** Google Cloud Firestore (`/events`, `/payables`, `/attendance_records`, `/treasury_ledger`, `/audit_logs`)  
> **Target Audience:** Mobile Developers, Full-Stack Engineers, System Architects

---

## 1. Executive Summary & Mobile Architecture

When an event is cancelled in the STI Sync Web Portal (by an Organization Officer or SAO Administrator), the mobile application must immediately and gracefully reflect:
1. **Event State & Cancellation Context**: The Event Detail screen must prominently show that the event is **Cancelled**, display the **official cancellation reason**, the **timestamp**, and the **refund policy**.
2. **Financial Liability & Refund Pipeline**: 
   - **Unpaid Payables & Fines** are instantly reflected as `waived` (no longer blocking student clearance or appearing as active balances).
   - **Paid Event Fees** transition to `refund_pending`, displaying a clear status badge and guidance on how/where the student can claim their refund (or if it will be credited to a future event). Once disbursed by officers/admin, it transitions to `refunded`.
3. **Scanner Pass & Ticket Deactivation**: The student's dynamic QR gate ticket is automatically revoked and sealed with a "Cancelled / Invalid" overlay.
4. **Offline Resilience & Cache Synchronization**: The mobile app must operate seamlessly in offline campus environments (e.g. basements, auditoriums, dead zones), leveraging local caching, conflict-free sync strategies, and optimistic offline state indicators.

---

## 2. Event Lifecycle State Machine on Mobile

The mobile application models 5 primary states for student-facing events:

```
┌─────────────────┐       Live Start       ┌─────────────────┐       Term Close       ┌─────────────────┐
│   1. UPCOMING   │ ─────────────────────> │   2. ONGOING    │ ─────────────────────> │  3. COMPLETED   │
│   (Approved)    │                        │  (Live QR Gate) │                        │ (Archived Feed) │
└────────┬────────┘                        └─────────────────┘                        └─────────────────┘
         │
         │ Event Cancelled (Admin / Officer)
         ▼
┌─────────────────────────────────────────────────────────────┐
│                       4. CANCELLED                          │
│  • Public Banner with Reason & Policy                       │
│  • QR Gate Pass revoked (Locked)                            │
│  • Unpaid payables → Waived (₱0.00 Balance)                 │
│  • Paid payables   → Refund Pending (Claim instructions)    │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 State Evaluation Logic (TypeScript / Dart / Kotlin)

```typescript
export type MobileEventDisplayStatus = 'upcoming' | 'ongoing' | 'completed' | 'cancelled';

export function getMobileEventStatus(event: {
  isCancelled?: boolean;
  status?: string;
  proposalStatus?: string;
  lifecycleStatus?: string;
  sessions?: Array<{ date: string; startTime: string; endTime: string }>;
}): MobileEventDisplayStatus {
  // 1. Cancellation Check (Highest Priority)
  if (
    event.isCancelled === true ||
    event.status === 'cancelled' ||
    event.proposalStatus === 'cancelled' ||
    event.lifecycleStatus === 'cancelled'
  ) {
    return 'cancelled';
  }

  // 2. Completed Marker
  if (event.status === 'completed' || event.proposalStatus === 'completed') {
    return 'completed';
  }

  // 3. Operational Timing (Sessions)
  const now = new Date();
  const sessions = event.sessions || [];
  if (sessions.length === 0) return 'upcoming';

  let hasOngoing = false;
  let allCompleted = true;

  for (const session of sessions) {
    if (!session.date) continue;
    const [year, month, day] = session.date.split('T')[0].split('-').map(Number);
    const [startH, startM] = (session.startTime || '00:00').split(':').map(Number);
    const [endH, endM] = (session.endTime || '23:59').split(':').map(Number);

    const start = new Date(year, month - 1, day, startH, startM);
    const end = new Date(year, month - 1, day, endH, endM, 59);

    if (now >= start && now <= end) {
      hasOngoing = true;
      allCompleted = false;
      break;
    }
    if (now < start) {
      allCompleted = false;
    }
  }

  if (hasOngoing) return 'ongoing';
  if (allCompleted) return 'completed';
  return 'upcoming';
}
```

---

## 3. Mobile Event Detail Screen: Cancelled Event View

When `getMobileEventStatus(event) === 'cancelled'`, the Event Detail view dynamically reorganizes to communicate the cancellation clearly without confusing the student:

```
┌─────────────────────────────────────────────────────────────┐
│ ◄ Back               EVENT DETAILS                          │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ✕ EVENT CANCELLED                                       │ │
│ │ This event has been officially cancelled.               │ │
│ │                                                         │ │
│ │ Reason: "Campus closed due to Typhoon Signal No. 2"      │ │
│ │ Date Cancelled: Sep 19, 2026 • 2:30 PM                  │ │
│ │ Policy: Full Cash Refund                                │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [ Event Banner with Grayscale / Dimmed Overlay ]            │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Tech Summit 2026: Cloud Frontiers                       │ │
│ │ Hosted by: Junior Philippine Computer Society (JPCS)    │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 💳 Your Payment & Fee Status                            │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ Status: REFUND PENDING                              │ │ │
│ │ │ Amount Paid: ₱150.00                                │ │ │
│ │ │ Method: Cash Disbursement at SAO / Org Booth        │ │ │
│ │ │ Note: Please present your Student ID to claim.      │ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🎟️ Gate Pass Ticket (REVOKED)                          │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ [ ✕ QR CODE VOIDED - EVENT CANCELLED ]             │ │ │
│ │ │ Pass revoked. Scanners will reject this entry pass. │ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 3.1 UI Component Specifications
1. **Cancellation Danger Alert (`#EF4444` / `#991B1B`)**:
   - Header with `AlertTriangle` / `XCircle` icon.
   - Text: `"Event Cancelled"`.
   - Cancellation reason block with light red background (`bg-red-50 text-red-900 border border-red-200`).
   - Human-readable timestamp formatted with local device timezone (`formatAppDateTime(event.cancelledAt)`).
2. **Refund Policy Indicator Pill**:
   - `refund_cash` ➔ 🟢 **Full Cash Refund**
   - `credit_next_event` ➔ 🔵 **Credited to Next Event**
   - `no_fees_collected` ➔ ⚪ **Free Event / No Fees Collected**
3. **Dynamic QR Ticket Replacement**:
   - If the student already opened/unlocked a ticket, the QR matrix is replaced with a dimmed placeholder stamped with `EVENT CANCELLED / TICKET VOID`.
   - Prevents student confusion at campus entry gates.

---

## 4. Student Payables & Refund Lifecycle on Mobile

In the Mobile Student Portal (**Profile ➔ My Payables & Accounts / Clearance**), payables linked to cancelled events must transition through clear statuses:

```
                  ┌──────────────────────────────────────────────┐
                  │               STUDENT PAYABLE                │
                  └──────────────────────┬───────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼ (If Unpaid)                                   ▼ (If Paid)
     ┌───────────────────────┐                       ┌───────────────────────┐
     │     STATUS: WAIVED    │                       │ STATUS: REFUND PENDING│
     ├───────────────────────┤                       ├───────────────────────┤
     │ • Balance: ₱0.00      │                       │ • Refund Due: ₱150.00 │
     │ • Strikethrough Fee   │                       │ • Reason: Event Cancel│
     │ • Green "Waived" badge│                       │ • Amber "Refund" badge│
     │ • Unblocks Clearance  │                       │ • Claim Instructions  │
     └───────────────────────┘                       └───────────┬───────────┘
                                                                 │
                                                                 │ Officer / Admin
                                                                 │ Disburses Refund
                                                                 ▼
                                                     ┌───────────────────────┐
                                                     │    STATUS: REFUNDED   │
                                                     ├───────────────────────┤
                                                     │ • Refunded: ₱150.00   │
                                                     │ • Blue "Refunded" tag │
                                                     │ • Receipt & Ref ID    │
                                                     └───────────────────────┘
```

### 4.1 Payable Status Presentation Matrix

| Firestore `status` | Mobile Display Label | Badge Color | Amount Display | Clearance Impact | Action Button / Helper |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `pending` | **Pending Payment** | 🟠 Amber | `₱150.00` | ⚠️ Blocks Clearance | `"View Details" / "Pay at Booth"` |
| `overdue` | **Overdue Balance** | 🔴 Red | `₱150.00` | ⛔ Blocks Clearance | `"Settlement Required"` |
| `paid` | **Settled & Cleared**| 🟢 Green | `₱150.00 (Paid)` | ✅ Cleared | `"View Digital Receipt"` |
| `waived` | **Auto-Waived (Cancelled)** | 🟢 Emerald | `~₱150.00~ ₱0.00` | ✅ Cleared (Zero Liability)| `"Event Cancelled - No payment required"` |
| `refund_pending` | **Refund Pending** | 🟡 Gold / Amber | `₱150.00 Due Back`| ✅ Cleared | `"Claim Refund at Student Affairs"` |
| `refunded` | **Refund Disbursed** | 🔵 Blue | `₱150.00 Refunded`| ✅ Cleared | `"View Refund Receipt"` |

### 4.2 Calculation of Student Total Outstanding Balance
```typescript
/**
 * Accurately computes a student's true financial balance.
 * Excludes 'waived', 'refund_pending', and 'refunded' items.
 */
export function calculateStudentTotalBalance(payables: Array<{ status: string; assignedAmount?: number; paidAmount?: number }>): number {
  return payables.reduce((total, p) => {
    // Waived, refunded, and refund_pending payables NEVER add to student debt
    if (p.status === 'waived' || p.status === 'refunded' || p.status === 'refund_pending' || p.status === 'paid') {
      return total;
    }
    const assigned = Number(p.assignedAmount || 0);
    const paid = Number(p.paidAmount || 0);
    const remaining = Math.max(0, assigned - paid);
    return total + remaining;
  }, 0);
}
```

---

## 5. Offline-First Architecture & Sync Lifecycle

Campus environments frequently suffer from spotty Wi-Fi or zero mobile data in underground event facilities. The mobile app must remain fully usable when offline.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          MOBILE LOCAL LAYER                            │
│  ┌───────────────────────────┐          ┌───────────────────────────┐  │
│  │   Firestore Cache /       │ ◄──────► │    Local SQLite / MMKV    │  │
│  │   Offline Persistence     │          │    Encrypted Storage      │  │
│  └─────────────┬─────────────┘          └─────────────┬─────────────┘  │
└────────────────┼──────────────────────────────────────┼────────────────┘
                 │                                      │
                 │ Auto-Sync on Reconnect               │
                 ▼                                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        CLOUD FIRESTORE BACKEND                         │
│  • `/events/{eventId}`          • `/payables/{payableId}`              │
│  • `/attendance_records`        • `/treasury_ledger`                   │
└────────────────────────────────────────────────────────────────────────┘
```

### 5.1 Local Caching Strategy
1. **Enable Firestore Offline Persistence**:
   ```typescript
   import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

   export const db = initializeFirestore(app, {
     localCache: persistentLocalCache({
       tabManager: persistentMultipleTabManager(),
     }),
   });
   ```
2. **Pre-caching Event Metadata for Offline Attendance**:
   - When an Officer opens an event in the Officer Portal while online, cache:
     - Event basic info (Title, Sessions, Scanner activation keys).
     - Student roster & payable lookup table (`studentId` ➔ `payableStatus`).
     - Ticket validity hashes.
3. **Offline Event State Read Rule**:
   - If an event was fetched and cached before going offline, read from cache with metadata `fromCache: true`.
   - Display a subtle top bar: `"Offline Mode — Using cached event schedule"`.

### 5.2 Offline Cancellation Handling (Edge Case Prevention)
- **Scenario**: An event is cancelled while an officer's scanner device is offline at the gate.
- **Resolution Strategy**:
  1. The officer's device scans student QR code `QR-EVENT123-STUDENT456`.
  2. The mobile app checks local cache. If the local cache has not received the cancellation event yet, the offline scan logs an attendance record locally with `syncStatus = 'pending_upload'`.
  3. **Reconnection Hook**: When the scanner reconnects:
     - Cloud Firestore transaction validates the event status before committing.
     - Because `event.status === 'cancelled'`, the server transaction gracefully rejects entry sync with error code `ERR_EVENT_CANCELLED`.
     - The mobile UI notifies the officer: `"14 offline scans were voided because Event was cancelled."`

### 5.3 Optimistic Offline Updates for Student Refund Status
When an officer marks a refund as claimed while offline at a refund booth:
1. **Optimistic UI Update**: Update local payable status to `refunded` immediately.
2. **Sync Queue**: Append operation to local persisted queue (`/offline_refund_queue`).
3. **Conflict Resolution**:
   - If cloud status is already `refunded` (refunded by another officer online), drop silently to avoid double refunding.
   - If cloud status is `refund_pending`, execute `processPayableRefund` transaction upon network recovery.

---

## 6. Mobile Data Contracts & Types

### 6.1 Event Schema (Mobile Compatible)
```typescript
export interface MobileEventDocument {
  id: string;
  title: string;
  referenceId: string;
  tagline?: string;
  description?: string;
  bannerImageUrl?: string;
  hostingOrgId?: string;       // 'sas' for institutional, org.id for club
  createdByName?: string;
  eventTypeId?: string;
  venueId?: string;
  customVenueName?: string;
  schoolYear: string;
  semester: string;
  
  // Lifecycle & Cancellation Fields
  status: 'draft' | 'pending' | 'approved' | 'completed' | 'cancelled';
  proposalStatus?: 'draft' | 'pending' | 'approved' | 'returned' | 'rejected' | 'completed' | 'cancelled';
  isCancelled?: boolean;
  cancelledAt?: string;          // ISO Timestamp
  cancelledBy?: string;          // UID of cancelling user
  cancelledByName?: string;      // Display name
  cancellationReason?: string;   // Required minimum 10 chars
  refundPolicy?: 'refund_cash' | 'credit_next_event' | 'no_fees_collected';
  
  // Payables & Ticketing
  studentPayablesEnabled?: boolean;
  suggestedFeePerStudent?: number;
  enableQRTickets?: boolean;
  sessions?: Array<{
    id: string;
    title: string;
    date: string;
    startTime: string;
    endTime: string;
  }>;
}
```

### 6.2 Student Payable Schema (Mobile Compatible)
```typescript
export interface MobileStudentPayable {
  id: string;
  payableId: string;
  eventId: string;
  eventTitle: string;
  studentId: string;           // 11-digit Student ID Number
  studentName: string;
  academicTrack: 'College' | 'SHS';
  courseOrStrand: string;
  yearLevel: string;
  section: string;

  // Financial Values
  assignedAmount: number;      // e.g. 150.00
  paidAmount: number;          // e.g. 150.00 or 0
  balance: number;             // e.g. 0.00

  // Status & Refund Flags
  status: 'pending' | 'paid' | 'overdue' | 'waived' | 'refund_pending' | 'refunded';
  
  // Cancellation / Waiver Context
  waivedAt?: string;
  waivedReason?: string;
  waivedBy?: string;
  
  // Refund Context
  refundDue?: number;          // e.g. 150.00
  refundReason?: string;       // "Event Cancelled: Typhoon Closure"
  refundMethod?: 'refund_cash' | 'credit_next_event' | 'no_fees_collected';
  refundedAt?: string;
  refundedBy?: string;
  refundReceiptNumber?: string;

  // Gate QR Pass Token
  qrTicketUnlocked: boolean;
  updatedAt?: any;
}
```

---

## 7. Mobile Implementation Verification Checklist

Use this checklist to verify mobile implementation parity with the web platform:

- [ ] **Event Detail View**:
  - [ ] Displays Red Cancelled Alert banner when `isCancelled === true` or `status === 'cancelled'`.
  - [ ] Renders cancellation reason and formatted cancellation date/time.
  - [ ] Shows refund policy pill badge.
  - [ ] Deactivates / overrides QR Gate Ticket with revoked notice.
- [ ] **Student Payables & Accounts Screen**:
  - [ ] Auto-waived payables display green `Waived` badge with `₱0.00` balance.
  - [ ] Paid payables for cancelled events display amber `Refund Pending` badge with refund amount due.
  - [ ] Disbursed refunds display blue `Refunded` badge with refund reference ID.
  - [ ] Total outstanding student balance excludes `waived`, `refund_pending`, and `refunded` payables.
- [ ] **Offline Resilience**:
  - [ ] Firestore persistent cache enabled on mobile initialization.
  - [ ] Events viewed online remain readable offline.
  - [ ] Offline indicator badge appears when device loses network connectivity.
  - [ ] Offline scanner transactions reject revoked QR tokens upon online reconciliation.

---

> **End of Specification**  
> *Document maintained by STI Sync Core Architecture Team.*
