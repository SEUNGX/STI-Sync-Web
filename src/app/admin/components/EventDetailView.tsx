import { useState } from 'react';
import {
  X, Calendar, MapPin, Users, DollarSign, Building2, Tag,
  Search, CheckCircle, XCircle, Clock, QrCode, Lock,
  ChevronLeft, Filter, Download, Shield, AlertTriangle,
  CreditCard, UserCheck, UserX, MoreVertical
} from 'lucide-react';
import { formatCurrency } from '../../utils/currency';
import { formatAppDate } from '../../utils/date';

interface EventDetailViewProps {
  event: any;
  onClose: () => void;
}

const MOCK_STUDENTS = [
  { id: 1, name: 'Juan Dela Cruz', studentId: '2023-0001', course: 'BSIT', year: '3rd Year', paymentStatus: 'paid', paidAt: 'Jun 5 2026', amount: 700 },
  { id: 2, name: 'Maria Santos', studentId: '2023-0002', course: 'BSCS', year: '2nd Year', paymentStatus: 'unpaid', paidAt: null, amount: 0 },
  { id: 3, name: 'Carlos Reyes', studentId: '2022-0045', course: 'BSIT', year: '4th Year', paymentStatus: 'paid', paidAt: 'Jun 4 2026', amount: 700 },
  { id: 4, name: 'Ana Garcia', studentId: '2024-0112', course: 'BSIS', year: '1st Year', paymentStatus: 'unpaid', paidAt: null, amount: 0 },
  { id: 5, name: 'Miguel Torres', studentId: '2023-0078', course: 'BSCS', year: '3rd Year', paymentStatus: 'paid', paidAt: 'Jun 6 2026', amount: 700 },
  { id: 6, name: 'Liza Mendoza', studentId: '2022-0099', course: 'BSIT', year: '4th Year', paymentStatus: 'unpaid', paidAt: null, amount: 0 },
  { id: 7, name: 'Ryan Cruz', studentId: '2024-0033', course: 'BSCS', year: '2nd Year', paymentStatus: 'paid', paidAt: 'Jun 3 2026', amount: 700 },
  { id: 8, name: 'Patricia Lim', studentId: '2023-0156', course: 'BSIS', year: '3rd Year', paymentStatus: 'unpaid', paidAt: null, amount: 0 },
  { id: 9, name: 'Kevin Aquino', studentId: '2022-0201', course: 'BSIT', year: '4th Year', paymentStatus: 'paid', paidAt: 'Jun 7 2026', amount: 700 },
  { id: 10, name: 'Sophia Tan', studentId: '2024-0088', course: 'BSCS', year: '1st Year', paymentStatus: 'unpaid', paidAt: null, amount: 0 },
  { id: 11, name: 'Jerome Bautista', studentId: '2023-0204', course: 'BSIT', year: '2nd Year', paymentStatus: 'unpaid', paidAt: null, amount: 0 },
  { id: 12, name: 'Claire Villanueva', studentId: '2022-0187', course: 'BSIS', year: '4th Year', paymentStatus: 'paid', paidAt: 'June 5, 2026', amount: 700 },
];

const AMOUNT_PER_STUDENT = 700;

