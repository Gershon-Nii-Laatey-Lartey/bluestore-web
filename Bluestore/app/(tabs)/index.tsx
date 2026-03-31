import { GlobalAlert } from '@/components/GlobalAlert';
import { LocationSelector } from '@/components/LocationSelector';
import { ProductCard } from '@/components/ProductCard';
import SearchWithHistory from '@/components/SearchWithHistory';
import { Skeleton } from '@/components/Skeleton';
import { useLocation } from '@/context/LocationContext';
import { dataCache } from '@/lib/cache';
import { fetchRecommendations } from '@/lib/recommendations';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAuthDrawer } from '@/context/AuthDrawerContext';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  NativeScrollEvent,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

// Primary Brand Blue
const BLUE = '#0057FF';

export default function HomeScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { showAuthDrawer } = useAuthDrawer();
  const [listings, setListings] = useState<any[]>([]);
  const [filteredListings, setFilteredListings] = useState<any[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [bannerIndex, setBannerIndex] = useState(0);

  const ITEMS_PER_PAGE = 20;

  const [dbBrands, setDbBrands] = useState<any[]>([]);
  const [dbCategories, setDbCategories] = useState<any[]>([]);
  const [isLoadingBrands, setIsLoadingBrands] = useState(true);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  const { location, setLocation } = useLocation();
  const [isLocationModalVisible, setIsLocationModalVisible] = useState(false);
  const [locationFilterLabel, setLocationFilterLabel] = useState<string | null>(null);
  const [isLocationFiltering, setIsLocationFiltering] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [isLoadingRecs, setIsLoadingRecs] = useState(true);
  const recsFadeAnim = useRef(new Animated.Value(0)).current;
  const bannerScrollRef = useRef<ScrollView>(null);

  const RECENT_CARD_WIDTH = (width - 64) / 2.2;

  useEffect(() => {
    // Check cache first
    const cachedBrands = dataCache.get('brands');
    const cachedCats = dataCache.get('categories');

    if (cachedBrands) setDbBrands(cachedBrands);
    if (cachedCats) setDbCategories(cachedCats);

    const fetchInitialData = async () => {
      if (!cachedBrands) setIsLoadingBrands(true);
      if (!cachedCats) setIsLoadingCategories(true);

      try {
        const { data: brandsData } = await supabase
          .from('brands')
          .select('*')
          .eq('is_featured', true)
          .order('sort_order', { ascending: true })
          .limit(10);
        if (brandsData) {
          setDbBrands(brandsData);
          dataCache.set('brands', brandsData);
        }
      } finally {
        setIsLoadingBrands(false);
      }

      try {
        // Fetch Categories
        const { data: catsData } = await supabase
          .from('categories')
          .select('*')
          .limit(10); // increased limit
        if (catsData) {
          const finalCats = [{ name: 'All', icon: 'grid' }, ...catsData];
          setDbCategories(finalCats);
          dataCache.set('categories', finalCats);
        }
      } finally {
        setIsLoadingCategories(false);
      }
    };
    fetchInitialData();
    fetchUnreadNotificationsCount();
  }, []);

  const fetchUnreadNotificationsCount = async () => {
    const cachedCount = dataCache.get('unread_notifications_count');
    if (typeof cachedCount === 'number') {
      setUnreadNotifications(cachedCount);
    }

    try {
      if (!session?.user) return;
      const user = session.user;

      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (count !== null) {
        setUnreadNotifications(count);
        dataCache.set('unread_notifications_count', count);
      }
    } catch (e) {
      console.error('Error fetching notification count:', e);
    }
  };

  // Re-fetch when location changes
  useEffect(() => {
    fetchListings();
  }, [location]);

  useFocusEffect(
    useCallback(() => {
      fetchUnreadNotificationsCount();
      loadRecommendations();
    }, [])
  );

  const loadRecommendations = async () => {
    const cached = dataCache.get('recommendations');
    if (cached && cached.length > 0) {
      setRecommendations(cached.slice(0, 10));
      setIsLoadingRecs(false);
      // Animate in immediately if cached
      Animated.timing(recsFadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      return;
    }

    try {
      const recs = await fetchRecommendations();
      if (recs.length > 0) {
        setRecommendations(recs.slice(0, 10));
        // Smooth fade + slide in
        Animated.timing(recsFadeAnim, { toValue: 1, duration: 500, delay: 100, useNativeDriver: true }).start();
      }
    } catch (e) {
      console.error('Recommendations error:', e);
    } finally {
      setIsLoadingRecs(false);
    }
  };

  // Auto-slide logic for banner
  useEffect(() => {
    const timer = setInterval(() => {
      let nextIndex = (bannerIndex + 1) % 3;
      bannerScrollRef.current?.scrollTo({
        x: nextIndex * width,
        animated: true,
      });
      setBannerIndex(nextIndex);
    }, 20000); // 20 seconds interval

    return () => clearInterval(timer);
  }, [bannerIndex]);

  useEffect(() => {
    setFilteredListings(listings);
  }, [listings]);

  const fetchListings = async (pageNum = 0, isRefreshing = false) => {
    const cacheKey = `listings_${location?.name || 'global'}_${pageNum}`;
    const cachedListings = pageNum === 0 ? dataCache.get(cacheKey) : null;

    if (cachedListings && !isRefreshing) {
      setListings(cachedListings);
      setIsLoading(false);
    }

    if (pageNum === 0 && !cachedListings) setIsLoading(true);
    else if (pageNum > 0) setIsLoadingMore(true);

    try {
      const from = pageNum * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      // Tiered Location Filtering:
      // 1. Try district (most specific)
      // 2. Fallback to city
      // 3. Fallback to region
      // 4. Show all if no location filter or no results
      let data: any[] = [];
      let usedFilterLabel: string | null = null;
      const locationTiers = [
        location?.district ? { key: 'district', value: location.district, label: location.district } : null,
        location?.city ? { key: 'city', value: location.city, label: location.city } : null,
        location?.region ? { key: 'region', value: location.region, label: location.region } : null,
      ].filter(Boolean) as { key: string; value: string; label: string }[];

      if (locationTiers.length > 0) {
        // If "All [Country]" is selected, only filter by country
        if (location.name?.startsWith('All ') || location.name === location.country) {
          const countryName = location.country || location.name.replace('All ', '');
          const { data: countryData, error } = await supabase
            .from('listings')
            .select('id, title, price, description, location, category, brand, condition, images, user_id, status, created_at, updated_at, location_structured, is_boosted')
            .eq('status', 'approved')
            .contains('location_structured', { country: countryName })
            .order('is_boosted', { ascending: false })
            .order('created_at', { ascending: false })
            .range(from, to);

          if (!error && countryData && countryData.length > 0) {
            data = countryData;
            usedFilterLabel = countryName;
          }
        } else {
          // Tiered matching for specific scopes
          for (const tier of locationTiers) {
            const { data: tierData, error } = await supabase
              .from('listings')
              .select('id, title, price, description, location, category, brand, condition, images, user_id, status, created_at, updated_at, location_structured, is_boosted')
            .eq('status', 'approved')
            .contains('location_structured', { [tier.key]: tier.value })
            .order('is_boosted', { ascending: false })
            .order('created_at', { ascending: false })
              .range(from, to);

            if (!error && tierData && tierData.length > 0) {
              data = tierData;
              usedFilterLabel = tier.label;
              break;
            }
          }
        }
      }

      // If no location-based results, fetch all (no location filter)
      if (data.length === 0) {
        const { data: allData, error } = await supabase
          .from('listings')
            .select('id, title, price, description, location, category, brand, condition, images, user_id, status, created_at, updated_at, location_structured, is_boosted')
            .eq('status', 'approved')
            .order('is_boosted', { ascending: false })
            .order('created_at', { ascending: false })
          .range(from, to);

        if (error) throw error;
        data = allData || [];
        usedFilterLabel = null;
      }

      setLocationFilterLabel(usedFilterLabel);

      if (pageNum === 0) {
        setListings(data || []);
        dataCache.set(cacheKey, data);
      } else {
        setListings(prev => [...prev, ...(data || [])]);
      }

      setHasMore(data.length === ITEMS_PER_PAGE);
      setPage(pageNum);

      if (pageNum === 0) {
        if (session?.user) {
          const user = session.user;
          const { data: savedData } = await supabase
            .from('saved_listings')
            .select('listing_id')
            .eq('user_id', user.id);

          if (savedData) {
            setSavedIds(new Set(savedData.map(s => s.listing_id)));
          }
        }
      }
    } catch (error) {
      console.error('Error fetching listings:', error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const fetchMore = () => {
    if (!isLoadingMore && hasMore) {
      fetchListings(page + 1);
    }
  };

  const isCloseToBottom = ({ layoutMeasurement, contentOffset, contentSize }: NativeScrollEvent) => {
    const paddingToBottom = 100;
    return layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
  };

  const toggleFavorite = async (listingId: string) => {
    try {
      if (!session?.user) {
        showAuthDrawer();
        return;
      }
      const user = session.user;

      const isCurrentlySaved = savedIds.has(listingId);

      // Optimistic update
      setSavedIds(prev => {
        const next = new Set(prev);
        if (isCurrentlySaved) next.delete(listingId);
        else next.add(listingId);
        return next;
      });

      if (isCurrentlySaved) {
        await supabase.from('saved_listings').delete().eq('user_id', user.id).eq('listing_id', listingId);
      } else {
        await supabase.from('saved_listings').insert([{ user_id: user.id, listing_id: listingId }]);
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
      // Revert on error
      fetchSavedIds();
    }
  };

  const fetchSavedIds = async () => {
    if (session?.user) {
      const user = session.user;
      const { data: savedData } = await supabase.from('saved_listings').select('listing_id').eq('user_id', user.id);
      if (savedData) setSavedIds(new Set(savedData.map(s => s.listing_id)));
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchListings();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <GlobalAlert />
      {/* Header with Location - Wrapped in Top-only Safe Area */}
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.headerSafe}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.locationGroup}
            activeOpacity={0.7}
            onPress={() => {
              setIsLocationModalVisible(true);
            }}
          >
            <View style={styles.locationIconWrap}>
              <Ionicons name="location" size={16} color={BLUE} />
            </View>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.locationText} numberOfLines={1} ellipsizeMode="tail">{location.name}</Text>
              <Ionicons name="chevron-down" size={10} color="#8A8A8A" />
            </View>
          </TouchableOpacity>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => {
                if (!session) {
                    showAuthDrawer();
                } else {
                    router.push({ pathname: '/notifications', params: { from: 'home' } });
                }
              }}
            >
              <Ionicons name="notifications-outline" size={22} color="#111111" />
              {unreadNotifications > 0 && (
                <View style={styles.statusDot}>
                  <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '800' }}>
                    {unreadNotifications > 9 ? '9+' : unreadNotifications}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => {
                if (!session) {
                    showAuthDrawer();
                } else {
                    router.push('/saved');
                }
              }}
            >
              <Ionicons name="heart-outline" size={22} color="#111111" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search bar lives here, outside the ScrollView — same pattern as category/search pages */}
        <View style={styles.searchSection}>
          <SearchWithHistory
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search premium collections..."
            onSubmit={(q) => router.push({ pathname: '/search/[query]', params: { query: q } })}
            onSelectHistory={(q) => router.push({ pathname: '/search/[query]', params: { query: q } })}
            containerStyle={{ zIndex: 200 }}
          />
        </View>
      </SafeAreaView>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        onScroll={({ nativeEvent }) => {
          if (isCloseToBottom(nativeEvent)) {
            fetchMore();
          }
        }}
        scrollEventThrottle={400}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={BLUE}
            colors={[BLUE]}
          />
        }
      >
        {/* Banners Carousel */}
        <View style={{ marginBottom: 28 }}>
          <ScrollView 
            ref={bannerScrollRef}
            horizontal 
            pagingEnabled 
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              const contentOffset = e.nativeEvent.contentOffset.x;
              const index = Math.round(contentOffset / width);
              if (index !== bannerIndex) setBannerIndex(index);
            }}
            scrollEventThrottle={16}
          >
            {/* Banner 1: Discovery (Marketplace variety) */}
            <TouchableOpacity 
              style={styles.promoBanner} 
              activeOpacity={0.95}
              onPress={() => router.push('/(tabs)/explore')}
            >
              <LinearGradient
                colors={['#0057FF', '#0047D5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              
              <View style={{ position: 'absolute', top: -10, left: 120, opacity: 0.08 }}>
                 <Text style={{ fontSize: 130, fontWeight: '900', color: '#FFF' }}>10K</Text>
              </View>
              
              <View style={styles.promoTextContainer}>
                <View style={[styles.promoBadge, { backgroundColor: '#FFFFFF' }]}>
                  <Text style={[styles.promoBadgeText, { color: '#0057FF' }]}>COMMUNITY</Text>
                </View>
                <Text style={styles.promoTitle}>Find Everything</Text>
                <Text style={styles.promoSub}>Explore thousands of items near you</Text>
              </View>
              
            </TouchableOpacity>

            {/* Banner 2: Trust & Safety */}
            <TouchableOpacity 
              style={[styles.promoBanner, { backgroundColor: '#F9F9F9', borderWidth: 1, borderColor: '#EEE' }]} 
              activeOpacity={0.95}
              onPress={() => router.push('/profile/verification')}
            >
              <View style={{ position: 'absolute', top: -10, left: 130, opacity: 0.08 }}>
                 <Text style={{ fontSize: 110, fontWeight: '900', color: '#111' }}>SAFE</Text>
              </View>
              <View style={[styles.bannerShape, { bottom: -20, right: -20, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(0,87,255,0.03)' }]} />
              
              <View style={styles.promoTextContainer}>
                <View style={[styles.promoBadge, { backgroundColor: '#111' }]}>
                  <Text style={styles.promoBadgeText}>TRUSTED</Text>
                </View>
                <Text style={[styles.promoTitle, { color: '#111' }]}>Verified Sellers</Text>
                <Text style={[styles.promoSub, { color: '#666' }]}>Shop with confidence and security</Text>
              </View>
              
              <View style={styles.promoIconWrap}>
                 <Ionicons name="shield-checkmark-outline" size={48} color="rgba(0,87,255,0.1)" />
              </View>
            </TouchableOpacity>

            {/* Banner 3: Bluestore Pro (Stealth Black/Gold) */}
            <TouchableOpacity 
              style={[styles.promoBanner, { backgroundColor: '#111' }]} 
              activeOpacity={0.95}
              onPress={() => router.push('/pricing')}
            >
              <LinearGradient
                colors={['#111111', '#222222', '#111111']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              
              <View style={{ position: 'absolute', top: -10, left: 160, opacity: 0.05 }}>
                 <Text style={{ fontSize: 130, fontWeight: '900', color: '#FFF' }}>PRO</Text>
              </View>
              
              <View style={[styles.bannerShape, { top: -40, right: -10, width: 120, height: 120, borderRadius: 60, borderWidth: 1, borderColor: 'rgba(255,215,0,0.1)' }]} />
              <View style={[styles.bannerShape, { bottom: -10, left: 140, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,215,0,0.05)' }]} />
              
              <View style={styles.promoTextContainer}>
                <View style={[styles.promoBadge, { backgroundColor: '#FFD700' }]}>
                  <Text style={[styles.promoBadgeText, { color: '#000' }]}>LIMITED</Text>
                </View>
                <Text style={[styles.promoTitle, { color: '#FFF' }]}>Bluestore Pro</Text>
                <Text style={[styles.promoSub, { color: 'rgba(255,255,255,0.6)' }]}>Get verified and boost your sales</Text>
              </View>
              
              <View style={styles.promoIconWrap}>
                 <Ionicons name="medal" size={48} color="rgba(255,215,0,0.2)" />
              </View>
            </TouchableOpacity>
          </ScrollView>

          {/* Dots Indicator */}
          <View style={styles.pagination}>
            {[0, 1, 2].map((i) => (
              <View 
                key={i} 
                style={[
                  styles.dot, 
                  bannerIndex === i ? styles.dotActive : null
                ]} 
              />
            ))}
          </View>
        </View>

        {/* Popular Brands Section */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Popular Brands</Text>
          <TouchableOpacity onPress={() => router.push('/brands')}>
            <Text style={styles.viewMore}>See All</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.brandScroll}>
          {isLoadingBrands ? (
            [1, 2, 3, 4, 5].map((i) => (
              <View key={i} style={styles.brandCard}>
                <View style={[styles.brandIconWrap, { backgroundColor: '#F9F9F9', borderColor: '#F5F5F5' }]}>
                  <Skeleton width={32} height={32} borderRadius={16} />
                </View>
                <Skeleton width={40} height={10} style={{ marginTop: 8 }} />
              </View>
            ))
          ) : (
            dbBrands.map((brand: any, idx: number) => (
              <TouchableOpacity
                key={brand.id || idx}
                style={styles.brandCard}
                onPress={() => {
                  router.push({
                    pathname: "/category/[id]",
                    params: { id: "All", initialBrand: brand.name }
                  });
                }}
              >
                <View style={styles.brandIconWrap}>
                  {brand.logo_url ? (
                    <ExpoImage
                      source={{ uri: brand.logo_url }}
                      style={styles.brandLogo}
                      contentFit="cover"
                      transition={200}
                      cachePolicy="disk"
                    />
                  ) : (
                    <Ionicons name={(brand.icon || 'star-outline') as any} size={32} color="#111111" />
                  )}
                </View>
                <Text style={styles.brandName}>{brand.name}</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        {/* Categories */}
        <View style={styles.categoryWrap}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Categories</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
            {isLoadingCategories ? (
              [1, 2, 3, 4, 5].map((i) => (
                <View key={i} style={styles.catItem}>
                  <View style={[styles.catIcon, { backgroundColor: '#F9F9F9' }]}>
                    <Skeleton width={32} height={32} borderRadius={16} />
                  </View>
                  <Skeleton width={30} height={10} style={{ marginTop: 8 }} />
                </View>
              ))
            ) : (
              dbCategories.map((item: any, idx: number) => (
                <TouchableOpacity
                  key={item.id || idx}
                  style={styles.catItem}
                  onPress={() => {
                    item.name === 'More' ? router.push('/(tabs)/explore') : router.push({
                      pathname: "/category/[id]",
                      params: { id: item.name }
                    });
                  }}
                >
                  <View style={[styles.catIcon, idx === 0 && styles.catIconActive]}>
                    <Ionicons name={(item.icon || 'cube-outline') as any} size={22} color={idx === 0 ? '#FFFFFF' : BLUE} />
                  </View>
                  <Text style={[styles.catLabel, idx === 0 && styles.catLabelActive]}>{item.name}</Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>

        {/* ── For You (Recommendations) ───────────── */}
        {recommendations.length > 0 && (
          <Animated.View style={{
            marginBottom: 28,
            opacity: recsFadeAnim,
            transform: [{
              translateY: recsFadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] })
            }]
          }}>
            <View style={styles.sectionHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>For You</Text>
                <Text style={{ fontSize: 12, color: '#8A8A8A', marginTop: 2 }}>Picked based on your activity</Text>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, gap: 12 }}>
              {recommendations.map((item: any) => (
                <TouchableOpacity
                  key={item.id}
                  style={{ width: RECENT_CARD_WIDTH }}
                  onPress={() => router.push({ pathname: '/(tabs)/product/[id]', params: { id: item.id } })}
                  activeOpacity={0.9}
                >
                  <View style={{
                    height: 160, backgroundColor: '#F5F5F5', borderRadius: 20,
                    marginBottom: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#EBEBEB',
                  }}>
                    {item.images?.[0] ? (
                      <ExpoImage
                        source={{ uri: item.images[0] }}
                        style={{ width: '100%', height: '100%' }}
                        contentFit="cover"
                        transition={200}
                        cachePolicy="memory-disk"
                      />
                    ) : (
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="image-outline" size={28} color="#EBEBEB" />
                      </View>
                    )}
                    {item._reason && (
                      <View style={{
                        position: 'absolute', top: 8, left: 8,
                        backgroundColor: 'rgba(0,87,255,0.9)', paddingHorizontal: 8, paddingVertical: 3,
                        borderRadius: 8,
                      }}>
                        <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '700' }}>{item._reason}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: BLUE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }} numberOfLines={1}>
                    {item.brand || item.category}
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#111', marginBottom: 3, lineHeight: 17 }} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#111', fontFamily: 'Outfit_700Bold' }}>
                    GH₵{item.price}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* Trending Section */}
        <View style={styles.sectionHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Trending</Text>
            {locationFilterLabel && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Ionicons name="location" size={12} color={BLUE} />
                <Text style={{ fontSize: 12, color: BLUE, fontWeight: '600' }}>{locationFilterLabel}</Text>
                <TouchableOpacity onPress={() => {
                  setLocation({ ...location, district: undefined, city: undefined });
                }}>
                  <Text style={{ fontSize: 12, color: '#8A8A8A' }}>· Show all</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={() => fetchListings(0, true)}>
            <Text style={styles.viewMore}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.productRow}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={styles.productCard}>
                <Skeleton width="100%" height={200} borderRadius={24} style={{ marginBottom: 12 }} />
                <Skeleton width={60} height={10} style={{ marginBottom: 6 }} />
                <Skeleton width="80%" height={16} style={{ marginBottom: 6 }} />
                <Skeleton width={80} height={18} />
              </View>
            ))}
          </View>
        ) : filteredListings.length === 0 ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={{ color: '#8A8A8A' }}>
              No approved listings found yet.
            </Text>
          </View>
        ) : (
          <View style={styles.productRow}>
            {filteredListings.map((item) => (
              <ProductCard
                key={item.id}
                item={item}
                isSaved={savedIds.has(item.id)}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </View>
        )}

        {isLoadingMore && (
          <View style={{ paddingVertical: 20, alignItems: 'center' }}>
            <ActivityIndicator color={BLUE} />
          </View>
        )}

        {!hasMore && listings.length > 0 && (
          <View style={{ paddingVertical: 30, alignItems: 'center' }}>
            <Text style={{ color: '#ABABAB', fontSize: 13, fontFamily: 'Inter_400Regular' }}>You've reached the end of our curated collection</Text>
          </View>
        )}
      </ScrollView>

      <LocationSelector
        visible={isLocationModalVisible}
        onClose={() => setIsLocationModalVisible(false)}
        onSelect={(data: any) => {
          setLocation(data);
          setIsLocationModalVisible(false);
        }}
        initialLocation={{ latitude: location.latitude, longitude: location.longitude }}
        title="Search Location"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerSafe: {
    backgroundColor: '#FFFFFF',
    zIndex: 100,
    overflow: 'visible',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  locationGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 10,
  },
  locationIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F0F4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationLabel: {
    fontSize: 12,
    color: '#8A8A8A',
    fontWeight: '500',
    marginBottom: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#EBEBEB',
  },
  statusDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 0,
  },
  searchSection: {
    paddingHorizontal: 24,
    paddingBottom: 12,
    zIndex: 200,
    overflow: 'visible',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    height: 52,
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#EBEBEB',
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: '#111111',
  },
  promoBanner: {
    width: width - 48,
    marginHorizontal: 24,
    borderRadius: 28, // More rounded for modern feel
    padding: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E0E0E0',
  },
  dotActive: {
    width: 14,
    backgroundColor: BLUE,
  },
  bannerShape: {
    position: 'absolute',
  },
  promoIconWrap: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoTextContainer: {
    flex: 1,
  },
  promoBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 10,
  },
  promoBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  promoTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  promoSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '500',
  },
  brandScroll: {
    paddingHorizontal: 24,
    gap: 16,
    marginBottom: 32,
  },
  brandCard: {
    alignItems: 'center',
    gap: 8,
  },
  brandIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#F0F4FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBDFFF',
    overflow: 'hidden',
  },
  brandLogo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    borderRadius: 20,
  },
  brandName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111111',
  },
  categoryWrap: {
    marginBottom: 32,
  },
  categoryScroll: {
    paddingHorizontal: 18,
  },
  catItem: {
    alignItems: 'center',
    marginHorizontal: 8,
    gap: 10,
  },
  catIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#DEE9FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catIconActive: {
    backgroundColor: BLUE, // Active Blue
    borderColor: BLUE,
  },
  catLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8A8A8A',
  },
  catLabelActive: {
    color: BLUE,
    fontWeight: '700',
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
  },
  viewMore: {
    fontSize: 14,
    color: BLUE,
    fontWeight: '600',
  },
  productRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 20,
  },
  productCard: {
    width: (width - 64) / 2,
  },
  imagePlaceholder: {
    height: 200,
    backgroundColor: '#F5F5F5',
    borderRadius: 24,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#EBEBEB',
  },
  tag: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: BLUE,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  favBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  productInfo: {
    paddingHorizontal: 4,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
  }
});
