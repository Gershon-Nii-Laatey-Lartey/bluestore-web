import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Mosaic from '../../components/Mosaic/Mosaic';
import './Auth.css';

const Login: React.FC = () => {
    const navigate = useNavigate();
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [callingCode] = useState('+233');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!phone || !password || isLoading) return;
        setIsLoading(true);
        setError(null);

        const cleanPhone = phone.trim().replace(/^0+/, '');
        const fullPhone = `${callingCode}${cleanPhone}`;

        try {
            const { error: loginError, data } = await supabase.auth.signInWithPassword({
                phone: fullPhone,
                password: password,
            });
            if (loginError) throw loginError;
            if (data.session) navigate('/');
        } catch (err: any) {
            setError(err.message || 'Login failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="auth-viewport">
            {/* Left Side: Form */}
            <main className="auth-form-side">
                <nav className="auth-nav-top">
                    <button className="auth-back-link" onClick={() => navigate('/')}>
                        <ArrowLeft size={18} />
                    </button>
                </nav>

                <div className="auth-brand-logo">
                    <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
                        <rect width="40" height="40" rx="10" fill="#2563eb" />
                        <path d="M12 20L20 12L28 20" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M20 12V28" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>

                <div className="auth-hero-group">
                    <h1>Sign in to your account</h1>
                    <p>Please continue to sign in to your business account</p>
                </div>

                <form onSubmit={handleLogin} className="auth-input-hub">
                    <div className="auth-field-stack">
                        <div className="auth-phone-input-wrap">
                            <span className="auth-phone-prefix">{callingCode}</span>
                            <div className="auth-phone-divider"></div>
                            <input 
                                className="auth-phone-field"
                                type="tel" 
                                placeholder="000 000 0000"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="auth-field-stack">
                        <input 
                            className="auth-input-minimal"
                            type="password" 
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    {error && <div className="auth-error-mini">{error}</div>}

                    <button 
                        type="submit" 
                        className="auth-continue-btn"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Verifying...' : 'Continue'}
                    </button>
                </form>

                <div className="auth-divider-mono">
                    <div className="auth-divider-line"></div>
                    <span>or</span>
                    <div className="auth-divider-line"></div>
                </div>

                <div className="auth-social-stack">
                    <button className="auth-social-btn">
                        <svg className="auth-social-icon" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        <span>Continue with Google</span>
                    </button>
                    <button className="auth-social-btn">
                        <svg className="auth-social-icon" viewBox="0 0 24 24">
                            <path d="M22.5 12c0-5.799-4.701-10.5-10.5-10.5S1.5 6.201 1.5 12c0 5.303 3.939 9.684 9.075 10.414v-7.362H7.93v-3.052h2.645V9.658c0-2.61 1.554-4.051 3.932-4.051 1.139 0 2.332.203 2.332.203v2.563h-1.314c-1.293 0-1.696.803-1.696 1.626v1.954h2.889l-.462 3.052h-2.427v7.362C18.56 21.684 22.5 17.303 22.5 12z" fill="#1877F2"/>
                        </svg>
                        <span>Continue with Facebook</span>
                    </button>
                </div>

                <footer className="auth-bottom-msg">
                    <p>Don't have an account? <Link to="/signup">Sign up for free</Link></p>
                </footer>
            </main>

            {/* Right Side: Mosaic Splash */}
            <aside className="auth-mosaic-side">
                <Mosaic />
            </aside>
        </div>
    );
};

export default Login;
