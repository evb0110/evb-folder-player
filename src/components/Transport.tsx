import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { createThemedStyles, fonts, touch, useTheme } from '../theme';
import { clockTime } from '../player/format';
import { SKIP_MS } from '../player/playback';
import { Icon } from './Icon';

type TSize = 'compact' | 'regular' | 'car';

interface ISeekButtonProps {
  forward: boolean;
  size: TSize;
  disabled?: boolean;
  onSkip: (delta: number) => void;
}

export function SeekButton({ forward, size, disabled, onSkip }: ISeekButtonProps) {
  const { colors } = useTheme();
  const s = useStyles();
  const iconSize = { compact: 32, regular: 38, car: 72 }[size];
  const frame = { compact: s.seekCompact, regular: s.seekRegular, car: s.seekCar }[size];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={forward ? 'Forward 20 seconds' : 'Back 20 seconds'}
      disabled={disabled}
      onPress={() => onSkip(forward ? SKIP_MS : -SKIP_MS)}
      style={({ pressed }) => [frame, pressed && s.pressed, disabled && s.disabled]}
    >
      <View>
        <Icon name={forward ? 'forward' : 'rewind'} size={iconSize} color={colors.text} />
        <Text style={[s.seekNumber, { top: iconSize * 0.35, fontSize: iconSize * 0.25, lineHeight: iconSize * 0.3 }]}>
          20
        </Text>
      </View>
    </Pressable>
  );
}

interface IPlayButtonProps {
  playing: boolean;
  loading: boolean;
  size: number;
  onPress: () => void;
}

export function PlayButton({ playing, loading, size, onPress }: IPlayButtonProps) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={playing ? 'Pause' : 'Play'}
      onPress={onPress}
      style={({ pressed }) => [s.play, { width: size, height: size, borderRadius: size / 2 }, pressed && s.pressed]}
    >
      {loading ? (
        <ActivityIndicator color={colors.ink} />
      ) : (
        <Icon name={playing ? 'pause' : 'play'} size={size * 0.44} color={colors.ink} filled />
      )}
    </Pressable>
  );
}

/** How long a released drag keeps showing its target while the player catches up. */
const HOLD_MS = 1500;

interface IScrubberProps {
  position: number;
  duration: number;
  onSeek: (position: number) => void;
  /** Reports the position under the finger while dragging, then `null` once the player has caught up. */
  onScrub?: (position: number | null) => void;
  disabled?: boolean;
}

/**
 * Finger-sized position bar: the whole 56 px tall strip responds, so a tap anywhere jumps there
 * and a drag follows the finger. Stock sliders on Android only react within a thin line.
 */
export function Scrubber({ position, duration, onSeek, onScrub, disabled }: IScrubberProps) {
  const s = useStyles();
  const [width, setWidth] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [held, setHeld] = useState<number | null>(null);
  const release = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(release.current), []);

  const enabled = !disabled && duration > 0;
  const clamp = (value: number) => Math.round(Math.min(duration, Math.max(0, value)));
  const at = (x: number) => clamp((x / Math.max(width, 1)) * duration);
  const show = (value: number | null) => {
    setHeld(value);
    onScrub?.(value);
  };
  const begin = (x: number) => {
    clearTimeout(release.current);
    setDragging(true);
    show(at(x));
  };
  const finish = (x: number) => {
    const target = at(x);
    setDragging(false);
    show(target);
    onSeek(target);
    release.current = setTimeout(() => show(null), HOLD_MS);
  };
  const cancel = () => {
    setDragging(false);
    show(null);
  };

  const value = held ?? position;
  const offset = `${duration > 0 ? (clamp(value) / duration) * 100 : 0}%` as const;
  return (
    <View
      style={s.scrubber}
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Playback position"
      accessibilityState={{ disabled: !enabled }}
      accessibilityValue={{ text: clockTime(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={event => {
        if (enabled) onSeek(clamp(value + (event.nativeEvent.actionName === 'increment' ? SKIP_MS : -SKIP_MS)));
      }}
      onStartShouldSetResponder={() => enabled}
      onMoveShouldSetResponder={() => enabled}
      onResponderTerminationRequest={() => false}
      onResponderGrant={event => begin(event.nativeEvent.locationX)}
      onResponderMove={event => show(at(event.nativeEvent.locationX))}
      onResponderRelease={event => finish(event.nativeEvent.locationX)}
      onResponderTerminate={cancel}
    >
      <View style={[s.track, !enabled && s.disabled]}>
        <View style={[s.fill, { width: offset }]} />
      </View>
      <View style={[s.thumb, dragging && s.thumbDragging, !enabled && s.disabled, { left: offset }]} />
    </View>
  );
}

interface IPositionProps {
  position: number;
  duration: number;
  onSeek: (position: number) => void;
  disabled?: boolean;
}

/** Position bar with elapsed and remaining time, which follow the finger while dragging. */
export function PositionSlider({ position, duration, onSeek, disabled }: IPositionProps) {
  const s = useStyles();
  const [scrub, setScrub] = useState<number | null>(null);
  const shown = scrub ?? position;
  return (
    <View>
      <Scrubber position={position} duration={duration} onSeek={onSeek} onScrub={setScrub} disabled={disabled} />
      <View style={s.times}>
        <Text style={s.time}>{clockTime(shown)}</Text>
        <Text style={s.timeMuted}>{duration ? `−${clockTime(duration - shown)}` : ''}</Text>
      </View>
    </View>
  );
}

const useStyles = createThemedStyles(colors =>
  StyleSheet.create({
    pressed: { opacity: 0.6 },
    disabled: { opacity: 0.4 },
    play: { backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
    seekCompact: { width: touch.button, height: touch.button, alignItems: 'center', justifyContent: 'center' },
    seekRegular: {
      width: 72,
      height: 72,
      borderRadius: 22,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    seekCar: {
      flex: 1,
      minHeight: 132,
      borderRadius: 28,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    seekNumber: {
      position: 'absolute',
      left: 0,
      right: 0,
      textAlign: 'center',
      fontFamily: fonts.bold,
      color: colors.text,
      includeFontPadding: false,
    },
    // Children ignore touches so every event lands on the strip itself, with x measured from its left edge.
    scrubber: { height: touch.min, justifyContent: 'center' },
    track: { height: 6, borderRadius: 3, backgroundColor: colors.line, overflow: 'hidden', pointerEvents: 'none' },
    fill: { height: '100%', backgroundColor: colors.mint },
    thumb: {
      position: 'absolute',
      width: 22,
      height: 22,
      marginLeft: -11,
      borderRadius: 11,
      backgroundColor: colors.mint,
      pointerEvents: 'none',
    },
    thumbDragging: { width: 32, height: 32, marginLeft: -16, borderRadius: 16 },
    times: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
    time: { color: colors.text, fontFamily: fonts.medium, fontSize: 13, fontVariant: ['tabular-nums'] },
    timeMuted: { color: colors.subtle, fontFamily: fonts.regular, fontSize: 13, fontVariant: ['tabular-nums'] },
  }),
);
