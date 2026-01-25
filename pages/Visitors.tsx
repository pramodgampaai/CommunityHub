import React, { useState, useEffect, useRef } from 'react';
import { getVisitors, createVisitor, updateVisitor, deleteVisitor, verifyVisitorEntry, getCachedData } from '../services/api';
import type { Visitor } from '../types';
import { UserRole, VisitorStatus, VisitorType } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import Modal from '../components/ui/Modal';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import AuditLogModal from '../components/AuditLogModal';
import FeedbackModal from '../components/ui/FeedbackModal';
import QRScanner from '../components/ui/QRScanner';
import { PlusIcon, HistoryIcon, UsersIcon, ClockIcon, PencilIcon, TrashIcon, QrCodeIcon, IdentificationIcon, ShareIcon, ArrowDownTrayIcon, ChevronDownIcon, CalendarIcon, CheckCircleIcon, XIcon, HomeIcon, CameraIcon, SparklesIcon, ArrowRightIcon } from '../components/icons';
import { useAuth } from '../hooks/useAuth';

const CameraCapture: React.FC<{ onCapture: (base64: string) => void, onCancel: () => void }> = ({ onCapture, onCancel }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [isStarting, setIsStarting] = useState(true);

    useEffect(() => {
        const startCamera = async () => {
            try {
                const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
                setStream(s);
                if (videoRef.current) {
                    videoRef.current.srcObject = s;
                }
            } catch (e) {
                console.error("Camera access failed", e);
            } finally {
                setIsStarting(false);
            }
        };
        startCamera();
        return () => {
            if (stream) stream.getTracks().forEach(t => t.stop());
        };
    }, []);

    const capture = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                onCapture(canvas.toDataURL('image/jpeg', 0.8));
            }
        }
    };

    return (
        <div className="space-y-4">
            <div className="relative aspect-[4/3] bg-black rounded-3xl overflow-hidden border-2 border-slate-100 dark:border-white/10 shadow-2xl">
                {isStarting && <div className="absolute inset-0 flex items-center justify-center text-white"><Spinner /></div>}
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover mirror" />
                <canvas ref={canvasRef} className="hidden" />
                <div className="absolute top-4 left-4 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    <span className="text-[8px] font-black uppercase text-white tracking-widest drop-shadow-md">Live Viewfinder</span>
                </div>
            </div>
            <div className="flex gap-2">
                <Button variant="outlined" onClick={onCancel} className="flex-1">Cancel</Button>
                <Button onClick={capture} className="flex-1" leftIcon={<CameraIcon />}>Take Snapshot</Button>
            </div>
        </div>
    );
};

