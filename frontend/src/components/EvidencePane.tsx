import React, { useMemo, useState } from 'react';
import type { Run, Verdict } from '../api/types';
import { VerdictBadge } from './VerdictBadge';
import {
  ShieldAlert,
  ShieldCheck,
  FileSearch,
  Sparkles,
  FileText,
  BookOpen,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';

interface EvidencePaneProps {
  run: Run;
  initialClaimId?: string;
}

export const EvidencePane: React.FC<EvidencePaneProps> = ({
  run,
  initialClaimId,
}) => {
  const claims = useMemo(() => run.summaries.flatMap((s) => s.claims), [run]);
  const [selectedClaimId, setSelectedClaimId] = useState<string>(
    initialClaimId || (claims.length > 0 ? claims[0].id : '')
  );
  const [filterMode, setFilterMode] = useState<'all' | 'accepted' | 'rejected'>('all');
  const [copied, setCopied] = useState(false);

  // Group verdicts by claim ID
  const verdictsByClaim = useMemo(() => {
    const map = new Map<string, Verdict[]>();
    for (const v of run.verdicts) {
      const list = map.get(v.claim_id) || [];
      list.push(v);
      map.set(v.claim_id, list);
    }
    return map;
  }, [run.verdicts]);

  const selectedClaim = useMemo(
    () => claims.find((c) => c.id === selectedClaimId) || claims[0],
    [claims, selectedClaimId]
  );

  const selectedPaper = useMemo(
    () => (selectedClaim ? run.papers.find((p) => p.id === selectedClaim.paper_id) : undefined),
    [run.papers, selectedClaim]
  );

  const selectedVerdicts = useMemo(
    () => (selectedClaim ? verdictsByClaim.get(selectedClaim.id) || [] : []),
    [verdictsByClaim, selectedClaim]
  );

  const stage1Verdict = selectedVerdicts.find((v) => v.stage === 'span');
  const stage2Verdict = selectedVerdicts.find((v) => v.stage === 'entailment');
  const finalVerdict = selectedVerdicts.length > 0 ? selectedVerdicts[selectedVerdicts.length - 1] : null;

  const isAccepted = finalVerdict?.label === 'supported';
  const isFabrication = stage1Verdict?.label === 'quote_not_found';

  // Filtered claims list
  const filteredClaims = useMemo(() => {
    return claims.filter((c) => {
      const vs = verdictsByClaim.get(c.id) || [];
      const lastV = vs[vs.length - 1];
      const accepted = lastV?.label === 'supported';
      if (filterMode === 'accepted') return accepted;
      if (filterMode === 'rejected') return !accepted;
      return true;
    });
  }, [claims, verdictsByClaim, filterMode]);

  // Source text with highlighted span
  const sourceTextContent = useMemo(() => {
    if (!selectedPaper) return '';
    return selectedPaper.availability === 'full_text' && selectedPaper.full_text
      ? selectedPaper.full_text
      : (selectedPaper.abstract || '');
  }, [selectedPaper]);

  const highlightedSourceView = useMemo(() => {
    if (!selectedClaim || !sourceTextContent) return <p className="text-slate-500 italic">No source text available.</p>;

    const start = selectedClaim.quote_start;
    const end = selectedClaim.quote_end;

    // If stage 1 found quote with offsets
    if (start !== null && end !== null && start >= 0 && end <= sourceTextContent.length && start < end) {
      const before = sourceTextContent.slice(0, start);
      const highlighted = sourceTextContent.slice(start, end);
      const after = sourceTextContent.slice(end);

      return (
        <div className="font-mono text-xs leading-relaxed text-slate-300 whitespace-pre-wrap">
          <span>{before}</span>
          <mark className="bg-amber-400/25 text-amber-200 font-semibold px-1 py-0.5 rounded border border-amber-400/40 shadow-sm transition-all duration-200 ring-1 ring-amber-400/30">
            {highlighted}
          </mark>
          <span>{after}</span>
        </div>
      );
    }

    // Fabricated quote case
    if (isFabrication) {
      return (
        <div className="space-y-4 font-mono text-xs">
          <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-lg text-red-300 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-red-200">Quote Not Found in Paper (Fabrication Caught)</p>
              <p className="text-[11px] text-red-300/80 mt-0.5">
                The Summarizer claimed the quote occurred in this source, but exact/fuzzy search found 0 matches.
                Rejected instantly in Stage 1 without using any LLM tokens.
              </p>
            </div>
          </div>
          <div className="leading-relaxed text-slate-400 whitespace-pre-wrap opacity-75">
            {sourceTextContent}
          </div>
        </div>
      );
    }

    return (
      <div className="font-mono text-xs leading-relaxed text-slate-300 whitespace-pre-wrap">
        {sourceTextContent}
      </div>
    );
  }, [selectedClaim, sourceTextContent, isFabrication]);

  const copyClaimJson = () => {
    if (!selectedClaim) return;
    navigator.clipboard.writeText(JSON.stringify({
      claim: selectedClaim,
      verdicts: selectedVerdicts,
      paper: selectedPaper,
    }, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Filter Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <FileSearch className="w-5 h-5 text-indigo-400" />
            Claim ↔ Evidence Verification Inspector
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Two-stage verification audit: Every claim is checked verbatim against source text before reaching the report.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-lg text-xs">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1 rounded font-medium transition-colors ${
              filterMode === 'all'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Claims ({claims.length})
          </button>
          <button
            onClick={() => setFilterMode('accepted')}
            className={`px-3 py-1 rounded font-medium transition-colors ${
              filterMode === 'accepted'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Accepted ({claims.filter((c) => verdictsByClaim.get(c.id)?.[verdictsByClaim.get(c.id)!.length - 1]?.label === 'supported').length})
          </button>
          <button
            onClick={() => setFilterMode('rejected')}
            className={`px-3 py-1 rounded font-medium transition-colors ${
              filterMode === 'rejected'
                ? 'bg-rose-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Rejections & Fabrications ({claims.filter((c) => verdictsByClaim.get(c.id)?.[verdictsByClaim.get(c.id)!.length - 1]?.label !== 'supported').length})
          </button>
        </div>
      </div>

      {/* Claim Selector Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {filteredClaims.map((c) => {
          const vs = verdictsByClaim.get(c.id) || [];
          const s1 = vs.find((v) => v.stage === 'span');
          const lastV = vs[vs.length - 1];
          const isSelected = c.id === selectedClaimId;
          const isFab = s1?.label === 'quote_not_found';
          const isSupp = lastV?.label === 'supported';

          return (
            <button
              key={c.id}
              onClick={() => setSelectedClaimId(c.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-medium shrink-0 transition-all border ${
                isSelected
                  ? 'bg-slate-800 border-indigo-500 text-slate-100 shadow-md ring-1 ring-indigo-500/40'
                  : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
              }`}
            >
              <span>{c.id}</span>
              {isFab ? (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Fabrication Rejected" />
              ) : isSupp ? (
                <span className="w-2 h-2 rounded-full bg-emerald-500" title="Supported" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-rose-500" title="Rejected" />
              )}
            </button>
          );
        })}
      </div>

      {/* 3-Column Evidence Layout */}
      {selectedClaim ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* Column 1: Extracted Claim (Left) */}
          <div className="lg:col-span-4 flex flex-col space-y-3 bg-slate-900/80 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                Claim {selectedClaim.id}
              </span>
              <button
                onClick={copyClaimJson}
                className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                title="Copy Claim JSON"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Atomic Claim Text
              </label>
              <p className="mt-1 text-sm font-semibold text-slate-100 leading-snug">
                "{selectedClaim.text}"
              </p>
            </div>

            {/* Verbatim Quote Claimed */}
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Claimed Verbatim Quote</span>
                <span className="text-[10px] text-indigo-400 font-mono">
                  {selectedClaim.quote.length} chars
                </span>
              </label>
              <div className="mt-1 bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono text-indigo-200/90 leading-relaxed italic">
                "{selectedClaim.quote}"
              </div>
            </div>

            {/* Source Paper Reference */}
            {selectedPaper && (
              <div className="mt-auto pt-3 border-t border-slate-800/80">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Source Paper
                </div>
                <div className="text-xs font-medium text-slate-200 truncate">
                  {selectedPaper.id}: {selectedPaper.title}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px]">
                  {selectedPaper.availability === 'abstract_only' ? (
                    <span className="inline-flex items-center text-amber-300 font-medium">
                      <FileText className="w-3 h-3 mr-1 text-amber-400" /> Abstract-Only Paper
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-emerald-300 font-medium">
                      <BookOpen className="w-3 h-3 mr-1 text-emerald-400" /> Full-Text PDF Extracted
                    </span>
                  )}
                  {selectedPaper.url && (
                    <a
                      href={selectedPaper.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 hover:underline flex items-center"
                    >
                      DOI <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Column 2: Two-Stage Verification Verdicts (Center) */}
          <div className="lg:col-span-3 flex flex-col space-y-4 bg-slate-900/80 border border-slate-800 rounded-xl p-4">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Verification Pipeline
            </h4>

            {/* Stage 1 Card */}
            <div className={`p-3 rounded-lg border transition-all ${
              isFabrication
                ? 'bg-red-950/30 border-red-500/50'
                : 'bg-slate-950/70 border-slate-800'
            }`}>
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1.5">
                <span>Stage 1: Span Checker</span>
                <span className="text-slate-500">0 Tokens ($0)</span>
              </div>
              <div className="mb-2">
                {stage1Verdict ? (
                  <VerdictBadge
                    label={stage1Verdict.label}
                    stage="span"
                    matchScore={stage1Verdict.match_score}
                    size="sm"
                  />
                ) : (
                  <span className="text-xs text-slate-500">Pending</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                {isFabrication
                  ? 'Quote not present in paper. Rejected immediately.'
                  : 'Quote verified verbatim in source document.'}
              </p>
            </div>

            {/* Stage 2 Card */}
            <div className={`p-3 rounded-lg border transition-all ${
              isAccepted
                ? 'bg-emerald-950/20 border-emerald-500/40'
                : stage2Verdict
                ? 'bg-amber-950/20 border-amber-500/40'
                : 'bg-slate-950/40 border-slate-800 opacity-60'
            }`}>
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1.5">
                <span>Stage 2: LLM Critic</span>
                <span className="text-slate-500">{stage2Verdict?.model || 'openai/gpt-oss-120b'}</span>
              </div>
              <div className="mb-2">
                {stage2Verdict ? (
                  <VerdictBadge
                    label={stage2Verdict.label}
                    stage="entailment"
                    confidence={stage2Verdict.confidence}
                    size="sm"
                  />
                ) : (
                  <span className="text-xs text-slate-500">
                    {isFabrication ? 'Skipped (Failed Stage 1)' : 'Pending'}
                  </span>
                )}
              </div>

              {stage2Verdict?.reasoning && (
                <div className="mt-2 text-[11px] bg-slate-900/90 p-2 rounded border border-slate-800 text-slate-300 leading-normal">
                  <span className="font-semibold text-slate-200">Critic Reasoning:</span>{' '}
                  {stage2Verdict.reasoning}
                </div>
              )}
            </div>

            {/* Final Status Banner */}
            <div className="mt-auto pt-2">
              <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${
                isAccepted
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}>
                {isAccepted ? (
                  <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
                )}
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider">
                    {isAccepted ? 'Included in Synthesis' : 'Excluded from Report'}
                  </div>
                  <div className="text-[10px] opacity-80 mt-0.5">
                    {isAccepted
                      ? 'Survives both verification stages.'
                      : isFabrication
                      ? 'Filtered: Fabricated quote.'
                      : 'Filtered: Entailment failed.'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Column 3: Source Document Highlight View (Right) */}
          <div className="lg:col-span-5 flex flex-col bg-slate-900/80 border border-slate-800 rounded-xl p-4 min-h-[380px]">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-slate-200">
                  Source Document Context ({selectedPaper?.availability === 'full_text' ? 'Full Text' : 'Abstract'})
                </span>
              </div>
              {selectedClaim.quote_start !== null && selectedClaim.quote_end !== null && (
                <span className="font-mono text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                  Span: [{selectedClaim.quote_start}..{selectedClaim.quote_end}]
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto max-h-[460px] p-3 rounded-lg bg-slate-950 border border-slate-800/80 shadow-inner scrollbar-thin">
              {highlightedSourceView}
            </div>
          </div>

        </div>
      ) : (
        <div className="text-center py-12 text-slate-500">
          No claims match the selected filter.
        </div>
      )}
    </div>
  );
};
