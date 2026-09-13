import React from 'react';
import { Brain, FileText, Activity, Sparkles, PlusCircle } from 'lucide-react';

interface NavbarProps {
  activeRoute: 'new' | 'trace' | 'report';
  runId?: string;
  onNavigate: (route: 'new' | 'trace' | 'report', runId?: string) => void;
  onLoadSample: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeRoute,
  runId,
  onNavigate,
  onLoadSample,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo */}
        <div
          onClick={() => onNavigate('new')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base text-slate-100 tracking-tight group-hover:text-indigo-300 transition-colors">
                ResearchAgent
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Track B
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Claim-Level Verified Multi-Agent Assistant
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => onNavigate('new')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeRoute === 'new'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Run</span>
          </button>

          <button
            onClick={() => onNavigate('trace', runId)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeRoute === 'trace'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Live Trace</span>
          </button>

          <button
            onClick={() => onNavigate('report', runId)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeRoute === 'report'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Report & Evidence</span>
          </button>
        </nav>

        {/* Quick Sample Run Button */}
        <div className="flex items-center gap-3">
          {runId && (
            <span className="font-mono text-xs text-slate-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 hidden md:inline-block">
              {runId}
            </span>
          )}

          <button
            onClick={onLoadSample}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 transition-all shadow-sm cursor-pointer"
            title="Load Pre-computed Review 1 Sample Run"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Load Demo Run</span>
          </button>
        </div>

      </div>
    </header>
  );
};
