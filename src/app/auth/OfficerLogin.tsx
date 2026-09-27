import { useState } from 'react';
import { useNavigate } from 'react-router';
import { IdCard, Lock, Eye, EyeOff, LogIn, AlertCircle, Info } from 'lucide-react';
import stiOrmocLogo from '../../imports/STI_ORMOC_LOGO.jpg';
import stiSchoolPic from '../../imports/STI_SCHOOL_PIC.webp';

import { useOfficerAuth } from './hooks/useOfficerAuth';

export default function OfficerLogin() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoggingIn, error } = useOfficerAuth();

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) return;

    const success = await login(identifier, password);
    if (success) {
      navigate('/officer/dashboard');
    }
  };

  return (
    <div className="h-screen w-full flex overflow-hidden">
      {/* Left Panel - Campus Photo Showcase with Top Text & Unobscured STI COLLEGE Building */}
      <div className="w-1/2 h-full bg-[#001A4D] relative overflow-hidden flex flex-col justify-between p-8 lg:p-12">
        {/* Full Height Campus Photo Background */}
        <div className="absolute inset-0 z-0">
          <img
            src={stiSchoolPic}
            alt="STI College Ormoc Campus"
            className="w-full h-full object-cover object-center filter contrast-105 saturate-110"
          />
          {/* Vignette overlays: Darker at top for text readability, subtle gradient at bottom, center wide open for STI COLLEGE building facade */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#001A4D]/90 via-black/15 to-[#001A4D]/80" />
        </div>

        {/* Ambient Glows */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <div className="w-[600px] h-[600px] bg-[#0E4EBD] opacity-20 rounded-full blur-[150px]" />
          <div className="absolute w-[400px] h-[400px] bg-[#FFD41C] opacity-15 rounded-full blur-[120px] translate-x-20" />
        </div>

        {/* Top Section: Redesigned Student Affairs Services Badge & Clean Header */}
        <div className="relative z-10 max-w-[480px]">
          <div className="inline-flex items-center gap-2.5 bg-gradient-to-r from-[#001A4D]/90 via-[#0A2E6D]/90 to-[#001A4D]/90 backdrop-blur-xl border border-white/20 text-[#FFD41C] text-[12px] font-black uppercase px-4 py-1.5 rounded-full tracking-wider shadow-lg shadow-black/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FFD41C] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FFD41C]"></span>
            </span>
            Student Affairs Services · Officer Portal
          </div>
          <h1 className="text-white text-[32px] lg:text-[40px] font-black tracking-tight leading-tight mt-3">
            Connect, Participate, <br />
            <span className="text-[#FFD41C]">and Stay Updated.</span>
          </h1>
        </div>

        {/* Middle Area Left Empty for Unobscured STI COLLEGE Building View */}
        <div className="flex-1 pointer-events-none" />

        {/* Bottom space intentionally clean (duplicate footer removed) */}
        <div className="relative z-10 h-6" />
      </div>

      {/* Right Panel - Single Viewport Fit Login Form with Redesigned Enlarged STI_ORMOC_LOGO */}
      <div className="w-1/2 h-full bg-white flex items-center justify-center p-6 lg:p-10 overflow-hidden">
        <div className="w-full max-w-[480px]">
          {/* Logo Header Section - Circle Framed Logo */}
          <div className="text-center mb-6">
            <div className="inline-block relative mb-3 group">
              <div className="absolute -inset-1.5 bg-gradient-to-r from-[#FFD41C] via-[#0E4EBD] to-[#FFD41C] rounded-full blur-md opacity-40 group-hover:opacity-70 transition duration-500" />
              <div className="relative w-28 h-28 md:w-32 md:h-32 rounded-full overflow-hidden shadow-xl mx-auto flex items-center justify-center transition-transform duration-300 group-hover:scale-[1.03]">
                <img
                  src={stiOrmocLogo}
                  alt="STI College Ormoc Logo"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <h2 className="text-[#001A4D] text-[28px] md:text-[30px] font-black tracking-tight">
              Officer Login
            </h2>
          </div>

          <div className="h-px bg-[#E5E7EB] mb-5" />

          {/* Form Fields */}
          <div className="space-y-4 mb-4">
            {/* Username/ID Field */}
            <div>
              <label className="block text-[#001A4D] text-[13px] font-bold mb-1.5">
                Username or Student ID
              </label>
              <div className="relative">
                <IdCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  placeholder="Enter your username or student ID"
                  className="w-full h-[48px] pl-10 pr-4 border border-gray-300 rounded-xl text-[14px] focus:border-[#0E4EBD] focus:ring-2 focus:ring-[#0E4EBD]/20 outline-none transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-[#001A4D] text-[13px] font-bold mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  placeholder="Enter your password"
                  className="w-full h-[48px] pl-10 pr-10 border border-gray-300 rounded-xl text-[14px] focus:border-[#0E4EBD] focus:ring-2 focus:ring-[#0E4EBD]/20 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Forgot Password */}
          <div className="text-right mb-4">
            <button type="button" className="text-[#0E4EBD] text-[13px] font-semibold hover:underline">
              Forgot Password?
            </button>
          </div>

          {/* Login Button */}
          <button
            onClick={handleLogin}
            disabled={isLoggingIn || !identifier.trim() || !password.trim()}
            className="w-full h-[48px] bg-gradient-to-r from-[#0E4EBD] to-[#1E70E8] text-white rounded-xl font-bold text-[15px] flex items-center justify-center gap-2 hover:opacity-95 active:scale-[0.99] transition-all shadow-md disabled:opacity-70 cursor-pointer"
          >
            {isLoggingIn ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Sign In to Officer Portal
              </>
            )}
          </button>

          {/* Error State */}
          {error && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-[13px] font-medium">{error}</p>
            </div>
          )}

          {/* Officer Registration Note */}
          <div className="mt-4 bg-gradient-to-r from-purple-50/80 to-slate-50 border border-purple-200/70 rounded-xl p-3.5 flex items-start gap-3 shadow-xs">
            <Info className="w-4 h-4 text-[#83358E] flex-shrink-0 mt-0.5" />
            <p className="text-[12px] leading-relaxed">
              <span className="text-[#83358E] font-bold">Don't have an officer account? </span>
              <span className="text-[#4B5563] font-medium">Officer accounts are created and managed by the SAO Adviser directly.</span>
            </p>
          </div>

          {/* Footer */}
          <div className="mt-4 text-center">
            <p className="text-[#9CA3AF] text-[11px]">
              © 2026 STI College Ormoc · Student Affairs Services
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
