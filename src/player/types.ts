export interface ITrack {
  id: string;
  uri: string;
  name: string;
  title: string;
  duration: number;
}

export interface IPoint {
  bookId: string;
  bookName: string;
  trackId: string;
  trackTitle: string;
  trackIndex: number;
  position: number;
  duration: number;
  savedAt?: number;
}

export interface IBook {
  id: string;
  root: string;
  name: string;
  path: string;
  tracks: ITrack[];
  progress?: IPoint | null;
}

export interface IHistoryEntry extends IPoint {
  id: number;
  time: number;
  reason: string;
  undone?: boolean;
}

export interface IStatus extends Partial<IPoint> {
  playing: boolean;
  loading: boolean;
  speed: number;
  canUndo: boolean;
  sleepAt?: number;
  error?: string | null;
}

export type TImportMethod = 'folder' | 'device' | 'rescan' | 'sample';

export type TCommand =
  | { action: 'open'; bookId: string; trackId?: string; play?: boolean }
  | { action: 'toggle' | 'pause' | 'undo' | 'bookmark' }
  | { action: 'seek'; position: number }
  | { action: 'skip'; delta: number }
  | { action: 'restore'; point: IPoint }
  | { action: 'speed'; speed: number }
  | { action: 'sleep'; minutes: number };

export interface IPlayerAdapter {
  getLibrary(): Promise<IBook[]>;
  getStatus(): Promise<IStatus>;
  getHistory(): Promise<IHistoryEntry[]>;
  command(command: TCommand): Promise<void>;
  pickFolder(): Promise<boolean>;
  scanDevice(): Promise<number>;
  rescan(): Promise<boolean>;
  addSample(book: IBook): Promise<boolean>;
}
