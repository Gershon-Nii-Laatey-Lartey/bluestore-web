import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BLUE = '#0057FF';

interface BuyerSelectionSheetProps {
    visible: boolean;
    onClose: () => void;
    listingId: string;
    onSelect: (buyerId: string) => void;
}

export function BuyerSelectionSheet({ visible, onClose, listingId, onSelect }: BuyerSelectionSheetProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [potentialBuyers, setPotentialBuyers] = useState<any[]>([]);

    useEffect(() => {
        if (visible && listingId) {
            fetchPotentialBuyers();
        }
    }, [visible, listingId]);

    const fetchPotentialBuyers = async () => {
        setIsLoading(true);
        try {
            // Fetch conversations for this listing
            const { data: convos, error: convoError } = await supabase
                .from('conversations')
                .select('id')
                .eq('listing_id', listingId);

            if (convoError) throw convoError;

            if (!convos || convos.length === 0) {
                setPotentialBuyers([]);
                return;
            }

            const convoIds = convos.map(c => c.id);

            // Get participants (excluding the current user - the seller)
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: participants, error: partError } = await supabase
                .from('conversation_participants')
                .select(`
                    user_id,
                    profiles:user_id (
                        id,
                        full_name,
                        avatar_url
                    )
                `)
                .in('conversation_id', convoIds)
                .neq('user_id', user.id);

            if (partError) throw partError;

            // De-duplicate and format
            const uniqueBuyers = Array.from(new Map(participants.map((p: any) => [p.user_id, p.profiles])).values());
            setPotentialBuyers(uniqueBuyers);

        } catch (error) {
            console.error('Error fetching potential buyers:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <SafeAreaView style={styles.sheetContainer} edges={['bottom']}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Who bought this?</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Ionicons name="close" size={24} color="#111111" />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.subTitle}>Select the buyer to help them leave a review and build your reputation.</Text>

                    {isLoading ? (
                        <View style={styles.center}>
                            <ActivityIndicator color={BLUE} size="large" />
                        </View>
                    ) : potentialBuyers.length > 0 ? (
                        <FlatList
                            data={potentialBuyers}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={styles.list}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.buyerItem}
                                    onPress={() => onSelect(item.id)}
                                >
                                    {item.avatar_url ? (
                                        <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                                    ) : (
                                        <View style={[styles.avatar, styles.placeholderAvatar]}>
                                            <Text style={styles.avatarText}>{item.full_name?.charAt(0)}</Text>
                                        </View>
                                    )}
                                    <Text style={styles.buyerName}>{item.full_name}</Text>
                                    <Ionicons name="chevron-forward" size={20} color="#ABABAB" />
                                </TouchableOpacity>
                            )}
                        />
                    ) : (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="chatbubbles-outline" size={48} color="#EBEBEB" />
                            <Text style={styles.emptyText}>No recent chats found for this item.</Text>
                            <TouchableOpacity style={styles.skipBtn} onPress={() => onSelect('')}>
                                <Text style={styles.skipBtnText}>Skip and Mark as Sold</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <TouchableOpacity style={styles.noneBtn} onPress={() => onSelect('')}>
                        <Text style={styles.noneBtnText}>I sold it outside of Bluestore</Text>
                    </TouchableOpacity>
                </SafeAreaView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    sheetContainer: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        minHeight: '50%',
        maxHeight: '80%',
        paddingTop: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        marginBottom: 8,
    },
    title: { fontSize: 22, fontWeight: '800', color: '#111111' },
    subTitle: { fontSize: 14, color: '#8A8A8A', paddingHorizontal: 24, marginBottom: 20, lineHeight: 20 },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    list: { paddingHorizontal: 24, paddingBottom: 20 },
    buyerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F0F0F0' },
    placeholderAvatar: { alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 18, fontWeight: '700', color: BLUE, lineHeight: 44, textAlign: 'center' },
    buyerName: { flex: 1, marginLeft: 16, fontSize: 16, fontWeight: '600', color: '#111111' },
    center: { padding: 40, alignItems: 'center' },
    emptyContainer: { padding: 40, alignItems: 'center' },
    emptyText: { marginTop: 16, fontSize: 14, color: '#ABABAB', textAlign: 'center' },
    skipBtn: { marginTop: 20, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: '#111111', borderRadius: 12 },
    skipBtnText: { color: '#FFF', fontWeight: '700' },
    noneBtn: { padding: 20, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F5F5F5' },
    noneBtnText: { color: BLUE, fontWeight: '700', fontSize: 14 },
});
