import FilterSheet, { DEFAULT_FILTERS, Filters } from '@/components/FilterSheet';
import { LocationSelector } from '@/components/LocationSelector';
import { ProductCard } from '@/components/ProductCard';
import SearchWithHistory from '@/components/SearchWithHistory';
import { Skeleton } from '@/components/Skeleton';
import { useLocation } from '@/context/LocationContext';
import { dataCache } from '@/lib/cache';
import { supabase } from '@/lib/supabase';
import { saveSearchQuery } from '@/lib/tracking';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    NativeScrollEvent,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const PRODUCT_WIDTH = (width - 64) / 2;
const BLUE = '#0057FF';

export default function SearchResultsScreen() {
    const params = useLocalSearchParams();
    const { query: initialQuery, showFilters: initialShowFilters } = params;
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState(initialQuery as string || '');
    const [listings, setListings] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

    const { location, setLocation } = useLocation();
    const [isLocationModalVisible, setIsLocationModalVisible] = useState(false);

    // Filter state
    const [filters, setFilters] = useState<Filters>(() => ({
        sort: (params.sort as any) || DEFAULT_FILTERS.sort,
        priceMin: (params.priceMin as string) || DEFAULT_FILTERS.priceMin,
        priceMax: (params.priceMax as string) || DEFAULT_FILTERS.priceMax,
        condition: (params.condition as any) || DEFAULT_FILTERS.condition,
        radius: (params.radius as string) || DEFAULT_FILTERS.radius,
        brand: (params.brand as string) || DEFAULT_FILTERS.brand,
        category: (params.category as string) || DEFAULT_FILTERS.category,
    }));
    const [showFilterSheet, setShowFilterSheet] = useState(initialShowFilters === 'true');
    const activeFilterCount = [
        filters.sort !== 'newest',
        filters.priceMin !== '',
        filters.priceMax !== '',
        filters.condition !== 'All',
        filters.radius !== 'Anywhere',
        filters.brand !== 'All',
        filters.category !== 'All',
    ].filter(Boolean).length;

    const ITEMS_PER_PAGE = 20;

    useEffect(() => {
        // Sync the visible input value when route params change
        setSearchQuery(initialQuery as string || '');
        fetchResults(0, true, initialQuery as string || '');
    }, [initialQuery, filters]);

    const fetchResults = async (pageNum = 0, isNewSearch = false, queryOverride?: string) => {
        // Use the passed query if available; fall back to current state
        const q = (queryOverride !== undefined ? queryOverride : searchQuery).trim();
        const cacheKey = `search_${q}_p${pageNum}`;
        const cached = pageNum === 0 ? dataCache.get(cacheKey) : null;

        if (cached && !isNewSearch) {
            setListings(cached);
            setIsLoading(false);
        }

        if (pageNum === 0 && !cached) {
            setIsLoading(true);
            if (q) saveSearchQuery(q);
        } else if (pageNum > 0) setIsLoadingMore(true);

        try {
            const from = pageNum * ITEMS_PER_PAGE;
            const to = from + ITEMS_PER_PAGE - 1;

            let query = supabase
                .from('listings')
                .select('id, title, price, description, location, category, brand, condition, images, user_id, status, created_at, updated_at, location_structured')
                .eq('status', 'approved');

            if (q) {
                query = query.or(`title.ilike.%${q}%,category.ilike.%${q}%,brand.ilike.%${q}%`);
            }

            // Apply filters
            if (filters.condition !== 'All') {
                query = query.eq('condition', filters.condition);
            }
            if (filters.priceMin !== '') {
                query = query.gte('price', parseFloat(filters.priceMin));
            }
            if (filters.priceMax !== '') {
                query = query.lte('price', parseFloat(filters.priceMax));
            }
            if (filters.brand !== 'All') {
                query = query.eq('brand', filters.brand);
            }
            if (filters.category !== 'All') {
                query = query.eq('category', filters.category);
            }

            // Holistic Geographic Filtering
            if (location) {
                // If "All [Country]" is selected, filter globally by country
                if (location.name?.startsWith('All ') || location.name === location.country) {
                    const countryName = location.country || location.name.replace('All ', '');
                    query = query.contains('location_structured', { country: countryName });
                } else {
                    // Specific scopes selected (Region, City, Suburb/District)
                    const tiers = [
                        location.district ? { key: 'district', val: location.district } : null,
                        location.city ? { key: 'city', val: location.city } : null,
                        location.region ? { key: 'region', val: location.region } : null,
                    ].filter(Boolean) as { key: string, val: string }[];

                    if (tiers.length > 0) {
                        // Use the most specific tier matching the manual selection
                        const activeTier = tiers.find(t => t.val === location.name) || tiers[0];
                        query = query.contains('location_structured', { [activeTier.key]: activeTier.val });
                    }
                }
            }

            // Radius filter (Explicit search filter)
            if (filters.radius !== 'Anywhere' && location.latitude && location.longitude) {
                const rKm = parseInt(filters.radius.replace('km', ''));
                const latDelta = rKm / 111.32;
                const lonDelta = rKm / (111.32 * Math.cos(location.latitude * (Math.PI / 180)));

                query = query
                    .filter('location_structured->latitude', 'gte', location.latitude - latDelta)
                    .filter('location_structured->latitude', 'lte', location.latitude + latDelta)
                    .filter('location_structured->longitude', 'gte', location.longitude - lonDelta)
                    .filter('location_structured->longitude', 'lte', location.longitude + lonDelta);
            }

            // Sort
            switch (filters.sort) {
                case 'newest': query = query.order('created_at', { ascending: false }); break;
                case 'oldest': query = query.order('created_at', { ascending: true }); break;
                case 'price_asc': query = query.order('price', { ascending: true }); break;
                case 'price_desc': query = query.order('price', { ascending: false }); break;
            }

            const { data, error } = await query.range(from, to);
            if (error) throw error;

            if (isNewSearch || pageNum === 0) {
                setListings(data || []);
                dataCache.set(cacheKey, data);
            } else {
                setListings(prev => [...prev, ...(data || [])]);
            }

            setHasMore(data.length === ITEMS_PER_PAGE);
            setPage(pageNum);

            const { data: { user } } = await supabase.auth.getUser();
            if (user && pageNum === 0) {
                const { data: savedData } = await supabase
                    .from('saved_listings').select('listing_id').eq('user_id', user.id);
                if (savedData) setSavedIds(new Set(savedData.map(s => s.listing_id)));
            }
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    };

    const handleSearch = () => {
        if (searchQuery.trim()) fetchResults(0, true);
    };

    const fetchMore = () => {
        if (!isLoadingMore && hasMore) fetchResults(page + 1);
    };

    const isCloseToBottom = ({ layoutMeasurement, contentOffset, contentSize }: NativeScrollEvent) => {
        return layoutMeasurement.height + contentOffset.y >= contentSize.height - 100;
    };

    const toggleFavorite = async (listingId: string) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                Alert.alert("Login Required", "Please log in to save items.");
                return;
            }

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
            console.error('Toggle favorite error:', error);
            // Could add a revert here too if needed, but search usually refreshes less often
        }
    };

    return (
        <View style={styles.container}>
            <SafeAreaView edges={['top']} style={styles.headerSafe}>
                {/* Location Row */}
                <View style={styles.topHeader}>
                    <TouchableOpacity
                        style={styles.locationGroup}
                        activeOpacity={0.7}
                        onPress={() => setIsLocationModalVisible(true)}
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
                        <TouchableOpacity style={styles.headerBtn}>
                            <Ionicons name="notifications-outline" size={22} color="#111111" />
                            <View style={styles.statusDot} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/saved')}>
                            <Ionicons name="heart-outline" size={22} color="#111111" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Search + Filter Row */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                        <Feather name="arrow-left" size={22} color="#111111" />
                    </TouchableOpacity>
                    <SearchWithHistory
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Search Bluestore..."
                        onSubmit={(q) => { fetchResults(0, true); }}
                        onSelectHistory={(q) => { setSearchQuery(q); fetchResults(0, true); }}
                        containerStyle={{ flex: 1, zIndex: 300 }}
                    />
                    {/* Filter Button */}
                    <TouchableOpacity
                        style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
                        onPress={() => setShowFilterSheet(true)}
                    >
                        <Ionicons name="options-outline" size={20} color={activeFilterCount > 0 ? '#FFFFFF' : '#111111'} />
                        {activeFilterCount > 0 && (
                            <View style={styles.filterBadge}>
                                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                onScroll={({ nativeEvent }) => { if (isCloseToBottom(nativeEvent)) fetchMore(); }}
                scrollEventThrottle={400}
                refreshControl={
                    <RefreshControl refreshing={false} onRefresh={() => fetchResults(0, true)} tintColor={BLUE} />
                }
            >
                {/* Results Header */}
                <View style={styles.resultsHeader}>
                    <Text style={styles.resultsCount}>
                        {isLoading ? 'Searching...' : `${listings.length}${hasMore ? '+' : ''} results found`}
                    </Text>
                    {activeFilterCount > 0 && (
                        <TouchableOpacity onPress={() => setFilters(DEFAULT_FILTERS)}>
                            <Text style={styles.clearFilters}>Clear filters</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Active Filter Chips */}
                {activeFilterCount > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeCips}>
                        {filters.sort !== 'newest' && (
                            <View style={styles.activeChip}>
                                <Text style={styles.activeChipText}>
                                    {filters.sort === 'price_asc' ? 'Price ↑' : filters.sort === 'price_desc' ? 'Price ↓' : filters.sort === 'oldest' ? 'Oldest' : ''}
                                </Text>
                                <TouchableOpacity onPress={() => setFilters(f => ({ ...f, sort: 'newest' }))}>
                                    <Ionicons name="close" size={12} color={BLUE} />
                                </TouchableOpacity>
                            </View>
                        )}
                        {(filters.priceMin || filters.priceMax) && (
                            <View style={styles.activeChip}>
                                <Text style={styles.activeChipText}>
                                    GH₵{filters.priceMin || '0'} – {filters.priceMax ? `GH₵${filters.priceMax}` : '∞'}
                                </Text>
                                <TouchableOpacity onPress={() => setFilters(f => ({ ...f, priceMin: '', priceMax: '' }))}>
                                    <Ionicons name="close" size={12} color={BLUE} />
                                </TouchableOpacity>
                            </View>
                        )}
                        {filters.condition !== 'All' && (
                            <View style={styles.activeChip}>
                                <Text style={styles.activeChipText}>{filters.condition}</Text>
                                <TouchableOpacity onPress={() => setFilters(f => ({ ...f, condition: 'All' }))}>
                                    <Ionicons name="close" size={12} color={BLUE} />
                                </TouchableOpacity>
                            </View>
                        )}
                        {filters.radius !== 'Anywhere' && (
                            <View style={styles.activeChip}>
                                <Text style={styles.activeChipText}>Within {filters.radius}</Text>
                                <TouchableOpacity onPress={() => setFilters(f => ({ ...f, radius: 'Anywhere' }))}>
                                    <Ionicons name="close" size={12} color={BLUE} />
                                </TouchableOpacity>
                            </View>
                        )}
                        {filters.category !== 'All' && (
                            <View style={styles.activeChip}>
                                <Text style={styles.activeChipText}>{filters.category}</Text>
                                <TouchableOpacity onPress={() => setFilters(f => ({ ...f, category: 'All' }))}>
                                    <Ionicons name="close" size={12} color={BLUE} />
                                </TouchableOpacity>
                            </View>
                        )}
                        {filters.brand !== 'All' && (
                            <View style={styles.activeChip}>
                                <Text style={styles.activeChipText}>{filters.brand}</Text>
                                <TouchableOpacity onPress={() => setFilters(f => ({ ...f, brand: 'All' }))}>
                                    <Ionicons name="close" size={12} color={BLUE} />
                                </TouchableOpacity>
                            </View>
                        )}
                    </ScrollView>
                )}

                {isLoading ? (
                    <View style={styles.grid}>
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <View key={i} style={styles.productCard}>
                                <Skeleton width={PRODUCT_WIDTH} height={180} borderRadius={24} style={{ marginBottom: 12 }} />
                                <Skeleton width={60} height={10} style={{ marginBottom: 6 }} />
                                <Skeleton width={PRODUCT_WIDTH * 0.8} height={16} style={{ marginBottom: 6 }} />
                                <Skeleton width={80} height={18} />
                            </View>
                        ))}
                    </View>
                ) : listings.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="search-outline" size={64} color="#EBEBEB" />
                        <Text style={styles.emptyText}>No results found</Text>
                        <Text style={styles.emptySub}>Try adjusting your search or filters</Text>
                        {activeFilterCount > 0 && (
                            <TouchableOpacity style={styles.resetFilterBtn} onPress={() => setFilters(DEFAULT_FILTERS)}>
                                <Text style={styles.resetFilterText}>Clear all filters</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    <View style={styles.grid}>
                        {listings.map((item) => (
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
                    <View style={styles.loader}>
                        <ActivityIndicator color={BLUE} />
                    </View>
                )}
                {!hasMore && listings.length > 0 && (
                    <View style={styles.endMessage}>
                        <Text style={styles.endText}>You've seen everything!</Text>
                    </View>
                )}
                <View style={{ height: 40 }} />
            </ScrollView>

            <FilterSheet
                visible={showFilterSheet}
                onClose={() => setShowFilterSheet(false)}
                onApply={(newFilters) => { setFilters(newFilters); fetchResults(0, true); }}
                currentFilters={filters}
            />

            <LocationSelector
                visible={isLocationModalVisible}
                onClose={() => setIsLocationModalVisible(false)}
                onSelect={(data: any) => { setLocation(data); setIsLocationModalVisible(false); }}
                initialLocation={{ latitude: location.latitude, longitude: location.longitude }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    headerSafe: { backgroundColor: '#FFFFFF', zIndex: 100, overflow: 'visible' },
    topHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 24, paddingVertical: 12,
    },
    locationGroup: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 10 },
    locationIconWrap: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#F0F4FF', alignItems: 'center', justifyContent: 'center' },
    locationText: { fontSize: 14, fontWeight: '700', color: '#111111' },
    headerActions: { flexDirection: 'row', gap: 8 },
    headerBtn: {
        width: 44, height: 44, borderRadius: 14, backgroundColor: '#F5F5F5',
        alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#EBEBEB',
    },
    statusDot: {
        position: 'absolute', top: 12, right: 12,
        width: 6, height: 6, borderRadius: 3, backgroundColor: BLUE,
    },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, gap: 10, zIndex: 200, overflow: 'visible' },
    backBtn: {
        width: 44, height: 44, borderRadius: 14, backgroundColor: '#F9F9F9',
        alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F2F2F2',
    },
    searchBar: {
        flex: 1, flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#F5F5F5', height: 48, borderRadius: 14,
        paddingHorizontal: 16, borderWidth: 1, borderColor: '#EBEBEB',
    },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 14, color: '#111111', fontFamily: 'Inter_500Medium' },
    filterBtn: {
        width: 44, height: 44, borderRadius: 14, backgroundColor: '#F5F5F5',
        alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#EBEBEB',
    },
    filterBtnActive: { backgroundColor: '#111111', borderColor: '#111111' },
    filterBadge: {
        position: 'absolute', top: -4, right: -4,
        width: 16, height: 16, borderRadius: 8, backgroundColor: BLUE,
        alignItems: 'center', justifyContent: 'center',
    },
    filterBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF' },
    resultsHeader: {
        paddingHorizontal: 24, paddingVertical: 14,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    resultsCount: { fontSize: 13, color: '#8A8A8A', fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.5 },
    clearFilters: { fontSize: 13, color: BLUE, fontWeight: '600' },
    activeCips: { paddingHorizontal: 24, paddingBottom: 14, gap: 8 },
    activeChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 12, paddingVertical: 6,
        backgroundColor: '#EBF2FF', borderRadius: 20, borderWidth: 1, borderColor: '#C5D8FF',
    },
    activeChipText: { fontSize: 12, fontWeight: '600', color: BLUE },
    grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 24, justifyContent: 'space-between', gap: 16 },
    productCard: { width: PRODUCT_WIDTH, marginBottom: 8 },
    emptyContainer: { paddingTop: 80, alignItems: 'center' },
    emptyText: { fontSize: 18, color: '#111111', fontWeight: '700', marginTop: 16 },
    emptySub: { fontSize: 14, color: '#8A8A8A', marginTop: 8 },
    resetFilterBtn: {
        marginTop: 20, paddingHorizontal: 24, paddingVertical: 12,
        borderRadius: 14, borderWidth: 1.5, borderColor: BLUE,
    },
    resetFilterText: { fontSize: 14, fontWeight: '600', color: BLUE },
    loader: { paddingVertical: 20, alignItems: 'center' },
    endMessage: { paddingVertical: 40, alignItems: 'center' },
    endText: { fontSize: 13, color: '#ABABAB' },
});
