import React, { useState } from 'react';
import { createRun, sampleRun } from '../api/client';
import {
  Sparkles,
  ArrowRight,
  Database,
  Sliders,
  ShieldCheck,
  Globe2,
  CheckCircle2,
  Lock,
  Layers,
  FileSpreadsheet,
  Gauge,
  Cpu,
  CornerDownRight,
  ChevronDown,
  Info,
} from 'lucide-react';

interface NewRunProps {
  onStartRun: (runId: string) => void;
  onViewSample: () => void;
}

const DOCKET_BENCHMARKS = [
  {
    id: 'DOC-01',
    label: 'COVID-19 / Corticosteroids',
    query: 'Do corticosteroids reduce mortality in patients hospitalized with COVID-19?',
    tag: 'CLINICAL BENCHMARK',
    subtext: 'High-density multi-trial extraction with known contested subgroups',
  },
  {
    id: 'DOC-02',
    label: 'Metabolic / Intermittent Fasting',
    query: 'Does intermittent fasting improve insulin sensitivity in type 2 diabetes?',
    tag: 'METABOLIC PROFILE',
    subtext: 'Heterogeneous trial timelines & insulin resistance biomarkers',
  },
  {
    id: 'DOC-03',
    label: 'Environmental / Microplastics',
    query: 'What are the effects of dietary microplastics on the human gut microbiome?',
    tag: 'TOXICOLOGY PROTOCOL',
    subtext: 'Emerging literature with high variance in extraction claims',
  },
  {
    id: 'DOC-04',
    label: 'Neurology / Statins & Dementia',
    query: 'Do statins reduce dementia risk in adults over 65?',
    tag: 'LONGITUDINAL COHORT',
    subtext: 'Observational claims requiring strict Stage 1 span isolation',
  },
];

const GEAR_STEPS = [
  { count: 4, name: 'FAST CALIBRATION', desc: 'Rapid query decomposition & smoke run' },
  { count: 8, name: 'TARGETED SYNTHESIS', desc: 'Focused evidence gathering for tight domains' },
  { count: 10, name: 'BALANCED COMPASS', desc: 'Optimal multi-agent review coverage' },
  { count: 12, name: 'DEEP DRAFTING', desc: 'Comprehensive claim extraction across venues' },
  { count: 20, name: 'EXHAUSTIVE AUDIT', desc: 'Maximum literature coverage for capstone reviews' },
];

