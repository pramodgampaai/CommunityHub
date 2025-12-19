
import React, { useState, useEffect } from 'react';
import { getCommunityStats, recordCommunityPayment, getFinancialHistory, getFinancialYears } from '../services/api';
import type { CommunityStat, FinancialHistory } from '../types';
import Card from '../components/ui/Card';
import Spinner from '../components/ui/Spinner';
import ErrorCard from '../components/ui/ErrorCard';
import { CalculatorIcon, CurrencyRupeeIcon, ArrowDownTrayIcon, MagnifyingGlassIcon, ChevronDownIcon, CheckCircleIcon, BanknotesIcon, FunnelIcon } from '../components/icons';
import { generateInvoice, generateAnnualReport } from '../services/pdfGenerator';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { useAuth } from '../hooks/useAuth';

const Billing: React.FC = () => {
    const { user } = useAuth();
    
    // View State
    const [viewMode, setViewMode] = useState<'operations' | 'reports'>('operations');
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [availableYears, setAvailableYears] = useState<number[]>([new Date().getFullYear()]);

    // Operations Data
    const [stats, setStats] = useState<CommunityStat[]>([]);
    
    // Reports Data
    const [history, setHistory] = useState<FinancialHistory | null>(null);
    const [historyLoading, setHistoryLoading] = useState(false);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [paymentFilter, setPaymentFilter] = useState<'All' | 'Paid' | 'Unpaid'>('All');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Payment Modal State
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedCommunityForPayment, setSelectedCommunityForPayment] = useState<CommunityStat | null>(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentNotes, setPaymentNotes] = useState('');
    const [receiptUrl, setReceiptUrl] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchStats = async () => {
        try {
            setLoading(true);
            const data = await getCommunityStats();
            setStats(data);
        } catch (err: any) {
            console.error("Failed to fetch stats", err);
            setError(err.message || "Failed to load billing data.");
        } finally {
            setLoading(false);
        }
    };

    const fetchYears = async () => {
        try {
            const years = await getFinancialYears();
            if (years && years.length > 0) {
                setAvailableYears(years);
                if (!years.includes(selectedYear)) {
                    setSelectedYear(years[0]);
                }
            }
        } catch (e) {
            console.error("Failed to fetch financial years", e);
        }
    };

    const fetchHistory = async () => {
        try {
            setHistoryLoading(true);
            const data = await getFinancialHistory(selectedYear);
            setHistory(data);
        } catch (err: any) {
            console.error("Failed history", err);
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    useEffect(() => {
        if (viewMode === 'reports') {
            fetchYears();
        }
    }, [viewMode]);

    useEffect(() => {
        if (viewMode === 'reports') {
            fetchHistory();
        }
    }, [viewMode, selectedYear]);

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    const handleRecordPaymentClick = (stat: CommunityStat, totalAmount: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedCommunityForPayment(stat);
        setPaymentAmount(totalAmount.toString());
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setPaymentNotes('');
        setReceiptUrl('');
        setIsPaymentModalOpen(true);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 1024 * 1024) {
                alert("File too large. Please select an image under 1MB.");
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setReceiptUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handlePaymentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCommunityForPayment || !user) return;

        setIsSubmitting(true);
        try {
            await recordCommunityPayment({
                communityId: selectedCommunityForPayment.id,
                amount: parseFloat(paymentAmount),
                date: paymentDate,
                receiptUrl: receiptUrl,
                notes: paymentNotes,
                recordedBy: user.id
            });
            alert("Payment recorded successfully!");
            setIsPaymentModalOpen(false);
            await fetchStats();
        } catch (err: any) {
            console.error("Payment recording failed", err);
            alert("Failed to record payment: " + (err.message || "Unknown error"));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <div className="flex h-96 items-center justify-center"><Spinner /></div>;
    if (error) return <div className="p-4"><ErrorCard title="Error Loading Billing" message={error} /></div>;

    const globalTotals = stats.reduce((acc, stat) => {
        const rBill = (stat.resident_count || 0) * (stat.pricePerUser?.resident || 0);
        const aBill = (stat.admin_count || 0) * (stat.pricePerUser?.admin || 0);
        const sBill = (stat.staff_count || 0) * (stat.pricePerUser?.staff || 0);
        
        return {
            total: acc.total + rBill + aBill + sBill,
            resident: acc.resident + rBill,
            admin: acc.admin + aBill,
            staff: acc.staff + sBill
        };
    }, { total: 0, resident: 0, admin: 0, staff: 0 });

    const filteredStats = stats.filter(stat => {
        const matchesSearch = stat.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              stat.address.toLowerCase().includes(searchQuery.toLowerCase());
        
        if (!matchesSearch) return false;
        if (paymentFilter === 'All') return true;

        const residentPrice = stat.pricePerUser?.resident || 0;
        const adminPrice = stat.pricePerUser?.admin || 0;
        const staffPrice = stat.pricePerUser?.staff || 0;
        const communityTotal = (stat.resident_count * residentPrice) + (stat.admin_count * adminPrice) + (stat.staff_count * staffPrice);
        const isPaid = (stat.current_month_paid || 0) >= communityTotal && communityTotal > 0;

        if (paymentFilter === 'Paid') return isPaid;
        if (paymentFilter === 'Unpaid') return !isPaid;
        return true;
    });

    const getPercent = (part: number, total: number) => total > 0 ? (part / total) * 100 : 0;

    const BarChart = ({ data }: { data: { month: string, amount: number }[] }) => {
        const maxAmount = Math.max(...data.map(d => d.amount), 1);
        return (
            <div className="h-64 flex items-end justify-between gap-2 pt-6">
                {data.map((d, i) => {
                    const heightPercent = (d.amount / maxAmount) * 100;
                    return (
                        <div key={i} className="flex flex-col items-center flex-1 h-full justify-end group">
                            <div className="relative w-full max-w-[20px] sm:max-w-[40px] bg-black/5 dark:bg-white/5 rounded-t-lg h-full flex items-end overflow-hidden">
                                <div 
                                    style={{ height: `${heightPercent}%` }} 
                                    className="w-full bg-brand-500 transition-all duration-500 ease-out group-hover:bg-brand-400 relative"
                                />
                            </div>
                            <span className="text-[10px] sm:text-xs text-[var(--text-secondary-light)] mt-2 font-medium truncate w-full text-center">
                                {d.month}
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animated-card">
                <div>
                    <h2 className="text-2xl font-bold text-[var(--text-light)] dark:text-[var(--text-dark)]">Financial Command Center</h2>
                    <p className="text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] text-sm mt-1">
                        Track revenue, manage billing, and analyze trends.
                    </p>
                </div>
                <div className="flex bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] p-1 rounded-lg border border-[var(--border-light)] dark:border-[var(--border-dark)]">
                    <button 
                        onClick={() => setViewMode('operations')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${viewMode === 'operations' ? 'bg-brand-500 text-white shadow-sm' : 'text-[var(--text-secondary-light)] hover:text-[var(--text-light)]'}`}
                    >
                        Operations
                    </button>
                    <button 
                        onClick={() => setViewMode('reports')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${viewMode === 'reports' ? 'bg-brand-500 text-white shadow-sm' : 'text-[var(--text-secondary-light)] hover:text-[var(--text-light)]'}`}
                    >
                        Annual Reports
                    </button>
                </div>
            </div>

            {viewMode === 'operations' && (
                <div className="space-y-6 animate-fadeIn">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="p-6 col-span-full border-l-4 border-l-brand-500">
                             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div>
                                    <p className="text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] text-sm font-medium uppercase tracking-wider mb-1">Expected Revenue (This Month)</p>
                                    <h3 className="text-4xl font-bold text-[var(--text-light)] dark:text-[var(--text-dark)]">₹{globalTotals.total.toLocaleString()}</h3>
                                </div>
                                <div className="p-3 bg-brand-500/10 rounded-full">
                                    <CalculatorIcon className="w-8 h-8 text-brand-500" />
                                </div>
                            </div>
                            <div className="mt-6">
                                <div className="h-3 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden flex">
                                    <div style={{ width: `${getPercent(globalTotals.resident, globalTotals.total)}%` }} className="h-full bg-brand-500" title="Residents" />
                                    <div style={{ width: `${getPercent(globalTotals.admin, globalTotals.total)}%` }} className="h-full bg-brand-400" title="Admins" />
                                    <div style={{ width: `${getPercent(globalTotals.staff, globalTotals.total)}%` }} className="h-full bg-brand-300" title="Staff" />
                                </div>
                                <div className="flex gap-4 mt-3 text-xs text-[var(--text-secondary-light)]">
                                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-brand-500"></div> Residents</div>
                                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-brand-400"></div> Admins</div>
                                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-brand-300"></div> Staff</div>
                                </div>
                            </div>
                        </Card>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <MagnifyingGlassIcon className="h-5 w-5 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search communities..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="block w-full pl-10 pr-4 py-2.5 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-xl bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                            />
                        </div>
                        <div className="relative w-full sm:w-40">
                            <select 
                                value={paymentFilter} 
                                onChange={(e) => setPaymentFilter(e.target.value as any)}
                                className="appearance-none block w-full pl-3 pr-8 py-2.5 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-xl bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 text-[var(--text-light)] dark:text-[var(--text-dark)]"
                            >
                                <option value="All">All Status</option>
                                <option value="Paid">Paid</option>
                                <option value="Unpaid">Unpaid</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--text-secondary-light)]">
                                <FunnelIcon className="w-4 h-4" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {filteredStats.map((stat, index) => {
                            const residentPrice = stat.pricePerUser?.resident || 0;
                            const adminPrice = stat.pricePerUser?.admin || 0;
                            const staffPrice = stat.pricePerUser?.staff || 0;
                            const communityTotal = (stat.resident_count * residentPrice) + (stat.admin_count * adminPrice) + (stat.staff_count * staffPrice);
                            const isExpanded = expandedId === stat.id;
                            const isPaid = (stat.current_month_paid || 0) >= communityTotal && communityTotal > 0;

                            return (
                                <Card key={stat.id} className="overflow-hidden animated-card">
                                    <div 
                                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                        onClick={() => toggleExpand(stat.id)}
                                    >
                                        <div className="flex-1 min-w-0 pr-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-bold text-lg text-[var(--text-light)] dark:text-[var(--text-dark)] truncate">{stat.name}</h3>
                                                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${isPaid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                    {isPaid ? 'Paid' : 'Awaiting Payment'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-[var(--text-secondary-light)] truncate">{stat.address}</p>
                                        </div>
                                        <div className="flex items-center justify-between sm:justify-end gap-4 mt-3 sm:mt-0">
                                            <div className="text-right">
                                                <p className="text-[10px] text-[var(--text-secondary-light)] uppercase font-bold">Billing</p>
                                                <p className="text-xl font-bold text-brand-600">₹{communityTotal.toLocaleString()}</p>
                                            </div>
                                            <ChevronDownIcon className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                        </div>
                                    </div>
                                    {isExpanded && (
                                        <div className="px-4 pb-4 pt-4 border-t border-[var(--border-light)] dark:border-[var(--border-dark)] bg-black/5 dark:bg-white/5">
                                             <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                                                <div className="bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] p-3 rounded-lg border border-[var(--border-light)] dark:border-[var(--border-dark)]">
                                                    <p className="text-xs text-[var(--text-secondary-light)] uppercase font-semibold">Residents</p>
                                                    <p className="font-bold text-[var(--text-light)]">₹{(stat.resident_count * residentPrice).toLocaleString()}</p>
                                                </div>
                                                <div className="bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] p-3 rounded-lg border border-[var(--border-light)] dark:border-[var(--border-dark)]">
                                                    <p className="text-xs text-[var(--text-secondary-light)] uppercase font-semibold">Admins</p>
                                                    <p className="font-bold text-[var(--text-light)]">₹{(stat.admin_count * adminPrice).toLocaleString()}</p>
                                                </div>
                                                <div className="bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] p-3 rounded-lg border border-[var(--border-light)] dark:border-[var(--border-dark)]">
                                                    <p className="text-xs text-[var(--text-secondary-light)] uppercase font-semibold">Staff</p>
                                                    <p className="font-bold text-[var(--text-light)]">₹{(stat.staff_count * staffPrice).toLocaleString()}</p>
                                                </div>
                                            </div>
                                            <div className="flex justify-end gap-3">
                                                {!isPaid && <Button size="sm" onClick={(e) => handleRecordPaymentClick(stat, communityTotal, e)}>Record Payment</Button>}
                                                <Button variant="outlined" size="sm" onClick={(e) => { e.stopPropagation(); generateInvoice(stat); }}>Invoice</Button>
                                            </div>
                                        </div>
                                    )}
                                </Card>
                            );
                        })}
                    </div>
                </div>
            )}

            {viewMode === 'reports' && (
                <div className="space-y-6 animate-fadeIn">
                     <div className="flex items-center justify-between bg-black/5 dark:bg-white/5 p-4 rounded-xl border border-[var(--border-light)] dark:border-[var(--border-dark)]">
                        <h3 className="text-lg font-semibold text-[var(--text-light)]">Yearly Statistics</h3>
                        <select 
                            value={selectedYear} 
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-500"
                        >
                            {availableYears.map(yr => <option key={yr} value={yr}>{yr}</option>)}
                        </select>
                    </div>

                    {historyLoading ? <div className="h-64 flex items-center justify-center"><Spinner /></div> : history && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card className="p-6 border-l-4 border-l-brand-500">
                                    <p className="text-sm text-[var(--text-secondary-light)]">Total Collected ({selectedYear})</p>
                                    <p className="text-4xl font-bold text-[var(--text-light)] mt-1">₹{history.totalCollected.toLocaleString()}</p>
                                </Card>
                                <Card className="p-6 border-l-4 border-l-brand-400 flex items-center justify-center">
                                    <Button onClick={() => generateAnnualReport(history)} className="w-full" leftIcon={<ArrowDownTrayIcon className="w-5 h-5"/>}>Download Annual Report</Button>
                                </Card>
                            </div>
                            <Card className="p-6">
                                <h3 className="font-semibold mb-4">Revenue Trend</h3>
                                <BarChart data={history.monthlyBreakdown} />
                            </Card>
                        </>
                    )}
                </div>
            )}

            <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title={`Record Payment: ${selectedCommunityForPayment?.name}`}>
                <form onSubmit={handlePaymentSubmit} className="space-y-4">
                     <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary-light)] mb-1">Amount Received (₹)</label>
                        <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} required min="0" className="block w-full px-3 py-2.5 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-xl bg-transparent"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary-light)] mb-1">Date</label>
                        <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} required className="block w-full px-3 py-2.5 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-xl bg-transparent"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary-light)] mb-1">Notes</label>
                        <textarea value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} placeholder="e.g. Transaction Ref: TXN12345" className="block w-full px-3 py-2.5 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-xl bg-transparent" rows={2}/>
                    </div>
                    <div className="flex justify-end pt-4 gap-3">
                        <Button type="button" variant="outlined" onClick={() => setIsPaymentModalOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save Payment'}</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Billing;
