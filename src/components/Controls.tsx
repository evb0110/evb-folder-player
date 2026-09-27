import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { createThemedStyles, fonts, touch, useTheme } from '../theme';
import { Icon, type TIcon } from './Icon';

interface IActionProps {
  label: string;
  onPress: () => void;
  icon?: TIcon;
  tone?: 'default' | 'primary' | 'quiet';
  compact?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Action({ icon, label, onPress, tone = 'default', compact, disabled, style }: IActionProps) {
  const { colors } = useTheme();
  const s = useStyles();
  const primary = tone === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.action,
        compact && s.compact,
        primary && s.primary,
        tone === 'quiet' && s.quiet,
        pressed && s.pressed,
        disabled && s.disabled,
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={20} color={primary ? colors.ink : colors.mint} /> : null}
      <Text style={[s.label, primary && { color: colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

interface IIconButtonProps {
  name: TIcon;
  label: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
  /** Car mode uses larger targets. */
  large?: boolean;
}

export function IconButton({ name, label, onPress, active, disabled, large }: IIconButtonProps) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      style={({ pressed }) => [
        s.iconButton,
        large && s.iconButtonLarge,
        active && s.iconButtonActive,
        pressed && s.pressed,
        disabled && s.disabled,
      ]}
    >
      <Icon name={name} size={large ? 36 : 30} color={active ? colors.mint : colors.text} />
    </Pressable>
  );
}

interface ISegmentedProps<T extends string | number> {
  options: readonly { value: T; label: string }[];
  /** `null` when no option is selected. */
  value: T | null;
  onChange: (value: T) => void;
  /** Stretch across the available width with equal segments. */
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Segmented<T extends string | number>({ options, value, onChange, fill, style }: ISegmentedProps<T>) {
  const s = useStyles();
  return (
    <View style={[s.segmented, style]}>
      {options.map(option => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[s.segment, fill && s.segmentFill, selected && s.segmentSelected]}
          >
            <Text
              style={[s.segmentText, fill && s.segmentTextFill, selected && s.segmentTextSelected]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Progress({ value, style }: { value: number; style?: StyleProp<ViewStyle> }) {
  const s = useStyles();
  return (
    <View style={[s.progress, style]}>
      <View style={[s.progressFill, { width: `${Math.max(0, Math.min(100, value))}%` }]} />
    </View>
  );
}

const useStyles = createThemedStyles(colors =>
  StyleSheet.create({
    action: {
      minHeight: 60,
      borderRadius: 16,
      backgroundColor: colors.elevated,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingHorizontal: 18,
      paddingVertical: 12,
    },
    compact: { minHeight: touch.min, paddingVertical: 10, paddingHorizontal: 14 },
    primary: { backgroundColor: colors.mint },
    quiet: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
    label: { color: colors.text, fontFamily: fonts.bold, fontSize: 16 },
    pressed: { opacity: 0.72 },
    disabled: { opacity: 0.4 },
    iconButton: {
      width: touch.button,
      height: touch.button,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: touch.button / 2,
    },
    iconButtonLarge: { width: touch.large, height: touch.large, borderRadius: touch.large / 2 },
    iconButtonActive: { backgroundColor: colors.surface },
    segmented: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: touch.min / 2 + 3, padding: 3 },
    segment: {
      minHeight: touch.min,
      minWidth: touch.min,
      paddingHorizontal: 14,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: touch.min / 2,
    },
    segmentFill: { flex: 1, paddingHorizontal: 2 },
    segmentSelected: { backgroundColor: colors.mint },
    segmentText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 15 },
    segmentTextFill: { fontSize: 14 },
    segmentTextSelected: { color: colors.ink },
    progress: { height: 3, borderRadius: 2, backgroundColor: colors.line, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: colors.mint },
  }),
);
