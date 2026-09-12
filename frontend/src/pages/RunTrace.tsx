import React, { useEffect, useRef } from 'react';
import { useRunEvents } from '../hooks/useRunEvents';
import { AgentTimeline } from '../components/AgentTimeline';
import type { AgentName } from '../api/types';
import {
  ArrowRight,
  CheckCircle2,
  RotateCcw,
  Terminal,
  Activity,
  Cpu,
  Radio,
  Sliders,
} from 'lucide-react';

interface RunTraceProps {
  runId: string;
  onViewReport: () => void;
  onNewRun: () => void;
}

export const RunTrace: React.FC<RunTraceProps> = ({ runId, onViewReport, onNewRun }) => {
  const logContainerRef = useRef<HTMLDivElement>(null);
  const { events, status, isConnected, error } = useRunEvents({
    runId,
    simulateIfOffline: true,
  });

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [events]);

  const subQueriesCount = events.filter((e) => e.type === 'sub_queries_planned').length
    ? (events.find((e) => e.type === 'sub_queries_planned')?.payload?.sub_queries as any[])?.length || 3
    : undefined;

  const papersCount = events.filter((e) => e.type === 'papers_retrieved').length
    ? (events.find((e) => e.type === 'papers_retrieved')?.payload?.papers as any[])?.length || 3
    : undefined;

  const claimsCount = events.filter((e) => e.type === 'claim_verified').length;
  const rejectionsCount = events.filter(
    (e) =>
      e.type === 'claim_verified' &&
      (e.payload?.verdict === 'quote_not_found' ||
        e.payload?.verdict === 'unsupported' ||
        e.payload?.verdict === 'contradicted')
  ).length;

  const isComplete = status === 'completed' || events.some((e) => e.type === 'run_completed');

  const getAgentBadge = (agent: AgentName) => {
    switch (agent) {
      case 'planner':
        return 'bg-blue-100 text-blue-900 border-blue-300';
      case 'retriever':
        return 'bg-cyan-100 text-cyan-900 border-cyan-300';
      case 'summarizer':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'critic':
        return 'bg-purple-100 text-purple-900 border-purple-300';
      case 'synthesizer':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      default:
        return 'bg-slate-200 text-slate-800 border-slate-300';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-10">
      
      {/* Telemetry Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b-2 border-[#D2C4B4]">
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-mono text-xs text-slate-600">
            <span className="font-bold px-2 py-0.5 rounded bg-[#FAF7F2] border border-[#D2C4B4] text-slate-900">
              {runId}
            </span>
            <span>·</span>
            <span className="flex items-center gap-1.5 font-bold">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isComplete ? 'bg-emerald-600' : isConnected ? 'bg-[#81A6C6] animate-ping' : 'bg-amber-500'
                }`}
              />
              <span className={isComplete ? 'text-emerald-700' : 'text-[#81A6C6]'}>
                {isComplete ? 'PROCESS COMPLETE' : isConnected ? 'LIVE SSE TELEMETRY ACTIVE' : 'CONNECTING...'}
              </span>
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-slate-950">
            Agent Matrix Telemetry & Event Bus
          </h2>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onNewRun}
            className="text-xs text-slate-800 bg-[#FAF7F2] hover:bg-[#EFECE6] px-3.5 py-2 rounded-xl border border-[#D2C4B4] transition-all flex items-center gap-1.5 font-mono font-bold shadow-xs cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
            <span>NEW SEARCH</span>
          </button>

          {isComplete && (
            <button
              onClick={onViewReport}
              className="actuator-key px-4 py-2 rounded-xl font-mono text-xs font-bold text-white tracking-wider flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <span>VIEW REPORT & EVIDENCE</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Completion Banner */}
      {isComplete && (
        <div className="p-4 rounded-xl chassis-panel border-2 border-[#81A6C6] bg-[#AACDDC]/30 flex items-center justify-between gap-4 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white border border-[#81A6C6] text-emerald-700 shadow-xs">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-serif font-bold text-slate-950">Synthesis Matrix Calibrated</h4>
              <p className="text-xs text-slate-700 font-sans">
                All 5 agents executed in sequence. 2-stage verification metrology completed with claim span coordinates.
              </p>
            </div>
          </div>

          <button
            onClick={onViewReport}
            className="actuator-key px-4 py-2 rounded-lg text-white font-mono text-xs font-bold shadow-sm transition-all cursor-pointer shrink-0"
          >
            OPEN VERIFICATION STATION →
          </button>
        </div>
      )}

      {/* 5-Agent Sequencer Timeline */}
      <AgentTimeline
        currentStatus={status}
        events={events}
        stats={{
          subQueriesCount,
          papersCount,
          claimsCount: claimsCount || undefined,
          rejectionsCount,
          hasReport: isComplete,
        }}
      />

      {/* Monotonic SSE Event Stream Bus */}
      <div className="chassis-panel rounded-2xl border-2 border-[#D2C4B4] overflow-hidden shadow-xs">
        <div className="flex items-center justify-between px-4 py-3 bg-[#EFECE6] border-b-2 border-[#D2C4B4] text-xs">
          <div className="flex items-center gap-2 text-slate-900 font-mono font-bold">
            <Terminal className="w-4 h-4 text-[#81A6C6]" />
            <span>EVENT BUS TELEMETRY (SSE MONOTONIC STREAM)</span>
          </div>

          <div className="flex items-center gap-3 text-slate-600 font-mono text-[11px] font-bold">
            <span>{events.length} EVENTS RECORDED</span>
          </div>
        </div>

        <div
          ref={logContainerRef}
          className="p-4 max-h-[440px] overflow-y-auto space-y-2.5 font-mono text-xs bg-[#FAF8F5]"
        >
          {events.length === 0 ? (
            <div className="text-slate-400 italic text-center py-8">
              Waiting for agent matrix event bus signals...
            </div>
          ) : (
            events.map((ev) => (
              <div
                key={ev.seq}
                className="p-3 rounded-xl bg-white border border-[#D2C4B4] hover:border-[#81A6C6] transition-colors flex items-start gap-3 shadow-2xs"
              >
                <span className="text-slate-400 text-[11px] font-black w-7 shrink-0">
                  #{ev.seq}
                </span>

                <span
                  className={`text-[9px] font-mono font-black uppercase tracking-wider px-2 py-0.5 rounded border shrink-0 ${getAgentBadge(
                    ev.agent
                  )}`}
                >
                  {ev.agent}
                </span>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-950 font-sans font-semibold text-xs">
                      {ev.message || ev.type}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(ev.ts).toLocaleTimeString()}
                    </span>
                  </div>

                  {ev.payload && Object.keys(ev.payload).length > 0 && (
                    <pre className="text-[11px] text-slate-800 bg-[#EFECE6] p-2.5 rounded-lg border border-[#D2C4B4] overflow-x-auto font-mono">
                      {JSON.stringify(ev.payload, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
