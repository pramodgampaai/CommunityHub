
import React, { useState, useEffect } from 'react';
import { getMaintenanceRecords, submitMaintenancePayment, verifyMaintenancePayment } from '../services/api';
import type { MaintenanceRecord } from '../types';
import { MaintenanceStatus, UserRole } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { useAuth } from '../hooks/useAuth';
import { CurrencyRupeeIcon, MagnifyingGlassIcon, FunnelIcon } from '../components/icons';

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

const MaintenanceSkeleton: React.FC = () => (
     <tr className="animate-pulse">
        <td className="p-4"><div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
        <td className="p-4"><div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
        <td className="p-4"><div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full"></div></td>
        <td className="p-4"><div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
        <td className="p-4"><div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
    </tr>
);

const Maintenance: React.FC<MaintenanceProps> = ({ initialFilter }) => {
    const [records, setRecords] = useState<MaintenanceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const { user } = useAuth();
    
    const [selectedRecord, setSelectedRecord] = useState<MaintenanceRecord | null>(null);
    
    // Payment Form State
    const [receiptUrl, setReceiptUrl] = useState('');
    const [upiId, setUpiId] = useState('');
    const [transactionDate, setTransactionDate] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Admin Filters
    const [filterStatus, setFilterStatus] = useState<MaintenanceStatus | 'All'>('All');
    const [searchQuery, setSearchQuery] = useState('');

    // Apply initial filter if provided (e.g. navigation from Dashboard)
    useEffect(() => {
        if (initialFilter) {
            setFilterStatus(initialFilter);
        }
    }, [initialFilter]);

    const isAdmin = user?.role === UserRole.Admin || user?.role === UserRole.SuperAdmin || user?.role === UserRole.Helpdesk;

    const fetchRecords = async () => {
        if (!user?.communityId) return;
        try {
            setLoading(true);
            // If admin, fetch all. If resident, fetch own.
            const userId = isAdmin ? undefined : user.id;
            const data = await getMaintenanceRecords(user.communityId, userId);
            setRecords(data);
        } catch (error) {
            console.error("Failed to fetch maintenance records", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRecords();
    }, [user]);

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
    
    // Upload handler simulation (since we don't have bucket setup, we'll use data URI for small images or text)
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Check size (limit to 1MB for base64 safety in text col)
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

    // Admin Filtering
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

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center animated-card">
                <div>
                    <h2 className="text-3xl sm:text-4xl font-bold text-[var(--text-light)] dark:text-[var(--text-dark)]">Maintenance History</h2>
                    <p className="text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] text-lg mt-1">
                        {isAdmin ? "Manage and verify resident payments." : "View dues and payment history."}
                    </p>
                </div>
            </div>

            {isAdmin && (
                <div className="flex flex-col sm:flex-row gap-4 bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] p-4 rounded-xl border border-[var(--border-light)] dark:border-[var(--border-dark)] animated-card">
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
                            className="appearance-none bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] border border-[var(--border-light)] dark:border-[var(--border-dark)] text-sm rounded-lg block pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
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

            <Card className="overflow-x-auto animated-card">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead className="bg-black/5 dark:bg-white/5">
                        <tr>
                            <th className="p-4 font-semibold text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                                {isAdmin ? 'Resident' : 'Unit'}
                            </th>
                            <th className="p-4 font-semibold text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Month</th>
                            <th className="p-4 font-semibold text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Amount</th>
                            <th className="p-4 font-semibold text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Status</th>
                            <th className="p-4 font-semibold text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Payment Date</th>
                            <th className="p-4 font-semibold text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-light)] dark:divide-[var(--border-dark)]">
                        {loading ? (
                             Array.from({ length: 5 }).map((_, i) => <MaintenanceSkeleton key={i} />)
                        ) : filteredRecords.length === 0 ? (
                            <tr><td colSpan={6} className="p-4 text-center text-[var(--text-secondary-light)]">No records found.</td></tr>
                        ) : (
                            filteredRecords.map(record => (
                                <tr key={record.id}>
                                    <td className="p-4">
                                        {isAdmin ? (
                                            <div>
                                                <div className="font-medium text-[var(--text-light)] dark:text-[var(--text-dark)]">{record.userName}</div>
                                                <div className="text-xs text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">{record.flatNumber}</div>
                                            </div>
                                        ) : (
                                            <div className="font-medium text-[var(--text-light)] dark:text-[var(--text-dark)]">
                                                {record.flatNumber}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4 text-[var(--text-light)] dark:text-[var(--text-dark)]">
                                        {new Date(record.periodDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}
                                    </td>
                                    <td className="p-4 font-medium text-[var(--text-light)] dark:text-[var(--text-dark)]">
                                        ₹{record.amount}
                                    </td>
                                    <td className="p-4">
                                        <StatusPill status={record.status} />
                                    </td>
                                    <td className="p-4 text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                                        {record.transactionDate ? new Date(record.transactionDate).toLocaleDateString() : '-'}
                                    </td>
                                    <td className="p-4">
                                        {!isAdmin && record.status === MaintenanceStatus.Pending && (
                                            <Button size="sm" onClick={() => handlePayClick(record)} leftIcon={<CurrencyRupeeIcon className="w-4 h-4"/>}>Pay Now</Button>
                                        )}
                                        {isAdmin && record.status === MaintenanceStatus.Submitted && (
                                            <Button size="sm" onClick={() => handleVerifyClick(record)}>Verify</Button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </Card>

            {/* Resident Payment Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Submit Payment">
                <form className="space-y-4" onSubmit={handlePaymentSubmit}>
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
        </div>
    );
};

export default Maintenance;
