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

  // Handle URL hash changes for deep-linking (/run/xxx, /report/xxx)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, '');
      if (hash.startsWith('run/')) {
        const id = hash.replace('run/', '');
        if (id && currentRun.id !== id) {
          apiClient.getRun(id).then((r) => {
            setCurrentRun(r);
            setActiveRoute('trace');
          });
        } else {
          setActiveRoute('trace');
        }
      } else if (hash.startsWith('report/')) {
        const id = hash.replace('report/', '');
        if (id && currentRun.id !== id) {
          apiClient.getRun(id).then((r) => {
            setCurrentRun(r);
            setActiveRoute('report');
          });
        } else {
          setActiveRoute('report');
        }
      } else if (hash === '' || hash === 'new') {
        setActiveRoute('new');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [currentRun.id]);

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

  const handleRunCreated = (newRun: Run) => {
    setCurrentRun(newRun);
    handleNavigate('trace', newRun.id);
  };

  const handleLoadSample = () => {
    const sample = apiClient.getSampleRun();
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
