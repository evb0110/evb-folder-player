import { Pressable, StyleSheet, Text, View } from 'react-native';
import { createThemedStyles, fonts, touch } from '../theme';
import { percent } from '../player/format';
import type { IBook, IStatus } from '../player/types';
import { Progress } from './Controls';
import { BookCover } from './BookCover';
import { PlayButton } from './Transport';

interface IProps {
  book: IBook;
  status: IStatus;
  onOpen: () => void;
  onToggle: () => void;
}

export function MiniPlayer({ book, status, onOpen, onToggle }: IProps) {
  const s = useStyles();
  return (
    <View style={s.bar}>
      <Progress value={percent(status.position, status.duration)} style={s.progress} />
      <View style={s.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${book.name}`}
          style={({ pressed }) => [s.info, pressed && s.pressed]}
          onPress={onOpen}
        >
          <BookCover title={book.name} size={36} />
          <View style={s.titles}>
            <Text style={s.title} numberOfLines={1}>
              {book.name}
            </Text>
            <Text style={s.chapter} numberOfLines={1}>
              {status.trackTitle}
            </Text>
          </View>
        </Pressable>
        <PlayButton playing={status.playing} loading={status.loading} size={touch.button} onPress={onToggle} />
      </View>
    </View>
  );
}

const useStyles = createThemedStyles(colors =>
  StyleSheet.create({
    bar: { backgroundColor: colors.elevated },
    progress: { height: 2, borderRadius: 0 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 20, paddingRight: 12, paddingVertical: 8 },
    info: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: touch.min },
    pressed: { opacity: 0.7 },
    titles: { flex: 1, gap: 3 },
    title: { fontFamily: fonts.medium, color: colors.text, fontSize: 14 },
    chapter: { fontFamily: fonts.regular, color: colors.subtle, fontSize: 12 },
  }),
);
