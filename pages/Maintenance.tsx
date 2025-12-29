
import React, { useState, useEffect, useMemo } from 'react';
import { getMaintenanceRecords, submitMaintenancePayment, verifyMaintenancePayment } from '../services/api';
import type { MaintenanceRecord } from '../types';
import { MaintenanceStatus, UserRole } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import AuditLogModal from '../components/AuditLogModal';
import FeedbackModal from '../components/ui/FeedbackModal';
import { useAuth } from '../hooks/useAuth';
import { HistoryIcon, CurrencyRupeeIcon, ClockIcon, CheckCircleIcon, ArrowDownTrayIcon, AlertTriangleIcon } from '../components/icons';

const Maintenance: React.FC<{ initialFilter?: any }> = ({ initialFilter }) => {
    const { user } = useAuth();
    const [records, setRecords] = useState<MaintenanceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAuditOpen, setIsAuditOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<MaintenanceRecord | null>(null);
    
    // Feedback State
    const [feedback, setFeedback] = useState<{ isOpen: boolean; type: 'success' | 'error' | 'info'; title: string; message: string }>({
        isOpen: false, type: 'success', title: '', message: ''
    });

    // Form States
    const [upiId, setUpiId] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [receiptUrl, setReceiptUrl] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isAdmin = user?.role === UserRole.Admin || user?.role === UserRole.SuperAdmin || user?.role === UserRole.HelpdeskAdmin;

    const fetchRecords = async () => {
        if (user?.communityId) {
            setLoading(true);
            try {
                // Admins see everything, residents only see their own
                const data = await getMaintenanceRecords(user.communityId, isAdmin ? undefined : user.id);
                setRecords(data);
            } catch (e) { 
                console.error("Maintenance fetch error:", e); 
            } finally { 
                setLoading(false); 
            }
        }
    };

    useEffect(() => { fetchRecords(); }, [user, isAdmin]);

    /**
     * Prioritized Sorting Logic:
     * 1. Records with 'Submitted' status (Pending Verification) come first.
     * 2. Then records by Date (Descending).
     */
    const sortedRecords = useMemo(() => {
        return [...records].sort((a, b) => {
            // Prioritize status 'Submitted'
            if (a.status === MaintenanceStatus.Submitted && b.status !== MaintenanceStatus.Submitted) return -1;
            if (a.status !== MaintenanceStatus.Submitted && b.status === MaintenanceStatus.Submitted) return 1;
            
            // Otherwise sort by period date descending
            return new Date(b.periodDate).getTime() - new Date(a.periodDate).getTime();
        });
    }, [records]);

    const handlePaymentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRecord || !user) return;
        setIsSubmitting(true);
        try {
            // Fix: submitMaintenancePayment only accepts 4 arguments
            await submitMaintenancePayment(selectedRecord.id, receiptUrl, upiId, paymentDate);
            setIsPaymentModalOpen(false); 
            await fetchRecords();
            setFeedback({
                isOpen: true,
                type: 'success',
                title: 'Payment Submitted',
                message: 'Your payment proof has been logged. A peer administrator will verify the transaction shortly.'
            });
        } catch (err) { 
            console.error("Payment submission failed:", err); 
            setFeedback({
                isOpen: true,
                type: 'error',
                title: 'Submission Failed',
                message: 'We could not log your payment. Please check your internet connection and try again.'
            });
        } finally { 
            setIsSubmitting(false); 
        }
    };

    const handleVerify = async (record: MaintenanceRecord) => {
        if (!isAdmin || !user) return;
        
        // Logical Guard: Prevent self-verification
        if (record.userId === user?.id) {
            setFeedback({
                isOpen: true,
                type: 'error',
                title: 'Action Restricted',
                message: 'System Integrity Rule: You cannot verify your own maintenance payments. Please request a peer administrator to perform this verification.'
            });
            return;
        }

        try { 
            // Fix: verifyMaintenancePayment only accepts one argument
            await verifyMaintenancePayment(record.id); 
            await fetchRecords(); 
            setFeedback({
                isOpen: true,
                type: 'success',
                title: 'Payment Verified',
                message: `The payment for ${record.userName} has been successfully reconciled and marked as Paid.`
            });
        } catch (err) { 
            console.error("Verification failed:", err); 
            setFeedback({
                isOpen: true,
                type: 'error',
                title: 'Verification Failed',
                message: 'An error occurred while updating the ledger. Please try again.'
            });
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setReceiptUrl(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const getStatusLabel = (status: MaintenanceStatus) => {
        if (status === MaintenanceStatus.Submitted) return 'Pending Verification';
        return status;
    };

    const getStatusStyles = (status: MaintenanceStatus) => {
        switch (status) {
            case MaintenanceStatus.Paid: return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20';
            case MaintenanceStatus.Submitted: return 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 animate-pulse';
            default: return 'bg-slate-100 text-slate-500 dark:bg-white/5';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
                <div className="flex items-start gap-2.5">
                    <div className="w-1 h-10 bg-brand-500 rounded-full mt-1" />
                    <div>
                        <span className="text-[8px] font-mono font-black uppercase tracking-[0.3em] text-brand-600 dark:text-brand-400 mb-0.5 block">Finance & Ledger</span>
                        <h1 className="text-2xl sm:text-3xl font-brand font-extrabold text-brand-600 tracking-tight leading-tight">Maintenance</h1>
                    </div>
                </div>
                <Button onClick={() => setIsAuditOpen(true)} variant="outlined" size="md" leftIcon={<HistoryIcon />}>Audit Logs</Button>
            </div>

            <div className="space-y-3">
                {loading ? (
                    Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-slate-100 dark:bg-white/5 rounded-2xl animate-pulse" />)
                ) : (
                    sortedRecords.length === 0 ? (
                        <div className="p-16 text-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-white/5 rounded-3xl">
                            <CurrencyRupeeIcon className="w-10 h-10 mx-auto mb-3 opacity-20" />
                            <p className="font-bold uppercase tracking-widest text-[9px]">No billing records found</p>
                        </div>
                    ) : (
                        sortedRecords.map(record => {
                            const isMyOwnRecord = record.userId === user?.id;
                            
                            return (
                                <Card key={record.id} className={`p-5 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-5 bg-white dark:bg-zinc-900/40 border border-slate-50 dark:border-white/5 shadow-sm ${record.status === MaintenanceStatus.Submitted ? 'ring-2 ring-amber-500/20 bg-amber-50/10' : ''} ${isMyOwnRecord ? 'border-l-4 border-l-brand-500' : ''}`}>
                                    <div className="flex-1 w-full text-left">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${getStatusStyles(record.status)}`}>{getStatusLabel(record.status)}</span>
                                            {isMyOwnRecord ? (
                                                <span className="text-[8px] font-black uppercase tracking-widest bg-brand-500/10 text-brand-600 px-2 py-0.5 rounded">My Unit</span>
                                            ) : isAdmin && record.userName && (
                                                <span className="text-[9px] font-bold text-slate-400 uppercase">Resident: <span className="text-slate-900 dark:text-slate-100">{record.userName}</span></span>
                                            )}
                                        </div>
                                        <h3 className="text-xl font-brand font-extrabold text-slate-900 dark:text-slate-50 leading-none">
                                            {new Date(record.periodDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}
                                        </h3>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-brand-600 mt-2">Unit ID: <span className="text-slate-500 dark:text-slate-400">{record.flatNumber || 'N/A'}</span></p>
                                    </div>

                                    <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-4 md:pt-0">
                                        <div className="text-right">
                                            <p className="text-[9px] font-black uppercase tracking-tighter text-slate-400 mb-0.5">Amount Due</p>
                                            <p className="text-2xl font-brand font-extrabold text-slate-900 dark:text-slate-50">₹{record.amount.toLocaleString()}</p>
                                        </div>
                                        
                                        <div className="flex gap-2">
                                            {/* Action: Pay (Visible to the record owner if Pending) */}
                                            {record.status === MaintenanceStatus.Pending && isMyOwnRecord && (
                                                <Button size="md" onClick={() => { setSelectedRecord(record); setReceiptUrl(''); setIsPaymentModalOpen(true); }} leftIcon={<CurrencyRupeeIcon />}>Pay Now</Button>
                                            )}

                                            {/* Action: Verify (Visible to Admin if Submitted, BUT NOT for their own record) */}
                                            {record.status === MaintenanceStatus.Submitted && isAdmin && !isMyOwnRecord && (
                                                <Button size="md" onClick={() => handleVerify(record)} className="bg-emerald-600 hover:bg-emerald-700 text-white" leftIcon={<CheckCircleIcon />}>Authorize</Button>
                                            )}

                                            {/* Action: Restricted Notification (Admin viewing their own submitted record) */}
                                            {record.status === MaintenanceStatus.Submitted && isAdmin && isMyOwnRecord && (
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[8px] font-black uppercase text-amber-600 mb-1">Awaiting Peer Review</span>
                                                    <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-600" title="Self-verification restricted">
                                                        <AlertTriangleIcon className="w-4 h-4" />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Action: View Receipt (Visible if Submitted/Paid and URL exists) */}
                                            {(record.status === MaintenanceStatus.Submitted || record.status === MaintenanceStatus.Paid) && record.paymentReceiptUrl && (
                                                <Button variant="outlined" size="md" onClick={() => { setSelectedRecord(record); setIsReceiptModalOpen(true); }} leftIcon={<ArrowDownTrayIcon />}>View Proof</Button>
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            );
                        })
                    )
                )}
            </div>

            {/* Payment Submission Modal */}
            <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Settle Maintenance" subtitle="SECURE GATEWAY" size="md">
                <form className="space-y-6" onSubmit={handlePaymentSubmit}>
                    <div className="bg-slate-50 dark:bg-white/5 p-6 rounded-[2rem] text-center border border-slate-100 dark:border-white/5">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Total Outstanding</p>
                        <h4 className="text-4xl font-brand font-extrabold text-brand-600">₹{selectedRecord?.amount.toLocaleString()}</h4>
                    </div>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">UPI Transaction Reference</label>
                            <input type="text" value={upiId} onChange={e => setUpiId(e.target.value)} required placeholder="e.g. 324567890123" className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold uppercase"/>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Date of Transfer</label>
                            <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} required className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold"/>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Payment Confirmation (Screenshot)</label>
                            <div className="mt-1 flex items-center gap-4">
                                <input type="file" accept="image/*" onChange={handleFileUpload} required className="block w-full text-[11px] text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:tracking-widest file:bg-brand-50 file:text-brand-600 hover:file:bg-brand-100 cursor-pointer"/>
                            </div>
                        </div>
                    </div>
                    
                    <div className="pt-2">
                        <Button type="submit" disabled={isSubmitting} className="w-full shadow-xl shadow-brand-500/10" size="lg" leftIcon={<CheckCircleIcon />}>
                            {isSubmitting ? 'Transmitting Data...' : 'Confirm Payment'}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Receipt Viewing Modal */}
            <Modal isOpen={isReceiptModalOpen} onClose={() => setIsReceiptModalOpen(false)} title="Payment Verification" subtitle="AUDIT PROOF" size="lg">
                {selectedRecord && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                                <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-1">Transaction ID</p>
                                <p className="text-sm font-bold break-all">{selectedRecord.upiTransactionId || 'N/A'}</p>
                            </div>
                            <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                                <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-1">Payment Date</p>
                                <p className="text-sm font-bold">{selectedRecord.transactionDate ? new Date(selectedRecord.transactionDate).toLocaleDateString() : 'N/A'}</p>
                            </div>
                        </div>
                        
                        <div className="rounded-3xl overflow-hidden border-2 border-slate-100 dark:border-white/5 bg-black/5">
                            {selectedRecord.paymentReceiptUrl ? (
                                <img src={selectedRecord.paymentReceiptUrl} alt="Payment Proof" className="w-full h-auto max-h-[500px] object-contain mx-auto" />
                            ) : (
                                <div className="p-20 text-center text-slate-400 italic">No image attachment found.</div>
                            )}
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button variant="outlined" onClick={() => setIsReceiptModalOpen(false)} size="md">Close Preview</Button>
                        </div>
                    </div>
                )}
            </Modal>

            <FeedbackModal 
                isOpen={feedback.isOpen} 
                onClose={() => setFeedback({ ...feedback, isOpen: false })} 
                title={feedback.title} 
                message={feedback.message} 
                type={feedback.type} 
            />

            <AuditLogModal isOpen={isAuditOpen} onClose={() => setIsAuditOpen(false)} entityType="MaintenanceRecord" title="Billing Ledger" />
        </div>
    );
};

export default Maintenance;
