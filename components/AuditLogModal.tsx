
import React, { useState, useEffect } from 'react';
import { getAuditLogs } from '../services/api';
import type { AuditLog, AuditAction } from '../types';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { MagnifyingGlassIcon, FunnelIcon, ClipboardDocumentListIcon, ClockIcon } from './icons';
import { useAuth } from '../hooks/useAuth';
import { useScreen } from '../hooks/useScreen';

interface AuditLogModalProps {
    isOpen: boolean;
    onClose: () => void;
    entityType: string | string[]; // The context (e.g., 'Notice', or ['Amenity', 'Booking'])
    title?: string;
}

const ActionBadge: React.FC<{ action: AuditAction }> = ({ action }) => {
    const styles = {
        'CREATE': 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
        'UPDATE': 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
        'DELETE': 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    };
    return <span className={`px-2 py-0.5 text-xs font-bold rounded uppercase tracking-wider ${styles[action]}`}>{action}</span>;
}

const AuditLogModal: React.FC<AuditLogModalProps> = ({ isOpen, onClose, entityType, title }) => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const { isMobile } = useScreen();

    // Filters
    const [filterAction, setFilterAction] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

    const fetchLogs = async () => {
        if (!user?.communityId || !isOpen) return;
        try {
            setLoading(true);
            const data = await getAuditLogs(user.communityId, user.id, user.role);
            // Client-side filter by entity type(s)
            const entities = Array.isArray(entityType) ? entityType : [entityType];
            const relevantLogs = data.filter(log => entities.includes(log.entity));
            setLogs(relevantLogs);
        } catch (error) {
            console.error("Failed to fetch audit logs", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [isOpen, user]);

    // Internal Filtering
    const filteredLogs = logs.filter(log => {
        if (filterAction !== 'All' && log.action !== filterAction) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return (
                log.details.description?.toLowerCase().includes(q) ||
                log.actorName?.toLowerCase().includes(q)
            );
        }
        return true;
    });

    // Render Diff Logic
    const renderDiff = (oldData: any, newData: any) => {
        if (!oldData && !newData) return <p className="text-gray-500 italic">No data details captured.</p>;

        const allKeys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);
        const ignoredFields = ['created_at', 'updated_at', 'id', 'community_id', 'user_id', 'author', 'assigned_to_name', 'resident_name', 'submitted_by_name', 'approved_by_name', 'payment_receipt_url', 'receipt_url', 'image_url'];

        const changes: { key: string, oldVal: any, newVal: any }[] = [];

        allKeys.forEach(key => {
            if (ignoredFields.includes(key)) return;
            // eslint-disable-next-line eqeqeq
            if (oldData?.[key] != newData?.[key]) {
                changes.push({ key, oldVal: oldData?.[key], newVal: newData?.[key] });
            }
        });

        if (changes.length === 0 && (oldData || newData)) {
             return (
                 <div className="bg-gray-50 dark:bg-white/5 p-3 rounded font-mono text-xs overflow-x-auto">
                     <pre>{JSON.stringify(newData || oldData, null, 2)}</pre>
                 </div>
             )
        }

        return (
            <div className="space-y-2">
                {changes.map(({ key, oldVal, newVal }) => (
                    <div key={key} className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm border-b border-gray-100 dark:border-gray-800 pb-2 last:border-0">
                        <div className="font-semibold text-gray-500 capitalize">{key.replace(/_/g, ' ')}</div>
                        <div className="break-all bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-1.5 rounded">
                            {oldVal === undefined || oldVal === null ? <span className="italic opacity-50">Empty</span> : String(oldVal)}
                        </div>
                        <div className="break-all bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 p-1.5 rounded">
                            {newVal === undefined || newVal === null ? <span className="italic opacity-50">Deleted</span> : String(newVal)}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    // Sub-render: Detail View
    if (selectedLog) {
        return (
            <Modal isOpen={true} onClose={() => setSelectedLog(null)} title="Audit Details" size="lg">
                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b border-[var(--border-light)] dark:border-[var(--border-dark)]">
                        <div>
                            <h3 className="text-lg font-bold text-[var(--text-light)] dark:text-[var(--text-dark)]">{selectedLog.details.description}</h3>
                            <div className="flex items-center gap-2 mt-1 text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                                <ClockIcon className="w-4 h-4" />
                                <span>{new Date(selectedLog.createdAt).toLocaleString()}</span>
                            </div>
                        </div>
                        <ActionBadge action={selectedLog.action} />
                    </div>

                    <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-white/5 p-4 rounded-lg">
                        <div>
                            <p className="text-xs text-[var(--text-secondary-light)] uppercase font-bold">Performed By</p>
                            <p className="font-medium">{selectedLog.actorName}</p>
                            <p className="text-xs text-[var(--text-secondary-light)]">{selectedLog.actorRole}</p>
                        </div>
                        <div>
                            <p className="text-xs text-[var(--text-secondary-light)] uppercase font-bold">Module ID</p>
                            <p className="font-mono text-sm">{selectedLog.entity}: {selectedLog.entityId.substring(0, 8)}...</p>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-sm font-bold uppercase mb-3 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Data Changes</h4>
                        {selectedLog.action === 'CREATE' ? (
                            <div className="bg-gray-50 dark:bg-white/5 p-3 rounded font-mono text-xs overflow-x-auto border border-green-200 dark:border-green-900/30">
                                <p className="text-green-700 dark:text-green-400 mb-1 font-sans font-bold">New Record Created:</p>
                                <pre>{JSON.stringify(selectedLog.details.new, null, 2)}</pre>
                            </div>
                        ) : selectedLog.action === 'DELETE' ? (
                            <div className="bg-gray-50 dark:bg-white/5 p-3 rounded font-mono text-xs overflow-x-auto border border-red-200 dark:border-red-900/30">
                                <p className="text-red-700 dark:text-red-400 mb-1 font-sans font-bold">Record Deleted. Previous Data:</p>
                                <pre>{JSON.stringify(selectedLog.details.old, null, 2)}</pre>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-black/20 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-lg p-4">
                                {renderDiff(selectedLog.details.old, selectedLog.details.new)}
                            </div>
                        )}
                    </div>
                    <div className="flex justify-end pt-2">
                        <Button onClick={() => setSelectedLog(null)}>Back to List</Button>
                    </div>
                </div>
            </Modal>
        );
    }

    // Main List View
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title || "Audit History"} size="xl">
            <div className="space-y-4">
                {/* Search & Filter Bar */}
                <div className="flex gap-4">
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <MagnifyingGlassIcon className="h-4 w-4 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search logs..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full pl-9 pr-3 py-2 text-sm border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-lg bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                        />
                    </div>
                    <div className="relative w-32 sm:w-40">
                        <select 
                            value={filterAction} 
                            onChange={(e) => setFilterAction(e.target.value)}
                            className="appearance-none bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] border border-[var(--border-light)] dark:border-[var(--border-dark)] text-sm rounded-lg block w-full pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                        >
                            <option value="All">All Actions</option>
                            <option value="CREATE">Create</option>
                            <option value="UPDATE">Update</option>
                            <option value="DELETE">Delete</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                            <FunnelIcon className="w-3 h-3" />
                        </div>
                    </div>
                </div>

                {/* List Content */}
                <div className="min-h-[300px] max-h-[60vh] overflow-y-auto border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-lg">
                    {loading ? (
                        <div className="p-4 space-y-4">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded animate-pulse"></div>
                            ))}
                        </div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-[var(--text-secondary-light)]">
                            <ClipboardDocumentListIcon className="w-10 h-10 mb-2 opacity-20" />
                            <p>No records found.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-black/5 dark:bg-white/5 sticky top-0 backdrop-blur-sm">
                                <tr>
                                    <th className="p-3 font-semibold text-[var(--text-secondary-light)]">Time</th>
                                    <th className="p-3 font-semibold text-[var(--text-secondary-light)]">User</th>
                                    <th className="p-3 font-semibold text-[var(--text-secondary-light)]">Action</th>
                                    <th className="p-3 font-semibold text-[var(--text-secondary-light)]">Description</th>
                                    <th className="p-3 text-right"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-light)] dark:divide-[var(--border-dark)]">
                                {filteredLogs.map(log => (
                                    <tr key={log.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer" onClick={() => setSelectedLog(log)}>
                                        <td className="p-3 whitespace-nowrap text-[var(--text-secondary-light)]">
                                            {new Date(log.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                        </td>
                                        <td className="p-3 whitespace-nowrap font-medium">
                                            {log.actorName}
                                        </td>
                                        <td className="p-3"><ActionBadge action={log.action} /></td>
                                        <td className="p-3 text-[var(--text-secondary-light)] truncate max-w-xs">{log.details.description}</td>
                                        <td className="p-3 text-right text-[var(--accent)] font-medium">View</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                <div className="flex justify-end pt-2">
                    <Button variant="outlined" onClick={onClose}>Close</Button>
                </div>
            </div>
        </Modal>
    );
};

export default AuditLogModal;
