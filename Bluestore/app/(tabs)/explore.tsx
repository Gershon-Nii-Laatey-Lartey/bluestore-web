import FilterSheet, { DEFAULT_FILTERS, Filters } from '@/components/FilterSheet';
import { Skeleton } from '@/components/Skeleton';
import { dataCache } from '@/lib/cache';
import { supabase } from '@/lib/supabase';
import { getCombinedSearchHistory, getCombinedViewedListings } from '@/lib/tracking';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 64) / 2;
const RECENT_CARD_WIDTH = (width - 64) / 2.4;
const BLUE = '#0057FF';

/* ─── Skeleton for a search tag ─────────────────────────── */
function TagSkeleton() {
  return (
    <View style={styles.historyTag}>
      <Skeleton width={12} height={12} borderRadius={6} />
      <Skeleton width={80} height={11} borderRadius={6} />
    </View>
  );
}

/* ─── Skeleton for a recently-viewed card ───────────────── */
function RecentCardSkeleton() {
  return (
    <View style={{ width: RECENT_CARD_WIDTH }}>
      <Skeleton width={RECENT_CARD_WIDTH} height={130} borderRadius={16} />
      <View style={{ marginTop: 8, gap: 4 }}>
        <Skeleton width={50} height={9} borderRadius={5} />
        <Skeleton width={RECENT_CARD_WIDTH * 0.85} height={12} borderRadius={5} />
        <Skeleton width={60} height={12} borderRadius={5} />
      </View>
    </View>
  );
}



const CATEGORY_IMAGES: { [key: string]: any } = {
  'Electronics': require('@/assets/images/explore/electronics.png'),
  'Home': require('@/assets/images/explore/home.png'),
  'Style': require('@/assets/images/explore/style.png'),
  'Sport': require('@/assets/images/explore/sports.png'),
  'Vehicles': require('@/assets/images/explore/vehichles.png'),
  'Properties': require('@/assets/images/explore/properties.png'),
  'Tech': require('@/assets/images/explore/electronics.png'),
};

