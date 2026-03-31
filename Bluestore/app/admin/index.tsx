import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

const { width } = Dimensions.get('window');
const BLUE = '#0057FF';

export default function AdminDashboard() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState({
        total_users: 0,
        total_listings: 0,
        pending_approvals: 0,
        active_reports: 0,
        verified_sellers: 0
    });

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const { data, error } = await supabase.rpc('get_admin_stats');
            if (error) throw error;
            if (data) setStats(data);
        } catch (error) {
            console.error('Error fetching admin stats:', error);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchStats();
    };

    const StatCard = ({ title, value, icon, color, onPress }: any) => (
        <TouchableOpacity style={styles.card} onPress={onPress}>
            <View style={[styles.iconBox, { backgroundColor: color + '15' }]}>
                <Ionicons name={icon} size={24} color={color} />
            </View>
            <View>
                <Text style={styles.cardValue}>{value}</Text>
                <Text style={styles.cardTitle}>{title}</Text>
            </View>
        </TouchableOpacity>
    );

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator color={BLUE} size="large" />
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BLUE} />}
        >
            <Stack.Screen options={{ title: 'Admin Overview' }} />

            <View style={styles.grid}>
                <StatCard
                    title="Total Users"
                    value={stats.total_users}
                    icon="people-outline"
                    color="#0057FF"
                    onPress={() => router.push('/admin/users')}
                />
                <StatCard
                    title="Pending Ops"
                    value={stats.pending_approvals}
                    icon="time-outline"
                    color="#FFB800"
                    onPress={() => router.push('/admin/listings')}
                />
                <StatCard
                    title="Active Reports"
                    value={stats.active_reports}
                    icon="shield-sharp"
                    color="#FF4136"
                    onPress={() => router.push('/admin/reports' as any)}
                />
                <StatCard
                    title="Verified Sellers"
                    value={stats.verified_sellers}
                    icon="checkmark-circle-outline"
                    color="#00B850"
                    onPress={() => router.push('/admin/users' as any)}
                />
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <View style={styles.actionsRow}>
                    <TouchableOpacity style={styles.actionItem} onPress={() => router.push('/admin/reports')}>
                        <View style={[styles.actionIcon, { backgroundColor: '#FFEDEA' }]}>
                            <Ionicons name="warning" size={24} color="#FF4136" />
                        </View>
                        <Text style={styles.actionLabel}>Moderation Center</Text>
                        <Text style={styles.actionSub}>Review pending reports & bans</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionItem} onPress={() => router.push('/admin/listings')}>
                        <View style={[styles.actionIcon, { backgroundColor: '#E8F8EE' }]}>
                            <Ionicons name="checkmark-circle" size={24} color="#00B850" />
                        </View>
                        <Text style={styles.actionLabel}>Approval Queue</Text>
                        <Text style={styles.actionSub}>Review and approve listings</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionItem} onPress={() => router.push('/admin/platform')}>
                        <View style={[styles.actionIcon, { backgroundColor: '#E0F2FE' }]}>
                            <Ionicons name="construct" size={24} color={BLUE} />
                        </View>
                        <Text style={styles.actionLabel}>Platform Engine</Text>
                        <Text style={styles.actionSub}>Manage brands, categories & alerts</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionItem} onPress={() => router.push('/admin/packages')}>
                        <View style={[styles.actionIcon, { backgroundColor: '#F0FDF4' }]}>
                            <Ionicons name="card" size={24} color="#00B850" />
                        </View>
                        <Text style={styles.actionLabel}>Monetization Engine</Text>
                        <Text style={styles.actionSub}>Manage subscription packages & pricing</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.actionItem}
                        onPress={() => router.push({ pathname: '/admin/users', params: { filter: 'unverified' } })}
                    >
                        <View style={[styles.actionIcon, { backgroundColor: '#FEF3C7' }]}>
                            <Ionicons name="id-card" size={24} color="#D97706" />
                        </View>
                        <Text style={styles.actionLabel}>Verification Queue</Text>
                        <Text style={styles.actionSub}>Review seller identity documents</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.statusSection}>
                <View style={styles.statusHeader}>
                    <Ionicons name="fitness" size={20} color={BLUE} />
                    <Text style={styles.statusTitle}>Platform Status Update</Text>
                </View>
                <View style={styles.statusCard}>
                    <View style={styles.statusRow}>
                        <View style={styles.statusDot} />
                        <Text style={styles.statusLabel}>Supabase DB Connection</Text>
                        <Text style={styles.statusVal}>Operational</Text>
                    </View>
                    <View style={styles.statusRow}>
                        <View style={styles.statusDot} />
                        <Text style={styles.statusLabel}>Storage Buckets</Text>
                        <Text style={styles.statusVal}>Operational</Text>
                    </View>
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 15,
        gap: 15,
    },
    card: {
        width: (width - 45) / 2,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#F0F0F0',
        flexDirection: 'column',
        gap: 15,
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardValue: { fontSize: 24, fontWeight: '900', color: '#111111' },
    cardTitle: { fontSize: 13, color: '#8A8A8A', fontWeight: '700', marginTop: 2 },

    section: { padding: 20 },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: '#111111', marginBottom: 20 },
    actionsRow: { gap: 15 },
    actionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9F9F9',
        padding: 16,
        borderRadius: 16,
        gap: 15,
    },
    actionIcon: {
        width: 50,
        height: 50,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionLabel: { fontSize: 16, fontWeight: '800', color: '#111111' },
    actionSub: { fontSize: 12, color: '#8A8A8A', fontWeight: '500', flex: 1 },

    statusSection: { padding: 20, marginBottom: 40 },
    statusHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 15 },
    statusTitle: { fontSize: 14, fontWeight: '800', color: '#111111', textTransform: 'uppercase', letterSpacing: 0.5 },
    statusCard: { backgroundColor: '#F9F9F9', borderRadius: 16, padding: 20, gap: 12 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#00B850' },
    statusLabel: { flex: 1, fontSize: 13, color: '#444444', fontWeight: '600' },
    statusVal: { fontSize: 12, color: '#00B850', fontWeight: '800' },
});
