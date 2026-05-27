import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
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

export default function SignUpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const signUp = useAuthStore((s) => s.signUp);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);
  const colorTheme = useSettingsStore((s) => s.settings.colorTheme);

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const t = useT();

  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = !!name && password.length >= 6 && password === confirm;

  const submit = async () => {
    if (password !== confirm) {
      setLocalError('Passwords do not match.');
      haptics.error();
      return;
    }
    setLocalError(null);
    try {
      await signUp({ name, password });
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
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={{ alignSelf: 'flex-start', marginBottom: 24 }}
        >
          <BoroIcon name="arrow-back" size={26} color={colors.primaryFixed} />
        </Pressable>

        <View style={{ alignItems: 'center', marginBottom: 24, gap: 16 }}>
          <Image
            key={colorTheme}
            source={logoSource}
            style={{ width: 72, height: 72 }}
            resizeMode="contain"
          />
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Text
              style={{
                color: colors.primaryFixed,
                fontFamily: fonts.display,
                fontSize: 28,
                letterSpacing: -0.6,
              }}
            >
              {t('auth.createAccount')}
            </Text>
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 14, textAlign: 'center' }}>
              {t('auth.signupSub')}
            </Text>
          </View>
        </View>

        <GlassCard padding={20} style={{ gap: 18 }}>
          <FormField
            label={t('auth.name') || 'Username'}
            value={name}
            onChangeText={(v) => {
              clearError();
              setLocalError(null);
              setName(v);
            }}
            placeholder="Choose a username"
            icon="person"
          />
          <FormField
            label={t('auth.password') || 'Password'}
            value={password}
            onChangeText={(v) => {
              clearError();
              setLocalError(null);
              setPassword(v);
            }}
            placeholder="At least 6 characters"
            secureTextEntry={!showPwd}
            icon="lock"
            trailingIcon={showPwd ? 'visibility-off' : 'visibility'}
            onTrailingPress={() => setShowPwd((v) => !v)}
          />
          <FormField
            label="CONFIRM PASSWORD"
            value={confirm}
            onChangeText={(v) => {
              clearError();
              setLocalError(null);
              setConfirm(v);
            }}
            placeholder="Re-enter password"
            secureTextEntry={!showPwd}
            icon="lock-outline"
            error={mismatch ? 'Passwords do not match' : undefined}
          />

          {(error || localError) ? (
            <View
              style={{
                backgroundColor: 'rgba(255,180,171,0.1)',
                padding: 10,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: 'rgba(255,180,171,0.3)',
              }}
            >
              <Text style={{ color: colors.error, fontFamily: fonts.body, fontSize: 13 }}>
                {error || localError}
              </Text>
            </View>
          ) : null}

          <View style={{ height: 8 }} />

          <NeonButton
            label={t('auth.createAccount')}
            iconRight="arrow-forward"
            onPress={submit}
            loading={loading}
            disabled={!canSubmit}
          />
        </GlassCard>

        <Pressable
          onPress={() => router.replace('/(auth)/login')}
          hitSlop={8}
          style={{ alignSelf: 'center', marginTop: 28 }}
        >
          <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 14 }}>
            {t('auth.haveAccount') || 'Already have an account?'}{' '}
            <Text style={{ color: colors.primaryFixed, fontFamily: fonts.bodyBold }}>
              {t('auth.login')}
            </Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

interface FormFieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences';
  icon: string;
  trailingIcon?: string;
  onTrailingPress?: () => void;
  error?: string;
}

const FormField: React.FC<FormFieldProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  icon,
  trailingIcon,
  onTrailingPress,
  error,
}) => {
  const colors = useColors();
  return (
    <View style={{ gap: 6 }}>
      <Text
        style={{
          color: colors.onSurfaceVariant,
          fontFamily: fonts.label,
          fontSize: 11,
          letterSpacing: 0.6,
        }}
      >
        {label.toUpperCase()}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderRadius: 10,
          borderWidth: 1,
          borderColor: error ? 'rgba(255,180,171,0.5)' : 'rgba(255,255,255,0.08)',
          paddingHorizontal: 12,
        }}
      >
        <BoroIcon name={icon} size={18} color={colors.onSurfaceVariant} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="rgba(196,201,172,0.5)"
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          style={{
            flex: 1,
            paddingVertical: 12,
            paddingHorizontal: 10,
            color: colors.onSurface,
            fontFamily: fonts.body,
            fontSize: 15,
          }}
        />
        {trailingIcon ? (
          <Pressable onPress={onTrailingPress} hitSlop={10}>
            <BoroIcon name={trailingIcon} size={20} color={colors.onSurfaceVariant} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={{ color: colors.error, fontFamily: fonts.body, fontSize: 12, marginTop: 2 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
};
