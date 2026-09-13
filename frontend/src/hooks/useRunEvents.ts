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
  const [error, setError] = useState<string | null>(null);
  const lastSeqRef = useRef<number>(
    initialEvents.length ? Math.max(...initialEvents.map((e) => e.seq)) : 0
  );

  useEffect(() => {
    if (initialEvents.length > 0) {
      setEvents(initialEvents);
      lastSeqRef.current = Math.max(...initialEvents.map((e) => e.seq));
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
      } catch (err) {
        console.error('Error parsing SSE event:', err);
      }
    };

    const url = `/api/runs/${runId}/events?from_seq=${lastSeqRef.current}`;
    es = new EventSource(url);

    es.onopen = () => {
      if (isCancelled) return;
      setIsConnected(true);
      setError(null);
    };

    // Generic onmessage
    es.onmessage = processMessageEvent;

    // Specific named event listeners for all backend event types
    EVENT_TYPES.forEach((eventType) => {
      es?.addEventListener(eventType, processMessageEvent);
    });

    es.onerror = () => {
      if (isCancelled) return;
      setIsConnected(false);
      setError('Connection to event stream lost. Attempting to reconnect...');
    };

    return () => {
      isCancelled = true;
      if (es) {
        EVENT_TYPES.forEach((eventType) => {
          es?.removeEventListener(eventType, processMessageEvent);
        });
        es.close();
      }
      if (timerId) clearTimeout(timerId);
    };
  }, [runId, enabled, isDemo, onEvent]);

  return { events, isConnected, error };
}
