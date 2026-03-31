import { Skeleton } from '@/components/Skeleton';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Dimensions,
    Image,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Path, Svg } from 'react-native-svg';

const { width } = Dimensions.get('window');
const BLUE = '#0057FF';

interface ProductStats {
    id: string;
    title: string;
    images: string[];
    views: number;
    chats_count: number;
    calls_count: number;
    impressions_count: number;
    price: number;
    category: string;
}

const AnalyticsLineGraph = ({ data, labels, color = BLUE }: { data: number[], labels: string[], color?: string }) => {
    if (data.length === 0) return null;

    const h = 100;
    const w = width - 96; // Adjust for 24px + 24px horizontal padding
    const max = Math.max(...data, 1);
    const step = w / (data.length - 1);

    const points = data.map((val, i) => ({
        x: i * step,
        y: h - (val / max) * (h - 40) - 20
    }));

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
        const p0 = points[i - 1];
        const p1 = points[i];
        const cp1x = p0.x + (p1.x - p0.x) / 2;
        d += ` C ${cp1x} ${p0.y}, ${cp1x} ${p1.y}, ${p1.x} ${p1.y}`;
    }

    return (
        <View style={styles.graphContainer}>
            <Svg height={h} width={w}>
                <Path
                    d={d}
                    fill="none"
                    stroke={color}
                    strokeWidth="4"
                    strokeLinecap="round"
                />
                <View style={[styles.graphDot, { left: points[points.length - 1].x - 4, top: points[points.length - 1].y - 4, backgroundColor: color }]} />
            </Svg>
            <View style={styles.graphLabels}>
                {labels.map((label, i) => (
                    <Text key={i} style={styles.graphLabelText}>{label}</Text>
                ))}
            </View>
        </View>
    );
};

