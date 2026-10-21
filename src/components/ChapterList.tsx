import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { createThemedStyles, fonts, useTheme } from '../theme';
import { chapterTitles } from '../player/chapters';
import { clockTime } from '../player/format';
import type { IBookPlayback } from '../player/playback';
import type { IBook, ITrack } from '../player/types';
import { Icon } from './Icon';

/** Fixed heights let the list open directly at a chapter without measuring every row. */
const ROW_HEIGHT = 84;
const PART_HEIGHT = 52;
/** Chapters kept visible above the current one when the list opens. */
const CONTEXT_ROWS = 2;

type TRow =
  | { kind: 'part'; key: string; title: string }
  | { kind: 'track'; key: string; track: ITrack; index: number; title: string; full: string };

interface IRows {
  rows: TRow[];
  /** Top of each row, plus the list's total height at the end. */
  offsets: number[];
  /** Row of each track, by track index. */
  trackRows: number[];
  parts: number[];
}

/** Chapters with a heading wherever the collection or volume they belong to changes. */
function chapterRows(book: IBook): IRows {
  const titles = chapterTitles(book);
  const rows: TRow[] = [];
  const offsets: number[] = [];
  const trackRows: number[] = [];
  const parts: number[] = [];
  let top = 0;
  const push = (row: TRow) => {
    offsets.push(top);
    top += row.kind === 'part' ? PART_HEIGHT : ROW_HEIGHT;
    rows.push(row);
  };
  book.tracks.forEach((track, index) => {
    const { part, title, full } = titles[index];
    if (part && part !== titles[index - 1]?.part) {
      parts.push(rows.length);
      push({ kind: 'part', key: `part-${index}`, title: part });
    }
    trackRows.push(rows.length);
    push({ kind: 'track', key: track.id, track, index, title, full });
  });
  offsets.push(top);
  return { rows, offsets, trackRows, parts };
}

/** Row at a scroll offset. */
function rowAt(offsets: number[], y: number) {
  let low = 0;
  let high = offsets.length - 2;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (offsets[middle] <= y) low = middle;
    else high = middle - 1;
  }
  return Math.max(0, low);
}

interface IScrollMemory {
  row: number;
  trackId: string | undefined;
}

/**
 * First visible row per book for this session. The list reopens where it was left,
 * unless playback has since moved to another chapter; then it opens at that chapter.
 */
const scrollMemory = new Map<string, IScrollMemory>();

interface IProps {
  book: IBook;
  playback: IBookPlayback;
  onChoose: (track: ITrack) => void;
}

export function ChapterList({ book, playback, onChoose }: IProps) {
  const { colors } = useTheme();
  const s = useStyles();
  const currentId = playback.track?.id;
  const { rows, offsets, trackRows, parts } = useMemo(() => chapterRows(book), [book]);
  const [height, setHeight] = useState(0);
  const [initialRow] = useState(() => {
    const memory = scrollMemory.get(book.id);
    const row =
      memory && memory.trackId === currentId ? memory.row : (trackRows[playback.trackIndex] ?? 0) - CONTEXT_ROWS;
    return Math.max(0, Math.min(row, rows.length - 1));
  });

  // Sticky headings start from `contentOffset`; Android does not move them for the scroll to
  // `initialScrollIndex` until the first touch. The list is measured first so the offset can be
  // clamped the way the native scroll is near the end.
  const initialOffset = Math.max(0, Math.min(offsets[initialRow], offsets[rows.length] - height));
  const measure = (event: LayoutChangeEvent) => setHeight(height || event.nativeEvent.layout.height);

  if (!height) return <View style={s.measure} onLayout={measure} />;

  return (
    <FlatList
      data={rows}
      contentOffset={{ x: 0, y: initialOffset }}
      extraData={playback}
      keyExtractor={row => row.key}
      getItemLayout={(_, index) => ({ length: offsets[index + 1] - offsets[index], offset: offsets[index], index })}
      initialScrollIndex={initialRow}
      stickyHeaderIndices={parts}
      scrollEventThrottle={100}
      onScroll={event => {
        scrollMemory.set(book.id, { row: rowAt(offsets, event.nativeEvent.contentOffset.y), trackId: currentId });
      }}
      renderItem={({ item }) => {
        if (item.kind === 'part') {
          return (
            <View style={s.part} accessibilityRole="header">
              <Text style={s.partText} numberOfLines={2}>
                {item.title}
              </Text>
            </View>
          );
        }
        const { track, index, title, full } = item;
        const current = track.id === currentId;
        const played = index < playback.trackIndex;
        const detail = current
          ? `${clockTime(playback.position)}${playback.duration ? ` / ${clockTime(playback.duration)}` : ''}`
          : track.duration
            ? clockTime(track.duration)
            : '';
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Chapter ${index + 1}: ${full}`}
            accessibilityState={{ selected: current }}
            onPress={() => onChoose(track)}
            style={({ pressed }) => [s.row, current && s.currentRow, pressed && s.pressed]}
          >
            <View style={s.number}>
              {current && playback.playing ? (
                <Icon name="volume" color={colors.mint} size={20} />
              ) : (
                <Text style={[s.numberText, current && s.currentText]}>{index + 1}</Text>
              )}
            </View>
            <View style={s.info}>
              <Text style={[s.title, played && s.playedText, current && s.currentText]} numberOfLines={2}>
                {title}
              </Text>
              {detail ? <Text style={s.detail}>{detail}</Text> : null}
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const useStyles = createThemedStyles(colors =>
  StyleSheet.create({
    measure: { flex: 1 },
    part: {
      height: PART_HEIGHT,
      justifyContent: 'center',
      paddingHorizontal: 20,
      paddingLeft: 62,
      backgroundColor: colors.bg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.line,
    },
    partText: { fontFamily: fonts.bold, color: colors.gold, fontSize: 13, lineHeight: 17 },
    row: {
      height: ROW_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.line,
    },
    currentRow: { backgroundColor: colors.elevated, borderBottomColor: 'transparent' },
    pressed: { opacity: 0.7 },
    number: { width: 30, alignItems: 'center' },
    numberText: { fontFamily: fonts.medium, color: colors.subtle, fontSize: 13, fontVariant: ['tabular-nums'] },
    info: { flex: 1, gap: 4 },
    title: { fontFamily: fonts.medium, color: colors.text, fontSize: 16, lineHeight: 21 },
    playedText: { color: colors.subtle },
    currentText: { color: colors.mint },
    detail: { fontFamily: fonts.regular, color: colors.subtle, fontSize: 12, fontVariant: ['tabular-nums'] },
  }),
);
