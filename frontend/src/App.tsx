import { useState, useEffect, useRef } from 'react';
import type { Run } from './api/types';
import { apiClient } from './api/client';
import { Navbar } from './components/Navbar';
import { NewRun } from './pages/NewRun';
import { RunTrace } from './pages/RunTrace';
import { ReportPage } from './pages/Report';

export function App() {
  const [currentRun, setCurrentRun] = useState<Run>(apiClient.getSampleRun());
  const [activeRoute, setActiveRoute] = useState<'new' | 'trace' | 'report'>('new');
  const [isDemoMode, setIsDemoMode] = useState(true);
  // Loading a real run by id. While 'loading' or 'error' we must NOT render the
  // previous run -- the initial state is the sample run, and showing it under a
  // real run's URL is exactly the "looks like it worked" failure we removed.
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);
  const currentRunIdRef = useRef<string>(currentRun.id);
  useEffect(() => {
    currentRunIdRef.current = currentRun.id;
  }, [currentRun.id]);

  // Handle URL hash changes for deep-linking (/run/xxx, /report/xxx)
  useEffect(() => {
    const loadRun = (id: string) => {
      // A run we just created is already on screen (empty, streaming): refresh it
      // quietly. Anything else shows a loading state, then the run or an error.
      const alreadyShowing = currentRunIdRef.current === id;
      if (!alreadyShowing) {
        setLoadState('loading');
        setLoadError(null);
      }
      apiClient
        .getRun(id)
        .then((r) => {
          setCurrentRun(r);
          setLoadState('idle');
        })
        .catch((err) => {
          console.error('Failed to fetch run:', err);
          if (!alreadyShowing) {
            setLoadError(err instanceof Error ? err.message : String(err));
            setLoadState('error');
          }
        });
    };

    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, '');
      const sample = apiClient.getSampleRun();

      if (hash.startsWith('run/')) {
        const id = hash.replace('run/', '');
        if (id === sample.id) {
          setCurrentRun(sample);
          setIsDemoMode(true);
          setActiveRoute('trace');
        } else if (id) {
          setIsDemoMode(false);
          setActiveRoute('trace');
          loadRun(id);
        }
      } else if (hash.startsWith('report/')) {
        const id = hash.replace('report/', '');
        if (id === sample.id) {
          setCurrentRun(sample);
          setIsDemoMode(true);
          setActiveRoute('report');
        } else if (id) {
          setIsDemoMode(false);
          setActiveRoute('report');
          loadRun(id);
        }
      } else if (hash === '' || hash === 'new') {
        setLoadState('idle');
        setActiveRoute('new');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleNavigate = (route: 'new' | 'trace' | 'report', runId?: string) => {
    const id = runId || currentRun.id;
    if (route === 'new') {
      window.location.hash = '#/';
      setActiveRoute('new');
    } else if (route === 'trace') {
      window.location.hash = `#/run/${id}`;
      setActiveRoute('trace');
    } else if (route === 'report') {
      window.location.hash = `#/report/${id}`;
      setActiveRoute('report');
    }
  };

  const handleRunCreated = (runId: string, initialQuestion: string) => {
    setIsDemoMode(false);
    const initialRun: Run = {
      id: runId,
      question: initialQuestion,
      status: 'pending',
      config: {
        max_papers: 12,
        max_sub_queries: 5,
        sources: ['openalex'],
        year_from: null,
        year_to: null,
        allow_abstract_only: true,
      },
      plan: null,
      papers: [],
      summaries: [],
      verdicts: [],
      report: null,
      events: [],
      created_at: new Date().toISOString(),
      completed_at: null,
      error: null,
    };
    currentRunIdRef.current = runId;
    setLoadState('idle');
    setCurrentRun(initialRun);
    handleNavigate('trace', runId);
  };

  const handleLoadSample = () => {
    const sample = apiClient.getSampleRun();
    setIsDemoMode(true);
    setLoadState('idle');
    setCurrentRun(sample);
    handleNavigate('report', sample.id);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 antialiased">
      <Navbar
        activeRoute={activeRoute}
        runId={loadState === 'idle' ? currentRun.id : undefined}
        onNavigate={handleNavigate}
        onLoadSample={handleLoadSample}
      />

      <main className="flex-1 pb-16">
        {activeRoute === 'new' && (
          <NewRun
            onRunCreated={handleRunCreated}
            onLoadSample={handleLoadSample}
          />
        )}

        {activeRoute !== 'new' && loadState === 'loading' && (
          <div className="max-w-xl mx-auto mt-24 text-center text-slate-400 text-sm">
            Loading run…
          </div>
        )}

        {activeRoute !== 'new' && loadState === 'error' && (
          <div className="max-w-xl mx-auto mt-24 p-6 rounded-2xl bg-red-950/40 border border-red-500/40 text-center space-y-4">
            <h2 className="text-lg font-bold text-red-200">Run not found</h2>
            <p className="text-xs text-red-300/80 break-words">{loadError}</p>
            <p className="text-xs text-slate-400">
              The link may be old, or the backend isn't running on port 8000.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => handleNavigate('new')}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
              >
                Start a new run
              </button>
              <button
                onClick={handleLoadSample}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
              >
                Open demo run
              </button>
            </div>
          </div>
        )}

        {activeRoute === 'trace' && loadState === 'idle' && (
          <RunTrace
            run={currentRun}
            isDemo={isDemoMode}
            onNavigateToReport={(id) => handleNavigate('report', id)}
          />
        )}

        {activeRoute === 'report' && loadState === 'idle' && (
          <ReportPage run={currentRun} />
        )}
      </main>

      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        Multi-Agent Research Assistant • Track B: Retrieval & Interface • Capstone 2026
      </footer>
    </div>
  );
}

export default App;