export default function ProductAnalyticsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [product, setProduct] = useState<ProductStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [trafficData, setTrafficData] = useState<number[]>([]);
    const [trafficLabels, setTrafficLabels] = useState<string[]>([]);

    useEffect(() => {
        fetchProductStats();
    }, [id]);

    const fetchProductStats = async () => {
        try {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('listings')
                .select('id, title, images, views, chats_count, calls_count, impressions_count, price, category')
                .eq('id', id)
                .single();

            if (error) throw error;
            setProduct(data as ProductStats);

            // Fetch daily traffic for this specific listing
            const labels = [];
            const tenDaysAgo = new Date();
            tenDaysAgo.setDate(tenDaysAgo.getDate() - 9);
            tenDaysAgo.setHours(0, 0, 0, 0);

            for (let i = 0; i < 10; i++) {
                const d = new Date(tenDaysAgo);
                d.setDate(d.getDate() + i);
                labels.push(d.toLocaleDateString('en-US', { weekday: 'narrow' }));
            }
            setTrafficLabels(labels);

            const { data: viewsHistory, error: viewsError } = await supabase
                .from('viewed_listings')
                .select('viewed_at')
                .eq('listing_id', id)
                .gte('viewed_at', tenDaysAgo.toISOString());

            if (!viewsError && viewsHistory) {
                const counts = new Array(10).fill(0);
                viewsHistory.forEach(v => {
                    const viewDate = new Date(v.viewed_at);
                    const diffDays = Math.floor((viewDate.getTime() - tenDaysAgo.getTime()) / (1000 * 60 * 60 * 24));
                    if (diffDays >= 0 && diffDays < 10) {
                        counts[diffDays]++;
                    }
                });
                setTrafficData(counts);
            } else {
                setTrafficData(new Array(10).fill(0));
            }
        } catch (error) {
            console.error('Error fetching product stats:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" />
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBtnSmall}>
                    <Ionicons name="chevron-back" size={20} color="#111111" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Product Insights</Text>
                <TouchableOpacity onPress={fetchProductStats} style={styles.headerBtnSmall}>
                    <Ionicons name="refresh-outline" size={20} color={BLUE} />
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>

                {/* Product Summary Header */}
                <View style={styles.productIntro}>
                    {isLoading || !product ? (
                        <>
                            <Skeleton width={70} height={70} borderRadius={12} />
                            <View style={[styles.introContent, { gap: 8 }]}>
                                <Skeleton width="80%" height={16} />
                                <Skeleton width="40%" height={14} />
                            </View>
                        </>
                    ) : (
                        <>
                            <Image source={{ uri: product.images?.[0] }} style={styles.introImage} />
                            <View style={styles.introContent}>
                                <Text style={styles.introTitle} numberOfLines={2}>{product.title}</Text>
                                <Text style={styles.introPrice}>GH₵{product.price}</Text>
                            </View>
                        </>
                    )}
                </View>

                {/* Main Action Button - Moved from bottom for better UX */}
                <TouchableOpacity
                    style={styles.viewInShopBtn}
                    onPress={() => product && router.push({ pathname: '/product/[id]', params: { id: product.id } })}
                >
                    <View style={styles.viewInShopIcon}>
                        <Ionicons name="cart" size={18} color="#FFFFFF" />
                    </View>
                    <Text style={styles.viewInShopText}>View Listing in Shop</Text>
                    <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>

                {/* Main Graph Card */}
                <View style={styles.mainGraphCard}>
                    <View style={styles.graphHeader}>
                        <View>
                            <Text style={styles.graphHeading}>Visitor Engagement</Text>
                            <Text style={styles.graphSub}>Daily views over last 10 days</Text>
                        </View>
                        <View style={styles.trendBadge}>
                            <Ionicons name="trending-up" size={12} color="#27AE60" />
                            <Text style={styles.trendText}>Active</Text>
                        </View>
                    </View>
                    {isLoading ? (
                        <View style={{ height: 100, justifyContent: 'center' }}>
                            <Skeleton width="100%" height={100} borderRadius={12} />
                        </View>
                    ) : (
                        <AnalyticsLineGraph data={trafficData} labels={trafficLabels} />
                    )}
                </View>

                {/* Stats Tiles - Minimal Gray Style */}
                <View style={styles.statsGrid}>
                    <View style={styles.statTile}>
                        {isLoading || !product ? (
                            <View style={{ gap: 8 }}>
                                <Skeleton width={32} height={32} borderRadius={10} />
                                <Skeleton width={40} height={18} />
                                <Skeleton width={60} height={10} />
                            </View>
                        ) : (
                            <>
                                <View style={styles.tileIconWrap}>
                                    <Ionicons name="eye" size={20} color={BLUE} />
                                </View>
                                <Text style={styles.tileValue}>{product.views}</Text>
                                <Text style={styles.tileLabel}>Total Views</Text>
                            </>
                        )}
                    </View>

                    <View style={styles.statTile}>
                        {isLoading || !product ? (
                            <View style={{ gap: 8 }}>
                                <Skeleton width={32} height={32} borderRadius={10} />
                                <Skeleton width={40} height={18} />
                                <Skeleton width={60} height={10} />
                            </View>
                        ) : (
                            <>
                                <View style={[styles.tileIconWrap, { backgroundColor: '#F0FFF4' }]}>
                                    <Ionicons name="call" size={20} color="#27AE60" />
                                </View>
                                <Text style={[styles.tileValue, { color: '#27AE60' }]}>{product.calls_count || 0}</Text>
                                <Text style={styles.tileLabel}>Phone Views</Text>
                            </>
                        )}
                    </View>
                </View>

                <View style={styles.statsGrid}>
                    <View style={styles.statTile}>
                        {isLoading || !product ? (
                            <View style={{ gap: 8 }}>
                                <Skeleton width={32} height={32} borderRadius={10} />
                                <Skeleton width={40} height={18} />
                                <Skeleton width={60} height={10} />
                            </View>
                        ) : (
                            <>
                                <View style={[styles.tileIconWrap, { backgroundColor: '#FFF9F0' }]}>
                                    <Ionicons name="megaphone" size={20} color="#F2994A" />
                                </View>
                                <Text style={[styles.tileValue, { color: '#F2994A' }]}>{(product?.impressions_count || 0).toLocaleString()}</Text>
                                <Text style={styles.tileLabel}>Impressions</Text>
                            </>
                        )}
                    </View>
                    <View style={styles.statTile}>
                        {isLoading || !product ? (
                            <View style={{ gap: 8 }}>
                                <Skeleton width={32} height={32} borderRadius={10} />
                                <Skeleton width={40} height={18} />
                                <Skeleton width={60} height={10} />
                            </View>
                        ) : (
                            <>
                                <View style={[styles.tileIconWrap, { backgroundColor: '#F0F4FF' }]}>
                                    <Ionicons name="chatbubbles" size={20} color={BLUE} />
                                </View>
                                <Text style={styles.tileValue}>{product.chats_count || 0}</Text>
                                <Text style={styles.tileLabel}>Chat Enquiries</Text>
                            </>
                        )}
                    </View>
                </View>

                {/* Suggestions / Insights Section */}
                <View style={styles.insightsSection}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="bulb-outline" size={20} color={BLUE} />
                        <Text style={styles.sectionTitle}>Seller Tips</Text>
                    </View>

                    <View style={styles.insightItem}>
                        <View style={styles.insightBullet} />
                        <Text style={styles.insightText}>Consider adding more photos to increase engagement by up to 20%.</Text>
                    </View>
                    <View style={styles.insightItem}>
                        <View style={styles.insightBullet} />
                        <Text style={styles.insightText}>Listing views are highest on weekends. Try refreshing your items then.</Text>
                    </View>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingVertical: 18,
    },
    headerTitle: { fontSize: 18, fontWeight: '800', color: '#111111', letterSpacing: -0.5 },
    headerBtnSmall: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#EBEBEB',
    },
    scrollBody: { paddingHorizontal: 24, paddingTop: 10 },
    productIntro: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        backgroundColor: '#F9F9F9',
        padding: 16,
        borderRadius: 20,
    },
    introImage: { width: 70, height: 70, borderRadius: 12, backgroundColor: '#EBEBEB' },
    introContent: { flex: 1, marginLeft: 16 },
    introTitle: { fontSize: 16, fontWeight: '700', color: '#111111', marginBottom: 4 },
    introPrice: { fontSize: 14, fontWeight: '800', color: BLUE },
    viewInShopBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#111111',
        padding: 12,
        borderRadius: 16,
        marginBottom: 24,
    },
    viewInShopIcon: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: BLUE,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    viewInShopText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
    mainGraphCard: {
        width: '100%',
        backgroundColor: '#F5F5F5',
        borderRadius: 24,
        padding: 24,
        marginBottom: 20,
        borderWidth: 1.5,
        borderColor: '#EBEBEB',
    },
    graphHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    graphHeading: { fontSize: 15, fontWeight: '800', color: '#111111' },
    graphSub: { fontSize: 11, color: '#8A8A8A', marginTop: 1 },
    trendBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E0F9E9',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 6,
        gap: 3,
    },
    trendText: { fontSize: 10, fontWeight: '700', color: '#27AE60' },
    graphContainer: { width: '100%' },
    graphLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingHorizontal: 4 },
    graphLabelText: { fontSize: 10, fontWeight: '600', color: '#BDBDBD' },
    graphDot: { width: 6, height: 6, borderRadius: 3, position: 'absolute', borderWidth: 1.5, borderColor: '#FFFFFF' },
    statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    statTile: {
        flex: 1,
        backgroundColor: '#F5F5F5',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1.5,
        borderColor: '#EBEBEB',
    },
    tileIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: '#F0F4FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    tileValue: { fontSize: 18, fontWeight: '900', color: BLUE, marginBottom: 2 },
    tileLabel: { fontSize: 10, fontWeight: '700', color: '#8A8A8A', textTransform: 'uppercase' },
    insightsSection: {
        marginTop: 10,
        backgroundColor: '#FAFAFA',
        padding: 18,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: '#F0F0F0',
    },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    sectionTitle: { fontSize: 15, fontWeight: '800', color: '#111111' },
    insightItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
    insightBullet: { width: 4, height: 4, borderRadius: 2, backgroundColor: BLUE, marginTop: 7 },
    insightText: { flex: 1, fontSize: 12, color: '#666', lineHeight: 16 },
});
