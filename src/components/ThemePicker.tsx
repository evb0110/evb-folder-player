import { Pressable, StyleSheet, Text, View } from 'react-native';
import { createThemedStyles, fonts, useTheme, type TThemePreference } from '../theme';
import { Icon } from './Icon';

const choices: { value: TThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function ThemePicker() {
  const { colors, preference, setPreference, error } = useTheme();
  const s = useStyles();
  return (
    <View style={s.panel}>
      <View style={s.choices} accessibilityRole="radiogroup">
        {choices.map(choice => {
          const checked = preference === choice.value;
          return (
            <Pressable
              key={choice.value}
              accessibilityRole="radio"
              accessibilityLabel={`${choice.label} theme`}
              accessibilityState={{ checked }}
              onPress={() => setPreference(choice.value)}
              style={[s.choice, checked && s.selected]}
            >
              <Text style={[s.label, checked && { color: colors.ink }]}>{choice.label}</Text>
              {checked ? <Icon name="check" size={18} color={colors.ink} /> : null}
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles(colors =>
  StyleSheet.create({
    panel: { marginTop: 8, gap: 10 },
    choices: { flexDirection: 'row', gap: 8 },
    choice: {
      flex: 1,
      minHeight: 56,
      flexDirection: 'row',
      gap: 6,
      borderRadius: 16,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selected: { backgroundColor: colors.mint },
    label: { fontFamily: fonts.bold, color: colors.text, fontSize: 15 },
    error: { fontFamily: fonts.regular, color: colors.error, fontSize: 13 },
  }),
);
