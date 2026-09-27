import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { createThemedStyles, fonts, useTheme } from '../theme';
import { clockTime, historyDate } from '../player/format';
import type { IHistoryEntry } from '../player/types';
import { Action, IconButton, Segmented } from './Controls';
import { Icon, type TIcon } from './Icon';

type TFilter = 'all' | 'bookmarks';

const filters = [
  { value: 'all', label: 'All' },
  { value: 'bookmarks', label: 'Bookmarks' },
] as const;

function reasonIcon(reason: string): TIcon {
  if (reason === 'Bookmark') return 'bookmark';
  if (reason.startsWith('Before')) return 'undo';
  return 'history';
}

interface IProps {
  history: IHistoryEntry[];
  canUndo: boolean;
  onBack: () => void;
  onUndo: () => void;
  onRestore: (entry: IHistoryEntry) => void;
}

export function HistoryScreen({ history, canUndo, onBack, onUndo, onRestore }: IProps) {
  const { colors } = useTheme();
  const s = useStyles();
  const [filter, setFilter] = useState<TFilter>('all');
  const rows = filter === 'bookmarks' ? history.filter(item => item.reason === 'Bookmark') : history;

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <IconButton name="back" label="Back" onPress={onBack} />
        <Text style={s.heading}>History</Text>
      </View>
      <View style={s.toolbar}>
        <Segmented options={filters} value={filter} onChange={setFilter} />
        {canUndo ? <Action icon="undo" label="Undo" compact tone="quiet" onPress={onUndo} /> : null}
      </View>
      <FlatList
        data={rows}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={s.list}
        ListEmptyComponent={
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <Icon name={filter === 'bookmarks' ? 'bookmark' : 'history'} size={38} color={colors.gold} />
            </View>
            <Text style={s.emptyTitle}>{filter === 'bookmarks' ? 'No bookmarks' : 'No history'}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const bookmark = item.reason === 'Bookmark';
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Restore ${item.trackTitle} at ${clockTime(item.position)}`}
              style={({ pressed }) => [s.entry, pressed && s.pressed]}
              onPress={() => onRestore(item)}
            >
              <Icon name={reasonIcon(item.reason)} size={18} color={bookmark ? colors.gold : colors.subtle} />
              <View style={s.entryInfo}>
                <Text style={s.book} numberOfLines={1}>
                  {item.bookName}
                </Text>
                <Text style={s.track} numberOfLines={1}>
                  {item.trackTitle}
                </Text>
                <Text style={s.meta} numberOfLines={1}>
                  {item.reason} · {historyDate(item.time)}
                </Text>
              </View>
              <Text style={s.position}>{clockTime(item.position)}</Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const useStyles = createThemedStyles(colors =>
  StyleSheet.create({
    screen: { flex: 1 },
    pressed: { opacity: 0.7 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingTop: 6 },
    heading: { fontFamily: fonts.display, fontSize: 28, color: colors.text },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 10,
    },
    list: { paddingHorizontal: 20, paddingBottom: 24 },
    entry: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      minHeight: 76,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.line,
    },
    entryInfo: { flex: 1, gap: 3 },
    book: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
    track: { fontFamily: fonts.regular, color: colors.muted, fontSize: 13 },
    meta: { fontFamily: fonts.regular, color: colors.subtle, fontSize: 11 },
    position: { fontFamily: fonts.bold, fontSize: 14, color: colors.mint, fontVariant: ['tabular-nums'] },
    empty: { alignItems: 'center', paddingTop: 64 },
    emptyIcon: {
      width: 92,
      height: 92,
      borderRadius: 46,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    emptyTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 22 },
  }),
);
