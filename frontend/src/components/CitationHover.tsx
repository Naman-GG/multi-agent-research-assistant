import React, { useState } from 'react';
import type { PaperRef } from '../api/types';
import { BookOpen, ExternalLink } from 'lucide-react';

interface CitationHoverProps {
  marker: number;
  paper?: PaperRef;
  onSelectPaper?: (paperId: string) => void;
}

export const CitationHover: React.FC<CitationHoverProps> = ({
  marker,
  paper,
  onSelectPaper,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!paper) {
    return <span className="font-mono text-indigo-400 font-semibold">[{marker}]</span>;
  }

  const authorNames = paper.authors.length > 0
    ? paper.authors.slice(0, 2).map((a) => a.name).join(', ') + (paper.authors.length > 2 ? ' et al.' : '')
    : 'Unknown authors';

  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        onClick={() => onSelectPaper?.(paper.id)}
        className="inline-flex items-center text-xs font-mono font-bold text-indigo-400 hover:text-indigo-300 hover:underline px-1 py-0.5 rounded bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 mx-0.5 transition-colors cursor-pointer"
      >
        [{marker}]
      </button>

      {isOpen && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-700 shadow-2xl text-left pointer-events-auto animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-indigo-400 mb-1">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Citation [{marker}] • {paper.id}</span>
          </div>

          <h5 className="text-xs font-semibold text-slate-100 leading-snug line-clamp-2">
            {paper.title}
          </h5>

          <div className="mt-1 text-[11px] text-slate-400">
            {authorNames} {paper.year ? `(${paper.year})` : ''}
          </div>

          {paper.venue && (
            <div className="text-[11px] italic text-slate-500 truncate mt-0.5">
              {paper.venue}
            </div>
          )}

          <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">
              {paper.availability === 'full_text' ? 'Full-text PDF' : 'Abstract-only'}
            </span>
            {paper.url && (
              <a
                href={paper.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-indigo-400 hover:underline"
              >
                View Paper <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            )}
          </div>
        </div>
      )}
    </span>
  );
};
