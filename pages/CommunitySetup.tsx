
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getCommunity, updateCommunity, assignAdminUnit, setInitialOpeningBalance, requestOpeningBalanceUpdate, approveOpeningBalanceUpdate, rejectOpeningBalanceUpdate } from '../services/api';
import type { Community, Block } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import FeedbackModal from '../components/ui/FeedbackModal';
import Modal from '../components/ui/Modal';
import { PlusIcon, TrashIcon, CheckCircleIcon, AlertTriangleIcon, HomeIcon, CurrencyRupeeIcon, ClockIcon, XIcon, ArrowRightIcon, CalendarIcon, Squares2X2Icon, ChevronDownIcon } from '../components/icons';

interface CommunitySetupProps {
    onComplete: () => void;
}

type SetupStep = 'landscape' | 'opening_balance' | 'residence';

const CommunitySetup: React.FC<CommunitySetupProps> = ({ onComplete }) => {
    const { user, refreshUser } = useAuth();
    const [step, setStep] = useState<SetupStep>('landscape');
    const [community, setCommunity] = useState<Community | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const [feedback, setFeedback] = useState<{ isOpen: boolean; type: 'success' | 'error' | 'info'; title: string; message: string }>({
        isOpen: false, type: 'success', title: '', message: ''
    });

    // Landscape States
    const [blocks, setBlocks] = useState<Block[]>([]);
    const [roadCount, setRoadCount] = useState<number>(0);
    const [standaloneFloors, setStandaloneFloors] = useState<number>(0);
    const [standaloneUnitsPerFloor, setStandaloneUnitsPerFloor] = useState<number>(0);
    const [maintenanceRate, setMaintenanceRate] = useState<string>(''); 
    const [fixedMaintenanceAmount, setFixedMaintenanceAmount] = useState<string>(''); 

    // Opening Balance States
    const [openingBalance, setOpeningBalance] = useState<string>('0');
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [requestReason, setRequestReason] = useState('');
    const [requestAmount, setRequestAmount] = useState('');

    // Residence States
    const [selectedBlock, setSelectedBlock] = useState('');
    const [selectedFloor, setSelectedFloor] = useState('');
    const [flatNumber, setFlatNumber] = useState('');
    const [flatSize, setFlatSize] = useState('');
    const [maintenanceStartDate, setMaintenanceStartDate] = useState(new Date().toISOString().split('T')[0]);

    const init = async () => {
        if (!user?.communityId) return;
        try {
            setLoading(true);
            const data = await getCommunity(user.communityId);
            hydrateState(data);
        } catch (err) {
            console.error("Setup Init Error:", err);
            setError("Failed to load community details.");
        } finally {
            setLoading(false);
        }
    };

    const hydrateState = (data: Community) => {
        setCommunity(data);
        
        // 1. Hydrate Landscape & Financials
        if (data.maintenanceRate !== undefined && data.maintenanceRate !== null) setMaintenanceRate(data.maintenanceRate.toString());
        if (data.fixedMaintenanceAmount !== undefined && data.fixedMaintenanceAmount !== null) setFixedMaintenanceAmount(data.fixedMaintenanceAmount.toString());
        if (data.openingBalance !== undefined && data.openingBalance !== null) setOpeningBalance(data.openingBalance.toString());

        if (data.blocks && data.blocks.length > 0) {
            setIsEditMode(true);
            setBlocks(data.blocks);
            
            const cType = data.communityType || '';
            if (cType === 'Gated Community Villa') {
                setRoadCount(data.blocks.length);
            } else if (cType.includes('Standalone')) {
                const firstBlock = data.blocks[0];
                setStandaloneFloors(firstBlock.floorCount || 0);
                setStandaloneUnitsPerFloor(firstBlock.unitsPerFloor || 0);
            }
        }

        // 2. Hydrate Existing Residence Data from User Profile
        if (user?.units && user.units.length > 0) {
            const primaryUnit = user.units[0];
            setSelectedBlock(primaryUnit.block || '');
            setSelectedFloor(primaryUnit.floor ? primaryUnit.floor.toString() : '');
            setFlatNumber(primaryUnit.flatNumber || '');
            setFlatSize(primaryUnit.flatSize ? primaryUnit.flatSize.toString() : '');
            if (primaryUnit.maintenanceStartDate) {
                setMaintenanceStartDate(new Date(primaryUnit.maintenanceStartDate).toISOString().split('T')[0]);
            }
        }
    };

    const refreshSetupData = async () => {
        if (!user?.communityId) return;
        try {
            const data = await getCommunity(user.communityId);
            hydrateState(data);
        } catch (e) {
            console.warn("Refresh failed:", e);
        }
    }

    useEffect(() => { init(); }, [user?.id]);

    useEffect(() => {
        if (!loading && selectedBlock) {
             const block = community?.blocks?.find(b => b.name === selectedBlock);
             const floorNum = parseInt(selectedFloor);
             if (block && floorNum > block.floorCount) {
                 setSelectedFloor('');
             }
        }
    }, [selectedBlock]);

    const handleSaveLandscape = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!community || !user?.communityId) return;
        setIsSubmitting(true);
        try {
            let finalBlocks: Block[] = [];
            const cType = community.communityType || '';
            
            if (cType === 'Gated Community Villa') {
                finalBlocks = Array.from({ length: roadCount }, (_, i) => ({ name: `Road ${i + 1}`, floorCount: 1 }));
            } else if (cType.includes('Standalone')) {
                finalBlocks = [{ 
                    name: 'Main Building', 
                    floorCount: Number(standaloneFloors), 
                    unitsPerFloor: Number(standaloneUnitsPerFloor) 
                }];
            } else {
                finalBlocks = blocks.map(b => ({ name: b.name, floorCount: Number(b.floorCount) }));
            }

            const updatePayload: Partial<Community> = {
                blocks: finalBlocks,
                maintenanceRate: parseFloat(maintenanceRate) || 0,
                fixedMaintenanceAmount: parseFloat(fixedMaintenanceAmount) || 0
            };

            await updateCommunity(user.communityId, updatePayload);
            await refreshSetupData();
            setStep('opening_balance');
        } catch (err: any) {
            setFeedback({ isOpen: true, type: 'error', title: 'Landscape Save Failed', message: err.message || 'Check database permissions.' });
        } finally { setIsSubmitting(false); }
    };

    const handleSaveOpeningBalance = async () => {
        if (!community) return;
        setIsSubmitting(true);
        try {
            await setInitialOpeningBalance(community.id, parseFloat(openingBalance));
            await refreshSetupData();
            setStep('residence');
        } catch (err: any) {
            setFeedback({ isOpen: true, type: 'error', title: 'Financials Save Failed', message: err.message });
        } finally { setIsSubmitting(false); }
    };

    const handleRequestChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!community || !user) return;
        setIsSubmitting(true);
        try {
            await requestOpeningBalanceUpdate(community.id, parseFloat(requestAmount), requestReason, user);
            setIsRequestModalOpen(false);
            setFeedback({ isOpen: true, type: 'success', title: 'Request Dispatched', message: 'Your modification request has been sent for peer-admin approval.' });
            await refreshSetupData();
        } catch (err: any) {
            setFeedback({ isOpen: true, type: 'error', title: 'Request Failed', message: err.message });
        } finally { setIsSubmitting(false); }
    };

    const handleApprove = async () => {
        if (!community || !community.pendingBalanceUpdate) return;
        setIsSubmitting(true);
        try {
            await approveOpeningBalanceUpdate(community.id, community.pendingBalanceUpdate.amount);
            setFeedback({ isOpen: true, type: 'success', title: 'Ledger Reconciled', message: 'The opening balance has been updated based on the approved request.' });
            await refreshSetupData();
        } catch (err: any) {
            setFeedback({ isOpen: true, type: 'error', title: 'Approval Failed', message: err.message });
        } finally { setIsSubmitting(false); }
    };

    const handleReject = async () => {
        if (!community) return;
        setIsSubmitting(true);
        try {
            await rejectOpeningBalanceUpdate(community.id);
            setFeedback({ isOpen: true, type: 'info', title: 'Request Discarded', message: 'The modification request has been rejected.' });
            await refreshSetupData();
        } catch (err: any) {
            setFeedback({ isOpen: true, type: 'error', title: 'Rejection Failed', message: err.message });
        } finally { setIsSubmitting(false); }
    };

    const handleSaveResidence = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !community) return;
        setIsSubmitting(true);
        try {
            await assignAdminUnit({
                block: community.communityType?.includes('Standalone') ? 'Main Building' : selectedBlock,
                floor: selectedFloor ? parseInt(selectedFloor) : undefined,
                flatNumber,
                flatSize: parseFloat(flatSize),
                maintenanceStartDate
            }, user, community);
            await refreshUser();
            setIsSuccess(true);
        } catch (err: any) {
            setFeedback({ isOpen: true, type: 'error', title: 'Assignment Failed', message: err.message });
        } finally { setIsSubmitting(false); }
    };

    // Derived flags for UI conditional logic
    const isStandaloneType = community?.communityType?.includes('Standalone');
    const isVillaType = community?.communityType === 'Gated Community Villa';
    const isHighRise = !isStandaloneType && !isVillaType;

    // Fix: Changed 'isStandalone' to 'isStandaloneType' to match correctly scoped variable
    const getFloorOptions = () => {
        if (!community?.blocks) return [];
        if (isStandaloneType) {
            const floorCount = community.blocks[0]?.floorCount || 0;
            return Array.from({ length: floorCount }, (_, i) => i + 1);
        }
        const block = community.blocks.find(b => b.name === selectedBlock);
        return block ? Array.from({ length: block.floorCount }, (_, i) => i + 1) : [];
    };

    if (loading) return <div className="h-screen flex items-center justify-center"><Spinner /></div>;

    if (isSuccess) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <Card className="p-8 text-center max-w-md">
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircleIcon className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2 font-brand">Setup Complete!</h2>
                    <p className="text-slate-500 mb-6">Your residence profile and carry-forward balance are secured.</p>
                    <Button onClick={onComplete} className="w-full" size="lg" leftIcon={<HomeIcon />}>Enter Dashboard</Button>
                </Card>
            </div>
        );
    }

    const steps = [
        { id: 'landscape', label: 'Landscape', icon: Squares2X2Icon },
        { id: 'opening_balance', label: 'Financials', icon: CurrencyRupeeIcon },
        { id: 'residence', label: 'My Unit', icon: HomeIcon },
    ];

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-start gap-3">
                    <div className="w-1 h-10 bg-brand-500 rounded-full mt-1" />
                    <div>
                        <span className="text-[9px] font-mono font-black uppercase tracking-[0.3em] text-brand-600 mb-0.5 block">Configuration Wizard</span>
                        <h1 className="text-2xl sm:text-3xl font-brand font-extrabold text-brand-600 tracking-tight">Property Setup</h1>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between bg-white dark:bg-zinc-900/40 p-4 rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-sm overflow-x-auto no-scrollbar">
                {steps.map((s, i) => {
                    const isActive = step === s.id;
                    const isCompleted = i < steps.findIndex(x => x.id === step) || (s.id === 'landscape' && isEditMode) || (s.id === 'opening_balance' && community?.openingBalanceLocked);
                    const canNavigate = isEditMode || i === 0;

                    return (
                        <React.Fragment key={s.id}>
                            <button
                                disabled={!canNavigate}
                                onClick={() => setStep(s.id as SetupStep)}
                                className={`flex items-center gap-3 px-4 py-2 rounded-2xl transition-all whitespace-nowrap ${
                                    isActive 
                                    ? 'bg-brand-600 text-white shadow-lg' 
                                    : isCompleted 
                                        ? 'text-emerald-600 dark:text-emerald-400' 
                                        : 'text-slate-400 opacity-50'
                                }`}
                            >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                                    isActive ? 'bg-white text-brand-600' : isCompleted ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-slate-100 dark:bg-zinc-800'
                                }`}>
                                    {isCompleted && !isActive ? <CheckCircleIcon className="w-5 h-5" /> : i + 1}
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest">{s.label}</span>
                            </button>
                            {i < steps.length - 1 && (
                                <div className="flex-1 mx-4 min-w-[20px] h-0.5 bg-slate-100 dark:bg-white/5" />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>

            <Card className="p-8 shadow-premium border-none bg-white dark:bg-zinc-900/40">
                {step === 'landscape' && (
                    <form onSubmit={handleSaveLandscape} className="space-y-10">
                        <div className="space-y-6">
                            <h3 className="text-lg font-brand font-extrabold text-slate-900 dark:text-slate-50 border-b border-slate-100 dark:border-white/5 pb-3 flex items-center gap-2">
                                <Squares2X2Icon className="w-5 h-5 text-brand-600" />
                                1. Landscape Structure
                            </h3>
                            {isHighRise && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center bg-slate-50 dark:bg-black/20 p-4 rounded-2xl">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Register society blocks / towers</p>
                                        <Button type="button" size="sm" onClick={() => setBlocks([...blocks, { name: '', floorCount: 0 }])} leftIcon={<PlusIcon />}>Add Block</Button>
                                    </div>
                                    {blocks.map((block, index) => (
                                        <div key={index} className="flex gap-4 items-end bg-white dark:bg-zinc-900/60 p-5 rounded-2xl border border-slate-50 dark:border-white/5 shadow-sm">
                                            <div className="flex-1">
                                                <label className="block text-[9px] font-black uppercase text-slate-400 mb-1.5 ml-1">Block Name</label>
                                                <input type="text" value={block.name} onChange={e => { const b = [...blocks]; b[index].name = e.target.value; setBlocks(b); }} className="block w-full px-4 py-2.5 rounded-xl input-field text-sm font-bold" required/>
                                            </div>
                                            <div className="w-32">
                                                <label className="block text-[9px] font-black uppercase text-slate-400 mb-1.5 ml-1">Floors</label>
                                                <input type="number" value={block.floorCount} onChange={e => { const b = [...blocks]; b[index].floorCount = parseInt(e.target.value); setBlocks(b); }} className="block w-full px-4 py-2.5 rounded-xl input-field text-sm font-bold" required/>
                                            </div>
                                            <button type="button" onClick={() => setBlocks(blocks.filter((_, i) => i !== index))} className="p-3 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"><TrashIcon className="w-5 h-5" /></button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {isVillaType && (
                                <div className="bg-slate-50 dark:bg-black/20 p-6 rounded-2xl border border-slate-100 dark:border-white/5">
                                    <label className="block text-[9px] font-black uppercase text-slate-400 mb-2.5 ml-1">Number of Roads / Streets</label>
                                    <input type="number" value={roadCount} onChange={e => setRoadCount(parseInt(e.target.value) || 0)} className="block w-full px-4 py-3 rounded-xl input-field text-lg font-bold" required/>
                                </div>
                            )}
                            {isStandaloneType && (
                                <div className="grid grid-cols-2 gap-6 bg-slate-50 dark:bg-black/20 p-6 rounded-2xl">
                                    <div><label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Floors</label><input type="number" value={standaloneFloors} onChange={e => setStandaloneFloors(parseInt(e.target.value))} className="block w-full px-4 py-2 rounded-xl input-field font-bold"/></div>
                                    <div><label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Units/Floor</label><input type="number" value={standaloneUnitsPerFloor} onChange={e => setStandaloneUnitsPerFloor(parseInt(e.target.value))} className="block w-full px-4 py-2 rounded-xl input-field font-bold"/></div>
                                </div>
                            )}
                        </div>
                        <div className="space-y-6">
                            <h3 className="text-lg font-brand font-extrabold text-slate-900 dark:text-slate-50 border-b border-slate-100 dark:border-white/5 pb-3">2. Maintenance Billing</h3>
                            <div className="bg-slate-50 dark:bg-black/20 p-6 rounded-2xl">
                                <label className="block text-[9px] font-black uppercase text-slate-400 mb-2.5 ml-1">{isStandaloneType ? 'Fixed Monthly Amount (₹)' : 'Rate per Sq. Ft (₹)'}</label>
                                <input type="number" value={isStandaloneType ? fixedMaintenanceAmount : maintenanceRate} onChange={e => isStandaloneType ? setFixedMaintenanceAmount(e.target.value) : setMaintenanceRate(e.target.value)} className="block w-full px-4 py-3 rounded-xl input-field text-2xl font-black text-brand-600" required/>
                            </div>
                        </div>
                        <div className="pt-6 flex justify-end">
                            <Button type="submit" disabled={isSubmitting} size="lg" className="px-10">Confirm Structure</Button>
                        </div>
                    </form>
                )}

                {step === 'opening_balance' && (
                    <div className="space-y-8 animate-fadeIn">
                        <div className="bg-amber-50 dark:bg-amber-900/10 p-6 rounded-[2rem] border border-amber-100 flex gap-4">
                            <AlertTriangleIcon className="w-8 h-8 text-amber-600 shrink-0" />
                            <div>
                                <p className="text-xs font-black uppercase text-amber-800 dark:text-amber-300">Legacy Funds Integration</p>
                                <p className="text-sm text-amber-700/80 mt-1 font-medium leading-relaxed">Enter the current cash-in-hand or bank balance from your previous management records. This amount will serve as the mathematical foundation for your first automated ledger.</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="p-10 bg-slate-50 dark:bg-black/20 rounded-[3rem] border border-slate-100 dark:border-white/5 text-center relative group">
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">SOCIETY OPENING BALANCE (₹)</label>
                                <div className="relative max-w-xs mx-auto">
                                    <div className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-brand font-extrabold text-slate-300">₹</div>
                                    <input 
                                        type="number" 
                                        value={openingBalance} 
                                        onChange={e => setOpeningBalance(e.target.value)}
                                        disabled={community?.openingBalanceLocked}
                                        className="block w-full pl-12 pr-6 py-5 text-4xl text-center font-brand font-extrabold text-brand-600 bg-white dark:bg-zinc-900 rounded-[2.5rem] border-none shadow-2xl disabled:opacity-60 transition-all focus:ring-4 focus:ring-brand-500/20"
                                    />
                                    {community?.openingBalanceLocked && (
                                        <div className="absolute -top-3 -right-3 bg-slate-800 text-white p-2.5 rounded-full shadow-lg" title="Balance Locked for Auditing">
                                            <ClockIcon className="w-5 h-5" />
                                        </div>
                                    )}
                                </div>
                                <p className="text-[10px] text-slate-400 mt-6 font-bold uppercase tracking-widest">
                                    {parseFloat(openingBalance) >= 0 ? 'Projected Surplus' : 'Projected Deficit'}
                                </p>
                            </div>

                            {community?.pendingBalanceUpdate && (
                                <div className="p-6 bg-brand-50 dark:bg-brand-900/10 rounded-3xl border border-brand-200 shadow-sm animate-pulse">
                                    <h4 className="text-[10px] font-black uppercase text-brand-600 mb-3 flex items-center gap-2">
                                        <ClockIcon className="w-4 h-4" /> Pending Ledger Revision
                                    </h4>
                                    <div className="bg-white dark:bg-black/40 p-4 rounded-2xl mb-4">
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Adjustment: ₹{community.pendingBalanceUpdate.amount.toLocaleString()}</p>
                                        <p className="text-xs text-slate-500 mt-2 italic font-medium">Reason: "{community.pendingBalanceUpdate.reason}"</p>
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        {community.pendingBalanceUpdate.requesterId !== user?.id ? (
                                            <>
                                                <Button size="sm" onClick={handleApprove} className="bg-emerald-600 flex-1">Authorize Correction</Button>
                                                <Button size="sm" variant="outlined" onClick={handleReject} className="text-rose-600 flex-1 border-rose-200">Decline</Button>
                                            </>
                                        ) : (
                                            <div className="w-full text-center py-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                                                <p className="text-[9px] font-black uppercase text-amber-600">Awaiting Peer Admin Peer-Approval</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-between items-center pt-4">
                                <Button variant="outlined" onClick={() => setStep('landscape')} size="lg" className="px-8">Back</Button>
                                <div className="flex gap-3">
                                    {!community?.openingBalanceLocked ? (
                                        <Button onClick={handleSaveOpeningBalance} size="lg" className="px-10 shadow-xl" leftIcon={<CheckCircleIcon />}>Lock Foundation</Button>
                                    ) : (
                                        <>
                                            {!community.pendingBalanceUpdate && (
                                                <Button variant="outlined" onClick={() => { setRequestAmount(openingBalance); setIsRequestModalOpen(true); }} size="lg">Modify Balance</Button>
                                            )}
                                            <Button onClick={() => setStep('residence')} size="lg" className="px-10 shadow-xl" rightIcon={<ArrowRightIcon />}>Next Step</Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {step === 'residence' && (
                    <form onSubmit={handleSaveResidence} className="space-y-8 animate-fadeIn">
                        <div className="bg-slate-50 dark:bg-white/5 p-6 rounded-3xl mb-4 border border-slate-100 dark:border-white/5">
                            <h3 className="text-base font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-3">
                                <HomeIcon className="w-5 h-5 text-brand-600" /> Final Step: Assign Your Admin Unit
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                {/* Block / Road Selection */}
                                {!isStandaloneType && (
                                    <div className="sm:col-span-2">
                                        <label className="block text-[9px] font-black uppercase text-slate-400 mb-1.5 ml-1">{isVillaType ? 'Road / Street' : 'Block / Tower'}</label>
                                        <div className="relative">
                                            <select value={selectedBlock} onChange={e => { setSelectedBlock(e.target.value); setSelectedFloor(''); }} required className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold appearance-none bg-white dark:bg-zinc-900">
                                                <option value="">Select Location...</option>
                                                {community?.blocks?.map((b, i) => <option key={i} value={b.name}>{b.name}</option>)}
                                            </select>
                                            <ChevronDownIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                        </div>
                                    </div>
                                )}

                                {/* Floor Selection (Restored) */}
                                {!isVillaType && (
                                    <div className={isStandaloneType ? "sm:col-span-2" : ""}>
                                        <label className="block text-[9px] font-black uppercase text-slate-400 mb-1.5 ml-1">Floor Level</label>
                                        <div className="relative">
                                            <select 
                                                value={selectedFloor} 
                                                onChange={e => setSelectedFloor(e.target.value)} 
                                                required 
                                                disabled={!isStandaloneType && !selectedBlock}
                                                className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold appearance-none bg-white dark:bg-zinc-900 disabled:opacity-50"
                                            >
                                                <option value="">Select Floor...</option>
                                                {getFloorOptions().map(f => <option key={f} value={f}>Floor {f}</option>)}
                                            </select>
                                            <ChevronDownIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                        </div>
                                    </div>
                                )}

                                {/* Flat / Villa Number */}
                                <div className={(isVillaType || !isHighRise) ? "sm:col-span-2" : ""}>
                                    <label className="block text-[9px] font-black uppercase text-slate-400 mb-1.5 ml-1">{isVillaType ? 'Villa Number' : 'Flat Number'}</label>
                                    <input type="text" value={flatNumber} onChange={e => setFlatNumber(e.target.value)} required placeholder="e.g. 101" className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold"/>
                                </div>

                                {/* Carpet Area */}
                                <div>
                                    <label className="block text-[9px] font-black uppercase text-slate-400 mb-1.5 ml-1">Carpet Area (Sq. Ft)</label>
                                    <input type="number" value={flatSize} onChange={e => setFlatSize(e.target.value)} required min="1" className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold"/>
                                </div>

                                {/* Start Date */}
                                <div className="sm:col-span-2">
                                    <label className="block text-[9px] font-black uppercase text-slate-400 mb-1.5 ml-1">Maintenance Billing Start Date</label>
                                    <div className="relative">
                                        <input type="date" value={maintenanceStartDate} onChange={e => setMaintenanceStartDate(e.target.value)} required className="block w-full px-4 py-3 rounded-xl input-field text-xs font-bold"/>
                                        <CalendarIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-2 font-medium">Your personal ledger will be initialized from this date.</p>
                                </div>
                            </div>
                        </div>
                        <div className="pt-4 flex justify-between">
                             <Button variant="outlined" onClick={() => setStep('opening_balance')} size="lg" className="px-8">Back</Button>
                             <Button type="submit" disabled={isSubmitting} size="lg" className="px-10 shadow-xl" leftIcon={<CheckCircleIcon />}>Complete Setup</Button>
                        </div>
                    </form>
                )}
            </Card>

            <Modal isOpen={isRequestModalOpen} onClose={() => setIsRequestModalOpen(false)} title="Modify Ledger Start" subtitle="PEER REVIEW REQUIRED">
                <form onSubmit={handleRequestChange} className="space-y-4">
                    <div>
                        <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">New Balance (₹)</label>
                        <input type="number" value={requestAmount} onChange={e => setRequestAmount(e.target.value)} required className="block w-full px-4 py-3 rounded-xl input-field font-bold"/>
                    </div>
                    <div>
                        <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Modification Reason</label>
                        <textarea value={requestReason} onChange={e => setRequestReason(e.target.value)} required rows={3} placeholder="e.g. Found unrecorded utility bill from previous society tenure..." className="block w-full px-4 py-3 rounded-xl input-field text-sm font-medium leading-relaxed"></textarea>
                    </div>
                    <div className="flex justify-end pt-2 gap-3">
                         <Button variant="ghost" type="button" onClick={() => setIsRequestModalOpen(false)}>Cancel</Button>
                         <Button type="submit" disabled={isSubmitting}>Send Request</Button>
                    </div>
                </form>
            </Modal>

            <FeedbackModal isOpen={feedback.isOpen} onClose={() => setFeedback({ ...feedback, isOpen: false })} title={feedback.title} message={feedback.message} type={feedback.type} />
        </div>
    );
};

export default CommunitySetup;
