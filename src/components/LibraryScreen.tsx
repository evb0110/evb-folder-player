import { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { createThemedStyles, fonts, useTheme } from '../theme';
import { clockTime, folderChildren, parentFolder } from '../player/format';
import { bookPlayback } from '../player/playback';
import type { IBook, IStatus, TImportMethod } from '../player/types';
import { Action, IconButton, Segmented } from './Controls';
import { BookCover } from './BookCover';
import { Icon } from './Icon';
import { ThemePicker } from './ThemePicker';

type TMode = 'books' | 'folders';

const modes = [
  { value: 'books', label: 'Books' },
  { value: 'folders', label: 'Folders' },
] as const;

interface IProps {
  books: IBook[];
  status: IStatus;
  busy: boolean;
  onImport: (method: TImportMethod) => void;
  onBook: (book: IBook) => void;
  onHistory: () => void;
}

export function LibraryScreen({ books, status, busy, onImport, onBook, onHistory }: IProps) {
  const { colors } = useTheme();
  const s = useStyles();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<TMode>('books');
  const [path, setPath] = useState('');
  const [panel, setPanel] = useState<'add' | 'theme' | null>(null);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return books.filter(book => `${book.name} ${book.path}`.toLowerCase().includes(needle));
  }, [books, query]);
  const browsing = mode === 'folders' && !query;
  const folder = folderChildren(filtered, path);
  const rows = browsing ? folder.books : filtered;
  const togglePanel = (next: 'add' | 'theme') => setPanel(current => (current === next ? null : next));

  return (
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <View style={s.header}>
        <Text style={s.heading}>Library</Text>
        <View style={s.headerActions}>
          <IconButton name="history" label="History" onPress={onHistory} />
          <IconButton name="sun" label="Theme" active={panel === 'theme'} onPress={() => togglePanel('theme')} />
          <IconButton name="plus" label="Add audiobooks" active={panel === 'add'} onPress={() => togglePanel('add')} />
        </View>
      </View>

      {panel === 'theme' ? <ThemePicker /> : null}
      {panel === 'add' ? (
        <View style={s.addPanel}>
          <Action
            icon="folder"
            label="Choose a folder"
            tone="primary"
            disabled={busy}
            onPress={() => onImport('folder')}
          />
          <Action icon="search" label="Scan device audio" disabled={busy} onPress={() => onImport('device')} />
        </View>
      ) : null}
      {busy ? (
        <View style={s.busy}>
          <ActivityIndicator color={colors.mint} />
          <Text style={s.busyText}>Reading folders…</Text>
        </View>
      ) : null}

      {books.length === 0 ? (
        <EmptyLibrary busy={busy} onImport={onImport} />
      ) : (
        <>
          <View style={s.filters}>
            <Segmented options={modes} value={mode} onChange={setMode} />
            <IconButton name="refresh" label="Rescan folders" disabled={busy} onPress={() => onImport('rescan')} />
          </View>
          <View style={s.search}>
            <Icon name="search" color={colors.subtle} size={19} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={`Search ${books.length} ${books.length === 1 ? 'book' : 'books'}`}
              placeholderTextColor={colors.subtle}
              style={s.searchInput}
              accessibilityLabel="Search library"
              clearButtonMode="while-editing"
            />
          </View>

          {browsing && path ? (
            <Pressable
              style={s.breadcrumb}
              onPress={() => setPath(parentFolder(path))}
              accessibilityRole="button"
              accessibilityLabel="Parent folder"
            >
              <Icon name="back" size={16} color={colors.mint} />
              <Text style={s.breadcrumbText} numberOfLines={2}>
                {path}
              </Text>
            </Pressable>
          ) : null}
          {browsing
            ? folder.folders.map(child => (
                <Pressable
                  key={child}
                  style={({ pressed }) => [s.row, pressed && s.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`Open folder ${child}`}
                  onPress={() => setPath(child)}
                >
                  <View style={s.folderIcon}>
                    <Icon name="folder" color={colors.gold} />
                  </View>
                  <Text style={s.folderName}>{child.split('/').pop()}</Text>
                  <Icon name="next" color={colors.subtle} size={18} />
                </Pressable>
              ))
            : null}
          {rows.map(book => (
            <BookRow key={book.id} book={book} status={status} onPress={() => onBook(book)} />
          ))}
          {filtered.length === 0 ? <Text style={s.noResults}>No books match “{query}”.</Text> : null}
          <Action
            icon="plus"
            label="Add folder"
            tone="quiet"
            disabled={busy}
            onPress={() => onImport('folder')}
            style={s.addMore}
          />
        </>
      )}
    </ScrollView>
  );
}

