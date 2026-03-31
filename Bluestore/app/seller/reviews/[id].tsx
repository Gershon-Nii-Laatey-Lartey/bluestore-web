import { Skeleton } from '@/components/Skeleton';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BLUE = '#0057FF';

export default function SellerReviewsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [reviews, setReviews] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [seller, setSeller] = useState<any>(null);
    const [stats, setStats] = useState({ avg: 0, total: 0 });

    useEffect(() => {
        fetchData();
    }, [id]);

    const fetchData = async () => {
        try {
            // Fetch seller info
            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, avatar_url')
                .eq('id', id)
                .single();
            setSeller(profile);

            // Fetch reviews
            const { data: reviewsData } = await supabase
                .from('reviews')
                .select('*, reviewer:profiles!reviewer_id(full_name, avatar_url)')
                .eq('receiver_id', id)
                .order('created_at', { ascending: false });

            setReviews(reviewsData || []);

            // Fetch stats
            const { data: statsData } = await supabase.rpc('get_seller_rating', { seller_uuid: id });
            if (statsData && statsData.length > 0) {
                setStats({
                    avg: statsData[0].avg_rating || 0,
                    total: statsData[0].total_reviews || 0
                });
            }
        } catch (error) {
            console.error('Error fetching reviews:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const renderReview = ({ item }: { item: any }) => (
        <View style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
                <View style={styles.reviewerInfo}>
                    <View style={styles.avatarMini}>
                        {item.reviewer?.avatar_url ? (
                            <Image source={{ uri: item.reviewer.avatar_url }} style={styles.avatarImg} />
                        ) : (
                            <View style={styles.avatarPlaceholder}>
                                <Text style={styles.avatarInitial}>{(item.reviewer?.full_name || 'B').charAt(0).toUpperCase()}</Text>
                            </View>
                        )}
                    </View>
                    <View>
                        <Text style={styles.reviewerName}>{item.reviewer?.full_name || 'Bluestore Buyer'}</Text>
                        <View style={styles.starsRow}>
                            {[1, 2, 3, 4, 5].map(s => (
                                <Ionicons
                                    key={s}
                                    name={item.rating >= s ? "star" : "star-outline"}
                                    size={12}
                                    color="#FFB800"
                                />
                            ))}
                        </View>
                    </View>
                </View>
                <Text style={styles.reviewDate}>
                    {new Date(item.created_at).toLocaleDateString()}
                </Text>
            </View>

            {item.comment && (
                <Text style={styles.reviewComment}>{item.comment}</Text>
            )}

            {item.is_verified && (
                <View style={styles.verifiedBadge}>
                    <View style={styles.verifiedIcon}>
                        <Ionicons name="checkmark" size={10} color="#00B850" />
                    </View>
                    <Text style={styles.verifiedText}>Verified Transaction</Text>
                </View>
            )}
        </View>
    );

    if (isLoading) {
        return (
            <SafeAreaView style={styles.safe}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={24} color="#111111" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>All Reviews</Text>
                    <View style={{ width: 44 }} />
                </View>
                <View style={{ padding: 20 }}>
                    <Skeleton width="100%" height={100} borderRadius={20} style={{ marginBottom: 20 }} />
                    <Skeleton width="100%" height={120} borderRadius={20} style={{ marginBottom: 20 }} />
                    <Skeleton width="100%" height={120} borderRadius={20} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safe}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color="#111111" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Seller Reviews</Text>
                <View style={{ width: 44 }} />
            </View>

            <FlatList
                data={reviews}
                keyExtractor={item => item.id}
                renderItem={renderReview}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={() => (
                    <View style={styles.statsCard}>
                        <View style={styles.statsMain}>
                            <Text style={styles.statsValue}>{Number(stats.avg).toFixed(1)}</Text>
                            <View style={styles.statsInfo}>
                                <View style={styles.bigStars}>
                                    {[1, 2, 3, 4, 5].map(s => (
                                        <Ionicons
                                            key={s}
                                            name={stats.avg >= s ? "star" : "star-outline"}
                                            size={20}
                                            color="#FFB800"
                                        />
                                    ))}
                                </View>
                                <Text style={styles.statsSubText}>Based on {stats.total} reviews</Text>
                            </View>
                        </View>
                        <View style={styles.sellerSummary}>
                            <Text style={styles.sellerSummaryText}>
                                Reviews for <Text style={{ fontWeight: '800' }}>{seller?.full_name || 'this seller'}</Text>
                            </Text>
                        </View>
                    </View>
                )}
                ListEmptyComponent={() => (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="chatbubble-outline" size={48} color="#EBEBEB" />
                        <Text style={styles.emptyText}>No reviews yet.</Text>
                    </View>
                )}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#FFFFFF' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F9F9F9',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#111111',
    },
    listContent: {
        padding: 20,
    },
    statsCard: {
        backgroundColor: BLUE,
        borderRadius: 24,
        padding: 24,
        marginBottom: 24,
        shadowColor: BLUE,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10,
    },
    statsMain: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    statsValue: {
        fontSize: 48,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    statsInfo: {
        flex: 1,
    },
    bigStars: {
        flexDirection: 'row',
        gap: 2,
        marginBottom: 4,
    },
    statsSubText: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.7)',
        fontWeight: '600',
    },
    sellerSummary: {
        marginTop: 20,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    sellerSummaryText: {
        fontSize: 14,
        color: '#FFFFFF',
    },
    reviewCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    reviewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    reviewerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    avatarMini: {
        width: 36,
        height: 36,
        borderRadius: 18,
        overflow: 'hidden',
    },
    avatarImg: {
        width: '100%',
        height: '100%',
    },
    avatarPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: '#F0F0F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInitial: {
        fontSize: 14,
        fontWeight: '700',
        color: '#8A8A8A',
    },
    reviewerName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111111',
    },
    starsRow: {
        flexDirection: 'row',
        gap: 2,
        marginTop: 2,
    },
    reviewDate: {
        fontSize: 11,
        color: '#ABABAB',
        fontWeight: '500',
    },
    reviewComment: {
        fontSize: 15,
        color: '#333333',
        lineHeight: 22,
        marginBottom: 16,
    },
    verifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#E8F8EE',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    verifiedIcon: {
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    verifiedText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#00B850',
    },
    emptyContainer: {
        paddingVertical: 60,
        alignItems: 'center',
    },
    emptyText: {
        marginTop: 12,
        fontSize: 15,
        color: '#ABABAB',
        fontWeight: '500',
    },
});
