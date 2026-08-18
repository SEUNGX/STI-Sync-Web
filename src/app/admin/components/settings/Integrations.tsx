import { Plug, Check, X, RefreshCw } from 'lucide-react';

interface IntegrationsProps {
  onUnsavedChange: () => void;
}

export default function Integrations({ onUnsavedChange }: IntegrationsProps) {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-[#001A4D]">Integrations</h2>
        <p className="text-sm text-gray-500 mt-1">Connect STI Sync with external services and platforms</p>
      </div>

      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">Available Integrations</h3>
        <div className="space-y-3">
          {[
            {
              name: 'Google Calendar',
              description: 'Sync events to Google Calendar',
              icon: '📅',
              status: 'connected',
              lastSync: '2 hours ago'
            },
            {
              name: 'Microsoft Teams',
              description: 'Send notifications to Teams channels',
              icon: '💬',
              status: 'connected',
              lastSync: '30 minutes ago'
            },
            {
              name: 'Zoom',
              description: 'Auto-create Zoom meetings for virtual events',
              icon: '🎥',
              status: 'disconnected',
              lastSync: null
            },
            {
              name: 'Google Drive',
              description: 'Store event documents and media',
              icon: '📁',
              status: 'connected',
              lastSync: '1 hour ago'
            },
            {
              name: 'Facebook Events',
              description: 'Post events to Facebook automatically',
              icon: '👥',
              status: 'disconnected',
              lastSync: null
            },
            {
              name: 'Mailchimp',
              description: 'Send event announcements via email campaigns',
              icon: '✉️',
              status: 'disconnected',
              lastSync: null
            },
          ].map((integration, index) => (
            <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
              <div className="flex items-center gap-4 flex-1">
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-2xl">
                  {integration.icon}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{integration.name}</div>
                  <div className="text-xs text-gray-500">{integration.description}</div>
                  {integration.status === 'connected' && integration.lastSync && (
                    <div className="text-xs text-green-600 mt-1">Last synced {integration.lastSync}</div>
                  )}
                </div>
                {integration.status === 'connected' ? (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                      <Check className="w-3 h-3" />
                      Connected
                    </span>
                  </div>
                ) : (
                  <span className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                    <X className="w-3 h-3" />
                    Not Connected
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 ml-4">
                {integration.status === 'connected' ? (
                  <>
                    <button className="p-2 text-[#0E4EBD] hover:bg-[#0E4EBD]/10 rounded" title="Sync now">
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={onUnsavedChange}
                      className="px-4 py-2 text-red-600 border border-red-600 rounded-lg text-sm font-medium hover:bg-red-50"
                    >
                      Disconnect
                    </button>
                  </>
                ) : (
                  <button
                    onClick={onUnsavedChange}
                    className="px-4 py-2 bg-[#0E4EBD] text-white rounded-lg text-sm font-medium hover:bg-[#0E4EBD]/90"
                  >
                    Connect
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">API Access</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              API Key
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                defaultValue="sk_live_abc123xyz789"
                readOnly
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm"
              />
              <button className="px-4 py-2.5 text-[#0E4EBD] border border-[#0E4EBD] rounded-lg font-medium hover:bg-[#0E4EBD]/5">
                Regenerate
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Webhook URL
            </label>
            <input
              type="url"
              placeholder="https://your-app.com/webhook"
              onChange={onUnsavedChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
            />
            <p className="text-xs text-gray-500 mt-1">Receive real-time event notifications</p>
          </div>

          <div className="space-y-3 pt-4 border-t border-gray-200">
            <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <span className="text-sm text-gray-700">Enable API access</span>
              <button
                onClick={onUnsavedChange}
                className="relative w-12 h-6 rounded-full bg-[#001A4D] cursor-pointer"
              >
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full translate-x-6"></div>
              </button>
            </label>
            <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <span className="text-sm text-gray-700">Rate limiting (100 requests/minute)</span>
              <button
                onClick={onUnsavedChange}
                className="relative w-12 h-6 rounded-full bg-[#001A4D] cursor-pointer"
              >
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full translate-x-6"></div>
              </button>
            </label>
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">Integration Activity</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-3xl font-bold text-blue-700 mb-1">3</div>
            <div className="text-xs text-blue-600">Active Integrations</div>
          </div>
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-3xl font-bold text-green-700 mb-1">1,234</div>
            <div className="text-xs text-green-600">API Calls This Month</div>
          </div>
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-3xl font-bold text-[#001A4D] mb-1">99.8%</div>
            <div className="text-xs text-gray-500">Uptime</div>
          </div>
        </div>
      </div>
    </div>
  );
}
