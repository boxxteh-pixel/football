import React, { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
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

  return (
    <View
      style={{
        position: 'relative',
        backgroundColor: 'rgba(28,27,27,0.6)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: focused ? colors.glassBorderActive : 'rgba(255,255,255,0.08)',
      }}
    >
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
