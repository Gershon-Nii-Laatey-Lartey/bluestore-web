import FilterSheet, { DEFAULT_FILTERS, Filters } from '@/components/FilterSheet';
import { LocationSelector } from '@/components/LocationSelector';
import { ProductCard } from '@/components/ProductCard';
import SearchWithHistory from '@/components/SearchWithHistory';
import { Skeleton } from '@/components/Skeleton';
import { useLocation } from '@/context/LocationContext';
import { dataCache } from '@/lib/cache';
import { supabase } from '@/lib/supabase';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const PRODUCT_WIDTH = (width - 64) / 2;
const BLUE = '#0057FF';
const BRAND_GAP = 10;
const BRAND_TILE_SIZE = (width - 40 - (4 * BRAND_GAP)) / 5;

export default function CategoryDetailsScreen() {
    const { id, initialBrand } = useLocalSearchParams();
    const router = useRouter();

    // cast params to strings to avoid array/undefined issues
    const catId = typeof id === 'string' ? id : 'All';
    const startBrand = typeof initialBrand === 'string' ? initialBrand : 'All';

    const [selectedBrand, setSelectedBrand] = useState(startBrand);

    // Sync state with URL params when they change
    useEffect(() => {
        setSelectedBrand(startBrand);
    }, [catId, startBrand]);
    const { location, setLocation } = useLocation();
    const [isLocationModalVisible, setIsLocationModalVisible] = useState(false);

    const [searchQuery, setSearchQuery] = useState('');
    const [listings, setListings] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
    const ITEMS_PER_PAGE = 20;

    // Filters
    const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
    const [showFilterSheet, setShowFilterSheet] = useState(false);
    const activeFilterCount = [
        filters.sort !== 'newest',
        filters.priceMin !== '',
        filters.priceMax !== '',
        filters.condition !== 'All',
        filters.radius !== 'Anywhere',
        filters.brand !== 'All',
        filters.category !== 'All',
    ].filter(Boolean).length;

    const [dbBrands, setDbBrands] = useState<any[]>([{ name: 'All', icon: 'grid-outline' }]);
    const [isLoadingBrands, setIsLoadingBrands] = useState(true);
    const [brandPageIndex, setBrandPageIndex] = useState(0);
    const BRANDS_PER_PAGE = 9;

    const displayBrands = dbBrands.slice(
        brandPageIndex * BRANDS_PER_PAGE,
        (brandPageIndex + 1) * BRANDS_PER_PAGE
    );
    const hasMoreBrands = dbBrands.length > (brandPageIndex + 1) * BRANDS_PER_PAGE;

    const handleMoreBrands = () => {
        if (hasMoreBrands) {
            setBrandPageIndex(prev => prev + 1);
        } else {
            setBrandPageIndex(0); // Cycle back to the start
        }
    };

    useEffect(() => {
        const loadBrands = async () => {
            setIsLoadingBrands(true);
            try {
                if (id === 'All') {
                    // Load all brands globally
                    const { data: brandsData } = await supabase
                        .from('brands')
                        .select('id, name, logo_url, icon, is_featured, sort_order');
                    if (brandsData) {
                        setDbBrands([{ name: 'All', icon: 'grid-outline' }, ...brandsData]);
                    }
                } else {
                    // Get the category ID by name
                    const { data: catData } = await supabase
                        .from('categories')
                        .select('id')
                        .eq('name', id)
                        .single();

                    if (catData) {
                        const { data: brandsData } = await supabase
                            .from('category_brands')
                            .select('brands(id, name, logo_url, icon, is_featured, sort_order)')
                            .eq('category_id', catData.id);

                        if (brandsData) {
                            const fetched = brandsData.map((b: any) => b.brands).filter(Boolean);
                            setDbBrands([{ name: 'All', icon: 'grid-outline' }, ...fetched]);
                        }
                    }
                }
            } catch (err) {
                console.error('Error loading brands:', err);
            } finally {
                setIsLoadingBrands(false);
            }
        };
        loadBrands();
    }, [id]);

    const fetchListings = async (pageNum = 0, restart = false) => {
        const cacheKey = `cat_${id}_brand_${selectedBrand}_p${pageNum}`;
        const cached = pageNum === 0 ? dataCache.get(cacheKey) : null;

        if (cached) {
            setListings(cached);
            setIsLoading(false); // Hide shimmer immediately if we have cache
        } else if (pageNum === 0) {
            setIsLoading(true); // Only show main loading if no cache
        }

        if (pageNum > 0) setIsLoadingMore(true);

        try {
            const from = pageNum * ITEMS_PER_PAGE;
            const to = from + ITEMS_PER_PAGE - 1;

            let query = supabase
                .from('listings')
                .select('id, title, price, description, location, category, brand, condition, images, user_id, status, created_at, updated_at, location_structured, is_boosted')
                .eq('status', 'approved');

            if (catId && catId !== 'All') query = query.eq('category', catId);
            if (selectedBrand && selectedBrand !== 'All') query = query.eq('brand', selectedBrand);

            // Apply filters
            if (filters.condition !== 'All') query = query.eq('condition', filters.condition);
            if (filters.priceMin !== '') query = query.gte('price', parseFloat(filters.priceMin));
            if (filters.priceMax !== '') query = query.lte('price', parseFloat(filters.priceMax));
            if (filters.brand !== 'All') query = query.eq('brand', filters.brand);
            if (filters.category !== 'All') query = query.eq('category', filters.category);

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
                        // We use the most specific available tier that matches the manual chip selection (name)
                        const activeTier = tiers.find(t => t.val === location.name) || tiers[0];
                        query = query.contains('location_structured', { [activeTier.key]: activeTier.val });
                    }
                }
            }

            // Radius filter (Legacy fallback or radius explicitly set in filters)
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

            // Sort (Always prioritize boosts first)
            query = query.order('is_boosted', { ascending: false });

            switch (filters.sort) {
                case 'newest': query = query.order('created_at', { ascending: false }); break;
                case 'oldest': query = query.order('created_at', { ascending: true }); break;
                case 'price_asc': query = query.order('price', { ascending: true }); break;
                case 'price_desc': query = query.order('price', { ascending: false }); break;
                default: query = query.order('created_at', { ascending: false }); break;
            }

            const { data, error } = await query.range(from, to);
            if (error) throw error;

            if (restart) {
                setListings(data || []);
                dataCache.set(cacheKey, data);
            } else {
                setListings(prev => [...prev, ...(data || [])]);
            }

            setHasMore(data.length === ITEMS_PER_PAGE);
            setPage(pageNum);

            // Fetch saved listings for the current user once (on first load)
            if (pageNum === 0) {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
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
        }
    };

    useEffect(() => {
        fetchListings(0, true);
    }, [catId, selectedBrand, filters, location]);

    const fetchMore = () => {
        if (!isLoadingMore && hasMore) {
            fetchListings(page + 1);
        }
    };

    const isCloseToBottom = ({ layoutMeasurement, contentOffset, contentSize }: any) => {
        const paddingToBottom = 100;
        return layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    };

    const filteredProducts = listings.filter(p => {
        return p.title.toLowerCase().includes(searchQuery.toLowerCase());
    });

    return (
        <View style={styles.container}>
            {/* Header — needs zIndex so dropdown floats above ScrollView */}
            <SafeAreaView edges={['top']} style={styles.headerSafe}>
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
                        <TouchableOpacity
                            style={styles.headerBtn}
                            onPress={() => router.push('/saved')}
                        >
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
                        placeholder={`Search in ${id}...`}
                        onSubmit={(q) => router.push({ pathname: '/search/[query]', params: { query: q } })}
                        onSelectHistory={(q) => router.push({ pathname: '/search/[query]', params: { query: q } })}
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
                showsVerticalScrollIndicator={false}
                onScroll={({ nativeEvent }) => {
                    if (isCloseToBottom(nativeEvent)) {
                        fetchMore();
                    }
                }}
                scrollEventThrottle={400}
            >
                <View style={styles.categoryInfo}>
                    <Text style={styles.categoryTitle}>
                        {id === 'All' && selectedBrand !== 'All' ? selectedBrand : (id || 'Category')}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={styles.categoryCount}>{filteredProducts.length} listings available</Text>
                        {activeFilterCount > 0 && (
                            <TouchableOpacity onPress={() => setFilters(DEFAULT_FILTERS)}>
                                <Text style={{ fontSize: 13, color: BLUE, fontWeight: '600' }}>Clear filters</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Active Filter Chips */}
                {activeFilterCount > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, gap: 8, paddingBottom: 12 }}>
                        {filters.sort !== 'newest' && (
                            <View style={styles.activeChip}>
                                <Text style={styles.activeChipText}>
                                    {filters.sort === 'price_asc' ? 'Price ↑' : filters.sort === 'price_desc' ? 'Price ↓' : 'Oldest'}
                                </Text>
                                <TouchableOpacity onPress={() => setFilters(f => ({ ...f, sort: 'newest' }))}>
                                    <Ionicons name="close" size={12} color={BLUE} />
                                </TouchableOpacity>
                            </View>
                        )}
                        {(filters.priceMin || filters.priceMax) && (
                            <View style={styles.activeChip}>
                                <Text style={styles.activeChipText}>GH₵{filters.priceMin || '0'} – {filters.priceMax ? `GH₵${filters.priceMax}` : '∞'}</Text>
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

                {/* Brand Selection - show if we are in a selection state or a specific category */}
                {(id !== 'All' || selectedBrand === 'All') && (
                    <View style={styles.brandSection}>
                        <View style={styles.brandGrid}>
                            {isLoadingBrands ? (
                                [1, 2, 3, 4, 5].map((i) => (
                                    <View key={i} style={styles.brandWrapper}>
                                        <View style={[styles.brandItem, { backgroundColor: '#F9F9F9' }]}>
                                            <Skeleton width={32} height={32} borderRadius={16} />
                                        </View>
                                        <Skeleton width={30} height={10} style={{ marginTop: 8 }} />
                                    </View>
                                ))
                            ) : (
                                <>
                                    {displayBrands.map((brand: any) => (
                                        <TouchableOpacity
                                            key={brand.name}
                                            style={styles.brandWrapper}
                                            onPress={() => setSelectedBrand(brand.name)}
                                            activeOpacity={0.7}
                                        >
                                            <View
                                                style={[
                                                    styles.brandItem,
                                                    selectedBrand === brand.name && styles.brandItemActive
                                                ]}
                                            >
                                                {brand.logo_url ? (
                                                    <ExpoImage
                                                        source={{ uri: brand.logo_url }}
                                                        style={styles.brandLogo}
                                                        contentFit="cover"
                                                        transition={200}
                                                        cachePolicy="disk"
                                                    />
                                                ) : (
                                                    <Ionicons
                                                        name={(brand.icon || 'star-outline') as any}
                                                        size={20}
                                                        color={selectedBrand === brand.name ? '#FFFFFF' : '#111111'}
                                                    />
                                                )}
                                            </View>
                                            <Text
                                                style={[
                                                    styles.brandLabel,
                                                    selectedBrand === brand.name && styles.brandLabelActive
                                                ]}
                                                numberOfLines={1}
                                            >
                                                {brand.name}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                    {dbBrands.length > BRANDS_PER_PAGE && (
                                        <TouchableOpacity
                                            style={styles.brandWrapper}
                                            onPress={handleMoreBrands}
                                            activeOpacity={0.7}
                                        >
                                            <View style={[styles.brandItem, { borderStyle: 'dashed', borderColor: '#ABABAB' }]}>
                                                <Ionicons
                                                    name={hasMoreBrands ? "chevron-forward-outline" : "reload-outline"}
                                                    size={22}
                                                    color="#8A8A8A"
                                                />
                                            </View>
                                            <Text style={styles.brandLabel}>
                                                {hasMoreBrands ? "More" : "Back"}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </>
                            )}
                        </View>
                    </View>
                )}

                {/* Product Grid */}
                {isLoading ? (
                    <View style={styles.productGrid}>
                        {[1, 2, 3, 4].map((i) => (
                            <View key={i} style={styles.productCard}>
                                <Skeleton width={PRODUCT_WIDTH} height={180} borderRadius={24} style={{ marginBottom: 12 }} />
                                <Skeleton width={60} height={10} style={{ marginBottom: 6 }} />
                                <Skeleton width={PRODUCT_WIDTH * 0.8} height={16} style={{ marginBottom: 6 }} />
                                <Skeleton width={80} height={18} />
                            </View>
                        ))}
                    </View>
                ) : filteredProducts.length === 0 ? (
                    <View style={{ padding: 40, alignItems: 'center' }}>
                        <Text style={{ color: '#8A8A8A' }}>No listings found matching your criteria</Text>
                    </View>
                ) : (
                    <View style={styles.productGrid}>
                        {filteredProducts.map((item) => (
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

                <View style={{ height: 100 }} />
            </ScrollView>

            <FilterSheet
                visible={showFilterSheet}
                onClose={() => setShowFilterSheet(false)}
                onApply={(newFilters) => { setFilters(newFilters); }}
                currentFilters={filters}
            />

            <LocationSelector
                visible={isLocationModalVisible}
                onClose={() => setIsLocationModalVisible(false)}
                onSelect={(data: any) => {
                    setLocation(data);
                    setIsLocationModalVisible(false);
                }}
                initialLocation={{ latitude: location.latitude, longitude: location.longitude }}
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
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        gap: 10,
        zIndex: 200,
        overflow: 'visible',
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#F9F9F9',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#F2F2F2',
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        height: 48,
        borderRadius: 14,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: '#EBEBEB',
    },
    topHeader: {
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
        top: 12,
        right: 12,
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: BLUE,
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        fontSize: 14,
        color: '#111111',
    },
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
    activeChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 12, paddingVertical: 6,
        backgroundColor: '#EBF2FF', borderRadius: 20, borderWidth: 1, borderColor: '#C5D8FF',
    },
    activeChipText: { fontSize: 12, fontWeight: '600', color: BLUE },
    categoryInfo: {
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: 20,
    },
    categoryTitle: {
        fontSize: 22,
        color: '#111111',
        fontWeight: '700',
    },
    categoryCount: {
        fontSize: 14,
        color: '#8A8A8A',
        marginTop: 4,
    },
    brandSection: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 24,
    },
    brandGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: BRAND_GAP,
    },
    brandWrapper: {
        width: BRAND_TILE_SIZE,
        alignItems: 'center',
        gap: 8,
    },
    brandItem: {
        width: BRAND_TILE_SIZE,
        height: BRAND_TILE_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F9F9F9',
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: '#F2F2F2',
        overflow: 'hidden',
    },
    brandLogo: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    brandItemActive: {
        backgroundColor: '#111111',
        borderColor: '#111111',
    },
    brandLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: '#8A8A8A',
        textAlign: 'center',
    },
    brandLabelActive: {
        color: '#111111',
        fontWeight: '700',
    },
    productGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 24,
        paddingTop: 24,
        justifyContent: 'space-between',
        gap: 16,
    },
    productCard: {
        width: PRODUCT_WIDTH,
        marginBottom: 8,
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
    productDetails: {
        paddingHorizontal: 4,
    },
    pBrand: {
        fontSize: 9,
        color: BLUE,
        letterSpacing: 1,
        textTransform: 'uppercase',
        fontWeight: '700',
    },
    pName: {
        fontSize: 15,
        color: '#111111',
        marginVertical: 4,
        fontWeight: '600',
    },
    pPrice: {
        fontSize: 16,
        color: '#111111',
        fontWeight: '700',
    },
});
