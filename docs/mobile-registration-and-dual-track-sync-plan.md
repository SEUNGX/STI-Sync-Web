# STI Sync Mobile — Registration, Validations & Dual-Track Sync Implementation Plan

This document serves as the official specification and implementation guide for the **STI Sync Mobile Application** (`STI_Sync`). It guarantees 100% data consistency, validation parity, and behavioral symmetry with the **STI Sync Web Application**.

---

## 1. Architectural & Domain Overview

The STI Sync platform manages both **Tertiary Education (College)** and **Basic Education (Senior High School)** on a unified campus.

| Academic Track | Academic Periods | Year Level Terminology | Duration | Active Term Status |
| :--- | :--- | :--- | :--- | :--- |
| **College (Tertiary)** | Semesters (1st Sem, 2nd Sem, Summer) | `1st Year`, `2nd Year`, `3rd Year`, `4th Year` | 4 Years (typical) | 1 Active College Semester |
| **Senior High School (SHS)** | Trimesters (1st Tri, 2nd Tri, 3rd Tri) | `Grade 11`, `Grade 12` | 2 Years | 1 Active SHS Trimester |

> [!IMPORTANT]
> Both tracks operate **simultaneously in parallel** in Firestore. A College student belongs to an active Semester, while an SHS student belongs to an active Trimester.

---

## 2. Student Registration Flow (Step-by-Step & Validation Rules)

The mobile registration wizard should implement a **5-step wizard** matching the web validation pipeline.

```
┌─────────────────┐     ┌──────────────────┐     ┌───────────────────┐     ┌───────────────┐     ┌─────────────────┐
│ 1. Personal Info│ ──► │ 2. Academic Info │ ──► │ 3. Account Creds  │ ──► │ 4. Selfie Pic │ ──► │ 5. Portrait ID  │
└─────────────────┘     └──────────────────┘     └───────────────────┘     └───────────────┘     └─────────────────┘
```

---

### Step 1: Personal Information

#### Form Fields & UI Controls:
- **Last Name** (`lastName`): Text input, required, trimmed.
- **First Name** (`firstName`): Text input, required, trimmed.
- **Middle Name** (`middleName`): Text input, optional.
- **Student ID Number** (`studentId`): Text input (Numeric keypad), 11 digits (e.g. `02000258377`).
- **Date of Birth** (`dateOfBirth`): Date picker, default value **`2005-01-01`**, maximum date restricted to **Today** (`YYYY-MM-DD`). Future dates are disabled.
- **Sex** (`sex`): Segmented toggle (`'Male' | 'Female'`), required.
- **Contact Number** (`contactNumber`): Phone input with `🇵🇭 +63` prefix, 10 digits starting with `9` (e.g. `9123456789`).

#### Step 1 Validation Pipeline (Before advancing to Step 2):
```typescript
// 1. Basic format validations
if (!lastName.trim()) throw new Error("Last name is required.");
if (!firstName.trim()) throw new Error("First name is required.");
if (!/^\d{11}$/.test(studentId.trim())) throw new Error("Student ID must be exactly 11 digits.");
if (!dateOfBirth) throw new Error("Date of birth is required.");
if (new Date(dateOfBirth) > new Date()) throw new Error("Date of birth cannot be a future date.");
if (!sex) throw new Error("Please select your sex.");
if (!/^9\d{9}$/.test(contactNumber.replace(/\s/g, ''))) {
  throw new Error("Enter a valid 10-digit PH mobile number starting with 9.");
}

// 2. Firestore Uniqueness & Duplicate Checks
// A. Student ID Uniqueness
const idQuery = query(collection(db, "students"), where("studentId", "==", studentId.trim()));
const idSnap = await getDocs(idQuery);
if (!idSnap.empty) throw new Error("This Student ID number is already registered in the system.");

// B. Contact Number Uniqueness
const cleanPhone = contactNumber.replace(/\s/g, '');
const phoneQuery = query(collection(db, "students"), where("contactNumber", "==", cleanPhone));
const phoneSnap = await getDocs(phoneQuery);
if (!phoneSnap.empty) throw new Error("This contact number is already registered to another student.");

// C. Same Name + Birthday Check
const dobQuery = query(collection(db, "students"), where("dateOfBirth", "==", dateOfBirth));
const dobSnap = await getDocs(dobQuery);
const duplicateFound = dobSnap.docs.some(doc => {
  const data = doc.data();
  return (
    (data.firstName || '').trim().toLowerCase() === firstName.trim().toLowerCase() &&
    (data.lastName || '').trim().toLowerCase() === lastName.trim().toLowerCase()
  );
});
if (duplicateFound) {
  throw new Error("A student with this name and date of birth is already registered.");
}
```

