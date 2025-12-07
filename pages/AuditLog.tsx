
import React, { useState, useEffect } from 'react';
import { getAuditLogs } from '../services/api';
import type { AuditLog, AuditAction } from '../types';
import { UserRole } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { FunnelIcon, MagnifyingGlassIcon, ClipboardDocumentListIcon, ClockIcon } from '../components/icons';
import { useAuth } from '../hooks/useAuth';
import { useScreen } from '../hooks/useScreen';

const ActionBadge: React.FC<{ action: AuditAction }> = ({ action }) => {
    const styles = {
        'CREATE': 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
        'UPDATE': 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
        'DELETE': 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    };
    return <span className={`px-2 py-0.5 text-xs font-bold rounded uppercase tracking-wider ${styles[action]}`}>{action}</span>;
}

const AuditLogPage: React.FC = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const { isMobile } = useScreen();

    // Filters
    const [filterEntity, setFilterEntity] = useState('All');
    const [filterAction, setFilterAction] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');

    // Detail Modal
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

    const fetchLogs = async () => {
        if (!user?.communityId) return;
        try {
            setLoading(true);
            const data = await getAuditLogs(user.communityId, user.id, user.role);
            setLogs(data);
        } catch (error) {
            console.error("Failed to fetch audit logs", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [user]);

    // Filtering Logic
    const filteredLogs = logs.filter(log => {
        if (filterEntity !== 'All' && log.entity !== filterEntity) return false;
        if (filterAction !== 'All' && log.action !== filterAction) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return (
                log.details.description?.toLowerCase().includes(q) ||
                log.actorName?.toLowerCase().includes(q) ||
                log.entity.toLowerCase().includes(q)
            );
        }
        return true;
    });

    const uniqueEntities = Array.from(new Set(logs.map(l => l.entity))).sort();

    // Render Diff Logic
    const renderDiff = (oldData: any, newData: any) => {
        if (!oldData && !newData) return <p className="text-gray-500 italic">No data details captured.</p>;

        const allKeys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);
        
        // Exclude technical fields
        const ignoredFields = ['created_at', 'updated_at', 'id', 'community_id', 'user_id', 'author', 'assigned_to_name', 'resident_name', 'submitted_by_name', 'approved_by_name'];

        const changes: { key: string, oldVal: any, newVal: any }[] = [];

        allKeys.forEach(key => {
            if (ignoredFields.includes(key)) return;
            // Loose equality to ignore type differences if strings
            // eslint-disable-next-line eqeqeq
            if (oldData?.[key] != newData?.[key]) {
                changes.push({
                    key,
                    oldVal: oldData?.[key],
                    newVal: newData?.[key]
                });
            }
        });

        if (changes.length === 0 && (oldData || newData)) {
             // Fallback if no specific keys changed but we have objects (e.g. initial creation)
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

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center animated-card">
                <div>
                    <h2 className="text-2xl font-bold text-[var(--text-light)] dark:text-[var(--text-dark)]">Audit History</h2>
                    <p className="text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] text-base mt-1">
                        Track changes and updates across the community.
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] p-4 rounded-xl border border-[var(--border-light)] dark:border-[var(--border-dark)] animated-card">
                <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <MagnifyingGlassIcon className="h-5 w-5 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search changes..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-lg bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                </div>
                <div className="flex gap-4">
                    <div className="relative w-1/2 md:w-40">
                        <select 
                            value={filterEntity} 
                            onChange={(e) => setFilterEntity(e.target.value)}
                            className="appearance-none bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] border border-[var(--border-light)] dark:border-[var(--border-dark)] text-sm rounded-lg block w-full pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                        >
                            <option value="All">All Modules</option>
                            {uniqueEntities.map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                            <FunnelIcon className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="relative w-1/2 md:w-40">
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
                            <FunnelIcon className="w-4 h-4" />
                        </div>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"></div>
                    ))}
                </div>
            ) : filteredLogs.length === 0 ? (
                <div className="p-12 text-center text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] border-2 border-dashed border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-xl">
                    <ClipboardDocumentListIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>No audit logs found matching your filters.</p>
                </div>
            ) : (
                <div className="bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] rounded-xl border border-[var(--border-light)] dark:border-[var(--border-dark)] overflow-hidden animated-card">
                    {isMobile ? (
                        <div className="divide-y divide-[var(--border-light)] dark:divide-[var(--border-dark)]">
                            {filteredLogs.map(log => (
                                <div key={log.id} className="p-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors" onClick={() => setSelectedLog(log)}>
                                    <div className="flex justify-between items-start mb-2">
                                        <ActionBadge action={log.action} />
                                        <span className="text-xs text-[var(--text-secondary-light)]">{new Date(log.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                                    </div>
                                    <p className="font-semibold text-sm mb-1">{log.details.description || `${log.action} ${log.entity}`}</p>
                                    <div className="flex justify-between items-end">
                                        <p className="text-xs text-[var(--text-secondary-light)]">By: {log.actorName}</p>
                                        <p className="text-xs font-medium text-[var(--accent)]">View Details</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-black/5 dark:bg-white/5 border-b border-[var(--border-light)] dark:border-[var(--border-dark)]">
                                <tr>
                                    <th className="p-4 font-semibold text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Timestamp</th>
                                    <th className="p-4 font-semibold text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">User</th>
                                    <th className="p-4 font-semibold text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Action</th>
                                    <th className="p-4 font-semibold text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Module</th>
                                    <th className="p-4 font-semibold text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Description</th>
                                    <th className="p-4 text-right font-semibold text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">View</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-light)] dark:divide-[var(--border-dark)]">
                                {filteredLogs.map(log => (
                                    <tr key={log.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer" onClick={() => setSelectedLog(log)}>
                                        <td className="p-4 whitespace-nowrap text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                                            {new Date(log.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                        </td>
                                        <td className="p-4 whitespace-nowrap">
                                            <div className="font-medium">{log.actorName}</div>
                                            <div className="text-xs text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">{log.actorRole}</div>
                                        </td>
                                        <td className="p-4"><ActionBadge action={log.action} /></td>
                                        <td className="p-4 font-medium">{log.entity}</td>
                                        <td className="p-4 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] truncate max-w-xs">{log.details.description}</td>
                                        <td className="p-4 text-right">
                                            <Button size="sm" variant="outlined">Details</Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* Detail Modal */}
            <Modal isOpen={!!selectedLog} onClose={() => setSelectedLog(null)} title="Audit Details" size="lg">
                {selectedLog && (
                    <div className="space-y-6">
                        {/* Header */}
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

                        {/* Meta Grid */}
                        <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-white/5 p-4 rounded-lg">
                            <div>
                                <p className="text-xs text-[var(--text-secondary-light)] uppercase font-bold">Performed By</p>
                                <p className="font-medium">{selectedLog.actorName}</p>
                                <p className="text-xs text-[var(--text-secondary-light)]">{selectedLog.actorRole}</p>
                            </div>
                            <div>
                                <p className="text-xs text-[var(--text-secondary-light)] uppercase font-bold">Module ID</p>
                                <p className="font-mono text-sm">{selectedLog.entity}: {selectedLog.entityId}</p>
                            </div>
                        </div>

                        {/* Data Diff */}
                        <div>
                            <h4 className="text-sm font-bold uppercase mb-3 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                                Data Changes
                            </h4>
                            
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
                            <Button onClick={() => setSelectedLog(null)}>Close</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default AuditLogPage;
