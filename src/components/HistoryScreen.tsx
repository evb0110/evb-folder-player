import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { createThemedStyles, useTheme, fonts } from '../theme';
import type { IHistoryEntry } from '../player/types';
import { clockTime, historyDate } from '../player/format';
import { Action, Pill } from './Controls';
import { Icon } from './Icon';
export function HistoryScreen({ history, canUndo, onUndo, onRestore }: { history: IHistoryEntry[]; canUndo: boolean; onUndo: () => void; onRestore: (entry: IHistoryEntry) => void }) { const { colors } = useTheme(); const s = useStyles();
  const [bookmarks, setBookmarks] = useState(false);
  const rows = bookmarks ? history.filter(item => item.reason === 'Bookmark') : history;
  return <View style={s.screen}>
    <Text style={s.heading}>History</Text>
    {canUndo ? <Action icon="undo" label="Undo last jump" tone="primary" onPress={onUndo} style={{ marginTop: 20 }} /> : null}
    <View style={s.filters}><Pill label="All activity" selected={!bookmarks} onPress={() => setBookmarks(false)} /><Pill label="Bookmarks" selected={bookmarks} onPress={() => setBookmarks(true)} /></View>
    <FlatList data={rows} keyExtractor={item => String(item.id)} contentContainerStyle={s.list} ListEmptyComponent={<View style={s.empty}><View style={s.emptyIcon}><Icon name={bookmarks ? 'bookmark' : 'history'} size={38} color={colors.gold} /></View><Text style={s.emptyTitle}>{bookmarks ? 'No bookmarks' : 'No history'}</Text></View>} renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Restore ${item.trackTitle} at ${clockTime(item.position)}`} style={s.entry} onPress={() => onRestore(item)}>
      <View style={s.entryTop}><View style={s.reason}><Icon name={item.reason === 'Bookmark' ? 'bookmark' : item.reason.startsWith('Before') ? 'undo' : 'history'} size={15} color={item.reason === 'Bookmark' ? colors.gold : colors.subtle} /><Text style={s.reasonText}>{item.reason}</Text></View><Text style={s.date}>{historyDate(item.time)}</Text></View>
      <Text style={s.book} numberOfLines={1}>{item.bookName}</Text><Text style={s.track} numberOfLines={1}>{item.trackTitle}</Text><View style={s.entryBottom}><Text style={s.position}>{clockTime(item.position)}<Text style={s.chapter}>  ·  Chapter {item.trackIndex + 1}</Text></Text><View style={s.restore}><Text style={s.restoreText}>Restore</Text><Icon name="back" size={13} color={colors.mint} /></View></View>
    </Pressable>} />
  </View>;
}
const useStyles = createThemedStyles(colors => StyleSheet.create({ screen: { flex: 1, paddingHorizontal: 24, paddingTop: 27 }, heading: { fontFamily: fonts.display, fontSize: 32, color: colors.text }, filters: { flexDirection: 'row', alignSelf: 'flex-start', backgroundColor: colors.surface, borderRadius: 28, padding: 3, marginTop: 25, marginBottom: 12 }, list: { paddingBottom: 25 }, entry: { paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: colors.line }, entryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 10 }, reason: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 }, reasonText: { fontFamily: fonts.medium, color: colors.subtle, fontSize: 10 }, date: { fontFamily: fonts.regular, color: colors.subtle, fontSize: 10 }, book: { fontFamily: fonts.medium, fontSize: 16, color: colors.text, marginBottom: 4 }, track: { fontFamily: fonts.regular, color: colors.muted, fontSize: 12 }, entryBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }, position: { fontFamily: fonts.bold, fontSize: 14, color: colors.mint }, chapter: { fontFamily: fonts.regular, color: colors.subtle, fontSize: 11 }, restore: { flexDirection: 'row', alignItems: 'center', gap: 8 }, restoreText: { color: colors.mint, fontFamily: fonts.medium, fontSize: 11 }, empty: { alignItems: 'center', paddingTop: 65 }, emptyIcon: { width: 92, height: 92, backgroundColor: colors.surface, borderRadius: 46, alignItems: 'center', justifyContent: 'center', marginBottom: 23 }, emptyTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 22 } }));
