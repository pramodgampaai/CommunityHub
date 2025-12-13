
import React, { useState, useEffect } from 'react';
import { createVisitor, getVisitors, updateVisitorStatus, verifyVisitorEntry, checkOutVisitor } from '../services/api';
import type { Visitor } from '../types';
import { VisitorStatus, UserRole, VisitorType } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import AuditLogModal from '../components/AuditLogModal';
import QRScanner from '../components/ui/QRScanner';
import { PlusIcon, CheckCircleIcon, XIcon, ClockIcon, HistoryIcon, FunnelIcon, MagnifyingGlassIcon } from '../components/icons';
import { useScreen } from '../hooks/useScreen';
import { useAuth } from '../hooks/useAuth';

const StatusPill: React.FC<{ status: VisitorStatus }> = ({ status }) => {
    const statusStyles: Record<VisitorStatus, string> = {
        [VisitorStatus.Expected]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
        [VisitorStatus.CheckedIn]: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
        [VisitorStatus.CheckedOut]: 'bg-gray-100 text-gray-800 dark:bg-gray-700/40 dark:text-gray-300',
        [VisitorStatus.PendingApproval]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
        [VisitorStatus.Denied]: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
        [VisitorStatus.Expired]: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
    };
    return <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusStyles[status]}`}>{status}</span>;
}

const Visitors: React.FC = () => {
    const { user } = useAuth();
    
    // Default Tab Logic
    const getDefaultTab = () => {
        if (user?.role === UserRole.Security || user?.role === UserRole.SecurityAdmin) return 'gate_pass';
        return 'my_visitors';
    };

    const [visitors, setVisitors] = useState<Visitor[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { isMobile } = useScreen();
    const [isAuditOpen, setIsAuditOpen] = useState(false);
    
    // View Controls
    const [activeTab, setActiveTab] = useState<'my_visitors' | 'gate_pass'>(getDefaultTab());
    
    // Security Dashboard State
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<VisitorStatus | 'All'>('All');
    
    // QR Code Modal
    const [isQRModalOpen, setIsQRModalOpen] = useState(false);
    const [selectedVisitorForQR, setSelectedVisitorForQR] = useState<Visitor | null>(null);

    // Verify Modal (Security)
    const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
    const [manualEntryToken, setManualEntryToken] = useState('');
    const [verificationResult, setVerificationResult] = useState<{success: boolean, message: string} | null>(null);
    const [isScanning, setIsScanning] = useState(false);

    // Form State
    const [visitorName, setVisitorName] = useState('');
    const [visitorType, setVisitorType] = useState<VisitorType>(VisitorType.Guest);
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [purpose, setPurpose] = useState('');
    const [expectedTime, setExpectedTime] = useState('');
    const [targetFlat, setTargetFlat] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Confirmation State
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
    
    const fetchVisitors = async (communityId: string) => {
        try {
            setLoading(true);
            const data = await getVisitors(communityId, user?.role);
            setVisitors(data);
        } catch (error) {
            console.error("Failed to fetch visitors", error);
        } finally {
            setLoading(false);
        }
    };
    
    useEffect(() => {
        if (user?.communityId) {
            fetchVisitors(user.communityId);
            if (user.role === UserRole.Security || user.role === UserRole.SecurityAdmin) {
                setActiveTab('gate_pass');
                // Security Staff primarily want to see who is expected
                setStatusFilter(VisitorStatus.Expected);
            } else {
                // Ensure residents land on my_visitors if they navigate back
                if (activeTab === 'gate_pass' && user.role === UserRole.Resident) {
                    setActiveTab('my_visitors');
                }
            }
        }
    }, [user]);
    
    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setIsSubmitting(true);
        try {
            const newVisitor = await createVisitor({ 
                name: visitorName,
                visitorType,
                vehicleNumber,
                purpose, 
                expectedAt: new Date(expectedTime).toISOString(),
                targetFlat: targetFlat || undefined 
            }, user);
            
            setIsModalOpen(false);
            resetForm();
            await fetchVisitors(user.communityId); 
            
            if (user.role === UserRole.Resident) {
                setSelectedVisitorForQR(newVisitor);
                setIsQRModalOpen(true);
            }

        } catch (error: any) {
            console.error("Failed to create visitor:", error);
            alert("Failed to add visitor: " + (error.message || "Unknown Error"));
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setVisitorName('');
        setVisitorType(VisitorType.Guest);
        setVehicleNumber('');
        setPurpose('');
        setExpectedTime('');
        setTargetFlat('');
    }

    // --- Actions ---

    const handleCheckIn = (visitor: Visitor) => {
        setSelectedVisitorForQR(visitor);
        setManualEntryToken('');
        setVerificationResult(null);
        setIsScanning(false);
        setIsVerifyModalOpen(true);
    }

    const handleGlobalScan = () => {
        setSelectedVisitorForQR(null); // No specific visitor selected
        setManualEntryToken('');
        setVerificationResult(null);
        setIsScanning(true); // Auto-start camera
        setIsVerifyModalOpen(true);
    }

    // Generic function to process verification (used by Manual and Scan)
    const performVerification = async (visitorId: string, token: string) => {
        setIsSubmitting(true);
        setVerificationResult(null);

        try {
            await verifyVisitorEntry(visitorId, token, user!);
            setVerificationResult({ success: true, message: "Entry Verified & Approved!" });
            
            // Refresh list after brief delay
            setTimeout(async () => {
                await fetchVisitors(user?.communityId!);
                setIsVerifyModalOpen(false);
                setManualEntryToken('');
                setVerificationResult(null);
                setIsScanning(false);
                setSelectedVisitorForQR(null);
            }, 1500);

        } catch (error: any) {
            setVerificationResult({ success: false, message: error.message || "Invalid Token" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleVerifySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        // Logic for manual entry depends on context
        if (selectedVisitorForQR) {
             await performVerification(selectedVisitorForQR.id, manualEntryToken);
        } else {
             // If global manual entry, we can't verify easily without ID. 
             // We'll enforce using the list for Manual Entry if not scanning.
             // OR we could support Token-only lookup if backend supported it, but currently we need ID.
             alert("For manual entry, please select the visitor from the list.");
        }
    }

    const handleScanResult = (data: string) => {
        if (!data) return;
        
        try {
            setIsScanning(false); // Stop scanning immediately
            
            // Expected format: JSON { id: "visitor_id", token: "entry_token" }
            const parsed = JSON.parse(data);
            
            if (parsed.id && parsed.token) {
                if (selectedVisitorForQR && parsed.id !== selectedVisitorForQR.id) {
                     setVerificationResult({ success: false, message: "Scanned QR belongs to a different visitor!" });
                     return;
                }
                performVerification(parsed.id, parsed.token);
            } else {
                setVerificationResult({ success: false, message: "Invalid QR Format" });
            }
        } catch (e) {
            setIsScanning(false);
            console.error("Scan parse error", e);
            setVerificationResult({ success: false, message: "Could not read QR data." });
        }
    };

    const handleCheckOut = (visitor: Visitor) => {
        setConfirmConfig({
            isOpen: true,
            title: "Check Out Visitor",
            message: `${visitor.name} is leaving. Confirm exit?`,
            confirmLabel: "Check Out",
            isDestructive: false,
            action: async () => {
                await checkOutVisitor(visitor.id, user!);
                await fetchVisitors(user?.communityId!);
            }
        });
    }

    const handleApprove = (visitor: Visitor) => {
        setConfirmConfig({
            isOpen: true,
            title: "Approve Visitor",
            message: `Do you want to allow ${visitor.name} to enter?`,
            confirmLabel: "Approve",
            isDestructive: false,
            action: async () => {
                await updateVisitorStatus(visitor.id, VisitorStatus.Expected);
                await fetchVisitors(user?.communityId!);
            }
        });
    }

    const handleReject = (visitor: Visitor) => {
         setConfirmConfig({
            isOpen: true,
            title: "Deny Entry",
            message: `Do you want to deny entry to ${visitor.name}?`,
            confirmLabel: "Deny",
            isDestructive: true,
            action: async () => {
                await updateVisitorStatus(visitor.id, VisitorStatus.Denied);
                await fetchVisitors(user?.communityId!);
            }
        });
    }

    const handleConfirmAction = async () => {
        setIsSubmitting(true);
        try {
            await confirmConfig.action();
            setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        } catch (error: any) {
            alert("Action failed: " + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredVisitors = visitors.filter(v => {
        if (activeTab === 'my_visitors') {
            if (user?.role === UserRole.Resident && v.userId !== user.id) return false;
        }
        
        if (activeTab === 'gate_pass') {
            // Combined Logic: Search AND Filter
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const matchesSearch = (
                    v.flatNumber.toLowerCase().includes(q) || 
                    (v.vehicleNumber && v.vehicleNumber.toLowerCase().includes(q)) ||
                    v.name.toLowerCase().includes(q)
                );
                if (!matchesSearch) return false;
            }
            
            if (statusFilter !== 'All') {
                if (v.status !== statusFilter) return false;
            }
        }
        
        return true;
    });

    const isSecurity = user?.role === UserRole.Security || user?.role === UserRole.SecurityAdmin;
    const canManage = isSecurity || user?.role === UserRole.Admin;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animated-card">
                <div>
                    <h2 className="text-2xl font-bold text-[var(--text-light)] dark:text-[var(--text-dark)]">Visitor Management</h2>
                    <p className="text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                        {activeTab === 'gate_pass' ? 'Security Gate Dashboard' : 'Manage your guests and invites'}
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
                    
                    {isSecurity && (
                        <Button 
                            onClick={handleGlobalScan} 
                            variant="outlined"
                            className="border-brand-500 text-brand-500 hover:bg-brand-50"
                        >
                            Scan Pass
                        </Button>
                    )}

                    <Button onClick={() => setIsModalOpen(true)} leftIcon={<PlusIcon className="w-5 h-5" />} aria-label="Add New Visitor" variant="fab">
                        <span className="hidden sm:inline">Invite Visitor</span>
                        <span className="sm:hidden">Invite</span>
                    </Button>
                </div>
            </div>

            {canManage && (
                <div className="border-b border-[var(--border-light)] dark:border-[var(--border-dark)]">
                    <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                        {user?.role !== UserRole.Security && (
                            <button
                                onClick={() => setActiveTab('my_visitors')}
                                className={`${activeTab === 'my_visitors' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-secondary-light)] hover:text-[var(--text-light)] hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                            >
                                My Visitors
                            </button>
                        )}
                        <button
                            onClick={() => setActiveTab('gate_pass')}
                            className={`${activeTab === 'gate_pass' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-secondary-light)] hover:text-[var(--text-light)] hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                        >
                            Gate Dashboard
                        </button>
                    </nav>
                </div>
            )}

            {activeTab === 'gate_pass' && (
                <div className="flex flex-col md:flex-row gap-4 bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] p-4 rounded-xl border border-[var(--border-light)] dark:border-[var(--border-dark)] animated-card">
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <MagnifyingGlassIcon className="h-5 w-5 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search Flat (A-101), Vehicle, or Name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-lg bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                        />
                    </div>
                    <div className="relative w-full md:w-48">
                        <select 
                            value={statusFilter} 
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            className="appearance-none bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] border border-[var(--border-light)] dark:border-[var(--border-dark)] text-sm rounded-lg block w-full pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                        >
                            <option value="All">All Status</option>
                            <option value={VisitorStatus.Expected}>Expected Today</option>
                            <option value={VisitorStatus.CheckedIn}>Checked In</option>
                            <option value={VisitorStatus.CheckedOut}>Checked Out</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                            <FunnelIcon className="w-4 h-4" />
                        </div>
                    </div>
                </div>
            )}
            
            {/* List View */}
            <div className="space-y-4">
                {loading ? (
                    <div className="p-8 text-center"><p>Loading...</p></div>
                ) : filteredVisitors.length === 0 ? (
                    <div className="p-12 text-center text-[var(--text-secondary-light)] border-2 border-dashed border-[var(--border-light)] rounded-xl">
                        No visitors found matching current filters.
                    </div>
                ) : (
                    filteredVisitors.map((visitor, index) => (
                        <Card key={visitor.id} className="p-4 animated-card" style={{ animationDelay: `${index * 50}ms` }}>
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-bold text-lg text-[var(--text-light)] dark:text-[var(--text-dark)]">{visitor.name}</h3>
                                        <span className="text-xs uppercase font-bold text-[var(--text-secondary-light)] bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                                            {visitor.visitorType}
                                        </span>
                                    </div>
                                    
                                    <div className="text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] space-y-1">
                                        <p>Visiting: <span className="font-medium text-[var(--text-light)] dark:text-[var(--text-dark)]">{visitor.flatNumber}</span> ({visitor.residentName})</p>
                                        {visitor.vehicleNumber && <p>Vehicle: {visitor.vehicleNumber}</p>}
                                        <p className="flex items-center gap-1">
                                            <ClockIcon className="w-3.5 h-3.5" /> 
                                            {visitor.entryTime ? 
                                                `Entered: ${new Date(visitor.entryTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}` : 
                                                `Expected: ${new Date(visitor.expectedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`
                                            }
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-col items-end gap-3">
                                    <StatusPill status={visitor.status} />
                                    
                                    {activeTab === 'my_visitors' && (
                                        <div className="flex gap-2">
                                            {visitor.status === VisitorStatus.Expected && (
                                                <Button size="sm" variant="outlined" onClick={() => {
                                                    setSelectedVisitorForQR(visitor);
                                                    setIsQRModalOpen(true);
                                                }}>
                                                    Show QR
                                                </Button>
                                            )}
                                            {visitor.status === VisitorStatus.PendingApproval && (
                                                <>
                                                    <Button size="sm" variant="outlined" onClick={() => handleReject(visitor)} className="border-red-500 text-red-500 hover:bg-red-50">Deny</Button>
                                                    <Button size="sm" onClick={() => handleApprove(visitor)}>Approve</Button>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {activeTab === 'gate_pass' && (
                                        <div className="flex gap-2">
                                            {visitor.status === VisitorStatus.Expected && (
                                                <Button size="sm" onClick={() => handleCheckIn(visitor)}>
                                                    Verify Entry
                                                </Button>
                                            )}
                                            {visitor.status === VisitorStatus.CheckedIn && (
                                                <Button size="sm" variant="outlined" onClick={() => handleCheckOut(visitor)} className="border-orange-500 text-orange-500 hover:bg-orange-50">
                                                    Check Out
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>
                    ))
                )}
            </div>

            {/* Create Visitor Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Invite Visitor">
                <form className="space-y-4" onSubmit={handleFormSubmit}>
                    {canManage && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded text-xs text-yellow-800 dark:text-yellow-200 border border-yellow-100 dark:border-yellow-900/30">
                            Security Note: Creating a visitor here will mark them as "Pending Approval" until the resident confirms, or you can auto-approve if authorized.
                        </div>
                    )}
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Visitor Name</label>
                        <input type="text" id="name" value={visitorName} onChange={e => setVisitorName(e.target.value)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"/>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Type</label>
                            <select value={visitorType} onChange={e => setVisitorType(e.target.value as VisitorType)} className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-[var(--bg-light)] dark:bg-[var(--bg-dark)]">
                                {Object.values(VisitorType).map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="vehicle" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Vehicle No. (Optional)</label>
                            <input type="text" id="vehicle" value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"/>
                        </div>
                    </div>

                    {canManage && (
                        <div>
                            <label htmlFor="flat" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Visiting Flat</label>
                            <input type="text" id="flat" value={targetFlat} onChange={e => setTargetFlat(e.target.value)} placeholder="e.g. A-101" required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"/>
                        </div>
                    )}

                    <div>
                        <label htmlFor="time" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Expected Time</label>
                        <input type="datetime-local" id="time" value={expectedTime} onChange={e => setExpectedTime(e.target.value)} required min={new Date().toISOString().slice(0, 16)} className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"/>
                    </div>
                    <div>
                        <label htmlFor="purpose" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Purpose</label>
                        <input type="text" id="purpose" value={purpose} onChange={e => setPurpose(e.target.value)} required placeholder="e.g. Personal visit, Delivery" className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"/>
                    </div>
                    <div className="flex justify-end pt-4 space-x-2">
                        <Button type="button" variant="outlined" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Sending...' : 'Send Invite'}</Button>
                    </div>
                </form>
            </Modal>

            {/* QR Code Modal (Resident) */}
            <Modal isOpen={isQRModalOpen} onClose={() => setIsQRModalOpen(false)} title="Entry Pass">
                <div className="flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-lg">
                    {selectedVisitorForQR && (
                        <>
                            <div className="mb-4 text-center">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{selectedVisitorForQR.name}</h3>
                                <p className="text-sm text-gray-500">{selectedVisitorForQR.visitorType} • {new Date(selectedVisitorForQR.expectedAt).toLocaleDateString()}</p>
                            </div>
                            <div className="p-4 bg-white rounded-xl shadow-inner border border-gray-200">
                                <img 
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(JSON.stringify({ id: selectedVisitorForQR.id, token: selectedVisitorForQR.entryToken }))}`} 
                                    alt="Entry QR Code" 
                                    className="w-48 h-48"
                                />
                            </div>
                            <div className="mt-6 text-center">
                                <p className="text-xs text-gray-400 uppercase font-bold tracking-widest mb-1">Entry Token</p>
                                <p className="text-2xl font-mono font-bold tracking-wider text-[var(--accent)] bg-gray-100 dark:bg-gray-700 px-4 py-2 rounded-lg">
                                    {selectedVisitorForQR.entryToken || '------'}
                                </p>
                            </div>
                            <p className="mt-6 text-xs text-center text-gray-400 max-w-xs">
                                Share this QR code or token with the security guard at the gate for entry.
                            </p>
                        </>
                    )}
                </div>
                <div className="p-4 border-t border-[var(--border-light)] dark:border-[var(--border-dark)] flex justify-center">
                    <Button onClick={() => setIsQRModalOpen(false)}>Close</Button>
                </div>
            </Modal>

            {/* Verify Entry Modal (Security) */}
            <Modal isOpen={isVerifyModalOpen} onClose={() => { setIsVerifyModalOpen(false); setIsScanning(false); }} title="Verify Visitor Entry">
                <div className="space-y-4">
                    {selectedVisitorForQR ? (
                        <div className="bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] p-3 rounded-lg border border-[var(--border-light)] dark:border-[var(--border-dark)] flex justify-between items-center">
                            <div>
                                <p className="text-xs text-[var(--text-secondary-light)] uppercase font-bold">Verifying</p>
                                <p className="font-bold text-[var(--text-light)] dark:text-[var(--text-dark)]">{selectedVisitorForQR.name}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-[var(--text-secondary-light)]">{selectedVisitorForQR.visitorType}</p>
                                <p className="text-xs font-mono">{selectedVisitorForQR.vehicleNumber || 'No Vehicle'}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-900/30 text-center">
                            <p className="text-sm font-bold text-blue-800 dark:text-blue-200">Global Scan Mode</p>
                            <p className="text-xs text-blue-600 dark:text-blue-300">Scan any visitor pass to verify.</p>
                        </div>
                    )}

                    {/* Result Feedback */}
                    {verificationResult && (
                        <div className={`p-4 rounded-lg flex items-start gap-3 ${verificationResult.success ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'}`}>
                            {verificationResult.success ? <CheckCircleIcon className="w-5 h-5 flex-shrink-0" /> : <XIcon className="w-5 h-5 flex-shrink-0" />}
                            <div>
                                <p className="font-bold text-sm">{verificationResult.success ? 'Success' : 'Verification Failed'}</p>
                                <p className="text-xs mt-1">{verificationResult.message}</p>
                            </div>
                        </div>
                    )}

                    {/* Switcher */}
                    {!verificationResult && (
                        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg mb-4">
                            <button 
                                type="button"
                                onClick={() => setIsScanning(true)}
                                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${isScanning ? 'bg-white dark:bg-gray-700 shadow-sm text-[var(--accent)]' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Scan QR
                            </button>
                            <button 
                                type="button"
                                onClick={() => setIsScanning(false)}
                                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${!isScanning ? 'bg-white dark:bg-gray-700 shadow-sm text-[var(--accent)]' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Manual Entry
                            </button>
                        </div>
                    )}

                    {/* Scan Mode */}
                    {isScanning && !verificationResult ? (
                        <QRScanner 
                            onScan={handleScanResult} 
                            onClose={() => setIsScanning(false)} 
                        />
                    ) : !verificationResult ? (
                        /* Manual Mode */
                        <form onSubmit={handleVerifySubmit} className="space-y-4">
                            {!selectedVisitorForQR && (
                                <p className="text-sm text-red-500">Manual entry via token is only available when verifying a specific visitor from the list.</p>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Enter Token</label>
                                <input 
                                    type="text" 
                                    value={manualEntryToken} 
                                    onChange={e => setManualEntryToken(e.target.value.toUpperCase())} 
                                    placeholder="Enter 6-char token"
                                    disabled={!selectedVisitorForQR}
                                    className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent font-mono text-center tracking-widest uppercase text-lg disabled:opacity-50"
                                    maxLength={6}
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={isSubmitting || manualEntryToken.length < 3 || !selectedVisitorForQR}>
                                {isSubmitting ? 'Verifying...' : 'Verify Entry'}
                            </Button>
                        </form>
                    ) : null}
                </div>
            </Modal>

            {/* Confirmation Modal */}
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

            <AuditLogModal
                isOpen={isAuditOpen}
                onClose={() => setIsAuditOpen(false)}
                entityType="Visitor"
                title="Visitor Log History"
            />
        </div>
    );
};

export default Visitors;
