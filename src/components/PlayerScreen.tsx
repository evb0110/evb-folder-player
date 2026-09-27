import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { useKeepAwake } from 'expo-keep-awake';
import { createThemedStyles, useTheme, fonts } from '../theme';
import type { IBook, IStatus } from '../player/types';
import { clockTime, percent } from '../player/format';
import { Action, IconButton, Pill, Progress } from './Controls';
import { BookCover } from './BookCover';
import { Icon } from './Icon';
interface IProps { book: IBook; status: IStatus; carMode: boolean; setCarMode: (value: boolean) => void; onBack: () => void; command: (action: string, data?: Record<string, unknown>) => Promise<void>; onHistory: () => void }
function KeepAwake() { useKeepAwake('folder-player-car', { suppressDeactivateWarnings: true }); return null; }
export function PlayerScreen({ book, status, carMode, setCarMode, onBack, command, onHistory }: IProps) {
  const { colors, dark } = useTheme();
  const s = useStyles();
  const [tab, setTab] = useState<'listen' | 'chapters'>('listen');
  const [dragPosition, setDragPosition] = useState<number | null>(null);
  const [awake, setAwake] = useState(true);
  const [menu, setMenu] = useState<'speed' | 'sleep' | null>(null);
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const compact = !landscape && height < 680;
  const active = status.bookId === book.id;
  const saved = active ? status : book.progress;
  const index = Math.max(0, book.tracks.findIndex(track => track.id === saved?.trackId));
  const track = book.tracks[index];
  const playing = active && status.playing;
  const position = dragPosition ?? saved?.position ?? 0;
  const duration = saved?.duration || track?.duration || 0;
  const toggle = () => { void (active ? command('toggle') : command('open', { bookId: book.id })); };
  const skip = (delta: number) => { if (active) void command('skip', { delta }); };
  const bigSize = Math.max(144, Math.min(280, width - 100, landscape ? height - 184 : height * (compact ? 0.28 : 0.34)));
  const progress = <View style={s.progressBlock}>
    {carMode ? <Progress value={percent(position, duration)} /> : <Slider style={s.slider} minimumValue={0} maximumValue={Math.max(duration, 1)} value={position} disabled={!active || duration <= 0} onSlidingStart={setDragPosition} onValueChange={setDragPosition} onSlidingComplete={value => { void command('seek', { position: Math.round(value) }); setDragPosition(null); }} minimumTrackTintColor={colors.mint} maximumTrackTintColor={colors.line} thumbTintColor={colors.mint} accessibilityLabel="Playback position" />}
    <View style={s.times}><Text style={s.time}>{clockTime(position)}</Text><Text style={s.timeMuted}>{duration ? `−${clockTime(duration - position)}` : '—'}</Text></View>
  </View>;
  const seekButton = (forward: boolean, large = false) => <Pressable accessibilityRole="button" accessibilityLabel={forward ? 'Forward 20 seconds' : 'Back 20 seconds'} disabled={!active} onPress={() => skip(forward ? 20000 : -20000)} style={({ pressed }) => [large ? s.carSeek : s.seek, large && compact && { minHeight: 74 }, pressed && { opacity: 0.6 }, !active && { opacity: 0.4 }]}>
    <View><Icon name={forward ? 'forward' : 'rewind'} size={large ? 46 : 35} color={colors.text} /><Text style={[s.seekNumber, large && { fontSize: 14, top: 16 }]}>20</Text></View>
    {large ? <Text style={s.seekLabel}>{forward ? 'Forward' : 'Rewind'}</Text> : null}
  </Pressable>;
  if (carMode) return <View style={s.carScreen}>
    {awake ? <KeepAwake /> : null}
    <View style={s.carHeader}><Action icon="back" label="Exit car mode" compact tone="quiet" onPress={() => setCarMode(false)} /><View style={s.carBadge}><Icon name="car" color={colors.subtle} size={19} /><Text style={s.eyebrow}>CAR MODE</Text></View></View>
    <View style={[s.carBody, landscape && s.carLandscape]}>
      <View style={[s.carInfo, landscape && s.carInfoLandscape, compact && { paddingTop: 10, paddingBottom: 0 }]}><Text style={[s.carBook, compact && { fontSize: 22 }]} numberOfLines={2}>{book.name}</Text><Text style={s.carChapter} numberOfLines={2}>{track?.title}</Text><Text style={s.chapterCount}>CHAPTER {index + 1} OF {book.tracks.length}</Text>{progress}</View>
      <View style={[s.carControls, landscape && { flexDirection: 'row', flex: 1, gap: 10 }]}>
        {landscape ? seekButton(false, true) : null}
        <Pressable accessibilityRole="button" accessibilityLabel={playing ? 'Pause audiobook' : 'Play audiobook'} onPress={toggle} style={({ pressed }) => [s.bigPlay, { width: bigSize, height: bigSize, borderRadius: bigSize / 2, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
          {active && status.loading ? <ActivityIndicator color={colors.ink} size="large" /> : <Icon name={playing ? 'pause' : 'play'} size={bigSize * 0.31} color={colors.ink} filled />}
          <Text style={s.bigPlayLabel}>{active && status.loading ? 'Loading' : playing ? 'Pause' : 'Play'}</Text>
        </Pressable>
        {landscape ? seekButton(true, true) : <View style={[s.carSeekRow, compact && { paddingTop: 8 }]}>{seekButton(false, true)}<View style={s.carSeekDivider} />{seekButton(true, true)}</View>}
      </View>
    </View>
    <View style={s.carFooter}><Pressable accessibilityRole="switch" accessibilityState={{ checked: awake }} accessibilityLabel="Keep screen awake" style={s.awake} onPress={() => setAwake(value => !value)}><Icon name="sun" color={awake ? colors.mint : colors.subtle} size={17} /><Text style={s.awakeText}>{awake ? 'Screen stays awake' : 'Screen can sleep'}</Text></Pressable><Action icon="undo" label="Undo jump" compact tone="quiet" disabled={!status.canUndo} onPress={() => { void command('undo'); }} /></View>
  </View>;
  return <View style={s.screen}>
    <View style={s.header}><IconButton name="back" label="Back to library" onPress={onBack} /><Text style={s.eyebrow}>{tab === 'chapters' ? 'CHAPTERS' : 'NOW PLAYING'}</Text><IconButton name="car" label="Enter car mode" onPress={() => setCarMode(true)} /></View>
    <View style={s.tabs}><Pill label="Listen" selected={tab === 'listen'} onPress={() => setTab('listen')} /><Pill label={`Chapters · ${book.tracks.length}`} selected={tab === 'chapters'} onPress={() => setTab('chapters')} /></View>
    {tab === 'chapters' ? <FlatList data={book.tracks} keyExtractor={item => item.id} contentContainerStyle={s.chapterList} ListHeaderComponent={<><Text style={s.listBookTitle}>{book.name}</Text><Text style={[s.note, { marginBottom: 22 }]}>{book.path}</Text></>} renderItem={({ item, index: itemIndex }) => {
      const selected = item.id === saved?.trackId;
      return <Pressable accessibilityRole="button" accessibilityLabel={`${selected && playing ? 'Pause' : 'Play'} chapter ${itemIndex + 1}: ${item.title}`} accessibilityState={{ selected }} onPress={() => { void (selected && active ? command('toggle') : command('open', { bookId: book.id, trackId: item.id })); }} style={[s.trackRow, selected && s.selectedTrack]}>
        <View style={s.trackNumber}>{selected && playing ? <Icon name="volume" color={colors.mint} size={20} /> : <Text style={[s.trackNumberText, selected && { color: colors.mint }]}>{String(itemIndex + 1).padStart(2, '0')}</Text>}</View>
        <View style={s.trackInfo}><Text style={[s.trackTitle, selected && { color: colors.mint }]} numberOfLines={2}>{item.title}</Text><Text style={s.note}>{selected ? `${clockTime(position)}` : item.duration ? clockTime(item.duration) : item.name.split('.').pop()?.toUpperCase()}</Text></View>
        <Icon name={selected && playing ? 'pause' : 'play'} size={18} color={selected ? colors.mint : colors.subtle} filled />
      </Pressable>;
    }} /> : <ScrollView contentContainerStyle={s.listenContent}>
      {height >= 750 ? <View style={s.coverArea}><BookCover title={book.name} size={status.canUndo ? 94 : 148} large /></View> : null}
      <Text style={s.bookTitle} numberOfLines={2}>{book.name}</Text><Text style={s.chapterTitle} numberOfLines={2}>{track?.title}</Text><Text style={s.chapterCount}>CHAPTER {index + 1} OF {book.tracks.length}</Text>

    </ScrollView>}
    <View style={s.playerBottom}>
      {progress}
      <View style={s.transport}>{seekButton(false)}<Pressable accessibilityRole="button" accessibilityLabel={playing ? 'Pause audiobook' : 'Play audiobook'} onPress={toggle} style={({ pressed }) => [s.play, pressed && { opacity: 0.75 }]}>{active && status.loading ? <ActivityIndicator color={colors.ink} /> : <Icon name={playing ? 'pause' : 'play'} size={46} color={colors.ink} filled />}</Pressable>{seekButton(true)}</View>
      {menu ? <View style={s.options}>{(menu === 'speed' ? [0.75, 1, 1.25, 1.5, 2] : [0, 15, 30, 60]).map(value => <Pill key={value} label={menu === 'speed' ? `${value}×` : value ? `${value}m` : 'Off'} selected={menu === 'speed' ? status.speed === value : value === 0 && !status.sleepAt} onPress={() => { void command(menu === 'speed' ? 'speed' : 'sleep', menu === 'speed' ? { speed: value } : { minutes: value }); setMenu(null); }} />)}</View> : null}
      <View style={s.tools}><Pressable accessibilityRole="button" accessibilityLabel="Playback speed" style={s.tool} onPress={() => setMenu(menu === 'speed' ? null : 'speed')}><Text style={s.speed}>{status.speed || 1}×</Text><Text style={s.toolLabel}>Speed</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Sleep timer" style={s.tool} onPress={() => setMenu(menu === 'sleep' ? null : 'sleep')}><Icon name="clock" color={status.sleepAt ? colors.mint : colors.muted} size={21} /><Text style={s.toolLabel}>{status.sleepAt ? `${Math.ceil(Math.max(0, status.sleepAt - Date.now()) / 60000)} min` : 'Sleep'}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Save bookmark" disabled={!active} style={[s.tool, !active && { opacity: 0.4 }]} onPress={() => { void command('bookmark'); }}><Icon name="bookmark" color={colors.muted} size={21} /><Text style={s.toolLabel}>Bookmark</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Listening history" style={s.tool} onPress={onHistory}><Icon name="history" color={colors.muted} size={21} /><Text style={s.toolLabel}>History</Text></Pressable></View>
      {status.canUndo ? <Action icon="undo" label="Undo last jump" compact tone="quiet" onPress={() => { void command('undo'); }} style={{ marginBottom: 6 }} /> : null}
    </View>
  </View>;
}
const useStyles = createThemedStyles(colors => StyleSheet.create({
  screen: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 7 }, eyebrow: { fontFamily: fonts.bold, color: colors.subtle, fontSize: 10, letterSpacing: 2 }, tabs: { flexDirection: 'row', alignSelf: 'center', backgroundColor: colors.surface, borderRadius: 28, padding: 3, marginTop: 10, marginBottom: 10 },
  listenContent: { alignItems: 'center', paddingHorizontal: 28, paddingBottom: 12, flexGrow: 1, justifyContent: 'center' }, coverArea: { paddingVertical: 16 }, bookTitle: { fontFamily: fonts.display, color: colors.text, fontSize: 25, lineHeight: 32, textAlign: 'center', marginTop: 9 }, chapterTitle: { fontFamily: fonts.regular, color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 7 }, chapterCount: { fontFamily: fonts.bold, color: colors.subtle, fontSize: 10, letterSpacing: 1.7, marginTop: 14 },
  playerBottom: { paddingHorizontal: 20, paddingBottom: 10 }, progressBlock: { width: '100%', paddingTop: 16 }, slider: { width: '100%', height: 52 }, times: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 9 }, time: { color: colors.text, fontFamily: fonts.medium, fontSize: 12, fontVariant: ['tabular-nums'] }, timeMuted: { color: colors.subtle, fontFamily: fonts.regular, fontSize: 12, fontVariant: ['tabular-nums'] }, transport: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, paddingVertical: 14 }, play: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' }, seek: { width: 76, height: 76, borderRadius: 24, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }, seekNumber: { position: 'absolute', top: 12, left: 0, right: 0, textAlign: 'center', fontFamily: fonts.bold, color: colors.text, fontSize: 10 }, tools: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 11 }, tool: { minWidth: 64, minHeight: 68, alignItems: 'center', justifyContent: 'center', gap: 7 }, toolLabel: { color: colors.subtle, fontFamily: fonts.medium, fontSize: 12 }, speed: { color: colors.muted, fontFamily: fonts.bold, fontSize: 18, lineHeight: 21 }, options: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignSelf: 'center', backgroundColor: colors.surface, borderRadius: 25, padding: 3, marginVertical: 8 },
  chapterList: { paddingHorizontal: 22, paddingVertical: 18 }, listBookTitle: { fontFamily: fonts.display, fontSize: 23, color: colors.text, marginBottom: 7 }, note: { fontFamily: fonts.regular, color: colors.subtle, fontSize: 11, lineHeight: 18 }, trackRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 18, gap: 12, borderRadius: 13, borderBottomWidth: 1, borderBottomColor: colors.line }, selectedTrack: { backgroundColor: colors.elevated, borderBottomColor: 'transparent' }, trackNumber: { width: 27 }, trackNumberText: { fontFamily: fonts.medium, color: colors.subtle, fontSize: 13 }, trackInfo: { flex: 1, gap: 5 }, trackTitle: { fontFamily: fonts.medium, color: colors.text, fontSize: 14, lineHeight: 21 },
  carScreen: { flex: 1, paddingHorizontal: 24, paddingTop: 14, paddingBottom: 12 }, carHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, carBadge: { flexDirection: 'row', gap: 9, alignItems: 'center' }, carBody: { flex: 1, justifyContent: 'space-evenly' }, carLandscape: { flexDirection: 'row', alignItems: 'center', gap: 20 }, carInfo: { alignItems: 'center', paddingTop: 22, paddingBottom: 10 }, carInfoLandscape: { width: '32%', paddingTop: 0 }, carBook: { color: colors.text, fontFamily: fonts.display, fontSize: 25, lineHeight: 32, textAlign: 'center' }, carChapter: { color: colors.muted, fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 9 }, carControls: { alignItems: 'center', justifyContent: 'center', paddingVertical: 10 }, bigPlay: { backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 10, borderColor: colors.ring }, bigPlayLabel: { fontFamily: fonts.bold, fontSize: 24, color: colors.ink }, carSeekRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', width: '100%', paddingTop: 20 }, carSeek: { minWidth: 86, minHeight: 100, alignItems: 'center', justifyContent: 'center', gap: 8 }, seekLabel: { fontFamily: fonts.medium, color: colors.muted, fontSize: 12 }, carSeekDivider: { width: 1, height: 34, backgroundColor: colors.line }, carFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line, gap: 7 }, awake: { flexDirection: 'row', alignItems: 'center', minHeight: 56, gap: 8, flexShrink: 1 }, awakeText: { color: colors.subtle, fontFamily: fonts.regular, fontSize: 11, flexShrink: 1 },
}));
