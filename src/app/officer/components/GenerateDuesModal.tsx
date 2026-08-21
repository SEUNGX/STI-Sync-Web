import { useState } from 'react';
import { X, Loader2, Users, Check, Calendar } from 'lucide-react';
import { useSemesters } from '../../modules/academic/hooks/useAcademicStream';
import { useOrgMembers } from '../../modules/organizations/hooks/useOrgMembers';
import { generateMembershipDues } from '../../modules/finance/services/payable.service';
import { formatCurrency } from '../../utils/currency';

interface GenerateDuesModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  organizationName: string;
  addedBy: string;
}

export function GenerateDuesModal({
  isOpen,
  onClose,
  organizationId,
  organizationName,
  addedBy,
}: GenerateDuesModalProps) {
  const { data: semesters = [] } = useSemesters();
  const activeSemester = semesters.find((s) => s.status === 'ACTIVE') || semesters[0];
  const { members = [], loading: loadingMembers } = useOrgMembers(organizationId);

  const [selectedSemId, setSelectedSemId] = useState<string>(activeSemester?.id || '');
  const [membershipFee, setMembershipFee] = useState<number>(50);
  const [targetMode, setTargetMode] = useState<'all' | 'select'>('all');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const activeMembers = members.filter((m) => m.status === 'active');

  const toggleMemberSelection = (id: string) => {
    if (selectedMemberIds.includes(id)) {
      setSelectedMemberIds(selectedMemberIds.filter((mId) => mId !== id));
    } else {
      setSelectedMemberIds([...selectedMemberIds, id]);
    }
  };

  const handleSelectAllFiltered = () => {
    const filteredIds = filteredMembers.map((m) => m.studentId || m.id);
    const allSelected = filteredIds.every((id) => selectedMemberIds.includes(id));
    if (allSelected) {
      setSelectedMemberIds(selectedMemberIds.filter((id) => !filteredIds.includes(id)));
    } else {
      const combined = new Set([...selectedMemberIds, ...filteredIds]);
      setSelectedMemberIds(Array.from(combined));
    }
  };

  const filteredMembers = activeMembers.filter(
    (m) =>
      (m.studentName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.studentId || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const semId = selectedSemId || activeSemester?.id;
    if (!semId) {
      alert('Please select a valid semester.');
      return;
    }

    if (targetMode === 'select' && selectedMemberIds.length === 0) {
      alert('Please select at least one member.');
      return;
    }

    setIsSubmitting(true);

    try {
      const count = await generateMembershipDues({
        organizationId,
        organizationName,
        semesterId: semId,
        membershipFee: Number(membershipFee) || 50,
        memberIds: targetMode === 'all' ? 'all' : selectedMemberIds,
        dueDate: dueDate ? new Date(dueDate) : null,
        createdBy: addedBy,
      });

      alert(`Successfully generated membership dues for ${count} member(s).`);
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(`Failed to generate dues: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-[540px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-[#001A4D] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Users className="w-5 h-5 text-[#FFD41C]" />
            <h2 className="font-semibold text-lg">Generate Membership Dues</h2>
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
        <form id="generate-dues-form" onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target Semester *</label>
            <select
              value={selectedSemId || activeSemester?.id}
              onChange={(e) => setSelectedSemId(e.target.value)}
              className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] outline-none"
            >
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} ({s.status})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Membership Fee (₱) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={membershipFee}
                onChange={(e) => setMembershipFee(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date (Optional)</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] outline-none"
              />
            </div>
          </div>

          {/* Member Scope Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Assign Dues To *</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTargetMode('all')}
                className={`p-3 rounded-xl border text-left flex items-start justify-between transition-colors cursor-pointer ${
                  targetMode === 'all'
                    ? 'border-[#0E4EBD] bg-blue-50 text-[#0E4EBD] font-bold'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div>
                  <p className="font-bold text-sm">All Active Members</p>
                  <p className="text-xs text-gray-500 mt-0.5">{activeMembers.length} active member(s)</p>
                </div>
                {targetMode === 'all' && <Check className="w-4 h-4 text-[#0E4EBD]" />}
              </button>

              <button
                type="button"
                onClick={() => setTargetMode('select')}
                className={`p-3 rounded-xl border text-left flex items-start justify-between transition-colors cursor-pointer ${
                  targetMode === 'select'
                    ? 'border-[#0E4EBD] bg-blue-50 text-[#0E4EBD] font-bold'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div>
                  <p className="font-bold text-sm">Select Specific Members</p>
                  <p className="text-xs text-gray-500 mt-0.5">{selectedMemberIds.length} selected</p>
                </div>
                {targetMode === 'select' && <Check className="w-4 h-4 text-[#0E4EBD]" />}
              </button>
            </div>
          </div>

          {/* Selective Checklist */}
          {targetMode === 'select' && (
            <div className="border border-[#E0E0E0] rounded-xl p-3 bg-gray-50/50 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  placeholder="Search members..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs outline-none bg-white focus:ring-2 focus:ring-[#0E4EBD]/30"
                />
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="px-2.5 py-1 text-xs text-[#0E4EBD] font-bold hover:underline flex-shrink-0 cursor-pointer"
                >
                  Select All Filtered
                </button>
              </div>

              <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
                {loadingMembers ? (
                  <p className="text-xs text-gray-500 text-center py-4">Loading members...</p>
                ) : filteredMembers.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-4">No members found</p>
                ) : (
                  filteredMembers.map((m) => {
                    const id = m.studentId || m.id;
                    const isChecked = selectedMemberIds.includes(id);
                    return (
                      <div
                        key={m.id}
                        onClick={() => toggleMemberSelection(id)}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                          isChecked ? 'bg-blue-50 border border-blue-200 text-[#001A4D]' : 'bg-white border border-gray-100 hover:bg-gray-50'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-semibold text-[#001A4D]">{m.studentName}</p>
                          <p className="text-[11px] text-gray-400">{m.studentId} • {m.course}</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // handled by div onClick
                          className="w-4 h-4 text-[#0E4EBD] rounded focus:ring-[#0E4EBD] accent-[#0E4EBD]"
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Summary Box */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 space-y-1">
            <p className="font-semibold">Summary:</p>
            <p>
              • Assigning {formatCurrency(membershipFee)} membership fee to{' '}
              {targetMode === 'all' ? `${activeMembers.length} member(s)` : `${selectedMemberIds.length} selected member(s)`}.
            </p>
            <p>• Deduplication active: members who already have dues for this semester will be skipped automatically.</p>
          </div>
        </form>

        {/* Footer */}
        <div className="border-t border-[#E0E0E0] px-6 py-4 bg-gray-50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="generate-dues-form"
            disabled={isSubmitting}
            className="px-5 py-2 text-sm font-bold text-white bg-[#001A4D] hover:bg-[#0E4EBD] rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-xs"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSubmitting ? 'Generating...' : 'Generate Dues'}
          </button>
        </div>
      </div>
    </div>
  );
}
