import { dataCache } from '@/lib/cache';
import { registerForPushNotificationsAsync } from '@/lib/notifications';
import { refreshPreferencesIfStale } from '@/lib/recommendations';
import { supabase } from '@/lib/supabase';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Outfit_400Regular, Outfit_600SemiBold, Outfit_700Bold, useFonts } from '@expo-google-fonts/outfit';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import CustomSplashScreen from '@/components/SplashScreen';
import { AuthDrawerProvider } from '@/context/AuthDrawerContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { LocationProvider } from '@/context/LocationContext';
import { useCallback } from 'react';

ExpoSplashScreen.preventAutoHideAsync();

function RootLayoutContent() {
  const [showCustomSplash, setShowCustomSplash] = useState(true);
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  const router = useRouter();
  const segments = useSegments();
  const { session, loading: isAuthReady } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState('');
  const [notification, setNotification] = useState<Notifications.Notification | undefined>(undefined);
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  const appIsReady = fontsLoaded && !isAuthReady; // Wait for fonts and auth to be initialized

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      await ExpoSplashScreen.hideAsync();
    }
  }, [appIsReady]);

  useEffect(() => {
    if (session?.user) {
      prefetchCoreData(session.user.id);
      setupUserPresence(session.user.id);
    }
  }, [session]);

  useEffect(() => {
    // Notification Listeners
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      setNotification(notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      // Handle notification response locally if needed
    });

    return () => {
      if (notificationListener.current) notificationListener.current.remove();
      if (responseListener.current) responseListener.current.remove();
    };
  }, []);

  // Separate Navigation logic
  useEffect(() => {
    if (!isAuthReady || !fontsLoaded) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (session) {
        // Logged in: Force out of Auth group
        if (inAuthGroup) {
            router.replace('/(tabs)');
        }
        // If not in a known good group (like just being at /), go to tabs
        else if (segments.length < 1) {
            router.replace('/(tabs)');
        }

        // Register for push notifications if logged in
        registerForPushNotificationsAsync().then(token => {
          if (token) setExpoPushToken(token);
        });
    } else {
        // Logged out: allow access to all
        if (segments.length < 1) {
            router.replace('/(tabs)');
        }
    }
  }, [session, segments, isAuthReady, fontsLoaded]);

  const setupUserPresence = (userId: string) => {
    const channel = supabase.channel('online-users');
    let heartbeatInterval: any;

    const updateLastSeen = async () => {
      try {
        await supabase
          .from('profiles')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', userId);
      } catch (err) { /* silent */ }
    };

    channel
      .on('presence', { event: 'sync' }, () => {
        // Handle presence sync if needed (global count, etc.)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            online_at: new Date().toISOString(),
            user_id: userId
          });

          // Persistent heartbeat in the DB
          updateLastSeen();
          heartbeatInterval = setInterval(() => {
            if (AppState.currentState === 'active') {
              updateLastSeen();
            }
          }, 1000 * 60 * 2); // Every 2 minutes
        }
      });

    return () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      channel.unsubscribe();
    };
  };

  async function prefetchCoreData(userId: string) {
    try {
      // 1. Profile Data
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, phone_number, is_verified, role, bio, location, location_structured, banner_url, account_status, created_at, verification_status')
        .eq('id', userId)
        .single();

      const fetchedProfile = profile;

      const { count: listingsCount } = await supabase
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      const { data: ratingStats } = await supabase.rpc('get_seller_rating', { seller_uuid: userId });
      const pseudoResponseRate = 85 + (parseInt(userId.toString().substring(0, 2), 16) % 15);
      const stats = {
        avg_rating: ratingStats?.[0]?.avg_rating || 0,
        total_reviews: ratingStats?.[0]?.total_reviews || 0,
        response_rate: pseudoResponseRate
      };

      if (fetchedProfile) {
        dataCache.set('user_profile', {
          user: { id: userId, profile: fetchedProfile },
          listingsCount: listingsCount || 0,
          stats: stats
        });
      }

      // 2. Search History
      const { data: history } = await supabase
        .from('search_history')
        .select('query')
        .eq('user_id', userId)
        .order('searched_at', { ascending: false })
        .limit(10);
      if (history) dataCache.set('search_history', history.map(h => h.query));

      // 3. Viewed Listings
      const { data: viewed } = await supabase
        .from('viewed_listings')
        .select(`viewed_at, listings ( id, title, brand, category, price, images )`)
        .eq('user_id', userId)
        .order('viewed_at', { ascending: false })
        .limit(10);
      if (viewed) dataCache.set('viewed_listings', (viewed || []).map((r: any) => r.listings).filter(Boolean));

      // 4. Explore Categories
      const { data: categories } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      if (categories) dataCache.set('explore_categories', categories);

      // 5b. Refresh recommendations if stale (background, non-blocking)
      refreshPreferencesIfStale();

      // 6. Chat Conversations
      const { data: convos } = await supabase
        .from('conversation_participants')
        .select(`
                    conversation_id,
                    conversation:conversations(
                        *,
                        listing:listings(title, images),
                        participants:conversation_participants(
                            user:profiles(id, full_name, avatar_url)
                        ),
                        unread_count:messages(count)
                    )
                `)
        .eq('user_id', userId)
        .filter('conversation.messages.sender_id', 'neq', userId)
        .filter('conversation.messages.is_read', 'eq', false);

      if (convos) {
        const formatTime = (dateStr: string) => {
          if (!dateStr) return '';
          const date = new Date(dateStr);
          const now = new Date();
          const diff = now.getTime() - date.getTime();
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          if (days === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          if (days === 1) return 'Yesterday';
          if (days < 7) return date.toLocaleDateString([], { weekday: 'short' });
          return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        };

        const formatted = (convos || []).map((p: any) => {
          const convo: any = p.conversation;
          if (!convo) return null;
          const other = convo.participants?.find((part: any) => part.user.id !== userId);
          return {
            id: convo.id,
            name: other?.user?.full_name || 'Bluestore User',
            avatar: other?.user?.avatar_url,
            lastMsg: convo.last_message || 'Start a conversation...',
            time: formatTime(convo.last_message_at),
            unread: convo.unread_count?.[0]?.count || 0,
            listing: convo.listing,
            rawTime: convo.last_message_at || convo.created_at,
            lastSenderId: convo.last_message_sender_id,
            isRead: convo.last_message_is_read
          };
        })
          .filter(Boolean)
          .sort((a: any, b: any) => new Date(b.rawTime).getTime() - new Date(a.rawTime).getTime());

        dataCache.set('conversations_list', formatted);
      }

      // 6. Notification Count
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);
      dataCache.set('unread_notifications_count', count || 0);
    } catch (e) {
      console.error('Prefetch error:', e);
    }
  }

  if (!fontsLoaded) return null;

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
      <StatusBar style="dark" backgroundColor="#ffffff" />
      {showCustomSplash && (
        <View style={StyleSheet.absoluteFill}>
          <CustomSplashScreen onFinish={() => setShowCustomSplash(false)} />
        </View>
      )}
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <AuthDrawerProvider>
          <LocationProvider>
            <RootLayoutContent />
          </LocationProvider>
        </AuthDrawerProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
