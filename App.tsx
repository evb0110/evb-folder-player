import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Frame } from './src/frame';
import { createThemedStyles, fonts, ThemeProvider, touch, useTheme } from './src/theme';
import { usePlayer } from './src/player/usePlayer';
import type { IHistoryEntry } from './src/player/types';
import { LibraryScreen } from './src/components/LibraryScreen';
import { PlayerScreen, type TPlayerTab } from './src/components/PlayerScreen';
import { HistoryScreen } from './src/components/HistoryScreen';
import { CarMode } from './src/components/CarMode';
import { MiniPlayer } from './src/components/MiniPlayer';
import { Icon } from './src/components/Icon';

type TScreen = 'library' | 'player' | 'history';

/** A desktop browser previews the app at phone size instead of stretching it across the window. */
const PHONE = { width: 412, height: 892 };

function usePhoneFrame() {
  const window = useWindowDimensions();
  const desktop = Platform.OS === 'web' && window.width >= PHONE.width + 80 && window.height >= 640;
  return desktop ? { width: PHONE.width, height: Math.min(PHONE.height, window.height - 48) } : null;
}

/** Opening a screen already in the stack returns to it instead of stacking a duplicate. */
function pushScreen(stack: TScreen[], screen: TScreen) {
  const index = stack.indexOf(screen);
  return index >= 0 ? stack.slice(0, index + 1) : [...stack, screen];
}

function PlayerApp() {
  const { dark } = useTheme();
  const s = useStyles();
  const phone = usePhoneFrame();
  const model = usePlayer();
  const { status, command } = model;
  const [stack, setStack] = useState<TScreen[]>(['library']);
  // null follows whatever book the player has loaded.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playerTab, setPlayerTab] = useState<TPlayerTab>('listen');
  const [carMode, setCarMode] = useState(false);
  const [keepAwake, setKeepAwake] = useState(true);

  const screen = stack[stack.length - 1];
  const activeBook = model.books.find(book => book.id === status.bookId);
  const selectedBook = model.books.find(book => book.id === selectedId) ?? activeBook;
  const open = (next: TScreen) => setStack(current => pushScreen(current, next));
  const back = () => setStack(current => (current.length > 1 ? current.slice(0, -1) : current));

  // Resume where the listener left off: once the library loads, start in the player if a book is in progress.
  const [launched, setLaunched] = useState(false);
  if (model.ready && !launched) {
    setLaunched(true);
    if (activeBook) setStack(['library', 'player']);
  }

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (carMode) setCarMode(false);
      else if (stack.length > 1) setStack(current => current.slice(0, -1));
      else return false;
      return true;
    });
    return () => subscription.remove();
  }, [carMode, stack.length]);

  const openBook = (bookId: string | null) => {
    setSelectedId(bookId);
    open('player');
  };
  const openHistory = () => {
    void model.refresh();
    open('history');
  };
  const undo = () => {
    // Undo can return to another book; follow the player.
    setSelectedId(null);
    void command({ action: 'undo' });
  };
  const restore = (entry: IHistoryEntry) => {
    void command({ action: 'restore', point: entry });
    openBook(entry.bookId);
  };

  const error = model.message || status.error;
  const showPlayer = screen === 'player' && selectedBook;

  return (
    <SafeAreaView style={[s.safe, phone && s.desktop]} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Frame style={[s.app, carMode && s.carApp, phone && [s.phone, phone]]}>
        {error ? <ErrorBanner text={error} onDismiss={model.message ? model.dismissMessage : undefined} /> : null}
        <View style={s.main}>
          {/* Car mode covers the player instead of replacing it, so the chapter list keeps its place. */}
          <View style={s.main} aria-hidden={carMode}>
            {screen === 'library' || (screen === 'player' && !selectedBook) ? (
              <LibraryScreen
                books={model.books}
                status={status}
                busy={model.busy}
                onImport={method => void model.importBooks(method)}
                onBook={book => openBook(book.id)}
                onHistory={openHistory}
              />
            ) : null}
            {showPlayer ? (
              <PlayerScreen
                key={selectedBook.id}
                book={selectedBook}
                status={status}
                tab={playerTab}
                onTab={setPlayerTab}
                onBack={back}
                onCarMode={() => setCarMode(true)}
                onHistory={openHistory}
                onUndo={undo}
                command={command}
              />
            ) : null}
            {screen === 'history' ? (
              <HistoryScreen
                history={model.history}
                canUndo={status.canUndo}
                onBack={back}
                onUndo={undo}
                onRestore={restore}
              />
            ) : null}
          </View>
          {carMode && selectedBook ? (
            <CarMode
              book={selectedBook}
              status={status}
              keepAwake={keepAwake}
              onKeepAwake={setKeepAwake}
              onExit={() => setCarMode(false)}
              onUndo={undo}
              command={command}
            />
          ) : null}
        </View>
        {activeBook && !carMode && screen !== 'player' ? (
          <MiniPlayer
            book={activeBook}
            status={status}
            onOpen={() => openBook(null)}
            onToggle={() => void command({ action: 'toggle' })}
          />
        ) : null}
      </Frame>
    </SafeAreaView>
  );
}

function ErrorBanner({ text, onDismiss }: { text: string; onDismiss?: () => void }) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <View accessibilityRole="alert" style={s.error}>
      <Text style={s.errorText}>{text}</Text>
      {onDismiss ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={onDismiss} style={s.dismiss}>
          <Icon name="close" color={colors.error} size={20} />
        </Pressable>
      ) : null}
    </View>
  );
}

function Loading() {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <View style={s.loading}>
      <ActivityIndicator color={colors.mint} />
    </View>
  );
}

export default function App() {
  const [loaded, error] = useFonts({
    DMSans_400Regular: require('@expo-google-fonts/dm-sans/400Regular/DMSans_400Regular.ttf'),
    DMSans_500Medium: require('@expo-google-fonts/dm-sans/500Medium/DMSans_500Medium.ttf'),
    DMSans_700Bold: require('@expo-google-fonts/dm-sans/700Bold/DMSans_700Bold.ttf'),
    Lora_500Medium: require('@expo-google-fonts/lora/500Medium/Lora_500Medium.ttf'),
  });
  return (
    <ThemeProvider>
      <SafeAreaProvider>{loaded || error ? <PlayerApp /> : <Loading />}</SafeAreaProvider>
    </ThemeProvider>
  );
}

const useStyles = createThemedStyles(colors =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.outer },
    app: {
      flex: 1,
      width: '100%',
      maxWidth: 620,
      alignSelf: 'center',
      backgroundColor: colors.bg,
      ...(Platform.OS === 'web' ? { boxShadow: '0 0 100px #00000030' } : {}),
    },
    carApp: { maxWidth: 1100 },
    desktop: { justifyContent: 'center' },
    phone: {
      flexGrow: 0,
      flexBasis: 'auto',
      flexShrink: 0,
      borderRadius: 32,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.line,
    },
    main: { flex: 1, minHeight: 0 },
    loading: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
    error: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 16, backgroundColor: colors.errorBg },
    errorText: {
      flex: 1,
      paddingVertical: 14,
      color: colors.error,
      fontFamily: fonts.regular,
      fontSize: 13,
      lineHeight: 18,
    },
    dismiss: { width: touch.button, height: touch.button, alignItems: 'center', justifyContent: 'center' },
  }),
);
