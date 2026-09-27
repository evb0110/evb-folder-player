import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { player } from './adapter';
import { sampleBook } from './sample';
import { sortedBooks } from './format';
import type { IBook, IHistoryEntry, IStatus } from './types';
const initial: IStatus = { playing: false, loading: false, speed: 1, canUndo: false };
export function usePlayer() {
  const [books, setBooks] = useState<IBook[]>([]);
  const [status, setStatus] = useState<IStatus>(initial);
  const [history, setHistory] = useState<IHistoryEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const mounted = useRef(true);
  const refresh = useCallback(async () => {
    const [library, state, journal] = await Promise.all([player.getLibrary(), player.getStatus(), player.getHistory()]);
    if (mounted.current) { setBooks(sortedBooks(library)); setStatus(state); setHistory(journal); }
  }, []);
  useEffect(() => {
    mounted.current = true;
    let timer: ReturnType<typeof setTimeout>;
    let active = true;
    const tick = async () => {
      try { if (active) { const state = await player.getStatus(); if (mounted.current) setStatus(state); } }
      catch (e) { if (mounted.current) setMessage(e instanceof Error ? e.message : String(e)); }
      if (mounted.current) timer = setTimeout(tick, 500);
    };
    refresh().catch(e => setMessage(String(e)));
    tick();
    const listener = AppState.addEventListener('change', state => { active = state === 'active'; if (active) refresh().catch(e => setMessage(String(e))); });
    return () => { mounted.current = false; clearTimeout(timer); listener.remove(); };
  }, [refresh]);
  const command = useCallback(async (action: string, data: Record<string, unknown> = {}) => {
    try { await player.command(action, data); await refresh(); } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
  }, [refresh]);
  const importBooks = useCallback(async (method: 'folder' | 'device' | 'rescan' | 'sample') => {
    setBusy(true); setMessage(null);
    try {
      if (method === 'folder') await player.pickFolder();
      if (method === 'device') { const count = await player.scanDevice(); if (!count) setMessage('No indexed audio found. Try Add folder to scan an audiobook directory.'); }
      if (method === 'rescan') await player.rescan();
      if (method === 'sample') await player.addSample(await sampleBook());
      await refresh();
    } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }, [refresh]);
  return { books, status, history, busy, message, setMessage, refresh, command, importBooks };
}
