
import React, { useState, useEffect } from 'react';
import { getMaintenanceRecords, submitMaintenancePayment, verifyMaintenancePayment, getCommunity, getMaintenanceHistory, addMaintenanceConfiguration } from '../services/api';
import type { MaintenanceRecord, Community, MaintenanceConfiguration } from '../types';
import { MaintenanceStatus, UserRole } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { useAuth } from '../hooks/useAuth';
import AuditLogModal from '../components/AuditLogModal';
import { CurrencyRupeeIcon, MagnifyingGlassIcon, FunnelIcon, PencilIcon, ClockIcon, HistoryIcon } from '../components/icons';
import { useScreen } from '../hooks/useScreen';

interface MaintenanceProps {
    initialFilter?: MaintenanceStatus;
}

const StatusPill: React.FC<{ status: MaintenanceStatus }> = ({ status }) => {
    const statusStyles: Record<MaintenanceStatus, string> = {
        [MaintenanceStatus.Pending]: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
        [MaintenanceStatus.Submitted]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
        [MaintenanceStatus.Paid]: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    };
    return <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusStyles[status]}`}>{status}</span>;
}

// ... Skeletons ...
const MaintenanceSkeleton: React.FC = () => (
     <tr className="animate-pulse">
        <td className="p-4"><div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
        <td className="p-4"><div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
        <td className="p-4"><div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full"></div></td>
        <td className="p-4"><div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
        <td className="p-4"><div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
    </tr>
);

const MobileCardSkeleton: React.FC = () => (
    <div className="p-4 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse mb-4">
        <div className="flex justify-between mb-4">
            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
        <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
        <div className="flex justify-between">
            <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
            <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
    </div>
);

const Maintenance: React.FC<MaintenanceProps> = ({ initialFilter }) => {
    const { user } = useAuth();
    const canManage = user?.role === UserRole.Admin || user?.role === UserRole.SuperAdmin || user?.role === UserRole.HelpdeskAdmin;

    // Default to 'manage' for admins, 'my_dues' for residents
    const [activeTab, setActiveTab] = useState<'manage' | 'my_dues'>(canManage ? 'manage' : 'my_dues');
    
    const [records, setRecords] = useState<MaintenanceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    
    // Configuration Modal
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [community, setCommunity] = useState<Community | null>(null);
    const [history, setHistory] = useState<MaintenanceConfiguration[]>([]);
    const [isAuditOpen, setIsAuditOpen] = useState(false);
    
    // Add New Config Form
    const [newRate, setNewRate] = useState('');
    const [newFixedAmount, setNewFixedAmount] = useState('');
    const [newEffectiveDate, setNewEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
    const [isAddingConfig, setIsAddingConfig] = useState(false); // Toggle form inside modal

    const { isMobile } = useScreen();
    
    const [selectedRecord, setSelectedRecord] = useState<MaintenanceRecord | null>(null);
    
    // Payment Form State
    const [receiptUrl, setReceiptUrl] = useState('');
    const [upiId, setUpiId] = useState('');
    const [transactionDate, setTransactionDate] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Admin Filters
    const [filterStatus, setFilterStatus] = useState<MaintenanceStatus | 'All'>('All');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (initialFilter) {
            setFilterStatus(initialFilter);
        }
    }, [initialFilter]);

    const fetchRecords = async () => {
        if (!user?.communityId) return;
        try {
            setLoading(true);
            // Fetch All if Admin is in 'manage' mode. Otherwise fetch specific user (for Resident OR Admin in 'my_dues' mode)
            const shouldFetchAll = canManage && activeTab === 'manage';
            const userId = shouldFetchAll ? undefined : user.id;
            
            const data = await getMaintenanceRecords(user.communityId, userId);
            setRecords(data);
        } catch (error) {
            console.error("Failed to fetch maintenance records", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCommunitySettings = async () => {
        if (!user?.communityId || !canManage) return;
        try {
            const data = await getCommunity(user.communityId);
            setCommunity(data);
            const historyData = await getMaintenanceHistory(user.communityId);
            setHistory(historyData);
            
            // Set defaults for new form based on latest
            if (historyData.length > 0) {
                setNewRate(historyData[0].maintenanceRate.toString());
                setNewFixedAmount(historyData[0].fixedMaintenanceAmount.toString());
            } else {
                setNewRate(data.maintenanceRate?.toString() || '');
                setNewFixedAmount(data.fixedMaintenanceAmount?.toString() || '');
            }
        } catch (error) {
            console.error("Failed to fetch community settings", error);
        }
    }

    useEffect(() => {
        fetchRecords();
        if (canManage) {
            fetchCommunitySettings();
        }
    }, [user, activeTab]); // Re-fetch when tab changes

    const handlePayClick = (record: MaintenanceRecord) => {
        setSelectedRecord(record);
        setIsModalOpen(true);
        setTransactionDate(new Date().toISOString().split('T')[0]);
    };

    const handleVerifyClick = (record: MaintenanceRecord) => {
        setSelectedRecord(record);
        setIsViewModalOpen(true);
    }

    const handlePaymentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRecord) return;
        setIsSubmitting(true);
        try {
            await submitMaintenancePayment(selectedRecord.id, receiptUrl, upiId, transactionDate);
            setIsModalOpen(false);
            setReceiptUrl('');
            setUpiId('');
            alert("Payment Submitted successfully! Admin will verify shortly.");
            await fetchRecords();
        } catch (error: any) {
            alert(error.message || "Failed to submit payment");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleVerifySubmit = async () => {
         if (!selectedRecord) return;
         setIsSubmitting(true);
         try {
             await verifyMaintenancePayment(selectedRecord.id);
             setIsViewModalOpen(false);
             alert("Payment Verified and marked as Paid.");
             await fetchRecords();
         } catch (error: any) {
             alert(error.message || "Failed to verify");
         } finally {
             setIsSubmitting(false);
         }
    };

    const handleAddConfigSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!community || !user?.communityId) return;
        
        setIsSubmitting(true);
        try {
            await addMaintenanceConfiguration({
                communityId: user.communityId,
                maintenanceRate: newRate ? parseFloat(newRate) : 0,
                fixedMaintenanceAmount: newFixedAmount ? parseFloat(newFixedAmount) : 0,
                effectiveDate: newEffectiveDate
            });
            
            setIsAddingConfig(false);
            alert("New maintenance rate added successfully.");
            await fetchCommunitySettings();
        } catch (error: any) {
            alert("Failed to add configuration: " + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    // ... File Upload Logic ...
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
    }

    const filteredRecords = records.filter(r => {
        if (filterStatus !== 'All' && r.status !== filterStatus) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return (
                r.userName?.toLowerCase().includes(q) || 
                r.flatNumber?.toLowerCase().includes(q) ||
                r.upiTransactionId?.toLowerCase().includes(q)
            );
        }
        return true;
    });

    const renderMobileList = () => (
        <div className="space-y-4">
            {filteredRecords.length === 0 ? (
                <div className="p-8 text-center text-[var(--text-secondary-light)]">No records found.</div>
            ) : (
                filteredRecords.map(record => {
                    const isOwnRecord = record.userId === user?.id;
                    return (
                        <div key={record.id} className="p-4 rounded-xl bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] shadow-sm border border-[var(--border-light)] dark:border-[var(--border-dark)] animated-card">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h4 className="font-bold text-lg text-[var(--text-light)] dark:text-[var(--text-dark)]">{record.flatNumber}</h4>
                                    {canManage && activeTab === 'manage' && <p className="text-xs text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">{record.userName}</p>}
                                </div>
                                <span className="font-bold text-lg text-[var(--text-light)] dark:text-[var(--text-dark)]">₹{record.amount}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-3">
                                <span>{new Date(record.periodDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}</span>
                                {record.transactionDate && <span>Paid: {new Date(record.transactionDate).toLocaleDateString()}</span>}
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-[var(--border-light)] dark:border-[var(--border-dark)]">
                                <StatusPill status={record.status} />
                                
                                {isOwnRecord && record.status === MaintenanceStatus.Pending && (
                                    <Button size="sm" onClick={() => handlePayClick(record)} leftIcon={<CurrencyRupeeIcon className="w-4 h-4"/>}>Pay</Button>
                                )}
                                
                                {canManage && record.status === MaintenanceStatus.Submitted && (
                                    isOwnRecord ? (
                                        <span className="text-xs text-gray-500 italic">Peer verification needed</span>
                                    ) : (
                                        <Button size="sm" onClick={() => handleVerifyClick(record)}>Verify</Button>
                                    )
                                )}
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center animated-card">
                <div>
                    <h2 className="text-2xl font-bold text-[var(--text-light)] dark:text-[var(--text-dark)]">Maintenance History</h2>
                    <p className="text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] text-lg mt-1">
                        {canManage ? "Manage payments and rates." : "View dues and payment history."}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button 
                        onClick={() => setIsAuditOpen(true)} 
                        variant="outlined"
                        size="sm"
                        leftIcon={<HistoryIcon className="w-4 h-4" />}
                        className="border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                        History
                    </Button>
                    {canManage && (
                        <Button 
                            onClick={() => setIsConfigModalOpen(true)}
                            variant="outlined"
                            leftIcon={<PencilIcon className="w-4 h-4"/>}
                            className="hidden sm:inline-flex"
                        >
                            Configure Rates
                        </Button>
                    )}
                </div>
            </div>
            
            {/* Mobile Fab for Config */}
            {canManage && isMobile && (
                 <div className="flex justify-end -mt-4 mb-2">
                    <Button size="sm" onClick={() => setIsConfigModalOpen(true)} variant="outlined" leftIcon={<PencilIcon className="w-4 h-4"/>}>
                        Configure Rates
                    </Button>
                 </div>
            )}

            {/* Admin Tabs */}
            {canManage && (
                <div className="border-b border-[var(--border-light)] dark:border-[var(--border-dark)]">
                    <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                        <button
                            onClick={() => setActiveTab('manage')}
                            className={`${activeTab === 'manage' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] hover:text-[var(--text-light)] dark:hover:text-[var(--text-dark)] hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                        >
                            Manage Records
                        </button>
                        <button
                            onClick={() => setActiveTab('my_dues')}
                            className={`${activeTab === 'my_dues' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] hover:text-[var(--text-light)] dark:hover:text-[var(--text-dark)] hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                        >
                            My Dues
                        </button>
                    </nav>
                </div>
            )}

            {canManage && activeTab === 'manage' && (
                <div className="flex flex-col gap-4 bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] p-4 rounded-xl border border-[var(--border-light)] dark:border-[var(--border-dark)] animated-card">
                     <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <MagnifyingGlassIcon className="h-5 w-5 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search by resident, flat, or transaction ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-lg bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                        />
                    </div>
                    <div className="relative">
                         <select 
                            value={filterStatus} 
                            onChange={(e) => setFilterStatus(e.target.value as any)}
                            className="appearance-none bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] border border-[var(--border-light)] dark:border-[var(--border-dark)] text-sm rounded-lg block w-full pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                        >
                            <option value="All">All Status</option>
                            <option value={MaintenanceStatus.Pending}>Pending</option>
                            <option value={MaintenanceStatus.Submitted}>Submitted</option>
                            <option value={MaintenanceStatus.Paid}>Paid</option>
                        </select>
                         <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                            <FunnelIcon className="w-4 h-4" />
                        </div>
                    </div>
                </div>
            )}

            {loading ? (
                isMobile ? (
                    <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <MobileCardSkeleton key={i} />)}</div>
                ) : (
                    <Card className="overflow-x-auto animated-card">
                         <table className="w-full text-left border-collapse whitespace-nowrap">
                            <tbody className="divide-y divide-[var(--border-light)] dark:divide-[var(--border-dark)]">
                                {Array.from({ length: 5 }).map((_, i) => <MaintenanceSkeleton key={i} />)}
                            </tbody>
                        </table>
                    </Card>
                )
            ) : isMobile ? (
                renderMobileList()
            ) : (
                <Card className="overflow-x-auto animated-card">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead className="bg-black/5 dark:bg-white/5">
                            <tr>
                                <th className="p-4 font-semibold text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">{activeTab === 'manage' ? 'Resident' : 'Unit'}</th>
                                <th className="p-4 font-semibold text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Month</th>
                                <th className="p-4 font-semibold text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Amount</th>
                                <th className="p-4 font-semibold text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Status</th>
                                <th className="p-4 font-semibold text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Payment Date</th>
                                <th className="p-4 font-semibold text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-light)] dark:divide-[var(--border-dark)]">
                            {filteredRecords.length === 0 ? (
                                <tr><td colSpan={6} className="p-4 text-center text-[var(--text-secondary-light)]">No records found.</td></tr>
                            ) : (
                                filteredRecords.map(record => {
                                    const isOwnRecord = record.userId === user?.id;
                                    return (
                                        <tr key={record.id}>
                                            <td className="p-4">
                                                {canManage && activeTab === 'manage' ? (
                                                    <div>
                                                        <div className="font-medium text-[var(--text-light)] dark:text-[var(--text-dark)]">{record.userName}</div>
                                                        <div className="text-xs text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">{record.flatNumber}</div>
                                                    </div>
                                                ) : (
                                                    <div className="font-medium text-[var(--text-light)] dark:text-[var(--text-dark)]">{record.flatNumber}</div>
                                                )}
                                            </td>
                                            <td className="p-4 text-[var(--text-light)] dark:text-[var(--text-dark)]">{new Date(record.periodDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}</td>
                                            <td className="p-4 font-medium text-[var(--text-light)] dark:text-[var(--text-dark)]">₹{record.amount}</td>
                                            <td className="p-4"><StatusPill status={record.status} /></td>
                                            <td className="p-4 text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">{record.transactionDate ? new Date(record.transactionDate).toLocaleDateString() : '-'}</td>
                                            <td className="p-4">
                                                {isOwnRecord && record.status === MaintenanceStatus.Pending && (
                                                    <Button size="sm" onClick={() => handlePayClick(record)} leftIcon={<CurrencyRupeeIcon className="w-4 h-4"/>}>Pay Now</Button>
                                                )}
                                                
                                                {canManage && record.status === MaintenanceStatus.Submitted && (
                                                    isOwnRecord ? (
                                                        <span className="text-xs text-gray-500 italic cursor-help" title="Another admin must verify your payment.">Peer verification needed</span>
                                                    ) : (
                                                        <Button size="sm" onClick={() => handleVerifyClick(record)}>Verify</Button>
                                                    )
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </Card>
            )}

            {/* Resident Payment Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Submit Payment">
                <form className="space-y-4" onSubmit={handlePaymentSubmit}>
                    {/* ... Existing Payment Form ... */}
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md mb-4 border border-blue-100 dark:border-blue-900/30">
                        <div className="flex justify-between items-start mb-2">
                             <div>
                                <p className="text-xs text-blue-600 dark:text-blue-300 uppercase tracking-wide font-semibold">Payment For</p>
                                <p className="text-lg font-bold text-blue-900 dark:text-blue-100">{selectedRecord?.flatNumber}</p>
                             </div>
                             <div className="text-right">
                                <p className="text-xs text-blue-600 dark:text-blue-300 uppercase tracking-wide font-semibold">Amount Due</p>
                                <p className="text-lg font-bold text-blue-900 dark:text-blue-100">₹{selectedRecord?.amount}</p>
                             </div>
                        </div>
                        <p className="text-sm text-blue-700 dark:text-blue-300/80 border-t border-blue-200 dark:border-blue-800 pt-2 mt-1">
                            Billing Month: <span className="font-semibold">{selectedRecord && new Date(selectedRecord.periodDate).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
                        </p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Payment Receipt (Image)</label>
                        <input type="file" accept="image/*" onChange={handleFileUpload} required={!receiptUrl} className="block w-full text-sm text-[var(--text-secondary-light)] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                        {receiptUrl && <p className="text-xs text-green-600 mt-1">Receipt attached.</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">UPI Transaction ID</label>
                        <input type="text" value={upiId} onChange={e => setUpiId(e.target.value)} required placeholder="e.g. 1234567890" className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Transaction Date</label>
                        <input type="date" value={transactionDate} onChange={e => setTransactionDate(e.target.value)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"/>
                    </div>
                    <div className="flex justify-end pt-4 space-x-2">
                        <Button type="button" variant="outlined" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting || !receiptUrl}>{isSubmitting ? 'Submitting...' : 'Submit Payment'}</Button>
                    </div>
                </form>
            </Modal>

            {/* Admin Verification Modal */}
             <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Verify Payment">
                {/* ... Existing Verify Modal ... */}
                <div className="space-y-4">
                    <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-md">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <span className="text-[var(--text-secondary-light)]">Resident:</span>
                            <span className="font-medium text-[var(--text-light)] dark:text-[var(--text-dark)]">{selectedRecord?.userName}</span>
                            <span className="text-[var(--text-secondary-light)]">Unit:</span>
                            <span className="font-medium text-[var(--text-light)] dark:text-[var(--text-dark)]">{selectedRecord?.flatNumber}</span>
                            <span className="text-[var(--text-secondary-light)]">Amount:</span>
                            <span className="font-medium text-[var(--text-light)] dark:text-[var(--text-dark)]">₹{selectedRecord?.amount}</span>
                            <span className="text-[var(--text-secondary-light)]">UPI ID:</span>
                            <span className="font-medium text-[var(--text-light)] dark:text-[var(--text-dark)]">{selectedRecord?.upiTransactionId}</span>
                             <span className="text-[var(--text-secondary-light)]">Date:</span>
                            <span className="font-medium text-[var(--text-light)] dark:text-[var(--text-dark)]">{selectedRecord?.transactionDate}</span>
                        </div>
                    </div>
                    <div>
                        <p className="text-sm font-medium mb-2 text-[var(--text-secondary-light)]">Attached Receipt:</p>
                        {selectedRecord?.paymentReceiptUrl ? (
                            <div className="border rounded-lg p-2 bg-white dark:bg-black">
                                <img src={selectedRecord.paymentReceiptUrl} alt="Receipt" className="max-h-64 object-contain mx-auto" />
                            </div>
                        ) : (
                            <p className="text-red-500 text-sm">No receipt attached.</p>
                        )}
                    </div>
                    <div className="flex justify-end pt-4 space-x-2">
                        <Button type="button" variant="outlined" onClick={() => setIsViewModalOpen(false)} disabled={isSubmitting}>Close</Button>
                        <Button type="button" onClick={handleVerifySubmit} disabled={isSubmitting}>{isSubmitting ? 'Verifying...' : 'Verify & Approve'}</Button>
                    </div>
                </div>
            </Modal>

            {/* Configuration History Modal */}
            <Modal isOpen={isConfigModalOpen} onClose={() => { setIsConfigModalOpen(false); setIsAddingConfig(false); }} title="Maintenance Configuration" size="lg">
                <div className="space-y-6">
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-100 dark:border-blue-900/30">
                        <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                            Community Type: {community?.communityType}
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                            {community?.communityType?.includes('Standalone') 
                                ? "Calculated as a fixed monthly amount per unit." 
                                : "Calculated as Rate x Unit Size (sq ft)."}
                        </p>
                    </div>

                    {!isAddingConfig ? (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-md font-semibold text-[var(--text-light)] dark:text-[var(--text-dark)]">Rate History</h3>
                                <Button size="sm" onClick={() => setIsAddingConfig(true)} leftIcon={<ClockIcon className="w-4 h-4"/>}>New Rate</Button>
                            </div>
                            
                            <div className="overflow-hidden border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-lg">
                                <table className="min-w-full divide-y divide-[var(--border-light)] dark:divide-[var(--border-dark)]">
                                    <thead className="bg-black/5 dark:bg-white/5">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] uppercase tracking-wider">Effective From</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] uppercase tracking-wider">
                                                {community?.communityType?.includes('Standalone') ? 'Fixed Amount' : 'Rate / Sq Ft'}
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] uppercase tracking-wider">Created</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] divide-y divide-[var(--border-light)] dark:divide-[var(--border-dark)]">
                                        {history.length === 0 ? (
                                            <tr><td colSpan={3} className="px-4 py-4 text-center text-sm text-[var(--text-secondary-light)]">No history found.</td></tr>
                                        ) : (
                                            history.map((config) => (
                                                <tr key={config.id}>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--text-light)] dark:text-[var(--text-dark)] font-medium">
                                                        {new Date(config.effectiveDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--text-light)] dark:text-[var(--text-dark)]">
                                                        {community?.communityType?.includes('Standalone') ? `₹${config.fixedMaintenanceAmount}` : `₹${config.maintenanceRate}`}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-xs text-[var(--text-secondary-light)]">
                                                        {new Date(config.createdAt).toLocaleDateString()}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleAddConfigSubmit} className="space-y-4 border border-[var(--border-light)] dark:border-[var(--border-dark)] p-4 rounded-lg bg-[var(--bg-light)] dark:bg-[var(--bg-dark)]">
                            <h3 className="text-md font-semibold text-[var(--text-light)] dark:text-[var(--text-dark)] mb-2">Set New Effective Rate</h3>
                            
                            {community?.communityType?.includes('Standalone') ? (
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">
                                        Fixed Monthly Amount (₹)
                                    </label>
                                    <input 
                                        type="number" 
                                        min="0"
                                        step="0.01"
                                        value={newFixedAmount}
                                        onChange={e => setNewFixedAmount(e.target.value)}
                                        className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"
                                        required
                                    />
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">
                                        Rate per Sq. Ft. (₹)
                                    </label>
                                    <input 
                                        type="number" 
                                        min="0"
                                        step="0.01"
                                        value={newRate}
                                        onChange={e => setNewRate(e.target.value)}
                                        className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"
                                        required
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">
                                    Effective From
                                </label>
                                <input 
                                    type="date" 
                                    value={newEffectiveDate}
                                    onChange={e => setNewEffectiveDate(e.target.value)}
                                    className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"
                                    required
                                />
                                <p className="text-xs text-[var(--text-secondary-light)] mt-1">
                                    Bills generated for months after this date will use this rate.
                                </p>
                            </div>

                            <div className="flex justify-end pt-2 gap-2">
                                <Button type="button" variant="outlined" onClick={() => setIsAddingConfig(false)} disabled={isSubmitting}>Cancel</Button>
                                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save Configuration'}</Button>
                            </div>
                        </form>
                    )}

                    <div className="flex justify-end pt-4 border-t border-[var(--border-light)] dark:border-[var(--border-dark)]">
                        <Button type="button" variant="outlined" onClick={() => { setIsConfigModalOpen(false); setIsAddingConfig(false); }}>Close</Button>
                    </div>
                </div>
            </Modal>

            <AuditLogModal
                isOpen={isAuditOpen}
                onClose={() => setIsAuditOpen(false)}
                entityType="Maintenance"
                title="Maintenance History"
            />
        </div>
    );
};

export default Maintenance;
