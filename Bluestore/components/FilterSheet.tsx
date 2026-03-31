import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const BLUE = '#0057FF';

export type SortOption = 'newest' | 'oldest' | 'price_asc' | 'price_desc';
export type ConditionOption = 'All' | 'Brand New' | 'Like New' | 'Used - Good' | 'Used - Fair';

export interface Filters {
    sort: SortOption;
    priceMin: string;
    priceMax: string;
    condition: ConditionOption;
    radius: string;
    brand: string;
    category: string;
}

export const DEFAULT_FILTERS: Filters = {
    sort: 'newest',
    priceMin: '',
    priceMax: '',
    condition: 'All',
    radius: 'Anywhere',
    brand: 'All',
    category: 'All',
};

interface Props {
    visible: boolean;
    onClose: () => void;
    onApply: (filters: Filters) => void;
    currentFilters: Filters;
}

const SORT_OPTIONS: { label: string; value: SortOption }[] = [
    { label: 'Newest First', value: 'newest' },
    { label: 'Oldest First', value: 'oldest' },
    { label: 'Price: Low → High', value: 'price_asc' },
    { label: 'Price: High → Low', value: 'price_desc' },
];

const CONDITIONS: ConditionOption[] = ['All', 'Brand New', 'Like New', 'Used - Good', 'Used - Fair'];
const RADIUS_OPTIONS = ['Anywhere', '5km', '10km', '25km', '50km', '100km'];

