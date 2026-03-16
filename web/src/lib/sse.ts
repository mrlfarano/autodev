'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

type EventHandler = (data: unknown) => void;

export function useSSE(url: string) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const listenersRef = useRef<Map<string, Set<EventHandler>>>(new Map());
  const sourceRef = useRef<EventSource | null>(null);

  const on = useCallback((eventType: string, handler: EventHandler) => {
    const map = listenersRef.current;
    if (!map.has(eventType)) {
      map.set(eventType, new Set());
    }
    map.get(eventType)!.add(handler);

    // If the EventSource already exists, attach this event listener
    const source = sourceRef.current;
    if (source && source.readyState !== EventSource.CLOSED) {
      source.addEventListener(eventType, ((e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          handler(data);
        } catch {
          handler(e.data);
        }
      }) as EventListener);
    }

    return () => {
      map.get(eventType)?.delete(handler);
      if (map.get(eventType)?.size === 0) {
        map.delete(eventType);
      }
    };
  }, []);

  useEffect(() => {
    const eventSource = new EventSource(url);
    sourceRef.current = eventSource;

    const EVENT_TYPES = [
      'status',
      'score',
      'metrics',
      'log',
      'experiment_complete',
      'experiment-complete',
      'stats',
      'connected',
    ];

    function handleEvent(eventType: string) {
      return (e: MessageEvent) => {
        setLastEvent(eventType);
        let data: unknown;
        try {
          data = JSON.parse(e.data);
        } catch {
          data = e.data;
        }
        const handlers = listenersRef.current.get(eventType);
        if (handlers) {
          for (const handler of handlers) {
            handler(data);
          }
        }
      };
    }

    for (const type of EVENT_TYPES) {
      eventSource.addEventListener(type, handleEvent(type) as EventListener);
    }

    eventSource.onopen = () => {
      setConnected(true);
    };

    eventSource.onerror = () => {
      setConnected(false);
    };

    return () => {
      eventSource.close();
      sourceRef.current = null;
      setConnected(false);
    };
  }, [url]);

  return { connected, lastEvent, on };
}
