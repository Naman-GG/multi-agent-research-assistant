import { useState, useEffect } from 'react';
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

  // Handle URL hash changes for deep-linking (/run/xxx, /report/xxx)
  useEffect(() => {
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
          apiClient.getRun(id).then((r) => {
            setCurrentRun(r);
          }).catch((err) => {
            console.error('Failed to fetch run:', err);
          });
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
          apiClient.getRun(id).then((r) => {
            setCurrentRun(r);
          }).catch((err) => {
            console.error('Failed to fetch run report:', err);
          });
        }
      } else if (hash === '' || hash === 'new') {
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
    setCurrentRun(initialRun);
    handleNavigate('trace', runId);
  };

  const handleLoadSample = () => {
    const sample = apiClient.getSampleRun();
    setIsDemoMode(true);
    setCurrentRun(sample);
    handleNavigate('report', sample.id);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 antialiased">
      <Navbar
        activeRoute={activeRoute}
        runId={currentRun.id}
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

        {activeRoute === 'trace' && (
          <RunTrace
            run={currentRun}
            isDemo={isDemoMode}
            onNavigateToReport={(id) => handleNavigate('report', id)}
          />
        )}

        {activeRoute === 'report' && (
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
