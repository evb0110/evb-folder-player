import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { createThemedStyles, useTheme, fonts } from '../theme';
import { Icon, type TIcon } from './Icon';
export function Action({ icon, label, onPress, tone = 'default', compact = false, disabled = false, style }: { icon?: TIcon; label: string; onPress: () => void; tone?: 'default' | 'primary' | 'quiet'; compact?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle> }) { const { colors } = useTheme(); const s = useStyles();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.action, compact && s.compact, tone === 'primary' && s.primary, tone === 'quiet' && s.quiet, pressed && s.pressed, disabled && s.disabled, style]}>
    {icon ? <Icon name={icon} size={20} color={tone === 'primary' ? colors.ink : colors.mint} /> : null}
    <Text style={[s.label, tone === 'primary' && { color: colors.ink }]}>{label}</Text>
  </Pressable>;
}
export function IconButton({ name, label, onPress, size = 26 }: { name: TIcon; label: string; onPress: () => void; size?: number }) { const { colors } = useTheme(); const s = useStyles();
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [s.iconButton, pressed && s.pressed]}><Icon name={name} size={size} color={colors.text} /></Pressable>;
}
export function Pill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { const { colors } = useTheme(); const s = useStyles();
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[s.pill, selected && s.selectedPill]}><Text style={[s.pillText, selected && { color: colors.ink }]}>{label}</Text></Pressable>;
}
export function SectionLabel({ children }: { children: string }) { const { colors } = useTheme(); const s = useStyles(); return <Text style={s.section}>{children}</Text>; }
export function Progress({ value }: { value: number }) { const { colors } = useTheme(); const s = useStyles(); return <View style={s.progress}><View style={[s.progressFill, { width: `${Math.max(0, Math.min(100, value))}%` }]} /></View>; }
const useStyles = createThemedStyles(colors => StyleSheet.create({
  action: { minHeight: 64, borderRadius: 16, backgroundColor: colors.elevated, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 14 },
  primary: { backgroundColor: colors.mint }, quiet: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line }, compact: { minHeight: 52, paddingVertical: 10, paddingHorizontal: 14 },
  label: { color: colors.text, fontFamily: fonts.bold, fontSize: 16 }, pressed: { opacity: 0.72 }, disabled: { opacity: 0.4 },
  iconButton: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 28 },
  pill: { minHeight: 52, paddingHorizontal: 19, justifyContent: 'center', borderRadius: 28 }, selectedPill: { backgroundColor: colors.mint }, pillText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 16 },
  section: { fontFamily: fonts.bold, color: colors.subtle, fontSize: 11, letterSpacing: 1.7, marginBottom: 14 },
  progress: { height: 3, borderRadius: 4, backgroundColor: colors.line, overflow: 'hidden' }, progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.mint },
}));
