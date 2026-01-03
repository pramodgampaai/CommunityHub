
import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import Button from '../components/ui/Button';
import { requestPasswordReset, sendContactEnquiry } from '../services/api';
import Logo from '../components/ui/Logo';
import { 
    AlertTriangleIcon, 
    ShieldCheckIcon, 
    CurrencyRupeeIcon, 
    Squares2X2Icon, 
    UserGroupIcon, 
    CheckCircleIcon,
    EnvelopeIcon,
    InformationCircleIcon
} from '../components/icons';
import { motion, AnimatePresence } from 'framer-motion';

type LoginView = 'login' | 'forgot_password' | 'about' | 'contact';

const LoginPage: React.FC = () => {
  const [view, setView] = useState<LoginView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);
  
  // Contact Form State
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');

  const { login } = useAuth();

  const handleInputChange = (setter: (v: string) => void, value: string) => {
      setter(value);
      if (error) setError(null);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setError(null);
    
    try {
      await login(email, password);
    } catch (err: any) {
      console.error('Login failed:', err);
      let errorMessage = 'An unexpected error occurred. Please try again.';
      
      if (err) {
          if (typeof err === 'string') {
              errorMessage = err;
          } else if (typeof err === 'object') {
              errorMessage = err.message || err.error_description || err.description || JSON.stringify(err);
          }
      }
      
      const lowerMsg = errorMessage.toLowerCase();
      if (
          lowerMsg.includes("invalid login credentials") || 
          lowerMsg.includes("invalid email or password") ||
          lowerMsg.includes("invalid_credentials")
      ) {
          errorMessage = "Invalid credentials. Please verify your email and security key.";
      } else if (lowerMsg.includes("email not confirmed")) {
          errorMessage = "Account registration is pending confirmation. Please check your inbox.";
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResetSuccess(false);
    try {
        await requestPasswordReset(email);
        setResetSuccess(true);
    } catch (err: any) {
        console.error('Password reset request failed:', err);
        let errorMessage = 'Failed to send reset link. Please verify the email address.';
        if (err && typeof err === 'object' && 'message' in err) {
            errorMessage = String(err.message);
        }
        setError(errorMessage);
    } finally {
        setIsLoading(false);
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
        // This transmits directly to the Supabase Edge Function anonymously
        await sendContactEnquiry({
            name: contactName,
            email: contactEmail,
            subject: contactSubject,
            message: contactMessage
        });
        setResetSuccess(true);
    } catch (err: any) {
        console.error('Enquiry submission failed:', err);
        setError(err.message || 'Transmission failed. Please check your connection.');
    } finally {
        setIsLoading(false);
    }
  };

  const toggleView = (newView: LoginView) => {
      setView(newView);
      setError(null);
      setResetSuccess(false);
  }

  const features = [
      { icon: ShieldCheckIcon, title: "Gate Control", desc: "Automated visitor protocols and security manifests." },
      { icon: CurrencyRupeeIcon, title: "Transparent Ledger", desc: "Digital maintenance tracking and expense auditing." },
      { icon: Squares2X2Icon, title: "Resource Hub", desc: "Centralized management for amenities and community assets." },
      { icon: UserGroupIcon, title: "Unified Registry", desc: "Seamless directory for residents, owners, and staff." }
  ];

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] overflow-hidden">
      
      {/* LEFT SIDE: Brand Narrative (Desktop Only) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center p-12 lg:p-24 xl:p-32 bg-brand-600 dark:bg-[#0f1115] text-white relative overflow-hidden shrink-0">
          <div className="absolute inset-0 z-0 opacity-10 pointer-events-none">
              <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(white 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
          </div>
          
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="relative z-10 space-y-8"
          >
              <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                    <Logo className="w-12 h-12 text-white" />
                  </div>
                  <h2 className="text-4xl font-brand font-extrabold tracking-tight text-white">Nilayam</h2>
              </div>

              <div className="space-y-4">
                  <h1 className="text-5xl xl:text-6xl font-brand font-extrabold tracking-tightest leading-[1.1]">
                      The Future of <br />
                      <span className="text-brand-200">Community Living.</span>
                  </h1>
                  <p className="text-lg text-brand-50/80 font-medium max-w-lg leading-relaxed">
                      Nilayam is a unified ecosystem designed to bridge the gap between residents, management, and security. We manage the complexity of township operations so you can focus on home.
                  </p>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-8">
                  {features.map((f, i) => (
                      <motion.div 
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 + (i * 0.1), duration: 0.5 }}
                        className="space-y-2"
                      >
                          <div className="flex items-center gap-3 text-brand-200">
                              <f.icon className="w-5 h-5" />
                              <h4 className="text-xs font-black uppercase tracking-widest">{f.title}</h4>
                          </div>
                          <p className="text-[11px] text-white/60 font-medium leading-relaxed">{f.desc}</p>
                      </motion.div>
                  ))}
              </div>
          </motion.div>
      </div>

      {/* RIGHT SIDE: Dynamic View Portal - FIXED SCROLLING */}
      <div className="w-full lg:w-1/2 h-full overflow-y-auto relative gpu-accelerated scroll-smooth">
        <div className="absolute inset-0 z-0 lg:hidden opacity-[0.03] dark:opacity-[0.05] pointer-events-none fixed">
            <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(var(--text-light) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
        </div>

        <div className="min-h-full flex flex-col items-center justify-center p-4 sm:p-8 lg:p-12 relative z-10">
          <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-md my-auto py-10"
          >
              <div className="bg-white dark:bg-[#121214] p-8 sm:p-12 rounded-[3rem] border border-[var(--border-light)] dark:border-white/5 shadow-2xl space-y-8">
                  <div className="flex flex-col items-center text-center">
                      <div className="mb-6 lg:hidden">
                          <Logo className="w-14 h-14 text-brand-600" />
                      </div>
                      
                      {/* Consistent Brand Title - Fixed color to prevent shifts */}
                      <h1 className="text-4xl font-brand font-extrabold text-brand-600 tracking-tightest select-none">
                          Nilayam
                      </h1>
                      
                      <div className="mt-2 px-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
                              Your Abode | Managed
                          </p>
                          <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium leading-relaxed mt-4">
                              {view === 'login' && 'Secure access to your township services.'}
                              {view === 'forgot_password' && 'Initialize security key recovery.'}
                              {view === 'about' && 'Learn about our mission and core principles.'}
                              {view === 'contact' && 'Enquire about community solutions or support.'}
                          </p>
                      </div>
                  </div>
                  
                  <AnimatePresence mode="wait">
                      {error && (
                          <motion.div 
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0 }}
                              className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl flex items-start gap-3 shadow-sm"
                          >
                              <AlertTriangleIcon className="w-5 h-5 text-rose-600 shrink-0" />
                              <p className="text-xs font-bold text-rose-800 dark:text-rose-200 leading-relaxed">{error}</p>
                          </motion.div>
                      )}
                  </AnimatePresence>
                  
                  <div className="min-h-[280px] flex flex-col justify-center">
                  {view === 'login' && (
                      <form className="space-y-6" onSubmit={handleLoginSubmit}>
                          <div className="space-y-5">
                              <div>
                                  <label className="block font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 ml-2">Email Identity</label>
                                  <input type="email" autoComplete="email" required className="input-field block w-full px-5 py-3.5 rounded-2xl text-base" placeholder="resident@nilayam.com" value={email} onChange={(e) => handleInputChange(setEmail, e.target.value)} />
                              </div>
                              <div>
                                  <label className="block font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 ml-2">Security Key</label>
                                  <input type="password" autoComplete="current-password" required className="input-field block w-full px-5 py-3.5 rounded-2xl text-base" placeholder="••••••••" value={password} onChange={(e) => handleInputChange(setPassword, e.target.value)} />
                              </div>
                              <div className="flex justify-end px-2">
                                  <button type="button" onClick={() => toggleView('forgot_password')} className="font-mono text-[10px] font-bold text-brand-600 uppercase tracking-widest hover:underline">Lost Credentials?</button>
                              </div>
                          </div>
                          <Button type="submit" size="lg" className="w-full h-14 rounded-2xl shadow-xl shadow-brand-500/10" disabled={isLoading}>{isLoading ? 'Authenticating...' : 'Sign In'}</Button>
                      </form>
                  )}

                  {view === 'forgot_password' && (
                      <form className="space-y-6" onSubmit={handleForgotSubmit}>
                          {resetSuccess ? (
                              <div className="text-center bg-emerald-50 dark:bg-emerald-900/10 p-8 rounded-3xl border border-emerald-100">
                                  <CheckCircleIcon className="w-10 h-10 mx-auto mb-4 text-emerald-600" />
                                  <p className="text-sm font-bold uppercase tracking-widest text-emerald-800 dark:text-emerald-200">Recovery Sent</p>
                                  <p className="mt-2 text-[11px] font-medium text-emerald-600/70">Check your inbox for the reset link.</p>
                              </div>
                          ) : (
                              <>
                                  <div>
                                      <label className="block font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 ml-2">Registration Email</label>
                                      <input type="email" autoComplete="email" required className="input-field block w-full px-5 py-3.5 rounded-2xl text-base" placeholder="your@email.com" value={email} onChange={(e) => handleInputChange(setEmail, e.target.value)} />
                                  </div>
                                  <Button type="submit" size="lg" className="w-full h-14 rounded-2xl" disabled={isLoading}>{isLoading ? 'Sending...' : 'Request Reset'}</Button>
                              </>
                          )}
                          <div className="text-center">
                              <button type="button" onClick={() => toggleView('login')} className="font-mono text-[10px] font-bold text-slate-400 hover:text-brand-600 uppercase tracking-widest transition-all">Back to Portal</button>
                          </div>
                      </form>
                  )}

                  {view === 'about' && (
                      <div className="space-y-6 animate-fadeIn">
                          <div className="space-y-4">
                              <div className="bg-slate-50 dark:bg-white/5 p-5 rounded-2xl border border-slate-100 dark:border-white/5">
                                  <h4 className="text-xs font-black uppercase text-brand-600 tracking-widest mb-2 flex items-center gap-2">
                                      <InformationCircleIcon className="w-4 h-4" /> Our Vision
                                  </h4>
                                  <p className="text-[11px] font-medium leading-relaxed text-slate-600 dark:text-zinc-400">
                                      Nilayam is a modern community infrastructure platform providing a central automated system for residential townships. From gate security to transparent financial tracking, we build technology that fosters trust and safety within communities.
                                  </p>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                  {['Security First', 'Transparent Ledger', 'Logistics Hub', 'Connected Living'].map(tag => (
                                      <div key={tag} className="px-3 py-2 bg-white dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-xl flex items-center gap-2">
                                          <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                                          <span className="text-[9px] font-black uppercase tracking-tight text-slate-500">{tag}</span>
                                      </div>
                                  ))}
                              </div>
                          </div>
                          <Button onClick={() => toggleView('contact')} variant="outlined" className="w-full h-12">Enquire Now</Button>
                          <div className="text-center pt-2">
                              <button type="button" onClick={() => toggleView('login')} className="font-mono text-[10px] font-bold text-slate-400 hover:text-brand-600 uppercase tracking-widest transition-all">Back to Portal</button>
                          </div>
                      </div>
                  )}

                  {view === 'contact' && (
                      <form className="space-y-4 animate-fadeIn" onSubmit={handleContactSubmit}>
                          {resetSuccess ? (
                              <div className="text-center bg-emerald-50 dark:bg-emerald-900/10 p-8 rounded-3xl border border-emerald-100">
                                  <CheckCircleIcon className="w-10 h-10 mx-auto mb-4 text-emerald-600" />
                                  <p className="text-sm font-bold uppercase tracking-widest text-emerald-800 dark:text-emerald-200">Enquiry Transmitted</p>
                                  <p className="mt-2 text-[11px] font-medium text-emerald-600/70">Your message has been delivered directly to our support team.</p>
                              </div>
                          ) : (
                              <>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      <div>
                                          <label className="block font-mono text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1 ml-1">Your Name</label>
                                          <input type="text" required className="input-field block w-full px-4 py-2 rounded-xl text-sm" placeholder="Full Name" value={contactName} onChange={e => setContactName(e.target.value)} />
                                      </div>
                                      <div>
                                          <label className="block font-mono text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1 ml-1">Contact Email</label>
                                          <input type="email" required className="input-field block w-full px-4 py-2 rounded-xl text-sm" placeholder="email@address.com" value={contactEmail} onChange={e => setContactEmail(e.target.value)} />
                                      </div>
                                  </div>
                                  <div>
                                      <label className="block font-mono text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1 ml-1">Subject</label>
                                      <input type="text" required className="input-field block w-full px-4 py-2 rounded-xl text-sm" placeholder="Community Enquiry" value={contactSubject} onChange={e => setContactSubject(e.target.value)} />
                                  </div>
                                  <div>
                                      <label className="block font-mono text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1 ml-1">Message Body</label>
                                      <textarea required className="input-field block w-full px-4 py-2 rounded-xl text-sm resize-none" rows={4} placeholder="How can we assist your community?" value={contactMessage} onChange={e => setContactMessage(e.target.value)} />
                                  </div>
                                  <Button type="submit" size="lg" className="w-full h-12 rounded-xl" disabled={isLoading} leftIcon={isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <EnvelopeIcon />}>
                                      {isLoading ? 'Transmitting...' : 'Enquire'}
                                  </Button>
                              </>
                          )}
                          <div className="text-center pt-2">
                              <button type="button" onClick={() => toggleView('login')} className="font-mono text-[10px] font-bold text-slate-400 hover:text-brand-600 uppercase tracking-widest transition-all">Back to Portal</button>
                          </div>
                      </form>
                  )}
                  </div>

                  {/* Footer Navigation */}
                  <div className="pt-8 border-t border-slate-50 dark:border-white/5 flex items-center justify-center gap-6">
                      <button onClick={() => toggleView('about')} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-brand-600 transition-colors">About Nilayam</button>
                      <div className="w-1 h-1 bg-slate-200 rounded-full" />
                      <button onClick={() => toggleView('contact')} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-brand-600 transition-colors">Contact Support</button>
                  </div>
              </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
