import React, { useState, useEffect } from 'react';
import type { Run, Claim, PaperRef } from '../api/types';
import { allClaims, verdictsFor, paperById, isAccepted } from '../api/types';
import { getRun } from '../api/client';
import { EvidencePane } from '../components/EvidencePane';
import { ClaimRow } from '../components/ClaimRow';
import { PaperCard } from '../components/PaperCard';
import { CitationHover } from '../components/CitationHover';
import {
  FileText,
  Copy,
  Check,
  ShieldCheck,
  Code2,
  Plus,
  ArrowLeft,
  Sparkles,
  SlidersHorizontal,
  Compass,
} from 'lucide-react';

interface ReportProps {
  runId: string;
  onBackToTrace: () => void;
  onNewRun: () => void;
}

export const Report: React.FC<ReportProps> = ({ runId, onBackToTrace, onNewRun }) => {
  const [run, setRun] = useState<Run | null>(null);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>('C3');
  const [claimFilter, setClaimFilter] = useState<'all' | 'accepted' | 'rejected'>('all');
  const [activeTab, setActiveTab] = useState<'report' | 'claims' | 'papers' | 'bibtex'>('report');
  const [copiedBibtex, setCopiedBibtex] = useState(false);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);

  useEffect(() => {
    getRun(runId).then((data) => {
      setRun(data);
      const claims = allClaims(data);
      if (claims.length > 0) {
        const c3 = claims.find((c) => c.id === 'C3');
        setSelectedClaimId(c3 ? c3.id : claims[0].id);
      }
    });
  }, [runId]);

  if (!run) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-slate-500 font-mono text-xs">
        CALIBRATING VERIDEX BENCHMARK DATASET...
      </div>
    );
  }

  const claims = allClaims(run);
  const selectedClaim = claims.find((c) => c.id === selectedClaimId) || null;
  const selectedPaper = selectedClaim ? paperById(run, selectedClaim.paper_id) || null : null;
  const selectedVerdicts = selectedClaimId ? verdictsFor(run, selectedClaimId) : [];

  const filteredClaims = claims.filter((c) => {
    if (claimFilter === 'accepted') return isAccepted(run, c.id);
    if (claimFilter === 'rejected') return !isAccepted(run, c.id);
    return true;
  });

  const acceptedCount = claims.filter((c) => isAccepted(run, c.id)).length;
  const rejectedCount = claims.length - acceptedCount;

  const handleCopyBibtex = () => {
    if (!run.report?.bibtex) return;
    navigator.clipboard.writeText(run.report.bibtex);
    setCopiedBibtex(true);
    setTimeout(() => setCopiedBibtex(false), 2000);
  };

  const handleCopyMarkdown = () => {
    if (!run.report?.markdown) return;
    navigator.clipboard.writeText(run.report.markdown);
    setCopiedMarkdown(true);
    setTimeout(() => setCopiedMarkdown(false), 2000);
  };

  const renderReportContent = (markdownText: string) => {
    if (!markdownText) return null;

    const citationMap = new Map<number, { paper?: PaperRef; claims: Claim[] }>();
    if (run.report?.citations) {
      for (const cit of run.report.citations) {
        const p = paperById(run, cit.paper_id);
        const backingClaims = claims.filter((c) => cit.claim_ids.includes(c.id));
        citationMap.set(cit.marker, { paper: p, claims: backingClaims });
      }
    }

    const lines = markdownText.split('\n');

    return (
      <div className="space-y-4 text-slate-900 leading-relaxed text-sm">
        {lines.map((line, idx) => {
          if (!line.trim()) return <div key={idx} className="h-1.5" />;

          if (line.startsWith('# ')) {
            return (
              <h2 key={idx} className="text-2xl font-serif font-bold text-slate-950 pt-2 pb-2 border-b border-[#D2C4B4]">
                {line.replace('# ', '')}
              </h2>
            );
          }

          if (line.startsWith('## ')) {
            return (
              <h3 key={idx} className="text-lg font-serif font-bold text-slate-900 pt-3 pb-1">
                {line.replace('## ', '')}
              </h3>
            );
          }

          if (line.startsWith('### ')) {
            return (
              <h4 key={idx} className="text-sm font-serif font-bold text-slate-900 pt-2">
                {line.replace('### ', '')}
              </h4>
            );
          }

          const parts = line.split(/(\[\d+\])/g);

          const renderedParts = parts.map((part, pIdx) => {
            const match = part.match(/^\[(\d+)\]$/);
            if (match) {
              const markerNum = parseInt(match[1], 10);
              const citInfo = citationMap.get(markerNum);
              return (
                <CitationHover
                  key={pIdx}
                  marker={markerNum}
                  paper={citInfo?.paper}
                  claims={citInfo?.claims}
                  onClick={() => {
                    if (citInfo?.claims && citInfo.claims.length > 0) {
                      setSelectedClaimId(citInfo.claims[0].id);
                      window.scrollTo({ top: 300, behavior: 'smooth' });
                    }
                  }}
                />
              );
            }
            return <span key={pIdx}>{part}</span>;
          });

          return <p key={idx} className="leading-relaxed font-serif text-[13px] text-slate-800">{renderedParts}</p>;
        })}
      </div>
    );
  };

  return (
    <div className="space-y-7 animate-in fade-in duration-300 pb-10">
      
      {/* Header & Station Toolbar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b-2 border-[#D2C4B4]">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 font-mono text-xs text-slate-600">
            <button
              onClick={onBackToTrace}
              className="hover:text-slate-900 inline-flex items-center gap-1 cursor-pointer font-bold"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#81A6C6]" />
              <span>TELEMETRY BUS</span>
            </button>
            <span>·</span>
            <span className="font-bold text-slate-900 px-2 py-0.5 rounded bg-[#FAF7F2] border border-[#D2C4B4]">
              {run.id}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-slate-950 tracking-tight leading-snug">
            {run.question}
          </h1>
        </div>

        {/* Action Tools */}
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <button
            onClick={handleCopyMarkdown}
            className="text-xs px-3.5 py-2 rounded-xl bg-[#FAF7F2] hover:bg-[#EFECE6] border border-[#D2C4B4] text-slate-800 flex items-center gap-1.5 transition-all shadow-xs cursor-pointer font-mono font-bold"
          >
            {copiedMarkdown ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <FileText className="w-3.5 h-3.5 text-slate-600" />}
            <span>{copiedMarkdown ? 'COPIED' : 'COPY MARKDOWN'}</span>
          </button>

          <button
            onClick={handleCopyBibtex}
            className="text-xs px-3.5 py-2 rounded-xl bg-[#FAF7F2] hover:bg-[#EFECE6] border border-[#D2C4B4] text-slate-800 flex items-center gap-1.5 transition-all shadow-xs cursor-pointer font-mono font-bold"
          >
            {copiedBibtex ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Code2 className="w-3.5 h-3.5 text-slate-600" />}
            <span>{copiedBibtex ? 'BIBTEX READY' : 'EXPORT BIBTEX'}</span>
          </button>

          <button
            onClick={onNewRun}
            className="actuator-key text-xs px-4 py-2 rounded-xl text-white font-mono font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>NEW REVIEW</span>
          </button>
        </div>
      </div>

      {/* 4 Physical Metrology Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="chassis-panel rounded-xl p-4 shadow-xs relative">
          <div className="absolute top-2 right-2 mechanical-screw" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
            PAPERS RETRIEVED
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-serif font-black text-slate-900">{run.papers.length}</span>
            <span className="font-mono text-[11px] text-slate-500 font-semibold">
              {run.papers.filter((p) => p.availability === 'full_text').length} full-text
            </span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="chassis-panel rounded-xl p-4 shadow-xs relative">
          <div className="absolute top-2 right-2 mechanical-screw" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
            EXTRACTED CLAIMS
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-serif font-black text-slate-900">{claims.length}</span>
            <span className="font-mono text-[11px] text-slate-500 font-semibold">atomic quotes</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="chassis-panel rounded-xl p-4 shadow-xs border-2 border-[#81A6C6]/60 bg-[#AACDDC]/20 relative">
          <div className="absolute top-2 right-2 mechanical-screw" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-800 block mb-1">
            SUPPORTED CLAIMS
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-serif font-black text-slate-950">{acceptedCount}</span>
            <span className="font-mono text-[11px] text-slate-700 font-bold">IN FINAL REPORT</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="chassis-panel rounded-xl p-4 shadow-xs border-2 border-rose-300 bg-rose-50/70 relative">
          <div className="absolute top-2 right-2 mechanical-screw" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-rose-800 block mb-1">
            HALLUCINATIONS BLOCKED
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-serif font-black text-rose-900">{rejectedCount}</span>
            <span className="font-mono text-[11px] text-rose-700 font-bold">REJECTED / CAUGHT</span>
          </div>
        </div>
      </div>

      {/* Optical Comparator Centerpiece */}
      <EvidencePane
        claim={selectedClaim}
        paper={selectedPaper}
        verdicts={selectedVerdicts}
      />

      {/* Physical Tabs Mode Bar */}
      <div className="border-b-2 border-[#D2C4B4] flex items-center gap-4 pt-2">
        <button
          onClick={() => setActiveTab('report')}
          className={`pb-3 font-mono text-xs font-bold tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'report'
              ? 'border-[#81A6C6] text-slate-950'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          01. CITED SYNTHESIS REPORT
        </button>

        <button
          onClick={() => setActiveTab('claims')}
          className={`pb-3 font-mono text-xs font-bold tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'claims'
              ? 'border-[#81A6C6] text-slate-950'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>02. CLAIM METROLOGY TABLE</span>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#FAF7F2] border border-[#D2C4B4] text-slate-800 font-bold">
            {claims.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('papers')}
          className={`pb-3 font-mono text-xs font-bold tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'papers'
              ? 'border-[#81A6C6] text-slate-950'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>03. RETRIEVED PAPERS</span>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#FAF7F2] border border-[#D2C4B4] text-slate-800 font-bold">
            {run.papers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('bibtex')}
          className={`pb-3 font-mono text-xs font-bold tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'bibtex'
              ? 'border-[#81A6C6] text-slate-950'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          04. BIBTEX CITATIONS
        </button>
      </div>

      {/* Tab 1: Cited Report & Thematic Dockets */}
      {activeTab === 'report' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left 8-Cols: Main Synthesized Manuscript */}
          <div className="lg:col-span-8 chassis-panel rounded-2xl p-6 sm:p-8 relative">
            <div className="absolute top-3 left-3 mechanical-screw" />
            <div className="absolute top-3 right-3 mechanical-screw" />
            {run.report ? (
              renderReportContent(run.report.markdown)
            ) : (
              <p className="text-slate-500 font-mono text-xs">SYNTHESIS PENDING...</p>
            )}
          </div>

          {/* Right 4-Cols: Synthesis Themes Docket */}
          <div className="lg:col-span-4 space-y-4">
            <div className="chassis-panel rounded-2xl p-5 border-2 border-[#D2C4B4] space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#D2C4B4]">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#81A6C6]" />
                  <span>SYNTHESIS THEMES DOCKET</span>
                </span>
                <span className="font-mono text-[10px] text-slate-500">CLUSTERS</span>
              </div>

              <div className="space-y-3">
                {run.report?.themes && run.report.themes.length > 0 ? (
                  run.report.themes.map((theme, tIdx) => (
                    <div
                      key={tIdx}
                      className="p-4 rounded-xl bg-[#FAF8F5] border border-[#D2C4B4] space-y-2.5 shadow-2xs"
                    >
                      <h5 className="text-xs font-serif font-bold text-slate-900 leading-snug">
                        {theme.title}
                      </h5>
                      <div className="flex flex-wrap gap-1.5">
                        {theme.claim_ids.map((cid) => (
                          <button
                            key={cid}
                            onClick={() => {
                              setSelectedClaimId(cid);
                              window.scrollTo({ top: 300, behavior: 'smooth' });
                            }}
                            className={`font-mono text-[11px] px-2.5 py-1 rounded transition-all cursor-pointer font-bold ${
                              selectedClaimId === cid
                                ? 'bg-[#81A6C6] text-white shadow-xs'
                                : 'bg-[#F3E3D0] text-slate-800 border border-[#D2C4B4] hover:bg-[#ebd9c2]'
                            }`}
                          >
                            {cid}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 font-mono">No themes generated.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Metrology Claim Table */}
      {activeTab === 'claims' && (
        <div className="chassis-panel rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-serif font-bold text-slate-950">
                All Extracted Atomic Claims
              </h3>
              <p className="text-xs text-slate-600 font-sans">
                Inspect every extracted quote and its Stage 1 span + Stage 2 entailment verdicts.
              </p>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-1 bg-[#EFECE6] p-1 rounded-xl border border-[#D2C4B4] text-xs font-mono">
              <button
                onClick={() => setClaimFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  claimFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs border border-[#D2C4B4]'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ALL ({claims.length})
              </button>

              <button
                onClick={() => setClaimFilter('accepted')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  claimFilter === 'accepted'
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ACCEPTED ({acceptedCount})
              </button>

              <button
                onClick={() => setClaimFilter('rejected')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  claimFilter === 'rejected'
                    ? 'bg-rose-100 text-rose-900 border border-rose-300 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                REJECTED ({rejectedCount})
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#D2C4B4] bg-[#FAF8F5]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#EFECE6] font-mono text-[10px] font-bold uppercase tracking-wider text-slate-700 border-b border-[#D2C4B4]">
                  <th className="py-3 px-4">Claim & Paper</th>
                  <th className="py-3 px-4">Claim Statement & Quote</th>
                  <th className="py-3 px-3">Stage 1 (Span)</th>
                  <th className="py-3 px-3">Stage 2 (Entailment)</th>
                  <th className="py-3 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredClaims.map((claim) => (
                  <ClaimRow
                    key={claim.id}
                    claim={claim}
                    paper={paperById(run, claim.paper_id)}
                    verdicts={verdictsFor(run, claim.id)}
                    selected={selectedClaimId === claim.id}
                    onSelect={() => {
                      setSelectedClaimId(claim.id);
                      window.scrollTo({ top: 300, behavior: 'smooth' });
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Retrieved Papers */}
      {activeTab === 'papers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-serif font-bold text-slate-950">Retrieved Academic Literature</h3>
            <span className="font-mono text-xs text-slate-600 font-bold">
              {run.papers.filter((p) => p.availability === 'abstract_only').length} ABSTRACT-ONLY,{' '}
              {run.papers.filter((p) => p.availability === 'full_text').length} FULL-TEXT
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {run.papers.map((p) => (
              <PaperCard
                key={p.id}
                paper={p}
                claimCount={claims.filter((c) => c.paper_id === p.id).length}
                onClick={() => {
                  const paperClaims = claims.filter((c) => c.paper_id === p.id);
                  if (paperClaims.length > 0) {
                    setSelectedClaimId(paperClaims[0].id);
                    setActiveTab('claims');
                  }
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: BibTeX Citations */}
      {activeTab === 'bibtex' && (
        <div className="chassis-panel rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-serif font-bold text-slate-950">BibTeX Citations</h3>
              <p className="text-xs text-slate-600 font-sans">
                Mechanically matched from cited papers in the verified literature review.
              </p>
            </div>

            <button
              onClick={handleCopyBibtex}
              className="text-xs px-3.5 py-2 rounded-xl bg-[#81A6C6] hover:bg-[#6c93b5] text-white font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedBibtex ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedBibtex ? 'COPIED' : 'COPY ALL BIBTEX'}</span>
            </button>
          </div>

          <pre className="p-4 rounded-xl bg-[#FAF8F5] border border-[#D2C4B4] text-xs font-mono text-slate-800 overflow-x-auto leading-relaxed">
            {run.report?.bibtex || '% No BibTeX generated'}
          </pre>
        </div>
      )}
    </div>
  );
};
