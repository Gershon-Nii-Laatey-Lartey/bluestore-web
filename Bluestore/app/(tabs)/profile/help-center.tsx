import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    LayoutAnimation,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    UIManager,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BLUE = '#0057FF';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FAQ_DATA = [
    {
        question: 'How do I buy an item?',
        answer: 'To buy an item, browse through the listings, select a product you like, and use the "Chat" or "Call" button to contact the seller directly. Bluestore currently facilitates direct connections between buyers and sellers.',
    },
    {
        question: 'Is it free to list an item?',
        answer: 'Yes! Basic listings on Bluestore are currently free for all users. You can upload up to 10 photos and provide a detailed description for each item.',
    },
    {
        question: 'How do I edit my listing?',
        answer: 'Go to your Profile, tap on "My Listings," select the item you want to change, and tap the edit icon (pencil) in the top right corner.',
    },
    {
        question: 'What is a "Verified Seller"?',
        answer: 'Verified Sellers are users who have completed our identity verification process. This badge helps build trust within the community.',
    },
    {
        question: 'How can I report a scam?',
        answer: 'If you encounter a suspicious listing or user, please use the "Report" button on the product page or contact our support team immediately through the options below.',
    },
];

export default function HelpCenterScreen() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

    const toggleExpand = (index: number) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedIndex(expandedIndex === index ? null : index);
    };

    const filteredFaqs = FAQ_DATA.filter(faq =>
        faq.question.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color="#111111" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Help Center</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <Ionicons name="search-outline" size={20} color="#8A8A8A" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search help articles..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                {/* Popular Topics Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
                    {filteredFaqs.map((faq, index) => (
                        <TouchableOpacity
                            key={index}
                            style={styles.faqCard}
                            activeOpacity={0.7}
                            onPress={() => toggleExpand(index)}
                        >
                            <View style={styles.faqHeader}>
                                <Text style={styles.faqQuestion}>{faq.question}</Text>
                                <Ionicons
                                    name={expandedIndex === index ? "chevron-up" : "chevron-down"}
                                    size={18}
                                    color="#8A8A8A"
                                />
                            </View>
                            {expandedIndex === index && (
                                <Text style={styles.faqAnswer}>{faq.answer}</Text>
                            )}
                        </TouchableOpacity>
                    ))}
                    {filteredFaqs.length === 0 && (
                        <Text style={styles.emptyText}>No results found for "{searchQuery}"</Text>
                    )}
                </View>

                {/* Contact Support Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Still Need Help?</Text>
                    <View style={styles.contactContainer}>
                        <TouchableOpacity style={styles.contactCard} onPress={() => Alert.alert('Email', 'Support email: support@bluestore.com')}>
                            <View style={[styles.iconBox, { backgroundColor: '#F0F4FF' }]}>
                                <Feather name="mail" size={24} color={BLUE} />
                            </View>
                            <Text style={styles.contactLabel}>Email Us</Text>
                            <Text style={styles.contactSub}>Response in 24h</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.contactCard} onPress={() => Alert.alert('WhatsApp', 'Connecting to WhatsApp Support...')}>
                            <View style={[styles.iconBox, { backgroundColor: '#E8F5E9' }]}>
                                <Ionicons name="logo-whatsapp" size={24} color="#4CAF50" />
                            </View>
                            <Text style={styles.contactLabel}>WhatsApp</Text>
                            <Text style={styles.contactSub}>Instant help</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Version 1.0.2 • Bluestore Support</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#111111' },
    scrollContent: { padding: 20 },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 56,
        marginBottom: 32,
    },
    searchInput: {
        flex: 1,
        marginLeft: 12,
        fontSize: 16,
        color: '#111111',
    },
    section: { marginBottom: 32 },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#111111',
        marginBottom: 16,
    },
    faqCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    faqHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    faqQuestion: {
        fontSize: 15,
        fontWeight: '700',
        color: '#333333',
        flex: 1,
        marginRight: 12,
    },
    faqAnswer: {
        marginTop: 12,
        fontSize: 14,
        color: '#666666',
        lineHeight: 20,
    },
    emptyText: {
        textAlign: 'center',
        color: '#8A8A8A',
        marginTop: 20,
    },
    contactContainer: {
        flexDirection: 'row',
        gap: 16,
    },
    contactCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F0F0F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    iconBox: {
        width: 50,
        height: 50,
        borderRadius: 25,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    contactLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111111',
    },
    contactSub: {
        fontSize: 11,
        color: '#8A8A8A',
        marginTop: 4,
    },
    footer: {
        marginTop: 20,
        paddingBottom: 40,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 12,
        color: '#ABABAB',
        fontWeight: '500',
    },
});
