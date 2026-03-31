import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Camera, X, ChevronRight, MapPin } from 'lucide-react';
import LocationModal from '../../components/LocationModal/LocationModal';
import './Publish.css';

const Publish: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    
    // Form State
    const [title, setTitle] = useState('');
    const [price, setPrice] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [brand, setBrand] = useState('');
    const [condition, setCondition] = useState('Brand New');
    const [location, setLocation] = useState('Accra, Ghana');
    const [images, setImages] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [existingImages, setExistingImages] = useState<string[]>([]);
    const [isLocModalOpen, setIsLocModalOpen] = useState(false);
    const { id } = useParams<{ id: string }>();

    const [dbCategories, setDbCategories] = useState<any[]>([]);
    const [dbBrands, setDbBrands] = useState<string[]>([]);

    useEffect(() => {
        fetchCategories();
    }, []);

    useEffect(() => {
        if (category) fetchBrands(category);
    }, [category]);

    useEffect(() => {
        if (id) fetchExistingListing();
    }, [id]);

    const fetchExistingListing = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.from('listings').select('*').eq('id', id).single();
            if (error) throw error;
            if (data) {
                setTitle(data.title);
                setPrice(data.price.toString());
                setDescription(data.description);
                setCategory(data.category);
                setBrand(data.brand);
                setCondition(data.condition);
                setLocation(data.location || 'Accra, Ghana');
                setExistingImages(data.images || []);
            }
        } catch (err) {
            console.error('Error fetching listing:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchCategories = async () => {
        const { data } = await supabase.from('categories').select('*').order('name');
        if (data) setDbCategories(data);
    };

    const fetchBrands = async (catName: string) => {
        const cat = dbCategories.find(c => c.name === catName);
        if (!cat) return;
        const { data } = await supabase.from('category_brands').select('brands(name)').eq('category_id', cat.id);
        if (data) setDbBrands(data.map((b: any) => b.brands.name));
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setImages(prev => [...prev, ...newFiles].slice(0, 10));
            
            const newPreviews = newFiles.map(file => URL.createObjectURL(file));
            setImagePreviews(prev => [...prev, ...newPreviews].slice(0, 10));
        }
    };

    const removeImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
        setImagePreviews(prev => prev.filter((_, i) => i !== index));
    };

    const removeExistingImage = (index: number) => {
        setExistingImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return alert('Please login to continue');
        if (images.length === 0 && existingImages.length === 0) return alert('Please add at least one image');

        setIsLoading(true);
        try {
            const uploadedUrls = [];
            for (const file of images) {
                const fileName = `${user.id}/${Date.now()}_${file.name}`;
                const { data, error } = await supabase.storage
                    .from('listing_images')
                    .upload(fileName, file);
                
                if (error) throw error;
                const { data: { publicUrl } } = supabase.storage.from('listing_images').getPublicUrl(fileName);
                uploadedUrls.push(publicUrl);
            }

            const finalImages = [...existingImages, ...uploadedUrls];

            const listingData = {
                user_id: user.id,
                title,
                price: parseFloat(price),
                description,
                category,
                brand,
                condition,
                location,
                images: finalImages,
                status: 'approved' // Auto-approve for demo
            };

            if (id) {
                const { error } = await supabase.from('listings').update([listingData]).eq('id', id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('listings').insert([listingData]);
                if (error) throw error;
            }

            navigate('/');
        } catch (err) {
            console.error('Submit error:', err);
            alert('Failed to save listing. Check console.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="publish-page">
            <div className="publish-container">
                <header className="publish-header">
                    <h1>{id ? 'Update Discovery' : 'List an Item'}</h1>
                    <p>{id ? 'Maintain your listing property integrity' : 'Tell us what you\'re selling'}</p>
                </header>

                <form className="publish-form" onSubmit={handleSubmit}>
                    <div className="publish-left-col">
                        <section className="form-section">
                            <span className="section-label">Photos (Up to 10)</span>
                            <div className="image-grid-uploader">
                                {existingImages.map((url, i) => (
                                    <div key={`existing-${i}`} className="image-preview-card">
                                        <img src={url} alt="preview" />
                                        <button type="button" className="remove-img" onClick={() => removeExistingImage(i)}>
                                            <X size={14} />
                                        </button>
                                        {i === 0 && <span className="cover-badge">COVER</span>}
                                    </div>
                                ))}
                                {imagePreviews.map((preview, i) => (
                                    <div key={`new-${i}`} className="image-preview-card">
                                        <img src={preview} alt="preview" />
                                        <button type="button" className="remove-img" onClick={() => removeImage(i)}>
                                            <X size={14} />
                                        </button>
                                        {existingImages.length === 0 && i === 0 && <span className="cover-badge">COVER</span>}
                                    </div>
                                ))}
                                {(imagePreviews.length + existingImages.length) < 10 && (
                                    <label className="upload-placeholder">
                                        <input type="file" multiple accept="image/*" onChange={handleImageChange} hidden />
                                        <Camera size={24} />
                                        <span>Add Photo</span>
                                    </label>
                                )}
                            </div>
                        </section>

                        <div className="form-group">
                            <span className="section-label">Item Condition</span>
                            <select value={condition} onChange={e => setCondition(e.target.value)}>
                                <option value="Brand New">Brand New</option>
                                <option value="Like New">Like New</option>
                                <option value="Used - Good">Used - Good</option>
                                <option value="Used - Fair">Used - Fair</option>
                            </select>
                        </div>
                    </div>

                    <div className="publish-right-col">
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Title</label>
                                <input 
                                    type="text" 
                                    placeholder="E.g. iPhone 15 Pro Max" 
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="form-group price-group">
                                <label>Price (GH₵)</label>
                                <input 
                                    type="number" 
                                    placeholder="0.00" 
                                    value={price}
                                    onChange={e => setPrice(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Category</label>
                                <select value={category} onChange={e => setCategory(e.target.value)} required>
                                    <option value="">Select Category</option>
                                    {dbCategories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Brand</label>
                                <select value={brand} onChange={e => setBrand(e.target.value)} required>
                                    <option value="">Select Brand</option>
                                    {dbBrands.map(b => <option key={b} value={b}>{b}</option>)}
                                    <option value="Other">Other</option>
                                </select>
                            </div>

                            <div className="form-group full-width">
                                <label>Location</label>
                                <div className="input-with-icon" onClick={() => setIsLocModalOpen(true)}>
                                    <MapPin size={16} />
                                    <input 
                                        type="text" 
                                        placeholder="Calibrate location..." 
                                        value={location}
                                        readOnly
                                        style={{ cursor: 'pointer' }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="form-group full-width" style={{ marginTop: '0' }}>
                            <label>Description</label>
                            <textarea 
                                placeholder="Describe your item's features, flaws, and details..."
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                rows={6}
                                required
                            />
                        </div>

                        <button type="submit" className="publish-submit-btn" disabled={isLoading}>
                            {isLoading ? (
                                <div className="loading-dots">
                                    <div className="dot" />
                                    <div className="dot" />
                                    <div className="dot" />
                                </div>
                            ) : (
                                <>
                                    <span>{id ? 'Update Discovery' : 'Publish Listing'}</span>
                                    <ChevronRight size={18} />
                                </>
                            )}
                        </button>
                    </div>
                </form>

                <LocationModal 
                    isOpen={isLocModalOpen} 
                    onClose={() => setIsLocModalOpen(false)}
                    onSelect={(loc) => setLocation(loc.name)}
                />
            </div>
        </div>
    );
};

export default Publish;
