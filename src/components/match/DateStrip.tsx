/**
 * Horizontal date picker strip for browsing past match days.
 * Shows the last `count` days (most recent right-most), highlighting the
 * selected one. "Recent" pill (null date) shows the rolling multi-day view.
 */
import React from 'react';
import { Pressable, ScrollView, Text, View, Platform } from 'react-native';
import { format, subDays } from 'date-fns';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useHaptics } from '@/hooks/useHaptics';
import { dateIso } from '@/utils/date';
import { useT } from '@/theme/i18n';

interface DateStripProps {
  selected: string | null; // null = "recent" rolling view
  onSelect: (date: string | null) => void;
  count?: number;
}

export const DateStrip: React.FC<DateStripProps> = ({ selected, onSelect, count = 14 }) => {
  const colors = useColors();
  const haptics = useHaptics();
  const t = useT();

  const days = Array.from({ length: count }, (_, i) => subDays(new Date(), i)).reverse();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={Platform.OS === 'web'}
      contentContainerStyle={{ gap: 8, paddingRight: 16 }}
    >
      {/* Recent rolling view */}
      <Pressable
        onPress={() => {
          haptics.light();
          onSelect(null);
        }}
        style={{
          paddingHorizontal: 14,
          height: 56,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: selected === null ? colors.primaryFixed : 'rgba(255,255,255,0.05)',
          borderWidth: 1,
          borderColor: selected === null ? colors.primaryFixed : 'rgba(255,255,255,0.1)',
        }}
      >
        <Text
          style={{
            color: selected === null ? colors.onPrimaryFixed : colors.onSurface,
            fontFamily: fonts.bodyBold,
            fontSize: 12,
          }}
        >
          {t('results.recentTab')}
        </Text>
      </Pressable>

      {days.map((d) => {
        const iso = dateIso(d);
        const active = selected === iso;
        return (
          <Pressable
            key={iso}
            onPress={() => {
              haptics.light();
              onSelect(iso);
            }}
            style={{
              width: 52,
              height: 56,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              backgroundColor: active ? colors.primaryFixed : 'rgba(255,255,255,0.05)',
              borderWidth: 1,
              borderColor: active ? colors.primaryFixed : 'rgba(255,255,255,0.1)',
            }}
          >
            <Text
              style={{
                color: active ? colors.onPrimaryFixed : colors.onSurfaceVariant,
                fontFamily: fonts.label,
                fontSize: 9,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}
            >
              {format(d, 'EEE')}
            </Text>
            <Text
              style={{
                color: active ? colors.onPrimaryFixed : colors.onSurface,
                fontFamily: fonts.stats,
                fontSize: 16,
              }}
            >
              {format(d, 'd')}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};
