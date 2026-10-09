import { requireNativeModule } from 'expo-modules-core';
import { PermissionsAndroid, Platform } from 'react-native';
import type { IBook, IHistoryEntry, IPlayerAdapter, IStatus } from './types';

/** The Kotlin module exchanges JSON strings to keep the bridge surface small. */
interface INativeAudio {
  getLibrary(): Promise<string>;
  getStatus(): Promise<string>;
  getHistory(): Promise<string>;
  command(action: string, data: string): Promise<void>;
  pickFolder(): Promise<boolean>;
  scanDevice(): Promise<number>;
  rescan(): Promise<boolean>;
  addSample(data: string): Promise<boolean>;
  getImportFolder(): Promise<string | null>;
  cancelImport(): Promise<void>;
  dismissImport(): Promise<void>;
  openDownloads(): Promise<void>;
  isTipDismissed(id: string): Promise<boolean>;
  dismissTip(id: string): Promise<void>;
  getHiddenFolders(): Promise<string>;
  setHiddenFolders(paths: string): Promise<void>;
}

const native = requireNativeModule<INativeAudio>('FolderAudio');

async function requestAudioPermission() {
  const permission =
    Number(Platform.Version) >= 33
      ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO
      : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
  const result = await PermissionsAndroid.request(permission);
  if (result !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new Error('Audio access was not granted. You can still use Add folder to choose individual folders.');
  }
}

export const player: IPlayerAdapter = {
  async getLibrary() {
    return JSON.parse(await native.getLibrary()) as IBook[];
  },
  async getHistory() {
    return JSON.parse(await native.getHistory()) as IHistoryEntry[];
  },
  async getStatus() {
    return JSON.parse(await native.getStatus()) as IStatus;
  },
  command({ action, ...data }) {
    return native.command(action, JSON.stringify(data));
  },
  pickFolder: () => native.pickFolder(),
  async scanDevice() {
    await requestAudioPermission();
    return native.scanDevice();
  },
  rescan: () => native.rescan(),
  addSample: book => native.addSample(JSON.stringify(book)),
  getImportFolder: () => native.getImportFolder(),
  cancelImport: () => native.cancelImport(),
  dismissImport: () => native.dismissImport(),
  openDownloads: () => native.openDownloads(),
  isTipDismissed: id => native.isTipDismissed(id),
  dismissTip: id => native.dismissTip(id),
  async getHiddenFolders() {
    return JSON.parse(await native.getHiddenFolders()) as string[];
  },
  setHiddenFolders: paths => native.setHiddenFolders(JSON.stringify(paths)),
};
