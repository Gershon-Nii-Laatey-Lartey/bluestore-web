import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { ArrowLeft, User, Mail, Phone, ShieldCheck, Lock, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './PersonalInfo.css';

const PersonalInfo: React.FC = () => {
    const { user: authUser } = useAuth();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [profile, setProfile] = useState<any>(null);

    // Form data
    const [fullName, setFullName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');

    useEffect(() => {
        if (authUser) fetchProfile();
    }, [authUser]);

    const fetchProfile = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', authUser?.id)
                .single();

            if (error) throw error;
            setProfile(data);
            setFullName(data.full_name || '');
            setPhoneNumber(data.phone_number || '');
        } catch (err) {
            console.error('Fetch profile error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!fullName.trim()) {
            alert('Full name is required');
            return;
        }

        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: fullName.trim(),
                    phone_number: phoneNumber.trim(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', authUser?.id);

            if (error) throw error;
            alert('Profile updated successfully');
        } catch (err: any) {
            alert(err.message || 'Failed to update profile');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="pi-page-skeleton">
                <div className="pi-header-skeleton shimmer"></div>
                <div className="pi-content-skeleton">
                    <div className="pi-field-skeleton shimmer"></div>
                    <div className="pi-field-skeleton shimmer"></div>
                    <div className="pi-field-skeleton shimmer"></div>
                    <div className="pi-btn-skeleton shimmer"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="personal-info-page">
            <header className="pi-header">
                <button className="pi-back-btn" onClick={() => navigate(-1)}>
                    <ArrowLeft size={20} />
                </button>
                <h1>Personal Information</h1>
                <div style={{ width: 44 }}></div>
            </header>

            <div className="pi-container">
                <section className="pi-form-section">
                    <span className="pi-section-label">Account Details</span>

                    <div className="pi-field">
                        <label>Full Name</label>
                        <div className="pi-input-wrapper">
                            <User size={20} className="pi-input-icon" />
                            <input 
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Enter your full name"
                            />
                        </div>
                    </div>

                    <div className="pi-field">
                        <label>Email Address</label>
                        <div className="pi-input-wrapper disabled">
                            <Mail size={20} className="pi-input-icon" />
                            <input type="text" value={authUser?.email || ''} disabled />
                            <Lock size={16} className="pi-lock-icon" />
                        </div>
                        <p className="pi-helper-text">Your login email cannot be changed here.</p>
                    </div>

                    <div className="pi-field">
                        <label>Phone Number</label>
                        <div className="pi-input-wrapper">
                            <Phone size={20} className="pi-input-icon" />
                            <input 
                                type="tel"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                placeholder="Enter phone number"
                            />
                        </div>
                    </div>

                    <div className="pi-field">
                        <label>Verification Status</label>
                        <div className={`pi-input-wrapper status-${profile?.verification_status || 'unverified'}`}>
                            <ShieldCheck 
                                size={20} 
                                className="pi-input-icon" 
                            />
                            <span className="pi-status-text">
                                {profile?.verification_status || 'Unverified'}
                            </span>
                            <Lock size={16} className="pi-lock-icon" />
                        </div>
                        <p className="pi-helper-text">Get verified to increase buyer trust in your store.</p>
                    </div>
                </section>

                <button 
                    className={`pi-save-btn ${isSaving ? 'loading' : ''}`}
                    onClick={handleSave}
                    disabled={isSaving}
                >
                    {isSaving ? <Loader2 className="spin" size={20} /> : 'Save Changes'}
                </button>
            </div>
        </div>
    );
};

export default PersonalInfo;
