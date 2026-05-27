import React from 'react';
import { Text, View } from 'react-native';
import { BoroIcon } from '@/components/ui/BoroIcon';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { GlassCard } from '@/components/ui/GlassCard';
import { useColors} from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useT } from '@/theme/i18n';

interface XgEloBentoProps {
  xgDiff: number;
  eloRating: number;
  eloRank?: number;
  percentile?: number;
}

export const XgEloBento: React.FC<XgEloBentoProps> = ({
  xgDiff,
  eloRating,
  eloRank = 4,
  percentile = 99,
}) => {
  const colors = useColors();
  const t = useT();

  return (
    <View style={{ flexDirection: 'row', gap: 16 }}>
      <GlassCard padding={16} style={{ flex: 1, aspectRatio: 1, justifyContent: 'space-between' }}>
        <View>
          <Text
            style={{
              color: colors.onSurfaceVariant,
              fontFamily: fonts.label,
              fontSize: 10,
              letterSpacing: 0.5,
            }}
          >
            {t('stats.bento.xgDiff')}
          </Text>
          <Text style={{ color: colors.onSurface, fontFamily: fonts.stats, fontSize: 22, marginTop: 4 }}>
            {xgDiff >= 0 ? '+' : ''}
            {xgDiff.toFixed(2)}
          </Text>
        </View>

        <View style={{ height: 56, width: '100%' }}>
          <Svg width="100%" height="100%" viewBox="0 0 100 50">
            <Defs>
              <LinearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={colors.primaryFixed} stopOpacity="0.4" />
                <Stop offset="100%" stopColor={colors.primaryFixed} stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Path
              d="M0,45 Q25,40 40,20 T80,10 T100,5 V50 H0 Z"
              fill="url(#grad1)"
            />
            <Path
              d="M0,45 Q25,40 40,20 T80,10 T100,5"
              fill="none"
              stroke={colors.primaryFixed}
              strokeWidth={2.5}
            />
          </Svg>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <BoroIcon name="trending-up" size={12} color={colors.primaryFixedDim} />
          <Text style={{ color: colors.primaryFixedDim, fontFamily: fonts.label, fontSize: 10 }}>
            {t('stats.bento.aboveAverage')}
          </Text>
        </View>
      </GlassCard>

      <GlassCard
        padding={16}
        style={{ flex: 1, aspectRatio: 1, justifyContent: 'space-between', overflow: 'hidden' }}
      >
        <BoroIcon
          name="language"
          size={72}
          color={colors.onSurfaceVariant}
          style={{ position: 'absolute', right: -8, top: -8, opacity: 0.08 }}
        />
        <View>
          <Text
            style={{
              color: colors.onSurfaceVariant,
              fontFamily: fonts.label,
              fontSize: 10,
              letterSpacing: 0.5,
            }}
          >
            {t('stats.bento.globalElo')}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <Text style={{ color: colors.onSurface, fontFamily: fonts.stats, fontSize: 22 }}>
              {Math.round(eloRating).toLocaleString()}
            </Text>
            <View
              style={{
                backgroundColor: 'rgba(2,102,255,0.2)',
                paddingHorizontal: 6,
                paddingVertical: 1,
                borderRadius: 4,
              }}
            >
              <Text style={{ color: colors.secondaryFixed, fontFamily: fonts.label, fontSize: 9 }}>
                {t('stats.bento.rank')} {eloRank}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 11 }}>
              {t('stats.bento.percentile')}
            </Text>
            <Text style={{ color: colors.onSurface, fontFamily: fonts.body, fontSize: 11 }}>
              {percentile}%
            </Text>
          </View>
          <View
            style={{
              height: 5,
              borderRadius: 9999,
              backgroundColor: colors.surfaceContainer,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${percentile}%`,
                height: '100%',
                backgroundColor: colors.primaryFixed,
              }}
            />
          </View>
        </View>
      </GlassCard>
    </View>
  );
};
