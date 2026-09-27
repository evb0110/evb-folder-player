import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { player } from './adapter';
import { sampleBook } from './sample';
import { sortedBooks } from './format';
import type { IBook, IHistoryEntry, IStatus, TCommand, TImportMethod } from './types';

const POLL_MS = 500;
const initialStatus: IStatus = { playing: false, loading: false, speed: 1, canUndo: false };

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/** Skip re-rendering the whole app when a poll returns the same state. */
function sameStatus(a: IStatus, b: IStatus) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function usePlayer() {
  const [books, setBooks] = useState<IBook[]>([]);
  const [status, setStatus] = useState<IStatus>(initialStatus);
  const [history, setHistory] = useState<IHistoryEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const mounted = useRef(true);

  const updateStatus = useCallback((next: IStatus) => {
    setStatus(current => (sameStatus(current, next) ? current : next));
  }, []);

  const report = useCallback((error: unknown) => {
    if (mounted.current) setMessage(errorMessage(error));
  }, []);

  const refresh = useCallback(async () => {
    const [library, state, journal] = await Promise.all([player.getLibrary(), player.getStatus(), player.getHistory()]);
    if (!mounted.current) return;
    setBooks(sortedBooks(library));
    updateStatus(state);
    setHistory(journal);
    setReady(true);
  }, [updateStatus]);

  useEffect(() => {
    mounted.current = true;
    let foreground = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      if (foreground) {
        try {
          const state = await player.getStatus();
          if (mounted.current) updateStatus(state);
        } catch (error) {
          report(error);
        }
      }
      if (mounted.current) timer = setTimeout(poll, POLL_MS);
    };
    refresh().catch(report);
    void poll();
    const subscription = AppState.addEventListener('change', state => {
      foreground = state === 'active';
      if (foreground) refresh().catch(report);
    });
    return () => {
      mounted.current = false;
      clearTimeout(timer);
      subscription.remove();
    };
  }, [refresh, report, updateStatus]);

  const command = useCallback(
    async (next: TCommand) => {
      try {
        await player.command(next);
        await refresh();
      } catch (error) {
        report(error);
      }
    },
    [refresh, report],
  );

  const importBooks = useCallback(
    async (method: TImportMethod) => {
      setBusy(true);
      setMessage(null);
      try {
        if (method === 'folder') await player.pickFolder();
        if (method === 'device') {
          const count = await player.scanDevice();
          if (!count) setMessage('No indexed audio found. Try Add folder to scan an audiobook directory.');
        }
        if (method === 'rescan') await player.rescan();
        if (method === 'sample') await player.addSample(await sampleBook());
        await refresh();
      } catch (error) {
        report(error);
      } finally {
        if (mounted.current) setBusy(false);
      }
    },
    [refresh, report],
  );

  const dismissMessage = useCallback(() => setMessage(null), []);

  return { ready, books, status, history, busy, message, dismissMessage, refresh, command, importBooks };
}

export type TPlayerModel = ReturnType<typeof usePlayer>;
export type TRunCommand = TPlayerModel['command'];
