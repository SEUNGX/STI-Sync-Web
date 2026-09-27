# STI Sync Mobile — Event Completed, Archiving & Deletion Sync Specification

> **Document Version:** 1.0.0  
> **Date:** September 2026  
> **Target Systems:** STI Sync Mobile App (Flutter / Dart / Android & iOS)  
> **Backend:** Cloud Firestore (`/events`, `/payables`, `/attendance_logs`, `/certificates`)  
> **Target Audience:** Mobile Developers, Backend Engineers, QA Engineers  

---

## 1. Executive Summary

When administrators or organization officers transition an event through its closing lifecycles on the STI Sync Web Portal:
1. **Marked as Completed (`status: 'completed'`)**
2. **Archived (`isArchived: true`)**
3. **Soft-Deleted (`isDeleted: true`)**

The mobile application must dynamically reflect these states to prevent invalid QR scans, maintain clear financial status for student clearance, and provide attendees access to post-event certificates and attendance records.

---

## 2. Event Lifecycle State Transitions & Mobile Behaviors

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   EVENT LIFECYCLE                                      │
├────────────────────┬────────────────────┬────────────────────┬────────────────────────┤
│     UPCOMING       │      ONGOING       │     COMPLETED      │        ARCHIVED        │
│ status: 'approved' │ status: 'ongoing'  │ status:'completed' │ isArchived: true       │
│                    │                    │ completedAt: date  │ archivedAt: date       │
├────────────────────┼────────────────────┼────────────────────┼────────────────────────┤
│ • Ticket Active    │ • Live Gate Pass   │ • Scanner Locked   │ • Hidden from Feed     │
│ • Registration Open│ • In-Session State │ • Ticket Expired   │ • Kept in History      │
│ • Unpaid Dues Due  │ • Live Scan Active │ • Claim Certs Open │ • Dues Remain on Ledger│
└────────────────────┴────────────────────┴────────────────────┴────────────────────────┘
                                                                           │
                                                                           ▼
                                                                ┌───────────────────────┐
                                                                │        DELETED        │
                                                                │ isDeleted: true       │
                                                                ├───────────────────────┤
                                                                │ • Completely Filtered │
                                                                │ • Purged from UI      │
                                                                └───────────────────────┘
```

---

## 3. Detailed Mobile Screen Behavior

### 3.1 Home / Events Discovery Feed
* **Upcoming / Ongoing Tab:**
  * Displays events where `status == 'approved' || status == 'ongoing'`.
  * **MUST EXCLUDE:** `isArchived == true`, `isDeleted == true`, and `status == 'completed'`.
* **Past / Completed Events Tab:**
  * Displays events where `status == 'completed' && !isArchived && !isDeleted`.
  * Allows students to review past event photos, descriptions, and attendance records.
* **Archived Events:**
  * By default, **archived events do not appear** in public event exploration feeds to keep the student app clean and focused on current academic activities.

### 3.2 Event Detail & QR Gate Ticket (`EventDetailScreen`)
* **When `status == 'completed'`:**
  1. **Status Badge:** Changes to `Concluded` (or `Completed`) with a soft green/slate badge (`#10B981` or `#64748B`).
  2. **QR Ticket Overlay:** If the student had an active QR ticket, display a prominent locked overlay:
     > *"This event has concluded. Gate check-in is closed."*
  3. **Certificate Claiming:** If the student has verified check-in attendance and certificates are enabled for this event, display the **"Claim / Download Certificate"** action button.
* **When `isArchived == true`:**
  * If accessed via direct link or past history, show an informational banner:
    > *"This event is sealed and archived for historical audit."*

### 3.3 Student Payables / Ledger (`PayablesScreen` / Clearance)
* **Crucial Financial Rule:** Archiving an event **does NOT erase** a student's unpaid dues.
* If a student owes registration fees or absence fines for an event that becomes **Archived**:
  * The payable item remains in the student's **Active Payables / Dues** list.
  * Tag the payable with an explanatory chip: `[Archived Event]`.
  * Display note: *"Event concluded. Outstanding balance must be settled at the Cashier / Officer for semester clearance."*
* If an event is **Cancelled** (not completed): Dues are automatically waived (`status: 'waived'`).
* If an event is **Soft-Deleted**:
  * Unpaid payables remain attached to the student's clearance profile. The payable document stores snapshot metadata (`eventTitle`, `schoolYear`, `semester`) so that even if the event document is archived or hidden, the student's receipt and balance details remain intact.

### 3.4 Attendance & Event History (`StudentAttendanceHistoryScreen`)
* Completed and Archived events for which the student successfully checked in **must always remain visible** in the student's personal **Attendance History**.
* Grouped by Academic Semester (e.g., `A.Y. 2025-2026 - 1st Semester`).

---

