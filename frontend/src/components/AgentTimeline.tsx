import React from 'react';
import type { RunStatus, RunEvent } from '../api/types';
import {
  ListChecks,
  Database,
  FileText,
  ShieldCheck,
  FileCheck2,
  Check,
  Loader2,
  AlertCircle,
  Activity,
} from 'lucide-react';

interface AgentTimelineProps {
  currentStatus: RunStatus;
  events: RunEvent[];
  stats?: {
    subQueriesCount?: number;
    papersCount?: number;
    claimsCount?: number;
    rejectionsCount?: number;
    hasReport?: boolean;
  };
}

interface StepInfo {
  id: string;
  name: string;
  stage: RunStatus;
  icon: React.ReactNode;
  desc: string;
}

const STEPS: StepInfo[] = [
  {
    id: 'planner',
    name: '01. QUERY PLANNER',
    stage: 'planning',
    icon: <ListChecks className="w-4 h-4" />,
    desc: 'Breaks question into 3-6 focused sub-queries',
  },
  {
    id: 'retriever',
    name: '02. RETRIEVER',
    stage: 'retrieving',
    icon: <Database className="w-4 h-4" />,
    desc: 'Fetches OpenAlex papers & deduplicates',
  },
  {
    id: 'summarizer',
    name: '03. SUMMARIZER',
    stage: 'summarizing',
    icon: <FileText className="w-4 h-4" />,
    desc: 'Extracts verbatim claim + quote spans',
  },
  {
    id: 'critic',
    name: '04. VERIFIER CRITIC',
    stage: 'verifying',
    icon: <ShieldCheck className="w-4 h-4" />,
    desc: 'Stage 1 span check + Stage 2 entailment',
  },
  {
    id: 'synthesizer',
    name: '05. SYNTHESIZER',
    stage: 'synthesizing',
    icon: <FileCheck2 className="w-4 h-4" />,
    desc: 'Assembles cited report + BibTeX citations',
  },
];

const STAGE_ORDER: RunStatus[] = [
  'pending',
  'planning',
  'retrieving',
  'summarizing',
  'verifying',
  'synthesizing',
  'completed',
];

export const AgentTimeline: React.FC<AgentTimelineProps> = ({
  currentStatus,
  events,
  stats,
}) => {
  const currentIndex = STAGE_ORDER.indexOf(currentStatus);
  const isCompleted = currentStatus === 'completed';
  const isFailed = currentStatus === 'failed';

  const getStepStatus = (stepIndex: number, stepStage: RunStatus) => {
    if (isCompleted) return 'completed';
    if (isFailed && stepStage === currentStatus) return 'failed';

    const targetIndex = STAGE_ORDER.indexOf(stepStage);
    if (currentIndex > targetIndex) return 'completed';
    if (currentIndex === targetIndex) return 'active';
    return 'pending';
  };

  const getStepStat = (id: string) => {
    if (!stats) return null;
    switch (id) {
      case 'planner':
        return stats.subQueriesCount ? `${stats.subQueriesCount} SUB-QUERIES` : null;
      case 'retriever':
        return stats.papersCount ? `${stats.papersCount} PAPERS` : null;
      case 'summarizer':
        return stats.claimsCount ? `${stats.claimsCount} CLAIMS` : null;
      case 'critic':
        return stats.rejectionsCount !== undefined ? `${stats.rejectionsCount} CAUGHT` : null;
      case 'synthesizer':
        return stats.hasReport ? 'SYNTHESIS READY' : null;
      default:
        return null;
    }
  };

  return (
    <div className="chassis-panel rounded-2xl p-6 border-2 border-[#D2C4B4] shadow-xs relative">
      <div className="absolute top-2.5 left-2.5 mechanical-screw" />
      <div className="absolute top-2.5 right-2.5 mechanical-screw" />
      <div className="absolute bottom-2.5 left-2.5 mechanical-screw" />
      <div className="absolute bottom-2.5 right-2.5 mechanical-screw" />

      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-mono text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#81A6C6]" />
            <span>5-AGENT SEQUENTIAL PIPELINE RELAY</span>
          </h3>
          <p className="text-xs text-slate-600 font-sans mt-0.5">
            Bounded asynchronous stage orchestration with claim-level verification
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isCompleted ? (
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
              <Check className="w-3.5 h-3.5 text-emerald-700" />
              PIPELINE FINISHED
            </span>
          ) : isFailed ? (
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold px-3 py-1 rounded-full bg-rose-100 text-rose-900 border border-rose-300">
              <AlertCircle className="w-3.5 h-3.5 text-rose-700" />
              RELAY HALTED
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold px-3 py-1 rounded-full bg-[#AACDDC]/70 text-slate-900 border border-[#81A6C6]/60">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#81A6C6]" />
              ACTIVE RELAY
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5 relative">
        {STEPS.map((step, idx) => {
          const status = getStepStatus(idx, step.stage);
          const statText = getStepStat(step.id);

          let cardStyle = 'bg-[#FAF8F5] border-[#D2C4B4] text-slate-600';
          let iconContainer = 'bg-[#EFECE6] text-slate-700 border-[#D2C4B4]';

          if (status === 'completed') {
            cardStyle = 'bg-emerald-50/70 border-emerald-300 text-slate-950 shadow-2xs';
            iconContainer = 'bg-emerald-100 text-emerald-800 border-emerald-300';
          } else if (status === 'active') {
            cardStyle = 'bg-[#AACDDC]/40 border-2 border-[#81A6C6] text-slate-950 ring-2 ring-[#81A6C6]/30 shadow-sm -translate-y-1';
            iconContainer = 'bg-[#81A6C6] text-white border-[#81A6C6] soft-pulse';
          } else if (status === 'failed') {
            cardStyle = 'bg-rose-50 border-rose-300 text-slate-950';
            iconContainer = 'bg-rose-100 text-rose-800 border-rose-300';
          }

          return (
            <div
              key={step.id}
              className={`p-4 rounded-xl border flex flex-col justify-between transition-all duration-300 ${cardStyle}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg border shadow-2xs ${iconContainer}`}>
                  {step.icon}
                </div>
                <span className="font-mono text-[10px] font-black text-slate-400">#0{idx + 1}</span>
              </div>

              <div>
                <h4 className="font-mono text-[11px] font-bold text-slate-950 mb-1 flex items-center gap-1.5">
                  <span>{step.name}</span>
                  {status === 'active' && <Loader2 className="w-3 h-3 animate-spin text-[#81A6C6]" />}
                  {status === 'completed' && <Check className="w-3 h-3 text-emerald-700" />}
                </h4>
                <p className="text-[11px] text-slate-600 line-clamp-2 leading-tight font-sans">
                  {step.desc}
                </p>
              </div>

              {statText && (
                <div className="mt-3 pt-2 border-t border-[#D2C4B4] text-[10px] font-mono text-slate-900 font-bold">
                  {statText}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
