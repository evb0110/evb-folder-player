import { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { createThemedStyles, fonts, touch, useTheme } from '../theme';
import { clockTime, folderChildren, isHidden, parentFolder } from '../player/format';
import { bookPlayback } from '../player/playback';
import type { IBook, IStatus, TImportMethod } from '../player/types';
import { Action, IconButton, Segmented } from './Controls';
import { BookCover } from './BookCover';
import { Icon } from './Icon';
import { Header } from './Header';
import { ThemePicker } from './ThemePicker';

type TMode = 'books' | 'folders';

const modes = [
  { value: 'books', label: 'Books' },
  { value: 'folders', label: 'Folders' },
] as const;

interface IProps {
  books: IBook[];
  /** Paths removed from the list; see `isHidden`. */
  hidden: string[];
  status: IStatus;
  busy: boolean;
  importFolder: string | null;
  onImport: (method: TImportMethod) => void;
  onBook: (book: IBook) => void;
  onHide: (path: string) => void;
  onShow: (path: string) => void;
  onHistory: () => void;
}

export function LibraryScreen({
  books,
  hidden,
  status,
  busy,
  importFolder,
  onImport,
  onBook,
  onHide,
  onShow,
  onHistory,
}: IProps) {
  const { colors } = useTheme();
  const s = useStyles();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<TMode>('books');
  const [path, setPath] = useState('');
  const [panel, setPanel] = useState<'add' | 'theme' | null>(null);
  const [editing, setEditing] = useState(false);
  const shown = useMemo(() => books.filter(book => !isHidden(book.path, hidden)), [books, hidden]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return shown.filter(book => `${book.name} ${book.path}`.toLowerCase().includes(needle));
  }, [shown, query]);
  const browsing = mode === 'folders' && !query;
  const folder = folderChildren(filtered, path);
  const rows = browsing ? folder.books : filtered;
  const togglePanel = (next: 'add' | 'theme') => setPanel(current => (current === next ? null : next));

  return (
    <View style={s.screen}>
      <Header
        title="Library"
        right={
          <>
            <IconButton name="history" label="History" onPress={onHistory} />
            <IconButton name="theme" label="Theme" active={panel === 'theme'} onPress={() => togglePanel('theme')} />
            <IconButton
              name="plus"
              label="Add audiobooks"
              active={panel === 'add'}
              onPress={() => togglePanel('add')}
            />
          </>
        }
      />
      {/* Panels sit outside the list so they open in view even when the list is scrolled. */}
      {panel ? (
        <View style={s.panels}>
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
              {Platform.OS === 'web' ? null : (
                <Text style={s.panelNote}>
                  {importFolder
                    ? `To add a ZIP of audio files from Telegram or a download, open it with EVB Folder Player. It is unpacked into “${importFolder}”.`
                    : 'To add a ZIP of audio files from Telegram or a download, open it with EVB Folder Player. You choose the folder it is unpacked into.'}
                </Text>
              )}
            </View>
          ) : null}
        </View>
      ) : null}
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
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
              <View style={s.tools}>
                <IconButton
                  name="edit"
                  label="Remove from library"
                  active={editing}
                  onPress={() => setEditing(current => !current)}
                />
                <IconButton name="refresh" label="Rescan folders" disabled={busy} onPress={() => onImport('rescan')} />
              </View>
            </View>
            {editing ? (
              <View style={s.editPanel}>
                <Text style={s.panelNote}>
                  Tap × to remove a folder or book from this list. Its files stay on the phone, its position is kept,
                  and rescans leave it out.
                </Text>
                {hidden.length ? <Text style={s.hiddenTitle}>Removed from library</Text> : null}
                {hidden.map(path => (
                  <View key={path} style={s.hiddenRow}>
                    <Text style={s.hiddenPath} numberOfLines={2}>
                      {path}
                    </Text>
                    <IconButton name="plus" label={`Show ${path} again`} onPress={() => onShow(path)} />
                  </View>
                ))}
              </View>
            ) : null}
            <View style={s.search}>
              <Icon name="search" color={colors.subtle} size={19} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={`Search ${shown.length} ${shown.length === 1 ? 'book' : 'books'}`}
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
                    {editing ? (
                      <IconButton
                        name="close"
                        label={`Remove ${child.split('/').pop()} from library`}
                        onPress={() => onHide(child)}
                      />
                    ) : (
                      <Icon name="next" color={colors.subtle} size={18} />
                    )}
                  </Pressable>
                ))
              : null}
            {rows.map(book => (
              <BookRow
                key={book.id}
                book={book}
                status={status}
                onPress={() => onBook(book)}
                onRemove={editing ? () => onHide(book.path) : undefined}
              />
            ))}
            {filtered.length === 0 && query ? <Text style={s.noResults}>No books match “{query}”.</Text> : null}
            {shown.length === 0 && !editing ? (
              <Action label="Show removed books" onPress={() => setEditing(true)} style={s.addMore} />
            ) : null}
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
    </View>
  );
}

interface IBookRowProps {
  book: IBook;
  status: IStatus;
  onPress: () => void;
  /** Shown while editing the library. */
  onRemove?: () => void;
}

function BookRow({ book, status, onPress, onRemove }: IBookRowProps) {
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
      {onRemove ? (
        <IconButton name="close" label={`Remove ${book.name} from library`} onPress={onRemove} />
      ) : playback.playing ? (
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
    content: { paddingHorizontal: 20, paddingBottom: 28 },
    pressed: { opacity: 0.7 },
    screen: { flex: 1 },
    panels: { paddingHorizontal: 20, paddingBottom: 8 },
    addPanel: { backgroundColor: colors.surface, borderRadius: 20, padding: 14, marginTop: 8, gap: 10 },
    panelNote: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, paddingHorizontal: 4 },
    busy: { flexDirection: 'row', gap: 12, paddingVertical: 18, alignItems: 'center' },
    busyText: { color: colors.muted, fontFamily: fonts.regular, fontSize: 14 },
    note: { color: colors.subtle, fontFamily: fonts.regular, fontSize: 12, lineHeight: 17 },

    filters: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
    tools: { flexDirection: 'row' },
    editPanel: { backgroundColor: colors.surface, borderRadius: 20, padding: 14, marginTop: 8, gap: 6 },
    hiddenTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 15, paddingHorizontal: 4, marginTop: 6 },
    hiddenRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 4 },
    hiddenPath: { flex: 1, color: colors.muted, fontFamily: fonts.regular, fontSize: 14, lineHeight: 19 },
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
      minHeight: touch.min,
      fontFamily: fonts.regular,
      color: colors.text,
      fontSize: 15,
      ...(Platform.OS === 'web' ? { outlineWidth: 0 } : {}),
    },
    breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: touch.min },
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
    sample: { minHeight: touch.min, justifyContent: 'center', paddingHorizontal: 20, marginVertical: 8 },
    sampleText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 14 },
  }),
);