export default function FilterSheet({ visible, onClose, onApply, currentFilters }: Props) {
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const overlayAnim = useRef(new Animated.Value(0)).current;

    const [sort, setSort] = useState<SortOption>(currentFilters.sort);
    const [priceMin, setPriceMin] = useState(currentFilters.priceMin);
    const [priceMax, setPriceMax] = useState(currentFilters.priceMax);
    const [condition, setCondition] = useState<ConditionOption>(currentFilters.condition);
    const [radius, setRadius] = useState(currentFilters.radius);
    const [brand, setBrand] = useState(currentFilters.brand);
    const [category, setCategory] = useState(currentFilters.category);

    const [dbBrands, setDbBrands] = useState<any[]>([]);
    const [dbCategories, setDbCategories] = useState<any[]>([]);

    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                // Fetch categories
                const { data: cats } = await supabase.from('categories').select('name, icon, color').order('name');
                if (cats) setDbCategories([{ name: 'All', icon: 'grid-outline' }, ...cats]);

                // Fetch brands
                const { data: brands } = await supabase.from('brands').select('name, logo_url, icon').order('name');
                if (brands) setDbBrands([{ name: 'All', icon: 'grid-outline' }, ...brands]);
            } catch (err) {
                console.error("FilterSheet: Data fetch error", err);
            }
        };
        fetchMetadata();
    }, []);

    // Sync local state when currentFilters change from outside
    useEffect(() => {
        setSort(currentFilters.sort);
        setPriceMin(currentFilters.priceMin);
        setPriceMax(currentFilters.priceMax);
        setCondition(currentFilters.condition);
        setRadius(currentFilters.radius);
        setBrand(currentFilters.brand);
        setCategory(currentFilters.category);
    }, [currentFilters, visible]);

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }),
                Animated.timing(overlayAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 250, useNativeDriver: true }),
                Animated.timing(overlayAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
            ]).start();
        }
    }, [visible]);

    const handleApply = () => {
        onApply({ sort, priceMin, priceMax, condition, radius, brand, category });
        onClose();
    };

    const handleReset = () => {
        setSort('newest');
        setPriceMin('');
        setPriceMax('');
        setCondition('All');
        setRadius('Anywhere');
        setBrand('All');
        setCategory('All');
    };

    const activeFilterCount = [
        sort !== 'newest',
        priceMin !== '',
        priceMax !== '',
        condition !== 'All',
        radius !== 'Anywhere',
        brand !== 'All',
        category !== 'All',
    ].filter(Boolean).length;

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
            {/* Overlay */}
            <Animated.View style={[styles.overlay, { opacity: overlayAnim }]}>
                <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
            </Animated.View>

            {/* Sheet */}
            <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
                {/* Handle */}
                <View style={styles.handle} />

                {/* Header */}
                <View style={styles.sheetHeader}>
                    <TouchableOpacity onPress={handleReset}>
                        <Text style={styles.resetText}>Reset{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</Text>
                    </TouchableOpacity>
                    <Text style={styles.sheetTitle}>Filters</Text>
                    <TouchableOpacity onPress={onClose}>
                        <Ionicons name="close" size={22} color="#111111" />
                    </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                    {/* Sort */}
                    <Text style={styles.sectionLabel}>Sort By</Text>
                    <View style={styles.chipRow}>
                        {SORT_OPTIONS.map(opt => (
                            <TouchableOpacity
                                key={opt.value}
                                style={[styles.chip, sort === opt.value && styles.chipActive]}
                                onPress={() => setSort(opt.value)}
                            >
                                <Text style={[styles.chipText, sort === opt.value && styles.chipTextActive]}>
                                    {opt.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Divider */}
                    <View style={styles.divider} />

                    {/* Price Range */}
                    <Text style={styles.sectionLabel}>Price Range (GH₵)</Text>
                    <View style={styles.priceRow}>
                        <View style={styles.priceInput}>
                            <Text style={styles.pricePrefix}>GH₵</Text>
                            <TextInput
                                style={styles.priceField}
                                placeholder="Min"
                                placeholderTextColor="#BABABA"
                                keyboardType="numeric"
                                value={priceMin}
                                onChangeText={setPriceMin}
                            />
                        </View>
                        <View style={styles.priceDivider} />
                        <View style={styles.priceInput}>
                            <Text style={styles.pricePrefix}>GH₵</Text>
                            <TextInput
                                style={styles.priceField}
                                placeholder="Max"
                                placeholderTextColor="#BABABA"
                                keyboardType="numeric"
                                value={priceMax}
                                onChangeText={setPriceMax}
                            />
                        </View>
                    </View>

                    {/* Divider */}
                    <View style={styles.divider} />

                    {/* Condition */}
                    <Text style={styles.sectionLabel}>Condition</Text>
                    <View style={styles.chipRow}>
                        {CONDITIONS.map(c => (
                            <TouchableOpacity
                                key={c}
                                style={[styles.chip, condition === c && styles.chipActive]}
                                onPress={() => setCondition(c)}
                            >
                                <Text style={[styles.chipText, condition === c && styles.chipTextActive]}>{c}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Divider */}
                    <View style={styles.divider} />

                    {/* Radius */}
                    <Text style={styles.sectionLabel}>Distance Radius</Text>
                    <View style={styles.chipRow}>
                        {RADIUS_OPTIONS.map(r => (
                            <TouchableOpacity
                                key={r}
                                style={[styles.chip, radius === r && styles.chipActive]}
                                onPress={() => setRadius(r)}
                            >
                                <Text style={[styles.chipText, radius === r && styles.chipTextActive]}>{r}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Divider */}
                    <View style={styles.divider} />

                    {/* Categories */}
                    <Text style={styles.sectionLabel}>Category</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                        <View style={styles.chipRow}>
                            {dbCategories.map(c => {
                                if (!c?.name) return null;
                                return (
                                    <TouchableOpacity
                                        key={c.name}
                                        style={[styles.chip, category === c.name && styles.chipActive]}
                                        onPress={() => setCategory(c.name)}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Ionicons
                                                name={(c.icon || 'cube-outline') as any}
                                                size={14}
                                                color={category === c.name ? '#FFFFFF' : (c.color || '#555555')}
                                            />
                                            <Text style={[styles.chipText, category === c.name && styles.chipTextActive]}>{c.name}</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </ScrollView>

                    {/* Divider */}
                    <View style={styles.divider} />

                    {/* Brands */}
                    <Text style={styles.sectionLabel}>Brand</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                        <View style={styles.chipRow}>
                            {dbBrands.map(b => {
                                if (!b?.name) return null;
                                return (
                                    <TouchableOpacity
                                        key={b.name}
                                        style={[styles.chip, brand === b.name && styles.chipActive]}
                                        onPress={() => setBrand(b.name)}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            {b.logo_url ? (
                                                <ExpoImage
                                                    source={{ uri: b.logo_url }}
                                                    style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFF' }}
                                                    contentFit="contain"
                                                />
                                            ) : (
                                                <Ionicons
                                                    name={(b.icon || 'star-outline') as any}
                                                    size={14}
                                                    color={brand === b.name ? '#FFFFFF' : '#555555'}
                                                />
                                            )}
                                            <Text style={[styles.chipText, brand === b.name && styles.chipTextActive]}>{b.name}</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </ScrollView>
                </ScrollView>

                {/* Apply Button */}
                <View style={styles.footer}>
                    <TouchableOpacity style={styles.applyBtn} onPress={handleApply} activeOpacity={0.85}>
                        <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                        <Text style={styles.applyText}>Apply Filters</Text>
                    </TouchableOpacity>
                </View>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    sheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        maxHeight: SCREEN_HEIGHT * 0.82,
        paddingBottom: 36,
    },
    handle: {
        width: 36, height: 4, borderRadius: 2,
        backgroundColor: '#E0E0E0',
        alignSelf: 'center',
        marginTop: 12, marginBottom: 4,
    },
    sheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    sheetTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#111111',
    },
    resetText: {
        fontSize: 14,
        color: BLUE,
        fontWeight: '600',
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 12,
    },
    sectionLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#8A8A8A',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 14,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 8,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderRadius: 20,
        backgroundColor: '#F5F5F5',
        borderWidth: 1.5,
        borderColor: '#EBEBEB',
    },
    chipActive: {
        backgroundColor: '#111111',
        borderColor: '#111111',
    },
    chipText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#555555',
    },
    chipTextActive: {
        color: '#FFFFFF',
    },
    divider: {
        height: 1,
        backgroundColor: '#F5F5F5',
        marginVertical: 24,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 8,
    },
    priceInput: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        height: 52,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#E5E5E5',
        paddingHorizontal: 14,
        gap: 6,
        backgroundColor: '#FAFAFA',
    },
    pricePrefix: {
        fontSize: 14,
        fontWeight: '600',
        color: '#8A8A8A',
    },
    priceField: {
        flex: 1,
        fontSize: 15,
        color: '#111111',
    },
    priceDivider: {
        width: 16,
        height: 1.5,
        backgroundColor: '#DDDDDD',
    },
    footer: {
        paddingHorizontal: 24,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#F5F5F5',
    },
    applyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: BLUE,
        borderRadius: 18,
        paddingVertical: 16,
    },
    applyText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});
