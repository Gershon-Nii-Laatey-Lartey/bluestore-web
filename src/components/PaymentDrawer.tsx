import React, { useEffect, useState } from 'react';
import { paystack } from '../lib/paystack';
import { supabase } from '../lib/supabase';
import { X, ArrowRight, Check, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './PaymentDrawer.css';

interface PaymentDrawerProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: (reference: string) => void;
    amount: number;
    description: string;
    metadata: any;
}

type PaymentStep = 'phone' | 'otp' | 'processing' | 'success' | 'failed';

export const PaymentDrawer: React.FC<PaymentDrawerProps> = ({ visible, onClose, onSuccess, amount, description, metadata }) => {
    const [step, setStep] = useState<PaymentStep>('phone');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otp, setOtp] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [reference, setReference] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [userEmail, setUserEmail] = useState('');

    useEffect(() => {
        if (visible) {
            resetState();
            fetchUserData();
        }
    }, [visible]);

    const resetState = () => {
        setStep('phone');
        setOtp('');
        setIsSubmitting(false);
        setReference('');
        setErrorMessage('');
    };

    const fetchUserData = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setUserEmail(user.email || `${user.id}@bluestore.com`);
            const { data: profile } = await supabase.from('profiles').select('phone_number').eq('id', user.id).single();
            if (profile?.phone_number) {
                setPhoneNumber(profile.phone_number.replace('+233', '').trim());
            }
        }
    };

    const handleInitiateCharge = async () => {
        if (phoneNumber.length < 9) {
            alert('Please enter a valid phone number.');
            return;
        }

        setIsSubmitting(true);
        const fullPhone = phoneNumber.startsWith('0') ? `233${phoneNumber.substring(1)}` : phoneNumber.startsWith('233') ? phoneNumber : `233${phoneNumber}`;

        try {
            const res = await paystack.chargeMobileMoney(userEmail, amount, fullPhone, metadata);
            if (res.status === true) {
                setReference(res.data.reference);
                if (res.data.status === 'send_otp') setStep('otp');
                else {
                    setStep('processing');
                    pollStatus(res.data.reference);
                }
            } else {
                setErrorMessage(res.message || 'Payment failed.');
                setStep('failed');
            }
        } catch (error: any) {
            setErrorMessage(error.message);
            setStep('failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmitOtp = async () => {
        if (otp.length < 4) return;
        setIsSubmitting(true);
        try {
            const res = await paystack.submitOTP(otp, reference);
            if (res.status === true) {
                setStep('processing');
                pollStatus(reference);
            } else {
                setErrorMessage(res.message || 'Invalid OTP');
            }
        } catch (error: any) {
            setErrorMessage(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const pollStatus = async (ref: string) => {
        let attempts = 0;
        const check = async () => {
            attempts++;
            const v = await paystack.verifyTransaction(ref);
            if (v?.data?.status === 'success') {
                setStep('success');
                setTimeout(() => { onSuccess(ref); onClose(); }, 2000);
            } else if (v?.data?.status === 'failed') {
                setErrorMessage(v.data.gateway_response || 'Failed.');
                setStep('failed');
            } else if (attempts < 20 && visible) {
                setTimeout(check, 3000);
            } else {
                setErrorMessage('Timed out.');
                setStep('failed');
            }
        };
        check();
    };

    return (
        <AnimatePresence>
            {visible && (
                <div className="payment-modal-root">
                    <motion.div 
                        className="pm-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />
                    <motion.div 
                        className="pm-drawer"
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    >
                        <header className="pm-header">
                            <div className="pm-title-block">
                                <h3>{step === 'otp' ? 'Verification' : 'Checkout'}</h3>
                                <p>{description}</p>
                            </div>
                            <button className="pm-close-btn" onClick={onClose}><X size={20} /></button>
                        </header>

                        <div className="pm-content">
                            {step === 'phone' && (
                                <div className="pm-step">
                                    <label>Mobile Money Number</label>
                                    <div className="pm-input-group">
                                        <div className="pm-country">🇬🇭 +233</div>
                                        <input 
                                            type="tel" 
                                            value={phoneNumber} 
                                            onChange={(e) => setPhoneNumber(e.target.value)}
                                            placeholder="024 000 0000"
                                            autoFocus
                                        />
                                    </div>
                                    <p className="pm-hint">You'll receive a prompt on this phone to authorize GH₵ {amount}.</p>
                                    <button className="pm-primary-btn" onClick={handleInitiateCharge} disabled={isSubmitting}>
                                        {isSubmitting ? <Loader2 className="spin" size={20} /> : <>Pay GH₵ {amount} <ArrowRight size={18} /></>}
                                    </button>
                                </div>
                            )}

                            {step === 'otp' && (
                                <div className="pm-step">
                                    <label>Enter Verification Code</label>
                                    <input 
                                        className="pm-otp-input"
                                        type="text" 
                                        maxLength={6}
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value)}
                                        placeholder="000 000"
                                        autoFocus
                                    />
                                    <button className="pm-primary-btn" onClick={handleSubmitOtp} disabled={otp.length < 4 || isSubmitting}>
                                        {isSubmitting ? <Loader2 className="spin" size={20} /> : 'Confirm Payment'}
                                    </button>
                                    <button className="pm-back-link" onClick={() => setStep('phone')}>Use another number</button>
                                </div>
                            )}

                            {step === 'processing' && (
                                <div className="pm-status-step">
                                    <Loader2 className="spin large" size={48} />
                                    <h4>Awaiting Authorization</h4>
                                    <p>Please authorize the prompt sent to your phone ({phoneNumber})</p>
                                </div>
                            )}

                            {step === 'success' && (
                                <div className="pm-status-step success">
                                    <div className="pm-check-bg"><Check size={40} /></div>
                                    <h4>Payment Successful!</h4>
                                    <p>Your {metadata?.package_type === 'boost' ? 'listing boost' : 'pro plan'} is now active.</p>
                                </div>
                            )}

                            {step === 'failed' && (
                                <div className="pm-status-step failed">
                                    <div className="pm-fail-bg"><AlertCircle size={40} /></div>
                                    <h4>Transaction Failed</h4>
                                    <p>{errorMessage}</p>
                                    <button className="pm-retry-btn" onClick={resetState}>Try Again</button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
