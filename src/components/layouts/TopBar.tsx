import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useColors} from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { LivePulse } from '@/components/ui/LivePulse';
import { AvatarMenu } from '@/components/ui/AvatarMenu';

interface TopBarProps {
  title?: string;
  showBack?: boolean;
  showLive?: boolean;
  rightSlot?: React.ReactNode;
}

export const TopBar: React.FC<TopBarProps> = ({
  title = 'BORO AI',
  showBack = false,
  showLive = false,
  rightSlot,
}) => {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: 'rgba(19,19,19,0.5)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.08)',
      }}
    >
      {Platform.OS !== 'web' && (
        <BlurView
          intensity={30}
          tint="dark"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      )}
      <View
        style={{
          height: 56,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {showBack ? (
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <MaterialIcons name="arrow-back" size={26} color={colors.primaryFixed} />
            </Pressable>
          ) : null}
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: 22,
              letterSpacing: -0.5,
              color: colors.primaryFixed,
            }}
          >
            {title}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {showLive && <LivePulse label="" />}
          {rightSlot ?? <AvatarMenu />}
        </View>
      </View>
    </View>
  );
};
