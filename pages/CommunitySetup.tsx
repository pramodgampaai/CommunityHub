
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getCommunity, updateCommunity } from '../services/api';
import type { Community, Block } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import { PlusIcon, TrashIcon, CheckCircleIcon } from '../components/icons';

interface CommunitySetupProps {
    onComplete: () => void;
}

const CommunitySetup: React.FC<CommunitySetupProps> = ({ onComplete }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [community, setCommunity] = useState<Community | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);

    // Form States
    const [blocks, setBlocks] = useState<Block[]>([]); // For High-Rise
    const [villaRoads, setVillaRoads] = useState<number>(0); // For Villa
    const [standaloneData, setStandaloneData] = useState<{ floors: number; unitsPerFloor: number }>({ floors: 0, unitsPerFloor: 0 }); // For Standalone

    useEffect(() => {
        const fetchDetails = async () => {
            if (!user?.communityId) return;
            try {
                setLoading(true);
                const data = await getCommunity(user.communityId);
                setCommunity(data);
                
                // Initialize state if data exists (edit mode) or prepare for new
                if (data.blocks && data.blocks.length > 0) {
                    setIsEditMode(true);
                    setBlocks(data.blocks);
                    if (data.communityType?.includes('Villa')) {
                        setVillaRoads(data.blocks.length);
                    } else if (data.communityType?.includes('Standalone')) {
                        setStandaloneData({
                            floors: data.blocks[0].floorCount,
                            unitsPerFloor: data.blocks[0].unitsPerFloor || 0
                        });
                    }
                }
            } catch (err: any) {
                setError(err.message || 'Failed to load community details.');
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [user]);

    const isFormValid = () => {
        if (!community) return false;

        if (community.communityType === 'Gated Community Villa') {
            return villaRoads > 0;
        }

        if (community.communityType === 'Standalone Apartment' || community.communityType === 'Standalone') {
            return standaloneData.floors > 0 && standaloneData.unitsPerFloor > 0;
        }

        // High-Rise: Must have at least one block and all blocks must be valid
        if (blocks.length === 0) return false;
        return blocks.every(b => b.name.trim() !== '' && b.floorCount > 0);
    };

    const handleSave = async () => {
        if (!community || !user?.communityId) return;
        setSubmitting(true);
        setError(null);

        let finalBlocks: Block[] = [];

        try {
            if (community.communityType === 'Gated Community Villa') {
                if (villaRoads < 1) throw new Error("Please enter a valid number of roads.");
                if (villaRoads > 100) throw new Error("Maximum 100 roads allowed for performance reasons.");
                
                // Generate Road blocks
                finalBlocks = Array.from({ length: villaRoads }, (_, i) => ({
                    name: `Road ${i + 1}`,
                    floorCount: 1 // Default for villas
                }));
            } else if (community.communityType === 'Standalone Apartment' || community.communityType === 'Standalone') {
                if (standaloneData.floors > 200) throw new Error("Maximum 200 floors allowed.");
                // Button disabled state handles validation (floors > 0 && unitsPerFloor > 0)
                finalBlocks = [{
                    name: 'Main Building',
                    floorCount: standaloneData.floors,
                    unitsPerFloor: standaloneData.unitsPerFloor
                }];
            } else {
                // High-Rise / Generic
                if (blocks.length === 0) throw new Error("Please add at least one block/tower.");
                if (blocks.some(b => !b.name.trim() || b.floorCount < 1)) throw new Error("All blocks must have a name and at least 1 floor.");
                finalBlocks = blocks;
            }

            await updateCommunity(user.communityId, { blocks: finalBlocks });
            onComplete(); // Navigate to dashboard
        } catch (err: any) {
            console.error("Setup error:", err);
            setError(err.message || 'An unexpected error occurred. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    // High-Rise Helpers
    const addBlock = () => {
        setBlocks([...blocks, { name: '', floorCount: 0 }]);
    };

    const updateBlock = (index: number, field: keyof Block, value: string | number) => {
        const updated = [...blocks];
        updated[index] = { ...updated[index], [field]: value };
        setBlocks(updated);
    };

    const removeBlock = (index: number) => {
        setBlocks(blocks.filter((_, i) => i !== index));
    };

    if (loading) {
        return <div className="h-screen flex items-center justify-center"><Spinner /></div>;
    }

    if (!community) {
        return <div className="p-8 text-center">Community details not found.</div>;
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] p-4">
            <Card className="w-full max-w-2xl p-8 border-t-4 border-t-brand-500">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-[var(--text-light)] dark:text-[var(--text-dark)] mb-2">
                        {isEditMode ? 'Community Landscape' : 'Welcome to Elevate'}
                    </h1>
                    <p className="text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                        {isEditMode 
                            ? <span>Update the landscape settings for <strong>{community.name}</strong>.</span>
                            : <span>Let's set up the landscape for <strong>{community.name}</strong>.</span>
                        }
                    </p>
                    {!isEditMode && (
                        <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-2 bg-yellow-50 dark:bg-yellow-900/20 inline-block px-3 py-1 rounded-full">
                            This step is mandatory to unlock all features.
                        </p>
                    )}
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 rounded-lg text-sm text-center">
                        {error}
                    </div>
                )}

                <div className="space-y-6">
                    {/* Villa Form */}
                    {community.communityType === 'Gated Community Villa' && (
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-2">
                                How many roads are in your community?
                            </label>
                            <input 
                                type="number" 
                                min="1" 
                                max="100"
                                value={villaRoads} 
                                onChange={(e) => setVillaRoads(parseInt(e.target.value) || 0)}
                                className="block w-full px-4 py-3 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] text-lg"
                                placeholder="e.g. 5"
                            />
                            <p className="mt-2 text-xs text-[var(--text-secondary-light)]">We will automatically generate blocks named "Road 1", "Road 2", etc.</p>
                        </div>
                    )}

                    {/* Standalone Form */}
                    {(community.communityType === 'Standalone Apartment' || community.communityType === 'Standalone') && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-2">
                                    Total Floors
                                </label>
                                <input 
                                    type="number" 
                                    min="1" 
                                    max="200"
                                    value={standaloneData.floors} 
                                    onChange={(e) => setStandaloneData({...standaloneData, floors: parseInt(e.target.value) || 0})}
                                    className="block w-full px-4 py-3 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-[var(--bg-light)] dark:bg-[var(--bg-dark)]"
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
                                    value={standaloneData.unitsPerFloor} 
                                    onChange={(e) => setStandaloneData({...standaloneData, unitsPerFloor: parseInt(e.target.value) || 0})}
                                    className="block w-full px-4 py-3 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-[var(--bg-light)] dark:bg-[var(--bg-dark)]"
                                />
                            </div>
                        </div>
                    )}

                    {/* High-Rise Form */}
                    {community.communityType === 'High-Rise Apartment' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                                    Blocks / Towers
                                </label>
                                <Button size="sm" variant="outlined" onClick={addBlock} leftIcon={<PlusIcon className="w-4 h-4"/>}>Add Block</Button>
                            </div>
                            
                            {blocks.length === 0 && (
                                <div className="text-center p-6 border-2 border-dashed border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-lg text-[var(--text-secondary-light)]">
                                    No blocks added yet. Click "Add Block" to start.
                                </div>
                            )}

                            {blocks.map((block, index) => (
                                <div key={index} className="flex gap-4 items-center bg-black/5 dark:bg-white/5 p-3 rounded-lg animate-fadeIn">
                                    <div className="flex-1">
                                        <input 
                                            type="text" 
                                            placeholder="Block Name (e.g. Tower A)"
                                            value={block.name}
                                            onChange={(e) => updateBlock(index, 'name', e.target.value)}
                                            className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] text-sm"
                                        />
                                    </div>
                                    <div className="w-24">
                                        <input 
                                            type="number" 
                                            placeholder="Floors"
                                            min="1"
                                            max="200"
                                            value={block.floorCount || ''}
                                            onChange={(e) => updateBlock(index, 'floorCount', parseInt(e.target.value) || 0)}
                                            className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] text-sm"
                                        />
                                    </div>
                                    <button 
                                        onClick={() => removeBlock(index)}
                                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                    >
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="pt-6 border-t border-[var(--border-light)] dark:border-[var(--border-dark)] flex gap-4">
                        {isEditMode && (
                            <Button variant="outlined" onClick={onComplete} disabled={submitting} className="flex-1">
                                Cancel
                            </Button>
                        )}
                        <Button 
                            onClick={handleSave} 
                            disabled={submitting || !isFormValid()} 
                            className="flex-1" 
                            size="lg" 
                            leftIcon={<CheckCircleIcon className="w-5 h-5"/>}
                        >
                            {submitting ? 'Saving...' : (isEditMode ? 'Update Configuration' : 'Save & Continue')}
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default CommunitySetup;
