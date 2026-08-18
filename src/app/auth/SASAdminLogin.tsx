import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Mail, Lock, Eye, EyeOff, LogIn, AlertCircle, ShieldCheck } from 'lucide-react';
import stiOrmocLogo from '../../imports/STI_ORMOC_LOGO.jpg';
import stiSchoolPic from '../../imports/STI_SCHOOL_PIC.webp';
import { signInAdviser, getAdviserProfile } from '../modules/auth';

// ─── Firebase Auth error code → human-readable message map ───────────────────
function resolveAuthError(code: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Please try again.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a moment and try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact your administrator.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection and try again.';
    default:
      return 'Sign-in failed. Please try again.';
  }
}

export default function SASAdminLogin() {
  const navigate = useNavigate();

  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading]     = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ─── Handle sign-in ────────────────────────────────────────────────────────
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      // 1. Authenticate with Firebase Auth
      const credential = await signInAdviser(email.trim(), password);
      const uid = credential.user.uid;

      // 2. Verify the user has a profile in /sas_admins
      //    (ensures only registered advisers can access the admin portal)
      const profile = await getAdviserProfile(uid);
      if (!profile) {
        // Auth succeeded but no Firestore profile — reject access
        setErrorMessage(
          'No admin profile found for this account. Contact your system administrator.'
        );
        setIsLoading(false);
        return;
      }

      if (!profile.isActive) {
        setErrorMessage('Your account has been deactivated. Contact your system administrator.');
        setIsLoading(false);
        return;
      }

      // 3. Profile verified — navigate to admin dashboard
      navigate('/home');
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      setErrorMessage(resolveAuthError(code));
      setIsLoading(false);
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

        {/* Top Section: Text Repositioned at Top to Leave Building Clear */}
        <div className="relative z-10 max-w-[460px]">
          <div className="inline-flex items-center gap-2 bg-[#001A4D]/85 backdrop-blur-md border border-white/20 text-[#FFD41C] text-[12px] font-extrabold uppercase px-3.5 py-1 rounded-full tracking-wider mb-3 shadow-md">
            <span className="w-2 h-2 rounded-full bg-[#FFD41C] animate-pulse" />
            Student Affairs Services
          </div>
          <h1 className="text-white text-[32px] lg:text-[38px] font-black tracking-tight leading-tight mb-2">
            Connect, Participate, <br />
            <span className="text-[#FFD41C]">and Stay Updated.</span>
          </h1>
          <p className="text-white/90 text-[14px] lg:text-[15px] leading-relaxed font-normal">
            Your complete campus management platform for events, attendance, and organizational finance.
          </p>
        </div>

        {/* Middle Area Left Empty for Unobscured STI COLLEGE Building View */}
        <div className="flex-1 pointer-events-none" />

        {/* Bottom Footer Line */}
        <div className="relative z-10">
          <p className="text-white/60 text-[13px] font-medium">
            STI College Ormoc · Student Affairs Services
          </p>
        </div>
      </div>

      {/* Right Panel - Single Viewport Fit Login Form with STI_ORMOC_LOGO at top */}
      <div className="w-1/2 h-full bg-white flex items-center justify-center p-6 lg:p-10 overflow-hidden">
        <div className="w-full max-w-[480px]">
          {/* Logo Header Section */}
          <div className="text-center mb-6">
            <div className="inline-block relative mb-3 group">
              <div className="absolute -inset-1.5 bg-gradient-to-r from-[#FFD41C] to-[#0E4EBD] rounded-2xl blur-md opacity-60 group-hover:opacity-90 transition duration-500" />
              <div className="relative bg-white p-3 rounded-2xl shadow-lg border border-gray-100">
                <img
                  src={stiOrmocLogo}
                  alt="STI College Ormoc Logo"
                  className="w-20 h-20 md:w-22 md:h-22 object-contain mx-auto"
                />
              </div>
            </div>

            <h2 className="text-[#001A4D] text-[26px] md:text-[28px] font-black tracking-tight mb-0.5">
              SAS Admin Login
            </h2>
            <p className="text-[#6B7280] text-[13px] md:text-[14px]">
              Student Affairs Services — SAO Adviser Portal
            </p>
            <p className="text-[#0E4EBD] text-[12px] font-semibold mt-0.5">
              Authorized personnel access only
            </p>
          </div>

          <div className="h-px bg-[#E5E7EB] mb-5" />

          {/* Form */}
          <form onSubmit={handleLogin}>
            <div className="space-y-4 mb-4">
              {/* Email Field */}
              <div>
                <label htmlFor="sas-email" className="block text-[#001A4D] text-[13px] font-bold mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="sas-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="adviser@sti.edu.ph"
                    required
                    autoComplete="email"
                    className="w-full h-[48px] pl-10 pr-4 border border-gray-300 rounded-xl text-[14px] focus:border-[#0E4EBD] focus:ring-2 focus:ring-[#0E4EBD]/20 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="sas-password" className="block text-[#001A4D] text-[13px] font-bold mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="sas-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
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
              type="submit"
              disabled={isLoading}
              className="w-full h-[48px] bg-[#001A4D] text-[#FFD41C] rounded-xl font-bold text-[15px] flex items-center justify-center gap-2 hover:bg-[#06286B] active:scale-[0.99] transition-all shadow-md disabled:opacity-70 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#FFD41C] border-t-transparent rounded-full animate-spin" />
                  <span className="text-[#FFD41C]">Signing in...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Sign In to Admin Portal
                </>
              )}
            </button>
          </form>

          {/* Error State */}
          {errorMessage && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-[13px] font-medium">{errorMessage}</p>
            </div>
          )}

          {/* Security Notice */}
          <div className="mt-4 bg-blue-50/60 border border-blue-100 rounded-xl p-3 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#0E4EBD] flex-shrink-0 mt-0.5" />
            <p className="text-[#4B5563] text-[12px] leading-relaxed">
              This portal is strictly restricted to authorized SAO Advisers of STI College Ormoc. All sign-in activities are monitored.
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
