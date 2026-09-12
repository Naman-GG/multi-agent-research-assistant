import React, { useState } from 'react';
import type { PaperRef, Claim } from '../api/types';
import { ExternalLink, BookOpen, FileText } from 'lucide-react';

interface CitationHoverProps {
  marker: number;
  paper?: PaperRef;
  claims?: Claim[];
  onClick?: () => void;
}

export const CitationHover: React.FC<CitationHoverProps> = ({
  marker,
  paper,
  claims = [],
  onClick,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <span
      className="relative inline-block font-sans"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center justify-center font-mono font-bold text-xs px-1.5 py-0.2 mx-0.5 rounded bg-[#AACDDC]/70 hover:bg-[#81A6C6] text-slate-900 hover:text-white border border-[#81A6C6]/50 transition-all cursor-pointer shadow-2xs"
        aria-label={`Citation [${marker}]`}
      >
        [{marker}]
      </button>

      {isOpen && paper && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 p-4 rounded-xl bg-white border border-[#D2C4B4] shadow-xl text-left text-slate-800 pointer-events-auto animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#F3E3D0] text-slate-800 border border-[#D2C4B4]">
              [{marker}] {paper.id}
            </span>
            {paper.availability === 'abstract_only' ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                <BookOpen className="w-2.5 h-2.5" />
                Abstract Only
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#AACDDC]/60 text-slate-800 border border-[#81A6C6]/40">
                <FileText className="w-2.5 h-2.5" />
                Full Text
              </span>
            )}
          </div>

          <h5 className="text-xs font-serif font-bold text-slate-900 leading-snug line-clamp-2 mb-1">
            {paper.title}
          </h5>

          <p className="text-[11px] text-slate-500 line-clamp-1 mb-2 font-sans">
            {paper.authors.slice(0, 2).map((a) => a.name).join(', ')}
            {paper.authors.length > 2 ? ' et al.' : ''}
            {paper.year ? ` (${paper.year})` : ''}
          </p>

          {claims.length > 0 && (
            <div className="pt-2 border-t border-[#E2E8F0] text-[11px] text-slate-700">
              <span className="text-slate-500 font-medium block mb-1">Backed Claim:</span>
              <p className="italic text-slate-700 line-clamp-2 bg-[#F8FAFC] p-2 rounded border border-[#E2E8F0] font-serif">
                "{claims[0].text}"
              </p>
            </div>
          )}

          {paper.url && (
            <a
              href={paper.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2.5 flex items-center justify-end gap-1 text-[11px] text-[#81A6C6] hover:text-[#6c93b5] hover:underline font-medium"
            >
              <span>View Source Paper</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
    </span>
  );
};
