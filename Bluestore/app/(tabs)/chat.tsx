import { Skeleton } from '@/components/Skeleton';
import { dataCache } from '@/lib/cache';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
    Alert, // Added Alert here
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BLUE = '#0057FF';

export default function ChatScreen() {
    const router = useRouter();
    const [conversations, setConversations] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [myId, setMyId] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedChats, setSelectedChats] = useState<Set<string>>(new Set());
    const inputRef = useRef<TextInput>(null);

    useFocusEffect(
        useCallback(() => {
            fetchConversations();
        }, [])
    );

    const fetchConversations = async (isRefresh = false) => {
        const cached = dataCache.get('conversations_list');
        if (cached && !isRefresh) {
            setConversations(cached);
            setIsLoading(false);
        } else if (!isRefresh) {
            setIsLoading(true);
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setConversations([]);
                setIsLoading(false);
                return;
            }
            setMyId(user.id);

            // Fetch conversations I'm participating in
            const { data, error } = await supabase
                .from('conversation_participants')
                .select(`
                    conversation_id,
                    conversation:conversations(
                        *,
                        listing:listings(title, images),
                        participants:conversation_participants(
                            user:profiles(id, full_name, avatar_url)
                        ),
                        unread_count:messages(count)
                    )
                `)
                .eq('user_id', user.id)
                // Filter unread_count to only messages NOT sent by me and NOT read
                .filter('conversation.messages.sender_id', 'neq', user.id)
                .filter('conversation.messages.is_read', 'eq', false);

            if (error) throw error;

            // Map and format the data
            const formatted = (data || []).map(p => {
                const convo: any = p.conversation;
                if (!convo) return null;

                // Find the other participant
                const other = convo.participants?.find((part: any) => part.user.id !== user.id);
                return {
                    id: convo.id,
                    name: other?.user?.full_name || 'Bluestore User',
                    avatar: other?.user?.avatar_url,
                    lastMsg: convo.last_message || 'Start a conversation...',
                    time: formatTime(convo.last_message_at),
                    unread: convo.unread_count?.[0]?.count || 0,
                    listing: convo.listing,
                    rawTime: convo.last_message_at || convo.created_at,
                    lastSenderId: convo.last_message_sender_id,
                    isRead: convo.last_message_is_read
                };
            })
                .filter(item => item !== null)
                .sort((a: any, b: any) => new Date(b.rawTime).getTime() - new Date(a.rawTime).getTime());

            setConversations(formatted);
            dataCache.set('conversations_list', formatted);
        } catch (error) {
            console.error('Error fetching conversations:', error);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedChats.size === 0) return;

        Alert.alert(
            "Bulk Delete",
            `Are you sure you want to delete ${selectedChats.size} conversation${selectedChats.size > 1 ? 's' : ''}?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete All",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setIsLoading(true);
                            const chatIds = Array.from(selectedChats);
                            
                            // Delete in bulk from participants table
                            const { error } = await supabase
                                .from('conversation_participants')
                                .delete()
                                .in('conversation_id', chatIds)
                                .eq('user_id', myId);

                            if (error) throw error;

                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            setSelectedChats(new Set());
                            setIsEditing(false);
                            fetchConversations(true);
                        } catch (error) {
                            console.error('Bulk delete error:', error);
                            Alert.alert('Error', 'Failed to delete selected chats');
                            setIsLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const deleteConversation = async (conversationId: string) => {
        Alert.alert(
            "Delete Chat",
            "Are you sure you want to delete this conversation?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('conversation_participants')
                                .delete()
                                .eq('conversation_id', conversationId)
                                .eq('user_id', myId);

                            if (error) throw error;
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            fetchConversations(true);
                        } catch (error) {
                            console.error('Delete error:', error);
                        }
                    }
                }
            ]
        );
    };

    const toggleSelection = (conversationId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedChats(prev => {
            const next = new Set(prev);
            if (next.has(conversationId)) next.delete(conversationId);
            else next.add(conversationId);
            return next;
        });
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        fetchConversations(true);
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (days === 1) {
            return 'Yesterday';
        } else if (days < 7) {
            return date.toLocaleDateString([], { weekday: 'short' });
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
    };

    const filteredConversations = conversations.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.lastMsg.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
            <View style={styles.header}>
                <Text style={styles.title}>Messages</Text>
                <TouchableOpacity 
                    style={[styles.editBtn, isEditing && styles.cancelBtn]} 
                    onPress={() => {
                        setIsEditing(!isEditing);
                        if (isEditing) setSelectedChats(new Set());
                    }}
                >
                    <Text style={[styles.editBtnText, isEditing && styles.cancelText]}>
                        {isEditing ? 'Cancel' : 'Edit'}
                    </Text>
                </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
                <Pressable
                    style={styles.searchBar}
                    onPress={() => inputRef.current?.focus()}
                >
                    <Ionicons name="search-outline" size={20} color="#ABABAB" />
                    <TextInput
                        ref={inputRef}
                        placeholder="Search messages..."
                        placeholderTextColor="#BABABA"
                        style={styles.searchInput}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </Pressable>
            </View>

            {isLoading ? (
                <View style={styles.container}>
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <View key={i} style={styles.chatCard}>
                            <View style={styles.avatarPlaceholder}>
                                <Skeleton width={56} height={56} borderRadius={28} />
                                <View style={styles.subscriptSkeleton}>
                                    <Skeleton width={28} height={28} borderRadius={14} />
                                </View>
                            </View>
                            <View style={{ flex: 1, paddingLeft: 4 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <Skeleton width={140} height={16} />
                                    <Skeleton width={40} height={12} />
                                </View>
                                <Skeleton width={100} height={12} style={{ marginBottom: 8 }} />
                                <Skeleton width="90%" height={14} />
                            </View>
                        </View>
                    ))}
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.container}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={BLUE} />
                    }
                >
                    {filteredConversations.length > 0 ? (
                        filteredConversations.map((item) => (
                            <TouchableOpacity
                                key={item.id}
                                style={styles.chatCard}
                                activeOpacity={0.7}
                                onLongPress={() => deleteConversation(item.id)}
                                onPress={() => {
                                    if (isEditing) {
                                        toggleSelection(item.id);
                                    } else {
                                        router.push({
                                            pathname: '/chat/[id]',
                                            params: { id: item.id }
                                        });
                                    }
                                }}
                            >
                                {isEditing && (
                                    <View style={styles.selectionArea}>
                                        <Ionicons 
                                            name={selectedChats.has(item.id) ? "checkbox" : "square-outline"} 
                                            size={24} 
                                            color={selectedChats.has(item.id) ? BLUE : '#ABABAB'} 
                                        />
                                    </View>
                                )}
                                <View style={styles.avatarPlaceholder}>
                                    {item.listing?.images?.[0] ? (
                                        <ExpoImage
                                            source={{ uri: item.listing.images[0] }}
                                            style={styles.productImg}
                                            transition={200}
                                            cachePolicy="memory-disk"
                                        />
                                    ) : (
                                        <View style={styles.productEmpty}>
                                            <Ionicons name="image-outline" size={24} color="#ABABAB" />
                                        </View>
                                    )}
                                    <View style={styles.avatarSubscript}>
                                        {item.avatar ? (
                                            <ExpoImage
                                                source={{ uri: item.avatar }}
                                                style={styles.sellerImg}
                                                transition={200}
                                                cachePolicy="memory-disk"
                                            />
                                        ) : (
                                            <View style={[styles.sellerImg, { backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' }]}>
                                                <Ionicons name="person" size={14} color="#ABABAB" />
                                            </View>
                                        )}
                                    </View>
                                </View>
                                <View style={styles.chatInfo}>
                                    <View style={styles.chatHeader}>
                                        <View style={{ flex: 1, marginRight: 8 }}>
                                            <Text style={styles.productLabel} numberOfLines={1}>{item.listing?.title || 'Unknown Product'}</Text>
                                            <Text style={styles.chatName}>{item.name}</Text>
                                        </View>
                                        <Text style={styles.chatTime}>{item.time}</Text>
                                    </View>
                                    <View style={styles.msgRow}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                            {item.lastSenderId === myId && (
                                                <Ionicons
                                                    name="checkmark-done"
                                                    size={16}
                                                    color={item.isRead ? "#00D1FF" : "#ABABAB"}
                                                    style={{ marginRight: 4 }}
                                                />
                                            )}
                                            <Text
                                                style={[
                                                    styles.lastMsg,
                                                    item.unread > 0 && { color: '#111111', fontWeight: '600', fontFamily: 'Inter_600SemiBold' }
                                                ]}
                                                numberOfLines={1}
                                            >
                                                {item.lastMsg}
                                            </Text>
                                        </View>
                                        {item.unread > 0 && (
                                            <View style={styles.unreadBadge}>
                                                <Text style={styles.unreadText}>{item.unread}</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </TouchableOpacity>
                        ))
                    ) : (
                        <View style={styles.emptyWrap}>
                            <Ionicons name="chatbubbles-outline" size={64} color="#EBEBEB" />
                            <Text style={styles.emptyText}>No messages yet</Text>
                            <Text style={styles.emptySub}>Start chatting with sellers to see your messages here.</Text>
                        </View>
                    )}
                </ScrollView>
            )}

            {isEditing && (
                <View style={styles.bulkDeleteBar}>
                    <TouchableOpacity 
                        style={[styles.bulkDeleteBtn, selectedChats.size === 0 && styles.bulkDeleteDisabled]} 
                        onPress={handleBulkDelete}
                        disabled={selectedChats.size === 0}
                    >
                        <Ionicons name="trash-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                        <Text style={styles.bulkDeleteText}>
                            Delete {selectedChats.size > 0 ? `(${selectedChats.size})` : ''}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        paddingHorizontal: 24,
        paddingTop: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#111111',
        letterSpacing: -0.5,
        fontFamily: 'Inter_700Bold',
    },
    editBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F5F5F5',
    },
    editBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: BLUE,
    },
    cancelBtn: {
        backgroundColor: '#FFF5F5',
    },
    cancelText: {
        color: '#EA4335',
    },
    iconBtn: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#EBEBEB',
    },
    searchContainer: {
        paddingHorizontal: 24,
        marginBottom: 20,
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
        fontFamily: 'Inter_400Regular',
    },
    container: {
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    loadingWrap: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    chatCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    avatarPlaceholder: {
        width: 56,
        height: 56,
        marginRight: 16,
        position: 'relative',
    },
    productImg: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#F5F5F5',
    },
    productEmpty: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarSubscript: {
        position: 'absolute',
        bottom: -4,
        right: -4,
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: '#FFFFFF',
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    sellerImg: {
        width: '100%',
        height: '100%',
        borderRadius: 12,
    },
    subscriptSkeleton: {
        position: 'absolute',
        bottom: -4,
        right: -4,
        borderWidth: 2,
        borderColor: '#FFFFFF',
        borderRadius: 14,
    },
    productLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111111',
        fontFamily: 'Inter_700Bold',
        marginBottom: 1,
    },
    chatInfo: {
        flex: 1,
        paddingLeft: 4,
    },
    chatHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    chatName: {
        fontSize: 13,
        fontWeight: '600',
        color: '#8A8A8A',
        fontFamily: 'Inter_500Medium',
    },
    chatTime: {
        fontSize: 12,
        color: '#8A8A8A',
        fontFamily: 'Inter_400Regular',
    },
    msgRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    lastMsg: {
        fontSize: 14,
        color: '#8A8A8A',
        flex: 1,
        marginRight: 10,
        fontFamily: 'Inter_400Regular',
    },
    unreadBadge: {
        backgroundColor: BLUE,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    unreadText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '800',
    },
    emptyWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111111',
        marginTop: 16,
        fontFamily: 'Inter_600SemiBold',
    },
    emptySub: {
        fontSize: 14,
        color: '#8A8A8A',
        textAlign: 'center',
        marginTop: 8,
        paddingHorizontal: 40,
        fontFamily: 'Inter_400Regular',
    },
    bulkDeleteBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 34,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
        elevation: 20,
    },
    bulkDeleteBtn: {
        backgroundColor: '#EA4335',
        height: 54,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    bulkDeleteDisabled: {
        backgroundColor: '#EBEBEB',
    },
    bulkDeleteText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    selectionArea: {
        marginRight: 16,
        justifyContent: 'center',
    },
});
