# Financial Systems QA & Testing Guide (Admin & Officer)

This comprehensive guide is designed for teammates to verify end-to-end financial workflows in both the **Admin Portal (SAO School Budget)** and the **Officer Portal (Club Treasury)**.

---

## 1. Testing Matrix & Roles Overview

| Flow # | Feature Area | Portal / Role | Expected Financial Action | Target Ledger |
| :---: | :--- | :--- | :--- | :--- |
| **Test 1** | **Event Proposal Budget Approval** | Admin (SAO Reviewer) | Auto-debits approved budget on event approval (`source: event_budget`) | `/sao_ledger` (SAO Event) or `/organization_ledger` (Club Event) |
| **Test 2** | **Fine Assessment & Due Date** | Admin / Officer | Generates fine payables with a configured Due Date | `/payables` (stores Auth UID & School ID) |
| **Test 3** | **Student Cash Payment Recording** | Admin / Officer | Records cash payment without spamming ledger entries | `/payables` (`status: paid`, `paidAmount: X`) |
| **Test 4** | **Centralized Student Collections Transfer** | Admin / Officer | Batches collected cash into ledger with 1 single click | `/sao_ledger` or `/organization_ledger` (`source: student_collection`) |
| **Test 5** | **Post-Event Financial Liquidation (Surplus)** | Officer & Admin | Unused budget is returned as an income credit | `/organization_ledger` (`source: liquidation_surplus`) |
| **Test 6** | **Post-Event Financial Liquidation (Deficit)** | Officer & Admin | Overspending is debited as an expense | `/organization_ledger` (`source: liquidation_deficit`) |
| **Test 7** | **Budget Ledger UX & Universal Filters** | Admin & Officer | Fixed scrollable table, hidden scrollbars, All/Income/Expense filters | Transaction History table & Balance footers |

---

## 2. Test Scenario 1: Automatic Event Proposal Budget Deduction

### Objective
Verify that approving an event proposal with a budget immediately debits the exact amount from the appropriate ledger.

### Step-by-Step Instructions
1. **Officer Event Test**:
   - Log in as an **Officer** and create an Event Proposal with a budget of **₱3,000** (under Budget Items).
   - Log in as an **Admin (SAO)** and navigate to `Event Approvals > Proposal Review`.
   - Review and click **"Approve Proposal"**.
   - **Verification**:
     - Log in as the **Officer** and go to `Finance Center > Budget Tracker`.
     - Confirm an expense entry appears: `Approved Event Budget – [Event Name]`, `Amount: −₱3,000`, `Source: Event Budget Allocation` (Purple badge).
2. **SAO / Institutional Event Test**:
   - Log in as **Admin** and create/approve an SAO Institutional Event with a budget of **₱5,000**.
   - Navigate to `Settings > Budget & Fund Management > Budget Tracker`.
   - **Verification**:
     - Confirm an expense entry of `−₱5,000` appears with `Source: Event Budget Allocation`.

---

## 3. Test Scenario 2: Assessing Event Fines with Due Date

### Objective
Verify that fine rules evaluate scanned attendance, prompt for a Due Date, and generate payables tied to the student's Auth UID.

### Step-by-Step Instructions
1. Navigate to `Attendance Monitoring > [Completed Event] > Assess Event Fines`.
2. In the modal:
   - Configure session penalty amounts (e.g. Absent: ₱20, Late: ₱10).
   - Verify the **Fine Payment Settlement Due Date** date picker is visible (defaulting to 14 days from today). Pick a custom deadline.
   - Inspect the live simulated roster of student violations.
3. Click **"Assess & Generate Event Fines"**.
4. **Verification**:
   - The system displays a success toast: `Generated X fine payable(s)`.
   - In Firestore `/payables` (or mobile app): Confirm `studentId` matches the student's Firebase Auth UID, `studentSchoolId` contains the 11-digit STI ID, and `dueDate` matches the selected date.

---

## 4. Test Scenario 3: Recording Student Cash Payments (No Ledger Spam)

### Objective
Verify that student cash payments update `/payables` without creating individual single-row spam entries in Transaction History.

### Step-by-Step Instructions
1. In `Attendance Monitoring` (or `Attendance Logs`), locate a student with an unpaid fine.
2. Click **"Record Payment"** (or use the fast pay button):
   - Note: Verify that the **QR Ticket Access Status** checkbox is **hidden** because fines are post-event obligations.
   - Enter the payment amount (e.g. ₱20 cash) and submit.
3. **Verification**:
   - Student's status updates to **"Paid"** with a green checkmark.
   - Navigate to `Budget & Fund Management` (Admin) or `Finance Center` (Officer) $\rightarrow$ `Budget Tracker`:
   - **Crucial Check**: Confirm that **NO individual payment row** was added to the Transaction History. The budget balance remains unchanged at this stage.

---

## 5. Test Scenario 4: Centralized Student Collections & Batch Transfer

