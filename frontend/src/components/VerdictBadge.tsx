import React from 'react';
import type { VerdictLabel, VerificationStage } from '../api/types';
import { CheckCircle2, XCircle, AlertTriangle, Search, FileQuestion } from 'lucide-react';

interface VerdictBadgeProps {
  label: VerdictLabel | string;
  stage?: VerificationStage;
  confidence?: number | null;
  matchScore?: number | null;
  size?: 'sm' | 'md' | 'lg';
}

export const VerdictBadge: React.FC<VerdictBadgeProps> = ({
  label,
  stage,
  confidence,
  matchScore,
  size = 'md',
}) => {
  const getBadgeConfig = () => {
    switch (label) {
      case 'supported':
        return {
          bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          icon: <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-400 shrink-0" />,
          text: 'Supported',
        };
      case 'partial':
        return {
          bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          icon: <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-400 shrink-0" />,
          text: 'Partially Supported',
        };
      case 'unsupported':
        return {
          bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
          icon: <XCircle className="w-3.5 h-3.5 mr-1 text-rose-400 shrink-0" />,
          text: 'Unsupported',
        };
      case 'contradicted':
        return {
          bg: 'bg-red-600/15 text-red-400 border-red-500/40',
          icon: <XCircle className="w-3.5 h-3.5 mr-1 text-red-400 shrink-0" />,
          text: 'Contradicted',
        };
      case 'quote_found':
        return {
          bg: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
          icon: <Search className="w-3.5 h-3.5 mr-1 text-blue-400 shrink-0" />,
          text: 'Quote Found (Stage 1)',
        };
      case 'quote_not_found':
        return {
          bg: 'bg-red-500/15 text-red-300 border-red-500/40',
          icon: <FileQuestion className="w-3.5 h-3.5 mr-1 text-red-400 shrink-0" />,
          text: 'Fabricated Quote (Stage 1 Reject)',
        };
      default:
        return {
          bg: 'bg-slate-800 text-slate-300 border-slate-700',
          icon: null,
          text: label,
        };
    }
  };

  const config = getBadgeConfig();
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1 font-medium',
    lg: 'text-sm px-3 py-1.5 font-semibold',
  }[size];

  return (
    <span
      className={`inline-flex items-center rounded-full border ${config.bg} ${sizeClasses} transition-all`}
    >
      {config.icon}
      <span>{config.text}</span>
      {stage === 'span' && matchScore !== undefined && matchScore !== null && (
        <span className="ml-1.5 opacity-75 font-mono text-[10px]">
          ({matchScore.toFixed(0)}%)
        </span>
      )}
      {stage === 'entailment' && confidence !== undefined && confidence !== null && (
        <span className="ml-1.5 opacity-75 font-mono text-[10px]">
          ({(confidence * 100).toFixed(0)}% conf)
        </span>
      )}
    </span>
  );
};
