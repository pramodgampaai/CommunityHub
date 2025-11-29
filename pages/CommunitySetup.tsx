
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getCommunity, updateCommunity, assignAdminUnit } from '../services/api';
import type { Community, Block } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import { PlusIcon, TrashIcon, CheckCircleIcon, AlertTriangleIcon } from '../components/icons';

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

    // --- Landscape State ---
    const [blocks, setBlocks] = useState<Block[]>([]);
    // Villa Specific
    const [roadCount, setRoadCount] = useState<number>(0);
    // Standalone Specific
    const [standaloneFloors, setStandaloneFloors] = useState<number>(0);
    const [standaloneUnitsPerFloor, setStandaloneUnitsPerFloor] = useState<number>(0);

    // --- Residence State ---
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
                
                if (data.blocks && data.blocks.length > 0) {
                    setIsEditMode(true);
                    setBlocks(data.blocks);
                    
                    // Pre-fill helper states based on type
                    if (data.communityType === 'Gated Community Villa') {
                        setRoadCount(data.blocks.length);
                    } else if (data.communityType?.includes('Standalone')) {
                        setStandaloneFloors(data.blocks[0].floorCount);
                        setStandaloneUnitsPerFloor(data.blocks[0].unitsPerFloor || 0);
                    }
                } else {
                    // Initialize empty blocks for High-Rise if new
                    setBlocks([]);
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

    // --- Landscape Handlers ---

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
        
        if (community.communityType === 'Gated Community Villa') {
            return roadCount > 0 && roadCount < 500;
        }
        if (community.communityType?.includes('Standalone')) {
            return standaloneFloors > 0 && standaloneUnitsPerFloor > 0;
        }
        // High-Rise
        return blocks.length > 0 && blocks.every(b => b.name.trim() !== '' && b.floorCount > 0);
    };

    const handleSaveLandscape = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!community || !user?.communityId) return;
        setIsSubmitting(true);
        setError(null);

        try {
            let finalBlocks: Block[] = [];

            if (community.communityType === 'Gated Community Villa') {
                // Generate Road blocks
                finalBlocks = Array.from({ length: roadCount }, (_, i) => ({
                    name: `Road ${i + 1}`,
                    floorCount: 1 // Default for Villas
                }));
            } else if (community.communityType?.includes('Standalone')) {
                // Generate Single Block
                finalBlocks = [{
                    name: 'Main Building',
                    floorCount: Number(standaloneFloors),
                    unitsPerFloor: Number(standaloneUnitsPerFloor)
                }];
            } else {
                // High-Rise uses the dynamic list
                finalBlocks = blocks.map(b => ({
                    name: b.name,
                    floorCount: Number(b.floorCount)
                }));
            }

            await updateCommunity(user.communityId, { blocks: finalBlocks });
            
            // If in Edit Mode, we are done (updating landscape doesn't require re-assigning unit)
            if (isEditMode) {
                alert("Landscape updated successfully.");
                onComplete();
            } else {
                // Determine next step
                // Update local state to reflect the saved blocks for the next step dropdowns
                setCommunity({ ...community, blocks: finalBlocks });
                setStep('residence');
                
                // Pre-select block if only one (Standalone or 1 Tower)
                if (finalBlocks.length === 1) {
                    setSelectedBlock(finalBlocks[0].name);
                }
            }

        } catch (err: any) {
            console.error("Save failed:", err);
            setError(err.message || "Failed to save landscape.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- Residence Handlers ---

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

            // Refresh user profile to get updated units and clear gatekeeper
            await refreshUser();
            
            // Navigate to Dashboard
            onComplete();

        } catch (err: any) {
            console.error("Residence save failed:", err);
            setError(err.message || "Failed to assign unit.");
            setIsSubmitting(false);
        }
    };

    if (loading) return <div className="h-screen flex items-center justify-center"><Spinner /></div>;

    return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] p-4">
            <div className="w-full max-w-2xl">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-brand font-bold text-brand-500 mb-2">
                        {isEditMode ? 'Community Landscape' : 'Welcome to Elevate'}
                    </h1>
                    <p className="text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                        {step === 'landscape' 
                            ? "Let's define the structure of your community." 
                            : "One last step! Tell us where you live."}
                    </p>
                </div>

                <Card className="p-6 sm:p-8 animated-card">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 rounded-lg flex items-start gap-3">
                            <AlertTriangleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <p className="text-sm">{error}</p>
                        </div>
                    )}

                    {step === 'landscape' && (
                        <form onSubmit={handleSaveLandscape} className="space-y-6">
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-900/30">
                                <p className="text-sm text-blue-800 dark:text-blue-200">
                                    <span className="font-bold">Community Type:</span> {community?.communityType}
                                </p>
                            </div>

                            {/* --- High Rise Form --- */}
                            {community?.communityType === 'High-Rise Apartment' && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Blocks / Towers</label>
                                        <Button type="button" size="sm" variant="outlined" onClick={handleAddBlock} leftIcon={<PlusIcon className="w-4 h-4"/>}>
                                            Add Block
                                        </Button>
                                    </div>
                                    
                                    {blocks.length === 0 && (
                                        <p className="text-center text-sm text-[var(--text-secondary-light)] italic py-4">No blocks added yet.</p>
                                    )}

                                    {blocks.map((block, index) => (
                                        <div key={index} className="flex gap-4 items-start">
                                            <div className="flex-1">
                                                <input 
                                                    type="text" 
                                                    placeholder="Block Name (e.g. A, Tower 1)" 
                                                    value={block.name}
                                                    onChange={e => handleBlockChange(index, 'name', e.target.value)}
                                                    className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"
                                                    required
                                                />
                                            </div>
                                            <div className="w-32">
                                                <input 
                                                    type="number" 
                                                    placeholder="Floors" 
                                                    min="1"
                                                    value={block.floorCount}
                                                    onChange={e => handleBlockChange(index, 'floorCount', parseInt(e.target.value))}
                                                    className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"
                                                    required
                                                />
                                            </div>
                                            <button 
                                                type="button" 
                                                onClick={() => handleRemoveBlock(index)}
                                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                            >
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* --- Villa Form --- */}
                            {community?.communityType === 'Gated Community Villa' && (
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-2">
                                        Number of Roads / Streets
                                    </label>
                                    <input 
                                        type="number" 
                                        min="1"
                                        max="500"
                                        value={roadCount}
                                        onChange={e => setRoadCount(parseInt(e.target.value) || 0)}
                                        className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"
                                        placeholder="e.g. 10"
                                    />
                                    <p className="text-xs text-[var(--text-secondary-light)] mt-2">
                                        We will automatically generate blocks named "Road 1", "Road 2", etc.
                                    </p>
                                </div>
                            )}

                            {/* --- Standalone Form --- */}
                            {community?.communityType?.includes('Standalone') && (
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-2">
                                            Total Floors
                                        </label>
                                        <input 
                                            type="number" 
                                            min="1"
                                            max="200"
                                            value={standaloneFloors}
                                            onChange={e => setStandaloneFloors(parseInt(e.target.value) || 0)}
                                            className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-2">
                                            Flats per Floor
                                        </label>
                                        <input 
                                            type="number" 
                                            min="1"
                                            max="50"
                                            value={standaloneUnitsPerFloor}
                                            onChange={e => setStandaloneUnitsPerFloor(parseInt(e.target.value) || 0)}
                                            className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="pt-6 border-t border-[var(--border-light)] dark:border-[var(--border-dark)] flex justify-end gap-3">
                                {isEditMode && (
                                    <Button type="button" variant="outlined" onClick={onComplete} disabled={isSubmitting}>
                                        Cancel
                                    </Button>
                                )}
                                <Button type="submit" disabled={isSubmitting || !isLandscapeValid()}>
                                    {isSubmitting ? 'Saving...' : (isEditMode ? 'Update Landscape' : 'Save & Continue')}
                                </Button>
                            </div>
                        </form>
                    )}

                    {step === 'residence' && (
                        <form onSubmit={handleSaveResidence} className="space-y-6 animated-card">
                            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-100 dark:border-green-900/30 flex items-center gap-3">
                                <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                                <p className="text-sm text-green-800 dark:text-green-200">Landscape set up successfully!</p>
                            </div>

                            <p className="text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                                As an Admin, you are also a resident. Please enter the details of the unit you own/reside in. 
                                This will create your maintenance profile.
                            </p>

                            {/* Block/Road Selection - Hidden for Standalone if auto-generated */}
                            {!community?.communityType?.includes('Standalone') && (
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">
                                        {community?.communityType === 'Gated Community Villa' ? 'Road / Street' : 'Block / Tower'}
                                    </label>
                                    <select 
                                        value={selectedBlock} 
                                        onChange={e => {
                                            setSelectedBlock(e.target.value);
                                            setSelectedFloor(''); 
                                        }}
                                        required
                                        className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-[var(--bg-light)] dark:bg-[var(--bg-dark)]"
                                    >
                                        <option value="">Select...</option>
                                        {community?.blocks?.map((b, i) => (
                                            <option key={i} value={b.name}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-6">
                                {/* Floor Selection */}
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Floor</label>
                                    {community?.communityType?.includes('Standalone') ? (
                                        <select 
                                            value={selectedFloor} 
                                            onChange={e => setSelectedFloor(e.target.value)}
                                            required
                                            className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-[var(--bg-light)] dark:bg-[var(--bg-dark)]"
                                        >
                                            <option value="">Select...</option>
                                            {Array.from({ length: community.blocks?.[0]?.floorCount || 0 }, (_, i) => i + 1).map(f => (
                                                <option key={f} value={f}>{f}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <select 
                                            value={selectedFloor} 
                                            onChange={e => setSelectedFloor(e.target.value)}
                                            required
                                            disabled={!selectedBlock}
                                            className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] disabled:opacity-50"
                                        >
                                            <option value="">Select...</option>
                                            {getFloorOptions().map(f => (
                                                <option key={f} value={f}>{f}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                {/* Flat Number */}
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">
                                        {community?.communityType === 'Gated Community Villa' ? 'Villa Number' : 'Flat Number'}
                                    </label>
                                    <input 
                                        type="text" 
                                        value={flatNumber}
                                        onChange={e => setFlatNumber(e.target.value)}
                                        required
                                        placeholder="e.g. 101"
                                        className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">
                                        Size (Sq. Ft)
                                    </label>
                                    <input 
                                        type="number" 
                                        value={flatSize}
                                        onChange={e => setFlatSize(e.target.value)}
                                        required
                                        min="1"
                                        className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">
                                        Maintenance Start
                                    </label>
                                    <input 
                                        type="date" 
                                        value={maintenanceStartDate}
                                        onChange={e => setMaintenanceStartDate(e.target.value)}
                                        required
                                        className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"
                                    />
                                </div>
                            </div>

                            <div className="pt-6 border-t border-[var(--border-light)] dark:border-[var(--border-dark)] flex justify-end">
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? 'Finalizing...' : 'Finish Setup'}
                                </Button>
                            </div>
                        </form>
                    )}
                </Card>
            </div>
        </div>
    );
};

export default CommunitySetup;
