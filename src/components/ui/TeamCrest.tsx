import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useColors} from '@/theme/colors';

interface TeamCrestProps {
  uri?: string | null;
  size?: number;
  glow?: boolean;
}

export const TeamCrest: React.FC<TeamCrestProps> = ({ uri, size = 48, glow = false }) => {
  const colors = useColors();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1,
        borderColor: glow ? colors.accent30 : 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(255,255,255,0.04)',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        padding: size * 0.12,
      }}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={150}
        />
      ) : (
        <MaterialIcons name="sports-soccer" size={size * 0.55} color={colors.onSurfaceVariant} />
      )}
    </View>
  );
};
