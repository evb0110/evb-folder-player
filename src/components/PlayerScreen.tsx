import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useLandscape } from '../frame';
import { createThemedStyles, fonts, touch, useTheme } from '../theme';
import { clockTime, percent } from '../player/format';
import { bookPlayback, sleepMinutesLeft, SLEEP_MINUTES, SPEEDS, type IBookPlayback } from '../player/playback';
import type { TRunCommand } from '../player/usePlayer';
import type { IBook, IStatus, ITrack } from '../player/types';
import { IconButton, Progress, Segmented } from './Controls';
import { BookCover } from './BookCover';
import { ChapterList } from './ChapterList';
import { Header } from './Header';
import { Icon, type TIcon } from './Icon';
import { PlayButton, PositionSlider, SeekButton } from './Transport';

export type TPlayerTab = 'listen' | 'chapters';

/** Space kept around the cover: above it (below the tabs) and between it and the titles. */
const COVER_PADDING = 16;
const COVER_GAP = 16;

const tabs = [
  { value: 'listen', label: 'Listen' },
  { value: 'chapters', label: 'Chapters' },
] as const;

interface IProps {
  book: IBook;
  status: IStatus;
  tab: TPlayerTab;
  onTab: (tab: TPlayerTab) => void;
  onBack: () => void;
  onCarMode: () => void;
  onHistory: () => void;
  onUndo: () => void;
  command: TRunCommand;
}

export function PlayerScreen({ book, status, tab, onTab, onBack, onCarMode, onHistory, onUndo, command }: IProps) {
  const s = useStyles();
  const playback = bookPlayback(book, status);
  const controls: ITransportActions = {
    toggle: () => void command(playback.active ? { action: 'toggle' } : { action: 'open', bookId: book.id }),
    skip: delta => void command({ action: 'skip', delta }),
  };
  const chooseTrack = (track: ITrack) =>
    void command(
      playback.active && track.id === playback.track?.id
        ? { action: 'toggle' }
        : { action: 'open', bookId: book.id, trackId: track.id },
    );

  return (
    <View style={s.screen}>
      <Header
        left={<IconButton name="back" label="Library" onPress={onBack} />}
        center={<Segmented options={tabs} value={tab} onChange={onTab} />}
        right={<IconButton name="car" label="Car mode" onPress={onCarMode} />}
      />
      {tab === 'chapters' ? (
        <>
          <ChapterList book={book} playback={playback} onChoose={chooseTrack} />
          <Dock playback={playback} controls={controls} onExpand={() => onTab('listen')} />
        </>
      ) : (
        <ListenView
          book={book}
          status={status}
          playback={playback}
          controls={controls}
          command={command}
          onChapters={() => onTab('chapters')}
          onHistory={onHistory}
          onUndo={onUndo}
        />
      )}
    </View>
  );
}

interface ITransportActions {
  toggle: () => void;
  skip: (delta: number) => void;
}

interface IListenProps {
  book: IBook;
  status: IStatus;
  playback: IBookPlayback;
  controls: ITransportActions;
  command: TRunCommand;
  onChapters: () => void;
  onHistory: () => void;
  onUndo: () => void;
}

function ListenView({ book, status, playback, controls, command, onChapters, onHistory, onUndo }: IListenProps) {
  const { colors } = useTheme();
  const s = useStyles();
  const landscape = useLandscape();
  const [menu, setMenu] = useState<'speed' | 'sleep' | null>(null);
  const [area, setArea] = useState({ width: 0, height: 0 });
  const [titlesHeight, setTitlesHeight] = useState(0);
  const sleepLeft = sleepMinutesLeft(status.sleepAt);

  // The cover takes whatever height the titles and controls leave, and disappears on short screens.
  // The cover gets exactly the height the measured titles leave, and disappears on short screens.
  const fittedCover = Math.min(
    240,
    area.width * 0.62,
    (area.height - titlesHeight - 2 * COVER_PADDING - COVER_GAP) / 1.2,
  );
  const coverSize = titlesHeight && fittedCover >= 76 ? Math.floor(fittedCover) : 0;

  const toggleMenu = (next: 'speed' | 'sleep') => setMenu(current => (current === next ? null : next));

  return (
    <View style={[s.listen, landscape && s.listenLandscape]}>
      <View style={s.info} onLayout={(event: LayoutChangeEvent) => setArea(event.nativeEvent.layout)}>
        {coverSize ? <BookCover title={book.name} size={coverSize} large style={s.cover} /> : null}
        <View
          style={s.titles}
          onLayout={(event: LayoutChangeEvent) => setTitlesHeight(event.nativeEvent.layout.height)}
        >
          <Text style={s.bookTitle} numberOfLines={2}>
            {book.name}
          </Text>
          <Text style={s.chapterTitle} numberOfLines={2}>
            {playback.track?.title}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show chapters"
            onPress={onChapters}
            style={({ pressed }) => [s.chapterLink, pressed && s.pressed]}
          >
            <Text style={s.chapterCount}>
              Chapter {playback.trackIndex + 1} of {book.tracks.length}
            </Text>
            <Icon name="next" size={14} color={colors.subtle} />
          </Pressable>
        </View>
      </View>

      <View style={[s.controls, landscape && s.controlsLandscape]}>
        <PositionSlider
          position={playback.position}
          duration={playback.duration}
          disabled={!playback.active}
          onSeek={position => void command({ action: 'seek', position })}
        />
        <View style={s.transport}>
          <SeekButton forward={false} size="regular" disabled={!playback.active} onSkip={controls.skip} />
          <PlayButton
            playing={playback.playing}
            loading={playback.loading}
            size={landscape ? 84 : 96}
            onPress={controls.toggle}
          />
          <SeekButton forward size="regular" disabled={!playback.active} onSkip={controls.skip} />
        </View>
        {menu === 'speed' ? (
          <Segmented
            fill
            style={s.menu}
            options={SPEEDS.map(value => ({ value, label: `${value}×` }))}
            value={status.speed || 1}
            onChange={speed => {
              void command({ action: 'speed', speed });
              setMenu(null);
            }}
          />
        ) : null}
        {menu === 'sleep' ? (
          <Segmented
            fill
            style={s.menu}
            options={SLEEP_MINUTES.map(value => ({ value, label: value ? `${value}m` : 'Off' }))}
            value={sleepLeft ? null : 0}
            onChange={minutes => {
              void command({ action: 'sleep', minutes });
              setMenu(null);
            }}
          />
        ) : null}
        <View style={s.tools}>
          <Tool
            label="Speed"
            text={`${status.speed || 1}×`}
            active={menu === 'speed'}
            onPress={() => toggleMenu('speed')}
          />
          <Tool
            label={sleepLeft ? `${sleepLeft} min` : 'Sleep'}
            accessibilityLabel="Sleep timer"
            icon="clock"
            active={menu === 'sleep' || sleepLeft > 0}
            onPress={() => toggleMenu('sleep')}
          />
          <Tool
            label="Bookmark"
            icon="bookmark"
            disabled={!playback.active}
            onPress={() => void command({ action: 'bookmark' })}
          />
          <Tool
            label="Undo"
            accessibilityLabel="Undo last jump"
            icon="undo"
            disabled={!status.canUndo}
            onPress={onUndo}
          />
          <Tool label="History" icon="history" onPress={onHistory} />
        </View>
      </View>
    </View>
  );
}

