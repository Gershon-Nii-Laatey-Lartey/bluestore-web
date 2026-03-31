import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import React, { useEffect, useState } from 'react';
import {
    Animated,
    Dimensions,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

const { width } = Dimensions.get('window');

export function GlobalAlert() {
    const [config, setConfig] = useState<any>(null);
    const [visible, setVisible] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const fadeAnim = new Animated.Value(0);

    useEffect(() => {
        fetchConfig();

        // Subscribe to changes
        const subscription = supabase
            .channel('platform_config_changes')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'platform_config' }, (payload) => {
                if (payload.new.key === 'global_alert') {
                    const newConfig = payload.new.value;
                    setConfig(newConfig);
                    if (newConfig.active) setModalVisible(true);
                }
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const fetchConfig = async () => {
        const { data } = await supabase
            .from('platform_config')
            .select('value')
            .eq('key', 'global_alert')
            .single();

        if (data?.value) {
            setConfig(data.value);
            // Only show if active
            if (data.value.active) setModalVisible(true);
        }
    };

    const getBgColor = () => {
        switch (config?.type) {
            case 'warning': return '#FFF9E6';
            case 'error': return '#FFEDEA';
            default: return '#FFFFFF';
        }
    };

    const getTextColor = () => {
        switch (config?.type) {
            case 'warning': return '#B88600';
            case 'error': return '#FF4136';
            default: return '#111111';
        }
    };

    const getIcon = () => {
        switch (config?.type) {
            case 'warning': return 'warning';
            case 'error': return 'alert-circle';
            default: return 'information-circle';
        }
    };

    if (!config) return null;

    return (
        <Modal
            visible={modalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setModalVisible(false)}
        >
            <View style={styles.overlay}>
                <View style={[styles.modalContainer, { backgroundColor: getBgColor() }]}>
                    <TouchableOpacity
                        style={styles.closeBtn}
                        onPress={() => setModalVisible(false)}
                    >
                        <Ionicons name="close" size={24} color="#8A8A8A" />
                    </TouchableOpacity>

                    {config.image_url && (
                        <ExpoImage
                            source={{ uri: config.image_url }}
                            style={styles.alertImage}
                            contentFit="cover"
                            transition={200}
                        />
                    )}

                    <View style={styles.content}>
                        <View style={styles.titleRow}>
                            <Ionicons name={getIcon() as any} size={24} color={config.type === 'info' ? '#0057FF' : getTextColor()} />
                            <Text style={[styles.titleText, { color: getTextColor() }]}>
                                {config.title || (config.type === 'error' ? 'Urgent Alert' : config.type === 'warning' ? 'Important' : 'Platform Update')}
                            </Text>
                        </View>

                        <Text style={[styles.message, { color: getTextColor() }]}>
                            {config.message}
                        </Text>

                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: config.type === 'info' ? '#0057FF' : getTextColor() }]}
                            onPress={() => setModalVisible(false)}
                        >
                            <Text style={styles.actionText}>Got it</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        overflow: 'hidden',
        maxWidth: 400,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
    },
    closeBtn: {
        position: 'absolute',
        top: 15,
        right: 15,
        zIndex: 10,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.8)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    alertImage: {
        width: '100%',
        height: 180,
    },
    content: {
        padding: 24,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 12,
    },
    titleText: {
        fontSize: 18,
        fontWeight: '800',
    },
    message: {
        fontSize: 15,
        color: '#444',
        lineHeight: 22,
        marginBottom: 24,
    },
    actionBtn: {
        height: 50,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    }
});
