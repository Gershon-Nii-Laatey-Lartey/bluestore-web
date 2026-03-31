import { Skeleton } from '@/components/Skeleton';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
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

interface ListingStats {
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

const SimpleLineGraph = ({ data, labels, color = BLUE }: { data: number[], labels: string[], color?: string }) => {
    if (data.length === 0) return null;

    const h = 80;
    const w = width - 96; // Adjust for 24px + 24px horizontal padding
    const max = Math.max(...data, 1);
    const step = w / (data.length - 1);

    const points = data.map((val, i) => ({
        x: i * step,
        y: h - (val / max) * (h - 20) - 10
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
                    strokeWidth="3"
                    strokeLinecap="round"
                />
            </Svg>
            <View style={styles.graphLabels}>
                {labels.map((label, i) => (
                    <Text key={i} style={styles.graphLabelText}>{label}</Text>
                ))}
            </View>
        </View>
    );
};

export default function AnalyticsScreen() {
    const router = useRouter();
    const [listings, setListings] = useState<ListingStats[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [totalSummary, setTotalSummary] = useState({
        views: 0,
        phoneViews: 0,
        impressions: 0
    });

    const [trafficData, setTrafficData] = useState<number[]>([]);
    const [trafficLabels, setTrafficLabels] = useState<string[]>([]);

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const fetchAnalytics = async () => {
        try {
            setIsLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('listings')
                .select('id, title, images, views, chats_count, calls_count, impressions_count, price, category')
                .eq('user_id', user.id)
                .order('views', { ascending: false });

            if (error) throw error;

            const typedData = data as ListingStats[];
            setListings(typedData);

            // Calculate totals
            const totalViews = typedData.reduce((acc, curr) => acc + (curr.views || 0), 0);
            const totalPhoneViews = typedData.reduce((acc, curr) => acc + (curr.calls_count || 0), 0);

            setTotalSummary({
                views: totalViews,
                phoneViews: totalPhoneViews,
                impressions: typedData.reduce((acc, curr) => acc + (curr.impressions_count || 0), 0)
            });

            // Fetch view history for the last 10 days
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
                .select('viewed_at, listings!inner(user_id)')
                .eq('listings.user_id', user.id)
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
            console.error('Analytics Error:', error);
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
                <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} style={styles.headerBtnSmall}>
                    <Ionicons name="chevron-back" size={20} color="#111111" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Store Performance</Text>
                <TouchableOpacity onPress={fetchAnalytics} style={styles.headerBtnSmall}>
                    <Ionicons name="refresh-outline" size={20} color={BLUE} />
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>

                {/* Main Graph Card */}
                <View style={styles.mainGraphCard}>
                    <View style={styles.graphHeader}>
                        <View>
                            <Text style={styles.graphHeading}>Visitor Traffic</Text>
                            <Text style={styles.graphSub}>Last 10 days</Text>
                        </View>
                        <View style={styles.trendBadge}>
                            <Ionicons name="trending-up" size={12} color="#27AE60" />
                            <Text style={styles.trendText}>Active</Text>
                        </View>
                    </View>
                    {isLoading ? (
                        <View style={{ height: 100, justifyContent: 'center' }}>
                            <Skeleton width="100%" height={80} borderRadius={12} />
                        </View>
                    ) : (
                        <SimpleLineGraph data={trafficData} labels={trafficLabels} />
                    )}
                </View>

                {/* Summary Cards */}
                <View style={styles.summaryGrid}>
                    <View style={styles.summaryCard}>
                        {isLoading ? (
                            <Skeleton width={38} height={38} borderRadius={12} />
                        ) : (
                            <View style={styles.summaryIconWrap}>
                                <Ionicons name="eye" size={18} color={BLUE} />
                            </View>
                        )}
                        <View style={styles.summaryContent}>
                            {isLoading ? (
                                <View style={{ gap: 4 }}>
                                    <Skeleton width={40} height={16} />
                                    <Skeleton width={60} height={10} />
                                </View>
                            ) : (
                                <>
                                    <Text style={styles.summaryValue}>{totalSummary.views.toLocaleString()}</Text>
                                    <View style={{ overflow: 'hidden' }}>
                                        <Text style={styles.summaryLabel} numberOfLines={1}>Total Views</Text>
                                    </View>
                                </>
                            )}
                        </View>
                    </View>

                    <View style={styles.summaryCard}>
                        {isLoading ? (
                            <Skeleton width={38} height={38} borderRadius={12} />
                        ) : (
                            <View style={[styles.summaryIconWrap, { backgroundColor: '#F0FFF4' }]}>
                                <Ionicons name="call" size={18} color="#27AE60" />
                            </View>
                        )}
                        <View style={styles.summaryContent}>
                            {isLoading ? (
                                <View style={{ gap: 4 }}>
                                    <Skeleton width={40} height={16} />
                                    <Skeleton width={60} height={10} />
                                </View>
                            ) : (
                                <>
                                    <Text style={[styles.summaryValue, { color: '#27AE60' }]}>{totalSummary.phoneViews}</Text>
                                    <View style={{ overflow: 'hidden' }}>
                                        <Text style={styles.summaryLabel} numberOfLines={1}>Phone Views</Text>
                                    </View>
                                </>
                            )}
                        </View>
                    </View>
                </View>

                <View style={styles.summaryGrid}>
                    <View style={styles.summaryCard}>
                        {isLoading ? (
                            <Skeleton width={38} height={38} borderRadius={12} />
                        ) : (
                            <View style={[styles.summaryIconWrap, { backgroundColor: '#FFF9F0' }]}>
                                <Ionicons name="megaphone" size={18} color="#F2994A" />
                            </View>
                        )}
                        <View style={styles.summaryContent}>
                            {isLoading ? (
                                <View style={{ gap: 4 }}>
                                    <Skeleton width={40} height={16} />
                                    <Skeleton width={60} height={10} />
                                </View>
                            ) : (
                                <>
                                    <Text style={[styles.summaryValue, { color: '#F2994A' }]}>{totalSummary.impressions.toLocaleString()}</Text>
                                    <View style={{ overflow: 'hidden' }}>
                                        <Text style={styles.summaryLabel} numberOfLines={1}>Impressions</Text>
                                    </View>
                                </>
                            )}
                        </View>
                    </View>
                    <View style={[styles.summaryCard, { backgroundColor: BLUE }]}>
                        {isLoading ? (
                            <Skeleton width={38} height={38} borderRadius={12} style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
                        ) : (
                            <View style={[styles.summaryIconWrap, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                                <Ionicons name="cube" size={18} color="#FFFFFF" />
                            </View>
                        )}
                        <View style={styles.summaryContent}>
                            {isLoading ? (
                                <View style={{ gap: 4 }}>
                                    <Skeleton width={40} height={16} style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
                                    <Skeleton width={60} height={10} style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
                                </View>
                            ) : (
                                <>
                                    <Text style={[styles.summaryValue, { color: '#FFFFFF' }]}>{listings.length}</Text>
                                    <View style={{ overflow: 'hidden' }}>
                                        <Text style={[styles.summaryLabel, { color: 'rgba(255,255,255,0.7)' }]} numberOfLines={1}>Active Shop</Text>
                                    </View>
                                </>
                            )}
                        </View>
                    </View>
                </View>

                {/* Product Breakdown */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Product Performance</Text>
                    <Text style={styles.sectionSub}>Tap for deep analytics</Text>
                </View>

                {isLoading ? (
                    [1, 2, 3].map(i => (
                        <View key={i} style={styles.productCard}>
                            <Skeleton width={64} height={64} borderRadius={16} />
                            <View style={[styles.productInfo, { gap: 8 }]}>
                                <Skeleton width="70%" height={16} />
                                <Skeleton width="40%" height={12} />
                            </View>
                        </View>
                    ))
                ) : (
                    listings.map((item) => (
                        <TouchableOpacity
                            key={item.id}
                            style={styles.productCard}
                            onPress={() => router.push({ pathname: '/analytics/product/[id]', params: { id: item.id } })}
                        >
                            <Image source={{ uri: item.images?.[0] }} style={styles.productImage} />
                            <View style={styles.productInfo}>
                                <Text style={styles.productTitle} numberOfLines={1}>{item.title}</Text>
                                <View style={styles.microStatsList}>
                                    <View style={styles.microStat}>
                                        <Text style={styles.microStatValue}>{item.views}</Text>
                                        <Text style={styles.microStatLabel}>Views</Text>
                                    </View>
                                    <View style={styles.divider} />
                                    <View style={styles.microStat}>
                                        <Text style={styles.microStatValue}>{item.chats_count || 0}</Text>
                                        <Text style={styles.microStatLabel}>Chats</Text>
                                    </View>
                                    <View style={styles.divider} />
                                    <View style={styles.microStat}>
                                        <Text style={styles.microStatValue}>{item.calls_count || 0}</Text>
                                        <Text style={styles.microStatLabel}>Phones</Text>
                                    </View>
                                </View>
                            </View>
                            <View style={styles.chevronWrap}>
                                <Ionicons name="chevron-forward" size={16} color="#BDBDBD" />
                            </View>
                        </TouchableOpacity>
                    ))
                )}

                {listings.length === 0 && (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIconCircle}>
                            <Ionicons name="bar-chart-outline" size={32} color="#D1D1D1" />
                        </View>
                        <Text style={styles.emptyText}>No Insights Yet</Text>
                        <Text style={styles.emptySub}>Your store data will appear here once your first product is listed.</Text>
                    </View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingVertical: 18,
    },
    headerTitle: { fontSize: 20, fontWeight: '800', color: '#111111', letterSpacing: -0.5 },
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
    scrollBody: { paddingHorizontal: 24, paddingTop: 4 },
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
        marginBottom: 20,
    },
    graphHeading: { fontSize: 16, fontWeight: '800', color: '#111111' },
    graphSub: { fontSize: 12, color: '#8A8A8A', marginTop: 2 },
    trendBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E0F9E9',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 4,
    },
    trendText: { fontSize: 11, fontWeight: '700', color: '#27AE60' },
    graphContainer: { width: '100%' },
    graphLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingHorizontal: 4 },
    graphLabelText: { fontSize: 10, fontWeight: '600', color: '#BDBDBD' },
    summaryGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    summaryCard: {
        flex: 1,
        backgroundColor: '#F5F5F5',
        borderRadius: 20,
        padding: 14,
        borderWidth: 1.5,
        borderColor: '#EBEBEB',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        overflow: 'hidden',
    },
    summaryContent: {
        flex: 1,
        justifyContent: 'center',
    },
    summaryIconWrap: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: '#F0F4FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    summaryValue: { fontSize: 15, fontWeight: '900', color: BLUE },
    summaryLabel: { fontSize: 9, fontWeight: '700', color: '#8A8A8A', textTransform: 'uppercase', marginTop: 1 },
    sectionHeader: { marginTop: 28, marginBottom: 16 },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: '#111111' },
    sectionSub: { fontSize: 12, color: '#8A8A8A', marginTop: 2 },
    productCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 24,
        marginBottom: 16,
        borderWidth: 1.5,
        borderColor: '#F5F5F5',
    },
    productImage: { width: 64, height: 64, borderRadius: 16, backgroundColor: '#F9F9F9' },
    productInfo: { flex: 1, marginLeft: 16 },
    productTitle: { fontSize: 16, fontWeight: '700', color: '#111111', marginBottom: 8 },
    microStatsList: { flexDirection: 'row', alignItems: 'center' },
    microStat: { alignItems: 'flex-start' },
    microStatValue: { fontSize: 13, fontWeight: '800', color: '#111111' },
    microStatLabel: { fontSize: 10, color: '#8A8A8A', fontWeight: '600' },
    divider: { width: 1, height: 16, backgroundColor: '#EBEBEB', marginHorizontal: 16 },
    chevronWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F9F9F9', alignItems: 'center', justifyContent: 'center' },
    emptyState: { alignItems: 'center', paddingVertical: 40 },
    emptyIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#F9F9F9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    emptyText: { fontSize: 18, fontWeight: '800', color: '#111111', marginBottom: 8 },
    emptySub: { fontSize: 14, color: '#8A8A8A', textAlign: 'center', paddingHorizontal: 44, lineHeight: 20 },
});

