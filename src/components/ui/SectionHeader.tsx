import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { BoroIcon } from '@/components/ui/BoroIcon';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

interface SectionHeaderProps {
  title: string;
  /** Small uppercase eyebrow label shown above the title. */
  eyebrow?: string;
  /** Optional right-aligned slot (e.g. a live badge or counter). */
  right?: React.ReactNode;
  /** Optional "see all" style action. */
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Editorial section header with a slim accent bar, an optional uppercase
 * eyebrow, and an optional right slot / text action. Used to give every screen
 * a consistent, premium rhythm without relying on glow effects.
 */
export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  eyebrow,
  right,
  actionLabel,
  onAction,
}) => {
  const colors = useColors();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
        <View
          style={{
            width: 4,
            height: 22,
            borderRadius: 2,
            backgroundColor: colors.primaryFixed,
          }}
        />
        <View style={{ flex: 1, gap: 2 }}>
          {eyebrow ? (
            <Text
              style={{
                color: colors.onSurfaceVariant,
                fontFamily: fonts.label,
                fontSize: 10,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
              }}
            >
              {eyebrow}
            </Text>
          ) : null}
          <Text
            style={{
              color: colors.onSurface,
              fontFamily: fonts.headline,
              fontSize: 21,
              letterSpacing: -0.4,
            }}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
      </View>

      {right}

      {actionLabel ? (
        <Pressable
          onPress={onAction}
          hitSlop={8}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 2,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text
            style={{
              color: colors.primaryFixed,
              fontFamily: fonts.label,
              fontSize: 12,
            }}
          >
            {actionLabel}
          </Text>
          <BoroIcon name="chevron-right" size={16} color={colors.primaryFixed} />
        </Pressable>
      ) : null}
    </View>
  );
};
