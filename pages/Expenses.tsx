
import React, { useState, useEffect } from 'react';
import { createExpense, getExpenses, approveExpense, rejectExpense, getMonthlyLedger } from '../services/api';
import type { Expense } from '../types';
import { ExpenseCategory, ExpenseStatus, UserRole } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
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
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { user } = useAuth();
    const { isMobile } = useScreen();
    const [isAuditOpen, setIsAuditOpen] = useState(false);

    // Month Selection State
    // Default to current month YYYY-MM
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
    // For Admins, allow toggling "View All Time" vs "Monthly"
    const [viewMode, setViewMode] = useState<'monthly' | 'all'>('monthly');

    // Report Generation State
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);

    // Receipt Modal State (Quick View)
    const [viewReceiptUrl, setViewReceiptUrl] = useState<string | null>(null);
    
    // Details Modal State
    const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

    // Reject Modal State
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [expenseToReject, setExpenseToReject] = useState<Expense | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');

    // Form State
    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState<string>('');
    const [category, setCategory] = useState<ExpenseCategory>(ExpenseCategory.Other);
    const [description, setDescription] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [receiptUrl, setReceiptUrl] = useState('');
    
    // Loading States
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Filter State (Admin Only)
    const [filterStatus, setFilterStatus] = useState<ExpenseStatus | 'All'>('All');

    // Generic Confirmation State
    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        action: () => Promise<void>;
        isDestructive?: boolean;
        confirmLabel?: string;
    }>({
        isOpen: false,
        title: '',
        message: '',
        action: async () => {},
        isDestructive: false
    });

    // Permission Helpers
    const isAdmin = user?.role === UserRole.Admin || user?.role === UserRole.SuperAdmin || user?.role === UserRole.HelpdeskAdmin;
    const isResident = user?.role === UserRole.Resident;

    const fetchExpensesData = async () => {
        if (!user?.communityId) return;
        try {
            setLoading(true);
            const data = await getExpenses(user.communityId);
            setExpenses(data);
        } catch (error) {
            console.error("Failed to fetch expenses", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchExpensesData();
    }, [user]);

    const parseDescription = (desc: string | undefined) => {
        if (!desc) return { text: 'No description provided.', rejectionReason: null };
        const parts = desc.split('[REJECTION REASON]:');
        return {
            text: parts[0].trim() || (parts.length > 1 ? '' : 'No description provided.'),
            rejectionReason: parts.length > 1 ? parts[1].trim() : null
        };
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setIsSubmitting(true);
        try {
            await createExpense({
                title,
                amount: parseFloat(amount),
                category,
                description,
                date,
                receiptUrl
            }, user);
            
            setIsModalOpen(false);
            // Reset form
            setTitle('');
            setAmount('');
            setCategory(ExpenseCategory.Other);
            setDescription('');
            setReceiptUrl('');
            
            alert("Expense submitted for approval.");
            await fetchExpensesData();
        } catch (error: any) {
            console.error("Failed to create expense:", error);
            alert("Failed to create expense. " + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleDownloadReport = async () => {
        if (!user?.communityId) return;
        setIsGeneratingReport(true);
        try {
            const [yearStr, monthStr] = selectedMonth.split('-');
            const year = parseInt(yearStr);
            const month = parseInt(monthStr);

            const ledgerData = await getMonthlyLedger(user.communityId, month, year);
            const communityName = user.communityName || "Community";
            
            generateLedgerReport(ledgerData, monthStr, year, communityName);

        } catch (error: any) {
            console.error("Failed to generate report", error);
            alert("Failed to generate report: " + (error.message || "Unknown error"));
        } finally {
            setIsGeneratingReport(false);
        }
    };

    const handleApproveClick = (expense: Expense) => {
        if (!user || !isAdmin) return;
        if (expense.submittedBy === user.id) {
            alert("Action Restricted: You cannot approve your own expense. It must be verified by another admin.");
            return;
        }

        setConfirmConfig({
            isOpen: true,
            title: "Approve Expense",
            message: `Are you sure you want to approve "${expense.title}" for ₹${expense.amount}? This amount will be deducted from the community net balance.`,
            confirmLabel: "Approve",
            isDestructive: false,
            action: async () => {
                 await approveExpense(expense.id, user.id);
                 await new Promise(resolve => setTimeout(resolve, 500));
                 await fetchExpensesData();
            }
        });
    };

    const handleConfirmAction = async () => {
        setIsSubmitting(true);
        try {
            await confirmConfig.action();
            setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        } catch (error: any) {
            console.error("Action error:", error);
            alert("Failed to perform action: " + (error.message || "Unknown error"));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRejectClick = (expense: Expense) => {
        if (!user || !isAdmin) return;
        if (expense.submittedBy === user.id) {
             alert("Action Restricted: You cannot reject your own expense.");
             return;
        }
        setExpenseToReject(expense);
        setRejectionReason('');
        setIsRejectModalOpen(true);
    }
    
    const handleConfirmReject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!expenseToReject || !user) return;
        
        if (!rejectionReason.trim()) {
            alert("Please provide a reason for rejection.");
            return;
        }

        setIsSubmitting(true);
        try {
            await rejectExpense(expenseToReject.id, user.id, rejectionReason);
            setIsRejectModalOpen(false);
            setExpenseToReject(null);
            setRejectionReason('');
            await fetchExpensesData();
        } catch (error: any) {
             console.error("Reject error:", error);
             alert("Failed to reject expense: " + (error.message || "Unknown error"));
        } finally {
            setIsSubmitting(false);
        }
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 1024 * 1024) {
                alert("File too large. Max 1MB.");
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setReceiptUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    }
    
    // --- Filtering Logic ---
    const filteredExpenses = expenses.filter(e => {
        // 1. Role-based Restriction
        if (isResident) {
            // Residents ONLY see Approved expenses
            if (e.status !== ExpenseStatus.Approved) return false;
        } else {
            // Admin Filter
            if (filterStatus !== 'All' && e.status !== filterStatus) return false;
        }

        // 2. Date Filtering (Shared logic)
        // Residents ALWAYS use monthly view. Admins use it if viewMode is 'monthly'.
        if (isResident || viewMode === 'monthly') {
            // Check if expense date matches selectedMonth (YYYY-MM)
            if (!e.date.startsWith(selectedMonth)) return false;
        }

        return true;
    });

    // Calculate totals based on filtered view
    const approvedTotal = filteredExpenses
        .filter(e => e.status === ExpenseStatus.Approved)
        .reduce((sum, e) => sum + e.amount, 0);
        
    const pendingTotal = expenses // Pending always calculates from global (or active month depending on desired UX, sticking to global pending usually useful for admins)
        .filter(e => e.status === ExpenseStatus.Pending)
        .reduce((sum, e) => sum + e.amount, 0);

    const detailViewData = selectedExpense ? parseDescription(selectedExpense.description) : null;

    // Format selected month for display
    const monthDisplay = new Date(selectedMonth + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center animated-card">
                <div>
                    <h2 className="text-2xl font-bold text-[var(--text-light)] dark:text-[var(--text-dark)]">
                        {isResident ? 'Community Expenses' : 'Expenses'}
                    </h2>
                    <p className="text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] text-base mt-1">
                        {isResident ? 'View approved community expenditures.' : 'Manage community expenditures.'}
                    </p>
                </div>
                <div className="flex gap-2">
                    {isAdmin && (
                        <>
                            <Button 
                                onClick={() => setIsAuditOpen(true)} 
                                variant="outlined" 
                                size="sm"
                                leftIcon={<HistoryIcon className="w-4 h-4" />}
                                className="border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                            >
                                History
                            </Button>
                            <Button onClick={() => setIsModalOpen(true)} leftIcon={<PlusIcon className="w-5 h-5"/>} aria-label="Log New Expense" variant="fab">
                                <span className="hidden sm:inline">Log Expense</span>
                                <span className="sm:hidden">Log</span>
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-end md:items-center bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] p-4 rounded-xl border border-[var(--border-light)] dark:border-[var(--border-dark)] animated-card">
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                    {/* Month Picker */}
                    <div className="relative flex-1 md:flex-none w-full sm:w-auto">
                        <label className="block text-xs font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Select Month</label>
                        <div className="flex gap-2">
                            <input 
                                type="month" 
                                value={selectedMonth} 
                                onChange={(e) => {
                                    setSelectedMonth(e.target.value);
                                    if (isAdmin) setViewMode('monthly'); // Auto-switch to monthly if admin picks a date
                                }}
                                className="block w-full md:w-auto px-3 py-2 text-sm border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] text-[var(--text-light)] dark:text-[var(--text-dark)]"
                            />
                            {/* Download Report Button */}
                            <Button 
                                size="sm" 
                                variant="outlined" 
                                onClick={handleDownloadReport}
                                disabled={isGeneratingReport}
                                title="Download Monthly Ledger Report"
                                className="h-[38px] w-[38px] px-0 flex items-center justify-center border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                            >
                                {isGeneratingReport ? (
                                    <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <ArrowDownTrayIcon className="w-5 h-5" />
                                )}
                            </Button>
                        </div>
                    </div>
                    
                    {/* Admin Toggle View Mode */}
                    {isAdmin && (
                        <div className="flex items-end h-full pt-5 w-full sm:w-auto">
                            <button 
                                onClick={() => setViewMode(viewMode === 'monthly' ? 'all' : 'monthly')}
                                className={`text-sm font-medium px-3 py-2 rounded-md transition-colors w-full sm:w-auto ${viewMode === 'all' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary-light)] hover:bg-black/5 dark:hover:bg-white/5'}`}
                            >
                                {viewMode === 'all' ? 'Showing All History' : 'View All History'}
                            </button>
                        </div>
                    )}
                </div>

                {/* Admin Status Filter */}
                {isAdmin && (
                    <div className="relative w-full md:w-48">
                        <label className="block text-xs font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Status Filter</label>
                        <div className="relative">
                            <select 
                                value={filterStatus} 
                                onChange={(e) => setFilterStatus(e.target.value as any)}
                                className="appearance-none bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] border border-[var(--border-light)] dark:border-[var(--border-dark)] text-sm rounded-lg block w-full pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-[var(--text-light)] dark:text-[var(--text-dark)]"
                            >
                                <option value="All">All Status</option>
                                <option value={ExpenseStatus.Pending}>Pending</option>
                                <option value={ExpenseStatus.Approved}>Approved</option>
                                <option value={ExpenseStatus.Rejected}>Rejected</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                                <FunnelIcon className="w-4 h-4" />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4 border-l-4 border-l-green-500 animated-card">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                                {viewMode === 'monthly' || isResident ? `Approved (${monthDisplay})` : 'Total Approved (All Time)'}
                            </p>
                            <p className="text-2xl font-bold text-[var(--text-light)] dark:text-[var(--text-dark)] mt-1">₹{approvedTotal.toLocaleString()}</p>
                        </div>
                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-600 dark:text-green-400">
                            <BanknotesIcon className="w-6 h-6" />
                        </div>
                    </div>
                </Card>
                
                {/* Pending Card - Admin Only */}
                {isAdmin && (
                    <Card className="p-4 border-l-4 border-l-yellow-500 animated-card" style={{ animationDelay: '100ms' }}>
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Pending Approval (Total)</p>
                                <p className="text-2xl font-bold text-[var(--text-light)] dark:text-[var(--text-dark)] mt-1">₹{pendingTotal.toLocaleString()}</p>
                            </div>
                            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg text-yellow-600 dark:text-yellow-400">
                                <BanknotesIcon className="w-6 h-6" />
                            </div>
                        </div>
                    </Card>
                )}
            </div>

            {/* List */}
            {loading ? (
                <div className="space-y-4">
                    <div className="h-20 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse"></div>
                    <div className="h-20 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse"></div>
                </div>
            ) : filteredExpenses.length === 0 ? (
                <div className="p-12 text-center text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] border-2 border-dashed border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-xl">
                    No {isResident ? 'approved' : ''} expenses found {viewMode === 'monthly' ? `for ${monthDisplay}` : ''}.
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredExpenses.map((expense, idx) => (
                        <Card 
                            key={expense.id} 
                            className="p-4 animated-card cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                            style={{ animationDelay: `${idx * 50}ms` }}
                            onClick={() => setSelectedExpense(expense)}
                        >
                            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                                <div className="flex-1">
                                    <div className="flex justify-between items-start md:hidden mb-2">
                                        <span className="font-bold text-lg text-[var(--text-light)] dark:text-[var(--text-dark)]">₹{expense.amount}</span>
                                        <StatusPill status={expense.status} />
                                    </div>
                                    <h3 className="font-semibold text-lg text-[var(--text-light)] dark:text-[var(--text-dark)]">{expense.title}</h3>
                                    <div className="text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                        <span>{expense.category}</span>
                                        <span>•</span>
                                        <span>{new Date(expense.date).toLocaleDateString()}</span>
                                        <span>•</span>
                                        <span>By {expense.submittedByName}</span>
                                    </div>
                                    {expense.description && (
                                        <p className="text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mt-2 italic whitespace-pre-line line-clamp-2">
                                            {parseDescription(expense.description).text}
                                        </p>
                                    )}
                                    {/* Action By Metadata */}
                                    {expense.status === ExpenseStatus.Approved && expense.approvedByName && (
                                        <p className="text-xs text-green-600 dark:text-green-400 mt-2">Approved by {expense.approvedByName}</p>
                                    )}
                                    {expense.status === ExpenseStatus.Rejected && expense.approvedByName && (
                                        <p className="text-xs text-red-600 dark:text-red-400 mt-2">Rejected by {expense.approvedByName}</p>
                                    )}
                                </div>
                                
                                <div className="flex flex-col items-end gap-3 min-w-[150px]">
                                    <div className="hidden md:flex flex-col items-end">
                                        <span className="font-bold text-xl text-[var(--text-light)] dark:text-[var(--text-dark)]">₹{expense.amount}</span>
                                        <div className="mt-1"><StatusPill status={expense.status} /></div>
                                    </div>
                                    
                                    {/* Action Buttons for Pending Expenses (Admins Only) */}
                                    {isAdmin && expense.status === ExpenseStatus.Pending && (
                                        expense.submittedBy !== user?.id ? (
                                            <div className="flex gap-2 w-full md:w-auto">
                                                <Button 
                                                    size="sm" 
                                                    variant="outlined" 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleRejectClick(expense);
                                                    }} 
                                                    className="flex-1 md:flex-none border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                >
                                                    Reject
                                                </Button>
                                                <Button 
                                                    size="sm" 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleApproveClick(expense);
                                                    }} 
                                                    className="flex-1 md:flex-none"
                                                >
                                                    Approve
                                                </Button>
                                            </div>
                                        ) : (
                                            <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-1 rounded">
                                                Waiting for peer approval
                                            </span>
                                        )
                                    )}
                                    {expense.receiptUrl && (
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setViewReceiptUrl(expense.receiptUrl || null);
                                            }}
                                            className="text-xs text-[var(--accent)] hover:underline focus:outline-none"
                                        >
                                            View Receipt
                                        </button>
                                    )}
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Log Expense Modal (Admins Only) */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Log New Expense">
                <form className="space-y-4" onSubmit={handleFormSubmit}>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Title</label>
                        <input type="text" value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Generator Fuel" className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"/>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Amount (₹)</label>
                            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} required min="0" step="0.01" className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"/>
                        </div>
                        <div>
                             <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Date</label>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"/>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Category</label>
                        <div className="relative">
                            <select value={category} onChange={e => setCategory(e.target.value as ExpenseCategory)} className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] appearance-none">
                                {Object.values(ExpenseCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">
                                <FunnelIcon className="w-4 h-4" />
                            </div>
                        </div>
                    </div>

                     <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Description</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"></textarea>
                    </div>

                     <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Receipt (Optional)</label>
                        <input type="file" accept="image/*" onChange={handleFileUpload} className="block w-full text-sm text-[var(--text-secondary-light)] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 dark:file:bg-teal-900/30 dark:file:text-teal-300" />
                    </div>

                    <div className="flex justify-end pt-4 space-x-2">
                        <Button type="button" variant="outlined" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Submitting...' : 'Submit for Approval'}</Button>
                    </div>
                </form>
            </Modal>
            
            {/* Confirmation Modal (Generic) */}
            <ConfirmationModal 
                isOpen={confirmConfig.isOpen}
                onClose={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
                onConfirm={handleConfirmAction}
                title={confirmConfig.title}
                message={confirmConfig.message}
                isDestructive={confirmConfig.isDestructive}
                confirmLabel={confirmConfig.confirmLabel}
                isLoading={isSubmitting}
            />
            
            {/* Reject Reason Modal (Custom) */}
            <Modal isOpen={isRejectModalOpen} onClose={() => setIsRejectModalOpen(false)} title="Reject Expense">
                <form className="space-y-4" onSubmit={handleConfirmReject}>
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-md mb-2 border border-red-100 dark:border-red-900/30">
                        <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                            Rejecting: {expenseToReject?.title} (₹{expenseToReject?.amount})
                        </p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Reason for Rejection <span className="text-red-500">*</span></label>
                        <textarea 
                            value={rejectionReason} 
                            onChange={e => setRejectionReason(e.target.value)} 
                            rows={3} 
                            required
                            placeholder="Please explain why this expense is being rejected..."
                            className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-transparent"
                        ></textarea>
                    </div>
                    <div className="flex justify-end pt-4 space-x-2">
                        <Button type="button" variant="outlined" onClick={() => setIsRejectModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting || !rejectionReason.trim()} className="bg-red-500 hover:bg-red-600 border-transparent text-white focus:ring-red-500/30">
                            {isSubmitting ? 'Rejecting...' : 'Confirm Rejection'}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* View Receipt Modal */}
            <Modal isOpen={!!viewReceiptUrl} onClose={() => setViewReceiptUrl(null)} title="Expense Receipt">
                 <div className="flex justify-center p-2 bg-gray-50 dark:bg-black/20 rounded border border-[var(--border-light)] dark:border-[var(--border-dark)]">
                    {viewReceiptUrl ? (
                        <img src={viewReceiptUrl} alt="Receipt" className="max-h-[60vh] object-contain" />
                    ) : (
                        <p className="text-red-500">Error loading image.</p>
                    )}
                </div>
                 <div className="flex justify-end pt-4">
                    <Button onClick={() => setViewReceiptUrl(null)}>Close</Button>
                </div>
            </Modal>

            {/* Expense Detail Modal */}
            <Modal isOpen={!!selectedExpense} onClose={() => setSelectedExpense(null)} title="Expense Details">
                {selectedExpense && detailViewData && (
                    <div className="space-y-6">
                        {/* Header Info */}
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-xl font-bold text-[var(--text-light)] dark:text-[var(--text-dark)]">{selectedExpense.title}</h3>
                                <p className="text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">{new Date(selectedExpense.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            </div>
                            <StatusPill status={selectedExpense.status} />
                        </div>
                        
                        {/* Amount and Meta Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 dark:bg-white/5 p-4 rounded-lg border border-gray-100 dark:border-gray-800">
                            <div>
                                <p className="text-xs text-[var(--text-secondary-light)] uppercase tracking-wide font-semibold">Amount</p>
                                <p className="text-2xl font-bold text-[var(--text-light)] dark:text-[var(--text-dark)]">₹{selectedExpense.amount.toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-xs text-[var(--text-secondary-light)] uppercase tracking-wide font-semibold">Category</p>
                                <p className="text-base font-medium text-[var(--text-light)] dark:text-[var(--text-dark)]">{selectedExpense.category}</p>
                            </div>
                            <div>
                                <p className="text-xs text-[var(--text-secondary-light)] uppercase tracking-wide font-semibold">Submitted By</p>
                                <p className="text-base font-medium text-[var(--text-light)] dark:text-[var(--text-dark)]">{selectedExpense.submittedByName || 'Unknown'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-[var(--text-secondary-light)] uppercase tracking-wide font-semibold">Action By</p>
                                <p className="text-base font-medium text-[var(--text-light)] dark:text-[var(--text-dark)]">
                                    {selectedExpense.approvedByName || (selectedExpense.status === 'Pending' ? '-' : 'Unknown')}
                                </p>
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <h4 className="text-sm font-medium text-[var(--text-secondary-light)] mb-2 uppercase tracking-wide">Description</h4>
                            <p className="text-[var(--text-light)] dark:text-[var(--text-dark)] whitespace-pre-wrap text-sm leading-relaxed p-3 bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] rounded border border-[var(--border-light)] dark:border-[var(--border-dark)]">
                                {detailViewData.text}
                            </p>
                        </div>

                        {/* Rejection Alert */}
                        {detailViewData.rejectionReason && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg p-4">
                                <h4 className="text-sm font-bold text-red-800 dark:text-red-300 mb-1 flex items-center gap-2">
                                    <AlertTriangleIcon className="w-4 h-4"/> Rejection Reason
                                </h4>
                                <p className="text-red-700 dark:text-red-200 text-sm">
                                    {detailViewData.rejectionReason}
                                </p>
                            </div>
                        )}

                        {/* Receipt */}
                        {selectedExpense.receiptUrl && (
                            <div>
                                <h4 className="text-sm font-medium text-[var(--text-secondary-light)] mb-2 uppercase tracking-wide">Receipt</h4>
                                <div className="border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-lg overflow-hidden bg-white dark:bg-black/20 group relative cursor-zoom-in" onClick={() => window.open(selectedExpense.receiptUrl, '_blank')}>
                                    <img 
                                        src={selectedExpense.receiptUrl} 
                                        alt="Receipt" 
                                        className="w-full max-h-64 object-contain"
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                         <p className="text-white opacity-0 group-hover:opacity-100 font-medium text-sm bg-black/50 px-3 py-1 rounded">Click to Open</p>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {/* Footer Actions */}
                        <div className="flex justify-end pt-4 gap-2">
                            <Button variant="outlined" onClick={() => setSelectedExpense(null)}>Close</Button>
                            
                            {/* Allow actions from modal too if pending AND Admin */}
                            {isAdmin && selectedExpense.status === ExpenseStatus.Pending && selectedExpense.submittedBy !== user?.id && (
                                <>
                                    <Button 
                                        variant="outlined" 
                                        className="text-red-600 border-red-200 hover:bg-red-50"
                                        onClick={(e) => {
                                            handleRejectClick(selectedExpense);
                                            setSelectedExpense(null);
                                        }}
                                    >
                                        Reject
                                    </Button>
                                    <Button 
                                        onClick={(e) => {
                                            handleApproveClick(selectedExpense);
                                            setSelectedExpense(null);
                                        }}
                                    >
                                        Approve
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </Modal>

            <AuditLogModal
                isOpen={isAuditOpen}
                onClose={() => setIsAuditOpen(false)}
                entityType="Expense"
                title="Expense History"
            />

        </div>
    );
};

export default Expenses;
