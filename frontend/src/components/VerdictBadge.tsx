import React from 'react';
import type { VerdictLabel } from '../api/types';
import { CheckCircle2, XCircle, AlertTriangle, Search, Ban } from 'lucide-react';

interface VerdictBadgeProps {
  label: VerdictLabel;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const VerdictBadge: React.FC<VerdictBadgeProps> = ({
  label,
  size = 'md',
  showIcon = true,
}) => {
  let bg = 'bg-slate-100 text-slate-700 border-slate-300';
  let icon = null;
  let text = label as string;

  switch (label) {
    case 'quote_found':
      bg = 'bg-[#AACDDC]/40 text-slate-800 border-[#81A6C6]/50';
      icon = <Search className="w-3 h-3 text-[#81A6C6]" />;
      text = 'Quote Found';
      break;
    case 'quote_not_found':
      bg = 'bg-rose-50 text-rose-700 border-rose-300 ring-1 ring-rose-200';
      icon = <Ban className="w-3 h-3 text-rose-600" />;
      text = 'Fabricated Quote (Stage 1 Reject)';
      break;
    case 'supported':
      bg = 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-1 ring-emerald-200';
      icon = <CheckCircle2 className="w-3 h-3 text-emerald-600" />;
      text = 'Supported';
      break;
    case 'partial':
      bg = 'bg-amber-50 text-amber-700 border-amber-300';
      icon = <AlertTriangle className="w-3 h-3 text-amber-600" />;
      text = 'Partial (Repaired)';
      break;
    case 'unsupported':
      bg = 'bg-rose-50 text-rose-600 border-rose-200';
      icon = <XCircle className="w-3 h-3 text-rose-500" />;
      text = 'Unsupported';
      break;
    case 'contradicted':
      bg = 'bg-red-100 text-red-800 border-red-300';
      icon = <Ban className="w-3 h-3 text-red-700" />;
      text = 'Contradicted';
      break;
  }

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-medium',
    lg: 'text-sm px-3 py-1.5 gap-2 font-semibold',
  }[size];

  return (
    <span
      className={`inline-flex items-center rounded-full border ${bg} ${sizeClasses} transition-all font-sans`}
    >
      {showIcon && icon}
      <span>{text}</span>
    </span>
  );
};
