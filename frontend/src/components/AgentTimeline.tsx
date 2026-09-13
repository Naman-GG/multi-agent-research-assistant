import React, { useState } from 'react';
import type { AgentName, Run, RunEvent } from '../api/types';
import {
  Brain,
  Search,
  FileText,
  ShieldCheck,
  PenTool,
  CheckCircle2,
  Loader2,
  Circle,
  Terminal,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface AgentTimelineProps {
  run: Run;
  events: RunEvent[];
  isStreaming?: boolean;
}

interface AgentStep {
  name: AgentName;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const AGENTS: AgentStep[] = [
  {
    name: 'planner',
    title: '1. Query Planner',
    description: 'Decomposes question into 3–6 focused sub-queries with contradiction intent',
    icon: <Brain className="w-5 h-5 text-indigo-400" />,
  },
  {
    name: 'retriever',
    title: '2. Academic Retriever',
    description: 'Queries OpenAlex, deduplicates papers by DOI and fuzzy title match',
    icon: <Search className="w-5 h-5 text-sky-400" />,
  },
  {
    name: 'summarizer',
    title: '3. Summarizer',
    description: 'Reads one paper at a time; extracts atomic claims with verbatim quotes',
    icon: <FileText className="w-5 h-5 text-amber-400" />,
  },
  {
    name: 'critic',
    title: '4. Verification Critic',
    description: 'Stage 1 (free deterministic span check) + Stage 2 (LLM entailment)',
    icon: <ShieldCheck className="w-5 h-5 text-emerald-400" />,
  },
  {
    name: 'synthesizer',
    title: '5. Synthesis & Report',
    description: 'Writes final literature review citing only accepted, verified claims',
    icon: <PenTool className="w-5 h-5 text-purple-400" />,
  },
];

export const AgentTimeline: React.FC<AgentTimelineProps> = ({
  run,
  events,
  isStreaming = false,
}) => {
  const [showLog, setShowLog] = useState(false);

  const getAgentStatus = (agent: AgentName) => {
    // If run is completed, all are completed
    if (run.status === 'completed') return 'completed';
    if (run.status === 'failed') return 'failed';

    const stageMap: Record<string, AgentName> = {
      planning: 'planner',
      retrieving: 'retriever',
      summarizing: 'summarizer',
      verifying: 'critic',
      synthesizing: 'synthesizer',
    };

    const currentAgent = stageMap[run.status];
    if (!currentAgent) return 'completed';

    const agentOrder: AgentName[] = ['planner', 'retriever', 'summarizer', 'critic', 'synthesizer'];
    const currentIdx = agentOrder.indexOf(currentAgent);
    const thisIdx = agentOrder.indexOf(agent);

    if (thisIdx < currentIdx) return 'completed';
    if (thisIdx === currentIdx) return 'active';
    return 'pending';
  };

  return (
    <div className="space-y-6">
      {/* 5-Agent Stepper */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {AGENTS.map((agent) => {
          const status = getAgentStatus(agent.name);
          const isDone = status === 'completed';
          const isActive = status === 'active';

          return (
            <div
              key={agent.name}
              className={`relative rounded-xl border p-4 transition-all duration-300 ${
                isActive
                  ? 'bg-slate-900 border-indigo-500/80 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/40'
                  : isDone
                  ? 'bg-slate-900/60 border-slate-800'
                  : 'bg-slate-950/40 border-slate-900 opacity-60'
              }`}
            >
              {/* Header Icon + Status */}
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60">
                  {agent.icon}
                </div>
                <div>
                  {isActive ? (
                    <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 animate-pulse">
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Running
                    </span>
                  ) : isDone ? (
                    <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Done
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-xs font-medium text-slate-500">
                      <Circle className="w-3 h-3 mr-1" />
                      Pending
                    </span>
                  )}
                </div>
              </div>

              <h4 className="text-sm font-bold text-slate-100">{agent.title}</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                {agent.description}
              </p>

              {/* Agent Specific Stat Pills */}
              {agent.name === 'planner' && run.plan && (
                <div className="mt-3 pt-2 border-t border-slate-800 text-[11px] font-mono text-indigo-300">
                  {run.plan.sub_queries.length} sub-queries planned
                </div>
              )}
              {agent.name === 'retriever' && run.papers.length > 0 && (
                <div className="mt-3 pt-2 border-t border-slate-800 text-[11px] font-mono text-sky-300">
                  {run.papers.length} papers retrieved
                </div>
              )}
              {agent.name === 'summarizer' && run.summaries.length > 0 && (
                <div className="mt-3 pt-2 border-t border-slate-800 text-[11px] font-mono text-amber-300">
                  {run.summaries.flatMap((s) => s.claims).length} claims extracted
                </div>
              )}
              {agent.name === 'critic' && run.verdicts.length > 0 && (
                <div className="mt-3 pt-2 border-t border-slate-800 text-[11px] font-mono text-emerald-300">
                  {run.verdicts.length} verdicts rendered
                </div>
              )}
              {agent.name === 'synthesizer' && run.report && (
                <div className="mt-3 pt-2 border-t border-slate-800 text-[11px] font-mono text-purple-300">
                  {run.report.citations.length} cited themes generated
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sub-Queries Planned Section */}
      {run.plan && run.plan.sub_queries.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Brain className="w-4 h-4 text-indigo-400" />
              Planned Sub-Queries ({run.plan.sub_queries.length})
            </h4>
            <span className="text-[11px] text-slate-400">
              Query Planner decomposes the main question to maximize finding coverage and surface counter-evidence
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {run.plan.sub_queries.map((sq) => (
              <div
                key={sq.id}
                className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 text-xs"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono font-bold text-slate-400 text-[10px]">
                    {sq.id}
                  </span>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${
                      sq.intent === 'contradiction'
                        ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                        : 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                    }`}
                  >
                    {sq.intent}
                  </span>
                </div>
                <p className="font-medium text-slate-200 mt-1">{sq.text}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {sq.keywords.map((kw, i) => (
                    <span
                      key={i}
                      className="font-mono text-[10px] px-1.5 py-0.5 bg-slate-900 text-slate-400 rounded border border-slate-800"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live SSE Event Log Viewer */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden">
        <button
          onClick={() => setShowLog(!showLog)}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/90 text-left hover:bg-slate-800/60 transition-colors"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>Live Agent Event Log ({events.length} events)</span>
            {isStreaming && (
              <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 animate-pulse">
                Live SSE Streaming
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <span>{showLog ? 'Collapse' : 'Expand Stream'}</span>
            {showLog ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {showLog && (
          <div className="p-4 bg-slate-950 font-mono text-xs space-y-2 max-h-72 overflow-y-auto scrollbar-thin border-t border-slate-800">
            {events.length === 0 ? (
              <div className="text-slate-500 italic">Waiting for events...</div>
            ) : (
              events.map((ev) => (
                <div
                  key={ev.seq}
                  className="flex items-start gap-3 py-1 border-b border-slate-900/80 last:border-0 hover:bg-slate-900/40 px-1 rounded transition-colors"
                >
                  <span className="text-slate-500 text-[11px] shrink-0">
                    #{ev.seq}
                  </span>
                  <span className="text-slate-400 text-[11px] shrink-0">
                    {new Date(ev.ts).toLocaleTimeString()}
                  </span>
                  <span className="font-semibold text-indigo-400 uppercase text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 shrink-0">
                    {ev.agent}
                  </span>
                  <span className="text-slate-300 font-medium">
                    {ev.message}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