export default function EventDetailView({ event, onClose }: EventDetailViewProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'payables'>('overview');
  const [students, setStudents] = useState(MOCK_STUDENTS);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [confirmStudent, setConfirmStudent] = useState<number | null>(null);
  const [activeMenu, setActiveMenu] = useState<number | null>(null);

  const paidCount = students.filter(s => s.paymentStatus === 'paid').length;
  const unpaidCount = students.filter(s => s.paymentStatus === 'unpaid').length;
  const totalCollected = paidCount * AMOUNT_PER_STUDENT;
  const totalExpected = students.length * AMOUNT_PER_STUDENT;
  const collectionRate = Math.round((paidCount / students.length) * 100);

  const filtered = students.filter(s => {
    const nameStr = (s.name || "").toLowerCase();
    const courseStr = (s.course || "").toLowerCase();
    const searchStr = (search || "").toLowerCase();
    const matchSearch = nameStr.includes(searchStr) ||
      (s.studentId || "").includes(searchStr) ||
      courseStr.includes(searchStr);
    const matchFilter = filterStatus === 'all' || s.paymentStatus === filterStatus;
    return matchSearch && matchFilter;
  });

  const markAsPaid = (id: number) => {
    setStudents(students.map(s =>
      s.id === id ? { ...s, paymentStatus: 'paid', paidAt: formatAppDate(new Date()), amount: AMOUNT_PER_STUDENT } : s
    ));
    setConfirmStudent(null);
    setActiveMenu(null);
  };

  const markAsUnpaid = (id: number) => {
    setStudents(students.map(s =>
      s.id === id ? { ...s, paymentStatus: 'unpaid', paidAt: null, amount: 0 } : s
    ));
    setActiveMenu(null);
  };

  const TABS = [
    { key: 'overview', label: 'Event Overview' },
    { key: 'payables', label: 'Student Payables' },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-[#001A4D] via-[#002B7F] to-[#0E4EBD] px-6 py-4 flex items-center justify-between flex-shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-white font-bold text-lg leading-tight">{event.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-white/80 text-xs font-medium">{event.org}</span>
                <span className="text-white/40">·</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  event.status === 'Approved' ? 'bg-green-500/20 text-green-300' :
                  event.status === 'Pending' ? 'bg-amber-500/20 text-amber-300' :
                  'bg-red-500/20 text-red-300'
                }`}>{event.status}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 px-6 flex gap-1 bg-white flex-shrink-0">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors cursor-pointer ${
                activeTab === tab.key
                  ? 'border-[#001A4D] text-[#001A4D]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {tab.key === 'payables' && unpaidCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">{unpaidCount} unpaid</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── OVERVIEW TAB ── */}
          {activeTab === 'overview' && (
            <div className="p-6 space-y-6">
              {/* Info grid */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { icon: Calendar, label: 'Event Date', value: event.date, color: 'text-[#1E70E8]' },
                  { icon: MapPin, label: 'Venue', value: event.venue, color: 'text-[#0E4EBD]' },
                  { icon: Tag, label: 'Type', value: event.type, color: 'text-green-600' },
                  { icon: Building2, label: 'Organization', value: event.org, color: 'text-[#001A4D]' },
                  { icon: DollarSign, label: 'Approved Budget', value: event.budget, color: 'text-amber-600' },
                  { icon: Users, label: 'Registered Students', value: `${students.length} students`, color: 'text-[#002B7F]' },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={`w-4 h-4 ${color}`} />
                      <span className="text-xs text-gray-500">{label}</span>
                    </div>
                    <div className="font-bold text-gray-900">{value}</div>
                  </div>
                ))}
              </div>

              {/* Payment summary banner */}
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-2 p-5 bg-gradient-to-br from-[#001A4D] to-[#0E4EBD] rounded-xl text-white">
                  <div className="text-white/60 text-xs mb-1">Total Collection Progress</div>
                  <div className="text-3xl font-bold text-[#FFC107]">{formatCurrency(totalCollected)}</div>
                  <div className="text-white/60 text-xs mt-1">of {formatCurrency(totalExpected)} expected</div>
                  <div className="mt-3 h-2 bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full bg-[#FFC107] rounded-full transition-all" style={{ width: `${collectionRate}%` }} />
                  </div>
                  <div className="text-white/70 text-xs mt-1.5">{collectionRate}% collected</div>
                </div>
                <div className="p-5 bg-green-50 border-2 border-green-200 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <UserCheck className="w-5 h-5 text-green-600" />
                    <span className="text-xs text-gray-600">Paid</span>
                  </div>
                  <div className="text-3xl font-bold text-green-700">{paidCount}</div>
                  <div className="text-xs text-gray-500 mt-1">students</div>
                  <div className="mt-2">
                    <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">QR Unlocked</span>
                  </div>
                </div>
                <div className="p-5 bg-red-50 border-2 border-red-200 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <UserX className="w-5 h-5 text-red-600" />
                    <span className="text-xs text-gray-600">Unpaid</span>
                  </div>
                  <div className="text-3xl font-bold text-red-700">{unpaidCount}</div>
                  <div className="text-xs text-gray-500 mt-1">students</div>
                  <div className="mt-2">
                    <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full flex items-center gap-1 w-fit">
                      <Lock className="w-3 h-3" /> QR Locked
                    </span>
                  </div>
                </div>
              </div>

              {/* Unpaid students quick list */}
              {unpaidCount > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="border-l-4 border-red-500 pl-3">
                      <h3 className="font-bold text-gray-900">Students with Unpaid Balance</h3>
                      <p className="text-xs text-gray-500">{unpaidCount} students have not paid — QR tickets are locked</p>
                    </div>
                    <button
                      onClick={() => { setActiveTab('payables'); setFilterStatus('unpaid'); }}
                      className="px-3 py-1.5 text-xs font-semibold text-[#0E4EBD] border border-[#0E4EBD] rounded-lg hover:bg-blue-50 cursor-pointer transition-colors"
                    >
                      Manage Payments
                    </button>
                  </div>
                  <div className="space-y-2">
                    {students.filter(s => s.paymentStatus === 'unpaid').slice(0, 5).map(s => (
                      <div key={s.id} className="flex items-center justify-between px-4 py-3 bg-red-50 border border-red-100 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-red-200 flex items-center justify-center text-red-700 font-bold text-xs">
                            {s.name.split(' ').map(n => n[0]).join('').slice(0,2)}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 text-sm">{s.name}</div>
                            <div className="text-xs text-gray-500">{s.studentId} · {s.course} · {s.year}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Lock className="w-4 h-4 text-red-500" />
                          <span className="text-xs font-medium text-red-700">{formatCurrency(AMOUNT_PER_STUDENT)} due</span>
                        </div>
                      </div>
                    ))}
                    {unpaidCount > 5 && (
                      <button
                        onClick={() => { setActiveTab('payables'); setFilterStatus('unpaid'); }}
                        className="w-full py-2 text-xs text-gray-500 hover:text-[#0E4EBD] transition-colors cursor-pointer"
                      >
                        +{unpaidCount - 5} more unpaid students — view all
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── PAYABLES TAB ── */}
          {activeTab === 'payables' && (
            <div className="p-6 space-y-5">

              {/* Stats row */}
              <div className="grid grid-cols-4 gap-3">
                <div className="p-4 bg-[#001A4D]/5 border border-[#001A4D]/20 rounded-xl text-center">
                  <div className="text-2xl font-bold text-[#001A4D]">{formatCurrency(AMOUNT_PER_STUDENT)}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Fee Per Student</div>
                </div>
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-center">
                  <div className="text-2xl font-bold text-green-700">{paidCount}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Paid</div>
                </div>
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-center">
                  <div className="text-2xl font-bold text-red-700">{unpaidCount}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Unpaid</div>
                </div>
                <div className="p-4 bg-[#FFC107]/10 border border-[#FFC107]/40 rounded-xl text-center">
                  <div className="text-2xl font-bold text-[#001A4D]">{formatCurrency(totalCollected)}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Collected</div>
                </div>
              </div>

              {/* QR lock notice */}
              <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <QrCode className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">
                  Students marked as <strong>Paid</strong> will have their QR attendance ticket unlocked. <strong>Unpaid</strong> students remain locked and cannot check in at the event gate.
                </p>
              </div>

              {/* Search + Filter */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name, student ID, or course..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
                  />
                </div>
                <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl">
                  {(['all', 'paid', 'unpaid'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setFilterStatus(f)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                        filterStatus === f ? 'bg-white shadow text-[#001A4D]' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {f === 'all' ? `All (${students.length})` : f === 'paid' ? `Paid (${paidCount})` : `Unpaid (${unpaidCount})`}
                    </button>
                  ))}
                </div>
                <button className="flex items-center gap-2 px-3 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                  <Download className="w-4 h-4" /> Export
                </button>
              </div>

              {/* Student Table */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Student</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">ID Number</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Course / Year</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Payment Status</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Date Paid</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">QR Ticket</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-gray-400 text-sm">
                          No students match your search.
                        </td>
                      </tr>
                    ) : filtered.map(student => (
                      <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                              student.paymentStatus === 'paid'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {student.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                            <span className="font-medium text-gray-900 text-sm">{student.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 font-mono">{student.studentId}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{student.course} · {student.year}</td>
                        <td className="px-4 py-3">
                          {student.paymentStatus === 'paid' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                              <CheckCircle className="w-3.5 h-3.5" /> Paid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                              <XCircle className="w-3.5 h-3.5" /> Unpaid
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {student.paymentStatus === 'paid' ? formatCurrency(student.amount) : <span className="text-red-500">{formatCurrency(AMOUNT_PER_STUDENT)} due</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {student.paidAt ?? <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {student.paymentStatus === 'paid' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 border border-green-200 text-green-700 text-xs rounded-lg">
                              <QrCode className="w-3.5 h-3.5" /> Unlocked
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 border border-gray-200 text-gray-500 text-xs rounded-lg">
                              <Lock className="w-3.5 h-3.5" /> Locked
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 relative">
                          <button
                            onClick={() => setActiveMenu(activeMenu === student.id ? null : student.id)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {activeMenu === student.id && (
                            <div className="absolute right-4 top-10 z-10 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[160px]">
                              {student.paymentStatus === 'unpaid' ? (
                                <button
                                  onClick={() => { setConfirmStudent(student.id); setActiveMenu(null); }}
                                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-green-700 hover:bg-green-50 transition-colors"
                                >
                                  <CheckCircle className="w-4 h-4" /> Mark as Paid
                                </button>
                              ) : (
                                <button
                                  onClick={() => markAsUnpaid(student.id)}
                                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-700 hover:bg-red-50 transition-colors"
                                >
                                  <XCircle className="w-4 h-4" /> Mark as Unpaid
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirm Payment Modal */}
      {confirmStudent !== null && (() => {
        const s = students.find(st => st.id === confirmStudent)!;
        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmStudent(null)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-7 h-7 text-green-600" />
              </div>
              <h3 className="font-bold text-gray-900 text-lg text-center mb-1">Confirm Payment</h3>
              <p className="text-gray-500 text-sm text-center mb-5">
                Mark <strong>{s.name}</strong> ({s.studentId}) as paid for this event?
              </p>
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl mb-5 flex items-center justify-between">
                <span className="text-sm text-gray-700">Amount</span>
                <span className="font-bold text-gray-900">{formatCurrency(AMOUNT_PER_STUDENT)}</span>
              </div>
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl mb-5 flex items-start gap-2">
                <QrCode className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-green-800">
                  This will <strong>unlock the student's QR attendance ticket</strong> for this event.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmStudent(null)}
                  className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => markAsPaid(confirmStudent)}
                  className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700"
                >
                  Confirm Paid
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Backdrop click to close menus */}
      {activeMenu !== null && (
        <div className="fixed inset-0 z-[5]" onClick={() => setActiveMenu(null)} />
      )}
    </div>
  );
}
