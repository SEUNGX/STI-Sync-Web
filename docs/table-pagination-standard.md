# System-Wide Table Pagination Standard & Reference

This document defines the official design, behavior, and implementation standards for pagination across all data tables in **STI-Sync** (Admin, Officer, and Adviser portals).

All newly formed tables, as well as refactored views, **MUST** strictly adhere to this specification to guarantee consistency, usability, and visual harmony.

---

## 1. Core Principles

1. **Uniform Visual Hierarchy**: Every paginated table has a dedicated footer bar attached cleanly to the table container border (`border-t border-gray-200`).
2. **Predictable Phrasing**: Use the standardized counter format:
   `Showing [Start] to [End] of [Total] [Item Name]`
   Values are wrapped in `<strong className="text-gray-900 font-bold">`.
3. **Ellipsis Windowing**: When pages exceed `7`, do not wrap or overflow the footer. Retain page 1, the last page, and `currentPage ± 1`, inserting non-interactive ellipsis `...` between gaps.
4. **Interactive States**:
   - Active page button is highlighted with the primary STI Navy brand color (`bg-[#001A4D] text-white`).
   - Inactive buttons are crisp white with a subtle border (`border-gray-200 text-gray-700 hover:bg-gray-100`).
   - Disabled buttons have `disabled:opacity-40 disabled:cursor-not-allowed`.
5. **State Reset Consistency**: Any filter change (search bar, status dropdown, semester selector, or tab change) **MUST** immediately reset `currentPage` to `1`.

---

## 2. Visual Anatomy

```
+----------------------------------------------------------------------------------------------------+
| Table Content / Data Rows ...                                                                     |
+----------------------------------------------------------------------------------------------------+
| Showing 1 to 8 of 25 collection groups              [Previous] [1] [2] [3] ... [12] [Next]         |
+----------------------------------------------------------------------------------------------------+
  ^                                                    ^
  |-- Left Counter & (Optional) Page Size Selector     |-- Right Navigation Action Controls
```

### Layout Specifications
- **Container**: `p-3.5 bg-gray-50/60 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500`
- **Left Counter**:
  - Empty: `Showing 0 {itemName}`
  - Populated: `Showing <strong className="text-gray-900 font-bold">{start}</strong> to <strong className="text-gray-900 font-bold">{end}</strong> of <strong className="text-gray-900 font-bold">{total}</strong> {itemName}`
- **Nav Buttons (Previous / Next)**:
  - `px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed font-semibold transition-colors cursor-pointer text-xs`
- **Page Number Buttons**:
  - Size: `w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center`
  - Active: `bg-[#001A4D] text-white shadow-xs`
  - Inactive: `border border-gray-200 bg-white text-gray-700 hover:bg-gray-100`
- **Ellipsis**:
  - `<span className="text-gray-400 text-xs px-1 select-none">...</span>`

---

## 3. Standard Page Size: Exactly 8 Rows Per Page

> [!IMPORTANT]
> **System-Wide Standard (`PER_PAGE = 8`)**:
> All data tables across the entire STI-Sync system (Officer, Admin, and Adviser portals) **MUST strictly display exactly 8 rows per table page**.

| Feature Area | Standard Page Size (`PER_PAGE`) | Example Views |
| :--- | :---: | :--- |
| **Financial Ledgers & Collections** | `8` | Budget Ledgers, Collection Groups, Member Payables Roster |
| **Student & Member Registries** | `8` | Active Students, Inactive Students, Archived Graduates, Re-enrollment |
| **Event Proposals & Approvals** | `8` | Event Management, Event Approvals, Attendance Logs |
| **Document Management** | `8` | Submitted Documents, Broadcasts, Official SAS Inbox |
| **Audit Logs & History** | `8` | Security Audit Trail, System Change Logs |
| **Fee & Fine Category Settings** | `8` | Admin & Officer Payable Categories |
| **Reports & Analytics Previews** | `8` | Academic & Financial Report Data Previews |
| **Modal Embedded Tables** | `8` | Collection Group Payment Rosters, Event Fine Rosters |

---

## 4. Reusable Component (`<TablePagination />`)

