import { useState, useEffect } from 'react';
import { Upload, FileText, Shield, CheckCircle, X, AlertCircle, Plus, Trash2 } from 'lucide-react';
import type { EventFormData, EventDocumentFile } from '../../types/event.types';
import { uploadToCloudinary } from '../../../../../services/cloudinary';
import { formatAppDate } from '../../../../utils/date';

interface Step6Props {
  data: EventFormData;
  onUpdate: (data: Partial<EventFormData>) => void;
}

const REQUIRED_DOCUMENTS = [
  { id: 'req_1', name: 'Official Event Approval Letter', desc: 'SAO-signed approval document for institutional records' },
  { id: 'req_2', name: 'Approved Budget Authorization', desc: 'Signed budget approval for disbursement' },
  { id: 'req_3', name: 'Campus Permit / Facilities Authorization', desc: 'Signed permit for venue use' },
];

const complianceItems = [
  { id: 1, check: 'Organization is currently active and compliant', status: 'passed', auto: true },
  { id: 2, check: 'Assigned officers are registered and in good standing', status: 'passed', auto: true },
  { id: 3, check: 'Event does not conflict with the academic calendar', status: 'passed', auto: true },
  { id: 4, check: 'Budget is within organizational approved ceiling', status: 'passed', auto: true },
  { id: 5, check: 'All required documents uploaded', status: 'warning', auto: true },
  { id: 6, check: 'No outstanding unresolved incidents from previous events by this org', status: 'passed', auto: true },
];

const complianceScore = 83;

