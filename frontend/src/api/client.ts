import type { Report, Run, RunConfig } from './types';
import sampleRunData from '../../../fixtures/sample_run.json';

const sampleRun = sampleRunData as unknown as Run;

export const apiClient = {
  async startRun(params: { question: string; config?: Partial<RunConfig> }): Promise<Run> {
    try {
      const resp = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: params.question,
          config: params.config,
        }),
      });
      if (!resp.ok) {
        throw new Error(`API error: ${resp.statusText}`);
      }
      return await resp.json();
    } catch {
      // Return simulated sample run if backend is offline
      return {
        ...sampleRun,
        id: `RUN-${Date.now().toString(36).toUpperCase()}`,
        question: params.question || sampleRun.question,
        status: 'planning',
      };
    }
  },

  async getRun(id: string): Promise<Run> {
    try {
      const resp = await fetch(`/api/runs/${id}`);
      if (!resp.ok) {
        throw new Error(`Run not found (${resp.status})`);
      }
      return await resp.json();
    } catch {
      // Fallback to fixture for development and demo mode
      return { ...sampleRun, id };
    }
  },

  async getReport(id: string): Promise<Report | null> {
    try {
      const resp = await fetch(`/api/runs/${id}/report`);
      if (!resp.ok) {
        throw new Error(`Report not available (${resp.status})`);
      }
      return await resp.json();
    } catch {
      return sampleRun.report;
    }
  },

  getSampleRun(): Run {
    return sampleRun;
  }
};
