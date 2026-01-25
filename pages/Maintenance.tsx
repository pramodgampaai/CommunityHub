
import React, { useState, useEffect, useMemo } from 'react';
import { getMaintenanceRecords, submitMaintenancePayment, verifyMaintenancePayment, getCachedData } from '../services/api';
import type { MaintenanceRecord } from '../types';
import { MaintenanceStatus, UserRole } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import AuditLogModal from '../components/AuditLogModal';
import FeedbackModal from '../components/ui/FeedbackModal';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import { useAuth } from '../hooks/useAuth';
import { 
    HistoryIcon, 
    CurrencyRupeeIcon, 
    ClockIcon, 
    CheckCircleIcon, 
    ArrowDownTrayIcon, 
    AlertTriangleIcon,
    CalendarIcon,
    XIcon,
    HomeIcon
} from '../components/icons';

const Maintenance: React.FC<{ initialFilter?: any }> = ({ initialFilter }) => {
    const { user } = useAuth();
    const isAdmin = user?.role === UserRole.Admin || user?.role === UserRole.SuperAdmin || user?.role === UserRole.HelpdeskAdmin;
    
    const cacheKey = `maintenance:${user?.communityId}:${isAdmin ? 'all' : user?.id}`;
    
    const [records, setRecords] = useState<MaintenanceRecord[]>(() => getCachedData(cacheKey) || []);
    const [loading, setLoading] = useState(!getCachedData(cacheKey));
    
    // Default tab logic: If admin, show queue. If resident, show dues.
    const [activeTab, setActiveTab] = useState<'dues' | 'verification' | 'history'>(() => {
        if (initialFilter === 'verification') return 'verification';
        return isAdmin ? 'verification' : 'dues';
    });
    
    // Modals
    const [isAuditOpen, setIsAuditOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<MaintenanceRecord | null>(null);
    
    // Form State
    const [upiId, setUpiId] = useState('');
    const [receiptUrl, setReceiptUrl] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [feedback, setFeedback] = useState<{ isOpen: boolean; type: 'success' | 'error' | 'info'; title: string; message: string }>({
        isOpen: false, type: 'success', title: '', message: ''
    });

    const fetchRecords = async () => {
        if (user?.communityId) {
            try {
                // Admins see everything, residents see only their own
                const data = await getMaintenanceRecords(user.communityId, isAdmin ? undefined : user.id);
                setRecords(data);
            } catch (e) { 
                console.error(e); 
            } finally { 
                setLoading(false); 
            }
        }
    };

    useEffect(() => { fetchRecords(); }, [user, isAdmin]);

    // Handle incoming navigation filters
    useEffect(() => {
        if (initialFilter === 'verification') setActiveTab('verification');
        else if (initialFilter === 'dues') setActiveTab('dues');
    }, [initialFilter]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 1.5 * 1024 * 1024) {
                setFeedback({ isOpen: true, type: 'error', title: 'Limit Exceeded', message: 'Proof must be under 1.5MB.' });
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => setReceiptUrl(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handlePaymentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRecord || !receiptUrl) return;
        setIsSubmitting(true);
        try {
            await submitMaintenancePayment(selectedRecord.id, receiptUrl, upiId, paymentDate);
            setFeedback({ isOpen: true, type: 'success', title: 'Payment Submitted', message: 'Your proof has been sent for admin verification.' });
            setIsPaymentModalOpen(false);
            setReceiptUrl(''); setUpiId('');
            await fetchRecords();
        } catch (err: any) {
            setFeedback({ isOpen: true, type: 'error', title: 'Submission Failed', message: err.message });
        } finally { setIsSubmitting(false); }
    };

    const handleVerify = async (id: string) => {
        setIsSubmitting(true);
        try {
            await verifyMaintenancePayment(id);
            setFeedback({ isOpen: true, type: 'success', title: 'Payment Verified', message: 'The ledger has been updated and the resident notified.' });
            setIsDetailModalOpen(false);
            await fetchRecords();
        } catch (err: any) {
            setFeedback({ isOpen: true, type: 'error', title: 'Verification Error', message: err.message });
        } finally { setIsSubmitting(false); }
    };

    const filteredRecords = useMemo(() => {
        return records.filter(r => {
            if (activeTab === 'dues') return r.status === MaintenanceStatus.Pending;
            if (activeTab === 'verification') return r.status === MaintenanceStatus.Submitted;
            return r.status === MaintenanceStatus.Paid;
        }).sort((a, b) => new Date(b.periodDate).getTime() - new Date(a.periodDate).getTime());
    }, [records, activeTab]);

    return (
        <div className="space-y-6 pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 min-h-[5rem]">
                <div className="flex items-start gap-2.5">
                    <div className="w-1 h-10 bg-brand-500 rounded-full mt-1" />
                    <div>
                        <span className="text-[9px] font-mono font-black uppercase tracking-[0.3em] text-brand-600 dark:text-brand-400 mb-0.5 block">Finance & Ledger</span>
                        <h1 className="text-2xl sm:text-3xl font-brand font-extrabold text-brand-600 dark:text-brand-400 tracking-tight leading-tight">Maintenance</h1>
                    </div>
                </div>
                <Button onClick={() => setIsAuditOpen(true)} variant="outlined" size="md" leftIcon={<HistoryIcon />}>Audit Log</Button>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-900/40 p-1.5 rounded-2xl w-fit overflow-x-auto no-scrollbar max-w-full shadow-sm border border-slate-100 dark:border-white/5">
                <button 
                    onClick={() => setActiveTab('dues')} 
                    className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'dues' ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    {isAdmin ? 'All Outstanding' : 'My Dues'}
                </button>
                <button 
                    onClick={() => setActiveTab('verification')} 
                    className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'verification' ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    {isAdmin ? 'Verify Queue' : 'Under Review'}
                </button>
                <button 
                    onClick={() => setActiveTab('history')} 
                    className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'history' ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    Settled History
                </button>
            </div>

            {loading && records.length === 0 ? (
                <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 bg-slate-100 dark:bg-white/5 rounded-[2rem] animate-pulse" />)}
                </div>
            ) : filteredRecords.length === 0 ? (
                <div className="py-24 text-center border-2 border-dashed border-slate-100 dark:border-white/5 rounded-[3rem] opacity-30">
                    <CheckCircleIcon className="w-16 h-16 mx-auto mb-4" />
                    <p className="font-brand font-extrabold text-xl">Ledger Clear</p>
                    <p className="text-[10px] font-black uppercase tracking-widest mt-1">No records in this category</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredRecords.map(record => {
                        const isMyRecord = record.userId === user?.id;
                        
                        return (
                            <Card key={record.id} className="p-6 rounded-[2.5rem] bg-white dark:bg-zinc-900/40 border border-slate-50 dark:border-white/5 flex flex-col justify-between shadow-sm group hover:scale-[1.01] transition-transform">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1 min-w-0 pr-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-sm ${
                                                record.status === MaintenanceStatus.Paid ? 'bg-emerald-50 text-emerald-600' : 
                                                record.status === MaintenanceStatus.Submitted ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
                                            }`}>
                                                {record.status}
                                            </span>
                                            <span className="text-[10px] font-black uppercase text-brand-600 bg-brand-50/50 px-2 py-0.5 rounded-md">
                                                Unit: {record.flatNumber || 'N/A'}
                                            </span>
                                        </div>
                                        <h3 className="text-2xl font-brand font-extrabold text-slate-900 dark:text-slate-50 truncate">
                                            {new Date(record.periodDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}
                                        </h3>
                                        {isAdmin && (
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mt-1 truncate">{record.userName}</p>
                                        )}
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-tighter mb-0.5">Amount</p>
                                        <p className="text-3xl font-brand font-extrabold text-brand-600">₹{record.amount.toLocaleString()}</p>
                                    </div>
                                </div>

                                <div className="mt-6 pt-6 border-t border-slate-50 dark:border-white/5">
                                    {record.status === MaintenanceStatus.Pending && (isMyRecord || !isAdmin) && (
                                        <Button className="w-full h-12" onClick={() => { setSelectedRecord(record); setIsPaymentModalOpen(true); }} leftIcon={<CurrencyRupeeIcon />}>
                                            Pay Now
                                        </Button>
                                    )}
                                    {(record.status === MaintenanceStatus.Submitted || record.status === MaintenanceStatus.Paid) && (
                                        <Button variant="outlined" className="w-full h-12" onClick={() => { setSelectedRecord(record); setIsDetailModalOpen(true); }} leftIcon={record.status === MaintenanceStatus.Submitted ? <ClockIcon /> : <CheckCircleIcon />}>
                                            {record.status === MaintenanceStatus.Submitted ? 'Review Proof' : 'View Receipt'}
                                        </Button>
                                    )}
                                    {record.status === MaintenanceStatus.Pending && isAdmin && !isMyRecord && (
                                        <div className="flex items-center justify-center gap-2 text-rose-600 bg-rose-50/50 dark:bg-rose-900/10 p-3 rounded-2xl border border-rose-100 dark:border-rose-900/20">
                                            <AlertTriangleIcon className="w-5 h-5" />
                                            <p className="text-[10px] font-black uppercase tracking-widest">Awaiting Submission</p>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Resident: Submit Payment Modal */}
            <Modal isOpen={isPaymentModalOpen} onClose={() => { setIsPaymentModalOpen(false); setReceiptUrl(''); }} title="Settle Dues" subtitle="FINANCIAL TRANSACTION" size="lg">
                <form onSubmit={handlePaymentSubmit} className="space-y-6">
                    <div className="p-6 bg-slate-50 dark:bg-black/20 rounded-[2rem] border border-slate-100 dark:border-white/5 flex flex-col items-center text-center">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">DUE FOR {selectedRecord && new Date(selectedRecord.periodDate).toLocaleString(undefined, { month: 'long', year: 'numeric' }).toUpperCase()}</p>
                        <p className="text-5xl font-brand font-extrabold text-brand-600">₹{selectedRecord?.amount.toLocaleString()}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="sm:col-span-2">
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Payment Proof (Screenshot)</label>
                            <div className="relative group">
                                <input type="file" accept="image/*" onChange={handleFileUpload} required className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                <div className="border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl p-8 text-center group-hover:border-brand-500 group-hover:bg-brand-50/10 transition-all">
                                    {receiptUrl ? (
                                        <div className="relative inline-block">
                                            <img src={receiptUrl} alt="Receipt" className="max-h-32 mx-auto rounded-lg shadow-lg border border-slate-200" />
                                            <div className="absolute -top-2 -right-2 bg-emerald-500 text-white rounded-full p-1"><CheckCircleIcon className="w-4 h-4" /></div>
                                        </div>
                                    ) : (
                                        <>
                                            <ArrowDownTrayIcon className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                            <p className="text-[10px] font-black text-slate-400 uppercase">Transmit Transaction Evidence</p>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Transaction Ref (UPI ID)</label>
                            <input type="text" value={upiId} onChange={e => setUpiId(e.target.value)} required placeholder="e.g. 123456789012" className="rounded-xl input-field text-sm font-bold"/>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Payment Date</label>
                            <div className="relative">
                                <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} required className="rounded-xl input-field text-xs font-bold appearance-none"/>
                                <CalendarIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-50 dark:border-white/5 flex justify-end gap-3">
                        <Button type="button" variant="ghost" onClick={() => setIsPaymentModalOpen(false)}>Discard</Button>
                        <Button type="submit" disabled={isSubmitting || !receiptUrl} leftIcon={isSubmitting ? <Spinner /> : <CheckCircleIcon />}>
                            {isSubmitting ? 'Transmitting...' : 'Record Payment'}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Admin: Verification / Detail Modal */}
            <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title="Audit Details" subtitle="TRANSACTION REVIEW" size="lg">
                {selectedRecord && (
                    <div className="space-y-8">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-slate-50 dark:bg-black/20 rounded-2xl border border-slate-100 dark:border-white/5">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Transaction Identity</p>
                                <p className="font-mono text-xs font-bold text-slate-900 dark:text-slate-50 break-all">{selectedRecord.upiTransactionId || 'N/A'}</p>
                            </div>
                            <div className="p-4 bg-slate-50 dark:bg-black/20 rounded-2xl border border-slate-100 dark:border-white/5">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Timestamp</p>
                                <p className="text-xs font-bold text-slate-900 dark:text-slate-50">{selectedRecord.transactionDate ? new Date(selectedRecord.transactionDate).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'N/A'}</p>
                            </div>
                        </div>

                        {selectedRecord.paymentReceiptUrl && (
                            <div className="space-y-2">
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Digital Proof</p>
                                <div className="rounded-[2.5rem] overflow-hidden border border-slate-100 dark:border-white/5 shadow-inner bg-black flex justify-center items-center group relative min-h-[200px]">
                                    <img src={selectedRecord.paymentReceiptUrl} alt="Transaction Receipt" className="w-full h-auto object-contain max-h-[400px]" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <a href={selectedRecord.paymentReceiptUrl} target="_blank" rel="noreferrer" className="bg-white text-slate-900 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">Expand Image</a>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-white/5">
                            <Button variant="ghost" onClick={() => setIsDetailModalOpen(false)}>Close View</Button>
                            {isAdmin && selectedRecord.status === MaintenanceStatus.Submitted && selectedRecord.userId !== user?.id && (
                                <Button onClick={() => handleVerify(selectedRecord.id)} disabled={isSubmitting} leftIcon={<CheckCircleIcon />}>
                                    {isSubmitting ? 'Authorizing...' : 'Authorize Receipt'}
                                </Button>
                            )}
                            {isAdmin && selectedRecord.status === MaintenanceStatus.Submitted && selectedRecord.userId === user?.id && (
                                <div className="p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100">
                                    <p className="text-[10px] font-black uppercase text-amber-600">Awaiting Peer-Admin Review</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Modal>

            <AuditLogModal isOpen={isAuditOpen} onClose={() => setIsAuditOpen(false)} entityType="MaintenanceRecord" title="Ledger Audit" />
            <FeedbackModal isOpen={feedback.isOpen} onClose={() => setFeedback({ ...feedback, isOpen: false })} title={feedback.title} message={feedback.message} type={feedback.type} />
        </div>
    );
};

export default Maintenance;