export default function Step6Documents({ data, onUpdate }: Step6Props) {
  useEffect(() => {
    if (!data.documents) {
      onUpdate({
        documents: REQUIRED_DOCUMENTS.map(doc => ({
          id: doc.id,
          name: doc.name,
          fileUrl: null,
          required: true
        }))
      });
    }
  }, []);

  const documents = data.documents || [];
  const extraDocuments = documents.filter(d => !d.required);
  
  const [authorizationChecked, setAuthorizationChecked] = useState(false);
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);

  const updateField = (field: keyof EventFormData, value: any) => {
    onUpdate({ [field]: value });
  };

  const addDocument = () => {
    const newDoc: EventDocumentFile = { id: Date.now().toString(), name: '', fileUrl: null, required: false };
    updateField('documents', [...documents, newDoc]);
  };

  const removeDocument = (id: string) => {
    updateField('documents', documents.filter(d => d.id !== id));
  };

  const updateDocumentName = (id: string, name: string) => {
    updateField('documents', documents.map(d => d.id === id ? { ...d, name } : d));
  };

  const handleDocumentUpload = async (id: string, file: File) => {
    setUploadingDocId(id);
    try {
      const result = await uploadToCloudinary(file, { folder: 'events/documents' });
      updateField('documents', documents.map(d => 
        d.id === id ? { ...d, fileUrl: result.secureUrl } : d
      ));
    } catch (error) {
      console.error('Failed to upload document', error);
      alert('Failed to upload document.');
    } finally {
      setUploadingDocId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
      <div className="space-y-6">

        {/* Section A - Official Event Documents */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 border-l-4 border-[#83358E] pl-3">
              <h3 className="text-[#001A4D] font-bold text-base">Official Event Documents</h3>
              <span className="px-2 py-0.5 bg-[#83358E] text-white text-xs rounded">Admin Uploads</span>
            </div>
            <button
              onClick={addDocument}
              className="px-4 py-2 bg-[#1E70E8] text-white rounded-lg text-sm font-medium hover:bg-[#0E4EBD] flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Document
            </button>
          </div>

          <div className="space-y-3">
            {/* Required document fields */}
            {REQUIRED_DOCUMENTS.map((docDef) => {
              const docItem = documents.find(d => d.id === docDef.id);
              return (
                <div key={docDef.id} className="border border-gray-200 rounded-lg p-4 hover:border-[#83358E] transition-colors">
                  <div className="flex items-start gap-3 mb-3">
                    <FileText className="w-5 h-5 text-[#83358E] flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-gray-900 text-sm">{docDef.name}</h4>
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded">Required</span>
                      </div>
                      <p className="text-xs text-gray-600">{docDef.desc}</p>
                    </div>
                  </div>
                  <div className={`relative border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-[#83358E] cursor-pointer transition-colors overflow-hidden ${docItem?.fileUrl ? 'bg-green-50 border-green-300' : ''}`}>
                    <input 
                      type="file" 
                      accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          handleDocumentUpload(docDef.id, e.target.files[0]);
                        }
                      }}
                      disabled={uploadingDocId === docDef.id}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                    />
                    {uploadingDocId === docDef.id ? (
                      <>
                        <Upload className="w-6 h-6 text-[#83358E] animate-bounce mx-auto mb-1" />
                        <p className="text-xs text-gray-600">Uploading...</p>
                      </>
                    ) : docItem?.fileUrl ? (
                      <>
                        <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-1" />
                        <p className="text-xs text-green-700 font-medium">Uploaded Successfully</p>
                        <p className="text-[10px] text-green-600">Click to replace</p>
                      </>
                    ) : (
                      <>
                        <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                        <p className="text-xs text-gray-600">Click to upload</p>
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Dynamic additional document fields */}
            {extraDocuments.map((doc) => (
              <div key={doc.id} className="border border-[#1E70E8]/40 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-[#1E70E8]" />
                    <input
                      type="text"
                      placeholder={`Document name (e.g., Risk Management Plan)`}
                      value={doc.name}
                      onChange={(e) => updateDocumentName(doc.id, e.target.value)}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] focus:border-transparent w-72"
                    />
                  </div>
                  <button onClick={() => removeDocument(doc.id)} className="text-red-500 hover:text-red-700 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className={`relative border-2 border-dashed border-[#1E70E8]/40 rounded-lg p-4 text-center hover:border-[#1E70E8] cursor-pointer transition-colors overflow-hidden ${doc.fileUrl ? 'bg-green-50 border-green-300' : ''}`}>
                  <input 
                    type="file" 
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        handleDocumentUpload(doc.id, e.target.files[0]);
                      }
                    }}
                    disabled={uploadingDocId === doc.id}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                  />
                  {uploadingDocId === doc.id ? (
                    <>
                      <Upload className="w-6 h-6 text-[#1E70E8] animate-bounce mx-auto mb-1" />
                      <p className="text-xs text-gray-600">Uploading...</p>
                    </>
                  ) : doc.fileUrl ? (
                    <>
                      <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-1" />
                      <p className="text-xs text-green-700 font-medium">Uploaded Successfully</p>
                      <p className="text-[10px] text-green-600">Click to replace</p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                      <p className="text-xs text-gray-600">Click to upload</p>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section B - Compliance Checklist */}
        <div>
          <div className="flex items-center gap-2 mb-4 border-l-4 border-[#83358E] pl-3">
            <h3 className="text-[#001A4D] font-bold text-base">Institutional Compliance Verification</h3>
            <span className="px-2 py-0.5 bg-[#83358E] text-white text-xs rounded">Admin Only</span>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-[#001A4D] px-4 py-3">
              <h4 className="text-white font-bold text-sm">Compliance Status</h4>
            </div>

            <div className="p-4 space-y-3">
              {complianceItems.map((item) => (
                <div key={item.id} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg">
                  <div className="flex-shrink-0 mt-0.5">
                    {item.status === 'passed' ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : item.status === 'warning' ? (
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                    ) : (
                      <X className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-medium ${
                        item.status === 'passed' ? 'text-gray-900' :
                        item.status === 'warning' ? 'text-amber-900' :
                        'text-red-900'
                      }`}>
                        {item.check}
                      </span>
                      {item.auto && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">Auto-checked</span>
                      )}
                    </div>
                    {item.status === 'warning' && (
                      <div className="mt-2">
                        <p className="text-xs text-amber-700 mb-2">Required documents are missing</p>
                        <button className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded text-xs font-medium hover:bg-amber-200">
                          Override & Proceed
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Section C - Adviser Authorization */}
        <div>
          <div className="flex items-center gap-2 mb-4 border-l-4 border-[#83358E] pl-3">
            <h3 className="text-[#001A4D] font-bold text-base">SAO Adviser Authorization</h3>
            <span className="px-2 py-0.5 bg-[#83358E] text-white text-xs rounded">Admin Only</span>
          </div>

          <div className="p-6 bg-[#001A4D] border-4 border-[#FFC107] rounded-lg">
            <div className="flex items-start gap-4 mb-4">
              <Shield className="w-8 h-8 text-[#FFC107] flex-shrink-0" />
              <div>
                <h4 className="text-white font-bold text-lg mb-2">SAO Adviser Authorization</h4>
                <p className="text-gray-300 text-sm">
                  By proceeding to publish this event, you are certifying that all provided information is accurate,
                  all compliance items are verified, and this event is hereby officially approved under your authority
                  as SAO Adviser of STI College Ormoc.
                </p>
              </div>
            </div>

            <label className="flex items-start gap-3 p-4 bg-white/10 border border-[#FFC107] rounded-lg cursor-pointer hover:bg-white/20 transition-colors">
              <input
                type="checkbox"
                checked={authorizationChecked}
                onChange={(e) => setAuthorizationChecked(e.target.checked)}
                className="mt-1 text-[#FFC107] bg-white/20 border-[#FFC107] rounded focus:ring-[#FFC107]"
              />
              <span className="text-white font-medium">I authorize this event creation.</span>
            </label>

            <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-400 mb-1">Adviser Name</div>
                <div className="text-white font-medium">SAO Adviser</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Role</div>
                <div className="text-white font-medium">System Administrator</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Authorization Date</div>
                <div className="text-white font-medium">{formatAppDate(new Date())}</div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Right Panel - Compliance Metrics */}
      <div className="sticky top-0 h-fit">
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <h4 className="font-bold text-gray-900 mb-3">Compliance Overview</h4>

          <div className="space-y-4">
            <div className="relative aspect-square max-w-[180px] mx-auto">
              <svg viewBox="0 0 100 100" className="transform -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#E5E7EB" strokeWidth="12" />
                <circle
                  cx="50" cy="50" r="40" fill="none"
                  stroke={complianceScore >= 100 ? '#10B981' : complianceScore >= 80 ? '#FFC107' : '#EF4444'}
                  strokeWidth="12"
                  strokeDasharray={`${(complianceScore / 100) * 251.2} 251.2`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className={`text-3xl font-bold ${
                  complianceScore >= 100 ? 'text-green-600' :
                  complianceScore >= 80 ? 'text-amber-600' : 'text-red-600'
                }`}>{complianceScore}%</div>
                <div className="text-xs text-gray-500">Compliance Score</div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-3">
              <div className="text-xs font-bold text-gray-700 mb-2">Document Coverage</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">Required (3)</span>
                  <span className="font-bold text-gray-900">0/3</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500" style={{ width: '0%' }} />
                </div>
                {extraDocuments.length > 0 && (
                  <>
                    <div className="flex items-center justify-between text-sm mt-3">
                      <span className="text-gray-700">Additional</span>
                      <span className="font-bold text-gray-900">0/{extraDocuments.length}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: '0%' }} />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="p-3 bg-gradient-to-br from-[#001A4D] to-[#83358E] rounded-lg text-white text-center">
              <Shield className="w-6 h-6 mx-auto mb-1 text-[#FFC107]" />
              <div className="text-xs font-bold mb-1">Compliance Status</div>
              <div className={`text-sm font-medium ${
                complianceScore >= 100 ? 'text-green-300' :
                complianceScore >= 80 ? 'text-amber-300' : 'text-red-300'
              }`}>
                {complianceScore >= 100 ? 'Fully Compliant' :
                 complianceScore >= 80 ? 'Advisory Warnings' : 'Requires Attention'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
