import React, { useState, useEffect } from 'react';
import { getVisitors, createVisitor, updateVisitor, deleteVisitor } from '../services/api';
import type { Visitor } from '../types';
import { UserRole, VisitorStatus, VisitorType } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import AuditLogModal from '../components/AuditLogModal';
import { PlusIcon, HistoryIcon, UsersIcon, ClockIcon, PencilIcon, TrashIcon } from '../components/icons';
import { useAuth } from '../hooks/useAuth';

const Visitors: React.FC = () => {
    const { user } = useAuth();
    const [visitors, setVisitors] = useState<Visitor[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAuditOpen, setIsAuditOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Form state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [visitorType, setVisitorType] = useState<VisitorType>(VisitorType.Guest);
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [expectedAt, setExpectedAt] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Delete Confirmation state
    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });

    const fetchVisitors = async () => {
        if (user?.communityId) {
            setLoading(true);
            try {
                const data = await getVisitors(user.communityId, user?.role);
                setVisitors(data);
            } catch (e) { console.error(e); } finally { setLoading(false); }
        }
    };

    useEffect(() => { fetchVisitors(); }, [user]);

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setIsSubmitting(true);
        try {
            const dateISO = new Date(expectedAt).toISOString();
            const payload = { 
                name, visitorType, vehicleNumber, 
                expectedAt: dateISO,
                purpose: visitorType === VisitorType.Guest ? 'Visitation' : 'Service'
            };

            if (editingId) {
                await updateVisitor(editingId, payload);
            } else {
                await createVisitor(payload, user);
            }

            setIsModalOpen(false);
            resetForm();
            await fetchVisitors();
        } catch (error) { 
            console.error("Operation failed:", error);
            alert("Visitor registry update failed.");
        } finally { 
            setIsSubmitting(false); 
        }
    };

    const resetForm = () => {
        setName('');
        setVisitorType(VisitorType.Guest);
        setVehicleNumber('');
        setExpectedAt('');
        setEditingId(null);
    };

    const handleEdit = (visitor: Visitor) => {
        setName(visitor.name);
        setVisitorType(visitor.visitorType);
        setVehicleNumber(visitor.vehicleNumber || '');
        // Local datetime-local format: YYYY-MM-DDTHH:MM
        const date = new Date(visitor.expectedAt);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        setExpectedAt(`${year}-${month}-${day}T${hours}:${minutes}`);
        
        setEditingId(visitor.id);
        setIsModalOpen(true);
    };

    const handleDelete = async () => {
        if (!confirmDelete.id) return;
        setIsSubmitting(true);
        try {
            await deleteVisitor(confirmDelete.id);
            setConfirmDelete({ isOpen: false, id: null });
            await fetchVisitors();
        } catch (error) {
            console.error("Delete failed:", error);
            alert("Failed to remove visitor record.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div className="flex items-start gap-3">
                    <div className="w-1 h-10 bg-brand-500 rounded-full mt-1" />
                    <div>
                        <span className="text-[9px] font-mono font-black uppercase tracking-[0.3em] text-brand-600 dark:text-brand-400 mb-0.5 block">Security Registry</span>
                        <h2 className="text-3xl font-brand font-extrabold text-brand-600 dark:text-slate-50 tracking-tight">Visitors</h2>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => setIsAuditOpen(true)} variant="outlined" size="md" leftIcon={<HistoryIcon />}>Audit</Button>
                    <Button onClick={() => { resetForm(); setIsModalOpen(true); }} size="md" leftIcon={<PlusIcon />}>Invite Guest</Button>
                </div>
            </div>

            <div className="space-y-3">
                {loading ? (
                    Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-slate-100 dark:bg-white/5 rounded-xl animate-pulse" />)
                ) : visitors.length === 0 ? (
                    <div className="p-16 text-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-white/5 rounded-3xl">
                        <UsersIcon className="w-10 h-10 mx-auto mb-3 opacity-20" />
                        <p className="font-bold uppercase tracking-widest text-[9px]">No active manifest</p>
                    </div>
                ) : (
                    visitors.map(visitor => (
                        <Card key={visitor.id} className="p-5 rounded-2xl bg-white dark:bg-zinc-900/40 border border-slate-50 dark:border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 group">
                            <div className="w-full sm:w-auto flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="text-xl font-brand font-extrabold text-slate-900 dark:text-slate-50">{visitor.name}</h3>
                                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-white/5 text-[8px] font-black uppercase tracking-widest rounded-md">{visitor.visitorType}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <p className="text-sm text-slate-500 font-medium">Loc: <span className="text-slate-800 dark:text-zinc-300 font-bold">{visitor.flatNumber}</span></p>
                                    {visitor.vehicleNumber && (
                                        <p className="text-[10px] font-black uppercase tracking-widest text-brand-600 bg-brand-500/5 px-2 rounded">Reg: {visitor.vehicleNumber}</p>
                                    )}
                                </div>
                            </div>
                            <div className="w-full sm:w-auto flex items-center gap-6 border-t sm:border-t-0 pt-3 sm:pt-0">
                                <div className="text-left sm:text-right">
                                    <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Expected Arrival</p>
                                    <p className="text-sm font-brand font-extrabold text-brand-600">
                                        {new Date(visitor.expectedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, {new Date(visitor.expectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                                
                                {visitor.userId === user?.id && (
                                    <div className="flex gap-1">
                                        <button 
                                            onClick={() => handleEdit(visitor)}
                                            className="p-2 text-slate-400 hover:text-brand-600 transition-colors bg-slate-50 dark:bg-white/5 rounded-lg"
                                            title="Edit Info"
                                        >
                                            <PencilIcon className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => setConfirmDelete({ isOpen: true, id: visitor.id })}
                                            className="p-2 text-slate-400 hover:text-rose-600 transition-colors bg-slate-50 dark:bg-white/5 rounded-lg"
                                            title="Remove Invitation"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </Card>
                    ))
                )}
            </div>

            <AuditLogModal isOpen={isAuditOpen} onClose={() => setIsAuditOpen(false)} entityType="Visitor" title="Gate Audit" />
            
            <Modal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                title={editingId ? "Update Guest Info" : "Authorize Guest"} 
                subtitle="Security Manifest" 
                size="md"
            >
                <form className="space-y-4" onSubmit={handleFormSubmit}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1">Guest Name</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Full Name" className="block w-full px-4 py-2.5 rounded-xl input-field text-sm font-bold"/>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1">Visitor Type</label>
                            <select value={visitorType} onChange={e => setVisitorType(e.target.value as VisitorType)} className="block w-full px-4 py-2.5 rounded-xl input-field text-xs font-bold appearance-none bg-white dark:bg-zinc-900">
                                {Object.values(VisitorType).map(type => <option key={type} value={type}>{type}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1">Vehicle Number</label>
                        <input type="text" value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} placeholder="e.g. KA 01 EB 1234" className="block w-full px-4 py-2.5 rounded-xl input-field text-sm font-bold uppercase"/>
                    </div>
                    <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1">Expected Arrival</label>
                        <input type="datetime-local" value={expectedAt} onChange={e => setExpectedAt(e.target.value)} required className="block w-full px-4 py-2.5 rounded-xl input-field text-sm font-bold"/>
                    </div>
                    <div className="flex justify-end pt-2 gap-3">
                        <Button type="button" variant="outlined" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting} size="lg" className="px-8">
                            {isSubmitting ? 'Syncing...' : (editingId ? 'Update Invite' : 'Create Invite')}
                        </Button>
                    </div>
                </form>
            </Modal>

            <ConfirmationModal
                isOpen={confirmDelete.isOpen}
                onClose={() => setConfirmDelete({ isOpen: false, id: null })}
                onConfirm={handleDelete}
                title="Cancel Invitation"
                message="Are you sure you want to remove this visitor from the active manifest? This action will invalidate their access for today."
                isDestructive
                isLoading={isSubmitting}
                confirmLabel="Yes, Remove"
            />
        </div>
    );
};

export default Visitors;