
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getCommunity, updateCommunity, assignAdminUnit } from '../services/api';
import type { Community, Block } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import FeedbackModal from '../components/ui/FeedbackModal';
import { PlusIcon, TrashIcon, CheckCircleIcon, AlertTriangleIcon, HomeIcon, CurrencyRupeeIcon } from '../components/icons';

interface CommunitySetupProps {
    onComplete: () => void;
}

type SetupStep = 'landscape' | 'residence';

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
        isOpen: false,
        type: 'success',
        title: '',
        message: ''
    });

    const [blocks, setBlocks] = useState<Block[]>([]);
    const [roadCount, setRoadCount] = useState<number>(0);
    const [standaloneFloors, setStandaloneFloors] = useState<number>(0);
    const [standaloneUnitsPerFloor, setStandaloneUnitsPerFloor] = useState<number>(0);

    const [maintenanceRate, setMaintenanceRate] = useState<string>(''); 
    const [fixedMaintenanceAmount, setFixedMaintenanceAmount] = useState<string>(''); 

    const [selectedBlock, setSelectedBlock] = useState('');
    const [selectedFloor, setSelectedFloor] = useState('');
    const [flatNumber, setFlatNumber] = useState('');
    const [flatSize, setFlatSize] = useState('');
    const [maintenanceStartDate, setMaintenanceStartDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        const init = async () => {
            if (!user?.communityId) return;
            try {
                const data = await getCommunity(user.communityId);
                setCommunity(data);
                
                if (data.maintenanceRate) setMaintenanceRate(data.maintenanceRate.toString());
                if (data.fixedMaintenanceAmount) setFixedMaintenanceAmount(data.fixedMaintenanceAmount.toString());

                if (data.blocks && data.blocks.length > 0) {
                    setIsEditMode(true);
                    setBlocks(data.blocks);
                    
                    if (data.communityType === 'Gated Community Villa') {
                        setRoadCount(data.blocks.length);
                    } else if (data.communityType?.includes('Standalone')) {
                        setStandaloneFloors(data.blocks[0].floorCount);
                        setStandaloneUnitsPerFloor(data.blocks[0].unitsPerFloor || 0);
                    }

                    if (!user.units || user.units.length === 0) {
                        setStep('residence');
                        if (data.blocks.length === 1) {
                            setSelectedBlock(data.blocks[0].name);
                        }
                    }
                } else {
                    setBlocks([]);
                    setStep('landscape'); 
                }
            } catch (err) {
                console.error(err);
                setError("Failed to load community details.");
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [user]);

    const handleAddBlock = () => {
        setBlocks([...blocks, { name: '', floorCount: 0 }]);
    };

    const handleRemoveBlock = (index: number) => {
        setBlocks(blocks.filter((_, i) => i !== index));
    };

    const handleBlockChange = (index: number, field: keyof Block, value: string | number) => {
        const newBlocks = [...blocks];
        newBlocks[index] = { ...newBlocks[index], [field]: value };
        setBlocks(newBlocks);
    };

    const isLandscapeValid = () => {
        if (!community) return false;
        
        let structureValid = false;
        if (community.communityType === 'Gated Community Villa') {
            structureValid = roadCount > 0 && roadCount < 500;
        } else if (community.communityType?.includes('Standalone')) {
            structureValid = standaloneFloors > 0 && standaloneUnitsPerFloor > 0;
        } else {
            structureValid = blocks.length > 0 && blocks.every(b => b.name.trim() !== '' && b.floorCount > 0);
        }

        let maintenanceValid = false;
        if (community.communityType?.includes('Standalone')) {
            maintenanceValid = parseFloat(fixedMaintenanceAmount) > 0;
        } else {
            maintenanceValid = parseFloat(maintenanceRate) > 0;
        }

        return structureValid && maintenanceValid;
    };

    const handleSaveLandscape = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!community || !user?.communityId) return;
        setIsSubmitting(true);
        setError(null);

        try {
            let finalBlocks: Block[] = [];

            if (community.communityType === 'Gated Community Villa') {
                finalBlocks = Array.from({ length: roadCount }, (_, i) => ({
                    name: `Road ${i + 1}`,
                    floorCount: 1 
                }));
            } else if (community.communityType?.includes('Standalone')) {
                finalBlocks = [{
                    name: 'Main Building',
                    floorCount: Number(standaloneFloors),
                    unitsPerFloor: Number(standaloneUnitsPerFloor)
                }];
            } else {
                finalBlocks = blocks.map(b => ({
                    name: b.name,
                    floorCount: Number(b.floorCount)
                }));
            }

            const updatePayload = {
                blocks: finalBlocks,
                maintenanceRate: parseFloat(maintenanceRate) || 0,
                fixedMaintenanceAmount: parseFloat(fixedMaintenanceAmount) || 0
            };

            await updateCommunity(user.communityId, updatePayload);
            
            const userHasUnits = user?.units && user.units.length > 0;

            if (isEditMode && userHasUnits) {
                setFeedback({
                    isOpen: true,
                    type: 'success',
                    title: 'Success',
                    message: "Community configuration updated successfully."
                });
                onComplete();
            } else {
                setCommunity({ ...community, ...updatePayload });
                setStep('residence');
                
                if (finalBlocks.length === 1) {
                    setSelectedBlock(finalBlocks[0].name);
                }
            }

        } catch (err: any) {
            console.error("Save failed:", err);
            setFeedback({
                isOpen: true,
                type: 'error',
                title: 'Error',
                message: err.message || "Failed to save landscape."
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const getFloorOptions = () => {
        if (!selectedBlock || !community?.blocks) return [];
        const block = community.blocks.find(b => b.name === selectedBlock);
        if (!block) return [];
        return Array.from({ length: block.floorCount }, (_, i) => i + 1);
    };

    const handleSaveResidence = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !community) return;
        
        setIsSubmitting(true);
        setError(null);

        try {
            const flatSizeNum = parseFloat(flatSize);
            if (isNaN(flatSizeNum) || flatSizeNum <= 0) {
                throw new Error("Please enter a valid Flat Size.");
            }

            await assignAdminUnit({
                block: community.communityType?.includes('Standalone') ? 'Main Building' : selectedBlock,
                floor: selectedFloor ? parseInt(selectedFloor) : undefined,
                flatNumber,
                flatSize: flatSizeNum,
                maintenanceStartDate
            }, user, community);

            await refreshUser();
            setIsSuccess(true);

        } catch (err: any) {
            console.error("Residence save failed:", err);
            setFeedback({
                isOpen: true,
                type: 'error',
                title: 'Error',
                message: err.message || "Failed to assign unit."
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <div className="h-screen flex items-center justify-center"><Spinner /></div>;

    if (isSuccess) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] p-4">
                <div className="w-full max-w-md">
                    <Card className="p-8 text-center animated-card">
                        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircleIcon className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-bold text-[var(--text-light)] dark:text-[var(--text-dark)] mb-2 font-display">Setup Complete!</h2>
                        <p className="text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-6">
                            Your residence profile and maintenance schedule have been created. You can now access the dashboard.
                        </p>
                        <Button onClick={onComplete} className="w-full" size="lg" leftIcon={<HomeIcon className="w-5 h-5"/>}>
                            Go to Dashboard
                        </Button>
                    </Card>
                </div>
            </div>
        );
    }

    const isStandalone = community?.communityType?.includes('Standalone');
    const isVilla = community?.communityType === 'Gated Community Villa';
    const isHighRise = !isStandalone && !isVilla;

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div className="flex items-start gap-3">
                    <div className="w-1 h-10 bg-brand-500 rounded-full mt-1" />
                    <div>
                        <span className="text-[9px] font-mono font-black uppercase tracking-[0.3em] text-brand-600 dark:text-brand-400 mb-0.5 block">Property Config</span>
                        <h1 className="text-2xl sm:text-3xl font-brand font-extrabold text-brand-600 tracking-tight">
                            {step === 'landscape' ? "Environment Setup" : "My Residence"}
                        </h1>
                    </div>
                </div>
                {isEditMode && step === 'landscape' && (
                    <Button variant="outlined" size="sm" onClick={onComplete}>Exit Setup</Button>
                )}
            </div>

            <Card className="p-8 animated-card shadow-premium border-none bg-white dark:bg-zinc-900/40">
                {error && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 rounded-2xl flex items-start gap-3 border border-red-100 dark:border-red-900/30">
                        <AlertTriangleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <p className="text-sm font-medium">{error}</p>
                    </div>
                )}

                {step === 'landscape' && (
                    <form onSubmit={handleSaveLandscape} className="space-y-10">
                        <div className="bg-brand-50/50 dark:bg-brand-500/5 p-5 rounded-2xl border border-brand-100/50 dark:border-brand-500/10">
                            <p className="text-sm text-brand-700 dark:text-brand-300 flex justify-between items-center px-2">
                                <span className="font-black uppercase tracking-widest text-[10px] opacity-70">Active Community Profile</span>
                                <span className="font-brand font-extrabold text-xl">{community?.communityType}</span>
                            </p>
                        </div>

                        <div className="space-y-6">
                            <h3 className="text-lg font-brand font-extrabold text-slate-900 dark:text-slate-50 border-b border-slate-100 dark:border-white/5 pb-3">
                                1. Landscape Structure
                            </h3>

                            {isHighRise && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center bg-slate-50 dark:bg-black/20 p-4 rounded-2xl">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            Register society blocks / towers
                                        </p>
                                        <Button type="button" size="sm" onClick={handleAddBlock} leftIcon={<PlusIcon className="w-4 h-4"/>}>
                                            Add Block
                                        </Button>
                                    </div>
                                    
                                    {blocks.map((block, index) => (
                                        <div className="flex gap-4 items-end bg-white dark:bg-zinc-900/60 p-5 rounded-2xl border border-slate-50 dark:border-white/5 shadow-sm">
                                            <div className="flex-1">
                                                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Block Name</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="e.g. Tower A" 
                                                    value={block.name}
                                                    onChange={e => handleBlockChange(index, 'name', e.target.value)}
                                                    className="block w-full px-4 py-2.5 rounded-xl input-field text-sm font-bold"
                                                    required
                                                />
                                            </div>
                                            <div className="w-32">
                                                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Floors</label>
                                                <input 
                                                    type="number" 
                                                    min="1"
                                                    value={block.floorCount}
                                                    onChange={e => handleBlockChange(index, 'floorCount', parseInt(e.target.value))}
                                                    className="block w-full px-4 py-2.5 rounded-xl input-field text-sm font-bold"
                                                    required
                                                />
                                            </div>
                                            <div className="pb-0.5">
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleRemoveBlock(index)}
                                                    className="p-3 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-colors"
                                                >
                                                    <TrashIcon className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {isVilla && (
                                <div className="bg-slate-50 dark:bg-black/20 p-6 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm">
                                    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2.5 ml-1">
                                        Number of Roads / Streets
                                    </label>
                                    <input 
                                        type="number" 
                                        min="1"
                                        max="500"
                                        value={roadCount}
                                        onChange={e => setRoadCount(parseInt(e.target.value) || 0)}
                                        className="block w-full px-4 py-3 rounded-xl input-field text-lg font-bold"
                                        placeholder="e.g. 10"
                                    />
                                    <p className="text-[10px] font-bold text-slate-400 mt-3 ml-1 italic opacity-75 uppercase tracking-wide">
                                        Generates address patterns: "Road 1", "Road 2", etc.
                                    </p>
                                </div>
                            )}

                            {isStandalone && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 dark:bg-black/20 p-6 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm">
                                    <div>
                                        <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2.5 ml-1">Total Floors</label>
                                        <input 
                                            type="number" 
                                            min="1"
                                            value={standaloneFloors}
                                            onChange={e => setStandaloneFloors(parseInt(e.target.value) || 0)}
                                            className="block w-full px-4 py-3 rounded-xl input-field text-lg font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2.5 ml-1">Units per Floor</label>
                                        <input 
                                            type="number" 
                                            min="1"
                                            value={standaloneUnitsPerFloor}
                                            onChange={e => setStandaloneUnitsPerFloor(parseInt(e.target.value) || 0)}
                                            className="block w-full px-4 py-3 rounded-xl input-field text-lg font-bold"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-6">
                            <h3 className="text-lg font-brand font-extrabold text-slate-900 dark:text-slate-50 border-b border-slate-100 dark:border-white/5 pb-3">
                                2. Maintenance Billing
                            </h3>

                            <div className="bg-slate-50 dark:bg-black/20 p-6 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm">
                                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2.5 ml-1">
                                    {isStandalone ? 'Fixed Monthly Amount (₹)' : 'Rate per Sq. Ft (₹)'}
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <span className="text-lg font-black text-brand-600">₹</span>
                                    </div>
                                    <input 
                                        type="number" 
                                        min="0"
                                        step="0.01"
                                        value={isStandalone ? fixedMaintenanceAmount : maintenanceRate}
                                        onChange={e => isStandalone ? setFixedMaintenanceAmount(e.target.value) : setMaintenanceRate(e.target.value)}
                                        className="block w-full pl-10 pr-4 py-3 rounded-xl input-field text-2xl font-black text-brand-600"
                                        placeholder="0.00"
                                        required
                                    />
                                </div>
                                {!isStandalone && (
                                    <p className="text-[10px] font-bold text-slate-400 mt-3 ml-1 italic uppercase tracking-wide">
                                        Society Standard: Rate x Area = Monthly Dues.
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-100 dark:border-white/5 flex justify-end gap-3">
                            <Button type="submit" disabled={isSubmitting || !isLandscapeValid()} size="lg" className="px-10 shadow-xl shadow-brand-500/10">
                                {isSubmitting ? 'Syncing...' : 'Confirm structure'}
                            </Button>
                        </div>
                    </form>
                )}

                {step === 'residence' && (
                    <form onSubmit={handleSaveResidence} className="space-y-8 animated-card">
                        <div className="bg-emerald-50 dark:bg-emerald-900/10 p-5 rounded-3xl border border-emerald-100 dark:border-emerald-900/20 flex items-center gap-4">
                            <div className="p-2.5 bg-white dark:bg-black/20 rounded-xl shadow-sm text-emerald-600 dark:text-emerald-400">
                                <CheckCircleIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest text-emerald-800 dark:text-emerald-300">Architecture Validated</p>
                                <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 opacity-80 mt-0.5">Define your specific location within this layout.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {!isStandalone && (
                                <div className="sm:col-span-2">
                                    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
                                        {isVilla ? 'Road / Street' : 'Block / Tower'}
                                    </label>
                                    <div className="relative">
                                        <select 
                                            value={selectedBlock} 
                                            onChange={e => {
                                                setSelectedBlock(e.target.value);
                                                setSelectedFloor(''); 
                                            }}
                                            required
                                            className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold appearance-none bg-white dark:bg-zinc-900"
                                        >
                                            <option value="">Select Location...</option>
                                            {community?.blocks?.map((b, i) => (
                                                <option key={i} value={b.name}>{b.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {!isVilla && (
                                <div>
                                    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Floor Level</label>
                                    <select 
                                        value={selectedFloor} 
                                        onChange={e => setSelectedFloor(e.target.value)}
                                        required
                                        disabled={!isStandalone && !selectedBlock}
                                        className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold appearance-none bg-white dark:bg-zinc-900 disabled:opacity-50"
                                    >
                                        <option value="">Select Floor...</option>
                                        {isStandalone ? (
                                            Array.from({ length: community?.blocks?.[0]?.floorCount || 0 }, (_, i) => i + 1).map(f => (
                                                <option key={f} value={f}>{f}</option>
                                            ))
                                        ) : (
                                            getFloorOptions().map(f => (
                                                <option key={f} value={f}>{f}</option>
                                            ))
                                        )}
                                    </select>
                                </div>
                            )}

                            <div className={isVilla ? "sm:col-span-2" : ""}>
                                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
                                    {isVilla ? 'Villa Number' : 'Flat Number'}
                                </label>
                                <input 
                                    type="text" 
                                    value={flatNumber}
                                    onChange={e => setFlatNumber(e.target.value)}
                                    required
                                    placeholder="e.g. 101"
                                    className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold"
                                />
                            </div>

                            <div>
                                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Carpet Area (Sq. Ft)</label>
                                <input 
                                    type="number" 
                                    value={flatSize}
                                    onChange={e => setFlatSize(e.target.value)}
                                    required
                                    min="1"
                                    placeholder="0"
                                    className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold"
                                />
                            </div>

                            <div>
                                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Possession Date</label>
                                <input 
                                    type="date" 
                                    value={maintenanceStartDate}
                                    onChange={e => setMaintenanceStartDate(e.target.value)}
                                    required
                                    className="block w-full px-4 py-3 rounded-xl input-field text-xs font-bold"
                                />
                            </div>
                        </div>

                        <div className="pt-8 border-t border-slate-100 dark:border-white/5">
                            <Button type="submit" disabled={isSubmitting} size="lg" className="w-full shadow-xl shadow-brand-500/10">
                                {isSubmitting ? 'Finalizing Profile...' : 'Authorize residence profile'}
                            </Button>
                        </div>
                    </form>
                )}
            </Card>

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

export default CommunitySetup;
