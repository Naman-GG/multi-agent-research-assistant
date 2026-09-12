import React from 'react';
import type { Claim, PaperRef, Verdict } from '../api/types';
import { VerdictBadge } from './VerdictBadge';
import { ChevronRight, RefreshCw, BookOpen, FileText } from 'lucide-react';

interface ClaimRowProps {
  claim: Claim;
  paper?: PaperRef;
  verdicts: Verdict[];
  selected?: boolean;
  onSelect?: () => void;
}

export const ClaimRow: React.FC<ClaimRowProps> = ({
  claim,
  paper,
  verdicts,
  selected = false,
  onSelect,
}) => {
  const finalVerdict = verdicts[verdicts.length - 1];
  const isRepaired = verdicts.some((v) => v.is_repair_attempt);
  const isAccepted = finalVerdict?.label === 'supported';

  return (
    <tr
      onClick={onSelect}
      className={`cursor-pointer transition-colors border-b border-[#E2E8F0] ${
        selected
          ? 'bg-[#AACDDC]/30'
          : isAccepted
          ? 'hover:bg-[#F8FAFC]'
          : 'bg-rose-50/40 hover:bg-rose-50/70'
      }`}
    >
      {/* Claim ID & Paper */}
      <td className="py-3.5 px-4 align-top w-28">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-xs font-bold text-slate-800">
            {claim.id}
          </span>
          {paper && (
            <span
              className={`inline-flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 rounded border ${
                paper.availability === 'abstract_only'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-[#F1F5F9] text-slate-600 border-slate-200'
              }`}
            >
              {paper.availability === 'abstract_only' ? (
                <BookOpen className="w-2.5 h-2.5 text-amber-600" />
              ) : (
                <FileText className="w-2.5 h-2.5 text-slate-500" />
              )}
              {paper.id}
            </span>
          )}
        </div>
      </td>

      {/* Claim Statement */}
      <td className="py-3.5 px-4 align-top">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-900 leading-snug">
            {claim.text}
          </p>
          <p className="text-xs text-slate-500 font-serif italic line-clamp-1">
            "{claim.quote}"
          </p>
          {isRepaired && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 font-mono">
              <RefreshCw className="w-2.5 h-2.5 animate-spin text-amber-600" />
              Repaired claim
            </span>
          )}
        </div>
      </td>

      {/* Stage 1 Status */}
      <td className="py-3.5 px-3 align-top whitespace-nowrap">
        {verdicts.find((v) => v.stage === 'span') ? (
          <VerdictBadge label={verdicts.find((v) => v.stage === 'span')!.label} size="sm" />
        ) : (
          <span className="text-xs text-slate-400 font-mono">—</span>
        )}
      </td>

      {/* Stage 2 / Final Status */}
      <td className="py-3.5 px-3 align-top whitespace-nowrap">
        {finalVerdict ? (
          <VerdictBadge label={finalVerdict.label} size="sm" />
        ) : (
          <span className="text-xs text-slate-400 font-mono">—</span>
        )}
      </td>

      {/* Inspect arrow */}
      <td className="py-3.5 px-3 align-middle text-right w-10">
        <ChevronRight
          className={`w-4 h-4 transition-transform ${
            selected ? 'text-[#81A6C6] translate-x-1' : 'text-slate-400'
          }`}
        />
      </td>
    </tr>
  );
};
