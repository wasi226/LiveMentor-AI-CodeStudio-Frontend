import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import {
  Terminal, Code2, Users, Sparkles, ArrowRight, Play,
  Github, Twitter, Globe, Brain, BarChart3, Layers, Cpu,
  ChevronRight, Zap, CheckCircle, Shield, Star, Menu, X
} from 'lucide-react';

/* ─── DATA ─────────────────────────────────────── */
const features = [
  { icon: Code2,     title: 'Real-Time Collaboration', desc: 'Code together live. See every keystroke as it happens — like Google Docs built for code.', color: '#6366f1', glow: 'rgba(99,102,241,0.15)' },
  { icon: Brain,     title: 'AI Coding Tutor',         desc: 'Embedded AI that debugs, explains concepts, and suggests optimizations in context.',         color: '#a855f7', glow: 'rgba(168,85,247,0.15)' },
  { icon: BarChart3, title: 'Smart Analytics',         desc: 'Rich dashboards that reveal learning patterns, common mistakes, and performance trends.',     color: '#10b981', glow: 'rgba(16,185,129,0.15)' },
  { icon: Layers,    title: 'IDE-Like Experience',     desc: 'Syntax highlighting, tab support, line numbers and multi-language execution in the browser.',  color: '#f59e0b', glow: 'rgba(245,158,11,0.15)' },
  { icon: Users,     title: 'Classroom Management',   desc: 'Create classrooms, assign work, track every student — all from one clean dashboard.',         color: '#0ea5e9', glow: 'rgba(14,165,233,0.15)' },
  { icon: Cpu,       title: 'Live Code Execution',    desc: 'Run 7+ languages instantly and see output, errors, and AI feedback side-by-side.',             color: '#ef4444', glow: 'rgba(239,68,68,0.15)' },
];

const stats = [
  { value: '10k+', label: 'Active Students',    suffix: '' },
  { value: '500+', label: 'Classrooms',         suffix: '' },
  { value: '1M+',  label: 'Lines Executed',     suffix: '' },
  { value: '99.9', label: 'Uptime',             suffix: '%' },
];

const langs = [
  { name: 'JavaScript', color: '#facc15' },
  { name: 'Python',     color: '#60a5fa' },
  { name: 'Java',       color: '#fb923c' },
  { name: 'C++',        color: '#22d3ee' },
  { name: 'TypeScript', color: '#818cf8' },
  { name: 'Go',         color: '#2dd4bf' },
  { name: 'Rust',       color: '#fb7185' },
];

const codeTokens = [
  [{ c: '#7c86ff', t: 'function ' }, { c: '#fbbf24', t: 'fibonacci' }, { c: '#94a3b8', t: '(n) {' }],
  [{ c: '#7c86ff', t: '  if ' }, { c: '#94a3b8', t: '(n <= ' }, { c: '#34d399', t: '1' }, { c: '#94a3b8', t: ') ' }, { c: '#7c86ff', t: 'return ' }, { c: '#f97316', t: 'n' }, { c: '#94a3b8', t: ';' }],
  [{ c: '#94a3b8', t: '  ' }, { c: '#7c86ff', t: 'return ' }, { c: '#fbbf24', t: 'fibonacci' }, { c: '#94a3b8', t: '(n-' }, { c: '#34d399', t: '1' }, { c: '#94a3b8', t: ') + ' }, { c: '#fbbf24', t: 'fibonacci' }, { c: '#94a3b8', t: '(n-' }, { c: '#34d399', t: '2' }, { c: '#94a3b8', t: ');' }],
  [{ c: '#94a3b8', t: '}' }],
];

const testimonials = [
  { name: 'Dr. Sarah Chen',   role: 'CS Professor, MIT',        text: 'CodeClass.ai transformed how my 300-student class collaborates. The AI tutor reduced my office hours by 60%.', stars: 5 },
  { name: 'Alex Rodriguez',  role: 'Student, Stanford',         text: 'Getting instant AI feedback while coding feels like having a senior dev sitting next to me. My grades went from B to A.', stars: 5 },
  { name: 'Prof. James Park', role: 'Director, Coding Bootcamp', text: 'The analytics dashboard shows exactly which concepts students struggle with. Game-changer for curriculum design.', stars: 5 },
];

