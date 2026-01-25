
import React, { useState, useEffect } from 'react';
import { getCommunityStats, recordCommunityPayment, getFinancialHistory, getFinancialYears } from '../services/api';
import type { CommunityStat, FinancialHistory } from '../types';
import Card from '../components/ui/Card';
import Spinner from '../components/ui/Spinner';
import ErrorCard from '../components/ui/ErrorCard';
import { CalculatorIcon, CurrencyRupeeIcon, ArrowDownTrayIcon, MagnifyingGlassIcon, ChevronDownIcon, CheckCircleIcon, BanknotesIcon, FunnelIcon, HistoryIcon } from '../components/icons';
import { generateInvoice, generateAnnualReport } from '../services/pdfGenerator';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import FeedbackModal from '../components/ui/FeedbackModal';
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

    const [feedback, setFeedback] = useState<{ isOpen: boolean; type: 'success' | 'error' | 'info'; title: string; message: string }>({
        isOpen: false, type: 'success', title: '', message: ''
    });

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
                setFeedback({ isOpen: true, type: 'error', title: 'Limit Exceeded', message: "Please select an image under 1MB." });
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
            setFeedback({ isOpen: true, type: 'success', title: 'Payment Logged', message: 'The community account has been successfully credited.' });
            setIsPaymentModalOpen(false);
            await fetchStats();
        } catch (err: any) {
            console.error("Payment recording failed", err);
            setFeedback({ isOpen: true, type: 'error', title: 'Transaction Failed', message: err.message || "Could not record the community payment." });
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
                <div className="flex items-start gap-3">
                    <div className="w-1 h-10 bg-brand-500 rounded-full mt-1" />
                    <div>
                        <span className="text-[9px] font-mono font-black uppercase tracking-[0.3em] text-brand-600 dark:text-brand-400 mb-0.5 block">Treasury & Revenue</span>
                        <h2 className="text-3xl font-brand font-extrabold text-brand-600 dark:text-slate-50 tracking-tight leading-tight">Billing Center</h2>
                    </div>
                </div>
                <div className="flex bg-slate-50 dark:bg-zinc-900/40 p-1 rounded-xl border border-slate-100 dark:border-white/5">
                    <button 
                        onClick={() => setViewMode('operations')}
                        className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${viewMode === 'operations' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                    >
                        Operations
                    </button>
                    <button 
                        onClick={() => setViewMode('reports')}
                        className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${viewMode === 'reports' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                    >
                        Annual Reports
                    </button>
                </div>
            </div>

            {viewMode === 'operations' && (
                <div className="space-y-6 animate-fadeIn">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="p-6 col-span-full border-none bg-brand-600 dark:bg-[#0f1115] text-white">
                             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div>
                                    <p className="text-[8px] font-mono font-black uppercase tracking-[0.2em] opacity-70 mb-1">Expected Revenue (Current Cycle)</p>
                                    <h3 className="text-5xl font-brand font-extrabold tracking-tight">₹{globalTotals.total.toLocaleString()}</h3>
                                </div>
                                <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-md">
                                    <CalculatorIcon className="w-8 h-8 text-white" />
                                </div>
                            </div>
                            <div className="mt-8">
                                <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden flex">
                                    <div style={{ width: `${getPercent(globalTotals.resident, globalTotals.total)}%` }} className="h-full bg-white" title="Residents" />
                                    <div style={{ width: `${getPercent(globalTotals.admin, globalTotals.total)}%` }} className="h-full bg-brand-200" title="Admins" />
                                    <div style={{ width: `${getPercent(globalTotals.staff, globalTotals.total)}%` }} className="h-full bg-brand-400" title="Staff" />
                                </div>
                                <div className="flex gap-6 mt-4 text-[9px] font-black uppercase tracking-widest opacity-70">
                                    <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-white"></div> Residents</div>
                                    <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-brand-200"></div> Admins</div>
                                    <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-brand-400"></div> Staff</div>
                                </div>
                            </div>
                        </Card>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <MagnifyingGlassIcon className="h-5 w-5 text-slate-400" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search by community identity..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="block w-full pl-12 pr-4 py-2.5 rounded-xl input-field text-sm font-bold shadow-sm"
                            />
                        </div>
                        <div className="relative w-full sm:w-44">
                            <select 
                                value={paymentFilter} 
                                onChange={(e) => setPaymentFilter(e.target.value as any)}
                                className="block w-full px-4 py-2.5 rounded-xl input-field text-xs font-bold appearance-none bg-white dark:bg-zinc-900 shadow-sm"
                            >
                                <option value="All">All Identifiers</option>
                                <option value="Paid">Settled</option>
                                <option value="Unpaid">Outstanding</option>
                            </select>
                            <FunnelIcon className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                    </div>

                    <div className="space-y-3">
                        {filteredStats.map((stat, index) => {
                            const residentPrice = stat.pricePerUser?.resident || 0;
                            const adminPrice = stat.pricePerUser?.admin || 0;
                            const staffPrice = stat.pricePerUser?.staff || 0;
                            const communityTotal = (stat.resident_count * residentPrice) + (stat.admin_count * adminPrice) + (stat.staff_count * staffPrice);
                            const isExpanded = expandedId === stat.id;
                            const isPaid = (stat.current_month_paid || 0) >= communityTotal && communityTotal > 0;

                            return (
                                <Card key={stat.id} className="overflow-hidden bg-white dark:bg-zinc-900/40 border border-slate-50 dark:border-white/5 p-0">
                                    <div 
                                        className="p-5 flex flex-col sm:flex-row sm:items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.01] transition-colors"
                                        onClick={() => toggleExpand(stat.id)}
                                    >
                                        <div className="flex-1 min-w-0 pr-4">
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <h3 className="font-brand font-extrabold text-lg text-slate-900 dark:text-slate-50 truncate">{stat.name}</h3>
                                                <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded-md ${isPaid ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                                    {isPaid ? 'Settled' : 'Action Required'}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight truncate">{stat.address}</p>
                                        </div>
                                        <div className="flex items-center justify-between sm:justify-end gap-6 mt-4 sm:mt-0">
                                            <div className="text-right">
                                                <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest">Fee Payload</p>
                                                <p className="text-2xl font-brand font-extrabold text-brand-600">₹{communityTotal.toLocaleString()}</p>
                                            </div>
                                            <ChevronDownIcon className={`w-5 h-5 text-slate-300 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-brand-600' : ''}`} />
                                        </div>
                                    </div>
                                    {isExpanded && (
                                        <div className="px-5 pb-5 pt-4 border-t border-slate-50 dark:border-white/5 bg-slate-50/50 dark:bg-black/20 animate-slideDown">
                                             <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                                                <div className="bg-white dark:bg-zinc-900/60 p-4 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm">
                                                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Residential</p>
                                                    <p className="font-brand font-extrabold text-slate-900 dark:text-slate-50">₹{(stat.resident_count * residentPrice).toLocaleString()}</p>
                                                </div>
                                                <div className="bg-white dark:bg-zinc-900/60 p-4 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm">
                                                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Administrative</p>
                                                    <p className="font-brand font-extrabold text-slate-900 dark:text-slate-50">₹{(stat.admin_count * adminPrice).toLocaleString()}</p>
                                                </div>
                                                <div className="bg-white dark:bg-zinc-900/60 p-4 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm">
                                                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Operational Staff</p>
                                                    <p className="font-brand font-extrabold text-slate-900 dark:text-slate-50">₹{(stat.staff_count * staffPrice).toLocaleString()}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button 
                                                    onClick={(e) => { e.stopPropagation(); generateInvoice(stat); }}
                                                    variant="outlined" 
                                                    size="sm" 
                                                    className="flex-1 text-[9px]"
                                                    leftIcon={<ArrowDownTrayIcon />}
                                                >
                                                    Generate Invoice
                                                </Button>
                                                {!isPaid && (
                                                    <Button 
                                                        onClick={(e) => handleRecordPaymentClick(stat, communityTotal, e)}
                                                        size="sm" 
                                                        className="flex-1 text-[9px]"
                                                        leftIcon={<BanknotesIcon />}
                                                    >
                                                        Log Remittance
                                                    </Button>
                                                )}
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
                    <div className="flex justify-between items-center bg-white dark:bg-zinc-900/40 p-4 rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-sm">
                        <div className="flex items-center gap-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fiscal Year</label>
                            <div className="relative">
                                <select 
                                    value={selectedYear} 
                                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                    className="appearance-none pl-4 pr-10 py-2 rounded-xl input-field text-sm font-bold bg-slate-50 dark:bg-black/20"
                                >
                                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                                <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                        {history && (
                            <Button 
                                onClick={() => generateAnnualReport(history)}
                                size="md" 
                                leftIcon={<ArrowDownTrayIcon />}
                            >
                                Export Fiscal Data
                            </Button>
                        )}
                    </div>

                    {historyLoading ? <div className="flex justify-center p-20"><Spinner /></div> : history ? (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card className="p-8 border-none bg-emerald-600 text-white shadow-xl rounded-[2.5rem]">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="p-3 bg-white/20 rounded-2xl"><CurrencyRupeeIcon className="w-8 h-8" /></div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Gross Annual Revenue</p>
                                            <h3 className="text-4xl font-brand font-extrabold tracking-tight">₹{history.totalCollected.toLocaleString()}</h3>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 pt-6 border-t border-white/10">
                                        <div>
                                            <p className="text-[9px] font-black uppercase opacity-60">Settled Nodes</p>
                                            <p className="text-xl font-brand font-extrabold">{history.monthlyBreakdown.reduce((a, b) => a + b.transactionCount, 0)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black uppercase opacity-60">Growth Yield</p>
                                            <p className="text-xl font-brand font-extrabold">Active</p>
                                        </div>
                                    </div>
                                </Card>

                                <Card className="p-8 bg-white dark:bg-zinc-900/40 border border-slate-50 dark:border-white/5 shadow-sm flex flex-col justify-center rounded-[2.5rem]">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Revenue Distribution Trend</h4>
                                    <BarChart data={history.monthlyBreakdown} />
                                </Card>
                            </div>

                            <Card className="p-0 overflow-hidden bg-white dark:bg-zinc-900/40 border border-slate-50 dark:border-white/5 rounded-[2.5rem]">
                                <div className="p-6 border-b border-slate-50 dark:border-white/5 bg-slate-50/50 dark:bg-black/20">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Node Performance Breakdown</h4>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-50/30 dark:bg-white/[0.02]">
                                                <th className="p-5">Community Registry</th>
                                                <th className="p-5 text-right">Annual Contribution</th>
                                                <th className="p-5 text-right">Portfolio Percent</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                                            {history.communityBreakdown.map((c, i) => (
                                                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-white/[0.01] transition-colors">
                                                    <td className="p-5 font-brand font-extrabold text-slate-800 dark:text-slate-200">{c.communityName}</td>
                                                    <td className="p-5 text-right font-brand font-extrabold text-brand-600">₹{c.totalPaid.toLocaleString()}</td>
                                                    <td className="p-5 text-right">
                                                        <div className="flex items-center justify-end gap-3">
                                                            <span className="text-[10px] font-black text-slate-400">{Math.round((c.totalPaid / history.totalCollected) * 100)}%</span>
                                                            <div className="w-24 h-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                                                <div style={{ width: `${(c.totalPaid / history.totalCollected) * 100}%` }} className="h-full bg-brand-500" />
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        </>
                    ) : (
                        <div className="py-24 text-center border-2 border-dashed border-slate-100 dark:border-white/5 rounded-[3rem] opacity-30">
                            {/* Fix: Ensured HistoryIcon is properly rendered in the fallback state */}
                            <HistoryIcon className="w-16 h-16 mx-auto mb-4" />
                            <p className="font-brand font-extrabold text-xl">Fiscal Ledger Null</p>
                        </div>
                    )}
                </div>
            )}

            {/* Payment Recording Modal */}
            <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Log Remittance" subtitle="FINANCIAL ADJUSTMENT" size="lg">
                <form onSubmit={handlePaymentSubmit} className="space-y-6">
                    <div className="p-6 bg-slate-50 dark:bg-black/20 rounded-[2rem] border border-slate-100 dark:border-white/5 text-center">
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{selectedCommunityForPayment?.name.toUpperCase()} BALANCE</p>
                         <p className="text-5xl font-brand font-extrabold text-brand-600">₹{parseFloat(paymentAmount || '0').toLocaleString()}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="sm:col-span-2">
                             <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Transaction Proof (Digital Receipt)</label>
                             <div className="relative group">
                                <input type="file" accept="image/*" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                <div className="border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl p-8 text-center group-hover:border-brand-500 group-hover:bg-brand-50/10 transition-all">
                                    {receiptUrl ? (
                                        <div className="relative inline-block">
                                            <img src={receiptUrl} alt="Receipt" className="max-h-32 mx-auto rounded-lg shadow-lg border border-slate-200" />
                                            <div className="absolute -top-2 -right-2 bg-emerald-500 text-white rounded-full p-1"><CheckCircleIcon className="w-4 h-4" /></div>
                                        </div>
                                    ) : (
                                        <>
                                            <ArrowDownTrayIcon className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Transmit Source Proof</p>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Amount Settled (₹)</label>
                            <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} required className="rounded-xl input-field text-sm font-bold"/>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Payment Timestamp</label>
                            <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} required className="rounded-xl input-field text-xs font-bold appearance-none"/>
                        </div>
                        <div className="sm:col-span-2">
                             <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Transaction Annotations</label>
                             <textarea value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} rows={3} placeholder="Optional reference notes..." className="rounded-xl input-field text-sm font-medium leading-relaxed" />
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-50 dark:border-white/5 flex justify-end gap-3">
                        <Button type="button" variant="ghost" onClick={() => setIsPaymentModalOpen(false)}>Discard</Button>
                        <Button type="submit" disabled={isSubmitting} leftIcon={isSubmitting ? <Spinner /> : <CheckCircleIcon />}>
                            {isSubmitting ? 'Syncing Ledger...' : 'Log Remittance'}
                        </Button>
                    </div>
                </form>
            </Modal>

            <FeedbackModal isOpen={feedback.isOpen} onClose={() => setFeedback({ ...feedback, isOpen: false })} title={feedback.title} message={feedback.message} type={feedback.type} />
        </div>
    );
};

export default Billing;
