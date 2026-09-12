import React from 'react';
import type { Claim, PaperRef, Verdict } from '../api/types';
import { sourceText } from '../api/types';
import { VerdictBadge } from './VerdictBadge';
import {
  ShieldAlert,
  Sparkles,
  BookOpen,
  FileText,
  Ban,
  CheckCircle2,
  Maximize2,
  ScanLine,
  SlidersHorizontal,
  Compass,
} from 'lucide-react';

interface EvidencePaneProps {
  claim: Claim | null;
  paper: PaperRef | null;
  verdicts: Verdict[];
  onClose?: () => void;
}

export const EvidencePane: React.FC<EvidencePaneProps> = ({
  claim,
  paper,
  verdicts,
  onClose,
}) => {
  if (!claim || !paper) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-12 text-center text-slate-500 chassis-panel rounded-2xl border-2 border-[#D2C4B4]">
        <Compass className="w-12 h-12 text-[#81A6C6] mb-3 animate-spin" style={{ animationDuration: '10s' }} />
        <h4 className="text-base font-serif font-bold text-slate-800 mb-1">
          Optical Comparator Inactive
        </h4>
        <p className="text-xs text-slate-500 max-w-sm font-sans">
          Select any claim from the report or index matrix to calibrate the verbatim quote span comparator.
        </p>
      </div>
    );
  }

  const rawSource = sourceText(paper);
  const stage1Verdict = verdicts.find((v) => v.stage === 'span');
  const stage2Verdict = verdicts.find((v) => v.stage === 'entailment');
  const isRejected = verdicts.some(
    (v) => v.label === 'quote_not_found' || v.label === 'unsupported' || v.label === 'contradicted'
  );
  const isQuoteNotFound =
    verdicts.some((v) => v.label === 'quote_not_found') ||
    (claim.quote_start === null && claim.quote_end === null);

  const renderSourceWithHighlight = () => {
    if (!rawSource) {
      return <p className="text-slate-500 italic text-xs">No source text available for this paper.</p>;
    }

    if (
      claim.quote_start !== null &&
      claim.quote_end !== null &&
      claim.quote_start >= 0 &&
      claim.quote_end <= rawSource.length &&
      claim.quote_start < claim.quote_end
    ) {
      const before = rawSource.slice(0, claim.quote_start);
      const match = rawSource.slice(claim.quote_start, claim.quote_end);
      const after = rawSource.slice(claim.quote_end);

      return (
        <div className="text-xs leading-relaxed text-slate-800 font-serif whitespace-pre-wrap select-text">
          <span>{before}</span>
          <mark className="bg-[#AACDDC] text-slate-950 font-bold px-1.5 py-0.5 rounded border border-[#81A6C6] shadow-sm mx-0.5 underline decoration-[#81A6C6] decoration-2">
            {match}
          </mark>
          <span>{after}</span>
        </div>
      );
    }

    const paragraphs = rawSource.split('\n\n');
    return (
      <div className="space-y-3 text-xs leading-relaxed text-slate-800 font-serif whitespace-pre-wrap select-text">
        {paragraphs.map((para, pIdx) => {
          const colonMatch = para.match(/^([A-Za-z\s]+[\.\:])\s*(.*)$/s);
          if (colonMatch) {
            return (
              <p key={pIdx}>
                <strong className="font-bold text-slate-950 underline decoration-[#D2C4B4]">{colonMatch[1]}</strong>{' '}
                {colonMatch[2]}
              </p>
            );
          }
          return <p key={pIdx}>{para}</p>;
        })}
      </div>
    );
  };

  return (
    <div className="chassis-panel rounded-2xl p-6 relative border-2 border-[#D2C4B4] shadow-sm">
      {/* Precision Screws */}
      <div className="absolute top-2.5 left-2.5 mechanical-screw" />
      <div className="absolute top-2.5 right-2.5 mechanical-screw" />
      <div className="absolute bottom-2.5 left-2.5 mechanical-screw" />
      <div className="absolute bottom-2.5 right-2.5 mechanical-screw" />

      {/* Station Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b-2 border-[#D2C4B4] mb-5 gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-xs font-black px-2.5 py-1 rounded bg-[#81A6C6] text-white tracking-widest shadow-2xs">
            <span>{claim.id}</span>
          </div>
          <div>
            <h3 className="text-base font-serif font-bold text-slate-900 leading-tight">
              Dual-Lens Claim ↔ Evidence Comparator
            </h3>
            <span className="font-mono text-[10px] text-slate-500 uppercase tracking-wider">
              VERBATIM SPAN MATCHING + ISOLATED ENTAILMENT INSPEC
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {paper.availability === 'abstract_only' ? (
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
              <BookOpen className="w-3.5 h-3.5 text-amber-700" />
              ABSTRACT-ONLY (WEAKER EVIDENCE)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold px-3 py-1 rounded-full bg-[#AACDDC]/70 text-slate-900 border border-[#81A6C6]/40">
              <FileText className="w-3.5 h-3.5 text-slate-800" />
              FULL-TEXT REPOSITORY RECORD
            </span>
          )}
        </div>
      </div>

      {/* Main Optical Comparator Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left 5-Cols: Extracted Micro-Cassette & Pipeline Diagnostics */}
        <div className="lg:col-span-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            
            {/* 1. Atomic Claim Box */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between font-mono text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                <span>01. ATOMIC SYNTHESIS CLAIM</span>
                <span>AI FORMULATION</span>
              </div>
              <div className="p-4 rounded-xl bg-[#FAF8F5] border-2 border-[#D2C4B4] text-xs font-sans font-medium text-slate-900 leading-relaxed shadow-inner">
                {claim.text}
              </div>
            </div>

            {/* 2. Extracted Verbatim Quote Micro-Cassette */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between font-mono text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                <span>02. VERBATIM SOURCE SPAN</span>
                <span>MUST MATCH WORD-FOR-WORD</span>
              </div>
              <div
                className={`p-4 rounded-xl border-2 text-xs leading-relaxed font-serif italic shadow-inner ${
                  isQuoteNotFound
                    ? 'bg-rose-50/80 border-rose-300 text-rose-900 font-semibold'
                    : 'bg-[#FAF8F5] border-[#D2C4B4] text-slate-900'
                }`}
              >
                "{claim.quote}"
              </div>

              {claim.section && (
                <div className="flex items-center gap-2 font-mono text-[10px] text-slate-500 pt-1">
                  <span>REPORTED PAPER SECTION:</span>
                  <span className="px-2 py-0.5 rounded bg-[#EFECE6] border border-[#D2C4B4] text-slate-800 font-bold">
                    {claim.section}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Verification Pipeline Metrology Box */}
          <div className="p-4 rounded-xl bg-[#EFECE6] border-2 border-[#D2C4B4] space-y-3.5 shadow-xs">
            <div className="flex items-center justify-between pb-1 border-b border-[#D2C4B4]">
              <span className="font-mono text-[10px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#81A6C6]" />
                <span>VERIFICATION STAGE TELEMETRY</span>
              </span>
              <span className="font-mono text-[9px] text-slate-500">CALIBRATED</span>
            </div>

            {/* Stage 1 Telemetry Meter */}
            <div className="flex items-start justify-between gap-2 text-xs">
              <div>
                <span className="font-mono font-bold text-slate-900 block">
                  STAGE 1: STRING SPAN SEARCH
                </span>
                <span className="text-slate-600 text-[11px] font-sans">
                  Free deterministic character matching
                </span>
                {stage1Verdict?.match_score !== undefined && stage1Verdict.match_score !== null && (
                  <div className="font-mono text-[10px] text-slate-700 font-bold mt-1 flex items-center gap-1.5">
                    <ScanLine className="w-3 h-3 text-[#81A6C6]" />
                    <span>SCORE: {stage1Verdict.match_score.toFixed(1)}% / 92.0% REQ</span>
                  </div>
                )}
              </div>
              {stage1Verdict ? (
                <VerdictBadge label={stage1Verdict.label} size="sm" />
              ) : (
                <span className="font-mono text-xs text-slate-400">—</span>
              )}
            </div>

            {/* Stage 2 Telemetry Meter */}
            <div className="flex items-start justify-between gap-2 text-xs pt-2.5 border-t border-[#D2C4B4]">
              <div>
                <span className="font-mono font-bold text-slate-900 block">
                  STAGE 2: ISOLATED CRITIC
                </span>
                <span className="text-slate-600 text-[11px] font-sans">
                  Logical entailment verification
                </span>
                {stage2Verdict?.confidence !== undefined && stage2Verdict.confidence !== null && (
                  <div className="font-mono text-[10px] text-slate-700 font-bold mt-1">
                    CONFIDENCE: {(stage2Verdict.confidence * 100).toFixed(0)}%
                  </div>
                )}
              </div>
              {stage2Verdict ? (
                <VerdictBadge label={stage2Verdict.label} size="sm" />
              ) : stage1Verdict?.label === 'quote_not_found' ? (
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-600 border border-slate-300">
                  HALTED AT STAGE 1
                </span>
              ) : (
                <span className="font-mono text-xs text-slate-400">—</span>
              )}
            </div>

            {stage2Verdict?.reasoning && (
              <div className="p-3 rounded-lg bg-[#FAF8F5] border border-[#D2C4B4] text-[11px] text-slate-800 font-serif leading-relaxed">
                <strong className="font-mono text-[10px] uppercase font-bold text-slate-500 block mb-1">
                  Critic Analysis Note:
                </strong>
                "{stage2Verdict.reasoning}"
              </div>
            )}
          </div>
        </div>

        {/* Right 7-Cols: Illuminated Manuscript Viewport */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <ScanLine className="w-3.5 h-3.5 text-[#81A6C6]" />
              <span>03. PRIMARY SOURCE TEXT [{paper.id}]</span>
            </span>
            <span className="font-mono text-[11px] text-slate-500 truncate max-w-xs font-semibold">
              {paper.title}
            </span>
          </div>

          {/* Caught Hallucination Breach Alert Shutter */}
          {isQuoteNotFound && (
            <div className="mb-3 p-4 rounded-xl bg-rose-100/90 border-2 border-rose-400 text-rose-950 flex items-start gap-3 text-xs shadow-sm">
              <Ban className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
              <div>
                <strong className="font-mono text-xs font-black uppercase tracking-wider text-rose-900 block mb-0.5">
                  SECURITY ALERT: FABRICATED QUOTE CAUGHT
                </strong>
                <p className="font-sans leading-relaxed text-rose-900">
                  The verbatim quote claimed by the model does <strong>NOT exist</strong> in this source paper. Stage 1 dropped this claim before it could contaminate the final synthesis.
                </p>
              </div>
            </div>
          )}

          {!isQuoteNotFound && !isRejected && (
            <div className="mb-3 p-3 rounded-xl bg-emerald-100/90 border border-emerald-400 text-emerald-950 flex items-center gap-2.5 text-xs font-mono font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>VERIFIED: Verbatim span located at offsets [{claim.quote_start}..{claim.quote_end}]</span>
            </div>
          )}

          {/* Document Optical Reader Viewport */}
          <div className="flex-1 max-h-[350px] overflow-y-auto p-5 rounded-xl bg-[#FAF8F5] border-2 border-[#D2C4B4] shadow-inner relative font-serif">
            {renderSourceWithHighlight()}
          </div>
        </div>
      </div>
    </div>
  );
};