interface IToolProps {
  label: string;
  accessibilityLabel?: string;
  icon?: TIcon;
  text?: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

function Tool({ label, accessibilityLabel, icon, text, active, disabled, onPress }: IToolProps) {
  const { colors } = useTheme();
  const s = useStyles();
  const color = active ? colors.mint : colors.muted;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled, expanded: active }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [s.tool, pressed && s.pressed, disabled && s.disabled]}
    >
      {icon ? <Icon name={icon} color={color} size={22} /> : <Text style={[s.toolText, { color }]}>{text}</Text>}
      <Text style={[s.toolLabel, active && { color: colors.mint }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

interface IDockProps {
  playback: IBookPlayback;
  controls: ITransportActions;
  onExpand: () => void;
}

/** Compact controls under the chapter list, so the list keeps most of the screen. */
function Dock({ playback, controls, onExpand }: IDockProps) {
  const s = useStyles();
  const time = `${clockTime(playback.position)}${playback.duration ? ` / ${clockTime(playback.duration)}` : ''}`;
  return (
    <View style={s.dock}>
      <Progress value={percent(playback.position, playback.duration)} style={s.dockProgress} />
      <View style={s.dockRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show player"
          onPress={onExpand}
          style={({ pressed }) => [s.dockInfo, pressed && s.pressed]}
        >
          <View style={s.dockTitles}>
            <Text style={s.dockTitle} numberOfLines={1}>
              {playback.track?.title}
            </Text>
            <Text style={s.dockTime}>{time}</Text>
          </View>
        </Pressable>
        {/* Play sits at the right edge, where the mini player has it on other screens. */}
        <SeekButton forward={false} size="compact" disabled={!playback.active} onSkip={controls.skip} />
        <SeekButton forward size="compact" disabled={!playback.active} onSkip={controls.skip} />
        <PlayButton
          playing={playback.playing}
          loading={playback.loading}
          size={touch.button}
          onPress={controls.toggle}
        />
      </View>
    </View>
  );
}

const useStyles = createThemedStyles(colors =>
  StyleSheet.create({
    screen: { flex: 1 },
    pressed: { opacity: 0.7 },
    disabled: { opacity: 0.35 },

    listen: { flex: 1 },
    listenLandscape: { flexDirection: 'row', alignItems: 'center' },
    info: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
      paddingVertical: COVER_PADDING,
    },
    titles: { alignSelf: 'stretch', alignItems: 'center' },
    cover: { marginBottom: COVER_GAP },
    bookTitle: {
      alignSelf: 'stretch',
      fontFamily: fonts.display,
      color: colors.text,
      fontSize: 24,
      lineHeight: 31,
      textAlign: 'center',
    },
    chapterTitle: {
      alignSelf: 'stretch',
      fontFamily: fonts.regular,
      color: colors.muted,
      fontSize: 15,
      lineHeight: 21,
      textAlign: 'center',
      marginTop: 6,
    },
    chapterLink: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: touch.min, paddingHorizontal: 16 },
    chapterCount: { fontFamily: fonts.medium, color: colors.subtle, fontSize: 13 },

    controls: { paddingHorizontal: 20, paddingBottom: 6 },
    controlsLandscape: { flex: 1.4, justifyContent: 'center' },
    transport: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22, paddingVertical: 10 },
    menu: { marginTop: 6 },
    tools: { flexDirection: 'row', marginTop: 6, marginHorizontal: -12 },
    tool: { flex: 1, minHeight: 68, alignItems: 'center', justifyContent: 'center', gap: 5 },
    toolText: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 22 },
    toolLabel: { color: colors.subtle, fontFamily: fonts.medium, fontSize: 11.5 },

    dock: { backgroundColor: colors.elevated },
    dockProgress: { height: 2, borderRadius: 0 },
    dockRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 12, paddingVertical: 8 },
    dockInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: touch.min },
    dockTitles: { flex: 1, gap: 3 },
    dockTitle: { fontFamily: fonts.medium, color: colors.text, fontSize: 14 },
    dockTime: { fontFamily: fonts.regular, color: colors.subtle, fontSize: 12, fontVariant: ['tabular-nums'] },
  }),
);
