import { Search, Filter, RotateCcw, FileSpreadsheet, Layers, School, BookOpen, Users } from 'lucide-react';
import type { AttendanceFilterState } from '../types/attendance.types';

interface AttendanceFilterToolbarProps {
  filters: AttendanceFilterState;
  onFilterChange: (updates: Partial<AttendanceFilterState>) => void;
  onReset: () => void;
  departments: { id: string; name: string; code: string }[];
  sections: string[];
  courses?: { id: string; name: string; code: string }[];
  sessions?: { id: string; title: string }[];
  onExportClick: () => void;
  totalCount: number;
  filteredCount: number;
}

const YEAR_LEVEL_OPTIONS = ['All', '1st Year', '2nd Year', '3rd Year', '4th Year', 'G11', 'G12'];
const STATUS_OPTIONS = [
  { id: 'all', label: 'All Statuses' },
  { id: 'Complete', label: 'Complete / Present' },
  { id: 'Checked In', label: 'Checked In' },
  { id: 'Checked Out', label: 'Checked Out' },
  { id: 'Late', label: 'Late' },
  { id: 'Absent', label: 'Absent' },
  { id: 'Flagged', label: 'Flagged' },
];

export function AttendanceFilterToolbar({
  filters,
  onFilterChange,
  onReset,
  departments,
  sections,
  courses,
  sessions,
  onExportClick,
  totalCount,
  filteredCount,
}: AttendanceFilterToolbarProps) {
  const hasActiveFilters =
    filters.searchQuery.trim() !== '' ||
    filters.departmentId !== 'all' ||
    filters.courseId !== 'all' ||
    filters.section !== 'all' ||
    filters.yearLevel !== 'all' ||
    filters.sessionId !== 'all' ||
    filters.status !== 'all';

  return (
    <div className="bg-white border border-[#E0E0E0] rounded-2xl p-4 shadow-sm space-y-4">
      {/* Top Row — Search Bar + Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <input
            type="text"
            placeholder="Search by student name, ID, section, course..."
            value={filters.searchQuery}
            onChange={(e) => onFilterChange({ searchQuery: e.target.value })}
            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#83358E] focus:border-transparent focus:bg-white outline-none transition-all"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>

        {/* Counter badge & Actions */}
        <div className="flex items-center gap-2">
          <div className="text-xs font-semibold px-3 py-2 bg-purple-50 text-[#83358E] border border-purple-200 rounded-xl">
            Showing <strong>{filteredCount}</strong> of <strong>{totalCount}</strong> records
          </div>

          {hasActiveFilters && (
            <button
              onClick={onReset}
              className="px-3 py-2 border border-gray-300 text-gray-600 rounded-xl text-xs font-semibold hover:bg-gray-100 transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Filters
            </button>
          )}

          <button
            onClick={onExportClick}
            disabled={filteredCount === 0}
            className="px-4 py-2.5 bg-[#83358E] text-white rounded-xl text-xs font-bold hover:bg-[#6D2A78] disabled:opacity-50 transition-all flex items-center gap-2 shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#FFC107]" />
            Export to Excel
          </button>
        </div>
      </div>

      {/* Bottom Row — Dropdown Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 pt-2 border-t border-gray-100">
        {/* Department Filter */}
        <div>
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
            <School className="w-3 h-3 text-[#83358E]" />
            Department
          </label>
          <select
            value={filters.departmentId}
            onChange={(e) => onFilterChange({ departmentId: e.target.value })}
            className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs font-medium text-[#001A4D] focus:ring-1 focus:ring-[#83358E] focus:bg-white outline-none"
          >
            <option value="all">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code ? `${d.code} — ${d.name}` : d.name}
              </option>
            ))}
          </select>
        </div>

        {/* Section Filter */}
        <div>
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Layers className="w-3 h-3 text-[#83358E]" />
            Section
          </label>
          <select
            value={filters.section}
            onChange={(e) => onFilterChange({ section: e.target.value })}
            className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs font-medium text-[#001A4D] focus:ring-1 focus:ring-[#83358E] focus:bg-white outline-none"
          >
            <option value="all">All Sections</option>
            {sections.map((sec) => (
              <option key={sec} value={sec}>
                {sec}
              </option>
            ))}
          </select>
        </div>

        {/* Course Filter */}
        {courses && courses.length > 0 && (
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <BookOpen className="w-3 h-3 text-[#83358E]" />
              Course / Program
            </label>
            <select
              value={filters.courseId}
              onChange={(e) => onFilterChange({ courseId: e.target.value })}
              className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs font-medium text-[#001A4D] focus:ring-1 focus:ring-[#83358E] focus:bg-white outline-none"
            >
              <option value="all">All Courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code || c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Year Level Filter */}
        <div>
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Users className="w-3 h-3 text-[#83358E]" />
            Year Level
          </label>
          <select
            value={filters.yearLevel}
            onChange={(e) => onFilterChange({ yearLevel: e.target.value })}
            className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs font-medium text-[#001A4D] focus:ring-1 focus:ring-[#83358E] focus:bg-white outline-none"
          >
            {YEAR_LEVEL_OPTIONS.map((y) => (
              <option key={y} value={y === 'All' ? 'all' : y}>
                {y === 'All' ? 'All Year Levels' : y}
              </option>
            ))}
          </select>
        </div>

        {/* Session Filter */}
        {sessions && sessions.length > 0 && (
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-[#83358E]" />
              Event Session
            </label>
            <select
              value={filters.sessionId}
              onChange={(e) => onFilterChange({ sessionId: e.target.value })}
              className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs font-medium text-[#001A4D] focus:ring-1 focus:ring-[#83358E] focus:bg-white outline-none"
            >
              <option value="all">All Sessions</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Attendance Status Filter */}
        <div>
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Filter className="w-3 h-3 text-[#83358E]" />
            Status
          </label>
          <select
            value={filters.status}
            onChange={(e) => onFilterChange({ status: e.target.value })}
            className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs font-medium text-[#001A4D] focus:ring-1 focus:ring-[#83358E] focus:bg-white outline-none"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
