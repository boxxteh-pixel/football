import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/authStore';

export default function Index() {
  const session = useAuthStore((s) => s.session);
  if (!session) return <Redirect href="/(auth)/intro" />;
  return <Redirect href="/(tabs)" />;
}
