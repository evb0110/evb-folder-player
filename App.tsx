import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { createThemedStyles, useTheme, ThemeProvider, fonts } from './src/theme';
import { usePlayer } from './src/player/usePlayer';
import { LibraryScreen } from './src/components/LibraryScreen';
import { PlayerScreen } from './src/components/PlayerScreen';
import { HistoryScreen } from './src/components/HistoryScreen';
import { Icon, type TIcon } from './src/components/Icon';
import { Action } from './src/components/Controls';
import type { IBook } from './src/player/types';
type TScreen = 'library' | 'player' | 'history';
const navItems: { screen: TScreen; label: string; icon: TIcon }[] = [{ screen: 'library', label: 'Library', icon: 'library' }, { screen: 'player', label: 'Now playing', icon: 'headphones' }, { screen: 'history', label: 'History', icon: 'history' }];
function PlayerApp() {
  const { colors, dark } = useTheme();
  const s = useStyles();
  const model = usePlayer();
  const [screen, setScreen] = useState<TScreen>('library');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [carMode, setCarMode] = useState(false);
  const selectedBook = model.books.find(book => book.id === selectedId) ?? model.books.find(book => book.id === model.status.bookId);
  const activeBook = model.books.find(book => book.id === model.status.bookId);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (carMode) { setCarMode(false); return true; }
      if (screen !== 'library') { setScreen('library'); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [carMode, screen]);
  const navigate = (next: TScreen) => { setCarMode(false); setScreen(next); if (next === 'history') void model.refresh(); if (next === 'player') setSelectedId(model.status.bookId ?? selectedId); };
  const selectBook = (book: IBook) => { setSelectedId(book.id); setScreen('player'); };
  const command: typeof model.command = async (action, data) => {
    await model.command(action, data);
    if (action === 'undo') setSelectedId(null);
  };
  const error = model.message || model.status.error;
  return <SafeAreaView style={s.safe} edges={['top', 'bottom', 'left', 'right']}>
    <StatusBar style={dark ? 'light' : 'dark'} />
    <View style={[s.app, carMode && s.carApp]}>
      {error ? <View accessibilityRole="alert" style={s.error}><Text style={s.errorText}>{error}</Text>{model.message ? <Pressable accessibilityRole="button" accessibilityLabel="Dismiss message" onPress={() => model.setMessage(null)} style={s.dismiss}><Icon name="close" color={colors.error} size={20} /></Pressable> : null}</View> : null}
      <View style={s.main}>
        {screen === 'library' ? <LibraryScreen books={model.books} status={model.status} busy={model.busy} onImport={method => { void model.importBooks(method); }} onBook={selectBook} /> : null}
        {screen === 'player' && selectedBook ? <PlayerScreen key={selectedBook.id} book={selectedBook} status={model.status} carMode={carMode} setCarMode={setCarMode} onBack={() => navigate('library')} command={command} onHistory={() => navigate('history')} /> : null}
        {screen === 'player' && !selectedBook ? <View style={s.empty}><Icon name="headphones" size={50} color={colors.gold} /><Text style={s.emptyTitle}>Choose a book</Text><Action label="Go to library" icon="library" tone="primary" onPress={() => navigate('library')} /></View> : null}
        {screen === 'history' ? <HistoryScreen history={model.history} canUndo={model.status.canUndo} onUndo={() => { void command('undo'); }} onRestore={entry => { void command('restore', { point: entry }); setSelectedId(entry.bookId); setScreen('player'); }} /> : null}
      </View>
      {!carMode && activeBook && screen !== 'player' ? <View style={s.mini}><Pressable accessibilityRole="button" accessibilityLabel="Open current audiobook" style={s.miniInfo} onPress={() => navigate('player')}><View style={s.miniMark}><Icon name="headphones" color={colors.mint} size={19} /></View><View style={s.miniTitles}><Text style={s.miniTitle} numberOfLines={1}>{activeBook.name}</Text><Text style={s.miniChapter} numberOfLines={1}>{model.status.trackTitle}</Text></View></Pressable><Pressable accessibilityRole="button" accessibilityLabel={model.status.playing ? 'Pause playback' : 'Resume playback'} style={s.miniToggle} onPress={() => { void command('toggle'); }}><Icon name={model.status.playing ? 'pause' : 'play'} color={colors.mint} size={23} filled /></Pressable></View> : null}
      {!carMode ? <View style={s.nav}>{navItems.map(item => <Pressable key={item.screen} accessibilityRole="button" accessibilityState={{ selected: screen === item.screen }} accessibilityLabel={item.label} onPress={() => navigate(item.screen)} style={s.navItem}><Icon name={item.icon} color={screen === item.screen ? colors.mint : colors.subtle} size={26} /><Text style={[s.navLabel, screen === item.screen && { color: colors.mint }]}>{item.label}</Text><View style={[s.navDot, screen === item.screen && { backgroundColor: colors.mint }]} /></Pressable>)}</View> : null}
    </View>
  </SafeAreaView>;
}
export default function App() {
  const [loaded, error] = useFonts({
    DMSans_400Regular: require('@expo-google-fonts/dm-sans/400Regular/DMSans_400Regular.ttf'),
    DMSans_500Medium: require('@expo-google-fonts/dm-sans/500Medium/DMSans_500Medium.ttf'),
    DMSans_700Bold: require('@expo-google-fonts/dm-sans/700Bold/DMSans_700Bold.ttf'),
    Lora_500Medium: require('@expo-google-fonts/lora/500Medium/Lora_500Medium.ttf'),
  });
  return <ThemeProvider><SafeAreaProvider>{loaded || error ? <PlayerApp /> : <Loading />}</SafeAreaProvider></ThemeProvider>;
}
function Loading() { const { colors } = useTheme(); const s = useStyles(); return <View style={s.loading}><ActivityIndicator color={colors.mint} /></View>; }
const useStyles = createThemedStyles(colors => StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.outer }, app: { flex: 1, backgroundColor: colors.bg, width: '100%', maxWidth: 620, alignSelf: 'center', ...(Platform.OS === 'web' ? { boxShadow: '0 0 100px #00000030' } : {}) }, carApp: { maxWidth: 1100 }, main: { flex: 1, minHeight: 0 }, loading: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }, error: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, backgroundColor: colors.errorBg }, errorText: { color: colors.error, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, flex: 1 }, dismiss: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' }, nav: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.bg, paddingTop: 13, paddingBottom: 5 }, navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 62, gap: 7 }, navLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.subtle }, navDot: { width: 3, height: 3, borderRadius: 2, marginTop: 1, backgroundColor: 'transparent' }, mini: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 19, backgroundColor: colors.elevated, borderTopWidth: 1, borderTopColor: colors.line }, miniInfo: { flexDirection: 'row', alignItems: 'center', gap: 13, flex: 1, minHeight: 51 }, miniMark: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }, miniTitles: { flex: 1, gap: 4 }, miniTitle: { fontFamily: fonts.medium, color: colors.text, fontSize: 12 }, miniChapter: { fontFamily: fonts.regular, color: colors.subtle, fontSize: 10 }, miniToggle: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' }, empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 42, gap: 20 }, emptyTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 25, marginTop: 10 } }));