/* ─── ANIMATED CURSOR BEACON ───────────────────── */
function CursorBeacon({ x, y, label, color }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="absolute pointer-events-none z-20 flex flex-col items-start gap-1"
      style={{ left: x, top: y }}
    >
      <div className="w-3.5 h-3.5 rounded-full border-2 border-white shadow-lg" style={{ background: color }} />
      <span className="text-[10px] font-semibold text-white px-2 py-0.5 rounded-full whitespace-nowrap shadow-lg" style={{ background: color }}>
        {label}
      </span>
    </motion.div>
  );
}

/* ─── FLOATING PARTICLE ─────────────────────────── */
function FloatingOrb({ style }) {
  return <div className="absolute rounded-full pointer-events-none" style={style} />;
}

/* ─── MAIN COMPONENT ────────────────────────────── */
export default function Landing() {
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '20%']);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  const navItems = ['Features', 'Preview', 'Testimonials'];

  // Auto-cycle testimonials
  useEffect(() => {
    const t = setInterval(() => setActiveTestimonial(p => (p + 1) % testimonials.length), 4000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="relative min-h-screen bg-[#04080f] text-white overflow-x-hidden">

      {/* ── NAVBAR ── */}
      <nav className="fixed top-0 w-full z-50">
        <div className="absolute inset-0 bg-[#04080f]/80 backdrop-blur-xl border-b border-white/5" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Terminal style={{ width: 15, height: 15 }} className="text-white" />
            </div>
            <span className="text-[14px] sm:text-[16px] font-black tracking-tight truncate">CodeClass<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">.ai</span></span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            {navItems.map(item => (
              <a key={item} href={`#${item.toLowerCase()}`}
                className="text-[13px] text-slate-500 hover:text-white transition-colors duration-200 font-medium">
                {item}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-2">
            <Link to="/role-selection">
              <button className="text-[13px] text-slate-400 hover:text-white transition-colors px-4 py-2 font-medium">Log In</button>
            </Link>
            <Link to="/role-selection">
              <button className="relative group text-[13px] font-semibold h-9 px-5 rounded-xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 group-hover:from-indigo-500 group-hover:to-violet-500 transition-all duration-200" />
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.15),transparent)]" />
                <span className="relative flex items-center gap-1.5">Get Started <ArrowRight style={{ width: 13, height: 13 }} /></span>
              </button>
            </Link>
          </div>

          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden w-9 h-9 rounded-lg border border-slate-800/80 bg-slate-900/50 text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors flex items-center justify-center"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? <X style={{ width: 16, height: 16 }} /> : <Menu style={{ width: 16, height: 16 }} />}
          </button>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.18 }}
              className="md:hidden relative border-t border-white/5 bg-[#070d18]/95 backdrop-blur-xl"
            >
              <div className="px-4 py-3 space-y-3">
                <div className="flex flex-col gap-1.5">
                  {navItems.map((item) => (
                    <a
                      key={item}
                      href={`#${item.toLowerCase()}`}
                      onClick={() => setMobileMenuOpen(false)}
                      className="text-[13px] text-slate-300 hover:text-white px-2 py-2 rounded-lg hover:bg-slate-800/60 transition-colors"
                    >
                      {item}
                    </a>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Link to="/role-selection" onClick={() => setMobileMenuOpen(false)}>
                    <button className="w-full h-9 text-[13px] text-slate-300 bg-slate-900/70 border border-slate-800/70 rounded-lg hover:bg-slate-800 transition-colors font-medium">
                      Log In
                    </button>
                  </Link>
                  <Link to="/role-selection" onClick={() => setMobileMenuOpen(false)}>
                    <button className="w-full h-9 text-[13px] text-white rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 font-semibold">
                      Get Started
                    </button>
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ── HERO ── */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Deep glow orbs */}
          <FloatingOrb style={{ width: 800, height: 800, top: '-200px', left: '50%', transform: 'translateX(-50%)', background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)' }} />
          <FloatingOrb style={{ width: 600, height: 600, top: '10%', right: '-10%', background: 'radial-gradient(circle, rgba(168,85,247,0.08) 0%, transparent 70%)' }} />
          <FloatingOrb style={{ width: 400, height: 400, bottom: '20%', left: '-5%', background: 'radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%)' }} />
          {/* Fine grid */}
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)',
            backgroundSize: '60px 60px'
          }} />
          {/* Radial fade over grid */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,transparent_40%,#04080f_100%)]" />
          {/* Horizontal lines */}
          {[...Array(5)].map((_, i) => (
            <div key={i} className="absolute w-full h-px" style={{
              top: `${20 + i * 15}%`,
              background: `linear-gradient(90deg, transparent, rgba(99,102,241,${0.03 + i * 0.01}), transparent)`
            }} />
          ))}
        </div>

        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 mb-8"
          >
            <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-indigo-500/20 bg-indigo-500/5 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              <span className="text-[12px] font-medium text-indigo-300">AI-Powered Collaborative Coding Platform</span>
              <ChevronRight style={{ width: 12, height: 12 }} className="text-indigo-400" />
            </div>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-6xl md:text-[80px] lg:text-[96px] font-black tracking-tight leading-[0.95] mb-8"
          >
            <span className="block text-white">Code Together.</span>
            <span className="block relative">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400">
                Learn Faster.
              </span>
              {/* Underline shimmer */}
              <span className="absolute bottom-1 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />
            </span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-[17px] md:text-[20px] text-slate-400 max-w-2xl mx-auto leading-relaxed font-light mb-10"
          >
            The modern coding classroom where students and faculty collaborate in real-time —
            powered by an AI tutor that's always there to help.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12"
          >
            <Link to="/role-selection">
              <button className="group relative h-13 px-8 rounded-2xl font-semibold text-[15px] overflow-hidden" style={{ height: 52 }}>
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600" />
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-indigo-500 to-violet-500" />
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                <span className="relative flex items-center gap-2.5">
                  <Play style={{ width: 15, height: 15 }} className="fill-white" />
                  Start Coding Free
                </span>
              </button>
            </Link>
            <Link to="/role-selection">
              <button className="group h-13 px-8 rounded-2xl font-semibold text-[15px] border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all duration-200 backdrop-blur-sm flex items-center gap-2.5" style={{ height: 52 }}>
                Sign In
                <ArrowRight style={{ width: 14, height: 14 }} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </Link>
          </motion.div>

          {/* Language pills */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="flex flex-wrap items-center justify-center gap-2"
          >
            {langs.map((l, i) => (
              <motion.span
                key={l.name}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + i * 0.06 }}
                className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 border border-slate-800/80 bg-slate-900/40 px-3 py-1.5 rounded-full backdrop-blur-sm hover:border-slate-700 transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: l.color }} />
                {l.name}
              </motion.span>
            ))}
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <span className="text-[10px] text-slate-600 uppercase tracking-widest font-medium">Scroll</span>
          <div className="w-px h-12 bg-gradient-to-b from-indigo-500/40 to-transparent" />
        </motion.div>
      </section>

      {/* ── IDE PREVIEW ── */}
      <section id="preview" className="relative px-6 py-24">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px]" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)' }} />
        </div>

        <div className="max-w-5xl mx-auto">
          {/* Section label */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest">Live Preview</span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mt-3">The Full IDE Experience</h2>
            <p className="text-slate-500 mt-3 text-[15px] max-w-lg mx-auto">Code editor + live collaboration + AI tutor, all in one browser tab.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="relative"
          >
            {/* Glow behind window */}
            <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-purple-500/10 rounded-3xl blur-2xl" />

            <div className="relative rounded-2xl overflow-hidden border border-white/8 shadow-[0_40px_120px_rgba(0,0,0,0.8)]" style={{ background: '#0d1117' }}>
              {/* Title bar */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/6" style={{ background: '#090e18' }}>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-rose-500" />
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <div className="px-3 py-1 rounded-md bg-slate-800/60 border border-slate-700/40 text-[11px] font-mono text-slate-400">
                      main.js
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="hidden md:flex items-center gap-2">
                    {[['S', '#6366f1'], ['A', '#10b981'], ['M', '#f59e0b']].map(([l, c]) => (
                      <div key={l} className="flex items-center gap-1.5 text-[10px] text-slate-400">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: c }}>{l}</div>
                        {l === 'S' && 'editing'}{l === 'A' && 'viewing'}{l === 'M' && 'idle'}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    3 live
                  </div>
                </div>
              </div>

              {/* Editor body */}
              <div className="flex" style={{ minHeight: 260 }}>
                {/* Participants sidebar mini */}
                <div className="hidden lg:flex flex-col w-40 border-r border-white/5" style={{ background: '#070b13' }}>
                  <div className="px-3 py-2.5 border-b border-white/5">
                    <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Participants</span>
                  </div>
                  <div className="p-2 space-y-1">
                    {[{ l: 'S', name: 'Sarah',    role: 'Student',     c: '#6366f1', status: 'editing' },
                      { l: 'A', name: 'Alex',     role: 'Student',     c: '#10b981', status: 'viewing' },
                      { l: 'M', name: 'Prof. Min', role: 'Instructor', c: '#f59e0b', status: 'online' }
                    ].map(p => (
                      <div key={p.l} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/3 transition-colors">
                        <div className="relative">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: p.c }}>{p.l}</div>
                          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-[#070b13]" />
                        </div>
                        <div>
                          <p className="text-[10px] font-medium text-slate-400">{p.name}</p>
                          <p className="text-[9px] text-slate-700">{p.status}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Code editor */}
                <div className="flex-1 flex" style={{ background: '#0d1117' }}>
                  <div className="select-none py-5 px-3 border-r border-white/4 text-right" style={{ background: '#0a0f1a', minWidth: 40 }}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <div key={n} className="text-[12px] text-slate-700 font-mono leading-7 h-7 tabular-nums">{n}</div>
                    ))}
                  </div>
                  <div className="flex-1 p-5 font-mono text-[13px] leading-7 relative">
                    {/* Collaborative cursor */}
                    <CursorBeacon x={260} y={8} label="Sarah" color="#6366f1" />
                    {codeTokens.map((line, i) => (
                      <div key={i}>
                        {line.map((t, j) => <span key={j} style={{ color: t.c }}>{t.t}</span>)}
                      </div>
                    ))}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="inline-block w-0.5 h-5 bg-indigo-400 animate-pulse" />
                      <span className="text-slate-700 text-[11px] italic">// 💡 AI: memoize for O(n) — add a cache object</span>
                    </div>
                  </div>
                </div>

                {/* AI Panel */}
                <div className="hidden xl:flex flex-col w-64 border-l border-white/5" style={{ background: '#080c17' }}>
                  <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/5">
                    <div className="w-4 h-4 rounded-md bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                      <Sparkles style={{ width: 9, height: 9 }} className="text-white" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">AI Tutor</span>
                    <span className="ml-auto flex items-center gap-1 text-[9px] text-emerald-400">
                      <span className="w-1 h-1 rounded-full bg-emerald-400" />online
                    </span>
                  </div>
                  <div className="p-3 space-y-3 flex-1">
                    <div className="bg-slate-800/50 border border-white/5 rounded-xl rounded-tl-sm p-2.5">
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Your recursive approach runs in <span className="text-rose-400 font-semibold">O(2ⁿ)</span> time.
                        Add a memo object to cache results and get <span className="text-emerald-400 font-semibold">O(n)</span>. 🚀
                      </p>
                    </div>
                    <div className="flex justify-end">
                      <div className="bg-indigo-600 rounded-xl rounded-tr-sm p-2.5 max-w-[85%]">
                        <p className="text-[11px] text-white">Show me the optimized version</p>
                      </div>
                    </div>
                    <div className="bg-slate-800/50 border border-white/5 rounded-xl rounded-tl-sm p-2.5">
                      <pre className="text-[10px] text-emerald-300 font-mono leading-5">{`const memo = {};
function fib(n) {
  if (n in memo) return memo[n];
  if (n <= 1) return n;
  return memo[n] = fib(n-1) + fib(n-2);
}`}</pre>
                    </div>
                  </div>
                  <div className="p-3 border-t border-white/5">
                    <div className="flex items-center gap-2 bg-slate-900/60 border border-white/6 rounded-xl px-3 py-2">
                      <span className="text-[11px] text-slate-600">Ask anything...</span>
                      <div className="ml-auto w-5 h-5 rounded-lg bg-violet-600 flex items-center justify-center">
                        <ArrowRight style={{ width: 9, height: 9 }} className="text-white" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status bar */}
              <div className="flex items-center justify-between px-5 py-2 border-t border-white/5 text-[10px] font-mono" style={{ background: '#090e18' }}>
                <div className="flex items-center gap-4 text-slate-600">
                  <span>⚡ JavaScript</span>
                  <span>UTF-8</span>
                  <span>Ln 5, Col 1</span>
                </div>
                <div className="flex items-center gap-3">
                  <button className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-600/80 text-emerald-100 text-[10px] font-semibold hover:bg-emerald-600 transition-colors">
                    <Play style={{ width: 9, height: 9 }} className="fill-emerald-100" /> Run Code
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-indigo-600/80 text-indigo-100 text-[10px] font-semibold hover:bg-indigo-600 transition-colors">
                    Submit
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── STATS BAND ── */}
      <section className="relative px-6 py-20 overflow-hidden">
        <div className="absolute inset-0 border-y border-white/4" style={{ background: 'linear-gradient(180deg, transparent, rgba(99,102,241,0.03), transparent)' }} />
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 relative">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center group"
            >
              <div className="text-4xl md:text-5xl font-black tabular-nums mb-2" style={{
                background: 'linear-gradient(135deg, #a5b4fc, #c084fc)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                {s.value}{s.suffix}
              </div>
              <p className="text-[12px] text-slate-500 font-semibold uppercase tracking-wider">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="px-6 py-24">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest">Everything You Need</span>
            <h2 className="text-3xl md:text-5xl font-bold text-white mt-3 leading-tight">Built for Modern<br />Code Education</h2>
            <p className="text-slate-500 mt-4 text-[16px] max-w-xl mx-auto leading-relaxed">
              Every feature is purposefully designed to make teaching and learning code more effective.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="group relative rounded-2xl border border-white/6 p-6 hover:border-white/12 transition-all duration-300 overflow-hidden cursor-default"
                style={{ background: 'rgba(255,255,255,0.02)' }}
              >
                {/* Hover glow */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
                  style={{ background: `radial-gradient(ellipse at top left, ${f.glow} 0%, transparent 60%)` }} />

                <div className="relative">
                  <div className="flex items-start justify-between mb-5">
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300"
                      style={{ background: `linear-gradient(135deg, ${f.color}22, ${f.color}44)`, border: `1px solid ${f.color}30` }}>
                      <f.icon style={{ width: 20, height: 20, color: f.color }} />
                    </div>
                    <div className="w-2 h-2 rounded-full mt-1.5 opacity-60" style={{ background: f.color }} />
                  </div>
                  <h3 className="text-[15px] font-bold text-white mb-2.5 group-hover:text-white transition-colors">{f.title}</h3>
                  <p className="text-[13px] text-slate-500 leading-relaxed group-hover:text-slate-400 transition-colors">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section id="testimonials" className="px-6 py-24">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <span className="text-[11px] font-bold text-violet-400 uppercase tracking-widest">Testimonials</span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mt-3">Loved by Educators & Students</h2>
          </motion.div>

          <div className="relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTestimonial}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="relative rounded-3xl border border-white/8 p-8 md:p-12 text-center overflow-hidden"
                style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.05), rgba(168,85,247,0.05))' }}
              >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-1 rounded-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.6), transparent)' }} />
                <div className="flex justify-center mb-4">
                  {[...Array(testimonials[activeTestimonial].stars)].map((_, i) => (
                    <Star key={i} style={{ width: 16, height: 16 }} className="text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-[17px] md:text-[20px] text-slate-200 leading-relaxed font-light mb-8 max-w-2xl mx-auto">
                  "{testimonials[activeTestimonial].text}"
                </p>
                <div>
                  <p className="text-[14px] font-bold text-white">{testimonials[activeTestimonial].name}</p>
                  <p className="text-[12px] text-slate-500 mt-0.5">{testimonials[activeTestimonial].role}</p>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Dots */}
            <div className="flex justify-center gap-2 mt-6">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveTestimonial(i)}
                  className="transition-all duration-300 rounded-full"
                  style={{
                    width: i === activeTestimonial ? 24 : 8,
                    height: 8,
                    background: i === activeTestimonial ? 'linear-gradient(90deg, #6366f1, #a855f7)' : 'rgba(255,255,255,0.1)',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-6 py-24">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto text-center relative"
        >
          {/* Card */}
          <div className="relative rounded-3xl overflow-hidden p-12 md:p-16">
            {/* Background */}
            <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(168,85,247,0.08) 50%, rgba(99,102,241,0.05) 100%)' }} />
            <div className="absolute inset-0 border border-white/8 rounded-3xl" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />

            {/* Content */}
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] text-slate-400 mb-6">
                <Zap style={{ width: 11, height: 11 }} className="text-amber-400" />
                Free to start · No credit card required
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
                Start Teaching<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">Smarter Today</span>
              </h2>
              <p className="text-slate-400 text-[16px] mb-10 max-w-md mx-auto leading-relaxed">
                Join 10,000+ students and educators already using CodeClass.ai
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link to="/student-dashboard">
                  <button className="group relative h-14 px-10 rounded-2xl font-bold text-[15px] overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 group-hover:from-indigo-500 group-hover:to-violet-500 transition-all" />
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                    <span className="relative flex items-center gap-2.5">
                      Get Started Free
                      <ArrowRight style={{ width: 16, height: 16 }} className="group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </button>
                </Link>
                <Link to="/faculty-dashboard">
                  <button className="h-14 px-10 rounded-2xl font-bold text-[15px] border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all">
                    Faculty Dashboard
                  </button>
                </Link>
              </div>
              {/* Trust badges */}
              <div className="flex items-center justify-center gap-6 mt-10 pt-8 border-t border-white/6">
                {[
                  { icon: Shield, text: 'Enterprise Security' },
                  { icon: CheckCircle, text: 'FERPA Compliant' },
                  { icon: Zap, text: '99.9% Uptime SLA' },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                    <Icon style={{ width: 12, height: 12 }} className="text-slate-700" />
                    {text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="px-6 py-10 border-t border-white/5">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Terminal style={{ width: 13, height: 13 }} className="text-white" />
            </div>
            <span className="font-black text-[14px] text-white">CodeClass<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">.ai</span></span>
          </div>
          <p className="text-[11px] text-slate-700 font-medium">© 2026 CodeClass.ai · AI-Powered Collaborative Coding Education</p>
          <div className="flex items-center gap-4">
            {[Globe, Github, Twitter].map((Icon, i) => (
              <a key={i} href="#" className="w-8 h-8 rounded-lg bg-white/4 border border-white/6 flex items-center justify-center text-slate-600 hover:text-slate-300 hover:bg-white/8 transition-all">
                <Icon style={{ width: 14, height: 14 }} />
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}