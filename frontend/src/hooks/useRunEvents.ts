import { useEffect, useState, useRef, useCallback } from 'react';
import type { RunEvent, RunStatus } from '../api/types';
import { sampleRun } from '../api/client';

interface UseRunEventsOptions {
  runId: string;
  simulateIfOffline?: boolean;
  onEvent?: (event: RunEvent) => void;
  onComplete?: () => void;
}

export function useRunEvents({
  runId,
  simulateIfOffline = true,
  onEvent,
  onComplete,
}: UseRunEventsOptions) {
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [status, setStatus] = useState<RunStatus>('pending');
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastSeqRef = useRef<number>(-1);
  const esRef = useRef<EventSource | null>(null);
  const simulationTimerRef = useRef<number | null>(null);

  const handleIncomingEvent = useCallback(
    (event: RunEvent) => {
      if (event.seq <= lastSeqRef.current) return;
      lastSeqRef.current = event.seq;

      setEvents((prev) => [...prev, event]);
      onEvent?.(event);

      if (event.type === 'run_completed' || event.payload?.status === 'completed') {
        setStatus('completed');
        onComplete?.();
      } else if (event.type === 'error' || event.payload?.status === 'failed') {
        setStatus('failed');
      } else if (event.type === 'stage_started' && typeof event.payload?.stage === 'string') {
        setStatus(event.payload.stage as RunStatus);
      }
    },
    [onEvent, onComplete]
  );

  const startSimulation = useCallback(() => {
    setIsConnected(true);
    let step = 0;
    const sampleEvents = sampleRun.events;

    const tick = () => {
      if (step < sampleEvents.length) {
        const ev = sampleEvents[step];
        handleIncomingEvent(ev);
        step++;
        simulationTimerRef.current = window.setTimeout(tick, 600);
      } else {
        setStatus('completed');
        setIsConnected(false);
        onComplete?.();
      }
    };

    simulationTimerRef.current = window.setTimeout(tick, 300);
  }, [handleIncomingEvent, onComplete]);

  useEffect(() => {
    lastSeqRef.current = -1;
    setEvents([]);
    setStatus('pending');
    setError(null);

    // If using sample or demo run ID, run local simulated playback
    if (runId === sampleRun.id || runId === 'sample' || runId === 'demo') {
      startSimulation();
      return () => {
        if (simulationTimerRef.current) clearTimeout(simulationTimerRef.current);
      };
    }

    let retryCount = 0;
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      const fromSeq = lastSeqRef.current + 1;
      const url = `/api/runs/${runId}/events?from_seq=${fromSeq}`;

      const es = new EventSource(url);
      esRef.current = es;

      es.onopen = () => {
        setIsConnected(true);
        setError(null);
        retryCount = 0;
      };

      es.onmessage = (messageEvent) => {
        try {
          const data: RunEvent = JSON.parse(messageEvent.data);
          handleIncomingEvent(data);
        } catch (e) {
          console.error('Failed to parse SSE event data', e);
        }
      };

      es.onerror = () => {
        setIsConnected(false);
        es.close();

        if (retryCount < 3) {
          retryCount++;
          setTimeout(connect, 2000 * retryCount);
        } else if (simulateIfOffline) {
          console.warn('SSE connection failed, falling back to simulated trace');
          startSimulation();
        } else {
          setError('Lost connection to live trace event stream.');
        }
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (esRef.current) {
        esRef.current.close();
      }
      if (simulationTimerRef.current) {
        clearTimeout(simulationTimerRef.current);
      }
    };
  }, [runId, simulateIfOffline, startSimulation, handleIncomingEvent]);

  return {
    events,
    status,
    isConnected,
    error,
  };
}
