import type { EventDocument } from '../types/event.types';

export type EventLockLevel = 'unlocked' | 'restricted' | 'locked';

export interface EventEditabilityCheck {
  editable: boolean;
  lockLevel: EventLockLevel;
  reason?: string;
  allowedFieldTypes?: 'all' | 'minor_only' | 'none';
}

export interface EventCancellationCheck {
  canCancel: boolean;
  reason?: string;
}

export interface ProposalWithdrawalCheck {
  canWithdraw: boolean;
  reason?: string;
}

/**
 * List of major event fields that cannot be changed directly once an event is approved.
 * Modifying these after approval alters student commitments, fees, venues, or financial approvals.
 */
export const MAJOR_EVENT_FIELDS: ReadonlyArray<string> = [
  'sessions',
  'venueId',
  'venue',
  'customVenueName',
  'eventFormat',
  'studentPayablesEnabled',
  'suggestedFeePerStudent',
  'adminFeeOverride',
  'latePenaltyAmount',
  'fines',
  'minAttendancePercent',
  'mandatoryAttendance',
  'isMandatory',
  'requiresAttendance',
  'budgetItems',
  'totalApprovedBudget',
  'totalRequestedBudget',
  'sourceOfFunds',
  'targetCourses',
  'targetYearLevels',
  'targetSections',
  'targetDepartmentIds',
  'allowedCourses',
  'allowedYearLevels',
  'targetAudienceScope',
  'targetAudience',
  'targetAcademicLevel',
  'hostingOrgId',
  'semesterId',
  'schoolYear',
  'eventTypeId',
  'eventCategoryId',
  'enableQRTickets',
  'enableQR',
  'gracePeriodMinutes',
  'lateThresholdMinutes',
];

/**
 * Checks if an event is currently marked as soft-deleted.
 */
export function isEventSoftDeleted(event?: Partial<EventDocument> | null): boolean {
  return Boolean(event?.isDeleted || event?.proposalStatus === 'cancelled');
}

/**
 * Checks if an event has been archived (e.g., during end-of-semester or end-of-academic-year rollover).
 */
export function isEventArchived(event?: Partial<EventDocument> | null): boolean {
  return Boolean(event?.isArchived);
}

/**
 * Determines the editability and lock level of an event based on its lifecycle status and the user's role.
 *
 * Lifecycle Rules:
 * - Soft-deleted / Cancelled: Strictly LOCKED.
 * - Archived: Strictly LOCKED (Read-Only).
 * - Ongoing (Live): Strictly LOCKED (live scanner and gate access active).
 * - Completed: Strictly LOCKED (records finalized for liquidation & certificates).
 * - Draft: Fully UNLOCKED (all fields editable).
 * - Pending Review:
 *     - For Officers: LOCKED ("Proposal under SAO review. Withdraw proposal to edit.").
 *     - For Admins: RESTRICTED (Advisers can make review notes / fee overrides).
 * - Approved:
 *     - RESTRICTED (Minor fields like description, banner, and objectives are editable; major fields like schedule, venue, fees, and budget are locked).
 */
