import React from 'react';
import type { PaperRef } from '../api/types';
import { FileText, ExternalLink, BookOpen, Quote, Sparkles } from 'lucide-react';

interface PaperCardProps {
  paper: PaperRef;
  selected?: boolean;
  onClick?: () => void;
  claimCount?: number;
}

export const PaperCard: React.FC<PaperCardProps> = ({
  paper,
  selected = false,
  onClick,
  claimCount,
}) => {
  const isAbstractOnly = paper.availability === 'abstract_only';

  return (
    <div
      onClick={onClick}
      className={`p-5 rounded-2xl border transition-all duration-200 cursor-pointer shadow-xs ${
        selected
          ? 'bg-[#AACDDC]/20 border-[#81A6C6] ring-1 ring-[#81A6C6]/40'
          : 'bg-white border-[#D2C4B4] hover:border-[#81A6C6]/60 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#F3E3D0] text-slate-800 border border-[#D2C4B4]">
            {paper.id}
          </span>
          {isAbstractOnly ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
              <BookOpen className="w-3 h-3 text-amber-600" />
              Abstract-Only
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-[#AACDDC]/60 text-slate-800 border border-[#81A6C6]/40">
              <FileText className="w-3 h-3 text-slate-700" />
              Full Text
            </span>
          )}
          <span className="text-[10px] font-mono uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
            {paper.source_api}
          </span>
        </div>

        {paper.citation_count !== null && (
          <div className="flex items-center gap-1 text-xs text-slate-500 font-mono">
            <Quote className="w-3 h-3 text-slate-400" />
            <span>{paper.citation_count} cited</span>
          </div>
        )}
      </div>

      <h4 className="text-sm font-serif font-bold text-slate-900 line-clamp-2 mb-1.5 leading-snug">
        {paper.title}
      </h4>

      <div className="text-xs text-slate-500 mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
        {paper.authors.length > 0 && (
          <span className="truncate max-w-[280px]">
            {paper.authors.slice(0, 3).map((a) => a.name).join(', ')}
            {paper.authors.length > 3 ? ` et al.` : ''}
          </span>
        )}
        {paper.year && <span>• {paper.year}</span>}
        {paper.venue && <span className="italic text-slate-400 truncate max-w-[200px]">({paper.venue})</span>}
      </div>

      <div className="flex items-center justify-between text-xs pt-3 border-t border-[#E2E8F0] text-slate-500 font-sans">
        <div className="flex items-center gap-2">
          {claimCount !== undefined && (
            <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
              <Sparkles className="w-3 h-3 text-[#81A6C6]" />
              {claimCount} {claimCount === 1 ? 'claim' : 'claims'} extracted
            </span>
          )}
        </div>

        {paper.url && (
          <a
            href={paper.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-[#81A6C6] hover:text-[#6c93b5] hover:underline transition-colors font-medium"
          >
            <span>Source</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
};
