import { useState } from 'react';
import { Download, Send, RotateCcw, Archive, Eye } from 'lucide-react';
import { StudentDocument } from '../../../modules/students/types/student.types';
import { formatTimestampDate } from '../../../modules/students/utils/date.utils';

interface InactiveSuspendedProps {
  inactiveStudents: StudentDocument[];
  suspendedStudents: StudentDocument[];
}

export default function InactiveSuspended({ inactiveStudents, suspendedStudents }: InactiveSuspendedProps) {
  const [activeTab, setActiveTab] = useState<'inactive' | 'suspended'>('inactive');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#001A4D]">Inactive & Suspended Accounts</h2>
          <p className="text-sm text-gray-500">Dashboard → Student Registry → Inactive & Suspended</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-6 py-2.5 border-2 border-green-500 text-green-600 rounded-lg font-medium hover:bg-green-50 flex items-center gap-2">
            Bulk Reactivate
          </button>
          <button className="px-6 py-2.5 bg-[#001A4D] text-white rounded-lg font-medium hover:bg-[#001A4D]/90 flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export List
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveTab('inactive')}
          className={`px-6 py-2 rounded-lg font-medium ${
            activeTab === 'inactive'
              ? 'bg-gray-500 text-white'
              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          Inactive <span className="ml-2 px-2 py-0.5 bg-white/20 rounded">{inactiveStudents.length}</span>
        </button>
        <button
          onClick={() => setActiveTab('suspended')}
          className={`px-6 py-2 rounded-lg font-medium ${
            activeTab === 'suspended'
              ? 'bg-gradient-to-r from-[#EF4444] to-[#F97316] text-white'
              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          Suspended <span className="ml-2 px-2 py-0.5 bg-white/20 rounded">{suspendedStudents.length}</span>
        </button>
      </div>

      {/* Inactive Tab */}
      {activeTab === 'inactive' && (
        <div className="space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="text-sm text-gray-700">
              These students did not confirm re-enrollment before the semester deadline. Their accounts are preserved but they cannot log in. They can be reactivated manually or will reactivate automatically when they confirm re-enrollment next semester.
            </p>
          </div>

          <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Student</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Course & Year</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Inactive Since</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {inactiveStudents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">No inactive students found.</td>
                  </tr>
                ) : inactiveStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gray-400 rounded-full flex items-center justify-center text-white font-bold text-xs">
                          {student.firstName.charAt(0)}{student.lastName.charAt(0)}
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
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {formatTimestampDate(student.updatedAt)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-gray-500 text-white rounded-full text-xs font-medium">
                        Inactive
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button className="px-3 py-1.5 bg-[#0E4EBD] text-white rounded text-xs font-medium flex items-center gap-1">
                          <Send className="w-3 h-3" />
                          Send Re-enrollment Link
                        </button>
                        <button className="px-3 py-1.5 border-2 border-green-500 text-green-600 rounded text-xs font-medium flex items-center gap-1">
                          <RotateCcw className="w-3 h-3" />
                          Reactivate
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Suspended Tab */}
      {activeTab === 'suspended' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm text-amber-900">
              These accounts have been manually suspended by the SAO Adviser. Suspended students cannot log in and are notified of their suspension status and reason.
            </p>
          </div>

          <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Student</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Course & Year</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Suspended On</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Suspended By</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Reason</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Duration</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {suspendedStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">No suspended students found.</td>
                  </tr>
                ) : suspendedStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-[#EF4444] to-[#F97316] rounded-full flex items-center justify-center text-white font-bold text-xs">
                          {student.firstName.charAt(0)}{student.lastName.charAt(0)}
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
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {formatTimestampDate(student.updatedAt)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">SAO Admin</td>
                    <td className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate">{student.rejectionReason || 'No reason provided'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium bg-red-500 text-white`}>
                        Indefinite
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button className="px-3 py-1.5 text-[#0E4EBD] hover:underline text-xs">
                          View Details
                        </button>
                        <button className="px-3 py-1.5 border-2 border-green-500 text-green-600 rounded text-xs font-medium">
                          Lift Suspension
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
