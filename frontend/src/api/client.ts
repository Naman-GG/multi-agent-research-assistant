import type { Report, Run, RunConfig } from './types';
import sampleRunData from '../../../fixtures/sample_run.json';

const sampleRun = sampleRunData as unknown as Run;

export interface StartRunResult {
  run_id: string;
  status: string;
}

export const apiClient = {
  async startRun(params: { question: string; config?: Partial<RunConfig> }): Promise<StartRunResult> {
    const resp = await fetch('/api/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: params.question,
        config: params.config,
      }),
    });
    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '');
      throw new Error(`Failed to start run (${resp.status}): ${errBody || resp.statusText}`);
    }
    const data = await resp.json();
    return {
      run_id: data.run_id,
      status: data.status,
    };
  },

  async getRun(id: string): Promise<Run> {
    const resp = await fetch(`/api/runs/${id}`);
    if (!resp.ok) {
      throw new Error(`Run not found (${resp.status}: ${resp.statusText})`);
    }
    return await resp.json();
  },

  async getReport(id: string): Promise<Report | null> {
    const resp = await fetch(`/api/runs/${id}/report`);
    if (resp.status === 409 || resp.status === 404) {
      return null;
    }
    if (!resp.ok) {
      throw new Error(`Failed to fetch report (${resp.status}: ${resp.statusText})`);
    }
    return await resp.json();
  },

  getSampleRun(): Run {
    return sampleRun;
  }
};
