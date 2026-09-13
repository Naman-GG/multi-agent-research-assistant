import React from 'react';
import type { Claim, PaperRef, Verdict } from '../api/types';
import { VerdictBadge } from './VerdictBadge';
import { Quote, AlertOctagon, CheckCircle2, ChevronRight } from 'lucide-react';

interface ClaimRowProps {
  claim: Claim;
  paper?: PaperRef;
  verdicts: Verdict[];
  isSelected?: boolean;
  onSelect?: (claimId: string) => void;
}

export const ClaimRow: React.FC<ClaimRowProps> = ({
  claim,
  paper,
  verdicts,
  isSelected = false,
  onSelect,
}) => {
  const stage1Verdict = verdicts.find((v) => v.stage === 'span');
  const stage2Verdict = verdicts.find((v) => v.stage === 'entailment');
  const finalVerdict = verdicts.length > 0 ? verdicts[verdicts.length - 1] : null;

  const isAccepted = finalVerdict?.label === 'supported';
  const isFabrication = stage1Verdict?.label === 'quote_not_found';

  return (
    <div
      onClick={() => onSelect?.(claim.id)}
      className={`group cursor-pointer rounded-xl border p-4 transition-all duration-200 ${
        isSelected
          ? 'bg-slate-800/90 border-indigo-500 shadow-md shadow-indigo-500/10 ring-1 ring-indigo-500/50'
          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Header tags */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60">
              {claim.id}
            </span>

            {paper && (
              <span className="text-xs text-slate-400 font-mono bg-slate-800/70 px-2 py-0.5 rounded truncate max-w-[200px]">
                {paper.id}: {paper.title}
              </span>
            )}

            {claim.section && (
              <span className="text-xs text-slate-400 italic">
                § {claim.section}
              </span>
            )}

            {/* Overall status indicator */}
            {isFabrication ? (
              <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-bold bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse">
                <AlertOctagon className="w-3 h-3 mr-1 text-red-400" />
                Fabricated Quote Caught
              </span>
            ) : isAccepted ? (
              <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-400" />
                Accepted (Synthesized)
              </span>
            ) : (
              <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium bg-rose-500/15 text-rose-300 border border-rose-500/30">
                <AlertOctagon className="w-3 h-3 mr-1 text-rose-400" />
                Rejected
              </span>
            )}
          </div>

          {/* Claim Text */}
          <h5 className="text-sm font-semibold text-slate-100 leading-snug">
            "{claim.text}"
          </h5>

          {/* Verbatim quote snippet */}
          <div className="mt-2.5 flex items-start gap-2 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/70 text-xs text-slate-300 font-mono">
            <Quote className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
            <span className="line-clamp-2 italic">
              "{claim.quote}"
            </span>
          </div>

          {/* Two-Stage Verdict Badges */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {stage1Verdict && (
              <VerdictBadge
                label={stage1Verdict.label}
                stage="span"
                matchScore={stage1Verdict.match_score}
                size="sm"
              />
            )}
            {stage2Verdict && (
              <VerdictBadge
                label={stage2Verdict.label}
                stage="entailment"
                confidence={stage2Verdict.confidence}
                size="sm"
              />
            )}
            {stage2Verdict?.reasoning && (
              <span className="text-xs text-slate-400 italic line-clamp-1">
                — {stage2Verdict.reasoning}
              </span>
            )}
          </div>
        </div>

        <div className="self-center shrink-0 text-slate-500 group-hover:text-indigo-400 transition-colors">
          <ChevronRight className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};
