import { StyleSheet, Text, View } from 'react-native';
import { createThemedStyles, fonts } from '../theme';
import { IconButton } from './Controls';

interface IProps {
  title: string;
  text: string;
  onDismiss: () => void;
}

export function TipBanner({ title, text, onDismiss }: IProps) {
  const s = useStyles();
  return (
    <View accessibilityRole="summary" style={s.banner}>
      <View style={s.body}>
        <Text style={s.title}>{title}</Text>
        <Text style={s.text}>{text}</Text>
      </View>
      <IconButton name="close" label="Dismiss" onPress={onDismiss} />
    </View>
  );
}

const useStyles = createThemedStyles(colors =>
  StyleSheet.create({
    banner: {
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingLeft: 16,
      paddingBottom: 12,
    },
    body: { flex: 1, paddingTop: 12, gap: 3 },
    title: { color: colors.text, fontFamily: fonts.bold, fontSize: 15, lineHeight: 20 },
    text: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  }),
);
