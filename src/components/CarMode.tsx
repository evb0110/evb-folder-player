import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { useLandscape } from '../frame';
import { createThemedStyles, fonts } from '../theme';
import { bookPlayback } from '../player/playback';
import type { TRunCommand } from '../player/usePlayer';
import type { IBook, IStatus } from '../player/types';
import { IconButton } from './Controls';
import { Header } from './Header';
import { PlayButton, PositionSlider, SeekButton } from './Transport';

/** Width reserved on each side of the play button for the landscape jump buttons. */
const SEEK_WIDTH = 130;

function KeepAwake() {
  useKeepAwake('folder-player-car', { suppressDeactivateWarnings: true });
  return null;
}

interface IProps {
  book: IBook;
  status: IStatus;
  keepAwake: boolean;
  onKeepAwake: (value: boolean) => void;
  onExit: () => void;
  onUndo: () => void;
  command: TRunCommand;
}

/** Driving layout: one huge play/pause target, two large jump buttons, nothing that seeks by accident. */
export function CarMode({ book, status, keepAwake, onKeepAwake, onExit, onUndo, command }: IProps) {
  const s = useStyles();
  const landscape = useLandscape();
  const playback = bookPlayback(book, status);
  const [area, setArea] = useState({ width: 0, height: 0 });
  const toggle = () => void command(playback.active ? { action: 'toggle' } : { action: 'open', bookId: book.id });
  const skip = (delta: number) => void command({ action: 'skip', delta });

  // Portrait pins the jump buttons to the bottom edge, within thumb reach, and gives the play
  // button the space in between. Landscape puts them beside it.
  const room = landscape ? Math.min(area.height, area.width - 2 * SEEK_WIDTH) : Math.min(area.width, area.height);
  const playSize = Math.round(Math.max(140, Math.min(360, room - 24)));
  const measure = (event: LayoutChangeEvent) => setArea(event.nativeEvent.layout);

  return (
    <View style={s.screen}>
      {keepAwake ? <KeepAwake /> : null}
      <Header
        left={<IconButton name="close" label="Exit car mode" onPress={onExit} />}
        right={
          <>
            {/* Shown only after a jump that can be reverted; a disabled icon alone reads as broken. */}
            {status.canUndo ? <IconButton name="undo" label="Undo last jump" onPress={onUndo} /> : null}
            <IconButton
              name={keepAwake ? 'screenOn' : 'screen'}
              label={keepAwake ? 'Screen stays on' : 'Screen can sleep'}
              active={keepAwake}
              onPress={() => onKeepAwake(!keepAwake)}
            />
          </>
        }
      />
      <View style={[s.body, landscape && s.bodyLandscape]}>
        <View style={[s.info, landscape && s.infoLandscape]}>
          <Text style={s.book} numberOfLines={2}>
            {book.name}
          </Text>
          <Text style={s.chapter} numberOfLines={2}>
            {playback.track?.title}
          </Text>
          <View style={s.position}>
            <PositionSlider position={playback.position} duration={playback.duration} />
          </View>
        </View>
        <View style={[s.controls, landscape && s.controlsLandscape]} onLayout={measure}>
          {area.width ? (
            <>
              {landscape ? <SeekButton forward={false} size="car" disabled={!playback.active} onSkip={skip} /> : null}
              <PlayButton playing={playback.playing} loading={playback.loading} size={playSize} onPress={toggle} />
              {landscape ? <SeekButton forward size="car" disabled={!playback.active} onSkip={skip} /> : null}
            </>
          ) : null}
        </View>
      </View>
      {landscape ? null : (
        <View style={s.seekRow}>
          <SeekButton forward={false} size="car" disabled={!playback.active} onSkip={skip} />
          <SeekButton forward size="car" disabled={!playback.active} onSkip={skip} />
        </View>
      )}
    </View>
  );
}

const useStyles = createThemedStyles(colors =>
  StyleSheet.create({
    screen: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: colors.bg,
      paddingBottom: 16,
    },
    body: { flex: 1, paddingHorizontal: 16 },
    bodyLandscape: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    info: { alignItems: 'center', paddingHorizontal: 8, paddingBottom: 8 },
    infoLandscape: { width: '32%' },
    book: {
      alignSelf: 'stretch',
      color: colors.text,
      fontFamily: fonts.display,
      fontSize: 24,
      lineHeight: 31,
      textAlign: 'center',
    },
    chapter: {
      alignSelf: 'stretch',
      color: colors.muted,
      fontFamily: fonts.regular,
      fontSize: 16,
      lineHeight: 22,
      textAlign: 'center',
      marginTop: 6,
    },
    position: { alignSelf: 'stretch', marginTop: 8 },
    controls: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    controlsLandscape: { flexDirection: 'row', alignSelf: 'stretch', gap: 8 },
    seekRow: { flexDirection: 'row', gap: 12, marginTop: 8, paddingHorizontal: 16 },
  }),
);
