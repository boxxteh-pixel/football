import React from 'react';
import { ScrollView, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors} from '@/theme/colors';
import { TopBar } from './TopBar';

interface ScreenContainerProps extends ScrollViewProps {
  title?: string;
  showBack?: boolean;
  showLive?: boolean;
  scroll?: boolean;
  bottomSafe?: boolean;
  topBar?: boolean;
  children?: React.ReactNode;
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({
  title,
  showBack,
  showLive,
  scroll = true,
  bottomSafe = true,
  topBar = true,
  children,
  contentContainerStyle,
  ...rest
}) => {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const paddingTop = topBar ? 16 : insets.top + 16;
  const paddingBottom = bottomSafe ? insets.bottom + 24 : 16;

  if (scroll) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {topBar && <TopBar title={title} showBack={showBack} showLive={showLive} />}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            {
              paddingTop,
              paddingBottom,
              paddingHorizontal: 16,
            },
            contentContainerStyle,
          ]}
          {...rest}
        >
          {children}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {topBar && <TopBar title={title} showBack={showBack} showLive={showLive} />}
      <View style={{ flex: 1, paddingTop, paddingBottom, paddingHorizontal: 16 }}>{children}</View>
    </View>
  );
};
