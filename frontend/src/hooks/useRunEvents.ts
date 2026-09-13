import { useEffect, useRef, useState } from 'react';
import type { RunEvent } from '../api/types';
import sampleRunData from '../../../fixtures/sample_run.json';

const sampleRunEvents = (sampleRunData as unknown as { events: RunEvent[] }).events || [];

interface UseRunEventsOptions {
  runId: string;
  initialEvents?: RunEvent[];
  enabled?: boolean;
  simulateIfOffline?: boolean;
  onEvent?: (event: RunEvent) => void;
}

export function useRunEvents({
  runId,
  initialEvents = [],
  enabled = true,
  simulateIfOffline = true,
  onEvent,
}: UseRunEventsOptions) {
  const [events, setEvents] = useState<RunEvent[]>(initialEvents);
  const [isConnected, setIsConnected] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
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

    let es: EventSource | null = null;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let isCancelled = false;

    const startEventSource = () => {
      const url = `/api/runs/${runId}/events?from_seq=${lastSeqRef.current}`;
      es = new EventSource(url);

      es.onopen = () => {
        if (isCancelled) return;
        setIsConnected(true);
        setIsSimulating(false);
      };

      es.onmessage = (e) => {
        if (isCancelled) return;
        try {
          const event: RunEvent = JSON.parse(e.data);
          if (event.seq > lastSeqRef.current) {
            lastSeqRef.current = event.seq;
            setEvents((prev) => [...prev, event]);
            onEvent?.(event);
          }
        } catch (err) {
          console.error('Error parsing SSE event:', err);
        }
      };

      es.onerror = () => {
        if (isCancelled) return;
        setIsConnected(false);
        es?.close();
        es = null;

        if (simulateIfOffline && !isSimulating && events.length === 0) {
          // Trigger demo simulation if live SSE is unreachable
          startSimulation();
        }
      };
    };

    const startSimulation = () => {
      setIsSimulating(true);
      let idx = 0;
      const targetEvents = sampleRunEvents;

      const pushNext = () => {
        if (isCancelled || idx >= targetEvents.length) {
          setIsSimulating(false);
          return;
        }
        const ev = targetEvents[idx++];
        lastSeqRef.current = ev.seq;
        setEvents((prev) => {
          if (prev.some((e) => e.seq === ev.seq)) return prev;
          return [...prev, ev];
        });
        onEvent?.(ev);
        timerId = setTimeout(pushNext, 400 + Math.random() * 400);
      };

      timerId = setTimeout(pushNext, 200);
    };

    startEventSource();

    return () => {
      isCancelled = true;
      if (es) es.close();
      if (timerId) clearTimeout(timerId);
    };
  }, [runId, enabled, simulateIfOffline, onEvent]);

  return { events, isConnected, isSimulating };
}
