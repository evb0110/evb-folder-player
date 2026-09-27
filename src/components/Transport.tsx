import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { createThemedStyles, fonts, touch, useTheme } from '../theme';
import { clockTime, percent } from '../player/format';
import { SKIP_MS } from '../player/playback';
import { Progress } from './Controls';
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

interface IPositionProps {
  position: number;
  duration: number;
  /** Omit to show a read-only bar, as in car mode where a stray touch must not seek. */
  onSeek?: (position: number) => void;
  disabled?: boolean;
}

export function PositionSlider({ position, duration, onSeek, disabled }: IPositionProps) {
  const { colors } = useTheme();
  const s = useStyles();
  const [dragging, setDragging] = useState<number | null>(null);
  const shown = dragging ?? position;
  return (
    <View>
      {onSeek ? (
        <Slider
          style={s.slider}
          minimumValue={0}
          maximumValue={Math.max(duration, 1)}
          value={position}
          disabled={disabled || duration <= 0}
          onSlidingStart={setDragging}
          onValueChange={setDragging}
          onSlidingComplete={value => {
            onSeek(Math.round(value));
            setDragging(null);
          }}
          minimumTrackTintColor={colors.mint}
          maximumTrackTintColor={colors.line}
          thumbTintColor={colors.mint}
          accessibilityLabel="Playback position"
        />
      ) : (
        <Progress value={percent(position, duration)} style={s.readOnlyBar} />
      )}
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
      minHeight: 116,
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
    slider: { width: '100%', height: 40 },
    readOnlyBar: { marginVertical: 10 },
    times: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
    time: { color: colors.text, fontFamily: fonts.medium, fontSize: 13, fontVariant: ['tabular-nums'] },
    timeMuted: { color: colors.subtle, fontFamily: fonts.regular, fontSize: 13, fontVariant: ['tabular-nums'] },
  }),
);
