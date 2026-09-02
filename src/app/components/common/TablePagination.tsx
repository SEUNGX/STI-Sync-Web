import React from "react";

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
  /** Human-readable noun for items (e.g. "students", "events", "collections", "records") */
  itemName?: string;
  /** Optional custom CSS class for the bottom bar container */
  className?: string;
  /** Optional array of page size choices (e.g. [8, 10, 25, 50]) */
  pageSizeOptions?: number[];
  /** Optional callback when page size changes */
  onPageSizeChange?: (newSize: number) => void;
}

/**
 * Standard System-Wide Table Pagination Component
 * 
 * Provides consistent layout, styling, counter phrasing, and navigation
 * across all STI-Sync Admin, Officer, and Adviser tables.
 * 
 * Reference Documentation: `docs/table-pagination-standard.md`
 */
export function TablePagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  itemName = "records",
  className = "",
  pageSizeOptions,
  onPageSizeChange,
}: TablePaginationProps) {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  // Compute page numbers with ellipsis windowing
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | "...")[] = [];
    const showPrevEllipsis = currentPage > 3;
    const showNextEllipsis = currentPage < totalPages - 2;

    pages.push(1);

    if (showPrevEllipsis) {
      pages.push("...");
    }

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      if (!pages.includes(i)) {
        pages.push(i);
      }
    }

    if (showNextEllipsis) {
      pages.push("...");
    }

    if (!pages.includes(totalPages)) {
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div
      className={`p-3.5 bg-gray-50/60 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500 ${className}`}
    >
      {/* Left: Item Counter & Page Size Selector */}
      <div className="flex items-center gap-3">
        {totalItems === 0 ? (
          <span>Showing 0 {itemName}</span>
        ) : (
          <span>
            Showing <strong className="text-gray-900 font-bold">{startItem}</strong> to{" "}
            <strong className="text-gray-900 font-bold">{endItem}</strong> of{" "}
            <strong className="text-gray-900 font-bold">{totalItems}</strong> {itemName}
          </span>
        )}

        {pageSizeOptions && onPageSizeChange && (
          <div className="flex items-center gap-1.5 ml-2 pl-3 border-l border-gray-200">
            <span className="text-gray-500 text-xs">Per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="bg-white border border-gray-200 rounded-md px-2 py-1 text-xs text-gray-700 font-medium focus:ring-2 focus:ring-[#001A4D] outline-none cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: Previous, Page Numbers, Next */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed font-semibold transition-colors cursor-pointer text-xs"
        >
          Previous
        </button>

        {pageNumbers.map((p, idx) => {
          if (p === "...") {
            return (
              <span key={`ellipsis-${idx}`} className="text-gray-400 text-xs px-1 select-none">
                ...
              </span>
            );
          }

          const isActive = currentPage === p;
          return (
            <button
              type="button"
              key={p}
              onClick={() => onPageChange(p)}
              className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                isActive
                  ? "bg-[#001A4D] text-white shadow-xs"
                  : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              {p}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages || totalPages === 0}
          className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed font-semibold transition-colors cursor-pointer text-xs"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default TablePagination;
