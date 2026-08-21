import React from 'react';
import { useNavigate } from 'react-router';
import { ShieldCheck, Lock, ArrowRight, X, Sparkles } from 'lucide-react';

interface FirstTimePasswordReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdviser?: boolean;
}

export function FirstTimePasswordReminderModal({
  isOpen,
  onClose,
  isAdviser = false,
}: FirstTimePasswordReminderModalProps) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleGoToSettings = () => {
    onClose();
    navigate('/officer/settings?tab=security');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#001A4D]/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-amber-200/80 relative overflow-hidden">
        {/* Top Gold Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#FFD41C] via-[#0E4EBD] to-[#FFD41C]" />

        {/* Close 'X' Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          title="Dismiss for now"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-4 pt-2">
          {/* Icon Badge */}
          <div className="w-16 h-16 bg-amber-50 border-2 border-amber-200 rounded-2xl mx-auto flex items-center justify-center text-amber-600 shadow-inner">
            <ShieldCheck className="w-9 h-9 text-[#0E4EBD]" />
          </div>

          {/* Heading & Badge */}
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-900 rounded-full text-[11px] font-bold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Initial Login Security Notice
            </div>
            <h3 className="text-xl font-extrabold text-[#001A4D]">
              {isAdviser ? 'Welcome, Club Adviser!' : 'Welcome, Officer!'}
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Enhance your account security on the STI Sync Platform
            </p>
          </div>

          {/* Description Box */}
          <div className="p-4 bg-blue-50/70 border border-blue-100 rounded-2xl text-xs text-blue-950 leading-relaxed text-left space-y-2">
            <p className="font-semibold text-[#001A4D] flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-[#0E4EBD]" /> Temporary Password In Use
            </p>
            <p>
              You are currently signed in with an initial temporary password. For your security and peace of mind, we recommend updating to your own private password.
            </p>
            <p className="text-[11px] text-gray-500">
              You can easily update your password anytime in your Account Settings.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col gap-2.5">
            <button
              onClick={handleGoToSettings}
              className="w-full py-3 bg-[#0E4EBD] hover:bg-[#001A4D] text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <span>Change Password in Settings</span>
              <ArrowRight className="w-4 h-4 text-[#FFD41C]" />
            </button>

            <button
              onClick={onClose}
              className="w-full py-2.5 text-xs text-gray-500 hover:text-gray-800 font-semibold hover:bg-gray-100 rounded-xl transition-colors"
            >
              Remind Me Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
