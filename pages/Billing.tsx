
import React, { useState, useEffect } from 'react';
import { getCommunityStats, recordCommunityPayment, getFinancialHistory, getFinancialYears } from '../services/api';
import type { CommunityStat, FinancialHistory } from '../types';
import Card from '../components/ui/Card';
import Spinner from '../components/ui/Spinner';
import ErrorCard from '../components/ui/ErrorCard';
import { CalculatorIcon, CurrencyRupeeIcon, ArrowDownTrayIcon, MagnifyingGlassIcon, ChevronDownIcon, CheckCircleIcon, BanknotesIcon } from '../components/icons';
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
                // If currently selected year is not in the list (e.g. initial load), switch to the most recent one
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
            fetchYears().then(() => {
                // fetchHistory is triggered by selectedYear dependency, 
                // but if selectedYear doesn't change, we need to call it manually or rely on subsequent effect
                // The safest way is to rely on the effect below which watches [viewMode, selectedYear]
            });
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

    // --- Calculations for Operations View ---
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

    const filteredStats = stats.filter(stat => 
        stat.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        stat.address.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getPercent = (part: number, total: number) => total > 0 ? (part / total) * 100 : 0;

    // --- Helper Component: Bar Chart (CSS) ---
    const BarChart = ({ data }: { data: { month: string, amount: number }[] }) => {
        const maxAmount = Math.max(...data.map(d => d.amount), 1);
        
        return (
            <div className="h-64 flex items-end justify-between gap-2 pt-6">
                {data.map((d, i) => {
                    const heightPercent = (d.amount / maxAmount) * 100;
                    return (
                        <div key={i} className="flex flex-col items-center flex-1 h-full justify-end group">
                            <div className="relative w-full max-w-[20px] sm:max-w-[40px] bg-gray-100 dark:bg-white/5 rounded-t-lg h-full flex items-end overflow-hidden">
                                <div 
                                    style={{ height: `${heightPercent}%` }} 
                                    className="w-full bg-[var(--accent)] transition-all duration-500 ease-out group-hover:bg-brand-400 relative"
                                >
                                    <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-[10px] px-2 py-1 rounded transition-opacity whitespace-nowrap z-10">
                                        ₹{d.amount.toLocaleString()}
                                    </div>
                                </div>
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
            {/* Header Area */}
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
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${viewMode === 'operations' ? 'bg-[var(--accent)] text-white shadow-sm' : 'text-[var(--text-secondary-light)] hover:text-[var(--text-light)]'}`}
                    >
                        Current Operations
                    </button>
                    <button 
                        onClick={() => setViewMode('reports')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${viewMode === 'reports' ? 'bg-[var(--accent)] text-white shadow-sm' : 'text-[var(--text-secondary-light)] hover:text-[var(--text-light)]'}`}
                    >
                        Annual Reports
                    </button>
                </div>
            </div>

            {/* --- OPERATIONS VIEW --- */}
            {viewMode === 'operations' && (
                <div className="space-y-6 animate-fadeIn">
                    {/* Revenue Overview Card */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="col-span-1 md:col-span-3 bg-gradient-to-r from-brand-600 to-brand-500 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
                            <div className="relative z-10 flex justify-between items-center">
                                <div>
                                    <p className="text-brand-100 text-sm font-medium uppercase tracking-wider mb-1">Expected Revenue (This Month)</p>
                                    <h3 className="text-4xl font-bold">₹{globalTotals.total.toLocaleString()}</h3>
                                </div>
                                <div className="p-3 bg-white/20 rounded-full backdrop-blur-sm">
                                    <CalculatorIcon className="w-8 h-8 text-white" />
                                </div>
                            </div>
                            
                            {/* Revenue Split Bar */}
                            <div className="relative z-10 mt-6">
                                <div className="flex justify-between text-xs text-brand-100 mb-2 font-medium">
                                    <span>Projection Distribution</span>
                                    <span>100%</span>
                                </div>
                                <div className="h-3 w-full bg-black/20 rounded-full overflow-hidden flex">
                                    <div style={{ width: `${getPercent(globalTotals.resident, globalTotals.total)}%` }} className="h-full bg-white/90" title="Residents" />
                                    <div style={{ width: `${getPercent(globalTotals.admin, globalTotals.total)}%` }} className="h-full bg-white/60" title="Admins" />
                                    <div style={{ width: `${getPercent(globalTotals.staff, globalTotals.total)}%` }} className="h-full bg-white/30" title="Staff" />
                                </div>
                                <div className="flex gap-4 mt-2 text-xs text-brand-50">
                                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-white/90"></div> Residents</div>
                                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-white/60"></div> Admins</div>
                                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-white/30"></div> Staff</div>
                                </div>
                            </div>
                            <div className="absolute -bottom-8 -right-8 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
                        </div>
                    </div>

                    {/* Search & List */}
                    <div className="sticky top-[72px] z-10 -mx-4 px-4 py-2 bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] backdrop-blur-md bg-opacity-90">
                        <div className="relative max-w-full">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <MagnifyingGlassIcon className="h-5 w-5 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search communities..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="block w-full pl-10 pr-4 py-3 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-xl bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        {filteredStats.length === 0 ? (
                            <div className="text-center py-12 text-[var(--text-secondary-light)] border-2 border-dashed border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-xl">
                                No communities found matching "{searchQuery}".
                            </div>
                        ) : (
                            filteredStats.map((stat, index) => {
                                const residentPrice = stat.pricePerUser?.resident || 0;
                                const adminPrice = stat.pricePerUser?.admin || 0;
                                const staffPrice = stat.pricePerUser?.staff || 0;

                                const residentTotal = stat.resident_count * residentPrice;
                                const adminTotal = stat.admin_count * adminPrice;
                                const staffTotal = stat.staff_count * staffPrice;
                                const communityTotal = residentTotal + adminTotal + staffTotal;
                                
                                const isExpanded = expandedId === stat.id;
                                const isPaid = (stat.current_month_paid || 0) >= communityTotal && communityTotal > 0;

                                return (
                                    <Card 
                                        key={stat.id} 
                                        className={`overflow-hidden transition-all duration-300 animated-card border-l-4 ${stat.status === 'active' ? 'border-l-green-500' : 'border-l-red-500'}`}
                                        style={{ animationDelay: `${index * 50}ms` }}
                                    >
                                        <div 
                                            className="p-4 flex flex-col sm:flex-row sm:items-center justify-between cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                            onClick={() => toggleExpand(stat.id)}
                                        >
                                            <div className="flex-1 min-w-0 pr-4">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-bold text-lg text-[var(--text-light)] dark:text-[var(--text-dark)] truncate">{stat.name}</h3>
                                                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${stat.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800'}`}>
                                                        {stat.status}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] truncate">{stat.address}</p>
                                            </div>

                                            <div className="flex items-center justify-between sm:justify-end gap-4 mt-3 sm:mt-0 w-full sm:w-auto">
                                                <div className="text-right">
                                                    <p className="text-[10px] text-[var(--text-secondary-light)] uppercase font-bold tracking-wide">Total Bill</p>
                                                    <p className="text-xl font-bold text-[var(--accent)]">₹{communityTotal.toLocaleString()}</p>
                                                </div>
                                                <div className={`transform transition-transform duration-200 text-[var(--text-secondary-light)] ${isExpanded ? 'rotate-180' : ''}`}>
                                                    <ChevronDownIcon className="w-5 h-5" />
                                                </div>
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="px-4 pb-4 pt-0 border-t border-[var(--border-light)] dark:border-[var(--border-dark)] bg-gray-50/50 dark:bg-white/5 animate-fadeIn">
                                                <div className="py-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <div className="bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] p-3 rounded-lg border border-[var(--border-light)] dark:border-[var(--border-dark)] flex justify-between items-center shadow-sm">
                                                        <div><p className="text-xs text-[var(--text-secondary-light)] uppercase font-semibold">Residents ({stat.resident_count})</p><p className="text-xs text-[var(--text-secondary-light)]">Rate: ₹{residentPrice}</p></div>
                                                        <p className="font-bold text-[var(--text-light)] dark:text-[var(--text-dark)]">₹{residentTotal.toLocaleString()}</p>
                                                    </div>
                                                    <div className="bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] p-3 rounded-lg border border-[var(--border-light)] dark:border-[var(--border-dark)] flex justify-between items-center shadow-sm">
                                                        <div><p className="text-xs text-[var(--text-secondary-light)] uppercase font-semibold">Admins ({stat.admin_count})</p><p className="text-xs text-[var(--text-secondary-light)]">Rate: ₹{adminPrice}</p></div>
                                                        <p className="font-bold text-[var(--text-light)] dark:text-[var(--text-dark)]">₹{adminTotal.toLocaleString()}</p>
                                                    </div>
                                                    <div className="bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] p-3 rounded-lg border border-[var(--border-light)] dark:border-[var(--border-dark)] flex justify-between items-center shadow-sm">
                                                        <div><p className="text-xs text-[var(--text-secondary-light)] uppercase font-semibold">Staff ({stat.staff_count})</p><p className="text-xs text-[var(--text-secondary-light)]">Rate: ₹{staffPrice}</p></div>
                                                        <p className="font-bold text-[var(--text-light)] dark:text-[var(--text-dark)]">₹{staffTotal.toLocaleString()}</p>
                                                    </div>
                                                </div>

                                                <div className="flex justify-end pt-2 gap-3 items-center">
                                                    {isPaid ? (
                                                        <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-bold border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 py-2 rounded-lg">
                                                            <CheckCircleIcon className="w-5 h-5"/> Paid
                                                        </div>
                                                    ) : (
                                                        <Button 
                                                            onClick={(e) => handleRecordPaymentClick(stat, communityTotal, e)} 
                                                            size="sm" variant="outlined" leftIcon={<CheckCircleIcon className="w-4 h-4" />} className="w-full sm:w-auto"
                                                        >
                                                            Record Payment
                                                        </Button>
                                                    )}
                                                    <Button onClick={(e) => { e.stopPropagation(); generateInvoice(stat); }} size="sm" leftIcon={<ArrowDownTrayIcon className="w-4 h-4" />} className="w-full sm:w-auto">
                                                        Download Invoice
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </Card>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* --- REPORTS VIEW --- */}
            {viewMode === 'reports' && (
                <div className="space-y-6 animate-fadeIn">
                    
                    {/* Controls */}
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-[var(--text-light)] dark:text-[var(--text-dark)]">
                            Performance Year {selectedYear}
                        </h3>
                        <select 
                            value={selectedYear} 
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-[var(--text-light)] dark:text-[var(--text-dark)]"
                        >
                            {availableYears.map((yr) => (
                                <option key={yr} value={yr}>{yr}</option>
                            ))}
                        </select>
                    </div>

                    {historyLoading ? (
                        <div className="h-64 flex items-center justify-center border-2 border-dashed border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-xl">
                            <Spinner />
                        </div>
                    ) : history ? (
                        <>
                            {/* Summary Stats */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <Card className="p-6 border-l-4 border-l-blue-500">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Total Collected</p>
                                            <p className="text-3xl font-bold text-[var(--text-light)] dark:text-[var(--text-dark)] mt-1">₹{history.totalCollected.toLocaleString()}</p>
                                        </div>
                                        <BanknotesIcon className="w-8 h-8 text-blue-500 opacity-80" />
                                    </div>
                                </Card>
                                <Card className="p-6 border-l-4 border-l-purple-500">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Best Month</p>
                                            <p className="text-3xl font-bold text-[var(--text-light)] dark:text-[var(--text-dark)] mt-1">
                                                {history.monthlyBreakdown.reduce((prev, current) => (prev.amount > current.amount) ? prev : current).month}
                                            </p>
                                        </div>
                                        <ArrowDownTrayIcon className="w-8 h-8 text-purple-500 opacity-80 rotate-180" />
                                    </div>
                                </Card>
                                <Card className="p-6 border-l-4 border-l-teal-500 flex items-center justify-center">
                                    <Button onClick={() => generateAnnualReport(history)} size="lg" className="w-full" leftIcon={<ArrowDownTrayIcon className="w-5 h-5"/>}>
                                        Download {selectedYear} Report
                                    </Button>
                                </Card>
                            </div>

                            {/* Chart */}
                            <Card className="p-6">
                                <h3 className="text-base font-semibold mb-4 text-[var(--text-light)] dark:text-[var(--text-dark)]">Revenue Trend</h3>
                                <BarChart data={history.monthlyBreakdown} />
                            </Card>

                            {/* Breakdown Table */}
                            <Card className="overflow-hidden">
                                <div className="px-6 py-4 border-b border-[var(--border-light)] dark:border-[var(--border-dark)]">
                                    <h3 className="font-semibold text-[var(--text-light)] dark:text-[var(--text-dark)]">Community Breakdown</h3>
                                </div>
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-black/5 dark:bg-white/5">
                                        <tr>
                                            <th className="px-6 py-3 font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Community Name</th>
                                            <th className="px-6 py-3 font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] text-right">Total Contributed</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--border-light)] dark:divide-[var(--border-dark)]">
                                        {history.communityBreakdown.map((c, i) => (
                                            <tr key={i} className="hover:bg-black/5 dark:hover:bg-white/5 text-[var(--text-light)] dark:text-[var(--text-dark)]">
                                                <td className="px-6 py-3">{c.communityName}</td>
                                                <td className="px-6 py-3 text-right font-medium">₹{c.totalPaid.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                        {history.communityBreakdown.length === 0 && (
                                            <tr><td colSpan={2} className="px-6 py-4 text-center text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">No payment data recorded for this year.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </Card>
                        </>
                    ) : (
                        <p className="text-center">No history loaded.</p>
                    )}
                </div>
            )}

            {/* Record Payment Modal (Same as before) */}
            <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title={`Record Payment: ${selectedCommunityForPayment?.name}`}>
                <form onSubmit={handlePaymentSubmit} className="space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-900/30">
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Current Calculated Bill</span>
                            <span className="text-xl font-bold text-blue-900 dark:text-blue-100">₹{parseFloat(paymentAmount).toLocaleString()}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Amount Received</label>
                            <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} required min="0" className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Date Received</label>
                            <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"/>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Transaction Ref / Notes</label>
                        <textarea value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} placeholder="e.g. UPI Ref: 1234567890" className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent" rows={2}/>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Proof of Payment</label>
                        <input type="file" accept="image/*" onChange={handleFileUpload} className="block w-full text-sm text-[var(--text-secondary-light)] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 dark:file:bg-teal-900/30 dark:file:text-teal-300" />
                        {receiptUrl && <div className="mt-2 text-xs text-green-600 dark:text-green-400 flex items-center gap-1"><CheckCircleIcon className="w-3 h-3"/> Proof Attached</div>}
                    </div>

                    <div className="flex justify-end pt-4 space-x-2">
                        <Button type="button" variant="outlined" onClick={() => setIsPaymentModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Mark as Received'}</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Billing;
