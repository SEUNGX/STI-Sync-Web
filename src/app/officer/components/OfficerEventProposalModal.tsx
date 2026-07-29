import { useState } from 'react';
import { X, Plus, Trash2, Upload, FileText, CheckCircle, AlertCircle, Users, Send, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { useEventCreation } from '../../modules/events/hooks/useEventCreation';
import type { EventDocument } from '../../modules/events/types/event.types';

interface OfficerEventProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDraft?: EventDocument;
  draftId?: string;
}

const STEPS = [
  'Event Details',
  'Schedule',
  'Participants',
  'Staff',
  'Budget',
  'Documents',
  'Submit',
];

// ─── Shared field styles ───────────────────────────────────────────
const input = 'w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] focus:border-transparent outline-none';
const label = 'block text-sm font-medium text-gray-700 mb-1.5';
const sectionHeading = (title: string) => (
  <div className="border-l-4 border-[#83358E] pl-3 mb-4">
    <h3 className="text-[#001A4D] font-bold text-base">{title}</h3>
  </div>
);

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle}
      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${on ? 'bg-[#83358E]' : 'bg-gray-300'}`}>
      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
    </button>
  );
}

// ─── Step 1 — Event Details ───────────────────────────────────────
function Step1({ data, onUpdate }: { data: any; onUpdate: (d: any) => void }) {
  const [form, setForm] = useState({
    title: '', tagline: '', description: '', eventType: '', category: '',
    enableQR: true, publicEvent: true, ...data
  });

  const set = (k: string, v: any) => {
    const next = { ...form, [k]: v };
    if (k === 'enableQR' || k === 'enableQRTickets') {
      next.enableQR = v;
      next.enableQRTickets = v;
    }
    setForm(next); 
    onUpdate(next);
  };

  return (
    <div className="grid grid-cols-[1fr_280px] gap-6">
      <div className="space-y-6">

        {/* Event Identity */}
        <div>
          {sectionHeading('Event Identity')}
          <div className="space-y-4">
            <div>
              <label className={label}>Event Title <span className="text-red-500">*</span></label>
              <input type="text" value={form.title} onChange={e => set('title', e.target.value)}
                className={input} placeholder="Enter event title..." />
            </div>
            <div>
              <label className={label}>Event Tagline</label>
              <input type="text" value={form.tagline} onChange={e => set('tagline', e.target.value)}
                className={input} placeholder="Short catchy description..." />
            </div>
            <div>
              <label className={label}>Event Description <span className="text-red-500">*</span></label>
              <textarea rows={5} value={form.description} onChange={e => set('description', e.target.value)}
                className={`${input} resize-none`} placeholder="Detailed description of the event..." />
            </div>
            <div>
              <label className={label}>Event Objectives</label>
              <input type="text" className={input} placeholder="Type and press Enter to add objectives..." />
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="px-3 py-1 bg-[#F3E8FF] text-[#83358E] rounded-full text-sm">Enhance learning</span>
                <span className="px-3 py-1 bg-[#F3E8FF] text-[#83358E] rounded-full text-sm">Build community</span>
              </div>
            </div>
          </div>
        </div>

        {/* Classification */}
        <div>
          {sectionHeading('Classification')}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label}>Event Type <span className="text-red-500">*</span></label>
              <select value={form.eventType} onChange={e => set('eventType', e.target.value)} className={input}>
                <option value="">Select type...</option>
                <option>Academic</option><option>Social</option><option>Cultural</option>
                <option>Sports</option><option>Competition</option>
              </select>
            </div>
            <div>
              <label className={label}>Category <span className="text-red-500">*</span></label>
              <select value={form.category} onChange={e => set('category', e.target.value)} className={input}>
                <option value="">Select category...</option>
                <option>Workshop</option><option>Seminar</option><option>Tournament</option><option>Festival</option>
              </select>
            </div>
          </div>
        </div>

        {/* Event Settings */}
        <div>
          {sectionHeading('Event Settings')}
          <div className="space-y-3">
            {[
              { key: 'enableQR', label: 'Enable QR Tickets', desc: 'Generate scannable QR code tickets' },
              { key: 'publicEvent', label: 'Public Event', desc: 'Visible to all students campus-wide' },
            ].map(s => (
              <div key={s.key} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{s.label}</p>
                  <p className="text-xs text-gray-500">{s.desc}</p>
                </div>
                <Toggle on={!!form[s.key]} onToggle={() => set(s.key, !form[s.key])} />
              </div>
            ))}
          </div>
        </div>

        {/* Event Media */}
        <div>
          {sectionHeading('Event Media')}
          <div className="space-y-4">
            <div>
              <label className={label}>Event Banner Image <span className="text-red-500">*</span></label>
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-[#83358E] transition-colors cursor-pointer">
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Click to upload or drag and drop</p>
                <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 10MB • 1200×630px recommended</p>
              </div>
            </div>
            <div>
              <label className={label}>Event Thumbnail</label>
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-[#83358E] transition-colors cursor-pointer">
                <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Square format • 400×400px recommended</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Panel */}
      <div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm sticky top-0">
          <h4 className="font-bold text-gray-900 mb-3">Event Preview</h4>
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
            <div className="aspect-video bg-gradient-to-br from-[#7F77DD] to-[#83358E] rounded-lg mb-3 flex items-center justify-center">
              <span className="text-white/50 text-sm">Event Banner</span>
            </div>
            <h5 className="font-bold text-gray-900 mb-1">{form.title || 'Event Title'}</h5>
            <p className="text-sm text-gray-500 mb-3">{form.tagline || 'Event tagline will appear here'}</p>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-[#7F77DD]" />
              <span className="text-xs text-gray-500">STI IT Guild</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="px-2 py-1 bg-[#F3E8FF] text-[#83358E] text-xs rounded">{form.eventType || 'Type'}</span>
              <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded font-medium">Pending</span>
            </div>
          </div>
          <div className="mt-4 p-3 bg-[#F3E8FF] border border-[#83358E]/20 rounded-lg">
            <p className="text-xs text-[#83358E] font-medium">Proposal Info</p>
            <p className="text-xs text-gray-600 mt-1">Submitted proposals go through SAO review before publishing.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 2 — Schedule ────────────────────────────────────────────
function Step2({ data, onUpdate }: { data: any; onUpdate: (d: any) => void }) {
  const [sessions, setSessions] = useState([{ id: 1, title: '', date: '', startTime: '', endTime: '' }]);
  const [eventFormat, setEventFormat] = useState<'On-Campus' | 'Online' | 'Hybrid'>('On-Campus');

  const addSession = () => setSessions([...sessions, { id: Date.now(), title: '', date: '', startTime: '', endTime: '' }]);
  const removeSession = (id: number) => setSessions(sessions.filter(s => s.id !== id));
  const updateSession = (id: number, field: string, val: string) =>
    setSessions(sessions.map(s => s.id === id ? { ...s, [field]: val } : s));

  return (
    <div className="grid grid-cols-[1fr_280px] gap-6">
      <div className="space-y-6">

        {/* Academic Context */}
        <div>
          {sectionHeading('Academic Context')}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label}>School Year <span className="text-red-500">*</span></label>
              <select className={input}><option>2025-2026</option><option>2026-2027</option></select>
            </div>
            <div>
              <label className={label}>Semester <span className="text-red-500">*</span></label>
              <select className={input}><option>First Semester</option><option>Second Semester</option><option>Summer</option></select>
            </div>
          </div>
        </div>

        {/* Event Schedule */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="border-l-4 border-[#83358E] pl-3">
              <h3 className="text-[#001A4D] font-bold text-base">Event Schedule</h3>
            </div>
            <button onClick={addSession}
              className="px-4 py-2 bg-[#1E70E8] text-white rounded-lg text-sm font-medium hover:bg-[#0E4EBD] flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Session
            </button>
          </div>
          <div className="space-y-3">
            {sessions.map((session, i) => (
              <div key={session.id} className="p-4 border border-gray-200 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900 text-sm">Session {i + 1}</h4>
                  {sessions.length > 1 && (
                    <button onClick={() => removeSession(session.id)} className="text-red-500 hover:text-red-700 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Session Title</label>
                    <input type="text" placeholder="e.g., Day 1 – Morning Session" value={session.title}
                      onChange={e => updateSession(session.id, 'title', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] focus:border-transparent" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                      <input type="date" value={session.date} onChange={e => updateSession(session.id, 'date', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] focus:border-transparent" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Start Time</label>
                      <input type="time" value={session.startTime} onChange={e => updateSession(session.id, 'startTime', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] focus:border-transparent" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">End Time</label>
                      <input type="time" value={session.endTime} onChange={e => updateSession(session.id, 'endTime', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] focus:border-transparent" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Venue */}
        <div>
          {sectionHeading('Venue')}
          <div className="space-y-4">
            <div>
              <label className={label}>Event Format <span className="text-red-500">*</span></label>
              <div className="inline-flex rounded-lg border border-gray-300 p-1">
                {(['On-Campus', 'Online', 'Hybrid'] as const).map(fmt => (
                  <button key={fmt} onClick={() => setEventFormat(fmt)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${eventFormat === fmt ? 'bg-[#83358E] text-white' : 'text-gray-700 hover:bg-gray-100'}`}>
                    {fmt}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={label}>Venue <span className="text-red-500">*</span></label>
              <input type="text" placeholder="Enter venue name or address..." className={input} />
            </div>
          </div>
        </div>
      </div>

      {/* Preview Panel */}
      <div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm sticky top-0">
          <h4 className="font-bold text-gray-900 mb-3">Schedule Preview</h4>
          <div className="space-y-3">
            <div className="p-3 bg-[#83358E] rounded-xl text-white">
              <div className="text-xs opacity-80 mb-1">Academic Period</div>
              <div className="font-bold text-sm">SY 2025-2026 • 1st Semester</div>
            </div>
            <div className="border border-gray-200 rounded-xl p-3">
              <div className="text-xs text-gray-500 mb-2">Sessions</div>
              {sessions.map((s, i) => (
                <div key={s.id} className="flex items-start gap-2 py-2 border-b border-gray-100 last:border-0">
                  <div className="w-6 h-6 rounded-full bg-[#83358E] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{s.title || `Session ${i + 1}`}</div>
                    <div className="text-xs text-gray-400">{s.date || 'Date not set'}</div>
                    {(s.startTime || s.endTime) && <div className="text-xs text-gray-400">{s.startTime} – {s.endTime}</div>}
                  </div>
                </div>
              ))}
            </div>
            <div className="border border-gray-200 rounded-xl p-3">
              <div className="text-xs text-gray-500 mb-1">Format</div>
              <span className={`px-2 py-1 text-xs rounded font-medium ${eventFormat === 'On-Campus' ? 'bg-blue-100 text-blue-700' : eventFormat === 'Online' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>{eventFormat}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 3 — Participants ────────────────────────────────────────
const YEAR_LEVELS = ['All', '1st Year', '2nd Year', '3rd Year', '4th Year', 'G11', 'G12'];
const DEPARTMENTS = ['College of Computer Studies (CCS)', 'College of Business Administration (CBA)', 'College of Arts and Sciences (CAS)', 'College of Teacher Education (CTE)'];

function Step3({ data, onUpdate }: { data: any; onUpdate: (d: any) => void }) {
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [sessions] = useState([
    { id: 1, title: 'Day 1 – Morning Session', date: '2026-02-10', startTime: '08:00', endTime: '12:00', timeInOpen: '07:30', timeInClose: '09:00', hasTimeOut: true, timeOutOpen: '11:30', timeOutClose: '12:30' },
    { id: 2, title: 'Day 1 – Afternoon Session', date: '2026-02-10', startTime: '13:00', endTime: '17:00', timeInOpen: '12:45', timeInClose: '14:00', hasTimeOut: false, timeOutOpen: '', timeOutClose: '' },
  ]);
  const [sessionSettings, setSessionSettings] = useState(sessions.map(s => ({ ...s })));
  const [issueCerts, setIssueCerts] = useState(false);

  const toggleYear = (y: string) => {
    if (y === 'All') setSelectedYears(selectedYears.length === YEAR_LEVELS.length ? [] : [...YEAR_LEVELS]);
    else setSelectedYears(p => p.includes(y) ? p.filter(x => x !== y) : [...p, y]);
  };

  const updateSession = (id: number, field: string, val: any) =>
    setSessionSettings(sessionSettings.map(s => s.id === id ? { ...s, [field]: val } : s));

  return (
    <div className="grid grid-cols-[1fr_280px] gap-6">
      <div className="space-y-6">

        {/* Target Audience */}
        <div>
          {sectionHeading('Target Audience')}
          <div className="space-y-4">
            <div>
              <label className={label}>Year Levels</label>
              <div className="flex flex-wrap gap-2">
                {YEAR_LEVELS.map(y => (
                  <button key={y} onClick={() => toggleYear(y)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${selectedYears.includes(y) ? 'bg-[#83358E] text-white border-[#83358E]' : 'bg-white text-gray-700 border-gray-300 hover:border-[#83358E]'}`}>
                    {y}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={label}>Departments / Colleges</label>
              <div className="space-y-2">
                {DEPARTMENTS.map(dept => (
                  <label key={dept} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" className="accent-[#83358E] rounded" />
                    <span className="text-sm text-gray-700">{dept}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Attendance Rules */}
        <div>
          {sectionHeading('Attendance Rules')}
          <div className="grid grid-cols-3 gap-4 mb-5">
            <div>
              <label className={label}>Min. Attendance %</label>
              <div className="relative">
                <input type="number" placeholder="80" className={`${input} pr-8`} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
              </div>
            </div>
            <div>
              <label className={label}>Late Threshold (min)</label>
              <input type="number" placeholder="15" className={input} />
            </div>
            <div>
              <label className={label}>Grace Period (min)</label>
              <input type="number" placeholder="5" className={input} />
            </div>
          </div>

          <div className="space-y-4">
            {sessionSettings.map(session => (
              <div key={session.id} className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-[#83358E] px-4 py-3">
                  <p className="text-white font-bold text-sm">{session.title}</p>
                  <p className="text-white/60 text-xs">{session.date} · {session.startTime} – {session.endTime}</p>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Time-In Window</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Opens</label>
                        <input type="time" value={session.timeInOpen} onChange={e => updateSession(session.id, 'timeInOpen', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] focus:border-transparent" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Closes</label>
                        <input type="time" value={session.timeInClose} onChange={e => updateSession(session.id, 'timeInClose', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] focus:border-transparent" />
                      </div>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={session.hasTimeOut} onChange={() => updateSession(session.id, 'hasTimeOut', !session.hasTimeOut)} className="accent-[#83358E] rounded" />
                    <span className="text-sm font-medium text-gray-700">Enable Time-Out for this session</span>
                  </label>
                  {session.hasTimeOut && (
                    <div>
                      <p className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Time-Out Window</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Opens</label>
                          <input type="time" value={session.timeOutOpen} onChange={e => updateSession(session.id, 'timeOutOpen', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] focus:border-transparent" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Closes</label>
                          <input type="time" value={session.timeOutClose} onChange={e => updateSession(session.id, 'timeOutClose', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] focus:border-transparent" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Certificate Rules */}
        <div>
          {sectionHeading('Certificate Rules')}
          <div className="space-y-4">
            <label className="flex items-center gap-2 px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer">
              <input type="checkbox" className="accent-[#83358E] rounded" />
              <div>
                <p className="font-medium text-gray-900 text-sm">Issue Certificates of Participation</p>
                <p className="text-xs text-gray-500">Generate certificates for qualified participants</p>
              </div>
            </label>
            <div>
              <label className={label}>Minimum Attendance for Certificate</label>
              <div className="relative">
                <input type="number" placeholder="80" className={`${input} pr-8`} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm sticky top-0">
          <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Users className="w-5 h-5 text-[#83358E]" /> Estimated Reach
          </h4>
          <div className="space-y-3">
            <div className="p-4 bg-[#83358E] rounded-xl text-white text-center">
              <div className="text-3xl font-bold mb-1">387</div>
              <div className="text-sm opacity-90">Matching Students</div>
            </div>
            <div className="border border-gray-200 rounded-xl p-3">
              <div className="text-xs text-gray-500 mb-2">Selected Year Levels</div>
              <div className="flex flex-wrap gap-1">
                {selectedYears.length === 0
                  ? <span className="text-xs text-gray-400">None selected</span>
                  : selectedYears.map(y => <span key={y} className="px-2 py-0.5 bg-[#F3E8FF] text-[#83358E] text-xs rounded-full">{y}</span>)}
              </div>
            </div>
            <div className="border border-gray-200 rounded-xl p-3">
              <div className="text-xs text-gray-500 mb-3">By Department</div>
              {[{ dept: 'CCS', count: 145 }, { dept: 'CBA', count: 98 }, { dept: 'CTE', count: 67 }, { dept: 'CAS', count: 77 }].map(d => (
                <div key={d.dept} className="mb-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700">{d.dept}</span>
                    <span className="font-bold text-gray-900">{d.count}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#83358E]" style={{ width: `${(d.count / 387) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 4 — Staff ───────────────────────────────────────────────
function Step4({ data, onUpdate }: { data: any; onUpdate: (d: any) => void }) {
  const [teamMembers, setTeamMembers] = useState([{ id: 1, role: '', student: '' }]);
  const [scanners, setScanners] = useState([{ id: 1, name: '', canCheckIn: true, canCheckOut: true, canViewList: true, canEditRecords: false }]);

  const addMember = () => setTeamMembers([...teamMembers, { id: Date.now(), role: '', student: '' }]);
  const removeMember = (id: number) => { if (teamMembers.length > 1) setTeamMembers(teamMembers.filter(m => m.id !== id)); };

  const addScanner = () => setScanners([...scanners, { id: Date.now(), name: '', canCheckIn: true, canCheckOut: true, canViewList: true, canEditRecords: false }]);
  const removeScanner = (id: number) => setScanners(scanners.filter(s => s.id !== id));

  return (
    <div className="grid grid-cols-[1fr_280px] gap-6">
      <div className="space-y-6">

        {/* Core Team */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="border-l-4 border-[#83358E] pl-3">
              <h3 className="text-[#001A4D] font-bold text-base">Event Core Team</h3>
            </div>
            <button onClick={addMember}
              className="px-4 py-2 bg-[#1E70E8] text-white rounded-lg text-sm font-medium hover:bg-[#0E4EBD] flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Role
            </button>
          </div>
          <div className="space-y-3">
            {teamMembers.map((m, i) => (
              <div key={m.id} className="p-4 border border-gray-200 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900 text-sm">Team Member {i + 1}</h4>
                  <button onClick={() => removeMember(m.id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
                    <input type="text" placeholder="e.g., Logistics Head" value={m.role}
                      onChange={e => setTeamMembers(teamMembers.map(x => x.id === m.id ? { ...x, role: e.target.value } : x))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Assign Member</label>
                    <input type="text" placeholder="Search members..." value={m.student}
                      onChange={e => setTeamMembers(teamMembers.map(x => x.id === m.id ? { ...x, student: e.target.value } : x))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] focus:border-transparent" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Scanner Assignment */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="border-l-4 border-[#83358E] pl-3">
              <h3 className="text-[#001A4D] font-bold text-base">Scanner Assignment</h3>
            </div>
            <button onClick={addScanner}
              className="px-4 py-2 bg-[#1E70E8] text-white rounded-lg text-sm font-medium hover:bg-[#0E4EBD] flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Scanner
            </button>
          </div>
          <div className="space-y-3">
            {scanners.map((sc, i) => (
              <div key={sc.id} className="p-4 border border-gray-200 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900 text-sm">Scanner Officer {i + 1}</h4>
                  {scanners.length > 1 && <button onClick={() => removeScanner(sc.id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="w-4 h-4" /></button>}
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Assign Officer <span className="text-red-500">*</span></label>
                  <input type="text" placeholder="Search for officer..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] focus:border-transparent" />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-700">Scanner Permissions</p>
                  {[
                    { key: 'canCheckIn', label: 'Check-in Attendees' },
                    { key: 'canCheckOut', label: 'Check-out Attendees' },
                    { key: 'canViewList', label: 'View Attendance List' },
                    { key: 'canEditRecords', label: 'Edit Attendance Records' },
                  ].map(p => (
                    <label key={p.key} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={sc[p.key as keyof typeof sc] as boolean}
                        onChange={e => setScanners(scanners.map(s => s.id === sc.id ? { ...s, [p.key]: e.target.checked } : s))}
                        className="accent-[#83358E] rounded" />
                      <span className="text-sm text-gray-700">{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Preview */}
      <div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm sticky top-0">
          <h4 className="font-bold text-gray-900 mb-3">Team Overview</h4>
          <div className="space-y-3">
            <div className="p-3 bg-[#83358E] rounded-xl text-white text-center">
              <div className="font-bold text-sm">STI IT Guild</div>
              <div className="text-xs opacity-80 mt-0.5">Hosting Organization</div>
            </div>
            <div className="h-4 border-l-2 border-gray-200 mx-auto w-0" />
            <div className="space-y-2">
              {teamMembers.map((m, i) => (
                <div key={m.id} className="p-2 bg-[#F3E8FF] border border-[#83358E]/20 rounded-lg text-center">
                  <div className="font-medium text-xs text-[#001A4D]">{m.role || `Role ${i + 1}`}</div>
                  <div className="text-xs text-gray-500">{m.student || 'Not assigned'}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Scanner Officers</span>
                <span className="font-bold text-[#001A4D]">{scanners.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 5 — Budget ──────────────────────────────────────────────
interface BudgetItem { id: number; item: string; description: string; quantity: number; unitCost: number; }

function Step5({ data, onUpdate }: { data: any; onUpdate: (d: any) => void }) {
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([
    { id: 1, item: '', description: '', quantity: 1, unitCost: 0 }
  ]);

  const addItem = () => setBudgetItems([...budgetItems, { id: Date.now(), item: '', description: '', quantity: 1, unitCost: 0 }]);
  const removeItem = (id: number) => setBudgetItems(budgetItems.filter(i => i.id !== id));
  const update = (id: number, k: string, v: any) => setBudgetItems(budgetItems.map(i => i.id === id ? { ...i, [k]: v } : i));

  const total = budgetItems.reduce((s, i) => s + i.quantity * i.unitCost, 0);

  return (
    <div className="grid grid-cols-[1fr_280px] gap-6">
      <div className="space-y-6">

        {/* Funding Sources */}
        <div>
          {sectionHeading('Funding Sources')}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Organization Fund', placeholder: '35,000' },
              { label: 'Registration/Entry Fees', placeholder: '0' },
              { label: 'Sponsorship', placeholder: '0' },
            ].map(f => (
              <div key={f.label}>
                <label className={label}>{f.label}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₱</span>
                  <input type="number" placeholder={f.placeholder} className={`${input} pl-7`} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Budget Line Items */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="border-l-4 border-[#83358E] pl-3">
              <h3 className="text-[#001A4D] font-bold text-base">Budget Line Items</h3>
            </div>
            <button onClick={addItem}
              className="px-4 py-2 bg-[#1E70E8] text-white rounded-lg text-sm font-medium hover:bg-[#0E4EBD] flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Line Item
            </button>
          </div>
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Item</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Description</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-600">Qty</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-600">Unit Cost</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-600">Total</th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {budgetItems.map(item => (
                  <tr key={item.id}>
                    <td className="px-3 py-2">
                      <input type="text" value={item.item} onChange={e => update(item.id, 'item', e.target.value)}
                        placeholder="e.g. Venue Rental" className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-[#83358E] focus:border-transparent" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="text" value={item.description} onChange={e => update(item.id, 'description', e.target.value)}
                        placeholder="Details..." className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-[#83358E] focus:border-transparent" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={item.quantity} onChange={e => update(item.id, 'quantity', Number(e.target.value))}
                        min={1} className="w-16 px-2 py-1.5 border border-gray-300 rounded text-sm text-center focus:ring-1 focus:ring-[#83358E] focus:border-transparent" />
                    </td>
                    <td className="px-3 py-2">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₱</span>
                        <input type="number" value={item.unitCost} onChange={e => update(item.id, 'unitCost', Number(e.target.value))}
                          min={0} className="w-24 pl-5 pr-2 py-1.5 border border-gray-300 rounded text-sm text-right focus:ring-1 focus:ring-[#83358E] focus:border-transparent" />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-sm font-medium text-gray-900">
                      ₱{(item.quantity * item.unitCost).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      {budgetItems.length > 1 && (
                        <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-sm font-bold text-gray-700 text-right">Total Proposed Event Budget</td>
                  <td className="px-4 py-3 text-right font-black text-[#83358E]">₱{total.toLocaleString()}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm sticky top-0">
          <h4 className="font-bold text-gray-900 mb-3">Budget Summary</h4>
          <div className="space-y-3">
            <div className="p-4 bg-gradient-to-br from-[#001A4D] to-[#83358E] rounded-xl text-white text-center">
              <div className="text-xs opacity-80 mb-1">Total Proposed Budget</div>
              <div className="text-2xl font-black text-[#FFC107]">₱{total.toLocaleString()}</div>
            </div>
            <div className="space-y-2">
              {budgetItems.filter(i => i.item).map(i => (
                <div key={i.id} className="flex justify-between text-sm">
                  <span className="text-gray-600 truncate flex-1">{i.item}</span>
                  <span className="font-medium text-gray-900 ml-2">₱{(i.quantity * i.unitCost).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-xs text-amber-700">Budget subject to SAO adviser approval before disbursement.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 6 — Documents ───────────────────────────────────────────
const REQUIRED_DOCS = [
  { id: 1, name: 'Official Event Approval Letter', desc: 'SAO-signed approval document for institutional records' },
  { id: 2, name: 'Approved Budget Authorization', desc: 'Signed budget approval for disbursement' },
  { id: 3, name: 'Campus Permit / Facilities Authorization', desc: 'Signed permit for venue use' },
];

const COMPLIANCE_ITEMS = [
  { id: 1, check: 'Organization is currently active and compliant', status: 'passed' },
  { id: 2, check: 'Assigned officers are registered and in good standing', status: 'passed' },
  { id: 3, check: 'Event does not conflict with the academic calendar', status: 'passed' },
  { id: 4, check: 'Budget is within organizational approved ceiling', status: 'passed' },
  { id: 5, check: 'All required documents uploaded', status: 'warning' },
  { id: 6, check: 'No outstanding unresolved incidents from previous events', status: 'passed' },
];

function Step6({ data, onUpdate }: { data: any; onUpdate: (d: any) => void }) {
  const [extraDocs, setExtraDocs] = useState<{ id: number; name: string }[]>([]);

  return (
    <div className="grid grid-cols-[1fr_280px] gap-6">
      <div className="space-y-6">

        {/* Required Documents */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="border-l-4 border-[#83358E] pl-3">
              <h3 className="text-[#001A4D] font-bold text-base">Required Documents</h3>
            </div>
            <button onClick={() => setExtraDocs([...extraDocs, { id: Date.now(), name: '' }])}
              className="px-4 py-2 bg-[#1E70E8] text-white rounded-lg text-sm font-medium hover:bg-[#0E4EBD] flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Document
            </button>
          </div>
          <div className="space-y-3">
            {REQUIRED_DOCS.map(doc => (
              <div key={doc.id} className="border border-gray-200 rounded-xl p-4 hover:border-[#83358E] transition-colors">
                <div className="flex items-start gap-3 mb-3">
                  <FileText className="w-5 h-5 text-[#83358E] flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-gray-900 text-sm">{doc.name}</h4>
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded">Required</span>
                    </div>
                    <p className="text-xs text-gray-500">{doc.desc}</p>
                  </div>
                </div>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-[#83358E] cursor-pointer transition-colors">
                  <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                  <p className="text-sm text-gray-600">Click to upload</p>
                  <p className="text-xs text-gray-400 mt-0.5">PDF, DOCX, PNG — max 10MB</p>
                </div>
              </div>
            ))}

            {/* Dynamic extra documents */}
            {extraDocs.map(doc => (
              <div key={doc.id} className="border border-[#83358E]/30 rounded-xl p-4 bg-[#F3E8FF]/20">
                <div className="flex items-center gap-2 mb-3">
                  <input type="text" value={doc.name}
                    onChange={e => setExtraDocs(extraDocs.map(d => d.id === doc.id ? { ...d, name: e.target.value } : d))}
                    placeholder="Document name..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] focus:border-transparent" />
                  <button onClick={() => setExtraDocs(extraDocs.filter(d => d.id !== doc.id))} className="text-red-400 hover:text-red-600 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="border-2 border-dashed border-[#83358E]/40 rounded-lg p-4 text-center hover:border-[#83358E] cursor-pointer transition-colors">
                  <Upload className="w-5 h-5 text-[#83358E]/50 mx-auto mb-1" />
                  <p className="text-sm text-gray-500">Click to upload</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SAO Adviser Authorization */}
        <div>
          {sectionHeading('SAO Adviser Authorization')}
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
            <p className="text-sm text-gray-700 mb-3">By submitting this proposal, I confirm that all information provided is accurate and that this event has been discussed with and is supported by our organization adviser.</p>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="accent-[#83358E] w-4 h-4 rounded" />
              <span className="text-sm font-medium text-gray-900">I confirm the above statement and authorize submission for SAO review</span>
            </label>
          </div>
        </div>
      </div>

      {/* Compliance Panel */}
      <div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm sticky top-0">
          <h4 className="font-bold text-gray-900 mb-3">Compliance Check</h4>
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">Compliance Score</span>
              <span className="text-sm font-bold text-[#83358E]">83%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#83358E] rounded-full" style={{ width: '83%' }} />
            </div>
          </div>
          <div className="space-y-2">
            {COMPLIANCE_ITEMS.map(item => (
              <div key={item.id} className="flex items-start gap-2">
                {item.status === 'passed'
                  ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  : <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />}
                <span className="text-xs text-gray-700">{item.check}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 7 — Submit ──────────────────────────────────────────────
function Step7({ data }: { data: any; onUpdate: (d: any) => void }) {
  return (
    <div className="grid grid-cols-[1fr_280px] gap-6">
      <div className="space-y-6">
        {sectionHeading('Proposal Summary')}

        <div className="space-y-4">
          {[
            { step: 1, label: 'Event Details', status: 'complete', detail: data.title || 'Event title not set' },
            { step: 2, label: 'Schedule', status: 'complete', detail: 'Sessions configured' },
            { step: 3, label: 'Participants', status: 'complete', detail: 'Year levels & attendance rules set' },
            { step: 4, label: 'Staff', status: 'complete', detail: 'Core team & scanners assigned' },
            { step: 5, label: 'Budget', status: 'complete', detail: 'Budget line items submitted' },
            { step: 6, label: 'Documents', status: 'warning', detail: 'Some required documents pending' },
          ].map(s => (
            <div key={s.step} className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${s.status === 'complete' ? 'bg-green-500 text-white' : 'bg-amber-400 text-white'}`}>
                {s.step}
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900 text-sm">{s.label}</p>
                <p className="text-xs text-gray-500">{s.detail}</p>
              </div>
              {s.status === 'complete'
                ? <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                : <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />}
            </div>
          ))}
        </div>

        {/* Approval Workflow */}
        <div>
          {sectionHeading('Approval Workflow')}
          <div className="space-y-3">
            {[
              { step: 1, name: 'Organization President', note: 'Internal review' },
              { step: 2, name: 'Organization Adviser', note: 'Faculty sign-off' },
              { step: 3, name: 'SAO Adviser', note: 'Final institutional approval' },
            ].map(w => (
              <div key={w.step} className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl">
                <div className="w-8 h-8 bg-[#83358E] text-white rounded-full flex items-center justify-center font-bold text-sm">{w.step}</div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 text-sm">{w.name}</p>
                  <p className="text-xs text-gray-500">{w.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 bg-[#F3E8FF] border border-[#83358E]/20 rounded-xl">
          <p className="text-sm font-medium text-[#83358E] mb-1">Ready to submit?</p>
          <p className="text-sm text-gray-600">Once submitted, your proposal will enter the SAO review queue. You will receive a notification when it is approved or if revisions are needed.</p>
        </div>
      </div>

      {/* Summary Card */}
      <div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm sticky top-0">
          <h4 className="font-bold text-gray-900 mb-3">Proposal Card</h4>
          <div className="space-y-3">
            <div className="aspect-video bg-gradient-to-br from-[#7F77DD] to-[#83358E] rounded-xl flex items-center justify-center">
              <p className="text-white/70 text-sm">Event Banner</p>
            </div>
            <div>
              <p className="font-bold text-gray-900">{data.title || 'Event Title'}</p>
              <p className="text-xs text-gray-500 mt-0.5">{data.tagline || 'No tagline'}</p>
            </div>
            <div className="pt-3 border-t border-gray-100 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Organization</span>
                <span className="font-medium text-gray-900">STI IT Guild</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Type</span>
                <span className="font-medium text-gray-900">{data.eventType || '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Status</span>
                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">Pending Review</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────
export default function OfficerEventProposalModal({ isOpen, onClose, initialDraft, draftId }: OfficerEventProposalModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<any>(initialDraft ? { ...initialDraft } : {});
  const [activeDraftId, setActiveDraftId] = useState<string | undefined>(draftId);
  const [saving, setSaving] = useState(false);

  const { createEvent, saveDraft, loading } = useEventCreation();

  if (!isOpen) return null;

  const update = (d: any) => setFormData({ ...formData, ...d });

  const isQREnabled = formData.enableQR !== false && formData.enableQRTickets !== false;
  const activeSteps = isQREnabled
    ? ['Event Details', 'Schedule', 'Participants', 'Staff', 'Budget', 'Documents', 'Submit']
    : ['Event Details', 'Schedule', 'Participants', 'Budget', 'Documents', 'Submit'];

  const currentStepName = activeSteps[currentStep] || activeSteps[0];

  const next = () => { if (currentStep < activeSteps.length - 1) setCurrentStep(currentStep + 1); };
  const prev = () => { if (currentStep > 0) setCurrentStep(currentStep - 1); };
  const goTo = (i: number) => { if (i <= currentStep) setCurrentStep(i); };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const id = await saveDraft(formData, activeDraftId);
      if (id) {
        setActiveDraftId(id);
        toast.success('Draft saved!', {
          description: 'Your proposal draft has been saved successfully.',
          duration: 4000,
        });
      } else {
        toast.error('Failed to save draft');
      }
    } catch {
      toast.error('An error occurred while saving draft.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitProposal = async () => {
    setSaving(true);
    try {
      const id = await createEvent(formData, activeDraftId, true);
      if (id) {
        toast.success('Proposal Submitted!', {
          description: 'Your event proposal has been submitted for SAO review.',
          duration: 4000,
        });
        onClose();
      } else {
        toast.error('Failed to submit proposal');
      }
    } catch {
      toast.error('An error occurred while submitting proposal.');
    } finally {
      setSaving(false);
    }
  };

  const renderStep = () => {
    const props = { data: formData, onUpdate: update };
    switch (currentStepName) {
      case 'Event Details': return <Step1 {...props} />;
      case 'Schedule': return <Step2 {...props} />;
      case 'Participants': return <Step3 {...props} />;
      case 'Staff': return <Step4 {...props} />;
      case 'Budget': return <Step5 {...props} />;
      case 'Documents': return <Step6 {...props} />;
      case 'Submit': return <Step7 {...props} />;
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="relative w-full max-w-[1200px] h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">

          {/* Header — solid violet (officer pattern) */}
          <div className="bg-[#83358E] px-6 py-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">S</span>
              </div>
              <div>
                <p className="text-white font-bold">Create Event Proposal</p>
                <p className="text-white/70 text-xs">
                  {activeDraftId ? 'Resuming Draft' : 'STI IT Guild'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-white/90 text-sm font-medium">
                Step {currentStep + 1} of {activeSteps.length} — <span className="text-white font-bold">{currentStepName}</span>
              </span>
              <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-white/20 bg-gray-100 flex-shrink-0">
            <div className="h-full bg-[#83358E] transition-all duration-300" style={{ width: `${((currentStep + 1) / activeSteps.length) * 100}%` }} />
          </div>

          {/* Step navigator */}
          <div className="px-6 py-3 border-b border-gray-200 flex gap-2 overflow-x-auto flex-shrink-0">
            {activeSteps.map((step, i) => (
              <button key={i} onClick={() => goTo(i)} disabled={i > currentStep}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  i === currentStep ? 'bg-[#83358E] text-white' :
                  i < currentStep ? 'bg-[#1E70E8] text-white hover:bg-[#0E4EBD]' :
                  'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}>
                {step}
              </button>
            ))}
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">{renderStep()}</div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 bg-white px-6 py-4 flex items-center justify-between flex-shrink-0">
            <button onClick={prev} disabled={currentStep === 0}
              className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Previous
            </button>

            {currentStep < activeSteps.length - 1 ? (
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleSaveDraft} 
                  disabled={saving || loading}
                  className="px-5 py-2.5 border border-[#83358E] text-[#83358E] rounded-lg text-sm font-medium hover:bg-[#83358E]/5 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving...' : 'Save as Draft'}
                </button>
                <button onClick={next}
                  className="px-5 py-2.5 bg-[#83358E] text-white rounded-lg text-sm font-medium hover:bg-[#6D2A78] transition-colors">
                  Next Step
                </button>
              </div>
            ) : (
              <button 
                onClick={handleSubmitProposal} 
                disabled={saving || loading}
                className="px-6 py-2.5 bg-[#83358E] text-white rounded-lg text-sm font-medium hover:bg-[#6D2A78] disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                {saving || loading ? 'Submitting...' : 'Submit for Approval'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
