import React, { useState, useEffect } from 'react';
import { getVisitors, createVisitor, updateVisitor, deleteVisitor, verifyVisitorEntry } from '../services/api';
import type { Visitor } from '../types';
import { UserRole, VisitorStatus, VisitorType } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import AuditLogModal from '../components/AuditLogModal';
import FeedbackModal from '../components/ui/FeedbackModal';
import QRScanner from '../components/ui/QRScanner';
import { PlusIcon, HistoryIcon, UsersIcon, ClockIcon, PencilIcon, TrashIcon, QrCodeIcon, IdentificationIcon, CheckCircleIcon, ShareIcon, XIcon } from '../components/icons';
import { useAuth } from '../hooks/useAuth';

const Visitors: React.FC = () => {
    const { user } = useAuth();
    const [visitors, setVisitors] = useState<Visitor[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAuditOpen, setIsAuditOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Security verification states
    const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
    const [verificationMode, setVerificationMode] = useState<'selection' | 'qr' | 'manual'>('selection');
    const [manualCode, setManualCode] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [verifiedVisitor, setVerifiedVisitor] = useState<Visitor | null>(null);

    // Pass sharing states
    const [isPassModalOpen, setIsPassModalOpen] = useState(false);
    const [selectedPassVisitor, setSelectedPassVisitor] = useState<Visitor | null>(null);

    // Form state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [visitorType, setVisitorType] = useState<VisitorType>(VisitorType.Guest);
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [expectedAt, setExpectedAt] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Feedbacks
    const [feedback, setFeedback] = useState<{ isOpen: boolean; type: 'success' | 'error' | 'info'; title: string; message: string }>({
        isOpen: false, type: 'success', title: '', message: ''
    });

    // Delete Confirmation state
    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });

    const isSecurity = user?.role === UserRole.Security || user?.role === UserRole.SecurityAdmin || user?.role === UserRole.Admin || user?.role === UserRole.SuperAdmin;

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

    const handleVerifySubmit = async (code: string) => {
        if (!user || isVerifying || !code) return;
        setIsVerifying(true);
        try {
            // Smart Extraction: Some generic scanners might scan the full site URL if present
            let cleanCode = code.trim();
            if (cleanCode.includes('://') || cleanCode.includes('/')) {
                // Try to extract the last segment of a path (handles both URL and nested tokens)
                const segments = cleanCode.split(/[/?#]/).filter(s => s.length > 0);
                if (segments.length > 0) {
                    cleanCode = segments[segments.length - 1];
                }
            }

            const upperCode = cleanCode.toUpperCase();
            const lowerCode = cleanCode.toLowerCase();
            
            // Find visitor in local manifest first
            const targetVisitor = visitors.find(v => 
                (v.entryToken && v.entryToken.toUpperCase() === upperCode) || 
                v.id === lowerCode ||
                v.id === cleanCode
            );
            
            if (!targetVisitor) {
                setFeedback({ 
                    isOpen: true, 
                    type: 'error', 
                    title: 'Invalid Pass', 
                    message: `The scanned code (${cleanCode.substring(0, 12)}${cleanCode.length > 12 ? '...' : ''}) does not match any expected visitor for this community today.` 
                });
                setIsVerifying(false);
                return;
            }

            // Remote Verification via Edge Function
            await verifyVisitorEntry(targetVisitor.id, cleanCode, user);
            
            setVerifiedVisitor(targetVisitor);
            setVerificationMode('selection');
            setIsVerifyModalOpen(false);
            setManualCode('');
            await fetchVisitors();
            
            setFeedback({ 
                isOpen: true, 
                type: 'success', 
                title: 'Access Granted', 
                message: `${targetVisitor.name} verified for Unit ${targetVisitor.flatNumber}. Entry logged.` 
            });
        } catch (error: any) {
            setFeedback({ 
                isOpen: true, 
                type: 'error', 
                title: 'Check-in Rejected', 
                message: error.message || 'The security server rejected this entry. Please verify the visitor\'s ID manually.' 
            });
        } finally {
            setIsVerifying(false);
        }
    };

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
                const newVisitor = await createVisitor(payload, user);
                // Immediately show the pass for the new visitor
                setSelectedPassVisitor(newVisitor);
                setIsPassModalOpen(true);
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
                    {user?.role === UserRole.Resident && (
                        <Button onClick={() => { resetForm(); setIsModalOpen(true); }} size="md" leftIcon={<PlusIcon />}>Invite Guest</Button>
                    )}
                </div>
            </div>

            {/* GATE CONTROL CENTER FOR SECURITY */}
            {isSecurity && (
                <Card className="p-6 bg-brand-600 dark:bg-[#0f1115] border-none rounded-3xl shadow-xl overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                        <QrCodeIcon className="w-40 h-40 text-white" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                                <IdentificationIcon className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-brand font-extrabold text-white">Gate Control Center</h3>
                                <p className="text-[10px] font-bold text-white/70 uppercase tracking-[0.2em]">Authorized Access Only</p>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <button 
                                onClick={() => { setVerificationMode('qr'); setIsVerifyModalOpen(true); }}
                                className="flex items-center gap-4 p-5 bg-white rounded-2xl hover:bg-slate-50 transition-all shadow-lg group"
                            >
                                <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <QrCodeIcon className="w-7 h-7" />
                                </div>
                                <div className="text-left">
                                    <p className="font-brand font-extrabold text-slate-900 leading-none">Scan QR Pass</p>
                                    <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Rapid Entry Verify</p>
                                </div>
                            </button>
                            
                            <button 
                                onClick={() => { setVerificationMode('manual'); setIsVerifyModalOpen(true); }}
                                className="flex items-center gap-4 p-5 bg-white/10 border border-white/20 rounded-2xl hover:bg-white/20 transition-all group"
                            >
                                <div className="w-12 h-12 bg-white/10 text-white rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <IdentificationIcon className="w-7 h-7" />
                                </div>
                                <div className="text-left">
                                    <p className="font-brand font-extrabold text-white leading-none">Enter Pass Code</p>
                                    <p className="text-[10px] font-bold text-white/50 mt-1 uppercase">Manual Token Input</p>
                                </div>
                            </button>
                        </div>
                    </div>
                </Card>
            )}

            <div className="space-y-3">
                <h3 className="text-[10px] font-black text-brand-600 dark:text-brand-400 font-mono uppercase tracking-[0.3em] px-1">Active Manifest</h3>
                {loading ? (
                    Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-slate-100 dark:bg-white/5 rounded-xl animate-pulse" />)
                ) : visitors.length === 0 ? (
                    <div className="p-16 text-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-white/5 rounded-3xl">
                        <UsersIcon className="w-10 h-10 mx-auto mb-3 opacity-20" />
                        <p className="font-bold uppercase tracking-widest text-[9px]">No active manifest</p>
                    </div>
                ) : (
                    visitors.map(visitor => (
                        <Card key={visitor.id} className={`p-5 rounded-2xl bg-white dark:bg-zinc-900/40 border border-slate-50 dark:border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 group ${visitor.status === 'Checked In' ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                            <div className="w-full sm:w-auto flex-1 text-left">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="text-xl font-brand font-extrabold text-slate-900 dark:text-slate-50">{visitor.name}</h3>
                                    <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded-md ${visitor.status === 'Checked In' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 dark:bg-white/5 text-slate-500'}`}>
                                        {visitor.status}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <p className="text-sm text-slate-500 font-medium">Loc: <span className="text-slate-800 dark:text-zinc-300 font-bold">{visitor.flatNumber}</span></p>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{visitor.visitorType}</p>
                                    {visitor.vehicleNumber && (
                                        <p className="text-[10px] font-black uppercase tracking-widest text-brand-600 bg-brand-500/5 px-2 rounded">Reg: {visitor.vehicleNumber}</p>
                                    )}
                                </div>
                            </div>
                            <div className="w-full sm:w-auto flex items-center gap-6 border-t sm:border-t-0 pt-3 sm:pt-0">
                                <div className="text-left sm:text-right">
                                    <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">{visitor.status === 'Checked In' ? 'Arrived At' : 'ETA'}</p>
                                    <p className="text-sm font-brand font-extrabold text-brand-600">
                                        {visitor.status === 'Checked In' && visitor.entryTime ? (
                                            new Date(visitor.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                        ) : (
                                            new Date(visitor.expectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                        )}
                                    </p>
                                </div>
                                
                                <div className="flex gap-1">
                                    {visitor.status === 'Expected' && (
                                        <button 
                                            onClick={() => { setSelectedPassVisitor(visitor); setIsPassModalOpen(true); }}
                                            className="p-2 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors rounded-lg flex items-center gap-1.5 px-3"
                                        >
                                            <ShareIcon className="w-4 h-4" />
                                            <span className="text-[9px] font-black uppercase tracking-widest">Share Pass</span>
                                        </button>
                                    )}
                                    {visitor.userId === user?.id && visitor.status === 'Expected' && (
                                        <>
                                            <button onClick={() => handleEdit(visitor)} className="p-2 text-slate-400 hover:text-brand-600 transition-colors bg-slate-50 dark:bg-white/5 rounded-lg"><PencilIcon className="w-4 h-4" /></button>
                                            <button onClick={() => setConfirmDelete({ isOpen: true, id: visitor.id })} className="p-2 text-slate-400 hover:text-rose-600 transition-colors bg-slate-50 dark:bg-white/5 rounded-lg"><TrashIcon className="w-4 h-4" /></button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </Card>
                    ))
                )}
            </div>

            {/* PASS SHARING MODAL */}
            <Modal
                isOpen={isPassModalOpen}
                onClose={() => { setIsPassModalOpen(false); setSelectedPassVisitor(null); }}
                title="Visitor Access Pass"
                subtitle="SECURE GATE PROTOCOL"
                size="md"
            >
                {selectedPassVisitor && (
                    <div className="space-y-8 py-2">
                        <div className="bg-slate-50 dark:bg-white/5 p-8 rounded-[2.5rem] border border-slate-100 dark:border-white/5 flex flex-col items-center text-center">
                            <div className="w-16 h-1 bg-brand-500 rounded-full mb-6 opacity-30" />
                            
                            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Gate Access Token</h4>
                            <p className="text-4xl font-brand font-black tracking-[0.4em] text-brand-600 mb-8">{selectedPassVisitor.entryToken || 'INV-EXT'}</p>
                            
                            <div className="bg-white p-6 rounded-3xl shadow-xl shadow-brand-500/10 mb-8">
                                <img 
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${selectedPassVisitor.entryToken || selectedPassVisitor.id}`} 
                                    alt="Access QR Code"
                                    className="w-40 h-40"
                                />
                            </div>

                            <div className="space-y-1">
                                <p className="text-xl font-brand font-extrabold text-slate-900 dark:text-slate-50">{selectedPassVisitor.name}</p>
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Guest of <span className="text-brand-600">{selectedPassVisitor.residentName}</span> • Unit {selectedPassVisitor.flatNumber}</p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <Button size="lg" className="w-full" onClick={() => window.print()} leftIcon={<CheckCircleIcon />}>
                                Download Pass Image
                            </Button>
                            <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Share this code with your guest for rapid entry</p>
                        </div>
                    </div>
                )}
            </Modal>

            {/* VERIFICATION MODAL */}
            <Modal 
                isOpen={isVerifyModalOpen} 
                onClose={() => { setIsVerifyModalOpen(false); setVerificationMode('selection'); }} 
                title="Verify Access" 
                subtitle="GATE PROTOCOL"
                size={verificationMode === 'qr' ? 'lg' : 'md'}
            >
                {verificationMode === 'qr' ? (
                    <div className="space-y-4">
                        <QRScanner onScan={(data) => handleVerifySubmit(data)} onClose={() => setVerificationMode('selection')} />
                        <div className="text-center">
                            <p className="text-xs text-slate-400 font-medium">Scanning for Secure Entry Pass...</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="bg-slate-50 dark:bg-white/5 p-8 rounded-[2rem] border border-slate-100 dark:border-white/5 text-center">
                            <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-4">Manual Entry Token</label>
                            <input 
                                type="text" 
                                value={manualCode} 
                                onChange={e => setManualCode(e.target.value.toUpperCase())}
                                placeholder="E.G. AB12XY"
                                maxLength={6}
                                className="block w-full text-center text-4xl font-brand font-black tracking-[0.5em] text-brand-600 bg-transparent border-none focus:ring-0 placeholder:opacity-10"
                            />
                            <div className="mt-6 flex justify-center">
                                <div className="h-1 w-12 bg-brand-500/20 rounded-full" />
                            </div>
                        </div>
                        
                        <div className="flex flex-col gap-3">
                            <Button 
                                size="lg" 
                                onClick={() => handleVerifySubmit(manualCode)}
                                disabled={manualCode.length < 4 || isVerifying}
                                className="w-full shadow-xl shadow-brand-500/10"
                                leftIcon={isVerifying ? <ClockIcon /> : <CheckCircleIcon />}
                            >
                                {isVerifying ? 'Verifying...' : 'Authorize Entry'}
                            </Button>
                            <Button 
                                variant="ghost" 
                                size="md" 
                                onClick={() => setVerificationMode('selection')}
                                className="w-full"
                            >
                                Back to Selection
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

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
                        <input type="text" value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} placeholder="e.g. KA 01 EB 1234" className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold uppercase"/>
                    </div>
                    <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1">Expected Arrival</label>
                        <input type="datetime-local" value={expectedAt} onChange={e => setExpectedAt(e.target.value)} required className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold"/>
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

            <FeedbackModal 
                isOpen={feedback.isOpen} 
                onClose={() => setFeedback({ ...feedback, isOpen: false })} 
                title={feedback.title} 
                message={feedback.message} 
                type={feedback.type} 
            />
        </div>
    );
};

export default Visitors;