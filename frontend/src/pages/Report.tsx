import React, { useMemo, useState } from 'react';
import type { Run } from '../api/types';
import { EvidencePane } from '../components/EvidencePane';
import { ClaimRow } from '../components/ClaimRow';
import { CitationHover } from '../components/CitationHover';
import { PaperCard } from '../components/PaperCard';
import {
  FileText,
  ShieldCheck,
  BookOpen,
  Copy,
  Check,
  Download,
  ListFilter,
} from 'lucide-react';

interface ReportProps {
  run: Run;
}

export const ReportPage: React.FC<ReportProps> = ({ run }) => {
  const [activeTab, setActiveTab] = useState<'report' | 'evidence' | 'claims' | 'bibtex'>('evidence');
  const [selectedClaimForEvidence, setSelectedClaimForEvidence] = useState<string | undefined>(undefined);
  const [copiedBibtex, setCopiedBibtex] = useState(false);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);

  const claims = useMemo(() => run.summaries.flatMap((s) => s.claims), [run]);

  const verdictsByClaim = useMemo(() => {
    const map = new Map<string, typeof run.verdicts>();
    for (const v of run.verdicts) {
      const list = map.get(v.claim_id) || [];
      list.push(v);
      map.set(v.claim_id, list);
    }
    return map;
  }, [run.verdicts]);

  // Statistics
  const stats = useMemo(() => {
    const total = claims.length;
    const stage1Rejections = run.verdicts.filter((v) => v.stage === 'span' && v.label === 'quote_not_found').length;
    const accepted = claims.filter((c) => {
      const vs = verdictsByClaim.get(c.id) || [];
      return vs.length > 0 && vs[vs.length - 1].label === 'supported';
    }).length;
    const stage2Calls = run.verdicts.filter((v) => v.stage === 'entailment').length;
    const supportRate = total > 0 ? (accepted / total) * 100 : 0;

    return {
      total,
      accepted,
      stage1Rejections,
      stage2Calls,
      supportRate,
    };
  }, [claims, run.verdicts, verdictsByClaim]);

  // Citation map: marker -> paper
  const citationMap = useMemo(() => {
    const map = new Map<number, typeof run.papers[0]>();
    if (!run.report) return map;
    for (const cit of run.report.citations) {
      const paper = run.papers.find((p) => p.id === cit.paper_id);
      if (paper) {
        map.set(cit.marker, paper);
      }
    }
    return map;
  }, [run.report, run.papers]);

  const copyBibtex = () => {
    if (!run.report?.bibtex) return;
    navigator.clipboard.writeText(run.report.bibtex);
    setCopiedBibtex(true);
    setTimeout(() => setCopiedBibtex(false), 2000);
  };

  const copyMarkdown = () => {
    if (!run.report?.markdown) return;
    navigator.clipboard.writeText(run.report.markdown);
    setCopiedMarkdown(true);
    setTimeout(() => setCopiedMarkdown(false), 2000);
  };

  // Render markdown text with interactive citation tags
  const renderMarkdownWithCitations = (markdown: string) => {
    // Split on citation patterns like [1], [2], etc.
    const parts = markdown.split(/(\[\d+\])/g);

    return parts.map((part, index) => {
      const match = part.match(/^\[(\d+)\]$/);
      if (match) {
        const marker = parseInt(match[1], 10);
        const paper = citationMap.get(marker);
        return (
          <CitationHover
            key={index}
            marker={marker}
            paper={paper}
            onSelectPaper={() => setActiveTab('evidence')}
          />
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const handleSelectClaimFromTable = (claimId: string) => {
    setSelectedClaimForEvidence(claimId);
    setActiveTab('evidence');
  };

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      
      {/* Header Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                Synthesized Review
              </span>
              <span className="text-xs text-slate-400">
                Run: {run.id}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-100 mt-1">
              {run.question}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyMarkdown}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
            >
              {copiedMarkdown ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedMarkdown ? 'Copied' : 'Copy Report MD'}</span>
            </button>

            <button
              onClick={copyBibtex}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-colors cursor-pointer"
            >
              {copiedBibtex ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Download className="w-3.5 h-3.5" />}
              <span>BibTeX Export</span>
            </button>
          </div>
        </div>

        {/* Verification Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800/80">
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Total Claims Extracted
            </div>
            <div className="text-lg font-bold font-mono text-slate-100 mt-0.5">
              {stats.total}
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Stage 1 Free Rejections
            </div>
            <div className="text-lg font-bold font-mono text-red-400 mt-0.5">
              {stats.stage1Rejections} <span className="text-xs text-slate-500 font-normal">($0 cost)</span>
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Accepted into Synthesis
            </div>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
              {stats.accepted} / {stats.total}
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Claim Support Rate
            </div>
            <div className="text-lg font-bold font-mono text-indigo-400 mt-0.5">
              {stats.supportRate.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('evidence')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'evidence'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Evidence & Verification Inspector (Star Feature)</span>
        </button>

        <button
          onClick={() => setActiveTab('report')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'report'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Cited Synthesis Report</span>
        </button>

        <button
          onClick={() => setActiveTab('claims')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'claims'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <ListFilter className="w-4 h-4" />
          <span>All Claims Table ({claims.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('bibtex')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'bibtex'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Bibliography & BibTeX</span>
        </button>
      </div>

      {/* Tab 1: Evidence Pane */}
      {activeTab === 'evidence' && (
        <EvidencePane
          run={run}
          initialClaimId={selectedClaimForEvidence}
        />
      )}

      {/* Tab 2: Synthesized Report */}
      {activeTab === 'report' && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur-sm prose prose-invert max-w-none">
            {run.report?.markdown ? (
              <div className="text-slate-200 leading-relaxed space-y-4 whitespace-pre-wrap font-sans text-sm sm:text-base">
                {renderMarkdownWithCitations(run.report.markdown)}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                Report is currently being synthesized...
              </div>
            )}
          </div>

          {/* Themes Section */}
          {run.report?.themes && run.report.themes.length > 0 && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-3">
                Key Synthesis Themes
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {run.report.themes.map((theme, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800"
                  >
                    <div className="font-semibold text-xs text-indigo-300">
                      {theme.title}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      {theme.claim_ids.length} verified claims synthesized in this theme
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: All Claims Table */}
      {activeTab === 'claims' && (
        <div className="space-y-3">
          <div className="text-xs text-slate-400">
            Click on any claim to open it in the Evidence & Verification Inspector.
          </div>
          <div className="space-y-3">
            {claims.map((claim) => {
              const paper = run.papers.find((p) => p.id === claim.paper_id);
              const vs = verdictsByClaim.get(claim.id) || [];
              return (
                <ClaimRow
                  key={claim.id}
                  claim={claim}
                  paper={paper}
                  verdicts={vs}
                  onSelect={handleSelectClaimFromTable}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 4: Bibliography & BibTeX */}
      {activeTab === 'bibtex' && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                BibTeX Citation Entries
              </h3>
              <button
                onClick={copyBibtex}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition-colors"
              >
                {copiedBibtex ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedBibtex ? 'Copied' : 'Copy All BibTeX'}</span>
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-indigo-200/90 overflow-x-auto">
              {run.report?.bibtex || 'No BibTeX generated yet.'}
            </pre>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
              Cited Papers ({run.papers.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {run.papers.map((paper) => (
                <PaperCard key={paper.id} paper={paper} />
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
