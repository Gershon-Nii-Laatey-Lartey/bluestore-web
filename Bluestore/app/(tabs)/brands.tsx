import { Skeleton } from '@/components/Skeleton';
import { dataCache } from '@/lib/cache';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Dimensions,
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 60) / 3;
const BLUE = '#0057FF';

export default function BrandsScreen() {
    const router = useRouter();
    const [brands, setBrands] = useState<any[]>([]);
    const [filteredBrands, setFilteredBrands] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchBrands();
    }, []);

    useEffect(() => {
        if (searchQuery.trim() === '') {
            setFilteredBrands(brands);
        } else {
            const filtered = brands.filter(b =>
                b.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
            setFilteredBrands(filtered);
        }
    }, [searchQuery, brands]);

    const fetchBrands = async () => {
        const cached = dataCache.get('all_brands');
        if (cached) {
            setBrands(cached);
            setFilteredBrands(cached);
            setIsLoading(false);
        } else {
            setIsLoading(true);
        }

        try {
            const { data, error } = await supabase
                .from('brands')
                .select('*')
                .order('name');

            if (data) {
                setBrands(data);
                setFilteredBrands(data);
                dataCache.set('all_brands', data);
            }
            if (error) throw error;
        } catch (error) {
            console.error('Error fetching brands:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const renderBrandItem = ({ item }: { item: any }) => (
        <TouchableOpacity
            style={styles.brandCard}
            onPress={() => router.push({
                pathname: "/category/[id]",
                params: { id: "All", initialBrand: item.name }
            })}
        >
            <View style={styles.brandIconWrap}>
                {item.logo_url ? (
                    <ExpoImage
                        source={{ uri: item.logo_url }}
                        style={styles.brandLogo}
                        contentFit="cover"
                        transition={200}
                        cachePolicy="disk"
                    />
                ) : (
                    <Ionicons name={(item.icon || 'star-outline') as any} size={40} color="#111111" />
                )}
            </View>
            <Text style={styles.brandName} numberOfLines={1}>{item.name}</Text>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#111111" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>All Brands</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.searchSection}>
                <View style={styles.searchBar}>
                    <Ionicons name="search-outline" size={20} color="#ABABAB" />
                    <TextInput
                        placeholder="Search brands..."
                        placeholderTextColor="#BABABA"
                        style={styles.searchInput}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
            </View>

            {isLoading ? (
                <FlatList
                    data={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]}
                    renderItem={() => (
                        <View style={styles.brandCard}>
                            <View style={[styles.brandIconWrap, { backgroundColor: '#F9F9F9', borderColor: '#F5F5F5' }]}>
                                <Skeleton width={40} height={40} borderRadius={20} />
                            </View>
                            <Skeleton width={60} height={12} style={{ marginTop: 8 }} />
                        </View>
                    )}
                    numColumns={3}
                    contentContainerStyle={styles.listContent}
                />
            ) : (
                <FlatList
                    data={filteredBrands}
                    renderItem={renderBrandItem}
                    keyExtractor={(item) => item.id}
                    numColumns={3}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyWrap}>
                            <Ionicons name="search-outline" size={48} color="#EBEBEB" />
                            <Text style={styles.emptyText}>No brands found</Text>
                            <Text style={styles.emptySub}>Try searching for something else</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F8F8F8',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#111111',
        fontFamily: 'Inter_700Bold',
    },
    searchSection: {
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        height: 50,
        borderRadius: 14,
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
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 40,
        paddingTop: 10,
    },
    brandCard: {
        width: COLUMN_WIDTH,
        alignItems: 'center',
        marginBottom: 24,
        marginHorizontal: 4,
    },
    brandIconWrap: {
        width: COLUMN_WIDTH - 10,
        height: COLUMN_WIDTH - 10,
        borderRadius: 24,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#EBEBEB',
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
        overflow: 'hidden',
    },
    brandLogo: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
        borderRadius: 24,
    },
    brandName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111111',
        textAlign: 'center',
    },
    emptyWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111111',
        marginTop: 16,
    },
    emptySub: {
        fontSize: 14,
        color: '#8A8A8A',
        textAlign: 'center',
        marginTop: 8,
    },
});
