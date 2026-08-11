import { useState } from 'react';
import { Search, Plus, Download, Eye, MoreVertical } from 'lucide-react';
import AddStudentManuallyModal from './AddStudentManuallyModal';
import { StudentDocument } from '../../../modules/students/types/student.types';
import { formatTimestampDate } from '../../../modules/students/utils/date.utils';

interface ActiveStudentsProps {
  students: StudentDocument[];
}

export default function ActiveStudents({ students: activeStudents }: ActiveStudentsProps) {
  const [showAddModal, setShowAddModal] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#001A4D]">Active Students</h2>
          <p className="text-sm text-gray-500">Dashboard → Student Registry → Active Students</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium">
            Import Students (CSV)
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-2.5 bg-[#83358E] text-white rounded-lg font-medium hover:bg-[#83358E]/90 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Student Manually
          </button>
          <button className="px-6 py-2.5 bg-[#001A4D] text-white rounded-lg font-medium hover:bg-[#001A4D]/90 flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export Directory
          </button>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <div className="grid grid-cols-4 gap-6">
          <div className="flex items-center gap-4 border-r border-gray-200">
            <div>
              <div className="text-3xl font-bold text-[#001A4D]">{activeStudents.length}</div>
              <div className="text-sm text-gray-500">Total Active Students</div>
            </div>
          </div>
          <div className="flex items-center gap-4 border-r border-gray-200">
            <div>
              <div className="text-3xl font-bold text-green-600">+45</div>
              <div className="text-sm text-gray-500">New This Semester</div>
            </div>
          </div>
          <div className="flex items-center gap-4 border-r border-gray-200">
            <div>
              <div className="text-3xl font-bold text-[#83358E]">87%</div>
              <div className="text-sm text-gray-500">Avg Attendance Rate</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <div className="text-3xl font-bold text-red-600">23</div>
              <div className="text-sm text-gray-500">Outstanding Fines</div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="search"
              placeholder="Search by name, student ID, or organization..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <select className="px-4 py-2 border border-gray-300 rounded-lg">
            <option>All Courses</option>
            <option>BSIT</option>
            <option>BSCS</option>
            <option>BSA</option>
          </select>
          <select className="px-4 py-2 border border-gray-300 rounded-lg">
            <option>All Year Levels</option>
            <option>1st Year</option>
            <option>2nd Year</option>
            <option>3rd Year</option>
            <option>4th Year</option>
          </select>
          <select className="px-4 py-2 border border-gray-300 rounded-lg">
            <option>All Sections</option>
            <option>Section A</option>
            <option>Section B</option>
          </select>
        </div>
      </div>

      {/* Active Students Table */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input type="checkbox" className="rounded text-[#83358E]" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Student</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Course & Year</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Section</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Organizations</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Payment Status</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Last Active</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {activeStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">No active students found.</td>
                </tr>
              ) : activeStudents.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <input type="checkbox" className="rounded text-[#83358E]" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-gradient-to-br from-[#0E4EBD] to-[#83358E] rounded-full flex items-center justify-center text-white font-bold text-xs uppercase overflow-hidden">
                        {student.profilePhotoUrl ? (
                          <img 
                            src={student.profilePhotoUrl} 
                            alt="Profile" 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent((student.firstName || '') + ' ' + (student.lastName || ''))}&background=83358E&color=fff`;
                            }}
                          />
                        ) : (
                          `${student.firstName?.[0] || ''}${student.lastName?.[0] || ''}`
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-[#001A4D]">{student.firstName} {student.lastName}</div>
                        <div className="text-xs text-gray-500">{student.studentId}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{student.courseCode}</div>
                    <div className="text-xs text-gray-500">{student.yearLevel}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{student.section}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {/* Temporary mock for orgs since it's not in schema yet */}
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">None</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {/* Temporary mock for payment */}
                    <span className="px-3 py-1 bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white rounded-full text-xs font-medium">
                      Paid
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatTimestampDate(student.updatedAt)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button className="p-2 text-[#0E4EBD] hover:bg-[#0E4EBD]/10 rounded">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-gray-600 hover:bg-gray-100 rounded">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Student Manually Modal */}
      {showAddModal && (
        <AddStudentManuallyModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
