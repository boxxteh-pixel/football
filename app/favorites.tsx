import React from 'react';
import { Text, View } from 'react-native';
import { ScreenContainer } from '@/components/layouts/ScreenContainer';
import { GlassCard } from '@/components/ui/GlassCard';
import { BoroIcon } from '@/components/ui/BoroIcon';
import { Skeleton } from '@/components/ui/Skeleton';
import { MatchListItem } from '@/components/match/MatchListItem';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useFavoritesStore } from '@/store/favoritesStore';
import { useT } from '@/theme/i18n';
import { useFixture } from '@/hooks/useFixtures';

export default function FavoritesScreen() {
  const colors = useColors();
  const t = useT();
  const favorites = useFavoritesStore();

  const favoriteMatchesCount = favorites.fixtures.length;

  return (
    <ScreenContainer showBack title={t('favorites.title')}>
      <View style={{ gap: 20, paddingTop: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 26, letterSpacing: -0.5 }}>
            {t('favorites.title')}
          </Text>
          {favoriteMatchesCount > 0 && (
            <View
              style={{
                backgroundColor: colors.accent12,
                borderRadius: 8,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderWidth: 1,
                borderColor: colors.accent30,
              }}
            >
              <Text style={{ color: colors.primaryFixed, fontFamily: fonts.label, fontSize: 11, fontWeight: 'bold' }}>
                {favoriteMatchesCount} {favoriteMatchesCount === 1 ? t('match.result').toLowerCase() : 'matches'}
              </Text>
            </View>
          )}
        </View>

        {favorites.fixtures.length === 0 ? (
          <EmptyFavoritesState
            icon="sports-soccer"
            title={t('favorites.empty')}
            subtitle={t('favorites.emptySub')}
          />
        ) : (
          <View style={{ gap: 4 }}>
            {favorites.fixtures.map((id) => (
              <FavoriteMatchItem key={id} id={id} />
            ))}
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}

const FavoriteMatchItem: React.FC<{ id: number }> = ({ id }) => {
  const { data: fixture, isLoading } = useFixture(id);

  if (isLoading) {
    return <Skeleton height={84} radius={12} style={{ marginBottom: 10 }} />;
  }

  if (!fixture) return null;

  return <MatchListItem fixture={fixture} />;
};

interface EmptyFavoritesStateProps {
  icon: string;
  title: string;
  subtitle: string;
}

const EmptyFavoritesState: React.FC<EmptyFavoritesStateProps> = ({ icon, title, subtitle }) => {
  const colors = useColors();
  return (
    <GlassCard padding={32} style={{ alignItems: 'center', gap: 16, marginTop: 12 }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.06)',
        }}
      >
        <BoroIcon name={icon} size={32} color={colors.onSurfaceVariant} />
      </View>
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 18, textAlign: 'center' }}>
          {title}
        </Text>
        <Text
          style={{
            color: colors.onSurfaceVariant,
            fontFamily: fonts.body,
            fontSize: 13,
            textAlign: 'center',
            paddingHorizontal: 16,
            lineHeight: 19,
          }}
        >
          {subtitle}
        </Text>
      </View>
    </GlassCard>
  );
};
