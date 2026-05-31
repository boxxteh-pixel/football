import { Platform } from 'react-native';

/**
 * The native animated driver isn't available on web (RCTAnimation), which logs
 * a noisy warning and falls back to JS anyway. Use this flag so animations opt
 * into the native driver only on native platforms.
 */
export const USE_NATIVE_DRIVER = Platform.OS !== 'web';
