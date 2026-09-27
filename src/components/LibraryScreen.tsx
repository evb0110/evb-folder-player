import { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { createThemedStyles, useTheme, fonts } from '../theme';
import type { IBook, IStatus } from '../player/types';
import { clockTime, folderChildren, percent } from '../player/format';
import { Action, IconButton, Pill, Progress, SectionLabel } from './Controls';
import { BookCover } from './BookCover';
import { Icon } from './Icon';
import { ThemePicker } from './ThemePicker';
interface IProps { books: IBook[]; status: IStatus; busy: boolean; onImport: (method: 'folder' | 'device' | 'rescan' | 'sample') => void; onBook: (book: IBook, play?: boolean) => void }
export function LibraryScreen({ books, status, busy, onImport, onBook }: IProps) {
  const { colors, dark } = useTheme();
  const s = useStyles();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'books' | 'folders'>('books');
  const [path, setPath] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showTheme, setShowTheme] = useState(false);
  const current = books.find(book => book.id === status.bookId);
  const filtered = useMemo(() => books.filter(book => `${book.name} ${book.path}`.toLowerCase().includes(query.toLowerCase())), [books, query]);
  const children = folderChildren(filtered, path);
  const rows = mode === 'books' || query ? filtered : children.books;
  return <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <View style={s.headingRow}><Text style={s.heading}>Library</Text><View style={{ flexDirection: 'row', gap: 8 }}><IconButton name="sun" label="Choose theme" onPress={() => setShowTheme(value => !value)} /><IconButton name="plus" label="Add audiobooks" onPress={() => setShowAdd(value => !value)} /></View></View>
    {showTheme ? <ThemePicker /> : null}
    {showAdd ? <View style={s.importCard}>
      <Action icon="folder" label="Choose a folder" onPress={() => onImport('folder')} disabled={busy} tone="primary" />
      <Action icon="search" label="Scan device audio" onPress={() => onImport('device')} disabled={busy} />
      <Action icon="refresh" label="Rescan saved folders" onPress={() => onImport('rescan')} disabled={busy || books.length === 0} tone="quiet" />
      <Text style={s.note}>Includes subfolders.</Text>
    </View> : null}
    {busy ? <View style={s.scanning}><ActivityIndicator color={colors.mint} /><Text style={s.subtitle}>Reading your folders…</Text></View> : null}
    {books.length === 0 ? <View style={s.empty}>
      <View style={s.emptyArt}><View style={s.backBook}><BookCover title="" size={94} /></View><BookCover title="" size={124} /></View>
      <Text style={s.emptyTitle}>No audiobooks</Text>
      <Action icon="plus" label="Add folder" tone="primary" disabled={busy} onPress={() => onImport('folder')} style={s.fullWidth} />
      <Action icon="search" label="Scan device audio" tone="quiet" disabled={busy} onPress={() => onImport('device')} style={s.fullWidth} />
      <Pressable accessibilityRole="button" onPress={() => onImport('sample')} disabled={busy} style={s.sampleButton}><Text style={s.sampleText}>Try sample</Text></Pressable>
      {Platform.OS === 'web' ? <Text style={s.note}>Folder access requires the Android app.</Text> : null}
    </View> : <>
      {current ? <View style={s.continueSection}>
        <SectionLabel>CONTINUE</SectionLabel>
        <Pressable accessibilityRole="button" accessibilityLabel={`Continue ${current.name}`} onPress={() => onBook(current)} style={s.continueCard}>
          <BookCover title={current.name} size={68} />
          <View style={s.continueInfo}><Text numberOfLines={2} style={s.continueTitle}>{current.name}</Text><Text numberOfLines={1} style={s.note}>{status.trackTitle}</Text><View style={{ height: 11 }} /><Progress value={percent(status.position, status.duration)} /><Text style={s.position}>{clockTime(status.position)} <Text style={s.note}>· Chapter {(status.trackIndex ?? 0) + 1} of {current.tracks.length}</Text></Text></View>
          <View style={s.smallPlay}><Icon name={status.playing ? 'volume' : 'play'} size={19} color={colors.ink} filled /></View>
        </Pressable>
      </View> : <View style={{ height: 24 }} />}
      <View style={s.filterRow}><View style={s.segment}><Pill label="Books" selected={mode === 'books'} onPress={() => setMode('books')} /><Pill label="Folders" selected={mode === 'folders'} onPress={() => setMode('folders')} /></View><IconButton name="refresh" label="Rescan library" onPress={() => onImport('rescan')} /></View>
      <View style={s.search}><Icon name="search" color={colors.subtle} size={19} /><TextInput value={query} onChangeText={setQuery} placeholder="Search" placeholderTextColor={colors.subtle} style={s.searchInput} accessibilityLabel="Search library" clearButtonMode="while-editing" /></View>
      {mode === 'folders' && !query && path ? <Pressable style={s.breadcrumb} onPress={() => setPath(path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '')} accessibilityRole="button" accessibilityLabel="Parent folder"><Icon name="back" size={16} color={colors.mint} /><Text style={s.folderPath}>{path}</Text></Pressable> : null}
      <View style={s.countRow}><SectionLabel>{mode === 'folders' && !query ? (path ? 'IN THIS FOLDER' : 'FOLDERS') : 'ALL BOOKS'}</SectionLabel><Text style={s.count}>{filtered.length} {filtered.length === 1 ? 'book' : 'books'}</Text></View>
      {mode === 'folders' && !query ? children.folders.map(folder => <Pressable key={folder} style={s.folderRow} accessibilityRole="button" accessibilityLabel={`Open folder ${folder}`} onPress={() => setPath(folder)}><View style={s.folderIcon}><Icon name="folder" color={colors.gold} /></View><Text style={s.folderName}>{folder.split('/').pop()}</Text><Icon name="next" color={colors.subtle} size={18} /></Pressable>) : null}
      {rows.map(book => <Pressable key={book.id} onPress={() => onBook(book)} accessibilityRole="button" accessibilityLabel={`Open ${book.name}`} style={({ pressed }) => [s.bookRow, pressed && { opacity: 0.7 }]}>
        <BookCover title={book.name} size={52} /><View style={s.bookInfo}><Text style={s.bookName} numberOfLines={2}>{book.name}</Text><Text style={s.note} numberOfLines={1}>{book.root === 'sample' ? 'Sample recording' : book.path}</Text><Text style={s.bookMeta}>{book.tracks.length} {book.tracks.length === 1 ? 'chapter' : 'chapters'}{book.progress ? ` · Resume at ${clockTime(book.progress.position)}` : ' · Not started'}</Text></View><Icon name="next" size={17} color={colors.subtle} />
      </Pressable>)}
      {filtered.length === 0 ? <Text style={s.noResults}>No books match “{query}”.</Text> : null}
      <Action icon="plus" label="Add folder" tone="quiet" onPress={() => setShowAdd(value => !value)} style={{ marginTop: 22 }} />
    </>}
  </ScrollView>;
}
const useStyles = createThemedStyles(colors => StyleSheet.create({
  content: { padding: 24, paddingTop: 20, paddingBottom: 32 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, heading: { fontSize: 32, fontFamily: fonts.display, color: colors.text }, subtitle: { color: colors.muted, fontFamily: fonts.regular, fontSize: 14, lineHeight: 22 },
  importCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 16, marginTop: 20, gap: 10 }, note: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18 }, scanning: { flexDirection: 'row', gap: 12, padding: 20, alignItems: 'center' },
  empty: { alignItems: 'center', paddingTop: 38 }, emptyArt: { height: 190, width: 230, alignItems: 'flex-end', paddingRight: 28, justifyContent: 'center' }, backBook: { position: 'absolute', left: 24, top: 31, transform: [{ rotate: '-14deg' }] }, emptyTitle: { fontFamily: fonts.display, fontSize: 30, lineHeight: 38, textAlign: 'center', color: colors.text, marginTop: 10 }, fullWidth: { width: '100%', marginTop: 10 }, sampleButton: { minHeight: 52, justifyContent: 'center', marginVertical: 9 }, sampleText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 13 },
  continueSection: { marginTop: 22, marginBottom: 23 }, continueCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 20, padding: 16, gap: 15, flexDirection: 'row', alignItems: 'center' }, continueInfo: { flex: 1 }, continueTitle: { fontFamily: fonts.display, color: colors.text, fontSize: 19, lineHeight: 25, marginBottom: 3 }, position: { color: colors.mint, fontSize: 12, fontFamily: fonts.medium, marginTop: 9 }, smallPlay: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  readyCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, backgroundColor: colors.surface, marginTop: 26, marginBottom: 24, borderRadius: 16 }, filterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, segment: { flexDirection: 'row', backgroundColor: colors.surface, padding: 3, borderRadius: 28 }, search: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.line, marginTop: 14, marginBottom: 23, paddingHorizontal: 3 }, searchInput: { minHeight: 49, fontFamily: fonts.regular, color: colors.text, fontSize: 14, flex: 1, outlineWidth: 0 }, countRow: { flexDirection: 'row', justifyContent: 'space-between' }, count: { color: colors.subtle, fontFamily: fonts.regular, fontSize: 12 },
  bookRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 15, borderBottomWidth: 1, borderBottomColor: colors.line }, bookInfo: { flex: 1, gap: 3 }, bookName: { fontFamily: fonts.medium, fontSize: 16, color: colors.text, lineHeight: 22 }, bookMeta: { color: colors.subtle, fontFamily: fonts.regular, fontSize: 11, marginTop: 3 }, noResults: { color: colors.muted, paddingVertical: 28, fontFamily: fonts.regular }, breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 56, marginBottom: 14 }, folderPath: { flex: 1, color: colors.mint, fontFamily: fonts.medium, fontSize: 13 }, folderRow: { flexDirection: 'row', gap: 15, alignItems: 'center', minHeight: 78, borderBottomWidth: 1, borderBottomColor: colors.line }, folderIcon: { width: 50, height: 50, borderRadius: 14, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' }, folderName: { flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 16 },
}));
