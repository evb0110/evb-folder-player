import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme, View } from 'react-native';
import { themeStorage } from './themeStorage';

export type TThemePreference = 'system' | 'light' | 'dark';

const dark = {
  bg: '#101918',
  surface: '#192522',
  elevated: '#22312C',
  line: '#314139',
  text: '#F5F1E7',
  muted: '#ACB9AD',
  subtle: '#82988A',
  mint: '#C2E5BA',
  ink: '#163626',
  gold: '#D6B987',
  error: '#FFD1BD',
  errorBg: '#3A2B24',
  outer: '#0A100E',
  ring: '#ADCFA5',
};

export type TColors = typeof dark;

const light: TColors = {
  bg: '#F7F6EF',
  surface: '#ECEFE5',
  elevated: '#E0E8DA',
  line: '#C9D1C5',
  text: '#172D24',
  muted: '#4D6256',
  subtle: '#5B7063',
  mint: '#245D40',
  ink: '#FFFFFF',
  gold: '#85652D',
  error: '#802F16',
  errorBg: '#FAE3D8',
  outer: '#E5EAE0',
  ring: '#19472E',
};

export const fonts = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  bold: 'DMSans_700Bold',
  display: 'Lora_500Medium',
};

const preferences: readonly string[] = ['system', 'light', 'dark'] satisfies TThemePreference[];

function isPreference(value: unknown): value is TThemePreference {
  return typeof value === 'string' && preferences.includes(value);
}

interface ITheme {
  colors: TColors;
  dark: boolean;
  preference: TThemePreference;
  setPreference: (value: TThemePreference) => void;
  error: string | null;
}

const ThemeContext = createContext<ITheme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<TThemePreference>('system');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    themeStorage
      .get()
      .then(value => {
        if (mounted && isPreference(value)) setPreferenceState(value);
      })
      .catch(() => mounted && setError('Could not load the theme preference.'))
      .finally(() => mounted && setReady(true));
    return () => {
      mounted = false;
    };
  }, []);

  const isDark = preference === 'dark' || (preference === 'system' && system === 'dark');
  const colors = isDark ? dark : light;
  const value = useMemo<ITheme>(
    () => ({
      colors,
      dark: isDark,
      preference,
      error,
      setPreference(next) {
        setPreferenceState(next);
        setError(null);
        themeStorage.set(next).catch(() => setError('Could not save the theme preference.'));
      },
    }),
    [colors, isDark, preference, error],
  );

  return (
    <ThemeContext.Provider value={value}>
      {ready ? children : <View style={{ flex: 1, backgroundColor: colors.bg }} />}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('ThemeProvider is required');
  return theme;
}

/** Builds a hook that returns memoized styles for the active palette. */
export function createThemedStyles<T>(factory: (colors: TColors) => T) {
  return function useStyles() {
    const { colors } = useTheme();
    return useMemo(() => factory(colors), [colors]);
  };
}
