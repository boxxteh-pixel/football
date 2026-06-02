import React from 'react';
import { ScrollView, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors} from '@/theme/colors';
import { useResponsive } from '@/hooks/useResponsive';
import { TopBar } from './TopBar';
import { ScreenBackground } from './ScreenBackground';

interface ScreenContainerProps extends ScrollViewProps {
  title?: string;
  showBack?: boolean;
  showLive?: boolean;
  scroll?: boolean;
  bottomSafe?: boolean;
  topBar?: boolean;
  rightSlot?: React.ReactNode;
  hideAvatar?: boolean;
  /** Override the desktop content max-width (defaults to the responsive value). */
  maxWidth?: number;
  children?: React.ReactNode;
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({
  title,
  showBack,
  showLive,
  scroll = true,
  bottomSafe = true,
  topBar = true,
  rightSlot,
  hideAvatar,
  maxWidth,
  children,
  contentContainerStyle,
  ...rest
}) => {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isDesktop, contentMaxWidth } = useResponsive();

  // On desktop the persistent sidebar owns global nav + account, so the TopBar
  // is only kept for sub-pages that need a back affordance.
  const showTopBar = topBar && !(isDesktop && !showBack);
  const maxW = maxWidth ?? contentMaxWidth;

  const paddingTop = showTopBar ? 16 : isDesktop ? 42 : insets.top + 16;
  const paddingBottom = bottomSafe ? insets.bottom + 24 : 16;
  const paddingHorizontal = isDesktop ? 44 : 16;
  const shouldHideAvatar = hideAvatar ?? showBack;

  const topBarNode = showTopBar ? (
    <TopBar title={title} showBack={showBack} showLive={showLive} rightSlot={rightSlot} hideAvatar={shouldHideAvatar} />
  ) : null;

  // Center content within a comfortable reading column on desktop.
  const innerWrapper = (node: React.ReactNode) =>
    isDesktop ? (
      <View style={{ width: '100%', maxWidth: maxW, alignSelf: 'center' }}>{node}</View>
    ) : (
      node
    );

  if (scroll) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenBackground />
        {topBarNode}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            {
              paddingTop,
              paddingBottom,
              paddingHorizontal,
              alignItems: isDesktop ? 'center' : 'stretch',
            },
            contentContainerStyle,
          ]}
          {...rest}
        >
          {innerWrapper(children)}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenBackground />
      {topBarNode}
      <View style={{ flex: 1, paddingTop, paddingBottom, paddingHorizontal, alignItems: isDesktop ? 'center' : 'stretch' }}>
        <View style={{ flex: 1, width: '100%', maxWidth: isDesktop ? maxW : undefined }}>{children}</View>
      </View>
    </View>
  );
};
