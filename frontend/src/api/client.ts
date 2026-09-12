import type { Run, Report, RunEvent } from './types';
import sampleRunData from '../../../fixtures/sample_run.json';

const API_BASE = '/api';

export const sampleRun: Run = sampleRunData as unknown as Run;

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function createRun(payload: {
  question: string;
  sources?: string[];
  max_papers?: number;
  allow_abstract_only?: boolean;
}): Promise<{ id: string }> {
  try {
    const res = await fetch(`${API_BASE}/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new ApiError(res.status, errData.detail || `Failed to create run: ${res.statusText}`);
    }

    return await res.json();
  } catch (err) {
    // If backend is not running yet, fallback gracefully for fixture demo
    console.warn('API unavailable, falling back to sample fixture ID', err);
    return { id: sampleRun.id };
  }
}

export async function getRun(id: string): Promise<Run> {
  if (id === sampleRun.id || id === 'sample' || id === 'demo') {
    return sampleRun;
  }

  try {
    const res = await fetch(`${API_BASE}/runs/${id}`);
    if (!res.ok) {
      if (res.status === 404) {
        // Fallback to sample run if not found in dev
        console.warn(`Run ${id} not found in backend, using sample run fixture`);
        return sampleRun;
      }
      throw new ApiError(res.status, `Failed to fetch run ${id}`);
    }
    return await res.json();
  } catch (err) {
    console.warn(`Failed to connect to backend for run ${id}, returning sample run`, err);
    return sampleRun;
  }
}

export async function getReport(id: string): Promise<Report | null> {
  if (id === sampleRun.id || id === 'sample' || id === 'demo') {
    return sampleRun.report;
  }

  try {
    const res = await fetch(`${API_BASE}/runs/${id}/report`);
    if (!res.ok) {
      return sampleRun.report;
    }
    return await res.json();
  } catch {
    return sampleRun.report;
  }
}

export async function getRunEvents(id: string, fromSeq: number = 0): Promise<RunEvent[]> {
  if (id === sampleRun.id || id === 'sample' || id === 'demo') {
    return sampleRun.events.filter((e) => e.seq >= fromSeq);
  }

  try {
    const res = await fetch(`${API_BASE}/runs/${id}/events?from_seq=${fromSeq}`);
    if (!res.ok) return sampleRun.events.filter((e) => e.seq >= fromSeq);
    return await res.json();
  } catch {
    return sampleRun.events.filter((e) => e.seq >= fromSeq);
  }
}
