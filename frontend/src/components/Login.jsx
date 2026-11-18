import { useState } from 'react';
import { MessageSquare, LogIn, UserPlus, Zap, Shield, Globe, ArrowRight } from 'lucide-react';
import api from '../api';

const FEATURES = [
  { icon: Zap,    label: 'Real-time messaging with WebSockets' },
  { icon: Shield, label: 'Secure JWT authentication' },
  { icon: Globe,  label: 'Group channels & private rooms' },
];

export default function Login({ onAuth }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = isRegister ? '/register/' : '/login/';
      const payload = isRegister ? { username, email, password } : { username, password };
      const res = await api.post(endpoint, payload);
      onAuth(res.data);
    } catch (err) {
      const data = err.response?.data;
      if (data?.error) setError(data.error);
      else if (data?.username) setError(data.username[0]);
      else setError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex">

      {/* ── Animated mesh background ── */}
      <div className="absolute inset-0 bg-[#060612]">
        <div className="mesh-blob w-[600px] h-[600px] bg-indigo-600/20 top-[-15%] left-[-10%]"
             style={{ animationDelay: '0s' }} />
        <div className="mesh-blob w-[500px] h-[500px] bg-purple-600/15 bottom-[-10%] right-[-5%]"
             style={{ animationDelay: '-5s' }} />
        <div className="mesh-blob w-[400px] h-[400px] bg-fuchsia-600/10 top-[40%] left-[50%]"
             style={{ animationDelay: '-10s' }} />
        <div className="mesh-blob w-[300px] h-[300px] bg-cyan-500/8 top-[10%] right-[20%]"
             style={{ animationDelay: '-15s' }} />
        {/* grid overlay */}
        <div className="absolute inset-0 opacity-[0.03]"
             style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
      </div>

      {/* ── Left: branding panel (hidden on mobile) ── */}
      <div className="hidden lg:flex flex-1 relative z-10 flex-col justify-center px-16 xl:px-24">
        <div className="fade-in max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-fuchsia-500 mb-8 shadow-2xl shadow-indigo-500/30 pulse-ring">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-5xl xl:text-6xl font-black text-white leading-tight tracking-tight mb-4">
            Chat<span className="gradient-text">ter</span>Box
          </h1>
          <p className="text-lg text-gray-400 leading-relaxed mb-10">
            Connect instantly. Chat in real-time. Build communities.
            The modern messaging platform built for speed.
          </p>
          <div className="space-y-4">
            {FEATURES.map(({ icon: Icon, label }, i) => (
              <div key={i} className="flex items-center gap-4 fade-in-delay">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-indigo-400" />
                </div>
                <span className="text-sm text-gray-300">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right: auth form ── */}
      <div className="flex-1 flex items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-[420px] fade-in-delay">

          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-fuchsia-500 mb-4 shadow-xl shadow-indigo-500/25">
              <MessageSquare className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl font-extrabold text-white">
              Chat<span className="gradient-text">ter</span>Box
            </h1>
          </div>

          {/* Card */}
          <div className="glass rounded-3xl p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-1">
              {isRegister ? 'Create your account' : 'Sign in'}
            </h2>
            <p className="text-gray-500 text-sm mb-7">
              {isRegister ? 'Start chatting in seconds' : 'Welcome back — we missed you'}
            </p>

            {error && (
              <div className="mb-5 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Username</label>
                <div className="glow-focus rounded-xl">
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)} required
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none transition-all text-sm"
                    placeholder="Choose a username" />
                </div>
              </div>

              {isRegister && (
                <div className="fade-in">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Email <span className="text-gray-600 normal-case">(optional)</span>
                  </label>
                  <div className="glow-focus rounded-xl">
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none transition-all text-sm"
                      placeholder="you@example.com" />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Password</label>
                <div className="glow-focus rounded-xl">
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none transition-all text-sm"
                    placeholder="Minimum 6 characters" />
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 hover:from-indigo-500 hover:via-purple-500 hover:to-fuchsia-500 text-white font-semibold shadow-xl shadow-purple-500/20 hover:shadow-purple-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] mt-6 group">
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white" />
                ) : isRegister ? (
                  <><UserPlus className="w-5 h-5" /> Create Account <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform" /></>
                ) : (
                  <><LogIn className="w-5 h-5" /> Continue <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform" /></>
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-white/5 text-center">
              <button onClick={() => { setIsRegister(!isRegister); setError(''); }}
                className="text-sm text-gray-400 hover:text-white transition group">
                {isRegister ? (
                  <span>Already have an account? <span className="text-indigo-400 font-medium group-hover:text-indigo-300">Sign in</span></span>
                ) : (
                  <span>New here? <span className="text-indigo-400 font-medium group-hover:text-indigo-300">Create an account</span></span>
                )}
              </button>
            </div>
          </div>

          <p className="text-center text-[11px] text-gray-700 mt-6">
            Built with Django Channels · React · WebSockets
          </p>
        </div>
      </div>
    </div>
  );
}
