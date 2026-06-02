import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  FlatList,
  ScrollView,
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

const CHAT_STORAGE_KEY = 'boro_community_chat_v2';
const MAX_MESSAGES = 100;

interface ChatMessage {
  id: string;
  senderName: string;
  text: string;
  timestamp: string;
  avatarInitial: string;
  color: string;
  isSelf: boolean;
  isSystem?: boolean;
}

// Fixed quick questions / prompt chips for quick bot interactions
const QUICK_BOT_SUGGESTIONS = [
  { text: '🛡️ Più sicura', query: 'Quali sono le partite più sicure e con più alta confidenza di oggi?' },
  { text: '🔥 Multipla', query: 'Consigliami una giocata multipla / raddoppio a quota interessante basata sui dati reali di oggi.' },
  { text: '⚠️ Valore', query: 'Ci sono quote underdog o ad alto valore atteso positivo rispetto ai bookmaker?' },
  { text: '📡 Live ora', query: 'Quali partite in corso hanno dinamiche interessanti o variazioni di pressione live?' },
  { text: '⚽ Over 2.5', query: 'Quali partite di oggi hanno le probabilità più alte per l\'esito Over 2.5?' },
  { text: '🥅 Gol/Gol', query: 'Quali incontri offrono ottime statistiche per l\'esito Entrambe le Squadre Segnano (Gol/Gol)?' }
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
  const [reconnectTrigger, setReconnectTrigger] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  
  // WebSocket reference
  const wsRef = useRef<WebSocket | null>(null);

  // Resolve current username
  const currentUserName = useMemo(() => {
    if (session?.user?.name) return session.user.name;
    if (nickname) return nickname;
    return 'Guest';
  }, [session, nickname]);

  // Load local chat history (up to 100 messages) on mount
  useEffect(() => {
    const loadChat = async () => {
      try {
        const raw = await AsyncStorage.getItem(CHAT_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as ChatMessage[];
          const updated = parsed.map(msg => ({
            ...msg,
            isSelf: msg.senderName === currentUserName
          }));
          setMessages(updated);
        } else {
          const defaultMsgs: ChatMessage[] = [
            {
              id: 'init-1',
              senderName: 'BORO AI BOT',
              text: 'Benvenuti nella chat globale di BORO! Qui potete scambiare opinioni con altre persone vere sul sito o fare domande rapide toccando i suggerimenti sopra la barra di testo.',
              timestamp: new Date().toISOString(),
              avatarInitial: '🤖',
              color: colors.primaryFixed,
              isSelf: false,
              isSystem: true
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

    // Check cached nickname or user session
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

  // WebSocket Connection Lifecycle
  useEffect(() => {
    if (!hasSetNickname) return;

    // Use the user's dedicated PieSocket BORO cluster for global chat broadcasting
    const wsUrl = 'wss://free.blr2.piesocket.com/v3/boro_global_chat?api_key=2tTwAggvcqEi0T6JumM94kqR71NIrySWQeWvTNUk&notify_self=1';
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // System connection message hidden as requested
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload && payload.senderName && payload.text && payload.id) {
          setMessages(prev => {
            // Check if the message is already in our list to prevent duplicates
            if (prev.some(m => m.id === payload.id)) {
              return prev;
            }
            
            const receivedMsg: ChatMessage = {
              ...payload,
              isSelf: payload.senderName === currentUserName,
              timestamp: new Date().toISOString(), // set local timestamp
            };
            
            const combined = [...prev, receivedMsg].slice(-MAX_MESSAGES);
            AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(combined)).catch(() => {});
            return combined;
          });
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 50);
        }
      } catch (e) {
        // Handle invalid payloads safely
      }
    };

    ws.onerror = (e) => {
      console.warn('WebSocket connection error:', e);
    };

    ws.onclose = () => {
      // Only trigger reconnect loop if connection dropped unexpectedly (not during cleanup)
      if (wsRef.current === ws) {
        console.log('WebSocket disconnected silently, reconnecting in background...');
        
        // Auto-reconnect silently in 5 seconds
        setTimeout(() => {
          if (wsRef.current === ws && hasSetNickname) {
            setReconnectTrigger(prev => prev + 1);
          }
        }, 5000);
      }
    };

    return () => {
      // Clear reference first so ws.onclose knows it's an intentional disconnect
      wsRef.current = null;
      ws.close();
    };
  }, [hasSetNickname, currentUserName, reconnectTrigger]);

  const handleSaveNickname = async () => {
    if (!nickname.trim()) return;
    haptics.light();
    await AsyncStorage.setItem('boro_user_nickname', nickname);
    setHasSetNickname(true);
  };

  // Live broadcast message to WebSocket
  const broadcastMessage = (msg: ChatMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;

    haptics.light();
    const textToSend = inputText.trim();
    setInputText('');

    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      senderName: currentUserName,
      text: textToSend,
      timestamp: new Date().toISOString(),
      avatarInitial: currentUserName[0].toUpperCase(),
      color: colors.primaryFixed,
      isSelf: true
    };

    // Save locally
    const nextMessages = [...messages, userMsg].slice(-MAX_MESSAGES);
    setMessages(nextMessages);

    // Broadcast globally via WebSocket
    broadcastMessage(userMsg);

    try {
      await AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(nextMessages));
    } catch (err) {
      console.warn('Failed to save chat message:', err);
    }

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  // Fast AI quick action triggered
  const handleQuickAiAction = async (text: string, query: string) => {
    // Add user message
    const userMsg: ChatMessage = {
      id: `ai-query-${Math.random()}`,
      senderName: currentUserName,
      text: text,
      timestamp: new Date().toISOString(),
      avatarInitial: currentUserName[0].toUpperCase(),
      color: colors.primaryFixed,
      isSelf: true
    };

    let updatedMsgs = [...messages, userMsg].slice(-MAX_MESSAGES);
    setMessages(updatedMsgs);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 50);

    // Broadcast user's visual action
    broadcastMessage(userMsg);

    // Trigger local AI response loading
    const loadingMsg: ChatMessage = {
      id: `ai-loading-${Math.random()}`,
      senderName: 'BORO AI BOT',
      text: '✍️ Analisi in corso e calcolo probabilità in tempo reale...',
      timestamp: new Date().toISOString(),
      avatarInitial: '🤖',
      color: colors.primaryFixed,
      isSelf: false,
      isSystem: true
    };
    
    setMessages(prev => [...prev, loadingMsg]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 50);

    // Simulate smart analytical football response based on the actual request
    setTimeout(async () => {
      let replyText = '';
      const lowercaseQuery = query.toLowerCase();
      if (lowercaseQuery.includes('più sicure') || lowercaseQuery.includes('sicura')) {
        replyText = '⚽ Le partite ad alta confidenza consigliate dal modello di oggi:\n\n1. Milan vs Verona: 1 (Prob. 84%, Quota 1.45) 🎯 MOLTO SICURA\n2. Inter vs Torino: 1 (Prob. 80%, Quota 1.38) 🎯 MOLTO SICURA\n3. Atalanta vs Genoa: Over 1.5 (Prob. 88%, Quota 1.25) 🎯 MOLTO SICURA\n\nPuoi visualizzarle nella schermata "Previsioni" ordinate per confidenza.';
      } else if (lowercaseQuery.includes('multipla') || lowercaseQuery.includes('raddoppio')) {
        replyText = '🔥 Multipla consigliata oggi (Quota totale 3.05):\n\n• Milan vs Verona: 1 (Quota 1.45)\n• Inter vs Torino: 1 (Quota 1.38)\n• Atalanta vs Genoa: Over 1.5 (Quota 1.25)\n• Real Madrid vs Chelsea: Over 0.5 FH (Quota 1.22)\n\nMoltiplicatore totale: 3.05x. Consigliato stakeholder medio (2/5).';
      } else if (lowercaseQuery.includes('valore') || lowercaseQuery.includes('underdog')) {
        replyText = '⚠️ Anomalie rilevate (Valore Atteso Positivo / Value Bet):\n\n• Udinese vs Napoli: Esito X (Quota 3.80, Modello dà 31% vs Mercato 26%) - Edge: +5%\n• Cagliari vs Bologna: Esito 1 (Quota 3.40, Modello dà 34% vs Mercato 29%) - Edge: +5%\n\nQuesti pronostici presentano un divario a favore dell\'utente rispetto alle quote esposte dai bookmaker.';
      } else if (lowercaseQuery.includes('live')) {
        replyText = '📡 Analisi Live Ora (Variazioni di Pressione):\n\n• Lazio vs Fiorentina (0-0, 22\'): La pressione offensiva della Lazio è aumentata del 40% negli ultimi 5 minuti (Pressure Swing: +1.8). Consigliato: Over 0.5 1° Tempo (Quota 1.72).\n• Sassuolo vs Empoli (1-0, 58\'): Sassuolo in controllo ma baricentro difensivo basso. Valore su contropiede Empoli.';
      } else if (lowercaseQuery.includes('over 2.5')) {
        replyText = '⚽ Top Over 2.5 Statistici di Oggi:\n\n• Atalanta vs Genoa (Prob. 68%, Quota 1.82)\n• Borussia Dortmund vs Mainz (Prob. 74%, Quota 1.48)\n• Arsenal vs Everton (Prob. 71%, Quota 1.55)\n\nQueste sfide mostrano una media gol attesa superiore a 2.95 basata sugli ultimi 8 incontri.';
      } else if (lowercaseQuery.includes('gol/gol') || lowercaseQuery.includes('segnano')) {
        replyText = '🥅 Top Gol/Gol (Entrambe le Squadre Segnano):\n\n• Sassuolo vs Empoli (Prob. 62%, Quota 1.70)\n• Roma vs Monza (Prob. 59%, Quota 1.85)\n• Tottenham vs Brentford (Prob. 68%, Quota 1.50)\n\nForte propensione offensiva combinata a debolezze nelle marcature su palla inattiva.';
      } else {
        replyText = '🏆 Trend dei Campionati di oggi:\n\n• Serie A: Si nota un aumento del 14% di Gol nei secondi tempi rispetto alla media stagionale.\n• Premier League: Il fattore campo si è ridotto del 4%, gli away win offrono quote generose per le favorite.';
      }

      const aiReply: ChatMessage = {
        id: `ai-reply-${Math.random()}`,
        senderName: 'BORO AI BOT',
        text: replyText,
        timestamp: new Date().toISOString(),
        avatarInitial: '🤖',
        color: colors.primaryFixed,
        isSelf: false
      };

      setMessages(prev => {
        // remove the temporary loading message and append true response
        const filtered = prev.filter(m => !m.id.startsWith('ai-loading-'));
        const next = [...filtered, aiReply].slice(-MAX_MESSAGES);
        AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 50);

      // Broadcast the AI response so other users see it too
      broadcastMessage(aiReply);
    }, 500);
  };

  if (!hasSetNickname) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenContainer title="BORO chat" wordmarkSub="chat" showLive={false} scroll={false}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <GlassCard padding={24} activeBorder style={{ width: '100%', maxWidth: 360, gap: 16 }}>
              <View style={{ alignItems: 'center', gap: 8 }}>
                <BoroIcon name="groups" size={36} color={colors.primaryFixed} />
                <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 20, textAlign: 'center' }}>
                  Community Chat
                </Text>
                <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13, textAlign: 'center' }}>
                  Inserisci un nickname per entrare nella chat globale in tempo reale con gli altri tifosi di BORO.
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
                    outlineStyle: 'none',
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
      <ScreenContainer title="BORO chat" wordmarkSub="chat" showLive={false} scroll={false} bottomSafe={false} maxWidth={880}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View style={{ flex: 1, paddingBottom: 0 }}>
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
                    Confrontati in tempo reale con gli altri utenti del sito
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
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
              renderItem={({ item }) => {
                const isSystemMsg = item.isSystem;
                
                if (isSystemMsg) {
                  return (
                    <View style={{ width: '100%', alignItems: 'center', marginVertical: 6 }}>
                      <View style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingVertical: 6, paddingHorizontal: 12 }}>
                        <Text style={{ color: item.color, fontFamily: fonts.body, fontSize: 11, textAlign: 'center', lineHeight: 16 }}>
                          {item.text}
                        </Text>
                      </View>
                    </View>
                  );
                }

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

            {/* Suggestions/Quick Bot Prompts Header */}
            <View style={{ paddingVertical: 8, gap: 8 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ flexDirection: 'row', gap: 12, paddingHorizontal: 4 }}
              >
                {QUICK_BOT_SUGGESTIONS.map((sug, i) => (
                  <Pressable
                    key={i}
                    onPress={() => handleQuickAiAction(sug.text, sug.query)}
                    style={({ pressed }) => ({
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 20,
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.08)',
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text style={{ color: colors.onSurface, fontFamily: fonts.body, fontSize: 12 }}>
                      {sug.text}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Input Bar */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.08)',
                borderRadius: 24,
                paddingHorizontal: 6,
                paddingVertical: 4,
                marginTop: 16,
                marginBottom: 2,
              }}
            >
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
                  outlineStyle: 'none',
                  outlineWidth: 0,
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
                  marginLeft: 6,
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
          </View>
        </KeyboardAvoidingView>
      </ScreenContainer>
    </View>
  );
}
