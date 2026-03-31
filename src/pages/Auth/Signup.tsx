import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, ChevronLeft, Mail, Globe as Google } from 'lucide-react';
import './Auth.css';

const Signup: React.FC = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password || isLoading) return;

        setIsLoading(true);
        setError(null);

        try {
            const { error, data: { user } } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        phone: phone,
                    }
                }
            });

            if (error) throw error;
            if (user) {
                alert('Signup successful! Please check your email for verification.');
                navigate('/login');
            }
        } catch (err: any) {
            setError(err.message || 'Signup failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <button className="back-button" onClick={() => navigate(-1)}>
                    <ChevronLeft size={20} />
                </button>

                <div className="auth-header">
                    <h1>Create Account</h1>
                    <p>Join Bluestore to start trading today</p>
                </div>

                <form onSubmit={handleSignup} className="auth-form">
                    <div className="form-group">
                        <label>Email Address</label>
                        <input 
                            type="email" 
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Phone Number (Optional)</label>
                        <input 
                            type="tel" 
                            placeholder="Enter your phone number"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <div className="password-input">
                            <input 
                                type={showPassword ? 'text' : 'password'} 
                                placeholder="Create a password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <button 
                                type="button" 
                                className="toggle-password"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>

                    {error && <div className="auth-error">{error}</div>}

                    <button 
                        type="submit" 
                        className={`submit-btn ${isLoading ? 'loading' : ''}`}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Creating account...' : 'Sign up'}
                    </button>
                </form>

                <div className="auth-footer">
                    <p>Already have an account? <Link to="/login">Log in</Link></p>
                </div>

                <div className="divider">
                    <span>or sign up with</span>
                </div>

                <div className="social-login">
                    <button className="social-btn"><Google size={20} /></button>
                    <button className="social-btn"><Mail size={20} /></button>
                </div>
            </div>
        </div>
    );
};

export default Signup;
