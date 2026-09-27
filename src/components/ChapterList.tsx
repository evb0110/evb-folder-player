import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { createThemedStyles, fonts, useTheme } from '../theme';
import { clockTime } from '../player/format';
import type { IBookPlayback } from '../player/playback';
import type { IBook, ITrack } from '../player/types';
import { Icon } from './Icon';

/** Fixed row height lets the list open directly at a chapter without measuring every row. */
const ROW_HEIGHT = 68;
/** Chapters kept visible above the current one when the list opens. */
const CONTEXT_ROWS = 2;

interface IScrollMemory {
  index: number;
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
  const [initialIndex] = useState(() => {
    const memory = scrollMemory.get(book.id);
    const index = memory && memory.trackId === currentId ? memory.index : playback.trackIndex - CONTEXT_ROWS;
    return Math.max(0, Math.min(index, book.tracks.length - 1));
  });

  return (
    <FlatList
      data={book.tracks}
      extraData={playback}
      keyExtractor={track => track.id}
      getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
      initialScrollIndex={initialIndex}
      scrollEventThrottle={100}
      onScroll={event => {
        const index = Math.round(event.nativeEvent.contentOffset.y / ROW_HEIGHT);
        scrollMemory.set(book.id, { index, trackId: currentId });
      }}
      renderItem={({ item, index }) => {
        const current = item.id === currentId;
        const played = index < playback.trackIndex;
        const detail = current
          ? `${clockTime(playback.position)}${playback.duration ? ` / ${clockTime(playback.duration)}` : ''}`
          : item.duration
            ? clockTime(item.duration)
            : '';
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Chapter ${index + 1}: ${item.title}`}
            accessibilityState={{ selected: current }}
            onPress={() => onChoose(item)}
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
              <Text style={[s.title, played && s.playedText, current && s.currentText]} numberOfLines={detail ? 1 : 2}>
                {item.title}
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
    info: { flex: 1, gap: 3 },
    title: { fontFamily: fonts.medium, color: colors.text, fontSize: 15, lineHeight: 20 },
    playedText: { color: colors.subtle },
    currentText: { color: colors.mint },
    detail: { fontFamily: fonts.regular, color: colors.subtle, fontSize: 12, fontVariant: ['tabular-nums'] },
  }),
);
