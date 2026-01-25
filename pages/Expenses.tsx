
import React, { useState, useEffect, useMemo } from 'react';
import { createExpense, getExpenses, approveExpense, rejectExpense, getCachedData } from '../services/api';
import type { Expense } from '../types';
import { ExpenseCategory, ExpenseStatus, UserRole } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import Modal from '../components/ui/Modal';
import FeedbackModal from '../components/ui/FeedbackModal';
import AuditLogModal from '../components/AuditLogModal';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import { useAuth } from '../hooks/useAuth';
import { 
    PlusIcon, 
    BanknotesIcon, 
    FunnelIcon, 
    HistoryIcon, 
    ChevronDownIcon, 
    ArrowDownTrayIcon, 
    CheckCircleIcon, 
    ClockIcon, 
    XIcon, 
    CalendarIcon,
    AlertTriangleIcon,
    ArrowRightIcon,
    IdentificationIcon
} from '../components/icons';

const StatusBadge: React.FC<{ status: ExpenseStatus }> = ({ status }) => {
    const styles: Record<ExpenseStatus, string> = {
        [ExpenseStatus.Pending]: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
        [ExpenseStatus.Approved]: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
        [ExpenseStatus.Rejected]: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400',
    };
    return <span className={`px-2.5 py-1 text-[8px] font-black uppercase tracking-widest rounded-lg shadow-sm ${styles[status]}`}>{status}</span>;
}

