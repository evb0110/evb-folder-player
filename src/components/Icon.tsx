import { Platform } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

const paths = {
  play: 'M8 4L20 12L8 20Z',
  pause: 'M7 5v14M17 5v14',
  folder: 'M3 7V5a1 1 0 0 1 1-1h5l3 3h8a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z',
  car: 'M3 13l2-7h14l2 7M3 13h18v6H3ZM6 19v2M18 19v2M6 16h1M17 16h1',
  back: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  plus: 'M12 5v14M5 12h14',
  history: 'M3 4v6h6M3 10a9 9 0 1 1 1 8M12 7v5l3 2',
  bookmark: 'M6 3h12v18l-6-4-6 4Z',
  undo: 'M8 5L3 10l5 5M3 10h11a6 6 0 0 1 6 6v3',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l4 4L19 6',
  refresh: 'M20 4v6h-6M20 10a8 8 0 1 0-1 8',
  search: 'M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  clock: 'M12 7v5l3 2',
  theme: 'M12 3v18',
  screen: 'M9 3h6a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM11 18h2',
  screenOn:
    'M9 3h6a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM11 18h2M4.5 8 2.5 7M4.5 12h-2M4.5 16l-2 1M19.5 8l2-1M19.5 12h2M19.5 16l2 1',
  rewind: 'M4 12a8 8 0 1 0 8-8h-1M13.5 1.5 11 4l2.5 2.5',
  forward: 'M20 12a8 8 0 1 1-8-8h1M10.5 1.5 13 4l-2.5 2.5',
  volume: 'M3 9h4l5-4v14l-5-4H3ZM16 8a6 6 0 0 1 0 8M19 5a10 10 0 0 1 0 14',
};

export type TIcon = keyof typeof paths;

/** Icons with an extra circle drawn under the path. */
const circles: Partial<Record<TIcon, number>> = { clock: 9, theme: 9 };

/** Solid shapes drawn in the icon color: the dark half of the theme (contrast) icon. */
const solids: Partial<Record<TIcon, string>> = { theme: 'M12 3a9 9 0 0 1 0 18Z' };

const hidden = Platform.OS === 'web' ? { 'aria-hidden': true } : { accessible: false };

interface IIconProps {
  name: TIcon;
  size?: number;
  color?: string;
  /** Fills the play triangle; other icons are outlines. */
  filled?: boolean;
}

export function Icon({ name, size = 24, color = 'currentColor', filled = false }: IIconProps) {
  const radius = circles[name];
  const solid = solids[name];
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={name === 'pause' ? 4 : 1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...hidden}
    >
      {radius ? <Circle cx="12" cy="12" r={radius} /> : null}
      {solid ? <Path d={solid} fill={color} /> : null}
      <Path d={paths[name]} fill={filled && name === 'play' ? color : 'none'} />
    </Svg>
  );
}