To prevent boilerplate duplication, use the official shared component:
[`src/app/components/common/TablePagination.tsx`](file:///c:/CAPSTONE_SYSTEM/STI-Sync-Web/src/app/components/common/TablePagination.tsx)

### Props Interface

```typescript
export interface TablePaginationProps {
  /** The current active page (1-indexed) */
  currentPage: number;
  /** Total number of pages available */
  totalPages: number;
  /** Total count of items matching the current filter/search */
  totalItems: number;
  /** Number of items displayed per page */
  itemsPerPage: number;
  /** Callback when page number changes */
  onPageChange: (page: number) => void;
  /** Human-readable noun for items (e.g. "students", "events", "collection groups", "records") */
  itemName?: string;
  /** Optional custom CSS class for the bottom bar container */
  className?: string;
  /** Optional array of page size choices (e.g. [8, 10, 25, 50]) */
  pageSizeOptions?: number[];
  /** Optional callback when page size changes */
  onPageSizeChange?: (newSize: number) => void;
}
```

---

## 5. Usage Examples

### Standard Pattern in a Page Component

```tsx
import React, { useState, useMemo, useEffect } from "react";
import { TablePagination } from "../components/common/TablePagination";

export function ExampleTablePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // 1. Define page size & page state
  const ITEMS_PER_PAGE = 8;
  const [currentPage, setCurrentPage] = useState(1);

  // 2. Filter list
  const filteredData = useMemo(() => {
    return rawData.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rawData, searchQuery, statusFilter]);

  // 3. Reset to page 1 on filter or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  // 4. Calculate total pages and paginated slice
  const totalPages = Math.max(1, Math.ceil(filteredData.length / ITEMS_PER_PAGE));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredData.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredData, currentPage]);

  return (
    <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden shadow-xs">
      {/* Search and Filters */}
      <div className="p-4 border-b border-gray-100 flex items-center gap-3">
        {/* filter controls */}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          {/* Table headers & rows mapping over paginatedData */}
        </table>
      </div>

      {/* Standard Table Pagination Footer */}
      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredData.length}
        itemsPerPage={ITEMS_PER_PAGE}
        onPageChange={setCurrentPage}
        itemName="students"
      />
    </div>
  );
}
```

---

## 6. Raw JSX Implementation Pattern

If a component cannot import `<TablePagination />` directly, replicate the exact structure below:

```tsx
{/* ── Standard Bottom Pagination Bar ── */}
<div className="p-3.5 bg-gray-50/60 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
  <div>
    {filteredItems.length === 0 ? (
      "Showing 0 records"
    ) : (
      <span>
        Showing <strong className="text-gray-900 font-bold">{(currentPage - 1) * PER_PAGE + 1}</strong> to{" "}
        <strong className="text-gray-900 font-bold">
          {Math.min(currentPage * PER_PAGE, filteredItems.length)}
        </strong>{" "}
        of <strong className="text-gray-900 font-bold">{filteredItems.length}</strong> records
      </span>
    )}
  </div>

  <div className="flex items-center gap-1.5">
    <button
      type="button"
      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
      disabled={currentPage <= 1}
      className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed font-semibold transition-colors cursor-pointer text-xs"
    >
      Previous
    </button>

    {Array.from({ length: totalPages }, (_, i) => i + 1)
      .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
      .map((p, idx, arr) => {
        const prev = arr[idx - 1];
        return (
          <span key={p} className="flex items-center gap-1">
            {prev && p - prev > 1 && <span className="text-gray-400 text-xs px-1 select-none">...</span>}
            <button
              type="button"
              onClick={() => setCurrentPage(p)}
              className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                currentPage === p
                  ? "bg-[#001A4D] text-white shadow-xs"
                  : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              {p}
            </button>
          </span>
        );
      })}

    <button
      type="button"
      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
      disabled={currentPage >= totalPages || totalPages === 0}
      className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed font-semibold transition-colors cursor-pointer text-xs"
    >
      Next
    </button>
  </div>
</div>
```

---

## 7. Quality Checklist for Tables

Before finalizing any table view in STI-Sync, ensure all points are checked:

- [ ] **Reset on Filter**: `useEffect(() => { setCurrentPage(1); }, [searchQuery, filterA, filterB])` is present.
- [ ] **Boundary Guarding**: Previous button is disabled on `page <= 1`; Next button is disabled on `page >= totalPages || totalPages === 0`.
- [ ] **Noun Phrasing**: `itemName` accurately describes the entity (e.g. `students`, `fines`, `events`, `transactions`), avoiding generic or vague labels.
- [ ] **No Page Overflow**: Table footer remains responsive (`flex-col sm:flex-row`) and uses ellipsis when page counts are high.
- [ ] **Exact Slicing**: Slicing formula matches: `(currentPage - 1) * PER_PAGE` to `start + PER_PAGE`.
- [ ] **Zero State Cohesion**: Empty table states show `Showing 0 [items]` with Previous and Next disabled.
