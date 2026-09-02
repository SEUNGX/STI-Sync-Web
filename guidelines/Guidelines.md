# STI-Sync System Guidelines

## 1. Table Pagination Standards
Whenever a table is formed or refactored in any page across the system (Admin, Officer, Adviser portals):
* **Component**: Always use the standardized `<TablePagination />` from `src/app/components/common/TablePagination.tsx`.
* **Specification Document**: Reference and strictly follow `docs/table-pagination-standard.md`.
* **Visual Format**: 
  - Left: `Showing [Start] to [End] of [Total] [Item Noun]` (e.g. "Showing 1 to 8 of 25 collection groups").
  - Right: Previous button, active/inactive page buttons (`#001A4D` Navy active state), ellipsis `...` for > 7 pages, Next button.
* **State Management**:
  - Always reset `currentPage` to `1` when filters or search inputs change (`useEffect(() => setCurrentPage(1), [searchQuery, filter])`).
  - Slicing formula: `items.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE)`.
  - Disable Previous on page 1; disable Next on `currentPage === totalPages || totalPages === 0`.

