import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  FlatList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BoroIcon } from '@/components/ui/BoroIcon';
import { ScreenContainer } from '@/components/layouts/ScreenContainer';
import { GlassCard } from '@/components/ui/GlassCard';
import { useResponsive } from '@/hooks/useResponsive';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useHaptics } from '@/hooks/useHaptics';

const CHAT_STORAGE_KEY = 'boro_community_chat_v1';
const MAX_MESSAGES = 50;

interface ChatMessage {
  id: string;
  senderName: string;
  text: string;
  timestamp: string;
  avatarInitial: string;
  color: string;
  isSelf: boolean;
}

const FAN_NAMES = [
  'IlBomber_9', 'CurvaNord_Bari', 'ForzaNapoli_90', 'Gialloblu_Verona', 'DerbyKing',
  'Milanista_DOC', 'Interista1908', 'JuveFanatic', 'RomanistaInside', 'LazioPride'
];

const FAN_MESSAGES = [
  'Avete visto il pronostico dell\'AI sulla partita di stasera? Quota interessante.',
  'Secondo me la doppia chance 1X per il big match è regalata.',
  'Ma la simulazione Monte Carlo dà l\'Over 2.5 all\'80%, speriamo bene!',
  'Bello il nuovo effetto a vetro temperato dell\'app, molto premium.',
  'Qualcuno segue la Serie B oggi? Consigli?',
  'Gol all\'ultimo minuto! Mamma mia che tensione, pronostico salvato!',
  'Secondo me l\'arbitro di oggi fischia un sacco di rigori, occhio alla media cartellini.',
  'Ho creato una multipla a quota 5.2 con l\'AI Acca, speriamo di fare cassa!',
  'L\'assistente tattico AI mi consiglia la vittoria in casa per gli xG alti.',
  'Buona giornata a tutti i tifosi, oggi si vola con BORO AI!'
];

