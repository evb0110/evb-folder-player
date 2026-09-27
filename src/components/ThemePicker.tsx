import { Pressable, StyleSheet, Text, View } from 'react-native';
import { createThemedStyles, fonts, useTheme, type TThemePreference } from '../theme';
import { Icon } from './Icon';
const choices: { value: TThemePreference; label: string }[] = [
  { value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' },
];
export function ThemePicker() {
  const { colors, preference, setPreference, error } = useTheme();
  const s = useStyles();
  return <View style={s.panel}>
    <Text style={s.heading}>Theme</Text>
    <View style={s.choices}>{choices.map(choice => <Pressable key={choice.value} accessibilityRole="radio" accessibilityLabel={`${choice.label} theme`} accessibilityState={{ checked: preference === choice.value }} onPress={() => setPreference(choice.value)} style={[s.choice, preference === choice.value && s.selected]}>
      <Text style={[s.label, preference === choice.value && { color: colors.ink }]}>{choice.label}</Text>
      {preference === choice.value ? <Icon name="check" size={20} color={colors.ink} /> : <View style={{ width: 20, height: 20 }} />}
    </Pressable>)}</View>
    {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
  </View>;
}
const useStyles = createThemedStyles(colors => StyleSheet.create({
  panel: { paddingVertical: 18, gap: 12 }, heading: { fontFamily: fonts.medium, fontSize: 16, color: colors.text },
  choices: { flexDirection: 'row', gap: 8 }, choice: { flex: 1, minHeight: 72, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 6 },
  selected: { backgroundColor: colors.mint }, label: { fontFamily: fonts.bold, color: colors.text, fontSize: 15 },
  error: { fontFamily: fonts.regular, color: colors.error, fontSize: 13 },
}));
