import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { BoroIcon } from '@/components/ui/BoroIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AmbientOrb } from '@/components/ui/AmbientOrb';
import { NeonButton } from '@/components/ui/NeonButton';
import { GlassCard } from '@/components/ui/GlassCard';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useFavoritesStore } from '@/store/favoritesStore';
import { useHaptics } from '@/hooks/useHaptics';
import { useT } from '@/theme/i18n';

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const logIn = useAuthStore((s) => s.logIn);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const colorTheme = useSettingsStore((s) => s.settings.colorTheme);

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const t = useT();

  const submit = async () => {
    try {
      await logIn({ name, password });
      await Promise.all([
        useSettingsStore.getState().hydrate(),
        useFavoritesStore.getState().hydrate()
      ]);
      haptics.success();
      router.replace('/(tabs)');
    } catch {
      haptics.error();
    }
  };

  const fieldText = {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    color: colors.onSurface,
    fontFamily: fonts.body,
    fontSize: 15,
  };

  const logoSource = colorTheme === 'purple'
    ? require('../../assets/images/logo2.png')
    : require('../../assets/images/logo.png');

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 24,
          flexGrow: 1,
        }}
      >
        <AmbientOrb top={-60} left={-60} opacity={0.35} />

        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={{ alignSelf: 'flex-start', marginBottom: 24 }}
        >
          <BoroIcon name="arrow-back" size={26} color={colors.primaryFixed} />
        </Pressable>

        <View style={{ alignItems: 'center', marginBottom: 28, gap: 16 }}>
          <Image
            key={colorTheme}
            source={logoSource}
            style={{ width: 80, height: 80 }}
            resizeMode="contain"
          />
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 28, letterSpacing: -0.5 }}>
              {t('auth.welcomeBack')}
            </Text>
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 14 }}>
              {t('auth.loginSub')}
            </Text>
          </View>
        </View>

        <GlassCard padding={24} style={{ gap: 20 }}>
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 11, letterSpacing: 1 }}>
              {t('auth.name')}
            </Text>
            <View style={fieldShell}>
              <BoroIcon name="person-outline" size={20} color={colors.onSurfaceVariant} />
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Enter your username"
                placeholderTextColor="rgba(196,201,172,0.5)"
                autoCapitalize="none"
                style={fieldText}
              />
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 11, letterSpacing: 1 }}>
              {t('auth.password')}
            </Text>
            <View style={fieldShell}>
              <BoroIcon name="lock-outline" size={20} color={colors.onSurfaceVariant} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="rgba(196,201,172,0.5)"
                secureTextEntry={!showPwd}
                style={fieldText}
              />
              <Pressable onPress={() => setShowPwd((v) => !v)} hitSlop={10}>
                <BoroIcon
                  name={showPwd ? 'visibility-off' : 'visibility'}
                  size={20}
                  color={colors.onSurfaceVariant}
                />
              </Pressable>
            </View>
          </View>

          {error ? (
            <View
              style={{
                backgroundColor: 'rgba(255,180,171,0.1)',
                padding: 10,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: 'rgba(255,180,171,0.3)',
              }}
            >
              <Text style={{ color: colors.error, fontFamily: fonts.body, fontSize: 13 }}>{error}</Text>
            </View>
          ) : null}

          <View style={{ height: 8 }} />

          <NeonButton
            label={t('auth.login')}
            iconRight="arrow-forward"
            onPress={submit}
            loading={loading}
            disabled={!name || !password}
          />
        </GlassCard>

        <Pressable
          onPress={() => router.replace('/(auth)/signup')}
          hitSlop={8}
          style={{ alignSelf: 'center', marginTop: 28 }}
        >
          <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 14 }}>
            {t('auth.newHere')}{' '}
            <Text style={{ color: colors.primaryFixed, fontFamily: fonts.bodyBold }}>
              {t('auth.createAccount')}
            </Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const fieldShell = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  backgroundColor: 'rgba(255,255,255,0.04)',
  borderRadius: 10,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.08)',
  paddingHorizontal: 12,
};