export default function CommunityChatScreen() {
  const colors = useColors();
  const haptics = useHaptics();
  const { isDesktop } = useResponsive();
  const session = useAuthStore((s) => s.session);
  const colorTheme = useSettingsStore((s) => s.settings.colorTheme);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [nickname, setNickname] = useState('');
  const [hasSetNickname, setHasSetNickname] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Resolve current username
  const currentUserName = useMemo(() => {
    if (session?.user?.name) return session.user.name;
    if (nickname) return nickname;
    return 'Guest';
  }, [session, nickname]);

  // Load messages from AsyncStorage on mount
  useEffect(() => {
    const loadChat = async () => {
      try {
        const raw = await AsyncStorage.getItem(CHAT_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as ChatMessage[];
          // Update isSelf flags based on currentUserName
          const updated = parsed.map(msg => ({
            ...msg,
            isSelf: msg.senderName === currentUserName
          }));
          setMessages(updated);
        } else {
          // Default starting messages
          const defaultMsgs: ChatMessage[] = [
            {
              id: 'init-1',
              senderName: 'BORO AI BOT',
              text: 'Benvenuti nella chat globale di BORO AI! Qui potete confrontarvi sulle quote, i pronostici e le gare del giorno.',
              timestamp: new Date().toISOString(),
              avatarInitial: '🤖',
              color: colors.primaryFixed,
              isSelf: false
            }
          ];
          setMessages(defaultMsgs);
          await AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(defaultMsgs));
        }
      } catch (err) {
        console.warn('Failed to load chat messages:', err);
      }
    };

    loadChat();

    // Check if user has session or cached nick
    if (session?.user?.name) {
      setHasSetNickname(true);
    } else {
      AsyncStorage.getItem('boro_user_nickname').then(nick => {
        if (nick) {
          setNickname(nick);
          setHasSetNickname(true);
        }
      });
    }
  }, [currentUserName]);

  // Simulate other fans typing in chat occasionally
  useEffect(() => {
    if (!hasSetNickname) return;

    const interval = setInterval(async () => {
      // 30% chance of a simulated fan message
      if (Math.random() > 0.3) {
        const randomFan = FAN_NAMES[Math.floor(Math.random() * FAN_NAMES.length)];
        const randomMsgText = FAN_MESSAGES[Math.floor(Math.random() * FAN_MESSAGES.length)];
        
        const newMsg: ChatMessage = {
          id: Math.random().toString(),
          senderName: randomFan,
          text: randomMsgText,
          timestamp: new Date().toISOString(),
          avatarInitial: randomFan[0].toUpperCase(),
          color: colorTheme === 'purple' ? '#a78bfa' : '#c3f400',
          isSelf: false
        };

        setMessages(prev => {
          const combined = [...prev, newMsg];
          // Prune old messages
          const pruned = combined.slice(-MAX_MESSAGES);
          AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(pruned)).catch(() => {});
          return pruned;
        });

        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    }, 15000); // Check every 15s

    return () => clearInterval(interval);
  }, [hasSetNickname, colorTheme]);

  const handleSaveNickname = async () => {
    if (!nickname.trim()) return;
    haptics.light();
    await AsyncStorage.setItem('boro_user_nickname', nickname);
    setHasSetNickname(true);
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;

    haptics.light();
    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      senderName: currentUserName,
      text: inputText.trim(),
      timestamp: new Date().toISOString(),
      avatarInitial: currentUserName[0].toUpperCase(),
      color: colors.primaryFixed,
      isSelf: true
    };

    const nextMessages = [...messages, userMsg].slice(-MAX_MESSAGES);
    setMessages(nextMessages);
    setInputText('');

    try {
      await AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(nextMessages));
    } catch (err) {
      console.warn('Failed to save chat message:', err);
    }

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  if (!hasSetNickname) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenContainer title="BORO CHAT" showLive={false} scroll={false}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <GlassCard padding={24} activeBorder style={{ width: '100%', maxWidth: 360, gap: 16 }}>
              <View style={{ alignItems: 'center', gap: 8 }}>
                <BoroIcon name="groups" size={36} color={colors.primaryFixed} />
                <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 20, textAlign: 'center' }}>
                  Community Chat
                </Text>
                <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13, textAlign: 'center' }}>
                  Inserisci un nickname per leggere e scrivere nella chat con altri tifosi.
                </Text>
              </View>

              <View style={{ gap: 12 }}>
                <TextInput
                  value={nickname}
                  onChangeText={setNickname}
                  placeholder="Il tuo Nickname..."
                  placeholderTextColor={colors.onSurfaceVariant}
                  maxLength={18}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.08)',
                    borderRadius: 10,
                    color: colors.onSurface,
                    fontFamily: fonts.body,
                    fontSize: 14,
                    paddingHorizontal: 12,
                    height: 44,
                  }}
                />
                <Pressable
                  onPress={handleSaveNickname}
                  style={{
                    backgroundColor: colors.primaryFixed,
                    height: 44,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: colors.onPrimary, fontFamily: fonts.label, fontSize: 13, fontWeight: 'bold' }}>
                    Entra nella Chat
                  </Text>
                </Pressable>
              </View>
            </GlassCard>
          </View>
        </ScreenContainer>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenContainer title="BORO CHAT" showLive={false} scroll={false} bottomSafe={false} maxWidth={880}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View style={{ flex: 1, paddingBottom: 16 }}>
            {isDesktop && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 18 }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: colors.accent12,
                    borderWidth: 1,
                    borderColor: colors.accent30,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BoroIcon name="groups" size={24} color={colors.primaryFixed} />
                </View>
                <View>
                  <Text style={{ color: colors.onSurface, fontFamily: fonts.headline, fontSize: 20 }}>
                    Community Chat
                  </Text>
                  <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13 }}>
                    Condividi quote e pronostici live con la community
                  </Text>
                </View>
              </View>
            )}

            {/* Messages List */}
            <FlatList
              ref={flatListRef}
              data={messages}
              style={{ flex: 1 }}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: 16, paddingBottom: 16 }}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              renderItem={({ item }) => {
                return (
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: item.isSelf ? 'flex-end' : 'flex-start',
                      width: '100%',
                    }}
                  >
                    {!item.isSelf && (
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: `${item.color}1F`,
                          borderWidth: 1,
                          borderColor: `${item.color}4D`,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 8,
                          marginTop: 4,
                        }}
                      >
                        <Text style={{ color: item.color, fontFamily: fonts.display, fontSize: 12 }}>
                          {item.avatarInitial}
                        </Text>
                      </View>
                    )}

                    <View style={{ flexShrink: 1, maxWidth: '80%', gap: 3 }}>
                      {!item.isSelf && (
                        <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 9, marginLeft: 4 }}>
                          {item.senderName}
                        </Text>
                      )}
                      <GlassCard
                        padding={12}
                        style={{
                          backgroundColor: item.isSelf ? `${colors.primaryFixed}14` : 'rgba(255,255,255,0.03)',
                          borderColor: item.isSelf ? colors.accent20 : 'rgba(255,255,255,0.06)',
                          borderWidth: 1,
                          borderBottomRightRadius: item.isSelf ? 2 : 12,
                          borderBottomLeftRadius: item.isSelf ? 12 : 2,
                        }}
                      >
                        <Text style={{ color: colors.onSurface, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 }}>
                          {item.text}
                        </Text>
                      </GlassCard>
                      <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 8, alignSelf: item.isSelf ? 'flex-end' : 'flex-start', opacity: 0.6, marginRight: item.isSelf ? 4 : 0, marginLeft: !item.isSelf ? 4 : 0 }}>
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  </View>
                );
              }}
            />

            {/* Input Bar */}
            <GlassCard padding={6}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TextInput
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder="Scrivi un messaggio nella community..."
                  placeholderTextColor={colors.onSurfaceVariant}
                  maxLength={160}
                  style={{
                    flex: 1,
                    color: colors.onSurface,
                    fontFamily: fonts.body,
                    fontSize: 14,
                    paddingHorizontal: 12,
                    height: 40,
                  }}
                  onSubmitEditing={handleSend}
                />
                <Pressable
                  onPress={handleSend}
                  style={({ pressed }) => ({
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: inputText.trim() ? colors.primaryFixed : 'rgba(255,255,255,0.03)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: [{ scale: pressed ? 0.9 : 1 }],
                  })}
                >
                  <BoroIcon
                    name="send"
                    size={16}
                    color={inputText.trim() ? colors.background : colors.onSurfaceVariant}
                  />
                </Pressable>
              </View>
            </GlassCard>
          </View>
        </KeyboardAvoidingView>
      </ScreenContainer>
    </View>
  );
}
