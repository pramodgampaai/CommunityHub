
import React, { useState, useEffect } from 'react';
import { createExpense, getExpenses, approveExpense, rejectExpense, getMonthlyLedger } from '../services/api';
import type { Expense } from '../types';
import { ExpenseCategory, ExpenseStatus, UserRole } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
// Added missing import for Spinner
import Spinner from '../components/ui/Spinner';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import AuditLogModal from '../components/AuditLogModal';
import { PlusIcon, BanknotesIcon, FunnelIcon, AlertTriangleIcon, HistoryIcon, ChevronDownIcon, ArrowDownTrayIcon } from '../components/icons';
import { useAuth } from '../hooks/useAuth';
import { useScreen } from '../hooks/useScreen';
import { generateLedgerReport } from '../services/pdfGenerator';

const StatusPill: React.FC<{ status: ExpenseStatus }> = ({ status }) => {
    const statusStyles: Record<ExpenseStatus, string> = {
        [ExpenseStatus.Pending]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
        [ExpenseStatus.Approved]: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
        [ExpenseStatus.Rejected]: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    };
    return <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusStyles[status]}`}>{status}</span>;
}

const Expenses: React.FC = () => {
    const { user } = useAuth();
    const { isMobile } = useScreen();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAuditOpen, setIsAuditOpen] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
    const [viewMode, setViewMode] = useState<'monthly' | 'all'>('monthly');
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [viewReceiptUrl, setViewReceiptUrl] = useState<string | null>(null);
    const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [expenseToReject, setExpenseToReject] = useState<Expense | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
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
        try { setLoading(true); const data = await getExpenses(user.communityId); setExpenses(data); } catch (error) { console.error(error); } finally { setLoading(false); }
    };

    useEffect(() => { fetchExpensesData(); }, [user]);

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setIsSubmitting(true);
        try {
            await createExpense({ title, amount: parseFloat(amount), category, description, date, receiptUrl }, user);
            setIsModalOpen(false); setTitle(''); setAmount(''); setCategory(ExpenseCategory.Other); setDescription(''); setReceiptUrl('');
            await fetchExpensesData();
        } catch (error: any) { alert(error.message); } finally { setIsSubmitting(false); }
    };
    
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
            isOpen: true, title: "Approve Expense", message: `Confirm approval for "${expense.title}"?`, confirmLabel: "Approve",
            action: async () => { await approveExpense(expense.id, user.id); await fetchExpensesData(); }
        });
    };

    const handleRejectClick = (expense: Expense) => {
        if (!user || !isAdmin) return;
        setExpenseToReject(expense); setRejectionReason(''); setIsRejectModalOpen(true);
    }
    
    const handleConfirmReject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!expenseToReject || !user) return;
        setIsSubmitting(true);
        try { await rejectExpense(expenseToReject.id, user.id, rejectionReason); setIsRejectModalOpen(false); await fetchExpensesData(); } catch (error: any) { alert(error.message); } finally { setIsSubmitting(false); }
    }

    // Added missing handleConfirmAction function to handle modal confirmations
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

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center animated-card">
                <div>
                    <h2 className="text-2xl font-bold text-[var(--text-light)] dark:text-[var(--text-dark)]">{isResident ? 'Community Expenses' : 'Expenses'}</h2>
                    <p className="text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] text-base mt-1">{isResident ? 'View approved community expenditures.' : 'Manage community expenditures.'}</p>
                </div>
                <div className="flex gap-2">
                    {isAdmin && (
                        <>
                            <Button onClick={() => setIsAuditOpen(true)} variant="outlined" size="sm" leftIcon={<HistoryIcon />}>History</Button>
                            <Button onClick={() => setIsModalOpen(true)} size="sm" leftIcon={<PlusIcon />}>Log Expense</Button>
                        </>
                    )}
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 justify-between items-end md:items-center bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] p-4 rounded-xl border border-[var(--border-light)] dark:border-[var(--border-dark)] animated-card">
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:flex-none w-full sm:w-auto">
                        <label className="block text-xs font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Select Month</label>
                        <div className="flex gap-2">
                            <input type="month" value={selectedMonth} onChange={(e) => { setSelectedMonth(e.target.value); if (isAdmin) setViewMode('monthly'); }} className="block w-full md:w-auto px-3 py-2 text-sm border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] text-[var(--text-light)] dark:text-[var(--text-dark)]"/>
                            <Button size="sm" variant="outlined" onClick={handleDownloadReport} disabled={isGeneratingReport} leftIcon={<ArrowDownTrayIcon />}>Report</Button>
                        </div>
                    </div>
                    {isAdmin && (
                        <div className="flex items-end h-full pt-5 w-full sm:w-auto">
                            <button onClick={() => setViewMode(viewMode === 'monthly' ? 'all' : 'monthly')} className={`text-sm font-medium px-3 py-2 rounded-md transition-colors w-full sm:w-auto ${viewMode === 'all' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary-light)] hover:bg-black/5 dark:hover:bg-white/5'}`}>{viewMode === 'all' ? 'Showing All' : 'View All'}</button>
                        </div>
                    )}
                </div>
                {isAdmin && (
                    <div className="relative w-full md:w-48">
                        <label className="block text-xs font-medium text-[var(--text-secondary-light)] mb-1">Status Filter</label>
                        <div className="relative">
                            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="appearance-none bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] border border-[var(--border-light)] dark:border-[var(--border-dark)] text-sm rounded-lg block w-full pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]">
                                <option value="All">All Status</option>
                                <option value={ExpenseStatus.Pending}>Pending</option>
                                <option value={ExpenseStatus.Approved}>Approved</option>
                                <option value={ExpenseStatus.Rejected}>Rejected</option>
                            </select>
                            <FunnelIcon className="absolute right-2 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4 border-l-4 border-l-green-500">
                    <p className="text-sm text-[var(--text-secondary-light)]">{viewMode === 'monthly' || isResident ? `Approved (${monthDisplay})` : 'Total Approved'}</p>
                    <p className="text-2xl font-bold mt-1">₹{approvedTotal.toLocaleString()}</p>
                </Card>
                {isAdmin && (
                    <Card className="p-4 border-l-4 border-l-yellow-500">
                        <p className="text-sm text-[var(--text-secondary-light)]">Pending Approval</p>
                        <p className="text-2xl font-bold mt-1">₹{pendingTotal.toLocaleString()}</p>
                    </Card>
                )}
            </div>

            <div className="space-y-4">
                {loading ? <Spinner /> : filteredExpenses.map((expense) => (
                    <Card key={expense.id} className="p-4 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => setSelectedExpense(expense)}>
                        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                            <div className="flex-1">
                                <h3 className="font-semibold text-lg">{expense.title}</h3>
                                <p className="text-sm text-[var(--text-secondary-light)]">{expense.category} • {new Date(expense.date).toLocaleDateString()} • By {expense.submittedByName}</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <span className="font-bold text-xl">₹{expense.amount}</span>
                                    <div className="mt-1"><StatusPill status={expense.status} /></div>
                                </div>
                                {isAdmin && expense.status === ExpenseStatus.Pending && expense.submittedBy !== user?.id && (
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="outlined" onClick={(e) => { e.stopPropagation(); handleRejectClick(expense); }} className="text-red-500 border-red-500">Reject</Button>
                                        <Button size="sm" onClick={(e) => { e.stopPropagation(); handleApproveClick(expense); }}>Approve</Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Log New Expense">
                <form className="space-y-4" onSubmit={handleFormSubmit}>
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} required placeholder="Title" className="block w-full px-3 py-2 rounded-lg input-field"/>
                    <div className="grid grid-cols-2 gap-4">
                        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="Amount (₹)" className="block w-full px-3 py-2 rounded-lg input-field"/>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="block w-full px-3 py-2 rounded-lg input-field"/>
                    </div>
                    <select value={category} onChange={e => setCategory(e.target.value as ExpenseCategory)} className="block w-full px-3 py-2 rounded-lg input-field appearance-none bg-white dark:bg-zinc-900">
                        {Object.values(ExpenseCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Description" className="block w-full px-3 py-2 rounded-lg input-field"></textarea>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outlined" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Submitting...' : 'Log Expense'}</Button>
                    </div>
                </form>
            </Modal>
            <ConfirmationModal isOpen={confirmConfig.isOpen} onClose={() => setConfirmConfig({ ...confirmConfig, isOpen: false })} onConfirm={handleConfirmAction} title={confirmConfig.title} message={confirmConfig.message} confirmLabel={confirmConfig.confirmLabel} isLoading={isSubmitting} />
            <AuditLogModal isOpen={isAuditOpen} onClose={() => setIsAuditOpen(false)} entityType="Expense" title="Expense History" />
        </div>
    );
};

export default Expenses;