export default function ExploreScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [viewedListings, setViewedListings] = useState<any[]>([]);
  const [isLoadingViewed, setIsLoadingViewed] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [dbCategories, setDbCategories] = useState<any[]>([]);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const inputRef = useRef<TextInput>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Load cache immediately
  useEffect(() => {
    const cCats = dataCache.get('explore_categories');
    const cHist = dataCache.get('search_history');
    const cViewed = dataCache.get('viewed_listings');

    if (cCats) { setDbCategories(cCats); setIsLoadingCategories(false); }
    if (cHist) { setSearchHistory(cHist); setIsLoadingHistory(false); }
    if (cViewed) { setViewedListings(cViewed); setIsLoadingViewed(false); }

    if (cCats) {
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      setIsInitialLoad(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Background revalidation
      fetchSearchHistory();
      fetchViewedListings();
      fetchCategories();
    }, [])
  );

  const fetchCategories = async () => {
    try {
      const { data } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      if (data) {
        setDbCategories(data);
        dataCache.set('explore_categories', data);
        if (isInitialLoad) {
          Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
          setIsInitialLoad(false);
        }
      }
    } finally {
      setIsLoadingCategories(false);
    }
  };

  const fetchSearchHistory = async () => {
    try {
      const queries = await getCombinedSearchHistory();
      setSearchHistory(queries);
      dataCache.set('search_history', queries);
    } catch (e) {
      console.error('Search history error:', e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const fetchViewedListings = async () => {
    try {
      const listings = await getCombinedViewedListings();
      setViewedListings(listings);
      dataCache.set('viewed_listings', listings);
    } catch (e) {
      console.error('Viewed listings error:', e);
    } finally {
      setIsLoadingViewed(false);
      if (isInitialLoad && dbCategories.length > 0) {
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
        setIsInitialLoad(false);
      }
    }
  };

  const clearSearchHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('search_history').delete().eq('user_id', user.id);
      } else {
        const LOCAL_SEARCH_KEY = '@local_search_history';
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        await AsyncStorage.removeItem(LOCAL_SEARCH_KEY);
      }
      setSearchHistory([]);
      dataCache.delete('search_history');
    } catch (e) {
      console.error('Clear history error:', e);
    }
  };

  const confirmClearHistory = () => {
    Alert.alert(
      'Clear Search History',
      'Are you sure you want to clear all your recent searches?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: clearSearchHistory },
      ]
    );
  };

  const performSearch = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    router.push({ pathname: '/(tabs)/search/[query]', params: { query: trimmed } });
  };

  const handleApplyFilters = (newFilters: Filters) => {
    setFilters(newFilters);
    // Navigate to search with filters as params
    router.push({
      pathname: '/(tabs)/search/[query]',
      params: {
        query: 'all',
        ...newFilters,
        showFilters: 'false'
      } as any
    });
  };

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.headerSafe}>
        <View style={styles.header}>
          <Pressable
            style={styles.searchBar}
            onPress={() => inputRef.current?.focus()}
          >
            <Ionicons name="search-outline" size={20} color="#ABABAB" />
            <TextInput
              ref={inputRef}
              placeholder="Search stores and products"
              placeholderTextColor="#BABABA"
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={() => performSearch(searchQuery)}
              returnKeyType="search"
              autoFocus={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#ABABAB" />
              </TouchableOpacity>
            )}
          </Pressable>
          <TouchableOpacity 
            style={styles.filterBtn}
            onPress={() => setShowFilterSheet(true)}
          >
            <Ionicons name="options-outline" size={22} color="#111111" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <Animated.ScrollView
        style={{ flex: 1, opacity: fadeAnim }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Recent Searches Section - Only show if has data or loading */}
        {(isLoadingHistory || searchHistory.length > 0) && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Searches</Text>
              {!isLoadingHistory && searchHistory.length > 0 && (
                <TouchableOpacity onPress={confirmClearHistory}>
                  <Text style={styles.clearText}>Clear all</Text>
                </TouchableOpacity>
              )}
            </View>

            {isLoadingHistory ? (
              <View style={styles.historyTags}>
                {[100, 70, 120].map((w, i) => (
                  <View key={i} style={styles.historyTag}>
                    <Skeleton width={12} height={12} borderRadius={6} />
                    <Skeleton width={w} height={11} borderRadius={6} />
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.historyTags}>
                {searchHistory.map((item, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.historyTag}
                    onPress={() => performSearch(item)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="time-outline" size={14} color="#8A8A8A" />
                    <Text style={styles.tagLabel}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Recently Viewed Section - Only show if has data or loading */}
        {(isLoadingViewed || viewedListings.length > 0) && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recently Viewed</Text>
              {!isLoadingViewed && (
                <TouchableOpacity onPress={fetchViewedListings}>
                  <Feather name="refresh-cw" size={14} color={BLUE} />
                </TouchableOpacity>
              )}
            </View>

            {isLoadingViewed ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentScroll} scrollEnabled={false}>
                {[0, 1, 2].map((i) => <RecentCardSkeleton key={i} />)}
              </ScrollView>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentScroll}>
                {viewedListings.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.recentCard}
                    onPress={() => router.push({ pathname: '/(tabs)/product/[id]', params: { id: item.id } })}
                    activeOpacity={0.9}
                  >
                    <View style={styles.recentImageWrap}>
                      {item.images?.[0] ? (
                        <ExpoImage
                          source={{ uri: item.images[0] }}
                          style={styles.recentImage}
                          contentFit="cover"
                          transition={200}
                          cachePolicy="memory-disk"
                        />
                      ) : (
                        <Feather name="image" size={28} color="#EBEBEB" />
                      )}
                      {item.is_boosted && (
                        <View style={styles.boostBadge}>
                          <Ionicons name="flash" size={10} color="#FFF" />
                          <Text style={styles.boostText}>BOOSTED</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.recentBrand} numberOfLines={1}>{item.brand || item.category}</Text>
                    <Text style={styles.recentName} numberOfLines={2}>{item.title}</Text>
                    <Text style={styles.recentPrice}>GH₵{item.price}</Text>
                    <View style={styles.recentLocation}>
                      <Ionicons name="location-outline" size={10} color="#8A8A8A" />
                      <Text style={styles.recentLocText} numberOfLines={1}>{item.location || 'Accra, Ghana'}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* ── Categories ────────────────────────────────────── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <Text style={styles.sectionTitle}>Main Categories</Text>
        </View>

        <View style={styles.grid}>
          {isLoadingCategories && dbCategories.length === 0 ? (
            [1, 2, 3, 4, 5, 6].map((i) => (
              <View key={i} style={[styles.catCard, { backgroundColor: '#FAFAFA' }]}>
                <View style={styles.catOverlay}>
                  <Skeleton width={80} height={16} borderRadius={8} style={{ marginBottom: 6 }} />
                  <Skeleton width={60} height={12} borderRadius={6} />
                </View>
              </View>
            ))
          ) : (
            dbCategories.map((cat, idx) => (
              <TouchableOpacity
                key={cat.id || idx}
                style={styles.catCard}
                onPress={() => performSearch(cat.name)}
                activeOpacity={0.9}
              >
                {CATEGORY_IMAGES[cat.name] ? (
                  <ExpoImage
                    source={CATEGORY_IMAGES[cat.name]}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={300}
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <LinearGradient
                    colors={cat.color ? [cat.color, cat.color + 'CC'] : ['#F5F5F5', '#EBEBEB']}
                    style={StyleSheet.absoluteFill}
                  />
                )}

                <View style={styles.catGradient}>
                  <View style={styles.catTextWrap}>
                    <Text style={styles.catTitle}>{cat.name}</Text>
                    <Text style={styles.catCount}>Explore Items</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>


        <View style={{ height: 40 }} />
      </Animated.ScrollView>

      <FilterSheet
        visible={showFilterSheet}
        onClose={() => setShowFilterSheet(false)}
        onApply={handleApplyFilters}
        currentFilters={filters}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  headerSafe: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    height: 48,
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: '#EBEBEB',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111111',
    fontFamily: 'Inter_500Medium',
  },
  filterBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#EBEBEB',
  },
  scroll: { paddingHorizontal: 20, paddingTop: 24 },
  section: { marginBottom: 30 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111111',
    fontFamily: 'Outfit_700Bold',
  },
  clearText: { fontSize: 13, color: BLUE, fontWeight: '600' },

  // Search History
  historyTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  historyTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#F2F2F2',
  },
  tagLabel: { fontSize: 13, color: '#111111', fontWeight: '500' },

  // Empty states — fixed height so layout stays consistent
  emptyTagsArea: {
    height: 80,
    borderRadius: 14,
    backgroundColor: '#FAFAFA',
    borderWidth: 1.5,
    borderColor: '#F2F2F2',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyRecentArea: {
    height: 172, // image 130 + text ~42
    borderRadius: 16,
    backgroundColor: '#FAFAFA',
    borderWidth: 1.5,
    borderColor: '#F2F2F2',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyText: {
    fontSize: 12,
    color: '#ABABAB',
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 20,
  },

  // Recently Viewed
  recentScroll: { gap: 12, paddingRight: 4 },
  recentCard: { width: RECENT_CARD_WIDTH },
  recentImageWrap: {
    height: 130,
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    overflow: 'hidden',
  },
  recentImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  recentBrand: {
    fontSize: 9,
    fontWeight: '800',
    color: BLUE,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  recentName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111111',
    marginBottom: 3,
    lineHeight: 18,
  },
  recentPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
    fontFamily: 'Outfit_700Bold',
  },
  recentLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  recentLocText: {
    fontSize: 10,
    color: '#8A8A8A',
  },

  // Original category card style
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  catCard: {
    width: COLUMN_WIDTH,
    height: 140, // Increased for better aspect ratio
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  catGradient: {
    flex: 1,
    padding: 20,
    justifyContent: 'flex-end',
  },
  catIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catTextWrap: {
    marginTop: 10,
  },
  catTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  catCount: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  catChevron: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catOverlay: {
    flex: 1,
    padding: 20,
    justifyContent: 'flex-end',
  },
  boostBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: '#FF9500',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  boostText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
  },
});