function BookRow({ book, status, onPress }: { book: IBook; status: IStatus; onPress: () => void }) {
  const { colors } = useTheme();
  const s = useStyles();
  const playback = bookPlayback(book, status);
  const started = playback.active || !!book.progress;
  const chapters = book.tracks.length;
  const meta = started
    ? `Chapter ${playback.trackIndex + 1} of ${chapters} · ${clockTime(playback.position)}`
    : `${chapters} ${chapters === 1 ? 'chapter' : 'chapters'}`;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${book.name}`}
      style={({ pressed }) => [s.row, pressed && s.pressed]}
    >
      <BookCover title={book.name} size={48} />
      <View style={s.bookInfo}>
        <Text style={[s.bookName, playback.active && s.activeText]} numberOfLines={2}>
          {book.name}
        </Text>
        <Text style={s.note} numberOfLines={1}>
          {book.root === 'sample' ? 'Sample recording' : book.path}
        </Text>
        <Text style={[s.meta, playback.active && s.activeText]}>{meta}</Text>
      </View>
      {playback.playing ? (
        <Icon name="volume" size={20} color={colors.mint} />
      ) : (
        <Icon name="next" size={17} color={colors.subtle} />
      )}
    </Pressable>
  );
}

function EmptyLibrary({ busy, onImport }: { busy: boolean; onImport: (method: TImportMethod) => void }) {
  const s = useStyles();
  return (
    <View style={s.empty}>
      <View style={s.emptyArt}>
        <View style={s.emptyBackBook}>
          <BookCover title="" size={94} />
        </View>
        <BookCover title="" size={124} />
      </View>
      <Text style={s.emptyTitle}>No audiobooks</Text>
      <Action
        icon="plus"
        label="Add folder"
        tone="primary"
        disabled={busy}
        onPress={() => onImport('folder')}
        style={s.fullWidth}
      />
      <Action
        icon="search"
        label="Scan device audio"
        tone="quiet"
        disabled={busy}
        onPress={() => onImport('device')}
        style={s.fullWidth}
      />
      <Pressable accessibilityRole="button" onPress={() => onImport('sample')} disabled={busy} style={s.sample}>
        <Text style={s.sampleText}>Try sample</Text>
      </Pressable>
      {Platform.OS === 'web' ? <Text style={s.note}>Folder access requires the Android app.</Text> : null}
    </View>
  );
}

const useStyles = createThemedStyles(colors =>
  StyleSheet.create({
    content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 },
    pressed: { opacity: 0.7 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerActions: { flexDirection: 'row', gap: 2 },
    heading: { fontSize: 30, fontFamily: fonts.display, color: colors.text },
    addPanel: { backgroundColor: colors.surface, borderRadius: 20, padding: 14, marginTop: 14, gap: 10 },
    busy: { flexDirection: 'row', gap: 12, paddingVertical: 18, alignItems: 'center' },
    busyText: { color: colors.muted, fontFamily: fonts.regular, fontSize: 14 },
    note: { color: colors.subtle, fontFamily: fonts.regular, fontSize: 12, lineHeight: 17 },

    filters: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
      marginTop: 8,
      marginBottom: 6,
      paddingHorizontal: 3,
    },
    searchInput: {
      flex: 1,
      minHeight: 50,
      fontFamily: fonts.regular,
      color: colors.text,
      fontSize: 15,
      ...(Platform.OS === 'web' ? { outlineWidth: 0 } : {}),
    },
    breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52 },
    breadcrumbText: { flex: 1, color: colors.mint, fontFamily: fonts.medium, fontSize: 13 },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      minHeight: 76,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.line,
    },
    folderIcon: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: colors.elevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    folderName: { flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 16 },
    bookInfo: { flex: 1, gap: 2 },
    bookName: { fontFamily: fonts.medium, fontSize: 16, color: colors.text, lineHeight: 22 },
    meta: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
    activeText: { color: colors.mint },
    noResults: { color: colors.muted, paddingVertical: 28, fontFamily: fonts.regular },
    addMore: { marginTop: 22 },

    empty: { alignItems: 'center', paddingTop: 32 },
    emptyArt: { height: 190, width: 230, alignItems: 'flex-end', paddingRight: 28, justifyContent: 'center' },
    emptyBackBook: { position: 'absolute', left: 24, top: 31, transform: [{ rotate: '-14deg' }] },
    emptyTitle: { fontFamily: fonts.display, fontSize: 30, lineHeight: 38, color: colors.text, marginVertical: 10 },
    fullWidth: { alignSelf: 'stretch', marginTop: 10 },
    sample: { minHeight: 52, justifyContent: 'center', marginVertical: 8 },
    sampleText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 14 },
  }),
);
