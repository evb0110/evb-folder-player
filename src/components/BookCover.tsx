import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { fonts } from '../theme';

const palette = ['#D3B88B', '#AFC6BB', '#CBAA99', '#A9B6C8'];
const ink = '#324B3E';

/** A stable color per title, so each book keeps its cover across sessions. */
function coverColor(title: string) {
  const sum = Array.from(title).reduce((total, char) => total + char.charCodeAt(0), 0);
  return palette[sum % palette.length];
}

interface IProps {
  title: string;
  size?: number;
  /** Large covers print the title and use rounder corners. */
  large?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function BookCover({ title, size = 64, large = false, style }: IProps) {
  return (
    <View
      accessible={false}
      style={[
        s.cover,
        { width: size, height: size * 1.2, backgroundColor: coverColor(title), borderRadius: large ? 18 : 9 },
        style,
      ]}
    >
      <View style={s.spine} />
      {large ? (
        <Text numberOfLines={3} style={[s.title, { fontSize: size / 9.5 }]}>
          {title}
        </Text>
      ) : null}
      <Svg
        width={size * 0.78}
        height={size * (large ? 0.58 : 0.8)}
        viewBox="0 0 100 90"
        style={large ? s.artLarge : s.art}
      >
        <Circle cx="68" cy="25" r="13" fill="none" stroke={ink} strokeWidth="1" />
        <Path
          d="M4 72Q25 27 48 61T98 64M4 80Q32 48 54 70T98 73M8 87Q44 69 67 82T96 83"
          stroke={ink}
          strokeWidth="1.5"
          fill="none"
        />
        <Line x1="49" y1="14" x2="49" y2="36" stroke={ink} strokeWidth="0.6" />
      </Svg>
    </View>
  );
}

const s = StyleSheet.create({
  cover: { overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  spine: {
    position: 'absolute',
    left: 4,
    top: 0,
    bottom: 0,
    width: 5,
    borderRightWidth: 1,
    borderRightColor: '#00000012',
    backgroundColor: '#00000008',
  },
  title: {
    position: 'absolute',
    top: '13%',
    paddingHorizontal: 14,
    fontFamily: fonts.display,
    color: '#233D31',
    textAlign: 'center',
  },
  art: { opacity: 0.8 },
  artLarge: { position: 'absolute', bottom: '12%', opacity: 0.8 },
});
