import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { X, ShieldAlert, CheckCircle } from 'lucide-react';
import './ReportModal.css';

interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    targetType: 'listing' | 'profile' | 'chat';
    targetId: string;
    targetName: string;
}

const REPORT_REASONS = [
    'Counterfeit item',
    'Offensive content',
    'Scam or Fraudulent activity',
    'Incorrect category/details',
    'Prohibited item',
    'Poor seller behavior',
    'Other'
];

const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, targetType, targetId, targetName }) => {
    const { user } = useAuth();
    const [reason, setReason] = useState('');
    const [details, setDetails] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !reason || isSubmitting) return;

        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('reports').insert([{
                reporter_id: user.id,
                target_type: targetType,
                target_id: targetId,
                reason,
                details
            }]);

            if (error) throw error;
            setIsSuccess(true);
            setTimeout(() => {
                onClose();
                setIsSuccess(false);
                setReason('');
                setDetails('');
            }, 2000);
        } catch (err) {
            console.error('Report error:', err);
            alert('Failed to submit report. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="report-modal-overlay">
            <div className="report-modal-container">
                <header className="report-modal-header">
                    <div className="report-header-info">
                        <ShieldAlert size={20} color="#ef4444" />
                        <h3>Report {targetType === 'profile' ? 'User' : 'Listing'}</h3>
                    </div>
                    <button className="close-report-btn" onClick={onClose}><X size={20} /></button>
                </header>

                {isSuccess ? (
                    <div className="report-success-state">
                        <CheckCircle size={48} color="#10b981" />
                        <h2>Report Submitted</h2>
                        <p>Our team will investigate <strong>{targetName}</strong> based on your feedback. We appreciate your help in keeping Bluestore safe.</p>
                    </div>
                ) : (
                    <form className="report-form" onSubmit={handleSubmit}>
                        <p className="report-intro">
                            You are reporting <strong>{targetName}</strong>. Select the reason that best describes the issue.
                        </p>

                        <div className="form-group">
                            <label>Reason for reporting</label>
                            <select 
                                value={reason} 
                                onChange={(e) => setReason(e.target.value)}
                                required
                            >
                                <option value="">Select a reason...</option>
                                {REPORT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Additional Details (Optional)</label>
                            <textarea 
                                placeholder="Describe specifically what is wrong..." 
                                value={details}
                                onChange={(e) => setDetails(e.target.value)}
                                rows={4}
                            />
                        </div>

                        <div className="report-footer-actions">
                            <button type="button" className="cancel-report-btn" onClick={onClose}>Cancel</button>
                            <button 
                                type="submit" 
                                className="submit-report-btn" 
                                disabled={!reason || isSubmitting}
                            >
                                {isSubmitting ? 'Submitting Report...' : 'Submit Report'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ReportModal;
