import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BLUE = '#0057FF';

interface ReviewSheetProps {
    visible: boolean;
    onClose: () => void;
    listingId: string;
    sellerId: string;
    listingTitle: string;
    onSuccess?: () => void;
}

export function ReviewSheet({ visible, onClose, listingId, sellerId, listingTitle, onSuccess }: ReviewSheetProps) {
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (rating === 0) {
            Alert.alert('Rating Required', 'Please select a star rating.');
            return;
        }

        try {
            setIsSubmitting(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const { error } = await supabase
                .from('reviews')
                .insert([{
                    reviewer_id: user.id,
                    receiver_id: sellerId,
                    listing_id: listingId,
                    rating: rating,
                    comment: comment.trim() || null,
                    is_verified: true // Marking as verified because it came from a buyer-selection flow
                }]);

            if (error) {
                if (error.code === '23505') {
                    throw new Error('You have already reviewed this transaction.');
                }
                throw error;
            }

            Alert.alert(
                'Review Published',
                'Thank you for your feedback! It helps build a safer community on Bluestore.',
                [{
                    text: 'OK', onPress: () => {
                        onSuccess?.();
                        onClose();
                    }
                }]
            );

            // Reset
            setRating(0);
            setComment('');

        } catch (error: any) {
            console.error('Review error:', error);
            Alert.alert('Error', error.message || 'Failed to submit review.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.overlay}>
                    <SafeAreaView style={styles.sheetContainer} edges={['top', 'bottom']}>
                        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                            <View style={{ flex: 1 }}>
                                <View style={styles.header}>
                                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                        <Ionicons name="close" size={24} color="#111111" />
                                    </TouchableOpacity>
                                    <View style={styles.headerText}>
                                        <Text style={styles.title}>Review Your Purchase</Text>
                                        <Text style={styles.subTitle} numberOfLines={1}>{listingTitle}</Text>
                                    </View>
                                    <View style={{ width: 44 }} />
                                </View>

                                <KeyboardAvoidingView
                                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                                    style={{ flex: 1 }}
                                >
                                    <View style={styles.content}>
                                        <Text style={styles.sectionLabel}>HOW WAS YOUR EXPERIENCE?</Text>

                                        <View style={styles.starsContainer}>
                                            {[1, 2, 3, 4, 5].map((s) => (
                                                <TouchableOpacity
                                                    key={s}
                                                    onPress={() => setRating(s)}
                                                    style={styles.starBtn}
                                                >
                                                    <Ionicons
                                                        name={rating >= s ? "star" : "star-outline"}
                                                        size={44}
                                                        color={rating >= s ? "#FFB800" : "#EBEBEB"}
                                                    />
                                                </TouchableOpacity>
                                            ))}
                                        </View>

                                        <Text style={styles.ratingLabel}>
                                            {rating === 1 ? 'Terrible' :
                                                rating === 2 ? 'Poor' :
                                                    rating === 3 ? 'Average' :
                                                        rating === 4 ? 'Great' :
                                                            rating === 5 ? 'Excellent' : 'Select a rating'}
                                        </Text>

                                        <Text style={styles.sectionLabel}>TELL US MORE (OPTIONAL)</Text>
                                        <TextInput
                                            style={styles.commentInput}
                                            placeholder="Was the item as described? Was the seller responsive?"
                                            placeholderTextColor="#ABABAB"
                                            multiline
                                            numberOfLines={4}
                                            value={comment}
                                            onChangeText={setComment}
                                            maxLength={200}
                                            textAlignVertical="top"
                                            returnKeyType="done"
                                            blurOnSubmit={true}
                                            onSubmitEditing={Keyboard.dismiss}
                                        />

                                        <TouchableOpacity
                                            style={[styles.submitBtn, (rating === 0 || isSubmitting) && styles.disabledBtn]}
                                            onPress={handleSubmit}
                                            disabled={rating === 0 || isSubmitting}
                                        >
                                            {isSubmitting ? (
                                                <ActivityIndicator color="#FFFFFF" />
                                            ) : (
                                                <Text style={styles.submitBtnText}>Publish Review</Text>
                                            )}
                                        </TouchableOpacity>

                                        <Text style={styles.disclaimer}>
                                            Your review will be public and linked to your profile. Be honest and respectful.
                                        </Text>
                                    </View>
                                </KeyboardAvoidingView>
                            </View>
                        </TouchableWithoutFeedback>
                    </SafeAreaView>
                </View>
            </TouchableWithoutFeedback>
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
        height: '85%',
        paddingTop: 8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    closeBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerText: { alignItems: 'center', flex: 1, paddingHorizontal: 10 },
    title: { fontSize: 18, fontWeight: '800', color: '#111111' },
    subTitle: { fontSize: 13, color: '#8A8A8A', marginTop: 2, fontWeight: '500' },
    content: { padding: 24, flex: 1 },
    sectionLabel: { fontSize: 12, fontWeight: '800', color: '#8A8A8A', marginBottom: 16, letterSpacing: 0.5, textAlign: 'center' },
    starsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 12,
    },
    starBtn: { padding: 4 },
    ratingLabel: {
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '700',
        color: '#111111',
        marginBottom: 40,
    },
    commentInput: {
        backgroundColor: '#F9F9F9',
        borderRadius: 16,
        padding: 16,
        fontSize: 15,
        color: '#111111',
        height: 120,
        borderWidth: 1.5,
        borderColor: '#F0F0F0',
        marginBottom: 32,
    },
    submitBtn: {
        backgroundColor: BLUE,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    disabledBtn: { opacity: 0.6 },
    submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
    disclaimer: {
        fontSize: 12,
        color: '#ABABAB',
        textAlign: 'center',
        lineHeight: 18,
        paddingHorizontal: 20,
    },
});
