import { supabase } from '@/lib/supabase';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Stack, usePathname, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BLUE = '#0057FF';

export default function AdminLayout() {
    const router = useRouter();
    const pathname = usePathname();
    const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {

                router.replace('/(auth)/login');
                return;
            }

            const { data: profile, error } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();



            if (profile?.role === 'admin' || profile?.role === 'moderator') {
                setIsAuthorized(true);
            } else {

                Alert.alert('Unauthorized', `Access restricted. Your role is: ${profile?.role || 'unknown'}`);
                router.replace('/(tabs)/profile');
            }
        } catch (error) {
            console.error('Admin Auth Check Error:', error);
            router.replace('/(tabs)/profile');
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator color={BLUE} size="large" />
                <Text style={styles.loadingText}>Verifying Admin Access...</Text>
            </View>
        );
    }

    if (!isAuthorized) return null;

    const navItems = [
        { label: 'Overview', route: '/admin', icon: 'stats-chart' as const },
        { label: 'Listings', route: '/admin/listings', icon: 'list' as const },
        { label: 'Safety', route: '/admin/reports', icon: 'shield-half' as const },
        { label: 'Users', route: '/admin/users', icon: 'people' as const },
        { label: 'Platform', route: '/admin/platform', icon: 'settings' as const },
    ];

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.replace('/(tabs)/profile')} style={styles.backBtn}>
                    <Ionicons name="apps-outline" size={24} color="#111111" />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.title}>Bluestore Control</Text>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>ADMIN</Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.profileBtn}>
                    <Feather name="settings" size={20} color="#111111" />
                </TouchableOpacity>
            </View>

            <View style={styles.navBarContainer}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.navBar}
                >
                    {navItems.map((item) => {
                        const isActive = pathname === item.route;
                        return (
                            <TouchableOpacity
                                key={item.route}
                                onPress={() => router.push(item.route as any)}
                                style={[styles.navItem, isActive && styles.navItemActive]}
                            >
                                <Ionicons
                                    name={item.icon}
                                    size={18}
                                    color={isActive ? BLUE : "#8A8A8A"}
                                />
                                <Text style={[styles.navText, isActive && styles.navTextActive]}>
                                    {item.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            <Stack screenOptions={{ headerShown: false }} />
        </SafeAreaView>
    );
}
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
    loadingText: { marginTop: 16, fontSize: 14, color: '#8A8A8A', fontWeight: '600' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    headerTitleContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { fontSize: 18, fontWeight: '800', color: '#111111', letterSpacing: -0.5 },
    badge: { backgroundColor: '#FFEDEA', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    badgeText: { fontSize: 10, fontWeight: '900', color: '#FF4136' },
    backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9F9F9' },
    profileBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9F9F9' },

    navBarContainer: {
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    navBar: {
        flexDirection: 'row',
        paddingHorizontal: 15,
        paddingVertical: 12,
        gap: 10,
    },
    navItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        gap: 6,
    },
    navItemActive: { backgroundColor: '#EEF3FF' },
    navText: { fontSize: 13, fontWeight: '700', color: '#8A8A8A' },
    navTextActive: { color: BLUE },
});