const Expenses: React.FC = () => {
    const { user } = useAuth();
    const cacheKey = `expenses:${user?.communityId}`;
    
    const [expenses, setExpenses] = useState<Expense[]>(() => getCachedData(cacheKey) || []);
    const [loading, setLoading] = useState(!getCachedData(cacheKey));
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
    
    // Modals
    const [isAuditOpen, setIsAuditOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
    const [confirmAction, setConfirmAction] = useState<{ isOpen: boolean; type: 'approve' | 'reject'; id: string | null }>({ isOpen: false, type: 'approve', id: null });

    // Create Form State
    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState<ExpenseCategory>(ExpenseCategory.Maintenance);
    const [description, setDescription] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [receiptUrl, setReceiptUrl] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');

    const [feedback, setFeedback] = useState<{ isOpen: boolean; type: 'success' | 'error' | 'info'; title: string; message: string }>({
        isOpen: false, type: 'success', title: '', message: ''
    });

    const isAdmin = user?.role === UserRole.Admin || user?.role === UserRole.SuperAdmin || user?.role === UserRole.HelpdeskAdmin;

    const fetchExpensesData = async () => {
        if (!user?.communityId) return;
        try { 
            const data = await getExpenses(user.communityId); 
            setExpenses(data); 
        } catch (error) { 
            console.error(error); 
        } finally { 
            setLoading(false); 
        }
    };

    useEffect(() => { fetchExpensesData(); }, [user]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 1024 * 1024) {
                setFeedback({ isOpen: true, type: 'error', title: 'File Too Large', message: 'Digital receipts must be under 1MB.' });
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => setReceiptUrl(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleCreateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setIsSubmitting(true);
        try {
            await createExpense({ title, amount: parseFloat(amount), category, description, date, receiptUrl }, user);
            setFeedback({ isOpen: true, type: 'success', title: 'Voucher Logged', message: 'Expense request has been submitted for administrative review.' });
            setIsCreateModalOpen(false);
            resetForm();
            await fetchExpensesData();
        } catch (err: any) {
            setFeedback({ isOpen: true, type: 'error', title: 'Submission Error', message: err.message });
        } finally { setIsSubmitting(false); }
    };

    const handleApprove = async () => {
        if (!selectedExpense || !user) return;
        setIsSubmitting(true);
        try {
            await approveExpense(selectedExpense.id, user.id);
            setFeedback({ isOpen: true, type: 'success', title: 'Expense Authorized', message: 'Payment voucher has been approved and recorded in the ledger.' });
            setIsDetailModalOpen(false);
            setConfirmAction({ isOpen: false, type: 'approve', id: null });
            await fetchExpensesData();
        } catch (err: any) {
            setFeedback({ isOpen: true, type: 'error', title: 'Approval Failed', message: err.message });
        } finally { setIsSubmitting(false); }
    };

    const handleReject = async () => {
        if (!selectedExpense || !user || !rejectionReason) return;
        setIsSubmitting(true);
        try {
            await rejectExpense(selectedExpense.id, user.id, rejectionReason);
            setFeedback({ isOpen: true, type: 'info', title: 'Voucher Rejected', message: 'Expense request has been declined.' });
            setIsDetailModalOpen(false);
            setConfirmAction({ isOpen: false, type: 'reject', id: null });
            await fetchExpensesData();
        } catch (err: any) {
            setFeedback({ isOpen: true, type: 'error', title: 'Action Failed', message: err.message });
        } finally { setIsSubmitting(false); }
    };

    const resetForm = () => {
        setTitle(''); setAmount(''); setCategory(ExpenseCategory.Maintenance); setDescription(''); 
        setDate(new Date().toISOString().split('T')[0]); setReceiptUrl('');
    };

    const filteredExpenses = useMemo(() => {
        return expenses.filter(e => {
            if (user?.role === UserRole.Resident && e.status !== ExpenseStatus.Approved) return false;
            return e.date.startsWith(selectedMonth);
        });
    }, [expenses, selectedMonth, user]);

    const approvedTotal = filteredExpenses.filter(e => e.status === ExpenseStatus.Approved).reduce((sum, e) => sum + e.amount, 0);

    return (
        <div className="space-y-6 pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 min-h-[5rem]">
                <div className="flex items-start gap-3">
                    <div className="w-1 h-10 bg-brand-500 rounded-full mt-1" />
                    <div>
                        <span className="text-[9px] font-mono font-black uppercase tracking-[0.3em] text-brand-600 dark:text-brand-400 mb-0.5 block">Finance & Ledger</span>
                        <h1 className="text-2xl sm:text-3xl font-brand font-extrabold text-brand-600 dark:text-brand-400 tracking-tight leading-tight">Expenses</h1>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => setIsAuditOpen(true)} variant="outlined" size="md" leftIcon={<HistoryIcon />}>History</Button>
                    {isAdmin && <Button onClick={() => setIsCreateModalOpen(true)} size="md" leftIcon={<PlusIcon />}>Log Expense</Button>}
                </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 bg-white dark:bg-zinc-900/40 p-4 rounded-[2rem] border border-slate-50 dark:border-white/5 shadow-sm">
                <div className="flex-1 w-full">
                    <label className="block text-[9px] font-black uppercase text-slate-400 mb-1.5 ml-1">Period Selection</label>
                    <div className="relative">
                        <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="block w-full px-4 py-2.5 rounded-xl input-field text-sm font-bold appearance-none bg-white dark:bg-zinc-900" />
                        <CalendarIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                </div>
                <Card className="flex-1 w-full p-4 bg-brand-600 dark:bg-[#0f1115] text-white border-none shadow-lg rounded-2xl">
                    <p className="text-[8px] font-black uppercase tracking-widest opacity-70 mb-1">Total Approved Outflow</p>
                    <p className="text-2xl font-brand font-extrabold">₹{approvedTotal.toLocaleString()}</p>
                </Card>
            </div>

            <div className="space-y-3">
                {loading && expenses.length === 0 ? (
                    Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-slate-100 dark:bg-white/5 rounded-3xl animate-pulse" />)
                ) : filteredExpenses.length === 0 ? (
                    <div className="py-24 text-center border-2 border-dashed border-slate-100 dark:border-white/5 rounded-[3rem] opacity-30">
                        <BanknotesIcon className="w-16 h-16 mx-auto mb-4" />
                        <p className="font-brand font-extrabold text-xl">Voucher Log Empty</p>
                        <p className="text-[10px] font-black uppercase tracking-widest mt-1">No recorded expenses for this period</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredExpenses.map(exp => (
                            <Card 
                                key={exp.id} 
                                onClick={() => { setSelectedExpense(exp); setIsDetailModalOpen(true); }}
                                className="p-5 bg-white dark:bg-zinc-900/40 border border-slate-50 dark:border-white/5 flex flex-col justify-between shadow-sm cursor-pointer hover:scale-[1.01] transition-transform rounded-[2rem] group"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex-1 min-w-0 pr-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <StatusBadge status={exp.status} />
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 dark:bg-white/5 px-2 py-0.5 rounded-md">{exp.category}</span>
                                        </div>
                                        <h4 className="text-lg font-brand font-extrabold text-slate-900 dark:text-slate-50 truncate leading-tight">{exp.title}</h4>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mt-1">{new Date(exp.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-[8px] font-black uppercase text-slate-400 tracking-tighter mb-0.5">Disbursement</p>
                                        <p className="text-2xl font-brand font-extrabold text-brand-600">₹{exp.amount.toLocaleString()}</p>
                                    </div>
                                </div>
                                <div className="mt-5 pt-4 border-t border-slate-50 dark:border-white/5 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-lg bg-brand-500/10 flex items-center justify-center font-black text-brand-600 text-[8px]">{exp.submittedByName?.[0] || 'U'}</div>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Request: <span className="text-slate-800 dark:text-zinc-300 ml-1">{exp.submittedByName}</span></p>
                                    </div>
                                    <ArrowRightIcon className="w-4 h-4 text-slate-300 group-hover:text-brand-600 transition-colors" />
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Create Expense Modal */}
            <Modal isOpen={isCreateModalOpen} onClose={() => { setIsCreateModalOpen(false); resetForm(); }} title="Expense Voucher" subtitle="FINANCIAL DISBURSEMENT" size="lg">
                <form onSubmit={handleCreateSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="sm:col-span-2">
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Voucher Title</label>
                            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Lift AMC - Oct 2023" className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold"/>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Amount (₹)</label>
                            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="0.00" className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold"/>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Category</label>
                            <div className="relative">
                                <select value={category} onChange={e => setCategory(e.target.value as ExpenseCategory)} className="block w-full px-4 py-3 rounded-xl input-field text-xs font-bold appearance-none bg-white dark:bg-zinc-900">
                                    {Object.values(ExpenseCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                                <ChevronDownIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Transaction Date</label>
                            <div className="relative">
                                <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="block w-full px-4 py-3 rounded-xl input-field text-xs font-bold"/>
                                <CalendarIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Digital Receipt (Max 1MB)</label>
                            <div className="relative group">
                                <input type="file" accept="image/*" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                <div className="border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl py-2 px-4 text-center group-hover:border-brand-500 group-hover:bg-brand-50/10 transition-all flex items-center gap-3">
                                    {receiptUrl ? (
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <div className="w-8 h-8 rounded-lg overflow-hidden bg-brand-50 shrink-0"><img src={receiptUrl} className="w-full h-full object-cover" /></div>
                                            <p className="text-[9px] font-black text-brand-600 truncate">Voucher Attached</p>
                                        </div>
                                    ) : (
                                        <>
                                            <ArrowDownTrayIcon className="w-4 h-4 text-slate-300" />
                                            <p className="text-[9px] font-black text-slate-400 uppercase">Attach Bill</p>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Expense Justification</label>
                            <textarea value={description} onChange={e => setDescription(e.target.value)} required rows={3} placeholder="Provide details for the audit trail..." className="block w-full px-4 py-3 rounded-xl input-field text-sm font-medium leading-relaxed"/>
                        </div>
                    </div>
                    <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-white/5">
                        <Button type="button" variant="ghost" onClick={() => setIsCreateModalOpen(false)}>Discard</Button>
                        <Button type="submit" disabled={isSubmitting} leftIcon={isSubmitting ? <Spinner /> : <CheckCircleIcon />}>
                            {isSubmitting ? 'Transmitting...' : 'Log Expense'}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Expense Detail / Admin Modal */}
            <Modal isOpen={isDetailModalOpen} onClose={() => { setIsDetailModalOpen(false); setRejectionReason(''); }} title="Voucher Details" subtitle={`REF: ${selectedExpense?.id.substring(0, 8).toUpperCase()}`} size="lg">
                {selectedExpense && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="p-4 bg-slate-50 dark:bg-black/20 rounded-3xl border border-slate-100 dark:border-white/5">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Authorization Status</p>
                                <StatusBadge status={selectedExpense.status} />
                            </div>
                            <div className="p-4 bg-slate-50 dark:bg-black/20 rounded-3xl border border-slate-100 dark:border-white/5">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Disbursement Amount</p>
                                <p className="text-xl font-brand font-extrabold text-brand-600">₹{selectedExpense.amount.toLocaleString()}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <h4 className="text-xl font-brand font-extrabold text-slate-900 dark:text-slate-50 leading-tight">{selectedExpense.title}</h4>
                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[9px] font-black uppercase text-slate-400 tracking-widest">
                                    <p className="flex items-center gap-1.5"><CalendarIcon className="w-3.5 h-3.5" /> Date: <span className="text-slate-900 dark:text-zinc-200">{new Date(selectedExpense.date).toLocaleDateString()}</span></p>
                                    <p className="flex items-center gap-1.5"><IdentificationIcon className="w-3.5 h-3.5" /> Filed By: <span className="text-slate-900 dark:text-zinc-200">{selectedExpense.submittedByName}</span></p>
                                </div>
                            </div>
                            <div className="p-5 bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 rounded-3xl">
                                <p className="text-sm text-slate-600 dark:text-zinc-300 font-medium leading-relaxed">{selectedExpense.description}</p>
                            </div>
                        </div>

                        {selectedExpense.receiptUrl && (
                            <div className="space-y-2">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Digital Evidence</p>
                                <div className="rounded-[2rem] overflow-hidden border border-slate-100 dark:border-white/5 shadow-inner bg-black flex justify-center">
                                    <img src={selectedExpense.receiptUrl} alt="Receipt" className="max-h-[300px] object-contain" />
                                </div>
                            </div>
                        )}

                        {selectedExpense.status === ExpenseStatus.Pending && isAdmin && selectedExpense.submittedBy !== user?.id && (
                            <div className="pt-6 border-t border-slate-100 dark:border-white/5 space-y-4">
                                <textarea 
                                    value={rejectionReason} 
                                    onChange={e => setRejectionReason(e.target.value)} 
                                    placeholder="Enter reason if rejecting..." 
                                    className="block w-full px-4 py-3 rounded-xl input-field text-sm font-medium"
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <Button 
                                        variant="outlined" 
                                        onClick={() => setConfirmAction({ isOpen: true, type: 'reject', id: selectedExpense.id })}
                                        disabled={!rejectionReason || isSubmitting}
                                        className="text-rose-600 border-rose-100 hover:bg-rose-50"
                                    >
                                        Decline Voucher
                                    </Button>
                                    <Button 
                                        onClick={() => setConfirmAction({ isOpen: true, type: 'approve', id: selectedExpense.id })}
                                        disabled={isSubmitting}
                                        leftIcon={<CheckCircleIcon />}
                                    >
                                        Authorize Payment
                                    </Button>
                                </div>
                            </div>
                        )}
                        
                        {selectedExpense.submittedBy === user?.id && selectedExpense.status === ExpenseStatus.Pending && (
                            <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 flex items-center gap-3">
                                <AlertTriangleIcon className="w-5 h-5 text-amber-600" />
                                <p className="text-[10px] font-black uppercase text-amber-600">Pending Peer-Admin Review</p>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            <ConfirmationModal 
                isOpen={confirmAction.isOpen} 
                onClose={() => setConfirmAction({ isOpen: false, type: 'approve', id: null })} 
                onConfirm={confirmAction.type === 'approve' ? handleApprove : handleReject}
                title={confirmAction.type === 'approve' ? "Authorize Payment" : "Decline Voucher"}
                message={confirmAction.type === 'approve' 
                    ? "Are you sure you want to approve this disbursement? This will immediately reflect in the community treasury records." 
                    : "Declining this voucher will notify the submitter and stop the disbursement process."}
                isDestructive={confirmAction.type === 'reject'}
                isLoading={isSubmitting}
                confirmLabel={confirmAction.type === 'approve' ? "Authorize" : "Decline"}
            />

            <AuditLogModal isOpen={isAuditOpen} onClose={() => setIsAuditOpen(false)} entityType="Expense" title="Ledger Audit Trail" />
            <FeedbackModal isOpen={feedback.isOpen} onClose={() => setFeedback({ ...feedback, isOpen: false })} title={feedback.title} message={feedback.message} type={feedback.type} />
        </div>
    );
};

export default Expenses;
