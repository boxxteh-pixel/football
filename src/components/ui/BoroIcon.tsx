import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import * as Lucide from 'lucide-react-native';

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  'analytics': Lucide.Activity,
  'live-tv': Lucide.Tv,
  'psychology': Lucide.Brain,
  'leaderboard': Lucide.TrendingUp,
  'person': Lucide.User,
  'arrow-back': Lucide.ArrowLeft,
  'security': Lucide.Shield,
  'bolt': Lucide.Zap,
  'insights': Lucide.Lightbulb,
  'person-outline': Lucide.User,
  'lock-outline': Lucide.Lock,
  'visibility': Lucide.Eye,
  'visibility-off': Lucide.EyeOff,
  'refresh': Lucide.RefreshCw,
  'auto-awesome': Lucide.Sparkles,
  'schedule': Lucide.Clock,
  'error-outline': Lucide.AlertCircle,
  'key': Lucide.Key,
  'sports-soccer': Lucide.Trophy,
  'lock': Lucide.Lock,
  'chevron-right': Lucide.ChevronRight,
  'auto-graph': Lucide.TrendingUp,
  'search-off': Lucide.Search,
  'trending-up': Lucide.TrendingUp,
  'history': Lucide.History,
  'star': Lucide.Star,
  'star-border': Lucide.Star,
  'chevron-left': Lucide.ChevronLeft,
  'chevron-down': Lucide.ChevronDown,
  'emoji-events': Lucide.Trophy,
  'groups': Lucide.Users,
  'check-circle': Lucide.CheckCircle,
  'language': Lucide.Globe,
  'translate': Lucide.Languages,
  'color-lens': Lucide.Palette,
  'settings': Lucide.Settings,
  'info-outline': Lucide.Info,
  'logout': Lucide.LogOut,
  'delete-outline': Lucide.Trash2,
  'add': Lucide.Plus,
  'close': Lucide.X,
  'check': Lucide.Check,
  'search': Lucide.Search,
  'public': Lucide.Globe,
  'warning': Lucide.AlertTriangle,
  'workspace-premium': Lucide.Trophy,
  'square': Lucide.Square,
  'swap-horiz': Lucide.RefreshCw,
  'change-history': Lucide.AlertCircle,
  'favorite': Lucide.Heart,
  'favorite-border': Lucide.Heart,
};

interface BoroIconProps {
  name: string;
  size?: number;
  color?: string;
  fill?: string;
  style?: StyleProp<ViewStyle>;
}

export const BoroIcon: React.FC<BoroIconProps> = ({ name, size = 24, color = '#ffffff', fill, style }) => {
  const IconComponent = ICON_MAP[name] || Lucide.HelpCircle;
  return <IconComponent size={size} color={color} stroke={color} fill={fill || 'none'} style={style} />;
};
