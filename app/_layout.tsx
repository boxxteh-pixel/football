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
import { Inter_400Regular, Inter_600SemiBold, useFonts } from '@expo-google-fonts/inter';
import { View, Text, LogBox, StyleSheet, Image } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, runOnJS } from 'react-native-reanimated';
import { useColors} from '@/theme/colors';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useFavoritesStore } from '@/store/favoritesStore';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Suppress warning overlays in development that can freeze touch interactions in Expo Go
LogBox.ignoreAllLogs();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
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
  const [storesReady, setStoresReady] = useState(false);
  const [splashVisible, setSplashVisible] = useState(true);
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const hydrateSettings = useSettingsStore((s) => s.hydrate);
  const hydrateFavorites = useFavoritesStore((s) => s.hydrate);

  const colorTheme = useSettingsStore((s) => s.settings.colorTheme);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0.9);

  const [fontsLoaded, fontError] = useFonts({
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    HankenGrotesk_800ExtraBold,
    Inter_400Regular,
    Inter_600SemiBold,
  });

  useEffect(() => {
    (async () => {
      await Promise.all([hydrateAuth(), hydrateSettings(), hydrateFavorites()]);
      setStoresReady(true);
    })();
  }, [hydrateAuth, hydrateSettings, hydrateFavorites]);

  useEffect(() => {
    if ((fontsLoaded || fontError) && storesReady) {
      // Hide the native splash screen immediately
      SplashScreen.hideAsync().catch(() => {});

      // Animate the custom JS splash screen
      scale.value = withTiming(1, { duration: 600 });
      const timer = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 400 }, (finished) => {
          if (finished) {
            runOnJS(setSplashVisible)(false);
          }
        });
      }, 1000);

      return () => clearTimeout(timer);
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

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 }}
        >
          <StatusBar style="light" />
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
              <Stack.Screen name="settings" options={{ animation: 'slide_from_bottom' }} />
            </Stack>

            {splashVisible && (
              <Animated.View
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
                <Animated.View
                  style={[
                    {
                      width: 168,
                      height: 168,
                      borderRadius: 84,
                      borderWidth: 1,
                      borderColor: colorTheme === 'purple' ? 'rgba(167,139,250,0.2)' : 'rgba(195,244,0,0.2)',
                      backgroundColor: colorTheme === 'purple' ? 'rgba(167,139,250,0.04)' : 'rgba(195,244,0,0.04)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    },
                    logoAnimatedStyle,
                  ]}
                >
                  <Image
                    source={
                      colorTheme === 'purple'
                        ? require('../assets/images/logo2.png')
                        : require('../assets/images/logo.png')
                    }
                    style={{ width: 140, height: 140 }}
                    resizeMode="contain"
                  />
                </Animated.View>
              </Animated.View>
            )}
          </View>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