## 4. Flutter / Dart Data Model Implementation

### 4.1 Event Model Updates (`event_model.dart`)

```dart
enum EventLifecycleState {
  draft,
  pending,
  approved,
  ongoing,
  completed,
  cancelled,
  archived,
  deleted,
}

class EventModel {
  final String id;
  final String title;
  final String status;              // 'draft' | 'pending' | 'approved' | 'ongoing' | 'completed' | 'cancelled'
  final bool isArchived;
  final bool isDeleted;
  final DateTime? completedAt;
  final String? completedBy;
  final DateTime? archivedAt;
  final String? semesterId;
  final String? schoolYear;
  final String? semester;
  final bool attendanceLocked;

  EventModel({
    required this.id,
    required this.title,
    required this.status,
    this.isArchived = false,
    this.isDeleted = false,
    this.completedAt,
    this.completedBy,
    this.archivedAt,
    this.semesterId,
    this.schoolYear,
    this.semester,
    this.attendanceLocked = false,
  });

  factory EventModel.fromFirestore(Map<String, dynamic> data, String docId) {
    return EventModel(
      id: docId,
      title: data['title'] ?? 'Untitled Event',
      status: data['status'] ?? data['proposalStatus'] ?? 'approved',
      isArchived: data['isArchived'] == true,
      isDeleted: data['isDeleted'] == true,
      completedAt: data['completedAt'] != null
          ? (data['completedAt'] as dynamic).toDate()
          : null,
      completedBy: data['completedBy'],
      archivedAt: data['archivedAt'] != null
          ? (data['archivedAt'] as dynamic).toDate()
          : null,
      semesterId: data['semesterId'],
      schoolYear: data['schoolYear'],
      semester: data['semester'],
      attendanceLocked: data['attendanceLocked'] == true || data['status'] == 'completed',
    );
  }

  /// Helper to determine the visual badge state on mobile UI
  EventLifecycleState get lifecycleState {
    if (isDeleted) return EventLifecycleState.deleted;
    if (isArchived) return EventLifecycleState.archived;
    if (status == 'cancelled') return EventLifecycleState.cancelled;
    if (status == 'completed') return EventLifecycleState.completed;
    if (status == 'ongoing') return EventLifecycleState.ongoing;
    if (status == 'approved') return EventLifecycleState.approved;
    return EventLifecycleState.draft;
  }

  /// Whether the student QR ticket is active for gate scanning
  bool get isGatePassValid {
    if (isDeleted || isArchived || status == 'completed' || status == 'cancelled') {
      return false;
    }
    return true;
  }
}
```

---

## 5. Firestore Queries & Filtering on Mobile

### 5.1 Active Event Stream for Student Feed
To prevent archived or deleted events from flooding the active student feed:

```dart
Stream<List<EventModel>> getActiveEventsStream({String? currentSemesterId}) {
  Query query = FirebaseFirestore.instance
      .collection('events')
      .where('proposalStatus', isEqualTo: 'approved')
      .where('isArchived', isEqualTo: false);

  if (currentSemesterId != null && currentSemesterId.isNotEmpty) {
    query = query.where('semesterId', isEqualTo: currentSemesterId);
  }

  return query.snapshots().map((snapshot) {
    return snapshot.docs
        .map((doc) => EventModel.fromFirestore(doc.data() as Map<String, dynamic>, doc.id))
        .filter((event) => !event.isDeleted)
        .toList();
  });
}
```

### 5.2 Officer Event Management on Mobile
If organization officers use the mobile app to scan attendance:
1. **Prevent Scanning on Completed Events:**
   ```dart
   if (event.status == 'completed' || event.attendanceLocked) {
     showDialog(
       context: context,
       builder: (_) => AlertDialog(
         title: Text('Scanner Locked'),
         content: Text('This event has been marked as Completed. Scans are no longer accepted.'),
         actions: [TextButton(onPressed: () => Navigator.pop(context), child: Text('OK'))],
       ),
     );
     return;
   }
   ```

---

## 6. QA & Verification Checklist for Mobile Developers

- [ ] **Completed Event Badge:** Event displays `Completed` tag in both Event List and Detail Screen.
- [ ] **Gate Pass Invalidation:** Student QR ticket displays `Event Concluded` banner when `status == 'completed'`.
- [ ] **Scanner Lockout:** Officer barcode scanner prevents scanning with error message if event is completed.
- [ ] **Archived Filter:** Event disappears from the active home banner once `isArchived == true`.
- [ ] **Payable Preservation:** Student who owes fee still sees the payable in their dues ledger even after the event is archived.
- [ ] **Attendance History:** Student who attended the archived event can still view their attendance record in their student profile.
- [ ] **Deleted Filter:** Soft-deleted events (`isDeleted == true`) never crash the app or show up in lists.
