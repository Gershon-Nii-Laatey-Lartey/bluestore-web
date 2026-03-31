import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BLUE = '#0057FF';

interface ReportSheetProps {
    visible: boolean;
    onClose: () => void;
    targetType: 'listing' | 'profile' | 'chat';
    targetId: string;
    targetTitle?: string;
    reportedUserId?: string;
}

const REPORT_REASONS = [
    { label: 'Scam or Fraudulent User', value: 'scam' },
    { label: 'Suspected Bot or Fake Account', value: 'fake' },
    { label: 'Offensive or Harassing Behavior', value: 'offensive' },
    { label: 'Counterfeit or Illegal Item', value: 'counterfeit' },
    { label: 'Incorrect Item Information', value: 'incorrect_info' },
    { label: 'Spam or Misplaced Content', value: 'spam' },
    { label: 'Other', value: 'other' },
];

export function ReportSheet({ visible, onClose, targetType, targetId, targetTitle, reportedUserId }: ReportSheetProps) {
    const [selectedReason, setSelectedReason] = useState<string | null>(null);
    const [details, setDetails] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!selectedReason) {
            Alert.alert('Selection Required', 'Please select a reason for reporting.');
            return;
        }

        try {
            setIsSubmitting(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const { error } = await supabase
                .from('reports')
                .insert([{
                    reporter_id: user.id,
                    target_type: targetType,
                    target_id: targetId,
                    reported_user_id: reportedUserId,
                    reason: selectedReason,
                    details: details.trim() || null
                }]);

            if (error) throw error;

            Alert.alert(
                'Report Submitted',
                'Thank you for reporting. Our safety team will investigate this within 24 hours to keep the community safe.',
                [{ text: 'OK', onPress: onClose }]
            );

            // Reset state
            setSelectedReason(null);
            setDetails('');

        } catch (error: any) {
            console.error('Report error:', error);
            Alert.alert('Error', error.message || 'Failed to submit report. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <SafeAreaView style={styles.sheetContainer} edges={['top']}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Ionicons name="close" size={24} color="#111111" />
                        </TouchableOpacity>
                        <View style={styles.headerText}>
                            <Text style={styles.title}>Report {targetType === 'profile' ? 'Seller' : 'Listing'}</Text>
                            {targetTitle && <Text style={styles.subTitle} numberOfLines={1}>{targetTitle}</Text>}
                        </View>
                        <View style={{ width: 44 }} />
                    </View>

                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={{ flex: 1 }}
                    >
                        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                            <View style={[styles.safetyBadge, { backgroundColor: '#FFEEED' }]}>
                                <Ionicons name="shield-checkmark" size={20} color="#EA4335" />
                                <Text style={styles.safetyText}>Flag serious safety or fraudulent issues here.</Text>
                            </View>

                            <Text style={styles.sectionLabel}>WHY ARE YOU REPORTING THIS?</Text>

                            <View style={styles.reasonsList}>
                                {REPORT_REASONS.map((reason) => (
                                    <TouchableOpacity
                                        key={reason.value}
                                        style={[
                                            styles.reasonItem,
                                            selectedReason === reason.value && styles.selectedReason
                                        ]}
                                        onPress={() => setSelectedReason(reason.value)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[
                                            styles.reasonLabel,
                                            selectedReason === reason.value && styles.selectedLabel
                                        ]}>
                                            {reason.label}
                                        </Text>
                                        {selectedReason === reason.value && (
                                            <Ionicons name="checkmark-circle" size={20} color={BLUE} />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.sectionLabel}>ADDITIONAL DETAILS (OPTIONAL)</Text>
                            <TextInput
                                style={styles.detailsInput}
                                placeholder="Describe the issue in more detail..."
                                placeholderTextColor="#ABABAB"
                                multiline
                                numberOfLines={4}
                                value={details}
                                onChangeText={setDetails}
                                maxLength={500}
                                textAlignVertical="top"
                            />

                            <TouchableOpacity
                                style={[styles.submitBtn, (!selectedReason || isSubmitting) && styles.disabledBtn]}
                                onPress={handleSubmit}
                                disabled={!selectedReason || isSubmitting}
                            >
                                {isSubmitting ? (
                                    <ActivityIndicator color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.submitBtnText}>Submit Report</Text>
                                )}
                            </TouchableOpacity>

                            <Text style={styles.disclaimer}>
                                Abuse of reporting system may lead to account suspension. High-priority cases are reviewed immediately.
                            </Text>

                            <View style={{ height: 40 }} />
                        </ScrollView>
                    </KeyboardAvoidingView>
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
        height: '92%',
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
    scrollContent: { padding: 20 },
    safetyBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 14,
        gap: 12,
        marginBottom: 24,
    },
    safetyText: { fontSize: 13, color: '#EA4335', fontWeight: '700', flex: 1 },
    sectionLabel: { fontSize: 12, fontWeight: '800', color: '#8A8A8A', marginBottom: 16, letterSpacing: 0.5 },
    reasonsList: { marginBottom: 24, gap: 10 },
    reasonItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 18,
        borderRadius: 16,
        backgroundColor: '#F9F9F9',
        borderWidth: 1.5,
        borderColor: '#F0F0F0',
    },
    selectedReason: {
        backgroundColor: '#F0F4FF',
        borderColor: BLUE,
    },
    reasonLabel: { fontSize: 15, fontWeight: '600', color: '#444' },
    selectedLabel: { color: BLUE, fontWeight: '700' },
    detailsInput: {
        backgroundColor: '#F9F9F9',
        borderRadius: 16,
        padding: 16,
        fontSize: 15,
        color: '#111111',
        height: 120,
        borderWidth: 1.5,
        borderColor: '#F0F0F0',
        marginBottom: 24,
    },
    submitBtn: {
        backgroundColor: '#111111',
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