---

### Step 2: Academic Details (Dual-Track System)

#### UI Layout & Cascading Gating:
1. **Academic Track Segmented Selector**:
   - `[ College (Semestral) ]` vs `[ Senior High School (Trimestral) ]`
2. **Auto-Populate Active Period**:
   - If **College** selected: Fetch `semesters` where `academicLevel == 'COLLEGE'` (or not SHS) and `status == 'ACTIVE'`. Auto-set `schoolYear` and `semester = activePeriod.semester` (e.g. `1st Semester`).
   - If **SHS** selected: Fetch `semesters` where `academicLevel == 'SHS'` and `status == 'ACTIVE'`. Auto-set `schoolYear` and `semester = activePeriod.semester` (e.g. `1st Trimester`).
3. **Course / Strand Selection**:
   - If **College**: Filter courses where `academicLevel !== 'SHS'` (e.g. `BSIT`, `BSCpE`, `BSHM`, `BSTM`, `BSOA`, `BACOMM`).
   - If **SHS**: Filter courses where `academicLevel === 'SHS'` (e.g. `STEM`, `ABM`, `HUMSS`, `TVL`, `GAS`).
4. **Year Level Selection**:
   - If **College**: Present `['1st Year', '2nd Year', '3rd Year', '4th Year']` (disabled until Course is chosen).
   - If **SHS**: Present `['Grade 11', 'Grade 12']` (disabled until Course is chosen).
5. **Section Selection Gating**:
   - **CRITICAL**: The Section dropdown **MUST BE DISABLED** until **both Course and Year Level are selected**.
   - Filter sections matching `courseId == selectedCourseId` AND `yearLevel == selectedYearLevel` (e.g. `s.yearLevel === 11` or `s.yearLevel === 'Grade 11'`).

```typescript
// Section query logic
const matchingSections = sections.filter(sec => {
  if (sec.archived || sec.courseId !== form.courseId) return false;
  if (!form.yearLevel) return false;
  
  const ylStr = String(form.yearLevel);
  const targetNum = ylStr.includes('11') ? 11 : ylStr.includes('12') ? 12 : ylStr.includes('1st') ? 1 : ylStr.includes('2nd') ? 2 : ylStr.includes('3rd') ? 3 : ylStr.includes('4th') ? 4 : 1;
  return sec.yearLevel === form.yearLevel || Number(sec.yearLevel) === targetNum;
});
```

---

### Step 3: Account Credentials

