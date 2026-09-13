import React, { useState } from 'react';
import type { PaperRef } from '../api/types';
import { BookOpen, ExternalLink, FileText, ChevronDown, ChevronUp, Quote } from 'lucide-react';

interface PaperCardProps {
  paper: PaperRef;
  claimCount?: number;
  highlighted?: boolean;
}

export const PaperCard: React.FC<PaperCardProps> = ({
  paper,
  claimCount,
  highlighted = false,
}) => {
  const [expanded, setExpanded] = useState(false);
  const isAbstractOnly = paper.availability === 'abstract_only';

  const authorNames = paper.authors.length > 0
    ? paper.authors.slice(0, 3).map((a) => a.name).join(', ') + (paper.authors.length > 3 ? ` et al.` : '')
    : 'Unknown authors';

  return (
    <div
      className={`rounded-xl border transition-all duration-200 bg-slate-900/70 backdrop-blur-sm p-4 ${
        highlighted
          ? 'border-indigo-500 shadow-lg shadow-indigo-500/10'
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60">
              {paper.id}
            </span>

            {/* Availability Badge */}
            {isAbstractOnly ? (
              <span className="inline-flex items-center text-xs px-2.5 py-0.5 rounded-full font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30">
                <FileText className="w-3 h-3 mr-1 text-amber-400" />
                Abstract-Only (Weaker Evidence)
              </span>
            ) : (
              <span className="inline-flex items-center text-xs px-2.5 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                <BookOpen className="w-3 h-3 mr-1 text-emerald-400" />
                Full-Text Extracted
              </span>
            )}

            <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
              via {paper.source_api}
            </span>
          </div>

          <h4 className="text-base font-semibold text-slate-100 leading-snug hover:text-indigo-300 transition-colors">
            {paper.title}
          </h4>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
            <span>{authorNames}</span>
            {paper.year && <span>• {paper.year}</span>}
            {paper.venue && <span className="italic text-slate-400">• {paper.venue}</span>}
            {paper.citation_count !== null && paper.citation_count !== undefined && (
              <span className="text-indigo-400 font-medium font-mono">
                • {paper.citation_count.toLocaleString()} citations
              </span>
            )}
            {claimCount !== undefined && (
              <span className="inline-flex items-center text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded font-mono text-[11px]">
                <Quote className="w-3 h-3 mr-1 text-indigo-400" />
                {claimCount} claims
              </span>
            )}
          </div>
        </div>

        {/* Links */}
        <div className="flex items-center gap-2 shrink-0">
          {paper.url && (
            <a
              href={paper.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
              title="Open Source Link / DOI"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      {/* Expandable Text Preview */}
      {(paper.abstract || paper.full_text) && (
        <div className="mt-3 pt-3 border-t border-slate-800/80">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5 mr-1" />
                Hide Source Text
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5 mr-1" />
                Show Source Text Preview
              </>
            )}
          </button>

          {expanded && (
            <div className="mt-2 text-xs text-slate-300 font-mono bg-slate-950/60 p-3 rounded-lg border border-slate-800/60 max-h-48 overflow-y-auto leading-relaxed whitespace-pre-wrap">
              {paper.full_text ? paper.full_text : paper.abstract}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
