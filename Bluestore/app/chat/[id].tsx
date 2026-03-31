import { LocationSelector } from '@/components/LocationSelector';
import { ReviewSheet } from '@/components/ReviewSheet';
import { Skeleton } from '@/components/Skeleton';
import { supabase } from '@/lib/supabase';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { decode } from 'base64-arraybuffer';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Dimensions,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Linking,
    Modal,
    Platform,
    Animated as RNAnimated,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    Extrapolation,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
const MapView = Platform.OS === 'web' ? View : require('react-native-maps').default;
const Marker = Platform.OS === 'web' ? View : require('react-native-maps').Marker;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const BLUE = '#0057FF';

const LIVE_LOCATION_DURATIONS = [
    { label: '15 minutes', minutes: 15 },
    { label: '1 hour', minutes: 60 },
    { label: '8 hours', minutes: 480 },
];

export default function ChatRoomScreen() {
    const { id, listingId, recipientId } = useLocalSearchParams();
    const router = useRouter();
    const [messages, setMessages] = useState<any[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [otherUser, setOtherUser] = useState<any>(null);
    const [listing, setListing] = useState<any>(null);
    const [myId, setMyId] = useState<string | null>(null);
    const [isOtherOnline, setIsOtherOnline] = useState(false);
    const isOwner = listing?.user_id === myId;
    const flatListRef = useRef<FlatList>(null);

    // Attachment & Location state
    const [showAttachMenu, setShowAttachMenu] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [showLiveLocationModal, setShowLiveLocationModal] = useState(false);
    const [showLocationPicker, setShowLocationPicker] = useState(false);
    const [locationPickerMode, setLocationPickerMode] = useState<'static' | 'live'>('static');
    const [selectedLiveDuration, setSelectedLiveDuration] = useState(15);
    const attachMenuAnim = useRef(new RNAnimated.Value(0)).current;

    const locationSubscription = useRef<Location.LocationSubscription | null>(null);

    // Image viewer state
    const [viewerVisible, setViewerVisible] = useState(false);
    const [viewerIndex, setViewerIndex] = useState(0);
    const viewerListRef = useRef<FlatList>(null);
    const [isReviewVisible, setIsReviewVisible] = useState(false);
    const [hasReviewed, setHasReviewed] = useState(false);

    // Image viewer animations
    const scale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const baseScale = useSharedValue(1);
    const startTranslateX = useSharedValue(0);
    const startTranslateY = useSharedValue(0);

    const sendBtnScale = useSharedValue(1);
    const animatedSendBtnStyle = useAnimatedStyle(() => ({
        transform: [{ scale: sendBtnScale.value }]
    }));

    const closeViewer = () => {
        setViewerVisible(false);
        scale.value = withTiming(1);
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        baseScale.value = 1;
    };

    const pinchGesture = Gesture.Pinch()
        .onUpdate((e) => {
            scale.value = baseScale.value * e.scale;
        })
        .onEnd(() => {
            if (scale.value < 1) {
                scale.value = withSpring(1);
                baseScale.value = 1;
            } else {
                baseScale.value = scale.value;
            }
        });

    const panGesture = Gesture.Pan()
        .activeOffsetY([20, 500])
        .failOffsetX([-40, 40])
        .onStart(() => {
            startTranslateX.value = translateX.value;
            startTranslateY.value = translateY.value;
        })
        .onUpdate((e) => {
            if (scale.value > 1.05) {
                translateX.value = startTranslateX.value + e.translationX;
                translateY.value = startTranslateY.value + e.translationY;
            } else {
                translateY.value = Math.max(0, e.translationY);
            }
        })
        .onEnd((e) => {
            if (scale.value > 1.05) {
                // Zoomed in
            } else {
                if (translateY.value > 100) {
                    translateY.value = withTiming(SCREEN_HEIGHT * 1.5, { duration: 300 }, () => {
                        runOnJS(setViewerVisible)(false);
                        scale.value = 1;
                        translateX.value = 0;
                        translateY.value = 0;
                        baseScale.value = 1;
                    });
                } else {
                    translateY.value = withSpring(0, { damping: 20, stiffness: 90 });
                }
            }
        });

    const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

    const animatedImageStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: scale.value }
        ]
    }));

    const animatedBackdropStyle = useAnimatedStyle(() => ({
        opacity: interpolate(
            translateY.value,
            [0, 300],
            [1, 0.5],
            Extrapolation.CLAMP
        )
    }));

    useEffect(() => {
        fetchInitialData();
        const cleanup = setupSubscription();
        return cleanup;
    }, [id]);

    useEffect(() => {
        const activeLiveMsg = messages.find(m =>
            m.sender_id === myId &&
            m.message_type === 'live_location' &&
            m.location_data?.expires_at &&
            new Date(m.location_data.expires_at) > new Date()
        );

        if (activeLiveMsg && !locationSubscription.current) {
            startLiveTracking(activeLiveMsg.id, activeLiveMsg.location_data.expires_at);
        }

        return () => {
            if (locationSubscription.current) {
                locationSubscription.current.remove();
                locationSubscription.current = null;
            }
        };
    }, [messages, myId]);

    const startLiveTracking = async (messageId: string, expiresAt: string) => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        locationSubscription.current = await Location.watchPositionAsync(
            {
                accuracy: Location.Accuracy.Balanced,
                timeInterval: 10000,
                distanceInterval: 10,
            },
            async (loc) => {
                if (new Date(expiresAt) <= new Date()) {
                    locationSubscription.current?.remove();
                    locationSubscription.current = null;
                    return;
                }

                await supabase
                    .from('messages')
                    .update({
                        location_data: {
                            lat: loc.coords.latitude,
                            lng: loc.coords.longitude,
                            expires_at: expiresAt,
                            name: 'Real-time Location',
                            updated_at: new Date().toISOString()
                        }
                    })
                    .eq('id', messageId);
            }
        );
    };

    const onLocationSelect = async (locData: any) => {
        setShowLocationPicker(false);
        setIsSending(true);
        try {
            const activeId = await getOrCreateConversation();
            if (!activeId) return;

            if (locationPickerMode === 'static') {
                await supabase.from('messages').insert([{
                    conversation_id: activeId,
                    sender_id: myId,
                    text: `📍 ${locData.name}`,
                    message_type: 'location',
                    location_data: {
                        lat: locData.latitude,
                        lng: locData.longitude,
                        name: locData.name,
                        address: locData.address,
                    },
                }]);
            } else {
                const expiresAt = new Date(Date.now() + selectedLiveDuration * 60 * 1000).toISOString();
                const { data: newMsg, error } = await supabase.from('messages').insert([{
                    conversation_id: activeId,
                    sender_id: myId,
                    text: `📡 Live Location`,
                    message_type: 'live_location',
                    location_data: {
                        lat: locData.latitude,
                        lng: locData.longitude,
                        name: locData.name,
                        address: locData.address,
                        expires_at: expiresAt,
                        duration_minutes: selectedLiveDuration,
                    },
                }]).select().single();

                if (!error && newMsg) {
                    startLiveTracking(newMsg.id, expiresAt);
                }
            }

            if (id === 'new' && activeId) {
                router.replace({ pathname: '/chat/[id]', params: { id: activeId } });
            }
        } catch (error) {
            console.error('Location share error:', error);
        } finally {
            setIsSending(false);
        }
    };

    useEffect(() => {
        if (showAttachMenu) {
            RNAnimated.spring(attachMenuAnim, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
        } else {
            RNAnimated.timing(attachMenuAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start();
        }
    }, [showAttachMenu]);

    const handleCall = () => {
        const phone = otherUser?.phone_number;
        if (phone) {
            Linking.openURL(`tel:${phone}`);
        } else {
            Alert.alert('Call unavailable', 'This user has not provided a phone number.');
        }
    };

    const formatLastSeen = (dateStr: string) => {
        if (!dateStr) return 'Offline';
        const date = new Date(dateStr);
        const now = new Date();
        const diff = (now.getTime() - date.getTime()) / 1000;
        if (diff < 60) return 'Last seen just now';
        if (diff < 3600) return `Last seen ${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `Last seen ${Math.floor(diff / 3600)}h ago`;
        return `Last seen ${date.toLocaleDateString()}`;
    };

    const fetchInitialData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            setMyId(user.id);

            if (id === 'new') {
                // Fetch listing and recipient profiles separately
                const [listingRes, profileRes] = await Promise.all([
                    supabase.from('listings').select('*').eq('id', listingId).single(),
                    supabase.from('profiles').select('*').eq('id', recipientId).single()
                ]);

                if (listingRes.data) setListing(listingRes.data);
                if (profileRes.data) setOtherUser(profileRes.data);
                setMessages([]);
                setIsLoading(false);
                return;
            }

            const { data: convo, error: convoError } = await supabase
                .from('conversations')
                .select(`
                    *,
                    listing:listings(*),
                    participants:conversation_participants(
                        user:profiles(*)
                    )
                `)
                .eq('id', id)
                .single();

            if (convoError) throw convoError;

            // Fetch seller and check for existing review
            const other = convo.participants.find((p: any) => p.user.id !== user.id)?.user;
            setOtherUser(other);
            setListing(convo.listing);

            if (other && convo.listing) {
                const { data: existingReview } = await supabase
                    .from('reviews')
                    .select('id')
                    .eq('reviewer_id', user.id)
                    .eq('receiver_id', other.id)
                    .eq('listing_id', convo.listing.id)
                    .maybeSingle();
                setHasReviewed(!!existingReview);
            }

            const { data: msgs, error: msgError } = await supabase
                .from('messages')
                .select('*')
                .eq('conversation_id', id)
                .order('created_at', { ascending: false });

            if (msgError) throw msgError;
            setMessages(msgs || []);
        } catch (error) {
            console.error('Error fetching chat data:', error);
        } finally {
            setIsLoading(false);
            markAsRead();
        }
    };

    const getOrCreateConversation = async () => {
        if (id !== 'new') return id;
        try {
            const { data: newConvo, error: convoError } = await supabase
                .from('conversations')
                .insert([{ listing_id: listingId }])
                .select()
                .single();

            if (convoError) throw convoError;

            await supabase.from('conversation_participants').insert([
                { conversation_id: newConvo.id, user_id: myId },
                { conversation_id: newConvo.id, user_id: recipientId },
            ]);

            return newConvo.id;
        } catch (error) {
            console.error('Error creating conversation:', error);
            Alert.alert('Error', 'Could not start conversation');
            return null;
        }
    };

    const markAsRead = async () => {
        if (id === 'new') return;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            await supabase
                .from('messages')
                .update({ is_read: true })
                .eq('conversation_id', id)
                .neq('sender_id', user.id)
                .eq('is_read', false);
        } catch (error) { /* silent */ }
    };

    const setupSubscription = () => {
        const subscription = supabase
            .channel(`convo:${id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `conversation_id=eq.${id}`,
            }, (payload) => {
                setMessages(prev => [payload.new, ...prev]);
                if (payload.new.sender_id !== myId) markAsRead();
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'messages',
                filter: `conversation_id=eq.${id}`,
            }, (payload) => {
                setMessages(prev => prev.map(msg =>
                    msg.id === payload.new.id ? payload.new : msg
                ));
            })
            .subscribe();

        const presenceChannel = supabase.channel('online-users');
        presenceChannel
            .on('presence', { event: 'sync' }, () => {
                const state = presenceChannel.presenceState();
                const isOnline = Object.values(state).flat().some((p: any) => p.user_id === otherUser?.id);
                setIsOtherOnline(isOnline);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
            supabase.removeChannel(presenceChannel);
        };
    };

    const sendMessage = async () => {
        if (!inputText.trim() || !myId) return;
        const text = inputText.trim();
        setInputText('');
        setIsSending(true);

        // Haptic feedback & Animation
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        sendBtnScale.value = withTiming(1.3, { duration: 100 }, () => {
            sendBtnScale.value = withSpring(1);
        });

        try {
            const activeId = await getOrCreateConversation();
            if (!activeId) return;

            await supabase.from('messages').insert([{
                conversation_id: activeId,
                sender_id: myId,
                text,
                message_type: 'text',
            }]);

            if (id === 'new' && activeId) {
                router.replace({ pathname: '/chat/[id]', params: { id: activeId } });
            }
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setIsSending(false);
        }
    };

    const deleteMessage = async (msgId: string) => {
        Alert.alert(
            "Delete Message",
            "Are you sure you want to delete this message? This action cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('messages')
                                .delete()
                                .eq('id', msgId);

                            if (error) throw error;

                            // Local state update is handled by the subscription!
                            // But we can also do it manually for immediate feedback
                            setMessages(prev => prev.filter(m => m.id !== msgId));
                        } catch (error) {
                            console.error('Error deleting message:', error);
                            Alert.alert('Error', 'Failed to delete message');
                        }
                    }
                }
            ]
        );
    };

    const uploadFile = async (uri: string, mimeType: string, filename: string): Promise<string | null> => {
        try {
            const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
            const arrayBuffer = decode(base64);
            const path = `${myId}/${Date.now()}_${filename}`;
            const { error } = await supabase.storage
                .from('chat-attachments')
                .upload(path, arrayBuffer, { contentType: mimeType });
            if (error) throw error;
            const { data } = supabase.storage.from('chat-attachments').getPublicUrl(path);
            return data?.publicUrl ?? null;
        } catch (e) {
            console.error('Upload error:', e);
            return null;
        }
    };

    const sendImage = async () => {
        setShowAttachMenu(false);
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.7,
        });
        if (result.canceled || !result.assets[0]) return;
        setIsSending(true);
        try {
            const activeId = await getOrCreateConversation();
            if (!activeId) return;

            const asset = result.assets[0];

            // Optimize Image
            const manipResult = await ImageManipulator.manipulateAsync(
                asset.uri,
                [{ resize: { width: 1200 } }],
                { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
            );

            if (!manipResult.base64) throw new Error('Optimization failed');

            const filename = asset.uri.split('/').pop() || 'photo.jpg';
            const arrayBuffer = decode(manipResult.base64);
            const path = `${myId}/${Date.now()}_${filename}`;

            const { error: uploadError } = await supabase.storage
                .from('chat-attachments')
                .upload(path, arrayBuffer, { contentType: 'image/jpeg' });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('chat-attachments').getPublicUrl(path);
            const url = data?.publicUrl;

            if (!url) { Alert.alert('Error', 'Failed to upload image'); return; }
            await supabase.from('messages').insert([{
                conversation_id: activeId,
                sender_id: myId,
                text: '📷 Photo',
                message_type: 'image',
                attachment_url: url,
                attachment_name: filename,
                attachment_mime: 'image/jpeg',
            }]);

            if (id === 'new' && activeId) {
                router.replace({ pathname: '/chat/[id]', params: { id: activeId } });
            }
        } catch (error: any) {
            console.error('Upload error:', error);
            Alert.alert('Error', 'Failed to send image');
        } finally {
            setIsSending(false);
        }
    };

    const sendFile = async () => {
        setShowAttachMenu(false);
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true,
            });
            if (result.canceled || !result.assets[0]) return;
            setIsSending(true);

            const activeId = await getOrCreateConversation();
            if (!activeId) return;

            const asset = result.assets[0];
            const url = await uploadFile(asset.uri, asset.mimeType || 'application/octet-stream', asset.name);
            if (!url) { Alert.alert('Error', 'Failed to upload file'); return; }
            await supabase.from('messages').insert([{
                conversation_id: activeId,
                sender_id: myId,
                text: `📎 ${asset.name}`,
                message_type: 'file',
                attachment_url: url,
                attachment_name: asset.name,
                attachment_size: asset.size,
                attachment_mime: asset.mimeType,
            }]);

            if (id === 'new' && activeId) {
                router.replace({ pathname: '/chat/[id]', params: { id: activeId } });
            }
        } catch (error) {
            console.error('File send error:', error);
        } finally {
            setIsSending(false);
        }
    };

    const renderMessage = ({ item }: { item: any }) => {
        const isMine = item.sender_id === myId;

        const renderContent = () => {
            switch (item.message_type) {
                case 'image': {
                    const allImages = messages.filter(m => m.message_type === 'image' && m.attachment_url);
                    const imgIdx = allImages.findIndex(m => m.id === item.id);
                    return (
                        <TouchableOpacity
                            onPress={() => {
                                setViewerIndex(imgIdx >= 0 ? imgIdx : 0);
                                setViewerVisible(true);
                            }}
                            activeOpacity={0.93}
                        >
                            <Image source={{ uri: item.attachment_url }} style={styles.msgImage} resizeMode="cover" />
                            <View style={styles.imgTimestampOverlay}>
                                <Text style={styles.imgTimestampText}>
                                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                                {isMine && (
                                    <Ionicons
                                        name="checkmark-done"
                                        size={12}
                                        color={item.is_read ? '#00D1FF' : 'rgba(255,255,255,0.7)'}
                                        style={{ marginLeft: 3 }}
                                    />
                                )}
                            </View>
                        </TouchableOpacity>
                    );
                }
                case 'file':
                    return (
                        <TouchableOpacity
                            style={styles.fileRow}
                            onPress={() => item.attachment_url && Linking.openURL(item.attachment_url)}
                        >
                            <View style={[styles.fileIconWrap, isMine && styles.fileIconWrapMine]}>
                                <Ionicons name="document-outline" size={20} color={isMine ? BLUE : '#555'} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.fileName, isMine && styles.fileNameMine]} numberOfLines={1}>{item.attachment_name}</Text>
                                {item.attachment_size && (
                                    <Text style={[styles.fileSize, isMine && styles.fileSizeMine]}>
                                        {(item.attachment_size / 1024).toFixed(1)} KB
                                    </Text>
                                )}
                            </View>
                            <Ionicons name="download-outline" size={18} color={isMine ? 'rgba(255,255,255,0.7)' : '#8A8A8A'} />
                        </TouchableOpacity>
                    );
                case 'location':
                case 'live_location': {
                    const locData = item.location_data;
                    const isLive = item.message_type === 'live_location';
                    const isExpired = isLive && locData?.expires_at && new Date(locData.expires_at) < new Date();
                    return (
                        <View style={styles.locationBubbleContainer}>
                            <View style={styles.locationMapWrapper}>
                                <MapView
                                    style={styles.locationMapItem}
                                    region={{
                                        latitude: locData?.lat || 0,
                                        longitude: locData?.lng || 0,
                                        latitudeDelta: 0.01,
                                        longitudeDelta: 0.01,
                                    }}
                                    liteMode
                                    scrollEnabled={false}
                                    zoomEnabled={false}
                                    rotateEnabled={false}
                                    pitchEnabled={false}
                                >
                                    <Marker
                                        coordinate={{
                                            latitude: locData?.lat || 0,
                                            longitude: locData?.lng || 0,
                                        }}
                                    >
                                        <View style={styles.markerCircle}>
                                            <Ionicons name={isLive && !isExpired ? 'radio' : 'location'} size={18} color="#FFFFFF" />
                                        </View>
                                    </Marker>
                                </MapView>
                            </View>
                            <View style={styles.locationContent}>
                                <View style={styles.locHeaderCompact}>
                                    <Text style={[styles.locTitle, isMine && styles.locTitleMine]} numberOfLines={1}>
                                        {isLive ? (isExpired ? '⏰ Expired' : '📡 Live Location') : '📍 Location'}
                                    </Text>
                                    <View style={styles.timestampMini}>
                                        <Text style={[styles.timestamp, isMine ? styles.myTimestamp : styles.otherTimestamp]}>
                                            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </Text>
                                    </View>
                                </View>
                                {isLive && !isExpired && (
                                    <View style={styles.liveIndicatorRowCompact}>
                                        <View style={styles.livePulseDot} />
                                        <Text style={[styles.liveText, isMine && styles.liveTextMine]}>Live</Text>
                                    </View>
                                )}
                                <Text style={[styles.locAddress, isMine && styles.locAddressMine]} numberOfLines={1}>
                                    {locData?.address}
                                </Text>
                                <TouchableOpacity
                                    style={[styles.directionsBtn, isMine && styles.directionsBtnMine]}
                                    onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${locData.lat},${locData.lng}`)}
                                >
                                    <Ionicons name="navigate-outline" size={14} color={isMine ? '#FFFFFF' : BLUE} />
                                    <Text style={[styles.directionsText, isMine && styles.directionsTextMine]}>Get Directions</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    );
                }
                default:
                    return (
                        <Text style={[styles.messageText, isMine ? styles.myText : styles.otherText]}>
                            {item.text}
                        </Text>
                    );
            }
        };

        return (
            <View style={[styles.messageRow, isMine ? styles.myRow : styles.otherRow]}>
                <TouchableOpacity
                    onLongPress={() => deleteMessage(item.id)}
                    activeOpacity={0.8}
                    style={[
                        styles.bubble,
                        isMine ? styles.myBubble : styles.otherBubble,
                        ['image', 'location', 'live_location', 'file'].includes(item.message_type) && { padding: 0, overflow: 'hidden' },
                    ]}
                >
                    {renderContent()}
                    {['text', 'file'].includes(item.message_type || 'text') && (
                        <View style={[
                            styles.timestampRow,
                            item.message_type === 'file' && { paddingHorizontal: 10, paddingBottom: 5, marginTop: 2 }
                        ]}>
                            <Text style={[styles.timestamp, isMine ? styles.myTimestamp : styles.otherTimestamp]}>
                                {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                            {isMine && (
                                <Ionicons
                                    name="checkmark-done"
                                    size={14}
                                    color={item.is_read ? '#00D1FF' : 'rgba(255,255,255,0.4)'}
                                    style={{ marginLeft: 4 }}
                                />
                            )}
                        </View>
                    )}
                </TouchableOpacity>
            </View>
        );
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
                <View style={styles.header}>
                    <Skeleton width={40} height={40} borderRadius={20} />
                    <View style={styles.headerInfo}>
                        <Skeleton width={120} height={18} style={{ marginBottom: 5 }} />
                        <Skeleton width={60} height={10} />
                    </View>
                </View>
                <View style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 20, gap: 16 }}>
                    <Skeleton width="60%" height={50} borderRadius={18} style={{ alignSelf: 'flex-start', borderBottomLeftRadius: 4 }} />
                    <Skeleton width="40%" height={40} borderRadius={18} style={{ alignSelf: 'flex-end', borderBottomRightRadius: 4 }} />
                    <Skeleton width="75%" height={60} borderRadius={18} style={{ alignSelf: 'flex-start', borderBottomLeftRadius: 4 }} />
                </View>
                <View style={[styles.inputWrapper, { paddingBottom: 40 }]}>
                    <Skeleton width="100%" height={50} borderRadius={25} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color="#111111" />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Text style={styles.userName}>{otherUser?.full_name || 'Bluestore User'}</Text>
                    <View style={styles.statusRow}>
                        <View style={[styles.activeDot, !isOtherOnline && { backgroundColor: '#ABABAB' }]} />
                        <Text style={styles.statusText}>{isOtherOnline ? 'Active now' : formatLastSeen(otherUser?.last_seen_at)}</Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.headerAction} onPress={handleCall}>
                    <Ionicons name="call-outline" size={22} color="#111111" />
                </TouchableOpacity>
            </View>

            {listing && (
                <View style={styles.listingBar}>
                    <View style={styles.listingImgWrap}>
                        {listing.images && listing.images[0] ? (
                            <Image source={{ uri: listing.images[0] }} style={styles.listingImg} />
                        ) : (
                            <Ionicons name="image-outline" size={16} color="#ABABAB" />
                        )}
                    </View>
                    <View style={styles.listingInfo}>
                        <Text style={styles.listingTitle} numberOfLines={1}>{listing.title}</Text>
                        <Text style={styles.listingPrice}>GH₵{listing.price}</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.viewListingBtn}
                        onPress={() => router.push(`/product/${listing.id}`)}
                    >
                        <Text style={styles.viewListingText}>View</Text>
                    </TouchableOpacity>
                </View>
            )}

            {!isOwner && messages.length >= 3 && !hasReviewed && (
                <View style={styles.reviewBanner}>
                    <View style={styles.reviewBannerContent}>
                        <View style={styles.reviewBannerText}>
                            <Text style={styles.reviewBannerTitle}>Deal update?</Text>
                            <Text style={styles.reviewBannerSub}>Have you bought anything from this seller?</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.reviewBannerBtn}
                            onPress={() => setIsReviewVisible(true)}
                        >
                            <Text style={styles.reviewBannerBtnText}>Yes, I bought it</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={item => item.id}
                    inverted
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />

                <View style={styles.inputWrapper}>
                    {showAttachMenu && (
                        <RNAnimated.View style={[styles.attachMenu, {
                            opacity: attachMenuAnim,
                            transform: [{ translateY: attachMenuAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }]
                        }]}>
                            <TouchableOpacity style={styles.attachOption} onPress={sendImage}>
                                <View style={[styles.attachIcon, { backgroundColor: '#EBF2FF' }]}>
                                    <Ionicons name="image-outline" size={22} color={BLUE} />
                                </View>
                                <Text style={styles.attachLabel}>Photo</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.attachOption} onPress={sendFile}>
                                <View style={[styles.attachIcon, { backgroundColor: '#FFF3EB' }]}>
                                    <Ionicons name="document-outline" size={22} color="#FF6B00" />
                                </View>
                                <Text style={styles.attachLabel}>File</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.attachOption} onPress={() => { setShowAttachMenu(false); setLocationPickerMode('static'); setShowLocationPicker(true); }}>
                                <View style={[styles.attachIcon, { backgroundColor: '#EBFFF3' }]}>
                                    <Ionicons name="location-outline" size={22} color="#00B850" />
                                </View>
                                <Text style={styles.attachLabel}>Location</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.attachOption} onPress={() => { setShowAttachMenu(false); setShowLiveLocationModal(true); }}>
                                <View style={[styles.attachIcon, { backgroundColor: '#FFF0F0' }]}>
                                    <MaterialCommunityIcons name="map-marker-radius" size={22} color="#FF3B30" />
                                </View>
                                <Text style={styles.attachLabel}>Live Location</Text>
                            </TouchableOpacity>
                        </RNAnimated.View>
                    )}

                    <View style={styles.inputContainer}>
                        <TouchableOpacity
                            style={[styles.attachBtn, showAttachMenu && styles.attachBtnActive]}
                            onPress={() => setShowAttachMenu(prev => !prev)}
                        >
                            <Feather name={showAttachMenu ? 'x' : 'plus'} size={20} color={showAttachMenu ? BLUE : '#8A8A8A'} />
                        </TouchableOpacity>
                        <TextInput
                            style={styles.input}
                            placeholder="Type a message..."
                            placeholderTextColor="#ABABAB"
                            value={inputText}
                            onChangeText={setInputText}
                            multiline
                            onFocus={() => setShowAttachMenu(false)}
                        />
                        <TouchableOpacity
                            style={[styles.sendBtn, (!inputText.trim() && !isSending) && styles.sendBtnDisabled]}
                            onPress={sendMessage}
                            disabled={!inputText.trim() || isSending}
                        >
                            <Animated.View style={animatedSendBtnStyle}>
                                {isSending
                                    ? <Ionicons name="hourglass-outline" size={18} color="#FFFFFF" />
                                    : <Ionicons name="send" size={18} color="#FFFFFF" />
                                }
                            </Animated.View>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>

            <Modal visible={showLiveLocationModal} transparent animationType="slide" onRequestClose={() => setShowLiveLocationModal(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowLiveLocationModal(false)}>
                    <View style={styles.liveLocSheet}>
                        <View style={styles.modalHandle} />
                        <View style={[styles.liveLocIconWrap]}>
                            <MaterialCommunityIcons name="map-marker-radius" size={32} color="#FF3B30" />
                        </View>
                        <Text style={styles.liveLocTitle}>Share Live Location</Text>
                        <Text style={styles.liveLocSub}>The other person can see your location until the timer expires.</Text>
                        {LIVE_LOCATION_DURATIONS.map(d => (
                            <TouchableOpacity
                                key={d.minutes}
                                style={styles.liveLocOption}
                                onPress={() => {
                                    setSelectedLiveDuration(d.minutes);
                                    setShowLiveLocationModal(false);
                                    setLocationPickerMode('live');
                                    setShowLocationPicker(true);
                                }}
                            >
                                <Ionicons name="time-outline" size={20} color={BLUE} />
                                <Text style={styles.liveLocOptionText}>Share for {d.label}</Text>
                                <Ionicons name="chevron-forward" size={18} color="#ABABAB" />
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowLiveLocationModal(false)}>
                            <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {(() => {
                const allImages = messages.filter(m => m.message_type === 'image' && m.attachment_url);
                return (
                    <Modal
                        visible={viewerVisible}
                        transparent={true}
                        animationType="fade"
                        statusBarTranslucent
                        onRequestClose={closeViewer}
                    >
                        <Animated.View style={[styles.viewerContainer, animatedBackdropStyle]}>
                            <TouchableOpacity
                                style={styles.viewerClose}
                                onPress={closeViewer}
                            >
                                <Ionicons name="close" size={28} color="#FFFFFF" />
                            </TouchableOpacity>

                            <View style={styles.viewerCounter}>
                                <Text style={styles.viewerCounterText}>
                                    {viewerIndex + 1} / {allImages.length}
                                </Text>
                            </View>

                            <GestureDetector gesture={composedGesture}>
                                <Animated.Image
                                    source={{ uri: allImages[viewerIndex]?.attachment_url }}
                                    style={[styles.viewerMainImage, animatedImageStyle]}
                                    resizeMode="contain"
                                />
                            </GestureDetector>

                            {allImages.length > 1 && (
                                <Animated.View style={animatedBackdropStyle}>
                                    <FlatList
                                        ref={viewerListRef}
                                        data={allImages}
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        keyExtractor={m => m.id}
                                        contentContainerStyle={styles.viewerStrip}
                                        initialScrollIndex={viewerIndex}
                                        getItemLayout={(_, i) => ({ length: 64, offset: 76 * i, index: i })}
                                        renderItem={({ item: imgMsg, index: i }) => (
                                            <TouchableOpacity
                                                onPress={() => {
                                                    setViewerIndex(i);
                                                    scale.value = withSpring(1);
                                                    translateX.value = withSpring(0);
                                                    translateY.value = withSpring(0);
                                                }}
                                                style={[
                                                    styles.viewerThumb,
                                                    i === viewerIndex && styles.viewerThumbActive,
                                                ]}
                                            >
                                                <Image
                                                    source={{ uri: imgMsg.attachment_url }}
                                                    style={styles.viewerThumbImg}
                                                    resizeMode="cover"
                                                />
                                            </TouchableOpacity>
                                        )}
                                    />
                                </Animated.View>
                            )}
                        </Animated.View>
                    </Modal>
                );
            })()}

            <LocationSelector
                visible={showLocationPicker}
                onClose={() => setShowLocationPicker(false)}
                showScopes={false}
                title="Send specific location:"
                onSelect={onLocationSelect}
            />

            {listing && otherUser && (
                <ReviewSheet
                    visible={isReviewVisible}
                    onClose={() => setIsReviewVisible(false)}
                    listingId={listing.id}
                    sellerId={otherUser.id}
                    listingTitle={listing.title}
                    onSuccess={() => setHasReviewed(true)}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#FFFFFF' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginLeft: -10 },
    headerInfo: { flex: 1, marginLeft: 4 },
    userName: { fontSize: 16, fontWeight: '700', color: '#111111' },
    statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#00D1FF', marginRight: 6 },
    statusText: { fontSize: 12, color: '#8A8A8A' },
    headerAction: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    listingBar: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    listingImgWrap: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#F5F5F5', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    listingImg: { width: '100%', height: '100%' },
    listingInfo: { flex: 1, marginLeft: 12 },
    listingTitle: { fontSize: 14, fontWeight: '600', color: '#111111' },
    listingPrice: { fontSize: 13, color: BLUE, fontWeight: '700', marginTop: 1 },
    viewListingBtn: {
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#EBEBEB',
    },
    viewListingText: { fontSize: 13, fontWeight: '600', color: '#111111' },
    reviewBanner: {
        backgroundColor: '#F7FBFF',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#E1E9F5',
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    reviewBannerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    reviewBannerText: { flex: 1, marginRight: 12 },
    reviewBannerTitle: { fontSize: 13, fontWeight: '800', color: '#111111' },
    reviewBannerSub: { fontSize: 11, color: '#666', marginTop: 1 },
    reviewBannerBtn: {
        backgroundColor: BLUE,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    reviewBannerBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
    listContent: { paddingHorizontal: 16, paddingVertical: 20 },
    messageRow: { marginBottom: 16, maxWidth: '85%' },
    myRow: { alignSelf: 'flex-end' },
    otherRow: { alignSelf: 'flex-start' },
    bubble: {
        borderRadius: 20,
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    myBubble: { backgroundColor: BLUE, borderBottomRightRadius: 4 },
    otherBubble: { backgroundColor: '#F2F2F2', borderBottomLeftRadius: 4 },
    messageText: { fontSize: 15, lineHeight: 20 },
    myText: { color: '#FFFFFF' },
    otherText: { color: '#333333' },
    msgImage: { width: 240, height: 180, borderRadius: 12 },
    imgTimestampOverlay: {
        position: 'absolute', bottom: 8, right: 8,
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
        paddingHorizontal: 6, paddingVertical: 2,
        borderRadius: 8,
    },
    imgTimestampText: { color: '#FFFFFF', fontSize: 10, fontWeight: '500' },
    fileRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12, minWidth: 200 },
    fileIconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
    fileIconWrapMine: { backgroundColor: 'rgba(255,255,255,0.2)' },
    fileName: { fontSize: 14, fontWeight: '600', color: '#333' },
    fileNameMine: { color: '#FFF' },
    fileSize: { fontSize: 11, color: '#999', marginTop: 2 },
    fileSizeMine: { color: 'rgba(255,255,255,0.7)' },
    locationBubbleContainer: { width: 240 },
    locationMapWrapper: { height: 140, width: '100%', overflow: 'hidden' },
    locationMapItem: { ...StyleSheet.absoluteFillObject },
    markerCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
    locationContent: { padding: 12 },
    locHeaderCompact: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    locTitle: { fontSize: 14, fontWeight: '700', color: '#333' },
    locTitleMine: { color: '#FFF' },
    timestampMini: { marginLeft: 8 },
    timestampRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, justifyContent: 'flex-end' },
    timestamp: { fontSize: 10, fontFamily: 'Inter_400Regular' },
    myTimestamp: { color: 'rgba(255,255,255,0.7)', textAlign: 'right' },
    otherTimestamp: { color: '#ABABAB' },
    liveIndicatorRowCompact: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
    livePulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00D1FF' },
    liveText: { fontSize: 11, fontWeight: '700', color: '#00D1FF' },
    liveTextMine: { color: '#FFFFFF' },
    locAddress: { fontSize: 12, color: '#666', marginBottom: 10 },
    locAddressMine: { color: 'rgba(255,255,255,0.8)' },
    directionsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, backgroundColor: '#F0F5FF', borderRadius: 8 },
    directionsBtnMine: { backgroundColor: 'rgba(255,255,255,0.2)' },
    directionsText: { fontSize: 12, fontWeight: '700', color: BLUE },
    directionsTextMine: { color: '#FFFFFF' },
    inputWrapper: { paddingHorizontal: 16, paddingBottom: 20, paddingTop: 10, backgroundColor: '#FFFFFF' },
    attachMenu: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        justifyContent: 'space-around',
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    attachOption: { alignItems: 'center', gap: 8 },
    attachIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    attachLabel: { fontSize: 11, color: '#555', fontWeight: '500', textAlign: 'center' },
    inputContainer: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#F5F5F5', borderRadius: 24,
        paddingHorizontal: 8, paddingVertical: 6,
        borderWidth: 1, borderColor: '#EBEBEB',
    },
    attachBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    attachBtnActive: { backgroundColor: '#EBF2FF' },
    input: {
        flex: 1, marginHorizontal: 8, fontSize: 15,
        maxHeight: 100, color: '#111111',
        paddingTop: 8, paddingBottom: 8,
        fontFamily: 'Inter_400Regular',
    },
    sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center' },
    sendBtnDisabled: { backgroundColor: '#ABABAB' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    liveLocSheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 24,
        paddingBottom: 40,
        paddingTop: 16,
        alignItems: 'center',
    },
    modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0', marginBottom: 24 },
    liveLocIconWrap: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    liveLocTitle: { fontSize: 20, fontWeight: '700', color: '#111111', marginBottom: 8 },
    liveLocSub: { fontSize: 13, color: '#8A8A8A', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
    liveLocOption: {
        width: '100%', flexDirection: 'row', alignItems: 'center', gap: 14,
        paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
    },
    liveLocOptionText: { flex: 1, fontSize: 16, color: '#111111', fontWeight: '500' },
    cancelBtn: {
        marginTop: 20, width: '100%', paddingVertical: 16, borderRadius: 16,
        backgroundColor: '#F5F5F5', alignItems: 'center',
    },
    cancelBtnText: { fontSize: 16, fontWeight: '600', color: '#555' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    // Image Viewer
    viewerContainer: { flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' },
    viewerClose: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10 },
    viewerCounter: { position: 'absolute', top: 60, alignSelf: 'center', zIndex: 5 },
    viewerCounterText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
    viewerMainImage: { width: '100%', height: '70%' },
    viewerStrip: { paddingHorizontal: 20, gap: 12, paddingBottom: 40, height: 120, alignItems: 'flex-end' },
    viewerThumb: { width: 64, height: 64, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
    viewerThumbActive: { borderColor: BLUE },
    viewerThumbImg: { width: '100%', height: '100%' },
});
