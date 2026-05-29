import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { SparkLogo } from '../components/SparkLogo';
import { Eye, EyeOff, ShieldAlert, Sparkles, Mail, Lock, User, CheckCircle, RefreshCw } from 'lucide-react';

interface AuthProps {
  onAuthSuccess: (session: any, isNewUser?: boolean) => void;
  onBypass: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onAuthSuccess, onBypass }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [justSignedUp, setJustSignedUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isSupabaseConfigured =
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_URL !== 'your_supabase_project_url';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    
    // Domain restriction check for sign-up (Disabled to accept any domain)
    if (isSignUp) {
      if (username.length < 3) {
        setErrorMsg('Username must be at least 3 characters.');
        return;
      }
    }

    setLoading(true);

    if (!isSupabaseConfigured) {
      // Simulation mode
      await new Promise(resolve => setTimeout(resolve, 800));
      if (isSignUp) {
        setSuccessMsg('Registration simulated successfully! You can now log in.');
        setJustSignedUp(true);
        setIsSignUp(false);
      } else {
        onAuthSuccess({
          user: {
            email: email,
            id: 'mock-user-id',
          }
        }, justSignedUp);
      }
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        // Sign Up Flow
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username.toLowerCase().trim(),
              display_name: displayName.trim(),
            }
          }
        });

        if (error) throw error;
        
        // Supabase returns a user, but it may require email verification
        if (data.user && data.session) {
          onAuthSuccess(data.session, true);
        } else {
          setSuccessMsg('Sign up successful! Please check your student email to confirm registration.');
          setIsSignUp(false);
        }
      } else {
        // Log In Flow
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        if (data.session) {
          onAuthSuccess(data.session, false);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-800/40 p-8 flex flex-col gap-6 text-center">
        {/* Brand logo */}
        <div className="flex flex-col items-center gap-1 mt-2">
          <div className="flex items-center gap-3">
            <SparkLogo size={40} />
            <span className="text-4xl font-black text-[#D946EF] dark:text-[#E879F9] tracking-tighter font-sans select-none bg-gradient-to-r from-pink-500 to-fuchsia-600 bg-clip-text text-transparent">
              Spark
            </span>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">
            Academy Hub
          </p>
        </div>

        {/* Tab selector */}
        <div className="flex bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl">
          <button
            onClick={() => { setIsSignUp(false); setErrorMsg(null); setSuccessMsg(null); }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              !isSignUp 
                ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Log In
          </button>
          <button
            onClick={() => { setIsSignUp(true); setErrorMsg(null); setSuccessMsg(null); }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              isSignUp 
                ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Status Messages */}
        {errorMsg && (
          <div className="bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 p-4 rounded-2xl flex items-start gap-2.5 text-xs text-left border border-red-100 dark:border-red-900/30">
            <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="flex flex-col gap-0.5">
              <p className="font-bold">Access Denied</p>
              <p className="opacity-95 leading-relaxed">{errorMsg}</p>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 p-4 rounded-2xl flex items-start gap-2.5 text-xs text-left border border-emerald-100 dark:border-emerald-900/30">
            <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="flex flex-col gap-0.5">
              <p className="font-bold">Success</p>
              <p className="opacity-95 leading-relaxed">{successMsg}</p>
            </div>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
          {isSignUp && (
            <>
              {/* Username */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">
                  Username
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 pl-10 pr-3.5 py-2.5 rounded-2xl text-sm focus:outline-none focus:border-purple-500 text-slate-850 dark:text-slate-100"
                    placeholder="e.g. janesmith"
                    required
                  />
                  <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                </div>
              </div>

              {/* Display Name */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">
                  Full Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 pl-10 pr-3.5 py-2.5 rounded-2xl text-sm focus:outline-none focus:border-purple-500 text-slate-850 dark:text-slate-100"
                    placeholder="e.g. Jane Smith"
                    required
                  />
                  <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                </div>
              </div>
            </>
          )}

          {/* Email */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center pl-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Email Address
              </label>
            </div>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 pl-10 pr-3.5 py-2.5 rounded-2xl text-sm focus:outline-none focus:border-purple-500 text-slate-850 dark:text-slate-100"
                placeholder="Enter email"
                required
              />
              <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            </div>
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 pl-10 pr-10 py-2.5 rounded-2xl text-sm focus:outline-none focus:border-purple-500 text-slate-850 dark:text-slate-100"
                placeholder="••••••••"
                required
              />
              <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-500 text-white font-bold py-3 px-4 rounded-2xl text-sm transition-all duration-200 flex items-center justify-center gap-1.5 mt-2 shadow-lg shadow-purple-500/10 active:scale-[0.98]"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {isSignUp ? 'Create Student Account' : 'Sign In'}
          </button>
        </form>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-slate-100 dark:border-slate-800"></div>
          <span className="flex-shrink mx-4 text-[10px] text-slate-400 font-bold uppercase tracking-wider">Demo / Sandbox</span>
          <div className="flex-grow border-t border-slate-100 dark:border-slate-800"></div>
        </div>

        {/* Simulation Bypass */}
        <button
          onClick={onBypass}
          className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline py-1 focus:outline-none"
        >
          Skip Authenticator & Launch Sandbox Feed →
        </button>
      </div>
    </div>
  );
};
