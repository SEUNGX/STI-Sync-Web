import { useState } from 'react';
import { X, Search, Loader2 } from 'lucide-react';
import { useStudents } from '../../modules/students/hooks/useStudentStream';
import { addMember } from '../../modules/organizations/services/member.service';
import type { AddMemberPayload } from '../../modules/organizations/types/member.types';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  addedBy: string; // The studentId of the officer adding them
}

export function AddMemberModal({ isOpen, onClose, organizationId, addedBy }: AddMemberModalProps) {
  const { data: allStudents, loading: loadingStudents } = useStudents();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    studentId: '',
    studentName: '',
    email: '',
    course: '',
    year: '',
    department: '',
    contactNumber: '',
    paymentStatus: 'outstanding' as 'paid' | 'outstanding',
  });

  if (!isOpen) return null;

  const handleSelectStudent = (student: any) => {
    setFormData({
      ...formData,
      studentId: student.studentId,
      studentName: `${student.firstName} ${student.lastName}`,
      email: student.email,
      course: student.courseCode || '',
      year: student.yearLevel || '',
      department: student.department || '', // Assuming these exist, if not they can be edited manually
    });
    setSearchQuery('');
    setShowDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.studentId || !formData.studentName) {
      alert('Student ID and Name are required.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const payload: AddMemberPayload = {
        ...formData,
        organizationId,
        status: 'active',
      };
      
      await addMember(payload, addedBy);
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to add member. Check console for details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-[500px] shadow-2xl flex flex-col max-h-[90vh]">
        <div className="bg-[#001A4D] px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg">Add New Member</h2>
          <button onClick={onClose} disabled={isSubmitting} className="text-white hover:bg-white/10 rounded-lg p-1.5 transition-colors disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {/* Search Bar */}
          <div className="mb-6 relative">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Search Registered Students</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or ID to auto-fill..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                className="w-full pl-9 pr-4 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:ring-2 focus:ring-[#1E70E8] focus:border-transparent outline-none"
              />
            </div>

            {/* Dropdown */}
            {showDropdown && searchQuery.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#E0E0E0] rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                {loadingStudents ? (
                  <div className="p-3 text-sm text-gray-500 text-center">Loading...</div>
                ) : (
                  (() => {
                    const query = searchQuery.toLowerCase();
                    const matches = allStudents.filter(s =>
                      `${s.firstName} ${s.lastName}`.toLowerCase().includes(query) ||
                      s.studentId.toLowerCase().includes(query)
                    ).slice(0, 5);

                    if (matches.length === 0) {
                      return <div className="p-3 text-sm text-gray-500 text-center">No students found</div>;
                    }

                    return matches.map(s => (
                      <div
                        key={s.id}
                        onClick={() => handleSelectStudent(s)}
                        className="px-4 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
                      >
                        <div className="font-medium text-[#001A4D] text-sm">{s.firstName} {s.lastName}</div>
                        <div className="text-xs text-gray-500">{s.studentId} • {s.courseCode}</div>
                      </div>
                    ));
                  })()
                )}
              </div>
            )}
          </div>

          <form id="add-member-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Student ID *</label>
                <input
                  type="text"
                  required
                  value={formData.studentId}
                  onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                  className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:ring-2 focus:ring-[#1E70E8]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.studentName}
                  onChange={(e) => setFormData({ ...formData, studentName: e.target.value })}
                  className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:ring-2 focus:ring-[#1E70E8]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:ring-2 focus:ring-[#1E70E8]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
                <input
                  type="text"
                  value={formData.course}
                  onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                  className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:ring-2 focus:ring-[#1E70E8]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year Level</label>
                <input
                  type="text"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:ring-2 focus:ring-[#1E70E8]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:ring-2 focus:ring-[#1E70E8]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number</label>
                <input
                  type="text"
                  value={formData.contactNumber}
                  onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:ring-2 focus:ring-[#1E70E8]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Membership Dues</label>
              <select
                value={formData.paymentStatus}
                onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value as 'paid' | 'outstanding' })}
                className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:ring-2 focus:ring-[#1E70E8]"
              >
                <option value="outstanding">Outstanding</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </form>
        </div>

        <div className="border-t border-[#E0E0E0] px-6 py-4 bg-gray-50 rounded-b-2xl flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="add-member-form"
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-bold text-white bg-[#0E4EBD] rounded-lg hover:bg-[#0E4EBD]/90 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSubmitting ? 'Adding...' : 'Add Member'}
          </button>
        </div>
      </div>
    </div>
  );
}
