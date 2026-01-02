
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
import { PlusIcon, HistoryIcon, UsersIcon, ClockIcon, PencilIcon, TrashIcon, QrCodeIcon, IdentificationIcon, CheckCircleIcon, ShareIcon, XIcon, ArrowDownTrayIcon, ChevronDownIcon } from '../components/icons';
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
    const [isProcessingPass, setIsProcessingPass] = useState(false);

    // Form state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [visitorType, setVisitorType] = useState<VisitorType>(VisitorType.Guest);
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [expectedAt, setExpectedAt] = useState('');
    const [totalGuests, setTotalGuests] = useState<number>(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Feedbacks
    const [feedback, setFeedback] = useState<{ isOpen: boolean; type: 'success' | 'error' | 'info'; title: string; message: string }>({
        isOpen: false, type: 'success', title: '', message: ''
    });

    // Delete Confirmation state
    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });

    const isGateStaff = user?.role === UserRole.Security || user?.role === UserRole.SecurityAdmin || user?.role === UserRole.SuperAdmin;
    const canInvite = user?.role === UserRole.Resident || user?.role === UserRole.Admin || user?.role === UserRole.Tenant;

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

    // Helper: Create the Pass Canvas (Shared between download and share)
    const createPassCanvas = async (visitor: Visitor): Promise<HTMLCanvasElement | null> => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        canvas.width = 800;
        canvas.height = 1200;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Header
        ctx.fillStyle = '#0d9488'; 
        ctx.fillRect(0, 0, canvas.width, 180);

        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${visitor.entryToken || visitor.id}`;
        const qrImg = new Image();
        qrImg.crossOrigin = "anonymous";
        await new Promise((resolve, reject) => {
            qrImg.onload = resolve;
            qrImg.onerror = reject;
            qrImg.src = qrUrl;
        });

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 64px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Nilayam', canvas.width / 2, 80);
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText('COMMUNITY ACCESS PASS', canvas.width / 2, 120);

        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 54px sans-serif';
        ctx.fillText(visitor.name.toUpperCase(), canvas.width / 2, 280);

        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText('GATE ENTRY TOKEN', canvas.width / 2, 330);

        ctx.fillStyle = '#0d9488';
        ctx.font = 'bold 110px monospace';
        ctx.fillText(visitor.entryToken || 'INV-EXT', canvas.width / 2, 450);

        // Guest Count Badge
        ctx.fillStyle = '#f0fdfa';
        ctx.beginPath();
        ctx.roundRect(canvas.width / 2 - 100, 480, 200, 40, 20);
        ctx.fill();
        ctx.fillStyle = '#0d9488';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText(`GROUP SIZE: ${visitor.totalGuests || 1}`, canvas.width / 2, 508);

        const qrSize = 450;
        const qrX = (canvas.width - qrSize) / 2;
        const qrY = 550;
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 2;
        ctx.strokeRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);
        ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 32px sans-serif';
        ctx.fillText(`Invited by ${visitor.residentName}`, canvas.width / 2, 1080);
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText(`Unit: ${visitor.flatNumber} • ${user?.communityName || 'Property'}`, canvas.width / 2, 1130);

        return canvas;
    };

    const downloadPassImage = async (visitor: Visitor) => {
        if (isProcessingPass) return;
        setIsProcessingPass(true);
        try {
            const canvas = await createPassCanvas(visitor);
            if (!canvas) return;
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `Nilayam_Pass_${visitor.name.replace(/\s+/g, '_')}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error("Pass Generation Error:", err);
            alert("Could not generate image.");
        } finally {
            setIsProcessingPass(false);
        }
    };

    const handleSharePass = async (visitor: Visitor) => {
        if (isProcessingPass) return;
        setIsProcessingPass(true);
        
        try {
            const canvas = await createPassCanvas(visitor);
            if (!canvas) return;

            const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
            if (!blob) throw new Error("Canvas to Blob failed");

            const file = new File([blob], `Nilayam_Pass_${visitor.name.replace(/\s+/g, '_')}.png`, { type: 'image/png' });
            
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'Visitor Pass',
                    text: `Pre-authorized visit for ${visitor.name} (${visitor.totalGuests} Guests) at Nilayam.`
                });
            } else {
                const arrival = new Date(visitor.expectedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
                const text = `Hi ${visitor.name}! I've pre-authorized your visit for ${visitor.totalGuests} people. 📍 Unit: ${visitor.flatNumber} • ⏰ Arrival: ${arrival} • 🔑 Entry Code: ${visitor.entryToken}`;
                
                if (navigator.share) {
                    await navigator.share({ title: 'Visitor Pass', text: text });
                } else {
                    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
                    window.open(url, '_blank');
                }
            }
        } catch (err) {
            console.error("Share failed", err);
            const arrival = new Date(visitor.expectedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
            const text = `Hi ${visitor.name}! I've pre-authorized your visit. 📍 Unit: ${visitor.flatNumber} • ⏰ Arrival: ${arrival} • 🔑 Entry Code: ${visitor.entryToken}`;
            const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
            window.open(url, '_blank');
        } finally {
            setIsProcessingPass(false);
        }
    };

    const handleVerifySubmit = async (code: string) => {
        if (!user || isVerifying || !code) return;
        setIsVerifying(true);
        try {
            let cleanCode = String(code).trim();
            if (cleanCode.includes('://') || cleanCode.includes('/')) {
                const segments = cleanCode.split(/[/?#]/).filter(s => s.length > 0);
                if (segments.length > 0) cleanCode = segments[segments.length - 1];
            }
            cleanCode = cleanCode.replace(/[^\w-]/gi, '').trim();

            const targetVisitor = visitors.find(v => 
                (v.entryToken && v.entryToken.toUpperCase() === cleanCode.toUpperCase()) || 
                v.id === cleanCode.toLowerCase()
            );
            
            if (!targetVisitor) {
                setFeedback({ 
                    isOpen: true, type: 'error', title: 'Pass Not Found', 
                    message: `The scanned code (${cleanCode.substring(0, 8)}...) is not recognized.` 
                });
                setIsVerifying(false);
                return;
            }

            await verifyVisitorEntry(targetVisitor.id, cleanCode);
            setVerifiedVisitor(targetVisitor);
            setVerificationMode('selection');
            setIsVerifyModalOpen(false);
            setManualCode('');
            await fetchVisitors();
            setFeedback({ isOpen: true, type: 'success', title: 'Check-in Successful', message: `${targetVisitor.name} has been authorized.` });
        } catch (error: any) {
            setFeedback({ isOpen: true, type: 'error', title: 'Security Rejection', message: error.message || 'Verification failed.' });
        } finally { setIsVerifying(false); }
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setIsSubmitting(true);
        try {
            const dateISO = new Date(expectedAt).toISOString();
            const payload = { 
                name, 
                visitorType, 
                vehicleNumber, 
                expectedAt: dateISO, 
                purpose: visitorType === VisitorType.Guest ? 'Visitation' : 'Service',
                totalGuests: totalGuests || 1
            };
            if (editingId) {
                // Fix: Removed 3rd argument 'user' to match services/api.ts signature
                await updateVisitor(editingId, payload);
            } else {
                const newVisitor = await createVisitor(payload, user);
                setSelectedPassVisitor(newVisitor);
                setIsPassModalOpen(true);
            }
            setIsModalOpen(false);
            resetForm();
            await fetchVisitors();
        } catch (error) { console.error(error); } finally { setIsSubmitting(false); }
    };

    const resetForm = () => {
        setName(''); setVisitorType(VisitorType.Guest); setVehicleNumber(''); setExpectedAt(''); setTotalGuests(1); setEditingId(null);
    };

    const handleEdit = (visitor: Visitor) => {
        setName(visitor.name);
        setVisitorType(visitor.visitorType);
        setVehicleNumber(visitor.vehicleNumber || '');
        setTotalGuests(visitor.totalGuests || 1);
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
        if (!confirmDelete.id || !user) return;
        setIsSubmitting(true);
        try {
            await deleteVisitor(confirmDelete.id);
            setConfirmDelete({ isOpen: false, id: null });
            await fetchVisitors();
        } catch (error) { console.error(error); } finally { setIsSubmitting(false); }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div className="flex items-start gap-3">
                    <div className="w-1 h-10 bg-brand-500 rounded-full mt-1" />
                    <div>
                        <span className="text-[9px] font-mono font-black uppercase tracking-[0.3em] text-brand-600 dark:text-brand-400 mb-0.5 block">Security Registry</span>
                        <h1 className="text-2xl sm:text-3xl font-brand font-extrabold text-brand-600 tracking-tight leading-tight">Visitors</h1>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => setIsAuditOpen(true)} variant="outlined" size="md" leftIcon={<HistoryIcon />}>Audit</Button>
                    {canInvite && (
                        <Button onClick={() => { resetForm(); setIsModalOpen(true); }} size="md" leftIcon={<PlusIcon />}>Invite Guest</Button>
                    )}
                </div>
            </div>

            {isGateStaff && (
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
                            <button onClick={() => { setVerificationMode('qr'); setIsVerifyModalOpen(true); }} className="flex items-center gap-4 p-5 bg-white rounded-2xl hover:bg-slate-50 transition-all shadow-lg group">
                                <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform"><QrCodeIcon className="w-7 h-7" /></div>
                                <div className="text-left"><p className="font-brand font-extrabold text-slate-900 leading-none">Scan QR Pass</p><p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Rapid Entry Verify</p></div>
                            </button>
                            <button onClick={() => { setVerificationMode('manual'); setIsVerifyModalOpen(true); }} className="flex items-center gap-4 p-5 bg-white/10 border border-white/20 rounded-2xl hover:bg-white/20 transition-all group">
                                <div className="w-12 h-12 bg-white/10 text-white rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform"><IdentificationIcon className="w-7 h-7" /></div>
                                <div className="text-left"><p className="font-brand font-extrabold text-white leading-none">Enter Pass Code</p><p className="text-[10px] font-bold text-white/50 mt-1 uppercase">Manual Token Input</p></div>
                            </button>
                        </div>
                    </div>
                </Card>
            )}

            <div className="space-y-3">
                <h3 className="text-[10px] font-black text-brand-600 dark:text-brand-400 font-mono uppercase tracking-[0.3em] px-1">{isGateStaff ? "Today's Manifest" : "My Invitations"}</h3>
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
                                    <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded-md ${visitor.status === 'Checked In' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 dark:bg-white/5 text-slate-500'}`}>{visitor.status}</span>
                                    <span className="bg-brand-50 text-brand-600 text-[8px] font-black uppercase px-2 py-0.5 rounded-md ml-1">{visitor.totalGuests || 1} Guests</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <p className="text-sm text-slate-500 font-medium">Loc: <span className="text-slate-800 dark:text-zinc-300 font-bold">{visitor.flatNumber}</span></p>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{visitor.visitorType}</p>
                                </div>
                            </div>
                            <div className="w-full sm:w-auto flex items-center gap-6 border-t sm:border-t-0 pt-3 sm:pt-0">
                                <div className="text-left sm:text-right"><p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Time</p><p className="text-sm font-brand font-extrabold text-brand-600">{new Date(visitor.expectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p></div>
                                <div className="flex gap-1">
                                    {visitor.status === 'Expected' && (
                                        <button onClick={() => { setSelectedPassVisitor(visitor); setIsPassModalOpen(true); }} className="p-2 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors rounded-lg flex items-center gap-1.5 px-3">
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

            <AuditLogModal isOpen={isAuditOpen} onClose={() => setIsAuditOpen(false)} entityType="Visitor" title="Gate Audit" />
            
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Update Guest Info" : "Authorize Guest"} subtitle="Security Manifest" size="md">
                <form className="space-y-5" onSubmit={handleFormSubmit}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                          <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Guest Primary Name</label>
                          <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Full Name" className="rounded-xl input-field text-base font-bold"/>
                        </div>
                        <div>
                          <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Visitor Type</label>
                          <div className="relative">
                            <select value={visitorType} onChange={e => setVisitorType(e.target.value as VisitorType)} className="rounded-xl input-field text-base font-bold appearance-none bg-white dark:bg-zinc-900">
                              {Object.values(VisitorType).map(type => <option key={type} value={type}>{type}</option>)}
                            </select>
                            <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                          </div>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Total No. of Guests</label>
                            <input type="number" value={totalGuests} onChange={e => setTotalGuests(parseInt(e.target.value) || 1)} required min="1" max="20" className="rounded-xl input-field text-base font-bold"/>
                        </div>
                    </div>
                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Vehicle Number</label>
                      <input type="text" value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} placeholder="e.g. KA 01 EB 1234" className="rounded-xl input-field text-base font-bold uppercase"/>
                    </div>
                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Expected Arrival</label>
                      <input type="datetime-local" value={expectedAt} onChange={e => setExpectedAt(e.target.value)} required className="rounded-xl input-field text-base font-bold"/>
                    </div>
                    <div className="flex justify-end pt-2 gap-3">
                      <Button type="button" variant="outlined" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={isSubmitting} size="lg" className="px-8">{isSubmitting ? 'Syncing...' : (editingId ? 'Update Invite' : 'Create Invite')}</Button>
                    </div>
                </form>
            </Modal>

            <Modal 
                isOpen={isPassModalOpen} 
                onClose={() => setIsPassModalOpen(false)} 
                title="Guest Access Pass" 
                subtitle="INVITATION DISPATCH" 
                size="md"
            >
                {selectedPassVisitor && (
                    <div className="space-y-6">
                        <div className="relative bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-[2rem] overflow-hidden shadow-2xl p-6 text-center">
                            <div className="absolute top-0 left-0 w-full h-2 bg-brand-600" />
                            
                            <div className="flex flex-col items-center gap-4 py-4">
                                <div className="flex flex-col items-center">
                                    <h4 className="text-3xl font-brand font-extrabold text-brand-600 tracking-tight">Nilayam</h4>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-0.5">Community Access</p>
                                </div>

                                <div className="bg-slate-50 dark:bg-black/20 p-4 rounded-3xl border border-slate-100 dark:border-white/5 mt-2">
                                    <img 
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${selectedPassVisitor.entryToken || selectedPassVisitor.id}`} 
                                        alt="Access QR Code"
                                        className="w-48 h-48 rounded-xl"
                                    />
                                    <p className="mt-3 font-mono font-black text-2xl text-brand-600 tracking-widest">{selectedPassVisitor.entryToken || 'INV-EXT'}</p>
                                    <div className="mt-2 inline-block px-3 py-1 bg-brand-50 rounded-full border border-brand-100">
                                        <p className="text-[10px] font-black uppercase text-brand-600">Entry for {selectedPassVisitor.totalGuests} People</p>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <h5 className="text-xl font-brand font-extrabold text-slate-900 dark:text-slate-50">{selectedPassVisitor.name}</h5>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{selectedPassVisitor.visitorType}</p>
                                </div>

                                <div className="w-full grid grid-cols-2 gap-4 mt-4 pt-6 border-t border-slate-100 dark:border-white/5">
                                    <div className="text-left">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Invited By</p>
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedPassVisitor.residentName}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Destination</p>
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedPassVisitor.flatNumber}</p>
                                    </div>
                                    <div className="text-left">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Arrival Date</p>
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{new Date(selectedPassVisitor.expectedAt).toLocaleDateString()}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Expected Time</p>
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{new Date(selectedPassVisitor.expectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Button 
                                className="w-full shadow-lg shadow-brand-500/20" 
                                onClick={() => handleSharePass(selectedPassVisitor)}
                                disabled={isProcessingPass}
                                leftIcon={isProcessingPass ? <ClockIcon className="animate-spin" /> : <ShareIcon />}
                            >
                                {isProcessingPass ? 'Processing...' : 'Share with QR'}
                            </Button>
                            <Button 
                                variant="outlined" 
                                className="w-full" 
                                onClick={() => downloadPassImage(selectedPassVisitor)}
                                disabled={isProcessingPass}
                                leftIcon={<ArrowDownTrayIcon />}
                            >
                                Save to Gallery
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            <ConfirmationModal isOpen={confirmDelete.isOpen} onClose={() => setConfirmDelete({ isOpen: false, id: null })} onConfirm={handleDelete} title="Cancel Invitation" message="Are you sure you want to remove this visitor?" isDestructive isLoading={isSubmitting} confirmLabel="Yes, Remove" />
            <FeedbackModal isOpen={feedback.isOpen} onClose={() => setFeedback({ ...feedback, isOpen: false })} title={feedback.title} message={feedback.message} type={feedback.type} />
        </div>
    );
};

export default Visitors;
