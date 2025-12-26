
import React, { useState, useEffect } from 'react';
import { createExpense, getExpenses, approveExpense, rejectExpense, getMonthlyLedger } from '../services/api';
import type { Expense } from '../types';
import { ExpenseCategory, ExpenseStatus, UserRole } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import AuditLogModal from '../components/AuditLogModal';
import { PlusIcon, BanknotesIcon, FunnelIcon, AlertTriangleIcon, HistoryIcon, ChevronDownIcon, ArrowDownTrayIcon, CheckCircleIcon, XIcon, ArrowRightIcon } from '../components/icons';
import { useAuth } from '../hooks/useAuth';
import { useScreen } from '../hooks/useScreen';
import { generateLedgerReport } from '../services/pdfGenerator';

const StatusPill: React.FC<{ status: ExpenseStatus }> = ({ status }) => {
    const statusStyles: Record<ExpenseStatus, string> = {
        [ExpenseStatus.Pending]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
        [ExpenseStatus.Approved]: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
        [ExpenseStatus.Rejected]: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    };
    return <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${statusStyles[status]}`}>{status}</span>;
}

const Expenses: React.FC = () => {
    const { user } = useAuth();
    const { isMobile } = useScreen();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAuditOpen, setIsAuditOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
    const [viewMode, setViewMode] = useState<'monthly' | 'all'>('monthly');
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [expenseToReject, setExpenseToReject] = useState<Expense | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    
    // Create Form States
    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState<string>('');
    const [category, setCategory] = useState<ExpenseCategory>(ExpenseCategory.Other);
    const [description, setDescription] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [receiptUrl, setReceiptUrl] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [filterStatus, setFilterStatus] = useState<ExpenseStatus | 'All'>('All');
    const [confirmConfig, setConfirmConfig] = useState<{ isOpen: boolean; title: string; message: string; action: () => Promise<void>; isDestructive?: boolean; confirmLabel?: string; }>({ isOpen: false, title: '', message: '', action: async () => {}, isDestructive: false });

    const isAdmin = user?.role === UserRole.Admin || user?.role === UserRole.SuperAdmin || user?.role === UserRole.HelpdeskAdmin;
    const isResident = user?.role === UserRole.Resident;

    const fetchExpensesData = async () => {
        if (!user?.communityId) return;
        try { 
            setLoading(true); 
            const data = await getExpenses(user.communityId); 
            setExpenses(data); 
            
            // Re-sync selected expense to get latest status/proof if modal is already open
            if (selectedExpense) {
                const refreshed = data.find(e => e.id === selectedExpense.id);
                if (refreshed) setSelectedExpense(refreshed);
            }
        } catch (error) { 
            console.error("Ledger fetch failure:", error); 
        } finally { 
            setLoading(false); 
        }
    };

    useEffect(() => { fetchExpensesData(); }, [user]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Validate image size (2MB limit for Base64 storage in TEXT column)
            if (file.size > 2 * 1024 * 1024) {
                alert("Attachment too large. Please upload an image under 2MB for verification.");
                e.target.value = ''; // Reset input
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                if (result.startsWith('data:image/')) {
                    setReceiptUrl(result);
                } else {
                    alert("Invalid file type. Please upload a valid image (PNG/JPG).");
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        
        if (!receiptUrl) {
            alert("Documentation proof is mandatory for auditing outflow.");
            return;
        }

        setIsSubmitting(true);
        try {
            await createExpense({ title, amount: parseFloat(amount), category, description, date, receiptUrl }, user);
            setIsModalOpen(false); 
            resetForm();
            await fetchExpensesData();
        } catch (error: any) { 
            console.error("Expense logging error:", error);
            alert("Critical Error: Ensure 'receipt_url' column exists in your Supabase 'expenses' table.");
        } finally { 
            setIsSubmitting(false); 
        }
    };

    const resetForm = () => {
        setTitle(''); setAmount(''); setCategory(ExpenseCategory.Other); setDescription(''); setReceiptUrl(''); setDate(new Date().toISOString().split('T')[0]);
    }
    
    const handleDownloadReport = async () => {
        if (!user?.communityId) return;
        setIsGeneratingReport(true);
        try {
            const [yearStr, monthStr] = selectedMonth.split('-');
            const ledgerData = await getMonthlyLedger(user.communityId, parseInt(monthStr), parseInt(yearStr));
            generateLedgerReport(ledgerData, monthStr, parseInt(yearStr), user.communityName || "Community");
        } catch (error: any) { alert(error.message); } finally { setIsGeneratingReport(false); }
    };

    const handleApproveClick = (expense: Expense) => {
        if (!user || !isAdmin) return;
        setConfirmConfig({
            isOpen: true, title: "Approve Expense", message: `Confirm approval for "${expense.title}"? This will officially deduct funds from the community ledger.`, confirmLabel: "Approve",
            action: async () => { 
                await approveExpense(expense.id, user.id); 
                await fetchExpensesData(); 
                setIsDetailModalOpen(false);
            }
        });
    };

    const handleRejectClick = (expense: Expense) => {
        if (!user || !isAdmin) return;
        setExpenseToReject(expense); 
        setRejectionReason(''); 
        setIsRejectModalOpen(true);
    }
    
    const handleConfirmReject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!expenseToReject || !user) return;
        setIsSubmitting(true);
        try { 
            await rejectExpense(expenseToReject.id, user.id, rejectionReason); 
            setIsRejectModalOpen(false); 
            setIsDetailModalOpen(false);
            await fetchExpensesData(); 
        } catch (error: any) { alert(error.message); } finally { setIsSubmitting(false); }
    }

    const handleConfirmAction = async () => {
        setIsSubmitting(true);
        try {
            await confirmConfig.action();
            setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        } catch (error: any) {
            alert(error.message || "Action failed");
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredExpenses = expenses.filter(e => {
        if (isResident && e.status !== ExpenseStatus.Approved) return false;
        if (!isResident && filterStatus !== 'All' && e.status !== filterStatus) return false;
        if ((isResident || viewMode === 'monthly') && !e.date.startsWith(selectedMonth)) return false;
        return true;
    });

    const approvedTotal = filteredExpenses.filter(e => e.status === ExpenseStatus.Approved).reduce((sum, e) => sum + e.amount, 0);
    const pendingTotal = expenses.filter(e => e.status === ExpenseStatus.Pending).reduce((sum, e) => sum + e.amount, 0);
    const monthDisplay = new Date(selectedMonth + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    const openDetails = (expense: Expense) => {
        setSelectedExpense(expense);
        setIsDetailModalOpen(true);
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div className="flex items-start gap-3">
                    <div className="w-1 h-10 bg-brand-500 rounded-full mt-1" />
                    <div>
                        <span className="text-[9px] font-mono font-black uppercase tracking-[0.3em] text-brand-600 dark:text-brand-400 mb-0.5 block">Finance & Ledger</span>
                        <h2 className="text-2xl sm:text-3xl font-brand font-extrabold text-brand-600 tracking-tight">{isResident ? 'Community Expenses' : 'Expenses'}</h2>
                    </div>
                </div>
                <div className="flex gap-2">
                    {isAdmin && (
                        <>
                            <Button onClick={() => setIsAuditOpen(true)} variant="outlined" size="md" leftIcon={<HistoryIcon />}>Audit History</Button>
                            <Button onClick={() => { resetForm(); setIsModalOpen(true); }} size="md" leftIcon={<PlusIcon />}>Log Expense</Button>
                        </>
                    )}
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 justify-between items-end md:items-center bg-white dark:bg-zinc-900/40 p-4 rounded-2xl border border-slate-50 dark:border-white/5 shadow-sm">
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:flex-none w-full sm:w-auto">
                        <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Period Selection</label>
                        <div className="flex gap-2">
                            <input type="month" value={selectedMonth} onChange={(e) => { setSelectedMonth(e.target.value); if (isAdmin) setViewMode('monthly'); }} className="block w-full md:w-auto px-4 py-2 text-sm rounded-xl input-field font-bold"/>
                            <Button size="sm" variant="outlined" onClick={handleDownloadReport} disabled={isGeneratingReport} leftIcon={<ArrowDownTrayIcon />}>Download Ledger</Button>
                        </div>
                    </div>
                    {isAdmin && (
                        <div className="flex items-end h-full pt-5 w-full sm:w-auto">
                            <button onClick={() => setViewMode(viewMode === 'monthly' ? 'all' : 'monthly')} className={`text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all ${viewMode === 'all' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-white/5'}`}>{viewMode === 'all' ? 'Showing Entire History' : 'View Current Month'}</button>
                        </div>
                    )}
                </div>
                {isAdmin && (
                    <div className="relative w-full md:w-48">
                        <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Status Filter</label>
                        <div className="relative">
                            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="appearance-none block w-full px-4 py-2.5 rounded-xl input-field text-xs font-bold bg-white dark:bg-zinc-900">
                                <option value="All">All Transactions</option>
                                <option value={ExpenseStatus.Pending}>Pending Approval</option>
                                <option value={ExpenseStatus.Approved}>Authorized</option>
                                <option value={ExpenseStatus.Rejected}>Declined</option>
                            </select>
                            <FunnelIcon className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-5 border-none bg-white dark:bg-zinc-900/40 border border-slate-50 dark:border-white/5 shadow-sm">
                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1">{viewMode === 'monthly' || isResident ? `Approved Outflow (${monthDisplay})` : 'Lifetime Approved Outflow'}</p>
                    <p className="text-3xl font-brand font-extrabold text-slate-900 dark:text-slate-50">₹{approvedTotal.toLocaleString()}</p>
                </Card>
                {isAdmin && (
                    <Card className="p-5 border-none bg-white dark:bg-zinc-900/40 border border-slate-50 dark:border-white/5 shadow-sm">
                        <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-1">Queue for Authorization</p>
                        <p className="text-3xl font-brand font-extrabold text-slate-900 dark:text-slate-50">₹{pendingTotal.toLocaleString()}</p>
                    </Card>
                )}
            </div>

            <div className="space-y-4">
                {loading ? (
                    Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-slate-100 dark:bg-white/5 rounded-2xl animate-pulse" />)
                ) : filteredExpenses.length === 0 ? (
                    <div className="p-16 text-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-white/5 rounded-3xl">
                        <BanknotesIcon className="w-10 h-10 mx-auto mb-3 opacity-20" />
                        <p className="font-bold uppercase tracking-widest text-[9px]">Ledger is clear</p>
                    </div>
                ) : (
                    filteredExpenses.map((expense) => (
                        <Card key={expense.id} className="p-5 cursor-pointer hover:scale-[1.002] transition-all bg-white dark:bg-zinc-900/40 border border-slate-50 dark:border-white/5 group shadow-sm" onClick={() => openDetails(expense)}>
                            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-brand font-extrabold text-xl text-slate-900 dark:text-slate-50 group-hover:text-brand-600 transition-colors">{expense.title}</h3>
                                        {expense.receiptUrl && (
                                            <span className="p-1 bg-brand-50 dark:bg-brand-500/10 text-brand-600 rounded" title="Receipt Attached">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 mt-1.5">
                                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 dark:bg-white/5 px-2 py-0.5 rounded">{expense.category}</span>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{new Date(expense.date).toLocaleDateString()} • Logged by {expense.submittedByName}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6 justify-between md:justify-end border-t md:border-t-0 pt-4 md:pt-0">
                                    <div className="text-right">
                                        <p className="text-2xl font-brand font-extrabold text-slate-900 dark:text-slate-50">₹{expense.amount.toLocaleString()}</p>
                                        <div className="mt-1"><StatusPill status={expense.status} /></div>
                                    </div>
                                    <div className="hidden md:block">
                                        <ArrowRightIcon className="w-5 h-5 text-slate-300 group-hover:text-brand-600 group-hover:translate-x-1 transition-all" />
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))
                )}
            </div>

            {/* LOG EXPENSE MODAL */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Log New Expenditure" subtitle="FUNDS OUTFLOW" size="md">
                <form className="space-y-4" onSubmit={handleFormSubmit}>
                    <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Expense Purpose</label>
                        <input type="text" value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Generator Diesel Refill" className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold"/>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Sum Total (₹)</label>
                            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="0.00" className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold"/>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Transaction Date</label>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold"/>
                        </div>
                    </div>
                    <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Module Category</label>
                        <div className="relative">
                            <select value={category} onChange={e => setCategory(e.target.value as ExpenseCategory)} className="block w-full px-4 py-3 rounded-xl input-field text-xs font-bold appearance-none bg-white dark:bg-zinc-900">
                                {Object.values(ExpenseCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                            <ChevronDownIcon className="absolute right-3 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Expense Documentation (Proof)</label>
                        <div className="space-y-3">
                            {receiptUrl && (
                                <div className="w-full h-32 rounded-xl overflow-hidden border-2 border-brand-500/20 bg-brand-50/10">
                                    <img src={receiptUrl} alt="Receipt Preview" className="w-full h-full object-contain" />
                                </div>
                            )}
                            <input type="file" accept="image/*" onChange={handleFileUpload} required className="block w-full text-[11px] text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:tracking-widest file:bg-brand-50 file:text-brand-600 hover:file:bg-brand-100 cursor-pointer"/>
                            <p className="text-[8px] text-slate-400 uppercase font-black tracking-widest ml-1">Format: JPG/PNG • Max Size: 2MB</p>
                        </div>
                    </div>
                    <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Audit Explanation</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Detailed breakdown for management approval..." className="block w-full px-4 py-3 rounded-xl input-field text-sm font-medium leading-relaxed"></textarea>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outlined" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting} size="lg" leftIcon={<CheckCircleIcon />}>{isSubmitting ? 'Transmitting...' : 'Submit for Review'}</Button>
                    </div>
                </form>
            </Modal>
            
            {/* DETAIL MODAL (Approval Center) */}
            <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title="Expense Verification" subtitle="AUDIT REVIEW" size="lg">
                {selectedExpense && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-2xl font-brand font-extrabold text-slate-900 dark:text-slate-50">{selectedExpense.title}</h3>
                                <div className="mt-2 flex gap-2">
                                    <StatusPill status={selectedExpense.status} />
                                    <span className="px-2 py-1 bg-slate-100 dark:bg-white/5 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-full">{selectedExpense.category}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Sum</p>
                                <p className="text-3xl font-brand font-extrabold text-brand-600">₹{selectedExpense.amount.toLocaleString()}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="p-4 bg-slate-50 dark:bg-zinc-900/40 rounded-2xl border border-slate-100 dark:border-white/5">
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Origin Details</p>
                                <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">Logged by {selectedExpense.submittedByName}</p>
                                <p className="text-[11px] font-medium text-slate-500 mt-0.5">{new Date(selectedExpense.date).toLocaleDateString(undefined, { dateStyle: 'full' })}</p>
                            </div>
                            {selectedExpense.approvedByName && (
                                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/20">
                                    <p className="text-[9px] font-black text-emerald-600 uppercase mb-1">Authorization</p>
                                    <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">Verified by {selectedExpense.approvedByName}</p>
                                    <p className="text-[11px] font-medium text-emerald-600/70 mt-0.5">Funds Reconciled</p>
                                </div>
                            )}
                        </div>

                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Documentation Proof</p>
                            {selectedExpense.receiptUrl ? (
                                <div className="rounded-3xl overflow-hidden border-2 border-slate-100 dark:border-white/5 bg-black/5 group relative">
                                    <img src={selectedExpense.receiptUrl} alt="Expense Proof" className="w-full h-auto max-h-[500px] object-contain mx-auto" />
                                    <a href={selectedExpense.receiptUrl} target="_blank" rel="noreferrer" className="absolute top-4 right-4 p-2 bg-white/90 dark:bg-zinc-900/90 rounded-xl text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                                        <ArrowDownTrayIcon className="w-5 h-5" />
                                    </a>
                                </div>
                            ) : (
                                <div className="p-12 text-center text-slate-400 bg-slate-50 dark:bg-white/5 rounded-3xl border-2 border-dashed border-slate-200 dark:border-white/10">
                                    <AlertTriangleIcon className="w-8 h-8 mx-auto mb-2 opacity-30 text-amber-500" />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Image data missing in registry</p>
                                    <p className="text-[8px] mt-2 text-slate-400 uppercase italic">Developer Note: Run SQL: 'ALTER TABLE expenses ADD COLUMN receipt_url TEXT;'</p>
                                </div>
                            )}
                        </div>

                        <div className="bg-slate-50 dark:bg-white/5 p-5 rounded-2xl border border-slate-100 dark:border-white/5">
                            <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Internal Explanation</p>
                            <p className="text-sm font-medium text-slate-600 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">{selectedExpense.description || 'No additional details provided.'}</p>
                        </div>

                        <div className="pt-2 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <Button variant="outlined" onClick={() => setIsDetailModalOpen(false)}>Close Preview</Button>
                            
                            {isAdmin && selectedExpense.status === ExpenseStatus.Pending && selectedExpense.submittedBy !== user?.id && (
                                <div className="flex gap-3 w-full sm:w-auto">
                                    <Button variant="outlined" onClick={() => handleRejectClick(selectedExpense)} className="flex-1 sm:flex-none text-rose-600 border-rose-200 hover:bg-rose-50">Reject</Button>
                                    <Button onClick={() => handleApproveClick(selectedExpense)} className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700">Approve</Button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
            
            <Modal isOpen={isRejectModalOpen} onClose={() => setIsRejectModalOpen(false)} title="Deline Verification" subtitle="SECURITY ACTION" size="sm">
                <form className="space-y-4" onSubmit={handleConfirmReject}>
                    <div className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 rounded-2xl flex items-start gap-3">
                        <AlertTriangleIcon className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
                        <p className="text-xs font-bold text-rose-800 dark:text-rose-200">Rejection requires a valid explanation to the submitter.</p>
                    </div>
                    <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Reason for Rejection</label>
                        <textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} required rows={3} placeholder="Insufficient proof, incorrect amount, etc..." className="block w-full px-4 py-3 rounded-xl input-field text-sm font-medium"></textarea>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button type="button" variant="ghost" onClick={() => setIsRejectModalOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting} className="bg-rose-600 hover:bg-rose-700 text-white border-none">Decline Fund Request</Button>
                    </div>
                </form>
            </Modal>

            <ConfirmationModal isOpen={confirmConfig.isOpen} onClose={() => setConfirmConfig({ ...confirmConfig, isOpen: false })} onConfirm={handleConfirmAction} title={confirmConfig.title} message={confirmConfig.message} confirmLabel={confirmConfig.confirmLabel} isLoading={isSubmitting} />
            <AuditLogModal isOpen={isAuditOpen} onClose={() => setIsAuditOpen(false)} entityType="Expense" title="Expense Audit Trail" />
        </div>
    );
};

export default Expenses;