export function isEventEditable(
  event?: Partial<EventDocument> | null,
  userRole: 'admin' | 'officer' | string = 'officer'
): EventEditabilityCheck {
  if (!event) {
    return {
      editable: false,
      lockLevel: 'locked',
      reason: 'No event specified.',
      allowedFieldTypes: 'none',
    };
  }

  // 1. Check Archival Status
  if (event.isArchived) {
    return {
      editable: false,
      lockLevel: 'locked',
      reason: 'This event is archived and permanently sealed for historical audit.',
      allowedFieldTypes: 'none',
    };
  }

  // 2. Check Soft-Deletion / Cancellation Status
  if (event.isDeleted || event.proposalStatus === 'cancelled' || event.status === 'cancelled') {
    return {
      editable: false,
      lockLevel: 'locked',
      reason: event.cancellationReason
        ? `This event was cancelled: "${event.cancellationReason}"`
        : 'This event has been cancelled or soft-deleted.',
      allowedFieldTypes: 'none',
    };
  }

  // 3. Drafts are always fully editable
  const isDraft = event.proposalStatus === 'draft' || event.status === 'draft' || !event.proposalStatus;
  if (isDraft) {
    return {
      editable: true,
      lockLevel: 'unlocked',
      allowedFieldTypes: 'all',
    };
  }

  // 4. Completed Event Barrier: Completed events cannot be edited
  const timing = getEventTimingStatus(event);
  if (
    timing === 'completed' ||
    event.status === 'completed' ||
    event.proposalStatus === 'completed' ||
    event.lifecycleStatus === 'completed'
  ) {
    return {
      editable: false,
      lockLevel: 'locked',
      reason: 'This event is completed. Attendance liabilities, certificate records, and financial liquidations are finalized and cannot be modified.',
      allowedFieldTypes: 'none',
    };
  }

  // 5. Ongoing Event Barrier: Live ongoing events cannot be edited
  if (
    timing === 'ongoing' ||
    event.status === 'ongoing' ||
    event.lifecycleStatus === 'ongoing'
  ) {
    return {
      editable: false,
      lockLevel: 'locked',
      reason: 'This event is currently live and in session. Live scanner passes and attendance tracking are active and cannot be modified.',
      allowedFieldTypes: 'none',
    };
  }

  // 6. Check Lifecycle Proposal Status
  const status = event.proposalStatus || 'draft';

  switch (status) {
    case 'draft':
      return {
        editable: true,
        lockLevel: 'unlocked',
        allowedFieldTypes: 'all',
      };

    case 'returned':
      return {
        editable: true,
        lockLevel: 'unlocked',
        reason: event.adviserRemarks
          ? `Returned for revision: ${event.adviserRemarks}`
          : 'Returned for revision by SAO.',
        allowedFieldTypes: 'all',
      };

    case 'rejected':
      return {
        editable: false,
        lockLevel: 'locked',
        reason: event.rejectionReason
          ? `Proposal was rejected: ${event.rejectionReason}`
          : 'Proposal was rejected by SAO administration.',
        allowedFieldTypes: 'none',
      };

    case 'pending':
    case 'pending_review':
      if (userRole === 'admin') {
        return {
          editable: true,
          lockLevel: 'restricted',
          reason: 'Reviewing proposal. Administrative overrides allowed.',
          allowedFieldTypes: 'all',
        };
      }
      return {
        editable: false,
        lockLevel: 'locked',
        reason: 'Proposal is currently under SAO review. Click "Withdraw Proposal" to unlock editing.',
        allowedFieldTypes: 'none',
      };

    case 'approved':
      return {
        editable: true,
        lockLevel: 'restricted',
        reason: 'Event is approved. Core schedule, venue, fines, and budget are locked. Minor descriptive changes are permitted.',
        allowedFieldTypes: 'minor_only',
      };

    default:
      return {
        editable: false,
        lockLevel: 'locked',
        reason: `Event in "${status}" state cannot be modified.`,
        allowedFieldTypes: 'none',
      };
  }
}

/**
 * Checks whether a specific field within an event is locked against modifications.
 */
export function isMajorFieldLocked(
  fieldOrEvent: string | Partial<EventDocument> | null | undefined,
  eventOrField?: Partial<EventDocument> | string | null,
  userRole: 'admin' | 'officer' | string = 'officer'
): boolean {
  let fieldName: string | undefined;
  let event: Partial<EventDocument> | null | undefined;

  if (typeof fieldOrEvent === 'string') {
    fieldName = fieldOrEvent;
    event = eventOrField as Partial<EventDocument> | null | undefined;
  } else {
    event = fieldOrEvent;
    fieldName = eventOrField as string | undefined;
  }

  if (!event || !fieldName) return false;

  const { lockLevel } = isEventEditable(event, userRole);
  if (lockLevel === 'locked') return true;
  if (lockLevel === 'unlocked') return false;

  // If restricted (e.g. Approved status), all major fields are locked
  if (lockLevel === 'restricted') {
    return MAJOR_EVENT_FIELDS.includes(fieldName);
  }

  return false;
}

export type EventTimingStatus = 'upcoming' | 'ongoing' | 'completed';

/**
 * Calculates the real-time operational schedule status of an event
 * based on its session dates, start/end times, and lifecycle markers.
 */
