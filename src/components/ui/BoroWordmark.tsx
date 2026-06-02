import React from 'react';
import { Image, Text, View } from 'react-native';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

interface BoroWordmarkProps {
  colorTheme: 'green' | 'purple';
  subText?: string;
  fontSize?: number;
  logoSize?: number;
}

export const BoroWordmark: React.FC<BoroWordmarkProps> = ({
  colorTheme,
  subText = 'AI',
  fontSize = 22,
  logoSize = 24,
}) => {
  const colors = useColors();
  const logoSource =
    colorTheme === 'purple'
      ? require('../../../assets/images/logo2.png')
      : require('../../../assets/images/logo.png');

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Image source={logoSource} style={{ width: logoSize, height: logoSize }} resizeMode="contain" />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Text
          style={{
            color: colors.onSurface,
            fontFamily: fonts.display,
            fontSize: fontSize,
            letterSpacing: 0,
            lineHeight: fontSize + 4,
          }}
        >
          BORO
        </Text>
        <Text
          style={{
            color: colors.primaryFixed,
            fontFamily: fonts.label,
            fontSize: Math.round(fontSize * 0.55),
            opacity: 0.8,
            marginLeft: 4,
          }}
        >
          {subText}
        </Text>
      </View>
    </View>
  );
};
