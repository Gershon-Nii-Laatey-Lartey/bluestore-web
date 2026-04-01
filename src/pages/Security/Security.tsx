import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Lock, Eye, EyeOff, Loader2, ShieldCheck, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './Security.css';

const Security: React.FC = () => {
    const navigate = useNavigate();
    const [isSaving, setIsSaving] = useState(false);

    // Password state
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPasswords, setShowPasswords] = useState(false);

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPassword || !confirmPassword) {
            alert('Please fill in all fields');
            return;
        }

        if (newPassword !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }

        if (newPassword.length < 6) {
            alert('Password must be at least 6 characters');
            return;
        }

        setIsSaving(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;
            alert('Password updated successfully');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            alert(err.message || 'Failed to update password');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="security-settings-page">
            <header className="sec-header">
                <button className="sec-back-btn" onClick={() => navigate(-1)}>
                    <ArrowLeft size={20} />
                </button>
                <h1>Security Settings</h1>
                <div style={{ width: 44 }}></div>
            </header>

            <div className="sec-container">
                <section className="sec-section">
                    <div className="sec-section-header">
                        <span className="sec-label">Update Password</span>
                        <button 
                            className="sec-toggle-view"
                            onClick={() => setShowPasswords(!showPasswords)}
                        >
                            {showPasswords ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>

                    <form className="sec-password-form" onSubmit={handleChangePassword}>
                        <div className="sec-field">
                            <label>New Password</label>
                            <div className="sec-input-wrapper">
                                <Lock size={18} className="sec-input-icon" />
                                <input 
                                    type={showPasswords ? "text" : "password"}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="At least 6 characters"
                                />
                            </div>
                        </div>

                        <div className="sec-field">
                            <label>Confirm New Password</label>
                            <div className="sec-input-wrapper">
                                <Lock size={18} className="sec-input-icon" />
                                <input 
                                    type={showPasswords ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Re-enter new password"
                                />
                            </div>
                        </div>

                        <button 
                            type="submit"
                            className={`sec-save-btn ${isSaving ? 'loading' : ''}`}
                            disabled={isSaving}
                        >
                            {isSaving ? <Loader2 className="spin" size={20} /> : 'Update Password'}
                        </button>
                    </form>
                </section>

                <div className="sec-divider"></div>

                <section className="sec-section">
                    <span className="sec-label">Account Protection</span>
                    
                    <div className="sec-menu-item">
                        <div className="sec-item-icon check">
                            <ShieldCheck size={20} />
                        </div>
                        <div className="sec-item-content">
                            <h4>Two-Factor Authentication</h4>
                            <p>Add an extra layer of security to your account.</p>
                        </div>
                        <button className="sec-setup-link">Setup</button>
                    </div>

                    <div className="sec-menu-item">
                        <div className="sec-item-icon error">
                            <Trash2 size={20} />
                        </div>
                        <div className="sec-item-content">
                            <h4>Deactivate Account</h4>
                            <p>Temporarily hide your profile and active listings.</p>
                        </div>
                        <button className="sec-setup-link plain">Manage</button>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default Security;
