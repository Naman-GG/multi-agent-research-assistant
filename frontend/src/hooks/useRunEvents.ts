import { useEffect, useRef, useState } from 'react';
import type { EventType, RunEvent } from '../api/types';
import sampleRunData from '../../../fixtures/sample_run.json';

const sampleRunEvents = (sampleRunData as unknown as { events: RunEvent[] }).events || [];

const EVENT_TYPES: EventType[] = [
  'run_started',
  'stage_started',
  'stage_completed',
  'sub_queries_planned',
  'papers_retrieved',
  'paper_summarized',
  'claim_verified',
  'claim_repaired',
  'report_ready',
  'run_completed',
  'error',
];

/** True for the events after which the backend sends nothing more for this run.
 *  A per-paper `error` from the summarizer is NOT terminal -- the run carries on --
 *  only the orchestrator's `error` ends the run. */
function isTerminal(event: RunEvent): boolean {
  return event.type === 'run_completed' || (event.type === 'error' && event.agent === 'orchestrator');
}

interface UseRunEventsOptions {
  runId: string;
  initialEvents?: RunEvent[];
  enabled?: boolean;
  isDemo?: boolean;
  onEvent?: (event: RunEvent) => void;
}

export function useRunEvents({
  runId,
  initialEvents = [],
  enabled = true,
  isDemo = false,
  onEvent,
}: UseRunEventsOptions) {
  const [events, setEvents] = useState<RunEvent[]>(initialEvents);
  const [isConnected, setIsConnected] = useState(false);
  const [isFinished, setIsFinished] = useState(initialEvents.some(isTerminal));
  const [error, setError] = useState<string | null>(null);
  const lastSeqRef = useRef<number>(
    initialEvents.length ? Math.max(...initialEvents.map((e) => e.seq)) : 0
  );

  useEffect(() => {
    if (initialEvents.length > 0) {
      setEvents(initialEvents);
      lastSeqRef.current = Math.max(...initialEvents.map((e) => e.seq));
      if (initialEvents.some(isTerminal)) setIsFinished(true);
    }
  }, [initialEvents]);

  useEffect(() => {
    if (!enabled || !runId) return;

    let isCancelled = false;
    let es: EventSource | null = null;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    if (isDemo) {
      // Explicit demo mode playback
      let idx = 0;
      const targetEvents = sampleRunEvents;

      const pushNext = () => {
        if (isCancelled || idx >= targetEvents.length) return;
        const ev = targetEvents[idx++];
        lastSeqRef.current = ev.seq;
        setEvents((prev) => {
          if (prev.some((e) => e.seq === ev.seq)) return prev;
          return [...prev, ev];
        });
        onEvent?.(ev);
        timerId = setTimeout(pushNext, 350 + Math.random() * 300);
      };

      timerId = setTimeout(pushNext, 150);
      return () => {
        isCancelled = true;
        if (timerId) clearTimeout(timerId);
      };
    }

    // A run that has already ended has nothing left to stream. Opening an
    // EventSource anyway makes the browser reconnect every few seconds forever,
    // because the server closes each connection straight after the backlog.
    if (initialEvents.some(isTerminal)) return;

    const stop = () => {
      if (!es) return;
      EVENT_TYPES.forEach((eventType) => es?.removeEventListener(eventType, processMessageEvent));
      es.close();
      es = null;
    };

    const processMessageEvent = (e: MessageEvent) => {
      if (isCancelled) return;
      try {
        const event: RunEvent = JSON.parse(e.data);
        if (event.seq > lastSeqRef.current) {
          lastSeqRef.current = event.seq;
          setEvents((prev) => {
            if (prev.some((existing) => existing.seq === event.seq)) return prev;
            return [...prev, event];
          });
          onEvent?.(event);
        }
        if (isTerminal(event)) {
          // Close explicitly: EventSource treats the server ending the stream as a
          // dropped connection and would otherwise keep reconnecting.
          stop();
          setIsConnected(false);
          setIsFinished(true);
          setError(null);
        }
      } catch (err) {
        console.error('Error parsing SSE event:', err);
      }
    };

    es = new EventSource(`/api/runs/${runId}/events?from_seq=${lastSeqRef.current}`);

    es.onopen = () => {
      if (isCancelled) return;
      setIsConnected(true);
      setError(null);
    };

    // The backend sends named events only; onmessage is kept for unnamed ones.
    es.onmessage = processMessageEvent;
    EVENT_TYPES.forEach((eventType) => es?.addEventListener(eventType, processMessageEvent));

    es.onerror = () => {
      if (isCancelled || !es) return;
      setIsConnected(false);
      setError('Connection to event stream lost. Attempting to reconnect...');
    };

    return () => {
      isCancelled = true;
      stop();
      if (timerId) clearTimeout(timerId);
    };
    // initialEvents is read only to decide whether to connect; re-running on every
    // parent render (a new array each time) would tear down a live stream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, enabled, isDemo, onEvent]);

  return { events, isConnected, isFinished, error };
}
