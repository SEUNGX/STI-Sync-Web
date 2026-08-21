import { useNavigate } from 'react-router';

export default function OfficerDashboard() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F8F8F8]">
      {/* Placeholder for Officer Dashboard */}
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-[#001A4D] to-[#0E4EBD] rounded-2xl flex items-center justify-center shadow-md">
            <div className="w-12 h-12 border-4 border-white rounded-lg" />
          </div>
          <h1 className="text-[#001A4D] text-[32px] font-bold mb-2">Officer Dashboard</h1>
          <p className="text-[#9E9E9E] text-[16px] mb-6">Coming Soon</p>
          <p className="text-[#9E9E9E] text-[14px] max-w-md mx-auto mb-8">
            The Officer Dashboard is currently under development. You'll be able to manage events,
            attendance, and financial liquidations here.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-gradient-to-r from-[#0E4EBD] to-[#1E70E8] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Return to Landing Page
          </button>
        </div>
      </div>
    </div>
  );
}
