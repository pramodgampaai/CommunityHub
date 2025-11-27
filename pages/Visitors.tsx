
import React, { useState, useEffect } from 'react';
import { createVisitor, getVisitors, updateVisitorStatus } from '../services/api';
import type { Visitor } from '../types';
import { VisitorStatus, UserRole } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import { PlusIcon, CheckCircleIcon, XIcon, ClockIcon } from '../components/icons';
import { useScreen } from '../hooks/useScreen';
import { useAuth } from '../hooks/useAuth';

const StatusPill: React.FC<{ status: VisitorStatus }> = ({ status }) => {
    const statusStyles: Record<VisitorStatus, string> = {
        [VisitorStatus.Expected]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
        [VisitorStatus.Arrived]: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
        [VisitorStatus.Departed]: 'bg-gray-100 text-gray-800 dark:bg-gray-700/40 dark:text-gray-300',
        [VisitorStatus.PendingApproval]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
        [VisitorStatus.Denied]: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    };
    return <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusStyles[status]}`}>{status}</span>;
}

const VisitorSkeleton: React.FC<{ isMobile: boolean }> = ({ isMobile }) => {
    if (isMobile) {
        return (
            <div className="p-4 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse">
                <div className="flex justify-between items-start gap-4">
                    <div className="space-y-2 flex-1">
                        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
                    </div>
                    <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                </div>
            </div>
        );
    }
    return (
        <tr className="animate-pulse">
            <td className="p-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div></td>
            <td className="p-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div></td>
            <td className="p-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div></td>
            <td className="p-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div></td>
            <td className="p-4"><div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full"></div></td>
        </tr>
    );
};

const Visitors: React.FC = () => {
    const [visitors, setVisitors] = useState<Visitor[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { isMobile } = useScreen();
    const { user } = useAuth();
    
    // Form State
    const [visitorName, setVisitorName] = useState('');
    const [purpose, setPurpose] = useState('');
    const [expectedTime, setExpectedTime] = useState('');
    const [targetFlat, setTargetFlat] = useState(''); // Only for Security
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Confirmation State (Approve/Reject)
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
            const data = await getVisitors(communityId);
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
        }
    }, [user]);
    
    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setIsSubmitting(true);
        try {
            await createVisitor({ 
                name: visitorName, 
                purpose, 
                expectedAt: new Date(expectedTime).toISOString(),
                targetFlat: targetFlat || undefined 
            }, user);
            
            setIsModalOpen(false);
            setVisitorName('');
            setPurpose('');
            setExpectedTime('');
            setTargetFlat('');
            await fetchVisitors(user.communityId); // Refresh list
        } catch (error: any) {
            console.error("Failed to create visitor:", error);
            // Robust error message extraction to prevent [object Object]
            let errorMessage = "Please check flat number.";
            
            if (error?.code === '42501') {
                errorMessage = "Permission denied. Please ask Super Admin to update database policies for Security Admin role.";
            } else if (error && typeof error === 'object' && error.message) {
                 errorMessage = error.message;
            } else if (typeof error === 'string') {
                 errorMessage = error;
            }
            alert("Failed to add visitor: " + errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

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
            message: `Do you want to deny entry to ${visitor.name}? Security will be notified.`,
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
            console.error("Action error:", error);
            alert("Action failed. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Filter Logic: Residents only see their own. Security/Admins see all.
    const filteredVisitors = visitors.filter(v => {
        if (user?.role === UserRole.Resident) {
            return v.userId === user.id;
        }
        // Admin, SecurityAdmin, Security see all
        return true;
    });

    const isSecurityOrAdmin = user?.role === UserRole.Security || user?.role === UserRole.SecurityAdmin || user?.role === UserRole.Admin;
    const canAddVisitor = user?.role !== UserRole.HelpdeskAgent;

    const renderVisitorList = () => {
        if (loading) {
            if (isMobile) {
                return <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <VisitorSkeleton key={i} isMobile={isMobile} />)}</div>;
            }
            return (
                 <Card className="overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-black/5 dark:bg-white/5">
                            <tr>
                                <th className="p-4 font-medium text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Name</th>
                                <th className="p-4 font-medium text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Flat No.</th>
                                <th className="p-4 font-medium text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Purpose</th>
                                <th className="p-4 font-medium text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Expected At</th>
                                <th className="p-4 font-medium text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Status</th>
                                {user?.role === UserRole.Resident && <th className="p-4 font-medium text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] text-right">Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {Array.from({ length: 5 }).map((_, i) => <VisitorSkeleton key={i} isMobile={isMobile} />)}
                        </tbody>
                    </table>
                </Card>
            );
        }

        if (filteredVisitors.length === 0) {
            return (
                <div className="p-8 text-center text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] border-2 border-dashed border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-xl">
                    No visitors found.
                </div>
            );
        }

        if (isMobile) {
            return (
                <div className="space-y-4">
                    {filteredVisitors.map((visitor, index) => (
                        <Card key={visitor.id} className="p-4 animated-card" style={{ animationDelay: `${index * 100}ms` }}>
                            <div className="flex justify-between items-start gap-4">
                                <div>
                                    <h3 className="font-semibold text-lg text-[var(--text-light)] dark:text-[var(--text-dark)]">{visitor.name}</h3>
                                    <p className="text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">For {visitor.flatNumber}</p>
                                    <p className="text-sm mt-2 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">{visitor.purpose}</p>
                                </div>
                                <StatusPill status={visitor.status} />
                            </div>
                            <div className="flex justify-between items-center mt-3 pt-3 border-t border-[var(--border-light)] dark:border-[var(--border-dark)]">
                                <p className="text-xs text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                                    {new Date(visitor.expectedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                </p>
                                {user?.role === UserRole.Resident && visitor.status === VisitorStatus.PendingApproval && (
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => handleReject(visitor)}
                                            className="p-1.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                                            title="Deny"
                                        >
                                            <XIcon className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => handleApprove(visitor)}
                                            className="p-1.5 rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                                            title="Approve"
                                        >
                                            <CheckCircleIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </Card>
                    ))}
                </div>
            );
        }

        return (
            <Card className="overflow-x-auto animated-card" style={{ animationDelay: '100ms' }}>
                <table className="w-full text-left whitespace-nowrap">
                    <thead className="bg-black/5 dark:bg-white/5">
                        <tr>
                            <th className="p-4 font-medium text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Name</th>
                            <th className="p-4 font-medium text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Flat No.</th>
                            <th className="p-4 font-medium text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Purpose</th>
                            <th className="p-4 font-medium text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Expected At</th>
                            <th className="p-4 font-medium text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Status</th>
                            {user?.role === UserRole.Resident && <th className="p-4 font-medium text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] text-right">Actions</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-light)] dark:divide-[var(--border-dark)]">
                        {filteredVisitors.map((visitor) => (
                            <tr key={visitor.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                <td className="p-4 font-medium text-[var(--text-light)] dark:text-[var(--text-dark)]">{visitor.name}</td>
                                <td className="p-4 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">{visitor.flatNumber}</td>
                                <td className="p-4 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">{visitor.purpose}</td>
                                <td className="p-4 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">{new Date(visitor.expectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                <td className="p-4"><StatusPill status={visitor.status} /></td>
                                {user?.role === UserRole.Resident && (
                                    <td className="p-4 text-right">
                                        {visitor.status === VisitorStatus.PendingApproval && (
                                            <div className="flex justify-end gap-2">
                                                <button 
                                                    onClick={() => handleReject(visitor)}
                                                    className="p-1.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 transition-colors"
                                                    title="Deny"
                                                >
                                                    <XIcon className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => handleApprove(visitor)}
                                                    className="p-1.5 rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 transition-colors"
                                                    title="Approve"
                                                >
                                                    <CheckCircleIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center animated-card">
                <h2 className="text-2xl font-bold text-[var(--text-light)] dark:text-[var(--text-dark)]">Visitor Management</h2>
                {canAddVisitor && (
                    <Button onClick={() => setIsModalOpen(true)} leftIcon={<PlusIcon className="w-5 h-5" />} aria-label="Add New Visitor" variant="fab">
                        <span className="hidden sm:inline">New Visitor</span>
                        <span className="sm:hidden">New</span>
                    </Button>
                )}
            </div>
            
            {renderVisitorList()}

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Visitor">
                <form className="space-y-4" onSubmit={handleFormSubmit}>
                    
                    {/* Security must enter flat number */}
                    {isSecurityOrAdmin && (
                         <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md mb-2 border border-yellow-100 dark:border-yellow-900/30">
                            <p className="text-xs text-yellow-800 dark:text-yellow-200 flex items-start gap-2">
                                <ClockIcon className="w-4 h-4 flex-shrink-0" />
                                Visitors added by security will require resident approval.
                            </p>
                        </div>
                    )}

                    {isSecurityOrAdmin && (
                        <div>
                            <label htmlFor="targetFlat" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Resident Flat No. <span className="text-red-500">*</span></label>
                            <input type="text" id="targetFlat" value={targetFlat} onChange={e => setTargetFlat(e.target.value)} required placeholder="e.g. A-101" className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] sm:text-sm bg-transparent"/>
                        </div>
                    )}

                    <div>
                        <label htmlFor="visitorName" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Visitor Name <span className="text-red-500">*</span></label>
                        <input type="text" id="visitorName" value={visitorName} onChange={e => setVisitorName(e.target.value)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] sm:text-sm bg-transparent"/>
                    </div>
                    <div>
                        <label htmlFor="purpose" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Purpose of Visit <span className="text-red-500">*</span></label>
                        <input type="text" id="purpose" value={purpose} onChange={e => setPurpose(e.target.value)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] sm:text-sm bg-transparent"/>
                    </div>
                    <div>
                        <label htmlFor="expectedTime" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Expected Time <span className="text-red-500">*</span></label>
                        <input type="datetime-local" id="expectedTime" value={expectedTime} onChange={e => setExpectedTime(e.target.value)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] sm:text-sm bg-transparent"/>
                    </div>
                    <div className="flex justify-end pt-4 space-x-2">
                        <Button type="button" variant="outlined" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Adding...' : 'Add Visitor'}</Button>
                    </div>
                </form>
            </Modal>

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
        </div>
    );
};

export default Visitors;
