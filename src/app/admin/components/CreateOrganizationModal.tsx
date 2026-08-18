import { useState } from 'react';
import { X, Upload, Crown, Star, FileText, Calculator, ClipboardCheck, Users, Plus, Mail, Lock, Eye, EyeOff, Building, ChevronDown, Check, ArrowRight, ArrowLeft, Search } from 'lucide-react';

interface CreateOrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface OfficerAssignment {
  role: string;
  studentName?: string;
  studentId?: string;
  email?: string;
  password?: string;
  avatar?: string;
}

export default function CreateOrganizationModal({ isOpen, onClose }: CreateOrganizationModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [showCredentials, setShowCredentials] = useState(false);
  const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({});
  const [confirmed, setConfirmed] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    type: '',
    department: '',
    acronym: '',
    schoolYear: '',
    description: '',
    logo: null as File | null,
  });

  const [officers, setOfficers] = useState<OfficerAssignment[]>([
    { role: 'President' },
    { role: 'Vice President' },
    { role: 'Secretary' },
    { role: 'Treasurer' },
    { role: 'Auditor' },
    { role: 'P.R.O.' },
  ]);

  const assignedOfficers = officers.filter(o => o.studentName);
  const hasPresident = officers.find(o => o.role === 'President' && o.studentName);

  if (!isOpen) return null;

  const handleAssignOfficer = (role: string, student: { name: string; id: string; email: string }) => {
    setOfficers(officers.map(o =>
      o.role === role
        ? { ...o, studentName: student.name, studentId: student.id, email: student.email, password: 'TempPass123!', avatar: student.name.split(' ').map(n => n[0]).join('') }
        : o
    ));
  };

  const handleRemoveOfficer = (role: string) => {
    setOfficers(officers.map(o =>
      o.role === role
        ? { role: o.role }
        : o
    ));
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'President': return Crown;
      case 'Vice President': return Star;
      case 'Secretary': return FileText;
      case 'Treasurer': return Calculator;
      case 'Auditor': return ClipboardCheck;
      case 'P.R.O.': return Users;
      default: return Users;
    }
  };

  const renderStepIndicator = () => {
    const steps = [
      { number: 1, label: 'Organization Details' },
      { number: 2, label: 'Assign Officers' },
      { number: 3, label: 'Review & Confirm' },
    ];

    return (
      <div className="flex items-center justify-center gap-2 py-6 border-b border-gray-200">
        {steps.map((step, idx) => (
          <div key={step.number} className="flex items-center">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                currentStep > step.number
                  ? 'bg-[#0E4EBD] text-white'
                  : currentStep === step.number
                  ? 'bg-[#FFC107] text-[#001A4D]'
                  : 'bg-[#E0E0E0] text-gray-500'
              }`}>
                {currentStep > step.number ? <Check className="w-4 h-4" /> : step.number}
              </div>
              <span className={`text-sm font-medium ${
                currentStep === step.number ? 'text-[#001A4D]' : 'text-gray-500'
              }`}>
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`w-16 h-0.5 mx-3 ${
                currentStep > step.number ? 'bg-[#0E4EBD]' : 'bg-[#E0E0E0]'
              }`} />
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderStep1 = () => (
    <div className="p-6 space-y-6">
      <div className="border-l-4 border-[#FFC107] pl-4">
        <h3 className="text-[#001A4D] font-bold text-lg">Organization Details</h3>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Organization Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter organization name"
            className="w-full px-4 py-2.5 border border-[#E0E0E0] rounded-lg focus:ring-2 focus:ring-[#1E70E8] focus:border-transparent"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Organization Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full px-4 py-2.5 border border-[#E0E0E0] rounded-lg focus:ring-2 focus:ring-[#1E70E8] focus:border-transparent"
            >
              <option value="">Select type</option>
              <option value="Academic">Academic</option>
              <option value="Civic">Civic</option>
              <option value="Cultural">Cultural</option>
              <option value="Religious">Religious</option>
              <option value="Sports">Sports</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Academic Department</label>
            <select
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              className="w-full px-4 py-2.5 border border-[#E0E0E0] rounded-lg focus:ring-2 focus:ring-[#1E70E8] focus:border-transparent"
            >
              <option value="">Select department</option>
              <option value="BSIT">BSIT</option>
              <option value="BSBA">BSBA</option>
              <option value="BSHM">BSHM</option>
              <option value="BSCRIM">BSCRIM</option>
              <option value="Cross-Departmental">Cross-Departmental</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Organization Acronym</label>
            <input
              type="text"
              value={formData.acronym}
              onChange={(e) => setFormData({ ...formData, acronym: e.target.value.toUpperCase() })}
              placeholder="e.g. ITG"
              className="w-full px-4 py-2.5 border border-[#E0E0E0] rounded-lg focus:ring-2 focus:ring-[#1E70E8] focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">School Year</label>
            <select
              value={formData.schoolYear}
              onChange={(e) => setFormData({ ...formData, schoolYear: e.target.value })}
              className="w-full px-4 py-2.5 border border-[#E0E0E0] rounded-lg focus:ring-2 focus:ring-[#1E70E8] focus:border-transparent"
            >
              <option value="">Select school year</option>
              <option value="2025–2026">2025–2026</option>
              <option value="2026–2027">2026–2027</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Organization Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Enter organization description"
            rows={3}
            className="w-full px-4 py-2.5 border border-[#E0E0E0] rounded-lg focus:ring-2 focus:ring-[#1E70E8] focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Organization Logo</label>
          <div className="border-2 border-dashed border-[#0E4EBD] rounded-xl p-8 text-center hover:bg-blue-50 transition-colors cursor-pointer">
            <Upload className="w-8 h-8 text-[#0E4EBD] mx-auto mb-3" />
            <div className="text-[#001A4D] text-sm font-medium mb-1">Click to upload or drag and drop</div>
            <div className="text-gray-500 text-xs">PNG, JPG up to 2MB</div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="p-6 space-y-6">
      <div className="border-l-4 border-[#FFC107] pl-4">
        <h3 className="text-[#001A4D] font-bold text-lg">Assign Organization Officers</h3>
        <p className="text-gray-600 text-sm mt-1">Assign at least one President. All other roles are optional.</p>
      </div>

      <div className="space-y-3">
        {officers.map((officer) => {
          const Icon = getRoleIcon(officer.role);
          const isRequired = officer.role === 'President';

          return (
            <div key={officer.role} className="border border-[#E0E0E0] rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#001A4D] rounded-lg flex items-center justify-center">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#001A4D] text-sm">{officer.role}</span>
                    {isRequired ? (
                      <span className="px-2 py-0.5 bg-[#FFC107] text-[#001A4D] rounded text-xs font-medium">Required</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-gray-200 text-gray-600 rounded text-xs">Optional</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="w-60">
                {officer.studentName ? (
                  <div className="flex items-center gap-2 bg-[#001A4D] rounded-lg px-3 py-2">
                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-[#001A4D] font-bold text-xs">
                      {officer.avatar}
                    </div>
                    <div className="flex-1">
                      <div className="text-white text-sm font-bold">{officer.studentName}</div>
                      <div className="text-white/70 text-xs">{officer.studentId}</div>
                    </div>
                    <button onClick={() => handleRemoveOfficer(officer.role)} className="text-white/70 hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search student by name or ID..."
                      onClick={() => {
                        // Simulate selecting a student
                        handleAssignOfficer(officer.role, {
                          name: 'Juan Dela Cruz',
                          id: '2024-001234',
                          email: 'juan.delacruz@sti.edu'
                        });
                      }}
                      className="w-full pl-10 pr-4 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:ring-2 focus:ring-[#1E70E8] focus:border-transparent"
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <button className="w-full border-2 border-dashed border-[#0E4EBD] rounded-xl py-3 flex items-center justify-center gap-2 text-[#0E4EBD] font-medium hover:bg-blue-50 transition-colors">
          <Plus className="w-4 h-4" />
          Add Custom Role
        </button>
      </div>

      {assignedOfficers.length > 0 && (
        <div className="border border-[#E0E0E0] rounded-xl overflow-hidden">
          <button
            onClick={() => setShowCredentials(!showCredentials)}
            className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
          >
            <span className="font-bold text-[#001A4D] text-sm">Set Login Credentials</span>
            <ChevronDown className={`w-5 h-5 text-gray-600 transition-transform ${showCredentials ? 'rotate-180' : ''}`} />
          </button>

          {showCredentials && (
            <div className="p-4 space-y-4">
              {assignedOfficers.map((officer) => (
                <div key={officer.role} className="space-y-3">
                  <div className="font-medium text-[#001A4D] text-sm">
                    {officer.studentName} — {officer.role}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="email"
                          value={officer.email}
                          onChange={(e) => setOfficers(officers.map(o =>
                            o.role === officer.role ? { ...o, email: e.target.value } : o
                          ))}
                          className="w-full pl-10 pr-4 py-2 border border-[#E0E0E0] rounded-lg text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Temporary Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type={showPasswords[officer.role] ? 'text' : 'password'}
                          value={officer.password}
                          onChange={(e) => setOfficers(officers.map(o =>
                            o.role === officer.role ? { ...o, password: e.target.value } : o
                          ))}
                          className="w-full pl-10 pr-10 py-2 border border-[#E0E0E0] rounded-lg text-sm"
                        />
                        <button
                          onClick={() => setShowPasswords({ ...showPasswords, [officer.role]: !showPasswords[officer.role] })}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                        >
                          {showPasswords[officer.role] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="px-3 py-1.5 bg-[#FFC107]/20 border border-[#FFC107]/40 rounded text-xs text-[#001A4D]">
                    Officer will be prompted to change password on first login
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="p-6 space-y-6">
      <div className="border-l-4 border-[#FFC107] pl-4">
        <h3 className="text-[#001A4D] font-bold text-lg">Review Organization Details</h3>
      </div>

      <div className="border border-[#E0E0E0] rounded-xl p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-[#001A4D] to-[#0E4EBD] rounded-full flex items-center justify-center text-white font-bold text-xl">
            {formData.acronym || 'ORG'}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-[#001A4D] font-bold text-xl">{formData.name || 'Organization Name'}</h4>
              <span className="px-3 py-1 bg-[#FFD54F] text-[#001A4D] rounded-full text-xs font-medium">
                {formData.type || 'Type'}
              </span>
            </div>
            <p className="text-gray-600 text-sm">{formData.acronym}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
          <div>
            <div className="text-xs text-gray-500">Department</div>
            <div className="text-[#001A4D] text-sm font-medium">{formData.department || '—'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">School Year</div>
            <div className="text-[#001A4D] text-sm font-medium">{formData.schoolYear || '—'}</div>
          </div>
          <div className="col-span-2">
            <div className="text-xs text-gray-500">Description</div>
            <div className="text-[#001A4D] text-sm">{formData.description || '—'}</div>
          </div>
        </div>
      </div>

      <div className="border border-[#E0E0E0] rounded-xl p-6">
        <h4 className="text-[#001A4D] font-bold text-sm mb-4">Officers</h4>
        <div className="space-y-2">
          {officers.map((officer) => (
            <div key={officer.role} className={`flex items-center justify-between py-3 ${
              !officer.studentName ? 'border-2 border-dashed border-gray-200' : ''
            }`}>
              {officer.studentName ? (
                <>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-[#001A4D] rounded-full flex items-center justify-center text-white font-bold text-xs">
                      {officer.avatar}
                    </div>
                    <div>
                      <div className="text-[#001A4D] font-bold text-sm">{officer.studentName}</div>
                      <div className="text-gray-500 text-xs">{officer.studentId}</div>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-[#0E4EBD] text-white rounded-full text-xs font-medium">
                    {officer.role}
                  </span>
                </>
              ) : (
                <span className="text-gray-400 text-sm italic">{officer.role} — Not assigned</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-3 p-4 border border-[#E0E0E0] rounded-xl cursor-pointer hover:bg-gray-50">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="w-5 h-5 text-[#0E4EBD] rounded focus:ring-[#0E4EBD]"
        />
        <span className="text-[#001A4D] text-sm">
          I confirm that the information above is accurate and the assigned officers have been informed of their credentials.
        </span>
      </label>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-[640px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#001A4D] px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg">Create Organization</h2>
          <button onClick={onClose} className="text-white hover:bg-white/10 rounded-lg p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        {renderStepIndicator()}

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
        </div>

        {/* Footer */}
        <div className="border-t border-[#E0E0E0] px-6 py-4 flex items-center justify-between">
          <div>
            {currentStep > 1 && (
              <button
                onClick={() => setCurrentStep(currentStep - 1)}
                className="px-4 py-2 border border-[#E0E0E0] text-[#001A4D] rounded-lg hover:bg-gray-50 flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            )}
            {currentStep === 1 && (
              <button
                onClick={onClose}
                className="px-4 py-2 border border-[#E0E0E0] text-[#001A4D] rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="flex items-center gap-4">
            {currentStep === 3 && (
              <div className="text-xs text-[#FFC107]">
                Organization will be set to Active immediately upon creation.
              </div>
            )}
            {currentStep < 3 ? (
              <button
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={currentStep === 2 && !hasPresident}
                className="px-6 py-2.5 bg-[#001A4D] text-white rounded-lg hover:bg-[#001A4D]/90 flex items-center gap-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {currentStep === 1 ? 'Next: Assign Officers' : 'Next: Review'}
                <ArrowRight className="w-4 h-4 text-[#FFC107]" />
              </button>
            ) : (
              <button
                onClick={() => {
                  // Handle create organization
                  onClose();
                }}
                disabled={!confirmed}
                className="px-6 py-2.5 bg-[#001A4D] text-white rounded-lg hover:bg-[#001A4D]/90 flex items-center gap-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                <Building className="w-4 h-4 text-[#FFC107]" />
                Create Organization
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