### Objective
Verify that all collected student funds accumulate in Student Collections and can be batch-transferred to the ledger in a single consolidated action (Zero Ghost Money).

### Step-by-Step Instructions
1. **Admin Portal Test**:
   - Go to `Settings > Budget & Fund Management > Student Collections`.
   - Find the collection group for the event where students paid fines or fees.
   - Click **"View Details"**:
     - Verify the roster clearly shows **who paid** (with dates/amounts) and **who has not paid** (pending).
     - Verify the total collected amount only sums paid cash.
   - Click **"Transfer ₱X to School Budget"**.
   - **Verification**:
     - Collection status changes to **"Transferred"** with a green badge.
     - Switch to `Budget Tracker`: A single consolidated income entry appears with `Source: Student Collection` (Green badge) for the exact collected cash.
2. **Officer Portal Test**:
   - Go to `Finance Center > Student Collections`.
   - Locate collected Membership Dues, Club Event Fees, or Club Fines.
   - Click **"View Details"** $\rightarrow$ **"Transfer to Club Treasury"**.
   - **Verification**:
     - Exact collected cash is credited to the Club Budget Ledger in 1 consolidated transaction.

---

## 6. Test Scenario 5: Financial Liquidation Surplus (Refund to Treasury)

### Objective
Verify that when an event spends less than its approved budget, the unused funds are refunded back to the ledger upon approval.

### Step-by-Step Instructions
1. **Officer Liquidation**:
   - Event Budget: **₱3,000** (previously deducted in Test 1).
   - Go to `Finance Center > Liquidation Reports > Create Liquidation`.
   - Add receipts totaling **₱2,400** (Actual Spending).
   - Verify the form calculates a **+₱600 Surplus** (green).
   - Submit the report for SAO review.
2. **Admin Approval**:
   - Log in as **Admin** $\rightarrow$ `Finance & Liquidations > Review Liquidation`.
   - Approve the liquidation report.
3. **Verification**:
   - Log in as **Officer** $\rightarrow$ `Finance Center > Budget Tracker`.
   - Confirm an income credit of **+₱600** appears: `Liquidation Surplus Returned – [Event Name]`, `Source: Liquidation Surplus Refund` (Emerald badge).
   - In `Finance Center > Liquidation Reports > View Details`: Confirm the callout banner states: `✓ Treasury Surplus Refund: +₱600.00 credited to Club Treasury`.

---

## 7. Test Scenario 6: Financial Liquidation Deficit (Debit Overspend)

### Objective
Verify that when an event overspends beyond its approved budget, the overspent difference is debited from the treasury upon approval.

### Step-by-Step Instructions
1. **Officer Liquidation**:
   - Event Budget: **₱2,000**.
   - Create liquidation with receipts totaling **₱2,350**.
   - Verify the form calculates a **−₱350 Deficit** (red).
   - Submit the report.
2. **Admin Approval**:
   - Admin approves the liquidation report.
3. **Verification**:
   - In `Finance Center > Budget Tracker`: Confirm an expense debit of **−₱350** appears: `Liquidation Deficit / Overspend – [Event Name]`, `Source: Liquidation Deficit Expense` (Rose badge).

---

## 8. Test Scenario 7: Ledger Table UX & Universal Filtering

### Objective
Verify that the Transaction History / Budget Ledger table provides a clean, fixed-height scrolling experience with hidden scrollbars and working filters.

### Step-by-Step Instructions
1. Navigate to `Budget & Fund Management` (Admin) or `Finance Center` (Officer) $\rightarrow$ `Budget Tracker`.
2. **Scrolling Test**:
   - Ensure the table has a fixed height (`max-h-[520px]`).
   - Scroll through transactions: Confirm the scrollbar is hidden, the table header (`thead`) stays fixed at the top, and the **Current Balance** footer (`tfoot`) stays anchored at the bottom.
3. **Filter Test**:
   - Click **"Income +"**: Confirm only income sources are displayed (Allocations, Student Collections, Liquidation Surplus Refunds).
   - Click **"Expenses −"**: Confirm only expense sources are displayed (Manual Expenses, Event Budget Allocations, Liquidation Deficit Expenses).
   - Click **"All"**: Confirm all transactions return with running balance integrity.

---

## 9. Summary Checklist for QA Sign-Off

- [ ] Event proposal approval automatically debits budget from the correct ledger.
- [ ] No duplicate event budget deductions occur on re-saves.
- [ ] Fine generation includes a customizable Due Date.
- [ ] Student fine payments do not create individual single-payment spam entries in the ledger.
- [ ] Student Collections modal lists who paid and who didn't pay.
- [ ] Batch transfer moves collected cash into the ledger in a single transaction with zero ghost money.
- [ ] Liquidation surplus is credited back to the ledger as an income refund.
- [ ] Liquidation deficit is debited from the ledger as an expense overspend.
- [ ] Mobile app reflects fines and payables immediately using Auth UID.
- [ ] Table headers, footers, and Income/Expense filters work cleanly with hidden scrollbars.
