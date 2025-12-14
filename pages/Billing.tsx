
import React, { useState, useEffect } from 'react';
import { getCommunityStats } from '../services/api';
import type { CommunityStat } from '../types';
import Card from '../components/ui/Card';
import Spinner from '../components/ui/Spinner';
import ErrorCard from '../components/ui/ErrorCard';
import { CalculatorIcon, CurrencyRupeeIcon, ArrowDownTrayIcon, MagnifyingGlassIcon, ChevronDownIcon } from '../components/icons';
import { generateInvoice } from '../services/pdfGenerator';
import Button from '../components/ui/Button';

const Billing: React.FC = () => {
    const [stats, setStats] = useState<CommunityStat[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
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
        fetchStats();
    }, []);

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    if (loading) return <div className="flex h-96 items-center justify-center"><Spinner /></div>;
    if (error) return <div className="p-4"><ErrorCard title="Error Loading Billing" message={error} /></div>;

    // --- Calculations ---
    
    // Global Totals
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

    // Percentage Helper
    const getPercent = (part: number, total: number) => total > 0 ? (part / total) * 100 : 0;

    return (
        <div className="space-y-6">
            {/* Header & Global Dashboard */}
            <div className="animated-card space-y-4">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-[var(--text-light)] dark:text-[var(--text-dark)]">Billing Overview</h2>
                        <p className="text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] text-sm mt-1">
                            Monthly revenue generation across all communities.
                        </p>
                    </div>
                </div>

                {/* Revenue Overview Card */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Total Card */}
                    <div className="col-span-1 md:col-span-3 bg-gradient-to-r from-brand-600 to-brand-500 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
                        <div className="relative z-10 flex justify-between items-center">
                            <div>
                                <p className="text-brand-100 text-sm font-medium uppercase tracking-wider mb-1">Total Monthly Revenue</p>
                                <h3 className="text-4xl font-bold">₹{globalTotals.total.toLocaleString()}</h3>
                            </div>
                            <div className="p-3 bg-white/20 rounded-full backdrop-blur-sm">
                                <CalculatorIcon className="w-8 h-8 text-white" />
                            </div>
                        </div>
                        
                        {/* Revenue Split Bar */}
                        <div className="relative z-10 mt-6">
                            <div className="flex justify-between text-xs text-brand-100 mb-2 font-medium">
                                <span>Revenue Distribution</span>
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

                        {/* Background Decor */}
                        <div className="absolute -bottom-8 -right-8 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <div className="sticky top-[72px] z-10 -mx-4 px-4 py-2 bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] backdrop-blur-md bg-opacity-90 dark:bg-opacity-90">
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

            {/* Accordion List */}
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

                        return (
                            <Card 
                                key={stat.id} 
                                className={`overflow-hidden transition-all duration-300 animated-card border-l-4 ${stat.status === 'active' ? 'border-l-green-500' : 'border-l-red-500'}`}
                                style={{ animationDelay: `${index * 50}ms` }}
                            >
                                {/* Header / Summary Row (Always Visible) */}
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

                                {/* Expanded Details */}
                                {isExpanded && (
                                    <div className="px-4 pb-4 pt-0 border-t border-[var(--border-light)] dark:border-[var(--border-dark)] bg-gray-50/50 dark:bg-white/5 animate-fadeIn">
                                        <div className="py-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {/* Breakdown Items */}
                                            <div className="bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] p-3 rounded-lg border border-[var(--border-light)] dark:border-[var(--border-dark)] flex justify-between items-center shadow-sm">
                                                <div>
                                                    <p className="text-xs text-[var(--text-secondary-light)] uppercase font-semibold">Residents ({stat.resident_count})</p>
                                                    <p className="text-xs text-[var(--text-secondary-light)]">Rate: ₹{residentPrice}</p>
                                                </div>
                                                <p className="font-bold text-[var(--text-light)] dark:text-[var(--text-dark)]">₹{residentTotal.toLocaleString()}</p>
                                            </div>
                                            
                                            <div className="bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] p-3 rounded-lg border border-[var(--border-light)] dark:border-[var(--border-dark)] flex justify-between items-center shadow-sm">
                                                <div>
                                                    <p className="text-xs text-[var(--text-secondary-light)] uppercase font-semibold">Admins ({stat.admin_count})</p>
                                                    <p className="text-xs text-[var(--text-secondary-light)]">Rate: ₹{adminPrice}</p>
                                                </div>
                                                <p className="font-bold text-[var(--text-light)] dark:text-[var(--text-dark)]">₹{adminTotal.toLocaleString()}</p>
                                            </div>

                                            <div className="bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] p-3 rounded-lg border border-[var(--border-light)] dark:border-[var(--border-dark)] flex justify-between items-center shadow-sm">
                                                <div>
                                                    <p className="text-xs text-[var(--text-secondary-light)] uppercase font-semibold">Staff ({stat.staff_count})</p>
                                                    <p className="text-xs text-[var(--text-secondary-light)]">Rate: ₹{staffPrice}</p>
                                                </div>
                                                <p className="font-bold text-[var(--text-light)] dark:text-[var(--text-dark)]">₹{staffTotal.toLocaleString()}</p>
                                            </div>
                                        </div>

                                        <div className="flex justify-end pt-2">
                                            <Button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    generateInvoice(stat);
                                                }} 
                                                size="sm"
                                                leftIcon={<ArrowDownTrayIcon className="w-4 h-4" />}
                                                className="w-full sm:w-auto"
                                            >
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
    );
};

export default Billing;
