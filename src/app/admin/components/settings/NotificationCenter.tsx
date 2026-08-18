import { Bell, Mail, MessageSquare, Smartphone } from 'lucide-react';

interface NotificationCenterProps {
  onUnsavedChange: () => void;
}

export default function NotificationCenter({ onUnsavedChange }: NotificationCenterProps) {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-[#001A4D]">Notification Center</h2>
        <p className="text-sm text-gray-500 mt-1">Configure system notifications and delivery channels</p>
      </div>

      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">Notification Channels</h3>
        <div className="grid grid-cols-2 gap-4">
          {[
            { name: 'Email Notifications', icon: Mail, enabled: true, count: 1245 },
            { name: 'In-App Messages', icon: MessageSquare, enabled: true, count: 3890 },
            { name: 'SMS Alerts', icon: Smartphone, enabled: false, count: 0 },
            { name: 'Push Notifications', icon: Bell, enabled: true, count: 2156 },
          ].map((channel, index) => {
            const Icon = channel.icon;
            return (
              <div key={index} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      channel.enabled ? 'bg-[#0E4EBD]/10' : 'bg-gray-100'
                    }`}>
                      <Icon className={`w-5 h-5 ${channel.enabled ? 'text-[#0E4EBD]' : 'text-gray-400'}`} />
                    </div>
                    <span className="font-medium text-gray-900 text-sm">{channel.name}</span>
                  </div>
                  <button
                    onClick={onUnsavedChange}
                    className={`relative w-12 h-6 rounded-full cursor-pointer ${
                      channel.enabled ? 'bg-[#001A4D]' : 'bg-gray-300'
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                        channel.enabled ? 'translate-x-6' : ''
                      }`}
                    ></div>
                  </button>
                </div>
                <div className="text-xs text-gray-500">{channel.count} sent this month</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">Event Notifications</h3>
        <div className="space-y-2">
          {[
            { event: 'New event submission', email: true, inApp: true, sms: false },
            { event: 'Event approval status changed', email: true, inApp: true, sms: true },
            { event: 'Event starting soon reminder', email: true, inApp: true, sms: false },
            { event: 'Attendance QR code generated', email: false, inApp: true, sms: false },
            { event: 'Certificate ready for download', email: true, inApp: true, sms: false },
          ].map((notif, index) => (
            <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <span className="text-sm text-gray-700 flex-1">{notif.event}</span>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked={notif.email}
                    onChange={onUnsavedChange}
                    className="text-[#0E4EBD] focus:ring-[#0E4EBD] rounded accent-[#0E4EBD]"
                  />
                  <span className="text-xs text-gray-600">Email</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked={notif.inApp}
                    onChange={onUnsavedChange}
                    className="text-[#0E4EBD] focus:ring-[#0E4EBD] rounded accent-[#0E4EBD]"
                  />
                  <span className="text-xs text-gray-600">In-App</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked={notif.sms}
                    onChange={onUnsavedChange}
                    className="text-[#0E4EBD] focus:ring-[#0E4EBD] rounded accent-[#0E4EBD]"
                  />
                  <span className="text-xs text-gray-600">SMS</span>
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">Delivery Settings</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Default Sender Email
            </label>
            <input
              type="email"
              defaultValue="sao@sti.edu"
              onChange={onUnsavedChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Default Sender Name
            </label>
            <input
              type="text"
              defaultValue="STI College Ormoc - Student Affairs Office"
              onChange={onUnsavedChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
            />
          </div>

          <div className="space-y-3 pt-4 border-t border-gray-200">
            <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <span className="text-sm text-gray-700">Batch notifications to reduce email volume</span>
              <button
                onClick={onUnsavedChange}
                className="relative w-12 h-6 rounded-full bg-[#001A4D] cursor-pointer"
              >
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full translate-x-6"></div>
              </button>
            </label>
            <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <span className="text-sm text-gray-700">Include organization logo in email notifications</span>
              <button
                onClick={onUnsavedChange}
                className="relative w-12 h-6 rounded-full bg-gray-300"
              >
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full"></div>
              </button>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