export function getEventTimingStatus(event?: Partial<EventDocument> | null): EventTimingStatus {
  if (!event) return 'upcoming';
  if (event.status === 'completed' || event.proposalStatus === 'completed') {
    return 'completed';
  }
  if (event.status === 'ongoing') {
    return 'ongoing';
  }

  const sessions = event.sessions || [];
  if (sessions.length === 0) {
    return 'upcoming';
  }

  const now = new Date();

  const parseSessionDates = (s: any) => {
    if (!s.date) return { start: null, end: null };
    const dateStr = typeof s.date === 'string' ? s.date.split('T')[0] : '';
    if (!dateStr) return { start: null, end: null };
    const [year, month, day] = dateStr.split('-').map(Number);
    const startParts = (s.startTime || '00:00').split(':').map(Number);
    const endParts = (s.endTime || '23:59').split(':').map(Number);

    const start = new Date(year, month - 1, day, startParts[0] || 0, startParts[1] || 0);
    const end = new Date(year, month - 1, day, endParts[0] || 23, endParts[1] || 59, 59);
    return { start, end };
  };

  let allCompleted = true;
  let hasOngoing = false;

  for (const session of sessions) {
    const { start, end } = parseSessionDates(session);
    if (!start || !end) continue;

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

/**
 * Checks whether all scheduled sessions of an event have officially ended.
 */
export function areEventSessionsOver(
  event?: Partial<EventDocument> | null
): { allOver: boolean; reason?: string; unfinishedSession?: any } {
  if (!event) {
    return { allOver: false, reason: 'Event not found.' };
  }

  const sessions = event.sessions || [];
  if (sessions.length === 0) {
    // If no explicit sessions array, check startDate / endDate fallback if present
    if (event.endDate || event.startDate) {
      const dateStr = typeof (event.endDate || event.startDate) === 'string'
        ? (event.endDate || event.startDate)!.split('T')[0]
        : '';
      if (dateStr) {
        const [year, month, day] = dateStr.split('-').map(Number);
        const endParts = (event.endTime || '23:59').split(':').map(Number);
        const end = new Date(year, month - 1, day, endParts[0] || 23, endParts[1] || 59, 59);
        if (new Date() < end) {
          return {
            allOver: false,
            reason: `Event date has not finished yet (scheduled until ${dateStr} ${event.endTime || '23:59'}).`,
          };
        }
      }
    }
    return { allOver: true };
  }

  const now = new Date();
  for (const s of sessions) {
    if (!s.date) continue;
    let dateStr = '';
    if (typeof s.date === 'string') {
      dateStr = s.date.split('T')[0];
    } else if (s.date && typeof s.date.toDate === 'function') {
      dateStr = s.date.toDate().toISOString().split('T')[0];
    } else if (s.date instanceof Date) {
      dateStr = s.date.toISOString().split('T')[0];
    } else if (s.date && typeof s.date.seconds === 'number') {
      dateStr = new Date(s.date.seconds * 1000).toISOString().split('T')[0];
    }

    if (!dateStr) continue;

    const [year, month, day] = dateStr.split('-').map(Number);
    const endParts = (s.endTime || '23:59').split(':').map(Number);
    const end = new Date(year, month - 1, day, endParts[0] || 23, endParts[1] || 59, 59);

    if (now < end) {
      return {
        allOver: false,
        unfinishedSession: s,
        reason: `Session "${s.title || 'Scheduled Session'}" is not over yet (scheduled until ${dateStr} ${s.endTime || '23:59'}). All sessions must conclude before the event can be completed.`,
      };
    }
  }

  return { allOver: true };
}

/**
 * Checks whether an event can be concluded.
 */
export function canConcludeEvent(
  event?: Partial<EventDocument> | null
): { canConclude: boolean; reason?: string; unfinishedSession?: any } {
  if (!event) {
    return { canConclude: false, reason: 'Event not found.' };
  }

  if (event.isArchived) {
    return { canConclude: false, reason: 'Archived events cannot be concluded.' };
  }

  const status = (event.status || event.proposalStatus || '').toLowerCase();
  if (status === 'completed' || (event as any).isConcluded) {
    return { canConclude: false, reason: 'Event is already completed.' };
  }

  if (status === 'cancelled' || event.isCancelled) {
    return { canConclude: false, reason: 'Cancelled events cannot be concluded.' };
  }

  if (status === 'rejected') {
    return { canConclude: false, reason: 'Rejected proposals cannot be concluded.' };
  }

  const sessionsOver = areEventSessionsOver(event);
  if (!sessionsOver.allOver) {
    return {
      canConclude: false,
      reason: sessionsOver.reason || 'Event sessions are not over yet.',
      unfinishedSession: sessionsOver.unfinishedSession,
    };
  }

  return { canConclude: true };
}

/**
 * Checks whether a user can initiate cancellation of an event.
 * Rules:
 * 1. Cancel button only shows if the event is NOT approved yet (applies to both Admin and Officer web).
 * 2. Approved, Completed, Cancelled, and Rejected events cannot be cancelled.
 * 3. Only unapproved proposals / drafts (draft, pending_review, pending, returned) can be cancelled.
 */
export function canCancelEvent(
  event?: Partial<EventDocument> | null,
  userRole: 'admin' | 'officer' | string = 'officer',
  userOrgId?: string
): EventCancellationCheck {
  if (!event) {
    return { canCancel: false, reason: 'Event not found.' };
  }

  if (event.isArchived) {
    return { canCancel: false, reason: 'Archived events cannot be cancelled.' };
  }

  if (event.isDeleted || event.proposalStatus === 'cancelled' || event.status === 'cancelled') {
    return { canCancel: false, reason: 'Event is already cancelled.' };
  }

  if (event.proposalStatus === 'rejected') {
    return { canCancel: false, reason: 'Rejected events cannot be cancelled.' };
  }

  // Check if event is approved (Approved events CANNOT be cancelled for both Admin & Officer)
  const pStatus = (event.proposalStatus || '').toLowerCase();
  const eStatus = (event.status || '').toLowerCase();
  const lStatus = ((event as any).lifecycleStatus || '').toLowerCase();

  const isApproved =
    pStatus === 'approved' ||
    pStatus === 'completed' ||
    eStatus === 'approved' ||
    eStatus === 'completed' ||
    eStatus === 'ongoing' ||
    lStatus === 'approved' ||
    lStatus === 'completed' ||
    lStatus === 'published' ||
    Boolean((event as any).isApproved) ||
    Boolean((event as any).isDirectPublished);

  if (isApproved) {
    return {
      canCancel: false,
      reason: 'Approved events cannot be cancelled. Cancellation is only permitted for unapproved proposals.',
    };
  }

  // Officer Role Ownership Check:
  if (userRole === 'officer') {
    if (event.hostingOrgId === 'sas') {
      return {
        canCancel: false,
        reason: 'Institutional SAO events can only be cancelled by SAO administration.',
      };
    }

    if (userOrgId && event.hostingOrgId && event.hostingOrgId !== userOrgId) {
      return {
        canCancel: false,
        reason: "Officers can only cancel their own organization's event proposals.",
      };
    }

    return { canCancel: true };
  }

  // Admin Role Authority Check:
  if (userRole === 'admin') {
    return { canCancel: true };
  }

  return { canCancel: false, reason: 'This event cannot be cancelled in its current state.' };
}

/**
 * Checks whether an officer can withdraw a submitted proposal back to 'draft' state.
 */
export function canWithdrawProposal(
  event?: Partial<EventDocument> | null,
  userRole: 'admin' | 'officer' | string = 'officer',
  userId?: string
): ProposalWithdrawalCheck {
  if (!event) {
    return { canWithdraw: false, reason: 'Event not found.' };
  }

  const status = (event.proposalStatus || (event as any).status || '').toLowerCase();
  if (status !== 'pending_review' && status !== 'pending') {
    return {
      canWithdraw: false,
      reason: 'Only proposals currently in pending review can be withdrawn.',
    };
  }

  if (event.hostingOrgId === 'sas') {
    return {
      canWithdraw: false,
      reason: 'Institutional SAO events cannot be withdrawn.',
    };
  }

  return { canWithdraw: true };
}

/**
 * Checks whether an administrator can restore a soft-deleted / cancelled event.
 */
export function canRestoreEvent(
  event?: Partial<EventDocument> | null,
  userRole: 'admin' | 'officer' | string = 'admin'
): boolean {
  if (!event || userRole !== 'admin') return false;
  if (event.isArchived) return false;
  return Boolean(event.isDeleted || event.proposalStatus === 'cancelled');
}
