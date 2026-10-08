import { StyleSheet, Text, View } from 'react-native';
import { createThemedStyles, fonts } from '../theme';
import { importSummary } from '../player/importText';
import type { IImport } from '../player/types';
import { Action, IconButton, Progress } from './Controls';

interface IProps {
  job: IImport;
  onOpen: (bookId: string) => void;
  onCancel: () => void;
  onDismiss: () => void;
  onOpenDownloads: () => void;
}

export function ImportBanner({ job, onOpen, onCancel, onDismiss, onOpenDownloads }: IProps) {
  const s = useStyles();
  const { title, text } = importSummary(job);
  const running = job.state === 'running';
  const progress = job.progress ?? -1;
  const bookId = job.state === 'done' ? job.bookId : null;
  const downloaded = job.state === 'done' && job.archive === 'kept' && job.source === 'downloads';
  return (
    <View accessibilityRole={job.state === 'failed' ? 'alert' : 'summary'} style={s.banner}>
      <View style={s.row}>
        <View style={s.body}>
          <Text style={s.title} numberOfLines={2}>
            {title}
          </Text>
          <Text style={s.text}>{text}</Text>
        </View>
        <IconButton
          name="close"
          label={running ? 'Cancel import' : 'Dismiss'}
          onPress={running ? onCancel : onDismiss}
        />
      </View>
      {running ? <Progress value={progress >= 0 ? progress * 100 : 0} style={s.progress} /> : null}
      {bookId || downloaded ? (
        <View style={s.actions}>
          {bookId ? (
            <Action icon="play" label="Open book" tone="primary" compact onPress={() => onOpen(bookId)} />
          ) : null}
          {downloaded ? <Action label="Open Downloads" tone="quiet" compact onPress={onOpenDownloads} /> : null}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles(colors =>
  StyleSheet.create({
    banner: { backgroundColor: colors.surface, paddingLeft: 16, paddingBottom: 12 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    body: { flex: 1, paddingTop: 12, gap: 3 },
    title: { color: colors.text, fontFamily: fonts.bold, fontSize: 15, lineHeight: 20 },
    text: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
    progress: { marginTop: 4, marginRight: 16 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8, paddingRight: 16 },
  }),
);
