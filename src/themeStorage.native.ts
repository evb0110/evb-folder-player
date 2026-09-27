import { requireNativeModule } from 'expo-modules-core';
import type { TThemePreference } from './theme';
interface IThemeModule { getTheme(): Promise<string>; setTheme(value: string): Promise<void> }
const native = requireNativeModule<IThemeModule>('FolderAudio');
export const themeStorage = {
  get: () => native.getTheme(),
  set: (value: TThemePreference) => native.setTheme(value),
};
