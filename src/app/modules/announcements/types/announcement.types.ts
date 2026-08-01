import { Timestamp } from 'firebase/firestore';

export type AnnouncementPriority = 'Normal' | 'Important' | 'Urgent';
export type AnnouncementAudience = 'campus-wide' | 'all-organizations' | 'specific';

export interface AnnouncementDocument {
  id: string;                              // Auto-generated Firestore document ID

  // ─── Content ───
  title: string;                           // e.g., "Reminder: Event Proposal Deadline"
  content: string;                         // Rich-text body
  priority: AnnouncementPriority;

  // ─── Targeting ───
  audience: AnnouncementAudience;
  targetOrgIds: string[];                  // Populated only when audience === 'specific'
  targetOrgNames: string[];                // Denormalized names for display
  targetDepartments?: string[];            // e.g. ['BSIT', 'BSCS']
  targetYearLevels?: string[];             // e.g. ['1st Year', '2nd Year']

  // ─── Organization / Event Context ───
  organizationId?: string | null;          // Org ID if posted by an Officer
  organizationName?: string | null;        // Org Name if posted by an Officer
  linkedEventId?: string | null;           // FK → /events
  linkedEventTitle?: string | null;        // Title of linked event

  // ─── Pinning ───
  pinned: boolean;                         // Pinned announcements float to top

  // ─── Academic Context ───
  semesterId: string;                      // FK → /semesters
  schoolYear: string;                      // e.g., "2025-2026"

  // ─── Author ───
  authorName: string;                      // Author full name
  authorRole?: string | null;              // e.g., "President", "SAO Adviser"
  authorUid: string;                       // UID of author

  // ─── Timestamps ───
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateAnnouncementPayload {
  title: string;
  content: string;
  priority: AnnouncementPriority;
  audience: AnnouncementAudience;
  targetOrgIds: string[];
  targetOrgNames: string[];
  targetDepartments?: string[];
  targetYearLevels?: string[];
  organizationId?: string | null;
  organizationName?: string | null;
  linkedEventId?: string | null;
  linkedEventTitle?: string | null;
  pinned: boolean;
  semesterId: string;
  schoolYear: string;
  authorRole?: string | null;
}