const Visitors: React.FC = () => {
    const { user } = useAuth();
    const cacheKey = `visitors:${user?.communityId}:${user?.role || 'std'}`;
    const [visitors, setVisitors] = useState<Visitor[]>(() => getCachedData(cacheKey) || []);
    const [loading, setLoading] = useState(!getCachedData(cacheKey));
    const [isAuditOpen, setIsAuditOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Security verification states
    const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
    const [verificationMode, setVerificationMode] = useState<'selection' | 'qr' | 'manual'>('selection');
    const [manualCode, setManualCode] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    
    // Photo stage
    const [verifyingVisitor, setVerifyingVisitor] = useState<Visitor | null>(null);
    const [guestPhoto, setGuestPhoto] = useState<string | null>(null);
    const [showCamera, setShowCamera] = useState(false);

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

    const isGateStaff = user?.role === UserRole.Security || user?.role === UserRole.SecurityAdmin || user?.role === UserRole.SuperAdmin;
    const canInvite = user?.role === UserRole.Resident || user?.role === UserRole.Admin || user?.role === UserRole.Tenant;

    const fetchVisitors = async () => {
        if (user?.communityId) {
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
            const payload = { 
                name, visitorType, vehicleNumber, 
                expectedAt: new Date(expectedAt).toISOString(), 
                purpose: visitorType === VisitorType.Guest ? 'Visitation' : 'Service',
                totalGuests: Number(totalGuests) || 1
            };
            if (editingId) await updateVisitor(editingId, payload);
            else {
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

    const handleCodeVerification = async (code: string) => {
        const cleaned = code.trim().toUpperCase();
        if (!cleaned) return;
        
        const visitor = visitors.find(v => v.entryToken === cleaned || v.id === cleaned);
        if (!visitor) {
            setFeedback({ isOpen: true, type: 'error', title: 'Invalid Pass', message: "The provided code was not found in today's manifest." });
            return;
        }

        if (visitor.status === 'Checked In') {
            setFeedback({ isOpen: true, type: 'error', title: 'Access Denied', message: "This pass has already been used and is no longer valid." });
            return;
        }

        const today = new Date().toISOString().split('T')[0];
        const expected = new Date(visitor.expectedAt).toISOString().split('T')[0];
        if (today !== expected) {
            setFeedback({ isOpen: true, type: 'error', title: 'Stale Pass', message: `This pass was valid for ${expected}, not for today.` });
            return;
        }

        // Pass is valid, now move to Photo Capture Stage
        setVerifyingVisitor(visitor);
        setShowCamera(true);
    };

    const finalizeCheckIn = async () => {
        if (!verifyingVisitor || !guestPhoto) return;
        setIsVerifying(true);
        try {
            await verifyVisitorEntry(verifyingVisitor.id, verifyingVisitor.entryToken || verifyingVisitor.id, guestPhoto);
            setFeedback({ isOpen: true, type: 'success', title: 'Entry Authorized', message: `Visitor ${verifyingVisitor.name} has been checked in.` });
            setIsVerifyModalOpen(false);
            setVerifyingVisitor(null);
            setGuestPhoto(null);
            setShowCamera(false);
            setManualCode('');
            await fetchVisitors();
        } catch (err: any) {
            setFeedback({ isOpen: true, type: 'error', title: 'Auth Failed', message: err.message });
        } finally { setIsVerifying(false); }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 min-h-[5rem]">
                <div className="flex items-start gap-3">
                    <div className="w-1 h-10 bg-brand-500 rounded-full mt-1" />
                    <div>
                        <span className="text-[9px] font-mono font-black uppercase tracking-[0.3em] text-brand-600 dark:text-brand-400 mb-0.5 block">Security Registry</span>
                        <h1 className="text-2xl sm:text-3xl font-brand font-extrabold text-brand-600 dark:text-brand-400 tracking-tight leading-tight">Visitors</h1>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => setIsAuditOpen(true)} variant="outlined" size="md" leftIcon={<HistoryIcon />}>Audit</Button>
                    {canInvite && <Button onClick={() => { resetForm(); setIsModalOpen(true); }} size="md" leftIcon={isSubmitting ? <Spinner /> : <PlusIcon />}>Invite Guest</Button>}
                </div>
            </div>

            {isGateStaff && (
                <Card className="p-6 bg-brand-600 dark:bg-[#0f1115] border-none rounded-3xl shadow-xl overflow-hidden relative">
                    <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button 
                            onClick={() => { setVerificationMode('qr'); setVerifyingVisitor(null); setGuestPhoto(null); setShowCamera(false); setIsVerifyModalOpen(true); }} 
                            className="flex items-center gap-4 p-5 bg-white dark:bg-zinc-800 rounded-2xl hover:bg-slate-50 dark:hover:bg-zinc-700 transition-all shadow-lg group text-slate-900 dark:text-slate-100 border border-slate-100 dark:border-white/5"
                        >
                            <div className="w-12 h-12 bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                <QrCodeIcon className="w-7 h-7" />
                            </div>
                            <div className="text-left">
                                <p className="font-brand font-extrabold leading-none">Scan QR Pass</p>
                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1 uppercase">Rapid Entry</p>
                            </div>
                        </button>
                        <button 
                            onClick={() => { setVerificationMode('manual'); setVerifyingVisitor(null); setGuestPhoto(null); setShowCamera(false); setIsVerifyModalOpen(true); }} 
                            className="flex items-center gap-4 p-5 bg-white/10 dark:bg-zinc-800/40 border border-white/20 dark:border-white/5 rounded-2xl hover:bg-white/20 dark:hover:bg-zinc-700/60 transition-all group"
                        >
                            <div className="w-12 h-12 bg-white/10 dark:bg-brand-900/10 text-white dark:text-brand-400 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                <IdentificationIcon className="w-7 h-7" />
                            </div>
                            <div className="text-left">
                                <p className="font-brand font-extrabold text-white leading-none">Enter Pass Code</p>
                                <p className="text-[10px] font-bold text-white/50 dark:text-slate-500 mt-1 uppercase">Manual Input</p>
                            </div>
                        </button>
                    </div>
                </Card>
            )}

            <div className="space-y-3">
                <h3 className="text-[10px] font-black text-brand-600 dark:text-brand-400 font-mono uppercase tracking-[0.3em] px-1">{isGateStaff ? "Today's Manifest" : "My Invitations"}</h3>
                {loading && visitors.length === 0 ? (
                    Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 bg-slate-100 dark:bg-white/5 rounded-xl animate-pulse" />)
                ) : (
                    visitors.map(visitor => (
                        <Card key={visitor.id} className={`p-5 rounded-3xl bg-white dark:bg-zinc-900/40 border border-slate-50 dark:border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-sm ${visitor.status === 'Checked In' ? 'opacity-70' : ''}`}>
                            <div className="w-full sm:w-auto flex flex-1 items-start gap-4">
                                {visitor.status === 'Checked In' && visitor.photoUrl ? (
                                    <div className="w-16 h-16 rounded-2xl overflow-hidden border border-slate-100 dark:border-white/10 shadow-sm shrink-0">
                                        <img src={visitor.photoUrl} className="w-full h-full object-cover" alt="Guest" />
                                    </div>
                                ) : (
                                    <div className="w-16 h-16 rounded-2xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center shrink-0">
                                        <UsersIcon className="w-8 h-8 text-brand-600" />
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <div className="flex items-center gap-3 mb-1">
                                        <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded-md ${visitor.status === 'Checked In' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>{visitor.status}</span>
                                        <span className="text-[9px] font-black uppercase tracking-widest text-brand-600 bg-brand-50 dark:bg-brand-900/20 px-2 py-0.5 rounded-md">{visitor.visitorType}</span>
                                    </div>
                                    <h3 className="text-xl font-brand font-extrabold text-slate-900 dark:text-slate-50 leading-tight truncate">{visitor.name}</h3>
                                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                                        <p className="text-[10px] text-slate-500 font-medium flex items-center gap-1.5"><UsersIcon className="w-3.5 h-3.5" />{visitor.totalGuests} Guests</p>
                                        <p className="text-[10px] text-slate-500 font-medium flex items-center gap-1.5"><HomeIcon className="w-3.5 h-3.5" />Unit: <span className="font-bold text-slate-900 dark:text-zinc-200">{visitor.flatNumber}</span></p>
                                        {visitor.vehicleNumber && <p className="text-[10px] text-slate-500 font-medium flex items-center gap-1.5"><IdentificationIcon className="w-3.5 h-3.5" />{visitor.vehicleNumber}</p>}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="text-right">
                                    <p className="text-[8px] font-black uppercase text-slate-400 mb-1 flex items-center justify-end gap-1"><ClockIcon className="w-3 h-3" />Arrival</p>
                                    <p className="text-sm font-brand font-extrabold text-brand-600">{new Date(visitor.expectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    <p className="text-[9px] text-slate-400 font-bold">{new Date(visitor.expectedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</p>
                                </div>
                                {visitor.status === 'Expected' && (
                                    <Button onClick={() => { setSelectedPassVisitor(visitor); setIsPassModalOpen(true); }} size="sm" variant="outlined" leftIcon={<ShareIcon />}>Share</Button>
                                )}
                            </div>
                        </Card>
                    ))
                )}
            </div>
            
            <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title={editingId ? "Update Invite" : "Invite Guest"} subtitle="GATE SECURITY PASS" size="lg">
                <form className="space-y-5" onSubmit={handleFormSubmit}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="sm:col-span-2">
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Guest / Entity Name</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Full Name" className="rounded-xl input-field text-sm font-bold"/>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Visitor Category</label>
                            <div className="relative">
                                <select value={visitorType} onChange={e => setVisitorType(e.target.value as VisitorType)} className="rounded-xl input-field text-xs font-bold appearance-none bg-white dark:bg-zinc-900">
                                    {Object.values(VisitorType).map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <ChevronDownIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Guest Count</label>
                            <input type="number" value={totalGuests} onChange={e => setTotalGuests(parseInt(e.target.value) || 1)} required min="1" className="rounded-xl input-field text-sm font-bold"/>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Arrival Date & Time</label>
                            <div className="relative">
                                <input type="datetime-local" value={expectedAt} onChange={e => setExpectedAt(e.target.value)} required className="rounded-xl input-field text-xs font-bold"/>
                                <CalendarIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Vehicle No. (Optional)</label>
                            <input type="text" value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} placeholder="e.g. KA 01 AB 1234" className="rounded-xl input-field text-sm font-bold"/>
                        </div>
                    </div>
                    <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-white/5">
                      <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Discard</Button>
                      <Button type="submit" disabled={isSubmitting} leftIcon={isSubmitting ? <Spinner /> : <CheckCircleIcon />}>{isSubmitting ? 'Syncing...' : 'Generate Pass'}</Button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={isVerifyModalOpen} onClose={() => setIsVerifyModalOpen(false)} title="Verify Gate Pass" subtitle="SECURITY GATEWAY">
                {verifyingVisitor ? (
                    <div className="space-y-6">
                        <div className="p-5 bg-slate-50 dark:bg-black/20 rounded-3xl border border-slate-100 dark:border-white/5">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center font-black text-brand-600 text-sm">{verifyingVisitor.name[0]}</div>
                                    <div>
                                        <p className="font-brand font-extrabold text-slate-900 dark:text-slate-50 leading-none">{verifyingVisitor.name}</p>
                                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Unit {verifyingVisitor.flatNumber}</p>
                                    </div>
                                </div>
                                <span className="bg-brand-50 text-brand-600 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest">Validated</span>
                            </div>
                            
                            {!guestPhoto ? (
                                <div className="space-y-4">
                                    <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/20 flex gap-3">
                                        <SparklesIcon className="w-5 h-5 text-amber-600 shrink-0" />
                                        <p className="text-[11px] font-bold text-amber-700 leading-relaxed uppercase tracking-tight">Security Protocol: Capture guest identity photo for mandatory records.</p>
                                    </div>
                                    <CameraCapture onCapture={setGuestPhoto} onCancel={() => setVerifyingVisitor(null)} />
                                </div>
                            ) : (
                                <div className="space-y-6 animate-fadeIn">
                                    <div className="relative group rounded-[2rem] overflow-hidden border-2 border-emerald-500/50 shadow-2xl">
                                        <img src={guestPhoto} className="w-full aspect-[4/3] object-cover" alt="Captured guest" />
                                        <button 
                                            onClick={() => setGuestPhoto(null)} 
                                            className="absolute top-4 right-4 bg-black/60 text-white p-2 rounded-xl backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                        <div className="absolute bottom-4 left-4 right-4">
                                            <div className="bg-emerald-500 text-white py-2 px-4 rounded-xl text-center text-[10px] font-black uppercase tracking-[0.2em] shadow-lg">Evidence Captured</div>
                                        </div>
                                    </div>
                                    <Button 
                                        onClick={finalizeCheckIn} 
                                        className="w-full h-14 text-lg shadow-xl" 
                                        disabled={isVerifying} 
                                        leftIcon={isVerifying ? <Spinner /> : <CheckCircleIcon />}
                                    >
                                        Authorize Entry
                                    </Button>
                                    <button onClick={() => setGuestPhoto(null)} className="w-full text-center text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-brand-600 transition-colors">Retake Photo</button>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    verificationMode === 'qr' ? (
                        <div className="space-y-4">
                            <QRScanner onScan={handleCodeVerification} onClose={() => setIsVerifyModalOpen(false)} />
                            <Button variant="ghost" className="w-full text-[9px] uppercase tracking-widest font-black" onClick={() => setVerificationMode('manual')}>Switch to Manual Input</Button>
                        </div>
                    ) : (
                        <form onSubmit={(e) => { e.preventDefault(); handleCodeVerification(manualCode); }} className="space-y-5">
                            <div className="p-6 bg-slate-50 dark:bg-zinc-900 rounded-3xl border border-slate-100 dark:border-white/10 text-center shadow-inner">
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Enter 6-Digit Pass Code</label>
                                <input 
                                    type="text" 
                                    value={manualCode} 
                                    onChange={e => setManualCode(e.target.value.toUpperCase())} 
                                    maxLength={6}
                                    required 
                                    autoFocus
                                    className="block w-full text-center text-4xl font-mono font-black tracking-[0.5em] bg-white dark:bg-black/20 text-slate-900 dark:text-slate-50 rounded-2xl py-4 border-2 border-slate-100 dark:border-white/10 shadow-xl focus:ring-4 focus:ring-brand-500/20 placeholder-slate-200 dark:placeholder-zinc-800"
                                    placeholder="XXXXXX"
                                />
                                <p className="mt-4 text-[9px] text-amber-600 dark:text-amber-500 font-black uppercase tracking-widest flex items-center justify-center gap-1.5">
                                    <ShieldCheckIcon className="w-3.5 h-3.5" />
                                    Valid only for today's expected arrivals
                                </p>
                            </div>
                            <Button 
                                type="submit" 
                                className="w-full h-14 text-lg" 
                                disabled={isVerifying || manualCode.length < 5} 
                                leftIcon={isVerifying ? <Spinner /> : <ArrowRightIcon />}
                            >
                                Validate Code
                            </Button>
                            <Button variant="ghost" className="w-full text-[9px] uppercase tracking-widest font-black" onClick={() => setVerificationMode('qr')}>Return to Scanner</Button>
                        </form>
                    )
                )}
            </Modal>

            <Modal isOpen={isPassModalOpen} onClose={() => setIsPassModalOpen(false)} title="Gate Entry Pass" subtitle="DIGITAL CREDENTIAL" size="sm">
                {selectedPassVisitor && (
                    <div className="space-y-6">
                        <div className="bg-slate-50 dark:bg-black/20 p-6 rounded-[2.5rem] border border-slate-100 dark:border-white/5 text-center flex flex-col items-center">
                            <div className="w-48 h-48 bg-white p-4 rounded-3xl shadow-xl mb-6 relative group overflow-hidden">
                                <img 
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${selectedPassVisitor.entryToken || selectedPassVisitor.id}`} 
                                    alt="QR Pass"
                                    className="w-full h-full object-contain"
                                />
                                <div className="absolute inset-0 bg-brand-600/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <QrCodeIcon className="w-12 h-12 text-brand-600" />
                                </div>
                            </div>
                            
                            <h3 className="text-2xl font-brand font-extrabold text-slate-900 dark:text-slate-50 mb-1 leading-tight">{selectedPassVisitor.name}</h3>
                            <p className="text-[10px] font-black uppercase tracking-widest text-brand-600 mb-6">{selectedPassVisitor.visitorType}</p>
                            
                            <div className="bg-white dark:bg-zinc-900 py-3 px-6 rounded-2xl shadow-sm border border-slate-50 dark:border-white/5">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">Gate Code</p>
                                <p className="text-3xl font-mono font-black text-brand-600 tracking-[0.2em]">{selectedPassVisitor.entryToken || 'XXXXXX'}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            <Button 
                                onClick={async () => {
                                    if (!selectedPassVisitor || isProcessingPass) return;
                                    setIsProcessingPass(true);
                                    try {
                                        const canvas = document.createElement('canvas');
                                        const ctx = canvas.getContext('2d');
                                        if (!ctx) return;
                                        canvas.width = 800; canvas.height = 1200;
                                        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
                                        ctx.fillStyle = '#0d9488'; ctx.fillRect(0, 0, canvas.width, 220);
                                        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${selectedPassVisitor.entryToken || selectedPassVisitor.id}`;
                                        const qrImg = new Image(); qrImg.crossOrigin = "anonymous";
                                        await new Promise((res, rej) => { qrImg.onload = res; qrImg.onerror = rej; qrImg.src = qrUrl; });
                                        ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.font = 'bold 64px sans-serif'; ctx.fillText('NILAYAM', canvas.width / 2, 100);
                                        ctx.font = '32px sans-serif'; ctx.fillText('GATE SECURITY PASS', canvas.width / 2, 160);
                                        ctx.fillStyle = '#1e293b'; ctx.font = 'bold 54px sans-serif'; ctx.fillText(selectedPassVisitor.name.toUpperCase(), canvas.width / 2, 320);
                                        ctx.font = '32px sans-serif'; ctx.fillStyle = '#64748b'; ctx.fillText(`INVITED TO: ${selectedPassVisitor.flatNumber}`, canvas.width / 2, 380);
                                        ctx.drawImage(qrImg, (canvas.width - 450) / 2, 520, 450, 450);
                                        ctx.fillStyle = '#0d9488'; ctx.font = 'bold 48px monospace'; ctx.fillText(selectedPassVisitor.entryToken || 'XXXXXX', canvas.width / 2, 1050);
                                        const dataUrl = canvas.toDataURL('image/png');
                                        const blob = await (await fetch(dataUrl)).blob();
                                        const file = new File([blob], `Pass_${selectedPassVisitor.name}.png`, { type: 'image/png' });
                                        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                                            await navigator.share({ files: [file], title: 'Gate Pass', text: `Pass for ${selectedPassVisitor.name}` });
                                        } else {
                                            const link = document.createElement('a'); link.download = `Pass_${selectedPassVisitor.name}.png`; link.href = dataUrl; link.click();
                                        }
                                    } catch (e) { console.error(e); } finally { setIsProcessingPass(false); }
                                }} 
                                disabled={isProcessingPass}
                                size="lg" 
                                className="w-full h-14 text-sm font-black uppercase tracking-widest" 
                                leftIcon={isProcessingPass ? <Spinner /> : <ShareIcon />}
                            >
                                Share Pass
                            </Button>
                            <Button 
                                variant="outlined" 
                                onClick={async () => {
                                    if (!selectedPassVisitor || isProcessingPass) return;
                                    setIsProcessingPass(true);
                                    try {
                                        const canvas = document.createElement('canvas');
                                        const ctx = canvas.getContext('2d');
                                        if (!ctx) return;
                                        canvas.width = 800; canvas.height = 1200;
                                        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
                                        ctx.fillStyle = '#0d9488'; ctx.fillRect(0, 0, canvas.width, 220);
                                        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${selectedPassVisitor.entryToken || selectedPassVisitor.id}`;
                                        const qrImg = new Image(); qrImg.crossOrigin = "anonymous";
                                        await new Promise((res, rej) => { qrImg.onload = res; qrImg.onerror = rej; qrImg.src = qrUrl; });
                                        ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.font = 'bold 64px sans-serif'; ctx.fillText('NILAYAM', canvas.width / 2, 100);
                                        ctx.font = '32px sans-serif'; ctx.fillText('GATE SECURITY PASS', canvas.width / 2, 160);
                                        ctx.fillStyle = '#1e293b'; ctx.font = 'bold 54px sans-serif'; ctx.fillText(selectedPassVisitor.name.toUpperCase(), canvas.width / 2, 320);
                                        ctx.drawImage(qrImg, (canvas.width - 450) / 2, 520, 450, 450);
                                        ctx.fillStyle = '#0d9488'; ctx.font = 'bold 48px monospace'; ctx.fillText(selectedPassVisitor.entryToken || 'XXXXXX', canvas.width / 2, 1050);
                                        const dataUrl = canvas.toDataURL('image/png');
                                        const link = document.createElement('a'); link.download = `Pass_${selectedPassVisitor.name}.png`; link.href = dataUrl; link.click();
                                    } catch (e) { console.error(e); } finally { setIsProcessingPass(false); }
                                }} 
                                disabled={isProcessingPass}
                                size="lg" 
                                className="w-full h-14 text-xs font-bold uppercase tracking-widest" 
                                leftIcon={isProcessingPass ? <Spinner /> : <ArrowDownTrayIcon />}
                            >
                                Download Image
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            <AuditLogModal isOpen={isAuditOpen} onClose={() => setIsAuditOpen(false)} entityType="Visitor" title="Gate Access Audit" />
            <FeedbackModal isOpen={feedback.isOpen} onClose={() => setFeedback({ ...feedback, isOpen: false })} title={feedback.title} message={feedback.message} type={feedback.type} />
        </div>
    );
};

const ShieldCheckIcon = (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.286zm0 13.036h.008v.008h-.008v-.008z" />
    </svg>
);

export default Visitors;