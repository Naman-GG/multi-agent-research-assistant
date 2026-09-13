import React, { useState } from 'react';
import type { RunConfig } from '../api/types';
import { apiClient } from '../api/client';
import {
  Sparkles,
  Search,
  Sliders,
  Play,
  ArrowRight,
  ShieldCheck,
  Check,
} from 'lucide-react';

interface NewRunProps {
  onRunCreated: (runId: string, initialQuestion: string) => void;
  onLoadSample: () => void;
}

const SAMPLE_QUESTIONS = [
  "Do corticosteroids reduce mortality in patients hospitalized with COVID-19?",
  "Do statins reduce dementia incidence in older adults with hyperlipidemia?",
  "Does intermittent fasting improve insulin sensitivity compared to calorie restriction?",
  "Are GLP-1 receptor agonists neuroprotective in Alzheimer's disease models?",
];

export const NewRun: React.FC<NewRunProps> = ({
  onRunCreated,
  onLoadSample,
}) => {
  const [question, setQuestion] = useState(SAMPLE_QUESTIONS[0]);
  const [maxPapers, setMaxPapers] = useState(12);
  const [maxSubQueries, setMaxSubQueries] = useState(5);
  const [allowAbstractOnly, setAllowAbstractOnly] = useState(true);
  const [selectedSources, setSelectedSources] = useState<string[]>(['openalex']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const config: Partial<RunConfig> = {
        max_papers: maxPapers,
        max_sub_queries: maxSubQueries,
        sources: selectedSources,
        allow_abstract_only: allowAbstractOnly,
      };
      const res = await apiClient.startRun({ question, config });
      onRunCreated(res.run_id, question);
    } catch (err) {
      console.error('Failed to start run:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to connect to backend server. Make sure FastAPI is running on port 8000.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSource = (src: string) => {
    if (selectedSources.includes(src)) {
      if (selectedSources.length > 1) {
        setSelectedSources(selectedSources.filter((s) => s !== src));
      }
    } else {
      setSelectedSources([...selectedSources, src]);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      
      {/* Hero Banner */}
      <div className="text-center space-y-3 mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-semibold">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Claim-Level Verifiable Academic Synthesis</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
          Multi-Agent Research Assistant
        </h1>
        <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto">
          Five specialist agents collaborate to plan queries, retrieve papers, extract atomic findings with verbatim quotes, and filter hallucinations via two-stage verification.
        </p>
      </div>

      {/* Main Form Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl backdrop-blur-sm">
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-500/50 text-red-200 text-xs flex items-start justify-between gap-3">
            <div>
              <span className="font-bold">Backend Connection Error:</span> {errorMessage}
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-400 hover:text-red-200 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Question Input */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-200">
              Research Question
            </label>
            <div className="relative">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={3}
                required
                placeholder="Enter a focused biomedical or scientific research question..."
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none font-medium leading-relaxed"
              />
              <div className="absolute right-3 bottom-3 text-slate-500 text-xs font-mono">
                {question.length} chars
              </div>
            </div>

            {/* Starter Suggestion Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-xs text-slate-500 font-medium">Examples:</span>
              {SAMPLE_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setQuestion(q)}
                  className="text-xs px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white transition-colors truncate max-w-xs text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Configuration Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-800/80">
            
            {/* Left: Sources */}
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-sky-400" />
                Academic Search Sources (Track B)
              </label>

              <div className="space-y-2">
                <div
                  onClick={() => toggleSource('openalex')}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedSources.includes('openalex')
                      ? 'bg-slate-800/80 border-indigo-500/80 text-slate-100'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded flex items-center justify-center border ${
                      selectedSources.includes('openalex') ? 'bg-indigo-600 border-indigo-500' : 'border-slate-600'
                    }`}>
                      {selectedSources.includes('openalex') && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div>
                      <div className="text-xs font-semibold">OpenAlex (Primary)</div>
                      <div className="text-[11px] text-slate-400">Metadata, abstracts & polite pool integration</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Review 1 Active
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border bg-slate-950/30 border-slate-800/60 text-slate-500 opacity-60">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded border border-slate-700" />
                    <div>
                      <div className="text-xs font-semibold">arXiv / Semantic Scholar / Crossref</div>
                      <div className="text-[11px]">Full PDF retrieval and citation graph backfill</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                    Week 5 Scope
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Limits & Sliders */}
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                Execution Limits
              </label>

              <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                {/* Max Papers Slider */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium">Max Papers to Retrieve</span>
                    <span className="font-mono text-indigo-400 font-bold">{maxPapers}</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="20"
                    value={maxPapers}
                    onChange={(e) => setMaxPapers(Number(e.target.value))}
                    className="w-full accent-indigo-500 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Sub-Queries */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium">Planned Sub-Queries</span>
                    <span className="font-mono text-indigo-400 font-bold">{maxSubQueries}</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="6"
                    value={maxSubQueries}
                    onChange={(e) => setMaxSubQueries(Number(e.target.value))}
                    className="w-full accent-indigo-500 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Abstract-only toggle */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-slate-300 font-medium">Allow Abstract-Only Papers</span>
                  <button
                    type="button"
                    onClick={() => setAllowAbstractOnly(!allowAbstractOnly)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      allowAbstractOnly ? 'bg-indigo-600' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        allowAbstractOnly ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onLoadSample}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors border border-slate-700 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Inspect Sample Run (Review 1 Demo)</span>
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white shadow-lg shadow-indigo-500/25 transition-all transform active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{isSubmitting ? 'Starting Run...' : 'Launch Multi-Agent Pipeline'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </form>
      </div>

    </div>
  );
};
