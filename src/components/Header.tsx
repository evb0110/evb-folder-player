import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createThemedStyles, fonts, touch } from '../theme';

/** Height of every screen's top bar, so controls do not move when switching screens. */
export const HEADER_HEIGHT = touch.button + 8;

interface IProps {
  /** Usually a back or close button. */
  left?: ReactNode;
  title?: string;
  /** Centered between the side slots, e.g. the Listen/Chapters switch. */
  center?: ReactNode;
  right?: ReactNode;
}

/**
 * Shared top bar. Buttons sit in fixed slots at the same inset on every screen,
 * so a back button and a close button occupy exactly the same spot.
 */
export function Header({ left, title, center, right }: IProps) {
  const s = useStyles();
  return (
    <View style={s.bar}>
      <View style={s.side}>
        {left}
        {title ? <Text style={[s.title, !left && s.titleAlone]}>{title}</Text> : null}
      </View>
      {center ? <View style={s.center}>{center}</View> : null}
      <View style={[s.side, s.right]}>{right}</View>
    </View>
  );
}

const useStyles = createThemedStyles(colors =>
  StyleSheet.create({
    bar: {
      height: HEADER_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
    },
    side: { flexDirection: 'row', alignItems: 'center', minWidth: touch.button },
    right: { justifyContent: 'flex-end' },
    center: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'box-none',
    },
    title: { fontFamily: fonts.display, fontSize: 28, color: colors.text },
    // Without a button in front, the title lines up with the 20 px content inset.
    titleAlone: { marginLeft: 16 },
  }),
);
