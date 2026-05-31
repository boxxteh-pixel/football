import '../global.css';
import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import {
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
  HankenGrotesk_800ExtraBold,
} from '@expo-google-fonts/hanken-grotesk';
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { MaterialIcons } from '@expo/vector-icons';
import { View, Text, LogBox, StyleSheet, Image, Platform, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, runOnJS } from 'react-native-reanimated';
import { useColors} from '@/theme/colors';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useFavoritesStore } from '@/store/favoritesStore';
import { useLearningStore } from '@/store/learningStore';
import { useBetSlipStore } from '@/store/betSlipStore';
import { useCalibrationStore } from '@/store/calibrationStore';
import { withTimeout } from '@/utils/async';

// On Web, react-native-vector-icons needs its CSS stylesheet injected dynamically.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  try {
    const fontAsset = MaterialIcons.font['material-icons'] || MaterialIcons.font.MaterialIcons;
    const fontUrl = typeof fontAsset === 'string' ? fontAsset : (fontAsset?.uri || fontAsset);
    if (fontUrl) {
      const iconFontStyles = `
        @font-face {
          src: url(${fontUrl});
          font-family: MaterialIcons;
        }
      `;
      const style = document.createElement('style');
      style.type = 'text/css';
      if ((style as any).styleSheet) {
        (style as any).styleSheet.cssText = iconFontStyles;
      } else {
        style.appendChild(document.createTextNode(iconFontStyles));
      }
      document.head.appendChild(style);
    }
  } catch (err) {
    console.warn('Failed to inject web icon styles:', err);
  }
}

SplashScreen.preventAutoHideAsync().catch(() => {});

// Suppress warning overlays in development that can freeze touch interactions in Expo Go
LogBox.ignoreAllLogs();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10 * 60 * 1000, // 10 minutes default
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      refetchOnReconnect: true,
    },
  },
});

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'boro_query_cache',
  throttleTime: 1000,
});

export default function RootLayout() {
  const colors = useColors();
  const { width: windowWidth } = useWindowDimensions();
  const [storesReady, setStoresReady] = useState(false);
  const [splashVisible, setSplashVisible] = useState(true);
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const hydrateSettings = useSettingsStore((s) => s.hydrate);
  const hydrateFavorites = useFavoritesStore((s) => s.hydrate);
  const hydrateLearning = useLearningStore((s) => s.hydrate);
  const hydrateBetSlip = useBetSlipStore((s) => s.hydrate);
  const hydrateCalibration = useCalibrationStore((s) => s.hydrate);

  const colorTheme = useSettingsStore((s) => s.settings.colorTheme);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0.9);

  const [fontsLoaded, fontError] = useFonts({
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    HankenGrotesk_800ExtraBold,
    Inter_400Regular,
    Inter_600SemiBold,
    'MaterialIcons': MaterialIcons.font.material,
    'Material Icons': MaterialIcons.font.material,
    ...MaterialIcons.font,
  });

  useEffect(() => {
    (async () => {
      try {
        await withTimeout(hydrateAuth(), 2500, undefined);
        await Promise.allSettled([
          withTimeout(hydrateSettings(), 2500, undefined),
          withTimeout(hydrateFavorites(), 2500, undefined),
          withTimeout(hydrateLearning(), 2500, undefined),
          withTimeout(hydrateBetSlip(), 2500, undefined),
          withTimeout(hydrateCalibration(), 2500, undefined),
        ]);
      } finally {
        setStoresReady(true);
      }
    })();
  }, [hydrateAuth, hydrateSettings, hydrateFavorites, hydrateLearning, hydrateBetSlip, hydrateCalibration]);

  useEffect(() => {
    if (fontError) {
      console.warn('[BORO] Font load issue (using fallback):', fontError);
    }
  }, [fontError]);

  useEffect(() => {
    if ((fontsLoaded || fontError) && storesReady) {
      // Hide the native splash screen immediately
      SplashScreen.hideAsync().catch(() => {});

      // Animate the custom JS splash screen scale
      scale.value = withTiming(1, { duration: 600 });
      
      // Animate opacity
      const opacityTimer = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 400 });
      }, 1000);

      // Dismiss splash screen on JS thread to avoid any thread crossing / callback failure
      const hideTimer = setTimeout(() => {
        setSplashVisible(false);
      }, 1400);

      return () => {
        clearTimeout(opacityTimer);
        clearTimeout(hideTimer);
      };
    }
  }, [fontsLoaded, fontError, storesReady]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if ((!fontsLoaded && !fontError) || !storesReady) {
    return <View style={{ flex: 1, backgroundColor: '#000000' }} />;
  }

  const isDesktop = Platform.OS === 'web' && windowWidth > 768;

  const content = (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="match/[id]"
          options={{ animation: 'slide_from_right', presentation: 'card' }}
        />
        <Stack.Screen name="insights" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="picks" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="favorites" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="settings" options={{ animation: 'slide_from_bottom' }} />
      </Stack>

      {splashVisible && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              ...StyleSheet.absoluteFillObject,
              backgroundColor: '#000000',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 99999,
            },
            animatedStyle,
          ]}
        >
          <Animated.View style={logoAnimatedStyle}>
            <Image
              key={colorTheme}
              source={
                colorTheme === 'purple'
                  ? require('../assets/images/logo2.png')
                  : require('../assets/images/logo.png')
              }
              style={{ width: 120, height: 120 }}
              resizeMode="contain"
            />
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: isDesktop ? '#0c0b0b' : colors.background, overflow: 'hidden' as any }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 }}
        >
          <StatusBar style="light" />

          {isDesktop ? (
            <View style={{ flex: 1, width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
              {/* Ambient Background Glows */}
              <View style={{
                position: 'absolute',
                top: '-10%',
                left: '-5%',
                width: '50%',
                height: '50%',
                borderRadius: 999,
                backgroundColor: colorTheme === 'purple' ? 'rgba(167, 139, 250, 0.06)' : 'rgba(195, 244, 0, 0.04)',
                ...Platform.select({
                  web: {
                    filter: 'blur(100px)',
                    WebkitFilter: 'blur(100px)',
                  } as any
                }),
                pointerEvents: 'none',
              }} />
              <View style={{
                position: 'absolute',
                bottom: '-10%',
                right: '-5%',
                width: '50%',
                height: '50%',
                borderRadius: 999,
                backgroundColor: colorTheme === 'purple' ? 'rgba(139, 92, 246, 0.05)' : 'rgba(195, 244, 0, 0.03)',
                ...Platform.select({
                  web: {
                    filter: 'blur(120px)',
                    WebkitFilter: 'blur(120px)',
                  } as any
                }),
                pointerEvents: 'none',
              }} />

              {/* Mockup Container for Desktop */}
              <View
                style={{
                  width: '100%',
                  maxWidth: 440,
                  height: '92%',
                  maxHeight: 900,
                  borderRadius: 40,
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.08)',
                  backgroundColor: colors.background,
                  ...Platform.select({
                    web: {
                      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
                    } as any
                  }),
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                {content}
              </View>
            </View>
          ) : (
            content
          )}
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
