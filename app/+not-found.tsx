import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { BoroIcon } from '@/components/ui/BoroIcon';
import { useColors} from '@/theme/colors';
import { fonts } from '@/theme/typography';

export default function NotFoundScreen() {
  const colors = useColors();
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
          padding: 24,
          gap: 16,
        }}
      >
        <BoroIcon name="search-off" size={64} color={colors.primaryFixed} />
        <Text style={{ color: colors.onSurface, fontFamily: fonts.display, fontSize: 28 }}>404</Text>
        <Text
          style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 14, textAlign: 'center' }}
        >
          We couldn't find that screen.
        </Text>
        <Link href="/" style={{ marginTop: 16, color: colors.primaryFixed, fontFamily: fonts.bodyBold }}>
          Back to home
        </Link>
      </View>
    </>
  );
}
