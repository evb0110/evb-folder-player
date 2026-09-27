import { createContext, useContext, useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';

interface IFrameSize {
  width: number;
  height: number;
}

const FrameContext = createContext<IFrameSize>({ width: 0, height: 0 });

/**
 * Measures the app's own frame. Screens choose portrait or landscape layouts from it rather
 * than from the window, which on a desktop browser is far larger than the phone-sized app.
 */
export function Frame({ style, children }: { style: StyleProp<ViewStyle>; children: ReactNode }) {
  const [size, setSize] = useState<IFrameSize>({ width: 0, height: 0 });
  const measure = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize(current => (current.width === width && current.height === height ? current : { width, height }));
  };
  return (
    <View style={style} onLayout={measure}>
      <FrameContext.Provider value={size}>{children}</FrameContext.Provider>
    </View>
  );
}

export function useLandscape() {
  const { width, height } = useContext(FrameContext);
  return width > height;
}
