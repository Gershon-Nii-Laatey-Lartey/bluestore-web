import { LocationSelector } from '@/components/LocationSelector';
import { Skeleton } from '@/components/Skeleton';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { decode } from 'base64-arraybuffer';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    FlatList,
    Image,
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

export default function EditListingScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isProcessingImages, setIsProcessingImages] = useState(false);
    const [pendingImagesCount, setPendingImagesCount] = useState(0);

    // Form State
    const [title, setTitle] = useState('');
    const [price, setPrice] = useState('');
    const [description, setDescription] = useState('');
    const [location, setLocation] = useState('');
    const [category, setCategory] = useState('');
    const [brand, setBrand] = useState('');
    const [condition, setCondition] = useState('Brand New');
    const [selectedImages, setSelectedImages] = useState<{ uri: string, base64?: string, isExisting?: boolean }[]>([]);
    const [coords, setCoords] = useState<{ latitude: number, longitude: number } | null>(null);
    const [locationStructured, setLocationStructured] = useState<any | null>(null);
    const [isLocationModalVisible, setIsLocationModalVisible] = useState(false);

    // DB Data
    const [dbCategories, setDbCategories] = useState<{ id: string, name: string }[]>([]);
    const [dbBrands, setDbBrands] = useState<string[]>([]);
    const [conditions] = useState(['Brand New', 'Like New', 'Used - Good', 'Used - Fair', 'Other']);

    // UI Modal Content (Dynamic)
    const [modalVisible, setModalVisible] = useState(false);
    const [modalType, setModalType] = useState<'category' | 'brand' | 'condition'>('category');
    const [modalData, setModalData] = useState<string[]>([]);

    const openModal = (type: 'category' | 'brand' | 'condition') => {
        setModalType(type);
        if (type === 'category') setModalData(dbCategories.map(c => c.name));
        else if (type === 'condition') setModalData(conditions);
        else if (type === 'brand') setModalData(dbBrands);
        setModalVisible(true);
    };

    const slideAnim = useRef(new Animated.Value(600)).current;

    useEffect(() => {
        fetchListing();
        loadCategories();
    }, [id]);

    const loadCategories = async () => {
        const { data } = await supabase.from('categories').select('id, name').order('name');
        if (data) setDbCategories(data);
    };

    const fetchListing = async () => {
        try {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('listings')
                .select('id, title, price, description, location, category, brand, condition, images, user_id, status, created_at, updated_at, location_structured')
                .eq('id', id)
                .single();

            if (error) throw error;

            setTitle(data.title);
            setPrice(data.price.toString());
            setDescription(data.description || '');
            setLocation(data.location || '');
            setCategory(data.category);
            setBrand(data.brand || '');
            setCondition(data.condition);
            const ls = data.location_structured;
            if (ls) {
                setCoords({ latitude: ls.latitude, longitude: ls.longitude });
                setLocationStructured(ls);
            }

            if (data.images && data.images.length > 0) {
                setSelectedImages(data.images.map((img: string) => ({ uri: img, isExisting: true })));
            }
        } catch (error: any) {
            console.error('Fetch listing error:', error);
            Alert.alert('Error', 'Failed to load listing for editing');
            router.back();
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const loadBrands = async () => {
            const selectedCat = dbCategories.find(c => c.name === category);
            if (!selectedCat) return;

            const { data } = await supabase
                .from('category_brands')
                .select('brands(name)')
                .eq('category_id', selectedCat.id);

            if (data) {
                const names = data.map((item: any) => item.brands.name);
                setDbBrands(names.length > 0 ? names : ['Generic', 'Other']);
            }
        };
        if (category && dbCategories.length > 0) loadBrands();
    }, [category, dbCategories]);

    useEffect(() => {
        if (modalVisible) {
            Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }).start();
        } else {
            slideAnim.setValue(600);
        }
    }, [modalVisible]);

    const handleCloseModal = () => {
        Animated.timing(slideAnim, { toValue: 600, duration: 250, useNativeDriver: true }).start(() => setModalVisible(false));
    };

    const pickImage = async () => {
        if (selectedImages.length >= 10) {
            Alert.alert('Limit Reached', 'You can only upload up to 10 photos.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsMultipleSelection: true,
            selectionLimit: 10 - selectedImages.length,
            quality: 0.7,
            base64: true,
        });

        if (!result.canceled && result.assets) {
            setPendingImagesCount(result.assets.length);
            setIsProcessingImages(true);
            try {
                const optimizedImages: { uri: string, base64: string }[] = [];
                for (const asset of result.assets) {
                    const manipResult = await ImageManipulator.manipulateAsync(
                        asset.uri,
                        [{ resize: { width: 1080 } }],
                        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
                    );
                    if (manipResult.base64) {
                        optimizedImages.push({ uri: manipResult.uri, base64: manipResult.base64 });
                    }
                }
                setSelectedImages(prev => [...prev, ...optimizedImages].slice(0, 10));
            } catch (error) {
                console.error("Image optimization failed:", error);
            } finally {
                setIsProcessingImages(false);
                setPendingImagesCount(0);
            }
        }
    };

    const handleUpdate = async () => {
        if (!title.trim() || !category || !price.trim() || !location.trim()) {
            Alert.alert('Incomplete Form', 'Title, category, price, and location are required.');
            return;
        }

        setIsSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not logged in');

            // Handle uploading NEW images
            const finalImages: string[] = [];
            for (let i = 0; i < selectedImages.length; i++) {
                const img = selectedImages[i];
                if (img.isExisting) {
                    finalImages.push(img.uri);
                } else if (img.base64) {
                    const fileName = `${user.id}/edit_${Date.now()}_${i}.jpg`;
                    const { error: uploadError } = await supabase.storage
                        .from('listing_images')
                        .upload(fileName, decode(img.base64), { contentType: 'image/jpeg' });
                    if (uploadError) throw uploadError;
                    const { data: { publicUrl } } = supabase.storage.from('listing_images').getPublicUrl(fileName);
                    finalImages.push(publicUrl);
                }
            }

            const updateData = {
                title: title.trim(),
                category,
                price: parseFloat(price),
                condition,
                location: location.trim(),
                description: description.trim(),
                brand: brand.trim() || 'Generic',
                images: finalImages,
                location_structured: locationStructured ? {
                    ...locationStructured,
                    latitude: coords?.latitude,
                    longitude: coords?.longitude
                } : null,
                updated_at: new Date().toISOString(),
            };

            const { data: currentListing } = await supabase.from('listings').select('status').eq('id', id).single();

            const { error } = await supabase
                .from('listings')
                .update(updateData)
                .eq('id', id);

            if (error) throw error;

            if (currentListing?.status === 'draft') {
                Alert.alert(
                    'Update Saved',
                    'Would you like to promote this listing now or save as draft?',
                    [
                        { text: 'Later', onPress: () => router.back() },
                        { text: 'Promote Now', onPress: () => router.replace({ pathname: '/promote/[id]', params: { id: id as string } }) }
                    ]
                );
            } else {
                Alert.alert('Success', 'Listing updated successfully!', [{ text: 'OK', onPress: () => router.back() }]);
            }
        } catch (error: any) {
            console.error('Update Error:', error);
            Alert.alert('Update Failed', error.message || 'An unexpected error occurred.');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={BLUE} />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
        >
            <View style={styles.container}>
                <SafeAreaView edges={['top']} style={styles.headerSafe}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                            <Ionicons name="chevron-back" size={24} color="#111111" />
                        </TouchableOpacity>
                        <Text style={styles.title}>Edit Listing</Text>
                        <View style={{ width: 44 }} />
                    </View>
                </SafeAreaView>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {/* Image Horizontal List */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
                        {selectedImages.map((img, idx) => (
                            <View key={idx} style={{ marginRight: 12 }}>
                                <Image source={{ uri: img.uri }} style={{ width: 140, height: 140, borderRadius: 16 }} />
                                <TouchableOpacity
                                    style={styles.removeImgBtn}
                                    onPress={() => setSelectedImages(prev => prev.filter((_, i) => i !== idx))}
                                >
                                    <Ionicons name="close" size={16} color="#FFF" />
                                </TouchableOpacity>
                                {idx === 0 && (
                                    <View style={styles.coverBadge}><Text style={styles.coverText}>COVER</Text></View>
                                )}
                            </View>
                        ))}
                        {isProcessingImages && Array.from({ length: pendingImagesCount }).map((_, idx) => (
                            <View key={`pending-${idx}`} style={{ marginRight: 12 }}>
                                <Skeleton width={140} height={140} borderRadius={16} />
                            </View>
                        ))}
                        {selectedImages.length + pendingImagesCount < 10 && !isProcessingImages && (
                            <TouchableOpacity style={styles.addMoreBtn} onPress={pickImage}>
                                <Ionicons name="add" size={24} color={BLUE} />
                                <Text style={styles.addMoreText}>Add</Text>
                            </TouchableOpacity>
                        )}
                    </ScrollView>

                    <View style={styles.form}>
                        <View style={styles.field}>
                            <Text style={styles.label}>Title</Text>
                            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Listing title" />
                        </View>

                        <View style={styles.row}>
                            <TouchableOpacity style={[styles.field, { flex: 1, marginRight: 8 }]} onPress={() => openModal('category')}>
                                <Text style={styles.label}>Category</Text>
                                <View style={styles.selector}><Text>{category}</Text><Ionicons name="chevron-down" size={16} color="#8A8A8A" /></View>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.field, { flex: 1 }]} onPress={() => openModal('condition')}>
                                <Text style={styles.label}>Condition</Text>
                                <View style={styles.selector}><Text>{condition}</Text><Ionicons name="chevron-down" size={16} color="#8A8A8A" /></View>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.row}>
                            <View style={[styles.field, { flex: 1, marginRight: 8 }]}>
                                <Text style={styles.label}>Price (GH₵)</Text>
                                <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="numeric" />
                            </View>
                            <TouchableOpacity style={[styles.field, { flex: 1 }]} onPress={() => openModal('brand')}>
                                <Text style={styles.label}>Brand</Text>
                                <View style={styles.selector}><Text>{brand || 'Select Brand'}</Text><Ionicons name="chevron-down" size={16} color="#8A8A8A" /></View>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity style={styles.field} onPress={() => setIsLocationModalVisible(true)}>
                            <Text style={styles.label}>Location</Text>
                            <View style={styles.selector}>
                                <Ionicons name="location-outline" size={18} color={BLUE} style={{ marginRight: 8 }} />
                                <Text numberOfLines={1} style={{ flex: 1 }}>{location}</Text>
                            </View>
                        </TouchableOpacity>

                        <View style={styles.field}>
                            <Text style={styles.label}>Description</Text>
                            <TextInput
                                style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
                                value={description}
                                onChangeText={setDescription}
                                multiline
                                placeholder="Tell buyers about your item"
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.updateBtn, isSaving && { opacity: 0.7 }]}
                            onPress={handleUpdate}
                            disabled={isSaving}
                        >
                            {isSaving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.updateBtnText}>Save Changes</Text>}
                        </TouchableOpacity>
                    </View>
                </ScrollView>

                <LocationSelector
                    visible={isLocationModalVisible}
                    onClose={() => setIsLocationModalVisible(false)}
                    onSelect={(data) => {
                        setLocation(data.name || data.address);
                        setCoords({ latitude: data.latitude, longitude: data.longitude });
                        setLocationStructured(data);
                        setIsLocationModalVisible(false);
                    }}
                />

                {/* Selection Modal (Simplified re-use) */}
                <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={handleCloseModal}>
                    <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={handleCloseModal}>
                        <Animated.View style={[styles.modalContent, { transform: [{ translateY: slideAnim }] }]}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>{modalType === 'category' ? 'Category' : modalType === 'brand' ? 'Brand' : 'Condition'}</Text>
                                <TouchableOpacity onPress={handleCloseModal}><Ionicons name="close" size={24} /></TouchableOpacity>
                            </View>
                            <FlatList
                                data={modalData}
                                renderItem={({ item }) => (
                                    <TouchableOpacity style={styles.modalOption} onPress={() => {
                                        if (modalType === 'category') { setCategory(item); setBrand(''); }
                                        else if (modalType === 'condition') setCondition(item);
                                        else if (modalType === 'brand') setBrand(item);
                                        handleCloseModal();
                                    }}>
                                        <Text style={styles.modalOptionText}>{item}</Text>
                                        {(modalType === 'category' ? category : modalType === 'brand' ? brand : condition) === item && <Ionicons name="checkmark" size={20} color={BLUE} />}
                                    </TouchableOpacity>
                                )}
                            />
                        </Animated.View>
                    </TouchableOpacity>
                </Modal>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerSafe: { backgroundColor: '#FFFFFF' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 12 },
    backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 20, fontWeight: '700' },
    scrollContent: { padding: 24 },
    removeImgBtn: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 4 },
    coverBadge: { position: 'absolute', bottom: 8, left: 8, backgroundColor: BLUE, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
    coverText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
    addMoreBtn: { width: 140, height: 140, borderRadius: 16, backgroundColor: '#F9F9F9', borderWidth: 1, borderColor: '#EBEBEB', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
    addMoreText: { color: BLUE, fontWeight: '700', marginTop: 4 },
    form: { gap: 20 },
    field: { gap: 8 },
    label: { fontSize: 14, fontWeight: '700', color: '#111111' },
    input: { backgroundColor: '#F5F5F5', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#EBEBEB', fontSize: 15 },
    selector: { backgroundColor: '#F5F5F5', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#EBEBEB', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    row: { flexDirection: 'row' },
    updateBtn: { backgroundColor: '#111111', height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
    updateBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: '70%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 18, fontWeight: '700' },
    modalOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
    modalOptionText: { fontSize: 16 },
});
