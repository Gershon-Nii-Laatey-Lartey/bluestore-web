import { recordListingImpression } from '@/lib/tracking';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const BLUE = '#0057FF';

interface ProductCardProps {
    item: {
        id: string;
        title: string;
        price: number;
        images?: string[];
        condition: string;
        location?: string;
        is_boosted?: boolean;
    };
    isSaved?: boolean;
    onToggleFavorite?: (id: string) => void;
}

export const ProductCard = ({ item, isSaved, onToggleFavorite }: ProductCardProps) => {
    const router = useRouter();

    useEffect(() => {
        // Record impression when the card is rendered (mounted)
        recordListingImpression(item.id);
    }, [item.id]);

    const heartScale = useSharedValue(1);
    const animatedHeartStyle = useAnimatedStyle(() => ({
        transform: [{ scale: heartScale.value }]
    }));

    return (
        <TouchableOpacity
            style={styles.productCard}
            onPress={() => router.push({ pathname: '/(tabs)/product/[id]', params: { id: item.id } })}
            activeOpacity={0.9}
        >
            <View style={[styles.imagePlaceholder, { padding: 0, overflow: 'hidden' }]}>
                <View style={[styles.tag, { zIndex: 10 }]}>
                    <Text style={styles.tagText}>{item.condition === 'Brand New' ? 'NEW' : 'USED'}</Text>
                </View>

                {item.is_boosted && (
                    <View style={[styles.boostTag, { zIndex: 10 }]}>
                        <Ionicons name="flash" size={10} color="#FFF" />
                        <Text style={styles.tagText}>BOOSTED</Text>
                    </View>
                )}

                {item.images && item.images[0] ? (
                    <ExpoImage
                        source={{ uri: item.images[0] }}
                        style={styles.image}
                        contentFit="cover"
                        transition={200}
                        cachePolicy="memory-disk"
                    />
                ) : (
                    <Ionicons name="image-outline" size={32} color="#EBEBEB" />
                )}

                {onToggleFavorite && (
                    <TouchableOpacity
                        style={[styles.favBtn, { zIndex: 10 }]}
                        onPress={() => {
                            const newSaved = !isSaved;

                            // Haptics
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

                            // Animation
                            heartScale.value = withTiming(newSaved ? 1.4 : 0.8, { duration: 100 }, () => {
                                heartScale.value = withSpring(1);
                            });

                            onToggleFavorite(item.id);
                        }}
                    >
                        <Animated.View style={animatedHeartStyle}>
                            <Ionicons
                                name={isSaved ? "heart" : "heart-outline"}
                                size={16}
                                color={isSaved ? "#FF4B4B" : "#111111"}
                            />
                        </Animated.View>
                    </TouchableOpacity>
                )}
            </View>

            <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.productPrice}>GH₵{item.price}</Text>
                <View style={styles.locationContainer}>
                    <Ionicons name="location-outline" size={12} color="#8A8A8A" />
                    <Text style={styles.locationText} numberOfLines={1}>
                        {item.location || 'Accra, Ghana'}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    productCard: {
        width: (width - 64) / 2,
    },
    imagePlaceholder: {
        height: 200,
        backgroundColor: '#F5F5F5',
        borderRadius: 24,
        marginBottom: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#EBEBEB',
    },
    image: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    tag: {
        position: 'absolute',
        top: 12,
        left: 12,
        backgroundColor: BLUE,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    tagText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    boostTag: {
        position: 'absolute',
        bottom: 12,
        left: 12,
        backgroundColor: '#FF9500',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        shadowColor: '#FF9500',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    favBtn: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    productInfo: {
        paddingHorizontal: 4,
    },
    productName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111111',
        marginBottom: 4,
    },
    productPrice: {
        fontSize: 16,
        fontWeight: '800',
        color: BLUE,
    },
    locationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    locationText: {
        fontSize: 11,
        color: '#8A8A8A',
        marginLeft: 4,
    },
});
