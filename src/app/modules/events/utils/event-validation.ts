import type { EventDocument, EventFormData, EventSession } from '../types/event.types';

export function timeToMinutes(timeStr?: string): number {
  if (!timeStr) return 0;
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;
  return h * 60 + m;
}

export function addMinutesToTime(timeStr: string, minutesToAdd: number): string {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  let m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return timeStr;

  let totalMins = h * 60 + m + minutesToAdd;
  if (totalMins < 0) totalMins = (totalMins % 1440) + 1440;
  totalMins = totalMins % 1440;

  const newH = Math.floor(totalMins / 60);
  const newM = totalMins % 60;
  return `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`;
}

export function formatTime12Hour(timeStr?: string): string {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  if (isNaN(h)) return timeStr;
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

export interface InternalConflict {
  sessionAIndex: number;
  sessionBIndex: number;
  sessionATitle: string;
  sessionBTitle: string;
  date: string;
  timeRangeA: string;
  timeRangeB: string;
  message: string;
}

export interface VenueConflict {
  sessionIndex: number;
  sessionTitle: string;
  date: string;
  timeRange: string;
  conflictingEventTitle: string;
  conflictingEventId: string;
  conflictingTimeRange: string;
  message: string;
}

/**
 * Check if any two sessions within the same event overlap in time on the same date.
 */
export function checkInternalSessionConflicts(sessions: EventSession[]): {
  hasConflict: boolean;
  conflicts: InternalConflict[];
} {
  const conflicts: InternalConflict[] = [];
  if (!sessions || sessions.length < 2) {
    return { hasConflict: false, conflicts: [] };
  }

  for (let i = 0; i < sessions.length; i++) {
    for (let j = i + 1; j < sessions.length; j++) {
      const s1 = sessions[i];
      const s2 = sessions[j];

      if (s1.date && s2.date && s1.date === s2.date) {
        const start1 = timeToMinutes(s1.startTime);
        const end1 = timeToMinutes(s1.endTime);
        const start2 = timeToMinutes(s2.startTime);
        const end2 = timeToMinutes(s2.endTime);

        if (start1 < end2 && end1 > start2) {
          conflicts.push({
            sessionAIndex: i,
            sessionBIndex: j,
            sessionATitle: s1.title || `Session ${i + 1}`,
            sessionBTitle: s2.title || `Session ${j + 1}`,
            date: s1.date,
            timeRangeA: `${s1.startTime || '??'} – ${s1.endTime || '??'}`,
            timeRangeB: `${s2.startTime || '??'} – ${s2.endTime || '??'}`,
            message: `Time overlap on ${s1.date}: "${s1.title || `Session ${i + 1}`}" (${s1.startTime}–${s1.endTime}) conflicts with "${s2.title || `Session ${j + 1}`}" (${s2.startTime}–${s2.endTime}).`,
          });
        }
      }
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
  };
}

/**
 * Check if any session conflicts with other published / approved events at the same venue.
 */
export function checkExternalVenueConflicts(
  sessions: EventSession[],
  venueId: string | undefined,
  allEvents: EventDocument[],
  currentEventId?: string
): {
  hasConflict: boolean;
  conflicts: VenueConflict[];
} {
  const conflicts: VenueConflict[] = [];
  if (!venueId || venueId === '__other__' || !sessions || sessions.length === 0) {
    return { hasConflict: false, conflicts: [] };
  }

  // Filter other active/approved/published events at the same venue
  const otherEvents = allEvents.filter((event) => {
    if (event.id === currentEventId) return false;
    if (event.proposalStatus === 'rejected' || event.proposalStatus === 'draft' || event.proposalStatus === 'cancelled') {
      return false;
    }
    return event.venueId === venueId;
  });

  for (let sIdx = 0; sIdx < sessions.length; sIdx++) {
    const session = sessions[sIdx];
    if (!session.date || !session.startTime || !session.endTime) continue;

    const startMinutes = timeToMinutes(session.startTime);
    const endMinutes = timeToMinutes(session.endTime);

    for (const otherEvent of otherEvents) {
      const otherSessions = otherEvent.sessions || [];
      for (const otherSession of otherSessions) {
        if (otherSession.date && otherSession.date === session.date) {
          const otherStart = timeToMinutes(otherSession.startTime);
          const otherEnd = timeToMinutes(otherSession.endTime);

          if (startMinutes < otherEnd && endMinutes > otherStart) {
            conflicts.push({
              sessionIndex: sIdx,
              sessionTitle: session.title || `Session ${sIdx + 1}`,
              date: session.date,
              timeRange: `${session.startTime} – ${session.endTime}`,
              conflictingEventTitle: otherEvent.title,
              conflictingEventId: otherEvent.id,
              conflictingTimeRange: `${otherSession.startTime} – ${otherSession.endTime}`,
              message: `Venue Conflict: "${otherEvent.title}" is already scheduled at this venue on ${session.date} (${otherSession.startTime}–${otherSession.endTime}).`,
            });
          }
        }
      }
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
  };
}

export interface StepValidationResult {
  isValid: boolean;
  errors: string[];
  fieldErrors?: Record<string, string>;
  internalConflicts?: InternalConflict[];
  venueConflicts?: VenueConflict[];
}

export function extractDateString(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val.split('T')[0];
  if (typeof val.toDate === 'function') {
    return val.toDate().toISOString().split('T')[0];
  }
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  if (typeof val.seconds === 'number') {
    return new Date(val.seconds * 1000).toISOString().split('T')[0];
  }
  return '';
}

export function formatVisibilityString(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val.replace('T', ' ');
  if (typeof val.toDate === 'function') {
    return val.toDate().toISOString().replace('T', ' ').slice(0, 16);
  }
  if (val instanceof Date) {
    return val.toISOString().replace('T', ' ').slice(0, 16);
  }
  if (typeof val.seconds === 'number') {
    return new Date(val.seconds * 1000).toISOString().replace('T', ' ').slice(0, 16);
  }
  return String(val);
}

export function validateStep1(data: EventFormData, isOfficer = false): StepValidationResult {
  const errors: string[] = [];
  const fieldErrors: Record<string, string> = {};

  const title = (data.title || '').trim();
  if (!title) {
    errors.push('Event Title is required.');
    fieldErrors.title = 'Event Title is required.';
  } else if (title.length < 3) {
    errors.push('Event Title must be at least 3 characters long.');
    fieldErrors.title = 'Event Title must be at least 3 characters long.';
  }

  const hasType =
    Boolean(data.eventTypeId && data.eventTypeId !== '__other__') ||
    Boolean(data.customEventTypeName?.trim());
  if (!hasType) {
    errors.push('Please select or specify an Event Type.');
    fieldErrors.eventTypeId = 'Event Type is required.';
  }

  if (!data.bannerImageUrl || !data.bannerImageUrl.trim()) {
    errors.push('Event Banner Image is required. Please upload an image.');
    fieldErrors.bannerImageUrl = 'Banner image is required.';
  }

  if (isOfficer && !data.hostingOrgId) {
    errors.push('Hosting organization must be assigned.');
    fieldErrors.hostingOrgId = 'Organization is required.';
  }

  // Visibility date check against sessions
  if (data.visibilityStart && data.sessions && data.sessions.length > 0) {
    const visDate = extractDateString(data.visibilityStart);
    if (visDate) {
      const conflictingSession = data.sessions.find(s => s.date && s.date < visDate);
      if (conflictingSession) {
        errors.push(`Visibility Conflict: Event visibility date (${visDate}) is scheduled after Session "${conflictingSession.title || 'Session'}" (${conflictingSession.date}). Students will not see the event before it takes place.`);
        fieldErrors.visibilityStart = 'Visibility date cannot be after session date.';
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    fieldErrors,
  };
}

export function validateStep2(
  data: EventFormData,
  allEvents: EventDocument[] = [],
  currentEventId?: string
): StepValidationResult {
  const errors: string[] = [];
  const fieldErrors: Record<string, string> = {};

  const hasVenue =
    Boolean(data.venueId && data.venueId !== '__other__') ||
    Boolean(data.customVenueName?.trim());
  if (!hasVenue) {
    errors.push('Venue is required. Please select or add a venue.');
    fieldErrors.venueId = 'Venue is required.';
  }

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const sessions = data.sessions || [];
  if (sessions.length === 0) {
    errors.push('At least one event session is required.');
    fieldErrors.sessions = 'At least one session is required.';
  } else {
    sessions.forEach((s, idx) => {
      const sNum = idx + 1;
      if (!s.title?.trim()) {
        errors.push(`Session ${sNum}: Title is required.`);
        fieldErrors[`session_${idx}_title`] = 'Title is required.';
      }
      if (!s.date) {
        errors.push(`Session ${sNum}: Date is required.`);
        fieldErrors[`session_${idx}_date`] = 'Date is required.';
      }
      if (!s.startTime) {
        errors.push(`Session ${sNum}: Start Time is required.`);
        fieldErrors[`session_${idx}_startTime`] = 'Start time is required.';
      }
      if (!s.endTime) {
        errors.push(`Session ${sNum}: End Time is required.`);
        fieldErrors[`session_${idx}_endTime`] = 'End time is required.';
      }
      if (s.startTime && s.endTime) {
        const startMin = timeToMinutes(s.startTime);
        const endMin = timeToMinutes(s.endTime);
        if (startMin >= endMin) {
          errors.push(`Session ${sNum}: Start time must be before end time.`);
          fieldErrors[`session_${idx}_time`] = 'Start time must be before end time.';
        }

        // Past time check if session date is today
        if (s.date === todayStr) {
          if (startMin < currentMinutes) {
            errors.push(`Session ${sNum}: Start time cannot be in the past for today's date.`);
            fieldErrors[`session_${idx}_startTime`] = 'Start time cannot be in the past.';
          }
          if (endMin <= currentMinutes) {
            errors.push(`Session ${sNum}: End time cannot be in the past for today's date.`);
            fieldErrors[`session_${idx}_endTime`] = 'End time cannot be in the past.';
          }
        }
      }
    });
  }

  // Visibility date check against sessions in Step 2
  if (data.visibilityStart && sessions.length > 0) {
    const visDate = extractDateString(data.visibilityStart);
    if (visDate) {
      const conflictingSession = sessions.find(s => s.date && s.date < visDate);
      if (conflictingSession) {
        errors.push(`Visibility Conflict: Event visibility date (${visDate}) is scheduled after Session "${conflictingSession.title || 'Session'}" (${conflictingSession.date}). Students will not see the event before it takes place.`);
        fieldErrors.visibilityStart = 'Visibility date cannot be after session date.';
      }
    }
  }

  // Attendance scanning thresholds & scanning windows check
  const isQREnabled = Boolean(data.enableQRTickets === true || (data as any).enableQR === true);
  const grace = data.gracePeriodMinutes ?? 15;
  const late = data.lateThresholdMinutes ?? 60;

  if (isQREnabled) {
    if (grace >= late && late > 0) {
      errors.push(`Grace Period (${grace} mins) must be less than Late Threshold (${late} mins).`);
      fieldErrors.gracePeriod = 'Grace period must be less than late threshold.';
    }

    sessions.forEach((s, idx) => {
      const sNum = idx + 1;
      const startMin = timeToMinutes(s.startTime);

      if (!s.timeInOpen) {
        errors.push(`Session ${sNum}: Time-In Opens time is required.`);
        fieldErrors[`session_${idx}_timeInOpen`] = 'Time-In Opens is required.';
      }
      if (!s.timeInClose) {
        errors.push(`Session ${sNum}: Time-In Closes time is required.`);
        fieldErrors[`session_${idx}_timeInClose`] = 'Time-In Closes is required.';
      }

      if (s.timeInOpen && s.startTime) {
        const inOpenMin = timeToMinutes(s.timeInOpen);
        if (inOpenMin > startMin) {
          errors.push(`Session ${sNum}: Time-In Opens (${s.timeInOpen}) cannot be after Session Start (${s.startTime}). Early arrivals must be able to scan.`);
          fieldErrors[`session_${idx}_timeInOpen`] = 'Time-In Opens must be on or before session start.';
        }
      }

      if (s.timeInOpen && s.timeInClose) {
        const inOpenMin = timeToMinutes(s.timeInOpen);
        const inCloseMin = timeToMinutes(s.timeInClose);
        if (inOpenMin >= inCloseMin) {
          errors.push(`Session ${sNum}: Time-In Opens (${s.timeInOpen}) must be earlier than Time-In Closes (${s.timeInClose}).`);
          fieldErrors[`session_${idx}_timeInClose`] = 'Time-In Closes must be after Time-In Opens.';
        }
      }

      if (s.startTime && s.timeInClose) {
        const inCloseMin = timeToMinutes(s.timeInClose);
        const graceCutoffMin = startMin + grace;
        if (inCloseMin < graceCutoffMin) {
          const graceCutoffStr = addMinutesToTime(s.startTime, grace);
          errors.push(`Session ${sNum}: Time-In Closes (${s.timeInClose}) cannot be earlier than the Grace Period cutoff (${graceCutoffStr}).`);
          fieldErrors[`session_${idx}_timeInClose`] = `Time-In Closes must be at or after Grace Period cutoff (${graceCutoffStr}).`;
        }
      }

      if (s.hasTimeOut) {
        if (!s.timeOutOpen) {
          errors.push(`Session ${sNum}: Time-Out Opens time is required.`);
          fieldErrors[`session_${idx}_timeOutOpen`] = 'Time-Out Opens is required.';
        }
        if (!s.timeOutClose) {
          errors.push(`Session ${sNum}: Time-Out Closes time is required.`);
          fieldErrors[`session_${idx}_timeOutClose`] = 'Time-Out Closes is required.';
        }

        if (s.timeInClose && s.timeOutOpen) {
          const inCloseMin = timeToMinutes(s.timeInClose);
          const outOpenMin = timeToMinutes(s.timeOutOpen);
          if (outOpenMin < inCloseMin) {
            errors.push(`Session ${sNum}: Time-Out Opens (${s.timeOutOpen}) cannot be earlier than Time-In Closes (${s.timeInClose}).`);
            fieldErrors[`session_${idx}_timeOutOpen`] = 'Time-Out Opens must be at or after Time-In Closes.';
          }
        }

        if (s.timeOutOpen && s.timeOutClose) {
          const outOpenMin = timeToMinutes(s.timeOutOpen);
          const outCloseMin = timeToMinutes(s.timeOutClose);
          if (outOpenMin >= outCloseMin) {
            errors.push(`Session ${sNum}: Time-Out Opens (${s.timeOutOpen}) must be earlier than Time-Out Closes (${s.timeOutClose}).`);
            fieldErrors[`session_${idx}_timeOutClose`] = 'Time-Out Closes must be after Time-Out Opens.';
          }
        }
      }
    });
  }

  // Internal Overlap Conflicts
  const internalConflictResult = checkInternalSessionConflicts(sessions);
  if (internalConflictResult.hasConflict) {
    internalConflictResult.conflicts.forEach((c) => {
      errors.push(c.message);
    });
  }

  // External Venue Collision Conflicts
  const venueConflictResult = checkExternalVenueConflicts(
    sessions,
    data.venueId,
    allEvents,
    currentEventId
  );
  if (venueConflictResult.hasConflict) {
    venueConflictResult.conflicts.forEach((c) => {
      errors.push(c.message);
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    fieldErrors,
    internalConflicts: internalConflictResult.conflicts,
    venueConflicts: venueConflictResult.conflicts,
  };
}

export function validateStep3(data: EventFormData): StepValidationResult {
  const errors: string[] = [];
  const fieldErrors: Record<string, string> = {};

  if (data.targetAudienceScope === 'custom') {
    const hasCourses = (data.targetCourses || data.allowedCourses || []).length > 0;
    const hasYears = (data.targetYearLevels || []).length > 0;
    const hasSections = (data.targetSections || []).length > 0;

    if (!hasCourses && !hasYears && !hasSections) {
      errors.push('For custom audience, please select at least one Course, Year Level, or Section.');
      fieldErrors.targetAudienceScope = 'Please select at least one target criterion.';
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    fieldErrors,
  };
}

export function validateStep4(data: EventFormData): StepValidationResult {
  const errors: string[] = [];
  const fieldErrors: Record<string, string> = {};

  const isQREnabled = Boolean(data.enableQRTickets === true || (data as any).enableQR === true);
  if (!isQREnabled) {
    // If QR ticketing is not enabled, staff / scanners are not required
    return { isValid: true, errors: [] };
  }

  const scanners = data.scanners || [];
  // Only validate individual scanner rows if the user added scanner rows
  scanners.forEach((s, idx) => {
    if (!s.officerUserId && !s.officerName?.trim()) {
      errors.push(`Scanner #${idx + 1}: Please select an officer or remove the unassigned scanner row.`);
      fieldErrors[`scanner_${idx}`] = 'Please assign an officer.';
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    fieldErrors,
  };
}

export function validateStep5(
  data: EventFormData,
  availableBalance?: number
): StepValidationResult {
  const errors: string[] = [];
  const fieldErrors: Record<string, string> = {};

  const budgetItems = (data.budgetItems || []).filter(
    (item) => Boolean(item.item?.trim()) || Number(item.unitCost || 0) > 0
  );

  // Budget is optional — 0 line items or 0 total cost is valid
  if (budgetItems.length > 0) {
    let totalProposed = 0;
    budgetItems.forEach((item, idx) => {
      const iNum = idx + 1;
      if (!item.item?.trim()) {
        errors.push(`Budget Item #${iNum}: Item name / description cannot be blank.`);
        fieldErrors[`budget_${idx}_item`] = 'Item name is required.';
      }
      if (item.quantity !== undefined && Number(item.quantity) < 1) {
        errors.push(`Budget Item #${iNum}: Quantity must be at least 1.`);
        fieldErrors[`budget_${idx}_quantity`] = 'Quantity must be at least 1.';
      }
      if (item.unitCost !== undefined && Number(item.unitCost) < 0) {
        errors.push(`Budget Item #${iNum}: Unit cost cannot be negative.`);
        fieldErrors[`budget_${idx}_unitCost`] = 'Unit cost cannot be negative.';
      }
      totalProposed += (Number(item.quantity) || 1) * (Number(item.unitCost) || 0);
    });

    const balanceToCheck = availableBalance !== undefined ? availableBalance : (data as any).maxAllowedBudget;
    if (balanceToCheck !== undefined && balanceToCheck !== null && totalProposed > balanceToCheck && balanceToCheck >= 0) {
      errors.push(`Budget Exceeded: Total proposed budget (₱${totalProposed.toLocaleString()}) exceeds the available organization treasury balance of ₱${balanceToCheck.toLocaleString()}.`);
      fieldErrors.totalBudget = 'Proposed budget exceeds available treasury balance.';
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    fieldErrors,
  };
}

export function validateStep6(data: EventFormData, isOfficer = false): StepValidationResult {
  const errors: string[] = [];
  const fieldErrors: Record<string, string> = {};

  const docs = data.documents || [];

  if (isOfficer) {
    const activityProposal = docs.find(
      (d) => d.id === 'req_activity_proposal' || (d.name || '').toLowerCase().includes('activity proposal')
    );
    if (!activityProposal || !activityProposal.fileUrl) {
      errors.push('Official Activity Proposal document must be uploaded before submitting.');
      fieldErrors.activityProposal = 'Activity Proposal document is required.';
    }
  }

  // Any custom document marked required must have a fileUrl
  docs.forEach((doc, idx) => {
    if (doc.required && !doc.fileUrl) {
      errors.push(`Required document "${doc.name || `Document #${idx + 1}`}" is missing an uploaded file.`);
      fieldErrors[`doc_${idx}`] = 'File upload required.';
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    fieldErrors,
  };
}

export function validateStep7(data: EventFormData, isOfficer = false): StepValidationResult {
  const errors: string[] = [];

  const s1 = validateStep1(data, isOfficer);
  const s2 = validateStep2(data);
  const s3 = validateStep3(data);
  const s4 = validateStep4(data);
  const s5 = validateStep5(data);
  const s6 = validateStep6(data, isOfficer);

  if (!s1.isValid) errors.push(...s1.errors);
  if (!s2.isValid) errors.push(...s2.errors);
  if (!s3.isValid) errors.push(...s3.errors);
  if (!s4.isValid) errors.push(...s4.errors);
  if (!s5.isValid) errors.push(...s5.errors);
  if (!s6.isValid) errors.push(...s6.errors);

  if (isOfficer && !data.isCertified && !data.officerAcknowledgement) {
    errors.push('Officer Proposal Acknowledgement & Certification must be checked.');
  } else if (!isOfficer && !data.isCertified && !data.officerAcknowledgement) {
    errors.push('SAO Adviser Authorization must be checked before publishing.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Master step validation dispatcher
 */
export function validateWizardStep(
  stepIndex: number,
  stepName: string,
  data: EventFormData,
  isOfficer: boolean,
  allEvents: EventDocument[] = [],
  currentEventId?: string
): StepValidationResult {
  switch (stepName) {
    case 'Event Details':
      return validateStep1(data, isOfficer);
    case 'Schedule':
      return validateStep2(data, allEvents, currentEventId);
    case 'Participants':
      return validateStep3(data);
    case 'Staff':
      return validateStep4(data);
    case 'Budget':
      return validateStep5(data);
    case 'Documents':
      return validateStep6(data, isOfficer);
    case 'Publish':
    case 'Submit':
      return validateStep7(data, isOfficer);
    default:
      return { isValid: true, errors: [] };
  }
}
