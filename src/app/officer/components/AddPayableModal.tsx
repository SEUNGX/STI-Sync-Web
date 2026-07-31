import { useState } from 'react';
import { X, Loader2, Plus, Check } from 'lucide-react';
import { useSemesters } from '../../modules/academic/hooks/useAcademicStream';
import { useOrgMembers } from '../../modules/organizations/hooks/useOrgMembers';
import { createPayable } from '../../modules/finance/services/payable.service';
import type { PayableType } from '../../modules/finance/types/payable.types';

interface AddPayableModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  organizationName: string;
  addedBy: string;
}

export function AddPayableModal({
  isOpen,
  onClose,
  organizationId,
  organizationName,
  addedBy,
}: AddPayableModalProps) {
  const { data: semesters = [] } = useSemesters();
  const activeSemester = semesters.find((s) => s.status === 'ACTIVE') || semesters[0];
  const { members = [], loading: loadingMembers } = useOrgMembers(organizationId);

  const [selectedSemId, setSelectedSemId] = useState<string>(activeSemester?.id || '');
  const [payableType, setPayableType] = useState<PayableType>('custom');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [dueDate, setDueDate] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const activeMembers = (members || []).filter((m) => m && m.status === 'active');
  const filteredMembers = activeMembers.filter(
    (m) =>
      (m.studentName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.studentId || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleMemberSelection = (id: string) => {
    if (selectedMemberIds.includes(id)) {
      setSelectedMemberIds(selectedMemberIds.filter((mId) => mId !== id));
    } else {
      setSelectedMemberIds([...selectedMemberIds, id]);
    }
  };

  const handleSelectAll = () => {
    if (selectedMemberIds.length === activeMembers.length) {
      setSelectedMemberIds([]);
    } else {
      setSelectedMemberIds(activeMembers.map((m) => m.studentId || m.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!label.trim()) {
      alert('Payable label is required.');
      return;
    }

    if (!amount || Number(amount) <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    if (selectedMemberIds.length === 0) {
      alert('Please select at least one member to assign this payable.');
      return;
    }

    const semId = selectedSemId || activeSemester?.id;
    if (!semId) {
      alert('Please select a valid semester.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Find selected member objects
      const targetMembers = activeMembers.filter((m) =>
        selectedMemberIds.includes(m.studentId || m.id)
      );

      for (const m of targetMembers) {
        await createPayable({
          studentId: m.studentId || m.id,
          studentName: m.studentName,
          studentSchoolId: m.studentId,
          type: payableType,
          label: label.trim(),
          description: description.trim(),
          organizationId,
          organizationName,
          semesterId: semId,
          assignedAmount: Number(amount),
          dueDate: dueDate ? new Date(dueDate) : null,
          createdBy: addedBy,
        });
      }

      alert(`Successfully created payable "${label}" for ${targetMembers.length} member(s).`);
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(`Failed to create payable: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-[560px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-[#001A4D] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Plus className="w-5 h-5 text-[#FFD41C]" />
            <h2 className="font-semibold text-lg">Add Student Payable</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-white/70 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form id="add-payable-form" onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payable Type *</label>
              <select
                value={payableType}
                onChange={(e) => setPayableType(e.target.value as PayableType)}
                className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] outline-none"
              >
                <option value="custom">Custom Fee (T-Shirt, Trip, etc.)</option>
                <option value="org_fine">Organization Fine</option>
                <option value="event_fee">Event Fee</option>
                <option value="membership_due">Membership Due</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Semester *</label>
              <select
                value={selectedSemId || activeSemester?.id}
                onChange={(e) => setSelectedSemId(e.target.value)}
                className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] outline-none"
              >
                {semesters.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} ({s.status})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payable Title / Label *</label>
            <input
              type="text"
              required
              placeholder="e.g. Annual T-Shirt Fee, Late Assembly Fine"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Amount (₱) *</label>
              <input
                type="number"
                min="1"
                step="0.01"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date (Optional)</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description / Reason</label>
            <textarea
              rows={2}
              placeholder="Provide context or explanation for this payable..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] outline-none resize-none"
            />
          </div>

          {/* Member Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-700">Assign To Members * ({selectedMemberIds.length} selected)</label>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs text-[#83358E] font-semibold hover:underline"
              >
                {selectedMemberIds.length === activeMembers.length ? 'Deselect All' : 'Select All Members'}
              </button>
            </div>

            <div className="border border-[#E0E0E0] rounded-xl p-3 bg-gray-50/50 space-y-2">
              <input
                type="text"
                placeholder="Search member by name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs outline-none bg-white"
              />

              <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                {loadingMembers ? (
                  <p className="text-xs text-gray-500 text-center py-4">Loading members...</p>
                ) : filteredMembers.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-4">No matching members found</p>
                ) : (
                  filteredMembers.map((m) => {
                    const id = m.studentId || m.id;
                    const isChecked = selectedMemberIds.includes(id);
                    return (
                      <div
                        key={m.id}
                        onClick={() => toggleMemberSelection(id)}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                          isChecked ? 'bg-[#F3E8FF] border border-[#83358E]/30' : 'bg-white border border-gray-100 hover:bg-gray-50'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-semibold text-[#001A4D]">{m.studentName}</p>
                          <p className="text-[11px] text-gray-400">{m.studentId} • {m.course}</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="w-4 h-4 text-[#83358E] rounded focus:ring-[#83358E]"
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="border-t border-[#E0E0E0] px-6 py-4 bg-gray-50 flex justify-end gap-3">
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
            form="add-payable-form"
            disabled={isSubmitting}
            className="px-5 py-2 text-sm font-bold text-white bg-[#83358E] rounded-lg hover:bg-[#6D2A78] transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSubmitting ? 'Creating...' : `Create Payable (${selectedMemberIds.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