- **Email**: Must be a valid personal email format (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`).
- **Password**: Minimum 8 characters, with strength indicators for Uppercase, Number, and Special character.
- **Confirm Password**: Must match `password`.

---

### Step 4: Profile Photo (Selfie)

- **Camera Requirement**: Front-facing selfie camera or gallery upload.
- **Photo specs**: Face centered, well-lit, no sunglasses/masks.
- **Storage**: Upload to Cloudinary folder `students/profile`.
- **Field**: `profilePhotoUrl`.

---

### Step 5: Physical School ID Card (Portrait Orientation)

- **Orientation Requirement**: **Strictly Portrait Aspect Ratio (3:4)**.
- **Inspection Specs**: The physical STI student ID card must be fully visible with all student details readable.
- **Storage**: Upload to Cloudinary folder `students/school-id`.
- **Field**: `schoolIdPhotoUrl`.

---

## 3. Mandatory Password Change Workflow (`requiresChangePassword`)

When an administrator manually creates a student account on the Web Portal, the student is given a temporary password and flagged for mandatory password change.

### Firestore Document Flags:
```json
{
  "requiresPasswordChange": true,
  "requiresChangePassword": true
}
```

### Mobile Authentication & Navigation Interceptor Flow:

```
                  ┌──────────────────────┐
                  │ Student Logs In      │
                  │ (signInWithEmail)    │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │ Fetch Student Doc    │
                  │ from Firestore       │
                  └──────────┬───────────┘
                             │
           ┌─────────────────┴─────────────────┐
           │ Is requiresPasswordChange true?   │
           └─────────────────┬─────────────────┘
                    YES      │      NO
        ┌────────────────────┘      └────────────────────┐
        ▼                                                ▼
┌─────────────────────────────────┐           ┌──────────────────────┐
│ Navigate to                     │           │ Navigate to          │
│ ForceChangePasswordScreen       │           │ Main App (Home tabs) │
│ (Blocks Back Button / Tabs)     │           └──────────────────────┘
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│ 1. Verify Current Temp Password │
│ 2. Enter & Confirm New Password │
│ 3. Execute updatePassword()     │
│ 4. Update Firestore flags:      │
│    requiresPasswordChange: false│
│    requiresChangePassword: false│
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│ Toast Success & Navigate to Home│
└─────────────────────────────────┘
```

### Code Implementation Pattern for Mobile (React Native / Flutter / Android):

```typescript
// Auth state listener in App Navigator
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (user) {
      const studentSnap = await getDoc(doc(db, "students", user.uid));
      if (studentSnap.exists()) {
        const student = studentSnap.data();
        if (student.requiresPasswordChange === true || student.requiresChangePassword === true) {
          // Force navigate to password change screen
          navigation.reset({
            index: 0,
            routes: [{ name: 'ForceChangePasswordScreen' }],
          });
          return;
        }
      }
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    }
  });
  return unsubscribe;
}, []);
```

#### In `ForceChangePasswordScreen`:
1. User provides `currentPassword`, `newPassword`, and `confirmPassword`.
2. Reauthenticate using `EmailAuthProvider.credential(user.email, currentPassword)`.
3. Call `updatePassword(user, newPassword)`.
4. Update Firestore student document:
   ```typescript
   await updateDoc(doc(db, "students", user.uid), {
     requiresPasswordChange: false,
     requiresChangePassword: false,
     updatedAt: serverTimestamp(),
   });
   ```
5. Navigate to `MainTabs`.

---

## 4. Mobile Student Re-Enrollment Flow

When an academic semester/trimester concludes and a new period becomes active:

1. On app start / home screen load, mobile app queries active period for the student's track (`student.academicLevel === 'SHS' ? activeShsPeriod : activeCollegePeriod`).
2. If `student.schoolYear !== activePeriod.academicYear || student.semester !== activePeriod.semester`:
   - Mobile shows a prompt or banner: *"A new academic period is active: [e.g. 2nd Trimester A.Y. 2026-2027]. Please confirm your enrollment status."*
3. Student confirms their current **Year Level** and **Section**.
4. Student record in Firestore is updated with:
   - `schoolYear: activePeriod.academicYear`
   - `semester: activePeriod.semester`
   - `yearLevel: updatedYearLevel`
   - `section: updatedSection`
   - `updatedAt: serverTimestamp()`

---

## 5. Complete Firestore Data Schema Reference

### `students/{studentId}` Document:

```typescript
export interface StudentDocument {
  id: string; // Auth UID
  studentId: string; // "02000258377" (11 digits)
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth: string; // "2005-01-01"
  sex: 'Male' | 'Female';
  contactNumber: string; // "9123456789" (10 digits)
  
  // Dual-Track Academic Information
  academicLevel: 'COLLEGE' | 'SHS';
  courseId: string;
  courseName: string;
  courseCode: string;
  departmentId: string;
  departmentName: string;
  yearLevel: '1st Year' | '2nd Year' | '3rd Year' | '4th Year' | 'Grade 11' | 'Grade 12';
  section: string;
  schoolYear: string; // "2026-2027"
  semester: '1st Semester' | '2nd Semester' | 'Summer' | '1st Trimester' | '2nd Trimester' | '3rd Trimester';

  // Status & Registration
  status: 'ACTIVE' | 'PENDING' | 'RETURNED' | 'INACTIVE';
  registrationSource: 'MOBILE_APP' | 'MANUAL';
  email: string;
  profilePhotoUrl: string; // Cloudinary secure URL
  schoolIdPhotoUrl: string; // Cloudinary secure URL (Portrait 3:4)

  // Security Flags
  requiresPasswordChange?: boolean;
  requiresChangePassword?: boolean;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## 6. Verification Checklist for Mobile Implementation

- [ ] **Date of Birth**: Default is `2005-01-01`, future dates cannot be selected.
- [ ] **Duplicate Name + DOB**: Rejects registration if first name, last name, and date of birth match an existing student.
- [ ] **Student ID Format & Uniqueness**: Exactly 11 digits, uniqueness validated in Firestore before Step 2.
- [ ] **Phone Number Format & Uniqueness**: 10 digits starting with 9, uniqueness validated in Firestore before Step 2.
- [ ] **Academic Track**: Correctly toggles between College (Semesters) and SHS (Trimesters).
- [ ] **Section Gating**: Section dropdown is disabled until Year Level is selected.
- [ ] **School ID Capture**: Preview and camera container enforce **Portrait aspect ratio (3:4)**.
- [ ] **Mandatory Password Change**: Users with `requiresPasswordChange: true` or `requiresChangePassword: true` cannot access home screens until they update their password.
- [ ] **Re-enrollment**: Student is evaluated against their track's specific active semester/trimester.
