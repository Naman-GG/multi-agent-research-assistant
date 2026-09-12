import React, { useState, useEffect } from 'react';
import { NewRun } from './pages/NewRun';
import { RunTrace } from './pages/RunTrace';
import { Report } from './pages/Report';
import { sampleRun } from './api/client';
import { Compass, Sliders, Radio, Terminal, Cpu, ChevronRight } from 'lucide-react';

type ViewMode = 'new' | 'trace' | 'report';

export function App() {
  const [view, setView] = useState<ViewMode>('new');
  const [currentRunId, setCurrentRunId] = useState<string>(sampleRun.id);
  const [systemUptime, setSystemUptime] = useState('00:00:00');

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/run/')) {
        const id = hash.replace('#/run/', '');
        if (id) {
          setCurrentRunId(id);
          setView('trace');
        }
      } else if (hash.startsWith('#/report/')) {
        const id = hash.replace('#/report/', '');
        if (id) {
          setCurrentRunId(id);
          setView('report');
        }
      } else {
        setView('new');
      }
    };

    window.addEventListener('hashchange', handleHash);
    handleHash();
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Live instrument heartbeat clock
  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => {
      const diff = Math.floor((Date.now() - start) / 1000);
      const hrs = String(Math.floor(diff / 3600)).padStart(2, '0');
      const mins = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
      const secs = String(diff % 60).padStart(2, '0');
      setSystemUptime(`${hrs}:${mins}:${secs}`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const navigateToTrace = (runId: string) => {
    setCurrentRunId(runId);
    setView('trace');
    window.location.hash = `#/run/${runId}`;
  };

  const navigateToReport = (runId: string) => {
    setCurrentRunId(runId);
    setView('report');
    window.location.hash = `#/report/${runId}`;
  };

  const navigateToNew = () => {
    setView('new');
    window.location.hash = '#/lens';
  };

  return (
    <div className="min-h-screen text-slate-800 flex flex-col font-sans selection:bg-[#AACDDC] selection:text-slate-900 pb-12">
      {/* Top Edge-Docked Instrument Console */}
      <header className="sticky top-0 z-50 bg-[#FAF7F2]/95 backdrop-blur-md border-b-2 border-[#D2C4B4] shadow-xs px-4 sm:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Logo & Caliper Emblem */}
          <div
            onClick={navigateToNew}
            className="flex items-center gap-3.5 cursor-pointer group"
          >
            {/* Custom Dual-Lens Caliper Logo */}
            <div className="relative w-10 h-10 rounded-xl bg-[#F3E3D0] border-2 border-[#D2C4B4] flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <div className="absolute inset-1 rounded-lg border border-[#AACDDC]/80 pointer-events-none" />
              <Compass className="w-5 h-5 text-[#81A6C6]" />
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#81A6C6] border border-white" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-black tracking-widest text-slate-900 uppercase">
                  VERIDEX <span className="text-[#81A6C6] font-normal">// MK-IV</span>
                </span>
                <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#AACDDC]/60 text-slate-800 border border-[#81A6C6]/40 tracking-wider">
                  TRACK-B
                </span>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500 block">
                Precision Claim Verification Workbench
              </span>
            </div>
          </div>

          {/* Physical Mode Selector Tumbler */}
          <div className="flex items-center gap-2 bg-[#EFECE6] p-1.5 rounded-xl border border-[#D2C4B4] shadow-inner">
            <button
              onClick={navigateToNew}
              className={`px-4 py-1.5 rounded-lg font-mono text-xs font-bold tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                view === 'new'
                  ? 'bg-white text-slate-900 shadow-sm border border-[#D2C4B4] -translate-y-0.5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${view === 'new' ? 'bg-[#81A6C6]' : 'bg-slate-400'}`} />
              <span>01. LENS DRAFT</span>
            </button>

            <button
              onClick={() => navigateToTrace(currentRunId)}
              className={`px-4 py-1.5 rounded-lg font-mono text-xs font-bold tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                view === 'trace'
                  ? 'bg-white text-slate-900 shadow-sm border border-[#D2C4B4] -translate-y-0.5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${view === 'trace' ? 'bg-[#81A6C6]' : 'bg-slate-400'}`} />
              <span>02. TELEMETRY</span>
            </button>

            <button
              onClick={() => navigateToReport(currentRunId)}
              className={`px-4 py-1.5 rounded-lg font-mono text-xs font-bold tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                view === 'report'
                  ? 'bg-white text-slate-900 shadow-sm border border-[#D2C4B4] -translate-y-0.5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${view === 'report' ? 'bg-[#81A6C6]' : 'bg-slate-400'}`} />
              <span>03. VERIFICATION</span>
            </button>
          </div>

          {/* Instrument Telemetry Diagnostics Pill */}
          <div className="hidden lg:flex items-center gap-3 font-mono text-[10px] text-slate-600 bg-[#FAF7F2] px-3 py-1.5 rounded-lg border border-[#D2C4B4]">
            <div className="flex items-center gap-1.5">
              <Cpu className="w-3 h-3 text-[#81A6C6]" />
              <span>BUS: POLITE_POOL</span>
            </div>
            <span>|</span>
            <div className="flex items-center gap-1.5">
              <Radio className="w-3 h-3 text-emerald-600 animate-pulse" />
              <span>UPTIME: {systemUptime}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Drafting Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-6">
        {view === 'new' && (
          <NewRun
            onStartRun={navigateToTrace}
            onViewSample={() => navigateToReport(sampleRun.id)}
          />
        )}

        {view === 'trace' && (
          <RunTrace
            runId={currentRunId}
            onViewReport={() => navigateToReport(currentRunId)}
            onNewRun={navigateToNew}
          />
        )}

        {view === 'report' && (
          <Report
            runId={currentRunId}
            onBackToTrace={() => navigateToTrace(currentRunId)}
            onNewRun={navigateToNew}
          />
        )}
      </main>

      {/* Mechanical Chassis Footer Plate */}
      <footer className="mt-12 max-w-7xl mx-auto w-full px-4 sm:px-6">
        <div className="bg-[#FAF7F2] border-2 border-[#D2C4B4] rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 shadow-xs relative">
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <div className="mechanical-screw" />
            <span className="font-bold text-slate-800">VERIDEX LABS</span>
            <span>·</span>
            <span>CAPSTONE INSTRUMENT SPECIFICATION V4.2</span>
          </div>

          <div className="flex items-center gap-4 font-mono text-[10px] text-slate-500">
            <span>STAGE-1: VERBATIM SPAN CALIPER</span>
            <span>·</span>
            <span>STAGE-2: ENTAILMENT CRITIC</span>
            <div className="mechanical-screw" />
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
