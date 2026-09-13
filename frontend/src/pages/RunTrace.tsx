import React from 'react';
import type { Run, RunEvent } from '../api/types';
import { useRunEvents } from '../hooks/useRunEvents';
import { AgentTimeline } from '../components/AgentTimeline';
import { PaperCard } from '../components/PaperCard';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  FileText,
  Clock,
  Sparkles,
} from 'lucide-react';

interface RunTraceProps {
  run: Run;
  onNavigateToReport: (runId: string) => void;
  onEvent?: (event: RunEvent) => void;
}

export const RunTrace: React.FC<RunTraceProps> = ({
  run,
  onNavigateToReport,
  onEvent,
}) => {
  const { events, isConnected, isSimulating } = useRunEvents({
    runId: run.id,
    initialEvents: run.events,
    enabled: true,
    simulateIfOffline: true,
    onEvent,
  });

  const isComplete = run.status === 'completed' || events.some((e) => e.type === 'run_completed');

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      
      {/* Run Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                {run.id}
              </span>
              
              {isComplete ? (
                <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Pipeline Completed
                </span>
              ) : (
                <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/30 animate-pulse">
                  <Activity className="w-3.5 h-3.5 mr-1" />
                  Agents Running
                </span>
              )}

              {isSimulating && (
                <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                  Demo Simulation
                </span>
              )}
            </div>

            <h2 className="text-xl font-bold text-slate-100 mt-2">
              {run.question}
            </h2>

            <div className="flex items-center gap-4 text-xs text-slate-400 pt-1">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Started: {new Date(run.created_at).toLocaleTimeString()}
              </span>
              <span>• Max Papers: {run.config.max_papers}</span>
              <span>• Sources: {run.config.sources.join(', ')}</span>
            </div>
          </div>

          {/* Action button to view report */}
          <button
            onClick={() => onNavigateToReport(run.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer ${
              isComplete
                ? 'bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white shadow-emerald-500/20'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>{isComplete ? 'Open Final Cited Report' : 'Preview Current Report'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Completion Banner if finished */}
      {isComplete && (
        <div className="bg-gradient-to-r from-emerald-950/40 via-indigo-950/30 to-slate-900/60 border border-emerald-500/40 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30">
              <Sparkles className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-100">
                Synthesis & Verification Complete
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                All claims have been evaluated against source papers. Grounded literature review is ready.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateToReport(run.id)}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow transition-all cursor-pointer shrink-0"
          >
            <span>View Report & Evidence Pane</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 5-Agent Interactive Timeline */}
      <AgentTimeline
        run={run}
        events={events}
        isStreaming={isConnected || isSimulating}
      />

      {/* Retrieved Papers Section */}
      {run.papers.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-100">
              Retrieved & Deduplicated Papers ({run.papers.length})
            </h3>
            <span className="text-xs text-slate-400">
              Track B: OpenAlex Inverted Index Reconstruction & DOI Deduplication
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {run.papers.map((paper) => {
              const claimCount = run.summaries
                .filter((s) => s.paper_id === paper.id)
                .flatMap((s) => s.claims).length;
              return (
                <PaperCard
                  key={paper.id}
                  paper={paper}
                  claimCount={claimCount}
                />
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};
