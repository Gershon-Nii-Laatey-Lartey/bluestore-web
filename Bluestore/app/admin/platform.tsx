import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { decode } from 'base64-arraybuffer';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
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

export default function PlatformManagement() {
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'alerts' | 'categories' | 'brands' | 'system'>('alerts');

    // Alerts
    const [alertConfig, setAlertConfig] = useState<any>({
        active: false,
        message: '',
        type: 'info',
        image_url: null,
        title: ''
    });
    const [isSavingAlert, setIsSavingAlert] = useState(false);

    // Categories
    const [categories, setCategories] = useState<any[]>([]);
    const [newCatName, setNewCatName] = useState('');
    const [editingCategory, setEditingCategory] = useState<any>(null);
    const [isSavingCategory, setIsSavingCategory] = useState(false);

    const CATEGORY_ICONS = [
        'cube-outline', 'shirt-outline', 'watch-outline', 'phone-portrait-outline',
        'laptop-outline', 'game-controller-outline', 'bicycle-outline', 'car-outline',
        'home-outline', 'tv-outline', 'camera-outline', 'musical-notes-outline'
    ];

    const CATEGORY_COLORS = [
        '#F9F9F9', '#FFF5F5', '#F0F5FF', '#F0FFF4', '#FFFDF0', '#F5F0FF', '#FFF0F5'
    ];

    // Brands
    const [brands, setBrands] = useState<any[]>([]);
    const [categoryBrands, setCategoryBrands] = useState<any[]>([]);
    const [newBrandName, setNewBrandName] = useState('');
    const [selectedBrandImage, setSelectedBrandImage] = useState<any>(null);
    const [editingBrand, setEditingBrand] = useState<any>(null);
    const [isSavingBrand, setIsSavingBrand] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [configRes, catRes, brandRes, cbRes] = await Promise.all([
                supabase.from('platform_config').select('*').eq('key', 'global_alert').single(),
                supabase.from('categories').select('*').order('name'),
                supabase.from('brands').select('*').order('sort_order', { ascending: true }).order('name'),
                supabase.from('category_brands').select('*')
            ]);

            if (configRes.data) setAlertConfig(configRes.data.value);
            if (catRes.data) setCategories(catRes.data);
            if (brandRes.data) setBrands(brandRes.data);
            if (cbRes.data) setCategoryBrands(cbRes.data);
        } catch (error) {
            console.error('Error fetching platform data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const pickImage = async (onSelected: (img: any) => void) => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.7,
            base64: false,
        });

        if (!result.canceled && result.assets[0].uri) {
            try {
                const manipResult = await ImageManipulator.manipulateAsync(
                    result.assets[0].uri,
                    [{ resize: { width: 1200 } }],
                    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
                );

                if (manipResult.base64) {
                    onSelected({
                        uri: manipResult.uri,
                        base64: manipResult.base64,
                    });
                }
            } catch (error) {
                console.error("Image optimization failed:", error);
                Alert.alert('Error', 'Failed to process image');
            }
        }
    };

    const uploadToBucket = async (bucket: string, base64: string, path: string) => {
        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(path, decode(base64), { contentType: 'image/jpeg', upsert: true });

        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
        return publicUrl;
    };

    const saveAlert = async () => {
        setIsSavingAlert(true);
        try {
            const { error } = await supabase
                .from('platform_config')
                .upsert({ key: 'global_alert', value: alertConfig });

            if (error) throw error;
            Alert.alert('Success', 'Global alert updated.');
        } catch (error: any) {
            Alert.alert('Error', error.name === 'Error' ? error.message : 'Update failed');
        } finally {
            setIsSavingAlert(false);
        }
    };

    const handlePickAlertImage = async () => {
        await pickImage(async (img) => {
            const fileName = `banner_${Date.now()}.jpg`;
            const url = await uploadToBucket('alert_banners', img.base64, fileName);
            setAlertConfig({ ...alertConfig, image_url: url });
        });
    };

    const addCategory = async () => {
        if (!newCatName.trim()) return;
        try {
            const slug = newCatName.toLowerCase().replace(/\s+/g, '-');
            const { error } = await supabase
                .from('categories')
                .insert([{
                    name: newCatName.trim(),
                    slug,
                    icon: CATEGORY_ICONS[0],
                    color: CATEGORY_COLORS[0]
                }]);
            if (error) throw error;
            setNewCatName('');
            fetchData();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    const saveCategoryEdits = async () => {
        if (!editingCategory.name.trim()) return;
        setIsSavingCategory(true);
        try {
            const { error } = await supabase
                .from('categories')
                .update({
                    name: editingCategory.name.trim(),
                    icon: editingCategory.icon,
                    color: editingCategory.color
                })
                .eq('id', editingCategory.id);

            if (error) throw error;
            setEditingCategory(null);
            fetchData();
            Alert.alert('Success', 'Category updated.');
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setIsSavingCategory(false);
        }
    };

    const deleteCategory = (id: string, name: string) => {
        Alert.alert('Delete Category', `Are you sure? This will unlink all associated brands.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    const { error } = await supabase.from('categories').delete().eq('id', id);
                    if (error) Alert.alert('Error', error.message);
                    else fetchData();
                }
            }
        ]);
    };

    const addBrand = async () => {
        if (!newBrandName.trim()) return;
        try {
            let logoUrl = null;
            if (selectedBrandImage) {
                const fileName = `logo_${Date.now()}.jpg`;
                logoUrl = await uploadToBucket('brand_logos', selectedBrandImage.base64, fileName);
            }
            const { error } = await supabase.from('brands').insert([{ name: newBrandName.trim(), logo_url: logoUrl }]);
            if (error) throw error;
            setNewBrandName('');
            setSelectedBrandImage(null);
            fetchData();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    const saveBrandEdits = async () => {
        if (!editingBrand.name.trim()) return;
        setIsSavingBrand(true);
        try {
            // 1. Update brand name and logo
            let logoUrl = editingBrand.logo_url;
            if (selectedBrandImage) {
                const fileName = `logo_${editingBrand.id}_${Date.now()}.jpg`;
                logoUrl = await uploadToBucket('brand_logos', selectedBrandImage.base64, fileName);
            }

            const { error: brandError } = await supabase
                .from('brands')
                .update({
                    name: editingBrand.name.trim(),
                    logo_url: logoUrl,
                    is_featured: !!editingBrand.is_featured,
                    sort_order: parseInt(editingBrand.sort_order?.toString() || '0')
                })
                .eq('id', editingBrand.id);

            if (brandError) throw brandError;

            // 2. Update category links
            // Delete all existing and re-insert or diff (diff is better but delete/insert is easier)
            await supabase.from('category_brands').delete().eq('brand_id', editingBrand.id);
            if (editingBrand.categoryIds?.length > 0) {
                const links = editingBrand.categoryIds.map((cId: string) => ({ brand_id: editingBrand.id, category_id: cId }));
                await supabase.from('category_brands').insert(links);
            }

            setEditingBrand(null);
            setSelectedBrandImage(null);
            fetchData();
            Alert.alert('Success', 'Brand updated.');
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setIsSavingBrand(false);
        }
    };

    const deleteBrand = (id: string, name: string) => {
        Alert.alert('Delete Brand', `Are you sure you want to delete "${name}"?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    const { error } = await supabase.from('brands').delete().eq('id', id);
                    if (error) Alert.alert('Error', error.message);
                    else fetchData();
                }
            }
        ]);
    };

    const openBrandEdit = (brand: any) => {
        setSelectedBrandImage(null);
        const associatedCategoryIds = categoryBrands.filter(cb => cb.brand_id === brand.id).map(cb => cb.category_id);
        setEditingBrand({ ...brand, categoryIds: associatedCategoryIds });
    };

    const toggleBrandCategory = (catId: string) => {
        const currentIds = editingBrand.categoryIds || [];
        if (currentIds.includes(catId)) {
            setEditingBrand({ ...editingBrand, categoryIds: currentIds.filter((id: string) => id !== catId) });
        } else {
            setEditingBrand({ ...editingBrand, categoryIds: [...currentIds, catId] });
        }
    };

    if (isLoading && categories.length === 0) {
        return <View style={styles.loading}><ActivityIndicator color={BLUE} /></View>;
    }

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: 'Platform Engine' }} />

            <View style={styles.tabsContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
                    {[
                        { id: 'alerts', icon: 'megaphone' },
                        { id: 'categories', icon: 'grid' },
                        { id: 'brands', icon: 'pricetag' },
                        { id: 'system', icon: 'settings' }
                    ].map(tab => (
                        <TouchableOpacity
                            key={tab.id}
                            style={[styles.tabBtn, activeTab === tab.id && styles.tabBtnActive]}
                            onPress={() => setActiveTab(tab.id as any)}
                        >
                            <Ionicons name={tab.icon as any} size={18} color={activeTab === tab.id ? '#FFF' : '#8A8A8A'} />
                            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.id.toUpperCase()}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
                {activeTab === 'alerts' && (
                    <View style={styles.content}>
                        <Text style={styles.title}>System Alerts</Text>
                        <View style={styles.card}>
                            <View style={styles.toggleRow}>
                                <Text style={styles.cardLabel}>Pop-up Active</Text>
                                <TouchableOpacity
                                    style={[styles.miniToggle, alertConfig.active && styles.miniToggleActive]}
                                    onPress={() => setAlertConfig({ ...alertConfig, active: !alertConfig.active })}
                                >
                                    <View style={[styles.miniToggleDot, alertConfig.active && styles.miniToggleDotActive]} />
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.cardLabel}>Headline</Text>
                            <TextInput style={styles.flatInput} value={alertConfig.title} onChangeText={t => setAlertConfig({ ...alertConfig, title: t })} placeholder="Update Title..." />
                            <Text style={styles.cardLabel}>Message</Text>
                            <TextInput style={styles.alertInput} value={alertConfig.message} onChangeText={t => setAlertConfig({ ...alertConfig, message: t })} multiline placeholder="Alert text..." />

                            <Text style={styles.cardLabel}>Media Asset</Text>
                            <TouchableOpacity style={styles.imageBox} onPress={handlePickAlertImage}>
                                {alertConfig.image_url ? (
                                    <View style={{ width: '100%', height: '100%' }}>
                                        <Image source={{ uri: alertConfig.image_url }} style={styles.previewImg} />
                                        <View style={styles.imageOverlay}><Text style={styles.imageOverlayText}>Change Image</Text></View>
                                    </View>
                                ) : (
                                    <View style={styles.imagePlaceholder}><Ionicons name="image-outline" size={32} color="#CCC" /><Text style={{ fontSize: 12, color: '#AAA' }}>Upload Image</Text></View>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.saveBtn} onPress={saveAlert} disabled={isSavingAlert}>
                                {isSavingAlert ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Save Configuration</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {activeTab === 'categories' && (
                    <View style={styles.content}>
                        <Text style={styles.title}>Categories</Text>
                        <View style={styles.addBox}>
                            <TextInput style={[styles.flatInput, { flex: 1, marginBottom: 0 }]} value={newCatName} onChangeText={setNewCatName} placeholder="New Category Name..." />
                            <TouchableOpacity style={styles.squareAddBtn} onPress={addCategory}><Ionicons name="add" size={24} color="#FFF" /></TouchableOpacity>
                        </View>
                        <View style={styles.catGrid}>
                            {categories.map(cat => (
                                <View key={cat.id} style={[styles.catCard, { backgroundColor: cat.color || '#F9F9F9' }]}>
                                    <View style={styles.catCardHeader}>
                                        <View style={styles.catIconBox}>
                                            <Ionicons name={(cat.icon || 'cube-outline') as any} size={20} color="#111" />
                                        </View>
                                        <View style={{ flexDirection: 'row', gap: 8 }}>
                                            <TouchableOpacity onPress={() => setEditingCategory(cat)}>
                                                <Ionicons name="create-outline" size={18} color={BLUE} />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => deleteCategory(cat.id, cat.name)}>
                                                <Ionicons name="trash-outline" size={18} color="#FF4136" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                    <Text style={styles.catCardName}>{cat.name}</Text>
                                    <Text style={styles.catCardSub}>
                                        {brands.filter(b => categoryBrands.some(cb => cb.category_id === cat.id && cb.brand_id === b.id)).length} Brands linked
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {activeTab === 'brands' && (
                    <View style={styles.content}>
                        <Text style={styles.title}>Brands</Text>
                        <View style={styles.card}>
                            <View style={styles.brandFormRow}>
                                <TouchableOpacity style={styles.logoPicker} onPress={() => pickImage(setSelectedBrandImage)}>
                                    {selectedBrandImage ? <Image source={{ uri: selectedBrandImage.uri }} style={styles.logoPreview} /> : <Ionicons name="camera" size={20} color="#8A8A8A" />}
                                </TouchableOpacity>
                                <TextInput style={[styles.flatInput, { flex: 1, marginBottom: 0 }]} value={newBrandName} onChangeText={setNewBrandName} placeholder="Brand Name..." />
                                <TouchableOpacity style={styles.squareAddBtn} onPress={addBrand}><Ionicons name="add" size={24} color="#FFF" /></TouchableOpacity>
                            </View>
                        </View>
                        <View style={styles.brandList}>
                            {brands.map(brand => (
                                <View key={brand.id} style={styles.brandRow}>
                                    <View style={styles.brandLogoBox}>
                                        {brand.logo_url ? <Image source={{ uri: brand.logo_url }} style={styles.logoImg} /> : <Ionicons name="pricetag-outline" size={16} color="#CCC" />}
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <Text style={styles.brandName}>{brand.name}</Text>
                                            {brand.is_featured && (
                                                <View style={styles.featuredBadge}>
                                                    <Ionicons name="home" size={10} color="#FFF" />
                                                    <Text style={styles.featuredBadgeText}>Featured</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={{ fontSize: 10, color: '#8A8A8A' }}>
                                            Order: {brand.sort_order || 0} • {categoryBrands.filter(cb => cb.brand_id === brand.id).length} categories linked
                                        </Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 10 }}>
                                        <TouchableOpacity onPress={() => openBrandEdit(brand)} style={styles.actionBtn}><Ionicons name="create-outline" size={18} color={BLUE} /></TouchableOpacity>
                                        <TouchableOpacity onPress={() => deleteBrand(brand.id, brand.name)} style={styles.actionBtn}><Ionicons name="trash-outline" size={18} color="#FF4136" /></TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {activeTab === 'system' && (
                    <View style={styles.content}>
                        <Text style={styles.title}>Maintenance</Text>
                        <TouchableOpacity style={styles.systemBtn} onPress={() => Alert.alert('Done', 'Cache purged.')}><Ionicons name="refresh" size={20} color="#111" /><Text style={styles.systemBtnText}>Purge App Cache</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.systemBtn} onPress={() => Alert.alert('Done', 'Banners synced.')}><Ionicons name="images-outline" size={20} color="#111" /><Text style={styles.systemBtnText}>Sync Banner Assets</Text></TouchableOpacity>
                    </View>
                )}
            </ScrollView>

            {/* Brand Edit Modal */}
            <Modal visible={!!editingBrand} animationType="slide">
                <SafeAreaView style={[styles.container]}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity
                            onPress={() => { setEditingBrand(null); setSelectedBrandImage(null); }}
                            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                            style={styles.modalCloseBtn}
                        >
                            <Ionicons name="close" size={28} color="#111" />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Edit Brand</Text>
                        <View style={{ width: 28 }} />
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
                        <View style={{ alignItems: 'center', marginVertical: 30 }}>
                            <View style={styles.largeLogoWrapper}>
                                <TouchableOpacity style={styles.largeLogoPicker} onPress={() => pickImage(setSelectedBrandImage)}>
                                    {(selectedBrandImage || editingBrand?.logo_url) ? (
                                        <Image source={{ uri: selectedBrandImage?.uri || editingBrand?.logo_url }} style={styles.fullImg} />
                                    ) : (
                                        <Ionicons name="camera" size={40} color="#8A8A8A" />
                                    )}
                                </TouchableOpacity>
                                <View style={styles.editBadge} pointerEvents="none">
                                    <Ionicons name="pencil" size={14} color="#FFF" />
                                </View>
                            </View>
                        </View>

                        <Text style={styles.cardLabel}>Brand Name</Text>
                        <TextInput style={styles.flatInput} value={editingBrand?.name} onChangeText={t => setEditingBrand({ ...editingBrand, name: t })} placeholder="Name..." />

                        <View style={{ flexDirection: 'row', gap: 15, marginTop: 20 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.cardLabel}>Sort Order</Text>
                                <TextInput
                                    style={styles.flatInput}
                                    value={editingBrand?.sort_order?.toString()}
                                    onChangeText={t => setEditingBrand({ ...editingBrand, sort_order: t.replace(/[^0-9]/g, '') })}
                                    keyboardType="numeric"
                                    placeholder="0"
                                />
                            </View>
                            <TouchableOpacity
                                style={[styles.featuredToggle, editingBrand?.is_featured && styles.featuredToggleActive]}
                                onPress={() => setEditingBrand({ ...editingBrand, is_featured: !editingBrand.is_featured })}
                            >
                                <Ionicons name={editingBrand?.is_featured ? "home" : "home-outline"} size={18} color={editingBrand?.is_featured ? "#FFF" : "#8A8A8A"} />
                                <Text style={[styles.featuredToggleText, editingBrand?.is_featured && { color: "#FFF" }]}>Featured on Home</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.cardLabel, { marginTop: 20 }]}>Linked Categories</Text>
                        <Text style={{ fontSize: 12, color: '#8A8A8A', marginBottom: 15 }}>Select categories where this brand should appear.</Text>
                        <View style={styles.catCheckList}>
                            {categories.map(cat => (
                                <TouchableOpacity
                                    key={cat.id}
                                    style={[styles.catCheckItem, editingBrand?.categoryIds?.includes(cat.id) && styles.catCheckItemActive]}
                                    onPress={() => toggleBrandCategory(cat.id)}
                                >
                                    <Ionicons
                                        name={editingBrand?.categoryIds?.includes(cat.id) ? "checkbox" : "square-outline"}
                                        size={20}
                                        color={editingBrand?.categoryIds?.includes(cat.id) ? BLUE : '#CCC'}
                                    />
                                    <Text style={[styles.catCheckText, editingBrand?.categoryIds?.includes(cat.id) && { color: BLUE }]}>{cat.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity style={[styles.saveBtn, { marginTop: 40 }]} onPress={saveBrandEdits} disabled={isSavingBrand}>
                            {isSavingBrand ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Update Brand & Links</Text>}
                        </TouchableOpacity>
                    </ScrollView>
                </SafeAreaView>
            </Modal>
            {/* Category Edit Modal */}
            <Modal visible={!!editingCategory} animationType="slide">
                <SafeAreaView style={[styles.container]}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity
                            onPress={() => setEditingCategory(null)}
                            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                            style={styles.modalCloseBtn}
                        >
                            <Ionicons name="close" size={28} color="#111" />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Edit Category</Text>
                        <View style={{ width: 28 }} />
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
                        <Text style={styles.cardLabel}>Category Name</Text>
                        <TextInput
                            style={styles.flatInput}
                            value={editingCategory?.name}
                            onChangeText={t => setEditingCategory({ ...editingCategory, name: t })}
                            placeholder="Name..."
                        />

                        <Text style={[styles.cardLabel, { marginTop: 20 }]}>Select Icon</Text>
                        <View style={styles.iconGrid}>
                            {CATEGORY_ICONS.map(icon => (
                                <TouchableOpacity
                                    key={icon}
                                    style={[styles.iconChoice, editingCategory?.icon === icon && styles.iconChoiceActive]}
                                    onPress={() => setEditingCategory({ ...editingCategory, icon })}
                                >
                                    <Ionicons name={icon as any} size={24} color={editingCategory?.icon === icon ? BLUE : '#8A8A8A'} />
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={[styles.cardLabel, { marginTop: 20 }]}>Brand Color (Light Gradients)</Text>
                        <View style={styles.colorGrid}>
                            {CATEGORY_COLORS.map(color => (
                                <TouchableOpacity
                                    key={color}
                                    style={[styles.colorChoice, { backgroundColor: color }, editingCategory?.color === color && styles.colorChoiceActive]}
                                    onPress={() => setEditingCategory({ ...editingCategory, color })}
                                />
                            ))}
                        </View>

                        <TouchableOpacity style={[styles.saveBtn, { marginTop: 40 }]} onPress={saveCategoryEdits} disabled={isSavingCategory}>
                            {isSavingCategory ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Update Category</Text>}
                        </TouchableOpacity>
                    </ScrollView>
                </SafeAreaView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    tabsContainer: { borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
    tabs: { paddingHorizontal: 20, paddingVertical: 15, gap: 10 },
    tabBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F9F9F9', gap: 8 },
    tabBtnActive: { backgroundColor: '#111' },
    tabText: { fontSize: 11, fontWeight: '800', color: '#8A8A8A' },
    tabTextActive: { color: '#FFF' },

    content: { padding: 20 },
    title: { fontSize: 24, fontWeight: '900', color: '#111', marginBottom: 20 },
    card: { backgroundColor: '#F9F9F9', borderRadius: 24, padding: 24, marginBottom: 20 },
    cardLabel: { fontSize: 11, fontWeight: '900', color: '#111', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
    toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
    miniToggle: { width: 44, height: 24, borderRadius: 12, backgroundColor: '#DDD', padding: 2 },
    miniToggleActive: { backgroundColor: '#00B850' },
    miniToggleDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF' },
    miniToggleDotActive: { alignSelf: 'flex-end' },

    flatInput: { backgroundColor: '#FFF', borderRadius: 14, height: 50, paddingHorizontal: 16, fontSize: 14, borderWidth: 1, borderColor: '#EEE', marginBottom: 15 },
    alertInput: { backgroundColor: '#FFF', borderRadius: 14, padding: 16, fontSize: 14, minHeight: 100, textAlignVertical: 'top', marginBottom: 20, borderWidth: 1, borderColor: '#EEE' },

    imageBox: { width: '100%', height: 160, borderRadius: 16, backgroundColor: '#FFF', borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#DDD', overflow: 'hidden', marginBottom: 25 },
    imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
    previewImg: { width: '100%', height: '100%' },
    imageOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
    imageOverlayText: { color: '#FFF', fontSize: 12, fontWeight: '800' },

    saveBtn: { height: 56, borderRadius: 16, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center' },
    saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },

    addBox: { flexDirection: 'row', gap: 12, marginBottom: 25 },
    squareAddBtn: { width: 50, height: 50, borderRadius: 14, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },

    catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    catCard: { width: '47%', padding: 18, borderRadius: 24, position: 'relative', borderWidth: 1, borderColor: '#EEE' },
    catCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    catIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
    catCardName: { fontSize: 16, fontWeight: '900', color: '#111', marginBottom: 4 },
    catCardSub: { fontSize: 11, fontWeight: '700', color: '#8A8A8A' },
    catDeleteBtn: { position: 'absolute', right: 12, top: 12 },

    brandFormRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    logoPicker: { width: 50, height: 50, borderRadius: 14, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EEE', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    logoPreview: { width: '100%', height: '100%' },

    brandList: { gap: 12 },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 15, padding: 15, backgroundColor: '#F9F9F9', borderRadius: 20 },
    brandLogoBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    logoImg: { width: '100%', height: '100%' },
    brandName: { fontSize: 15, fontWeight: '800', color: '#111' },

    systemBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, backgroundColor: '#F9F9F9', borderRadius: 18, marginBottom: 12 },
    systemBtnText: { fontSize: 14, fontWeight: '700', color: '#111' },

    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        paddingTop: Platform.OS === 'ios' ? 40 : 15,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        zIndex: 100,
    },
    modalCloseBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F5F5', borderRadius: 22 },
    modalTitle: { fontSize: 20, fontWeight: '900' },
    largeLogoWrapper: { position: 'relative' },
    largeLogoPicker: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#F9F9F9', borderWidth: 2, borderColor: '#EEE', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    fullImg: { width: '100%', height: '100%' },
    editBadge: { position: 'absolute', bottom: 5, right: 5, width: 32, height: 32, borderRadius: 16, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FFF', zIndex: 10 },

    catCheckList: { gap: 10 },
    catCheckItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: '#F9F9F9', borderRadius: 15 },
    catCheckItemActive: { backgroundColor: '#F0F5FF', borderWidth: 1, borderColor: BLUE },
    catCheckText: { fontSize: 14, fontWeight: '700', color: '#444' },

    featuredToggle: {
        flex: 1.5,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 15,
        backgroundColor: '#F9F9F9',
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#EEE',
        height: 50,
        marginTop: 25
    },
    featuredToggleActive: { backgroundColor: BLUE, borderColor: BLUE },
    featuredToggleText: { fontSize: 13, fontWeight: '700', color: '#8A8A8A' },

    iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
    iconChoice: { width: 50, height: 50, borderRadius: 15, backgroundColor: '#F9F9F9', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#EEE' },
    iconChoiceActive: { borderColor: BLUE, backgroundColor: '#F0F5FF' },

    colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
    colorChoice: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: '#EEE' },
    colorChoiceActive: { borderColor: BLUE, borderWidth: 3 }
});
