import React, { useState } from 'react';
import { Platform, TextInput, View, StyleSheet, type TextInputProps, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { BoroIcon } from '@/components/ui/BoroIcon';
import { useColors} from '@/theme/colors';
import { fonts } from '@/theme/typography';

interface SearchBarProps extends Omit<TextInputProps, 'style'> {
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = 'Search leagues or teams…',
  value,
  onChangeText,
  ...rest
}) => {
  const colors = useColors();
  const [focused, setFocused] = useState(false);
  const isWeb = Platform.OS === 'web';
  const bg = isWeb ? 'rgba(28,27,26,0.45)' : 'rgba(28,27,26,0.32)';

  return (
    <View
      style={{
        position: 'relative',
        backgroundColor: bg,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: focused ? colors.glassBorderActive : 'rgba(255,255,255,0.14)',
        overflow: 'hidden',
        ...(isWeb
          ? ({
              backdropFilter: 'blur(24px) saturate(180%) brightness(1.05)',
              WebkitBackdropFilter: 'blur(24px) saturate(180%) brightness(1.05)',
            } as unknown as ViewStyle)
          : {}),
      }}
    >
      {Platform.OS !== 'web' && (
        <BlurView
          intensity={70}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Diagonal sheen gradient */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.03)', 'transparent']}
        locations={[0, 0.35, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Bright top hairline highlight */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: 'rgba(255,255,255,0.25)',
        }}
      />
      <BoroIcon
        name="search"
        size={20}
        color={colors.onSurfaceVariant}
        style={{ position: 'absolute', left: 14, top: 14, zIndex: 1 }}
      />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={colors.onSurfaceVariant}
        style={{
          paddingVertical: 12,
          paddingLeft: 44,
          paddingRight: 16,
          color: colors.onSurface,
          fontFamily: fonts.body,
          fontSize: 16,
        }}
        {...rest}
      />
    </View>
  );
};
