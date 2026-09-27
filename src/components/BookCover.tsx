import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { fonts } from '../theme';
export function BookCover({ title, size = 64, large = false }: { title: string; size?: number; large?: boolean }) {
  const palette = ['#D3B88B', '#AFC6BB', '#CBAA99', '#A9B6C8'];
  const color = palette[Array.from(title).reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length];
  return <View style={[s.cover, { width: size, height: size * 1.2, backgroundColor: color, borderRadius: large ? 18 : 9 }]} accessibilityLabel={`Cover for ${title}`}>
    <View style={s.spine} />
    {large ? <Text numberOfLines={3} style={[s.title, { fontSize: size / 9.5 }]}>{title}</Text> : null}
    <Svg width={size * 0.78} height={size * (large ? 0.58 : 0.8)} viewBox="0 0 100 90" style={large ? s.artLarge : s.art}>
      <Circle cx="68" cy="25" r="13" fill="none" stroke="#324B3E" strokeWidth="1" />
      <Path d="M4 72Q25 27 48 61T98 64M4 80Q32 48 54 70T98 73M8 87Q44 69 67 82T96 83" stroke="#324B3E" strokeWidth="1.5" fill="none" />
      <Line x1="49" y1="14" x2="49" y2="36" stroke="#324B3E" strokeWidth="0.6" />
    </Svg>
  </View>;
}
const s = StyleSheet.create({ cover: { overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }, spine: { width: 5, borderRightWidth: 1, borderRightColor: '#00000012', position: 'absolute', left: 4, top: 0, bottom: 0, backgroundColor: '#00000008' }, title: { fontFamily: fonts.display, color: '#233D31', textAlign: 'center', paddingHorizontal: 14, position: 'absolute', top: '13%' }, art: { opacity: 0.8 }, artLarge: { position: 'absolute', bottom: '12%', opacity: 0.8 } });