export const NewRun: React.FC<NewRunProps> = ({ onStartRun, onViewSample }) => {
  const [question, setQuestion] = useState(
    'Do corticosteroids reduce mortality in patients hospitalized with COVID-19?'
  );
  const [selectedGear, setSelectedGear] = useState<number>(10);
  const [allowAbstractOnly, setAllowAbstractOnly] = useState<boolean>(true);
  const [openAlexActive, setOpenAlexActive] = useState<boolean>(true);
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    try {
      const result = await createRun({
        question: question.trim(),
        sources: ['openalex'],
        max_papers: selectedGear,
        allow_abstract_only: allowAbstractOnly,
      });

      onStartRun(result.id || sampleRun.id);
    } catch {
      onStartRun(sampleRun.id);
    } finally {
      setLoading(false);
    }
  };

  const handleSlotDocket = (queryText: string) => {
    setQuestion(queryText);
  };

  const activeGearInfo = GEAR_STEPS.find((g) => g.count === selectedGear) || GEAR_STEPS[2];

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-8">
      {/* Drafting Instrument Header */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 border-b-2 border-[#D2C4B4] pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 font-mono text-[11px] font-bold text-slate-700 tracking-wider">
            <span className="inline-block w-2 h-2 rounded-full bg-[#81A6C6] animate-pulse" />
            <span>OPTICAL APERTURE // STAGE 01</span>
            <span className="text-slate-400">/</span>
            <span className="text-[#81A6C6]">RESEARCH COMPOSITION</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-slate-900 tracking-tight">
            Literature Review Workbench
          </h1>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs text-slate-600 bg-[#FAF7F2] p-2 rounded-xl border border-[#D2C4B4] shadow-xs">
          <span className="px-2 py-0.5 rounded bg-[#F3E3D0] border border-[#D2C4B4] font-semibold text-slate-800">
            SPEC: VERIFIABLE CLAIM
          </span>
          <span>STAGE-1 DETERMINISTIC + STAGE-2 CRITIC</span>
        </div>
      </div>

      {/* Main Drafting Canvas Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left 8-Cols: The Primary Drafting Lens & Docket */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Drafting Lens Aperture Box */}
          <div
            className={`chassis-panel rounded-2xl p-6 sm:p-7 relative transition-all duration-300 ${
              isFocused ? 'ring-2 ring-[#81A6C6] shadow-md -translate-y-0.5' : ''
            }`}
          >
            {/* Screws & Alignment Markers */}
            <div className="absolute top-3 left-3 mechanical-screw" />
            <div className="absolute top-3 right-3 mechanical-screw" />
            <div className="absolute bottom-3 left-3 mechanical-screw" />
            <div className="absolute bottom-3 right-3 mechanical-screw" />

            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2 font-mono text-xs font-bold text-slate-800 tracking-wider">
                <Layers className="w-4 h-4 text-[#81A6C6]" />
                <span>PRIMARY RESEARCH QUERY [FOCAL APERTURE]</span>
              </div>
              <div className="font-mono text-[10px] text-slate-500 ruler-ticks px-4 py-1 rounded bg-[#EFECE6] border border-[#D2C4B4]">
                CALIBRATION: NATURAL_LANGUAGE
              </div>
            </div>

            {/* Tactile Query Input Surface */}
            <div className="relative">
              <textarea
                rows={4}
                value={question}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Type or drop a research query into the drafting lens..."
                className="w-full bg-[#FAF8F5] border-2 border-[#D2C4B4] rounded-xl p-4 sm:p-5 text-slate-900 text-base font-serif leading-relaxed focus:outline-none focus:border-[#81A6C6] transition-all resize-none shadow-inner"
              />
              <div className="absolute bottom-3 right-4 font-mono text-[10px] text-slate-400 pointer-events-none">
                {question.length} CHARACTERS
              </div>
            </div>

            {/* Millimeter Scale Tick Strip */}
            <div className="h-2 ruler-ticks mt-3 opacity-60 rounded" />
          </div>

          {/* Benchmark Query Index Docket (Physical Cards with Drag / Click) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="font-mono text-xs font-bold text-slate-800 tracking-wider flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-[#81A6C6]" />
                <span>VERIFIED BENCHMARK DOCKETS [SLOT INTO LENS]</span>
              </span>
              <span className="font-mono text-[10px] text-slate-500">CLICK TO LOAD DOCKET</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {DOCKET_BENCHMARKS.map((docket) => {
                const isSelected = question === docket.query;
                return (
                  <div
                    key={docket.id}
                    onClick={() => handleSlotDocket(docket.query)}
                    className={`index-card rounded-xl p-4 cursor-pointer relative ${
                      isSelected
                        ? 'border-2 border-[#81A6C6] bg-[#F3E3D0]/60 ring-2 ring-[#AACDDC]/50'
                        : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-[#FAF7F2] border border-[#D2C4B4] text-slate-800">
                        {docket.id}
                      </span>
                      <span className="font-mono text-[9px] font-semibold px-2 py-0.5 rounded-full bg-[#AACDDC]/60 text-slate-800 border border-[#81A6C6]/30">
                        {docket.tag}
                      </span>
                    </div>

                    <h4 className="font-serif text-sm font-bold text-slate-900 leading-snug mb-1">
                      {docket.label}
                    </h4>

                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-2">
                      "{docket.query}"
                    </p>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-2 border-t border-[#D8CFC4]">
                      <span>{docket.subtext}</span>
                      <CornerDownRight className="w-3 h-3 text-[#81A6C6]" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 4-Cols: Mechanical Controls, Gear Selector & Action Actuator */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Instrument Parameters Chassis */}
          <div className="chassis-panel rounded-2xl p-5 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#D2C4B4]">
              <span className="font-mono text-xs font-bold text-slate-800 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#81A6C6]" />
                <span>INSTRUMENT ACTUATORS</span>
              </span>
              <span className="font-mono text-[10px] text-slate-500">MK-IV CALIBRATION</span>
            </div>

            {/* Control 1: Academic Sources Mechanical Rocker Switch */}
            <div className="space-y-3">
              <span className="font-mono text-[11px] font-bold text-slate-700 block uppercase tracking-wider">
                01. SOURCE RETRIEVAL FEED
              </span>

              {/* OpenAlex Rocker */}
              <div
                onClick={() => setOpenAlexActive(!openAlexActive)}
                className="chassis-inset p-3.5 rounded-xl flex items-center justify-between cursor-pointer group"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-serif font-bold text-sm text-slate-900">OpenAlex API</span>
                    <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold">
                      ACTIVE
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-500 block mt-0.5">
                    User-Agent: Polite Pool Rate Tier
                  </span>
                </div>

                {/* Mechanical Rocker Visual */}
                <div className="w-12 h-6 rounded-full rocker-toggle p-0.5 flex items-center border border-[#B8A999]">
                  <div
                    className={`w-5 h-5 rounded-full shadow-md transition-transform ${
                      openAlexActive
                        ? 'translate-x-6 bg-[#81A6C6] border border-white'
                        : 'translate-x-0 bg-slate-400'
                    }`}
                  />
                </div>
              </div>

              {/* Week 5 Locked Feeds */}
              <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#D2C4B4] opacity-70 flex items-center justify-between text-xs">
                <div>
                  <div className="flex items-center gap-1.5 text-slate-600 font-semibold font-serif">
                    <Lock className="w-3.5 h-3.5 text-slate-500" />
                    <span>arXiv / Semantic Scholar / Crossref</span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-500">Scheduled for Week 5 Review 2</span>
                </div>
                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-[#EFECE6] border border-[#D2C4B4] text-slate-600">
                  LOCKED
                </span>
              </div>
            </div>

            {/* Control 2: Stepped Gear-Shift for Max Papers */}
            <div className="space-y-3 pt-2 border-t border-[#D2C4B4]">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  02. SEARCH DEPTH STEPPER
                </span>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#81A6C6] text-white">
                  {selectedGear} PAPERS
                </span>
              </div>

              {/* Stepper Buttons (Gear Shifts) */}
              <div className="grid grid-cols-5 gap-1.5 bg-[#EFECE6] p-1.5 rounded-xl border border-[#D2C4B4]">
                {GEAR_STEPS.map((step) => (
                  <button
                    key={step.count}
                    type="button"
                    onClick={() => setSelectedGear(step.count)}
                    className={`py-2 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer ${
                      selectedGear === step.count
                        ? 'bg-white text-slate-900 border border-[#D2C4B4] shadow-sm scale-105'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
                    }`}
                  >
                    {step.count}
                  </button>
                ))}
              </div>

              <div className="p-2.5 rounded-lg bg-[#FAF7F2] border border-[#D2C4B4] text-[11px] font-mono text-slate-600">
                <span className="font-bold text-slate-800 block text-[10px] uppercase">
                  {activeGearInfo.name}
                </span>
                <span>{activeGearInfo.desc}</span>
              </div>
            </div>

            {/* Control 3: Abstract Only Safety Shutter */}
            <div className="pt-2 border-t border-[#D2C4B4]">
              <div
                onClick={() => setAllowAbstractOnly(!allowAbstractOnly)}
                className="chassis-inset p-3 rounded-xl flex items-center justify-between cursor-pointer"
              >
                <div>
                  <span className="font-serif font-bold text-xs text-slate-900 block">
                    Allow Abstract-Only Records
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">
                    Flagged as weaker evidence in synthesis
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={allowAbstractOnly}
                  onChange={(e) => setAllowAbstractOnly(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#81A6C6] cursor-pointer"
                />
              </div>
            </div>

            {/* Heavy Actuator Buttons */}
            <div className="pt-4 space-y-3">
              {/* Primary Launch Lever */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="w-full actuator-key py-3.5 px-6 rounded-xl font-mono text-sm font-bold text-white tracking-wider flex items-center justify-center gap-3 cursor-pointer group"
              >
                <Cpu className="w-5 h-5 text-white/90 group-hover:rotate-45 transition-transform" />
                <span>{loading ? 'ENGAGING ENGINE...' : 'EXECUTE PIPELINE'}</span>
                <ArrowRight className="w-4 h-4 text-white/90 group-hover:translate-x-1 transition-transform" />
              </button>

              {/* Replay Fixture Cassette Button */}
              <button
                type="button"
                onClick={onViewSample}
                className="w-full p-2.5 rounded-xl bg-[#F3E3D0] hover:bg-[#ebd9c2] border border-[#D2C4B4] font-mono text-xs font-bold text-slate-800 flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
              >
                <span>LOAD REPLAY FIXTURE [RUN-SAMPLE-001]</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tactile Hardware Plaques & Technical Specifications Drawers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
        {/* Plaque 1: Span Check */}
        <div
          onClick={() => setActiveDrawer(activeDrawer === 'span' ? null : 'span')}
          className="chassis-panel rounded-xl p-4 cursor-pointer hover:border-[#81A6C6] transition-all relative group"
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-[#AACDDC]/70 border border-[#81A6C6]/40 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#81A6C6]" />
              </div>
              <span className="font-mono text-xs font-bold text-slate-900">
                01. STAGE 1 SPAN CHECKER
              </span>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-slate-500 transition-transform ${
                activeDrawer === 'span' ? 'rotate-180 text-[#81A6C6]' : ''
              }`}
            />
          </div>
          <p className="text-xs text-slate-600 font-sans leading-relaxed">
            Deterministic substring search. Catches fabricated quotes without invoking LLMs (Cost: $0.00).
          </p>

          {activeDrawer === 'span' && (
            <div className="mt-3 pt-3 border-t border-[#D2C4B4] text-[11px] font-mono text-slate-600 bg-[#EFECE6] p-2.5 rounded-lg space-y-1 animate-in fade-in">
              <div>ALGORITHM: rapidfuzz token_sort_ratio</div>
              <div>THRESHOLD: 92.0% (Limits.span_match_threshold)</div>
              <div>OUTCOME: Rejects before Stage 2 entailment</div>
            </div>
          )}
        </div>

        {/* Plaque 2: Entailment Critic */}
        <div
          onClick={() => setActiveDrawer(activeDrawer === 'critic' ? null : 'critic')}
          className="chassis-panel rounded-xl p-4 cursor-pointer hover:border-[#81A6C6] transition-all relative group"
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-[#AACDDC]/70 border border-[#81A6C6]/40 flex items-center justify-center">
                <ShieldCheck className="w-3.5 h-3.5 text-[#81A6C6]" />
              </div>
              <span className="font-mono text-xs font-bold text-slate-900">
                02. STAGE 2 ENTAILMENT CRITIC
              </span>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-slate-500 transition-transform ${
                activeDrawer === 'critic' ? 'rotate-180 text-[#81A6C6]' : ''
              }`}
            />
          </div>
          <p className="text-xs text-slate-600 font-sans leading-relaxed">
            Isolated LLM judgment comparing only the atomic claim against the verified verbatim quote.
          </p>

          {activeDrawer === 'critic' && (
            <div className="mt-3 pt-3 border-t border-[#D2C4B4] text-[11px] font-mono text-slate-600 bg-[#EFECE6] p-2.5 rounded-lg space-y-1 animate-in fade-in">
              <div>LABELS: SUPPORTED | PARTIAL | UNSUPPORTED | CONTRADICTED</div>
              <div>REPAIR LOOP: 1 retry attempt for PARTIAL claims</div>
              <div>CROSS-ATTRIBUTION: Impossible by construction</div>
            </div>
          )}
        </div>

        {/* Plaque 3: OpenAlex Polite Pool */}
        <div
          onClick={() => setActiveDrawer(activeDrawer === 'pool' ? null : 'pool')}
          className="chassis-panel rounded-xl p-4 cursor-pointer hover:border-[#81A6C6] transition-all relative group"
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-[#AACDDC]/70 border border-[#81A6C6]/40 flex items-center justify-center">
                <Globe2 className="w-3.5 h-3.5 text-[#81A6C6]" />
              </div>
              <span className="font-mono text-xs font-bold text-slate-900">
                03. OPENALEX POLITE POOL
              </span>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-slate-500 transition-transform ${
                activeDrawer === 'pool' ? 'rotate-180 text-[#81A6C6]' : ''
              }`}
            />
          </div>
          <p className="text-xs text-slate-600 font-sans leading-relaxed">
            Direct integration with OpenAlex works API. Inverted index reconstruction + DOI deduplication.
          </p>

          {activeDrawer === 'pool' && (
            <div className="mt-3 pt-3 border-t border-[#D2C4B4] text-[11px] font-mono text-slate-600 bg-[#EFECE6] p-2.5 rounded-lg space-y-1 animate-in fade-in">
              <div>HEADER: mailto:CONTACT_EMAIL in User-Agent</div>
              <div>ABSTRACTS: Positional inverted index reconstructor</div>
              <div>DEDUPLICATION: DOI resolution + fuzzy token matching</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
