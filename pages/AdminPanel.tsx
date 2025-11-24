
import React, { useState, useEffect } from 'react';
import { getCommunityStats, createCommunity, updateCommunity, deleteCommunity, createAdminUser } from '../services/api';
import type { CommunityStat, User, Community, Block, CommunityType } from '../types';
import { UserRole } from '../types';
import { useAuth } from '../hooks/useAuth';
import type { Theme } from '../App';
import { LogOutIcon, MoonIcon, SunIcon, PlusIcon, ChevronDownIcon, AlertTriangleIcon, PencilIcon, TrashIcon } from '../components/icons';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import ProfileModal from '../components/ProfileModal';

const AdminHeader: React.FC<{ theme: Theme; toggleTheme: () => void; }> = ({ theme, toggleTheme }) => {
    const { user, logout } = useAuth();
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    return (
        <>
            <header className="flex justify-between items-center p-4 bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] border-b border-[var(--border-light)] dark:border-[var(--border-dark)] z-10 sticky top-0">
                <div className="flex flex-col">
                    <h1 className="text-2xl font-bold text-[var(--accent)]">Elevate - Super Admin</h1>
                    <span className="text-[10px] text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] font-medium uppercase tracking-wide">Raising the Standard of Community Living</span>
                </div>
                <div className="flex items-center">
                    <button
                        onClick={toggleTheme}
                        className="mr-4 p-2 rounded-full text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-200"
                        aria-label="Toggle theme"
                    >
                        {theme === 'light' ? <MoonIcon className="w-6 h-6" /> : <SunIcon className="w-6 h-6" />}
                    </button>
                     <div 
                        className="flex items-center cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 p-1.5 rounded-lg transition-colors"
                        onClick={() => setIsProfileOpen(true)}
                        role="button"
                        tabIndex={0}
                     >
                        <img className="w-10 h-10 rounded-full ring-2 ring-offset-2 ring-offset-[var(--card-bg-light)] dark:ring-offset-[var(--card-bg-dark)] ring-[var(--accent)]" src={user?.avatarUrl} alt="User Avatar" />
                     </div>
                    <button
                        onClick={logout}
                        className="ml-4 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] hover:text-red-500 dark:hover:text-red-400 transition-colors"
                        aria-label="Logout"
                    >
                        <LogOutIcon />
                    </button>
                </div>
            </header>
            <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
        </>
    );
};


const AdminPanel: React.FC<{ theme: Theme, toggleTheme: () => void }> = ({ theme, toggleTheme }) => {
    const [stats, setStats] = useState<CommunityStat[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal States
    const [isCommunityModalOpen, setCommunityModalOpen] = useState(false);
    const [isAddAdminModalOpen, setAddAdminModalOpen] = useState(false);
    const [selectedCommunity, setSelectedCommunity] = useState<CommunityStat | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);

    // Community Form States
    const [communityName, setCommunityName] = useState('');
    const [communityAddress, setCommunityAddress] = useState('');
    const [communityType, setCommunityType] = useState<CommunityType>('Gated');
    const [blocks, setBlocks] = useState<Block[]>([{ name: '', floorCount: 0 }]);
    const [standaloneFloorCount, setStandaloneFloorCount] = useState<number>(1);
    const [maintenanceRate, setMaintenanceRate] = useState<number>(0);
    const [fixedMaintenanceAmount, setFixedMaintenanceAmount] = useState<number>(0);
    
    // Admin User Form States
    const [newAdminName, setNewAdminName] = useState('');
    const [newAdminEmail, setNewAdminEmail] = useState('');
    const [newAdminPassword, setNewAdminPassword] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);
            const statsData = await getCommunityStats();
            setStats(statsData);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Reset and Open Community Modal for Create
    const openCreateCommunityModal = () => {
        setIsEditMode(false);
        setSelectedCommunity(null);
        setCommunityName('');
        setCommunityAddress('');
        setCommunityType('Gated');
        setBlocks([{ name: '', floorCount: 0 }]);
        setStandaloneFloorCount(1);
        setMaintenanceRate(0);
        setFixedMaintenanceAmount(0);
        setCommunityModalOpen(true);
    };

    // Reset and Open Community Modal for Edit
    const openEditCommunityModal = (community: CommunityStat) => {
        setIsEditMode(true);
        setSelectedCommunity(community);
        setCommunityName(community.name);
        setCommunityAddress(community.address);
        setCommunityType(community.communityType || 'Gated');
        setMaintenanceRate(community.maintenanceRate || 0);
        setFixedMaintenanceAmount(community.fixedMaintenanceAmount || 0);
        
        if (community.blocks && community.blocks.length > 0) {
            if (community.communityType === 'Standalone') {
                 setStandaloneFloorCount(community.blocks[0].floorCount);
                 setBlocks([{ name: 'Main', floorCount: 0 }]); // reset blocks state just in case
            } else {
                 setBlocks(community.blocks);
            }
        } else {
            setBlocks([{ name: '', floorCount: 0 }]);
            setStandaloneFloorCount(1);
        }
        setCommunityModalOpen(true);
    };

    const handleBlockChange = (index: number, field: keyof Block, value: string | number) => {
        const newBlocks = [...blocks];
        newBlocks[index] = { ...newBlocks[index], [field]: value };
        setBlocks(newBlocks);
    };

    const addBlock = () => {
        setBlocks([...blocks, { name: '', floorCount: 0 }]);
    };

    const removeBlock = (index: number) => {
        const newBlocks = blocks.filter((_, i) => i !== index);
        setBlocks(newBlocks);
    };

    const handleSubmitCommunity = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        // Prepare payload
        const finalBlocks = communityType === 'Standalone' 
            ? [{ name: 'Main Building', floorCount: standaloneFloorCount }]
            : blocks.filter(b => b.name.trim() !== ''); // Filter empty blocks

        const payload = {
            name: communityName,
            address: communityAddress,
            communityType,
            blocks: finalBlocks,
            maintenanceRate: communityType === 'Gated' ? maintenanceRate : 0,
            fixedMaintenanceAmount: communityType === 'Standalone' ? fixedMaintenanceAmount : 0
        };

        try {
            if (isEditMode && selectedCommunity) {
                await updateCommunity(selectedCommunity.id, payload);
            } else {
                await createCommunity(payload);
            }
            setCommunityModalOpen(false);
            await fetchData();
        } catch (err: any) {
            alert(`Error: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleAddAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCommunity) return;
        setIsSubmitting(true);
        try {
            await createAdminUser({
                name: newAdminName,
                email: newAdminEmail,
                password: newAdminPassword,
                community_id: selectedCommunity.id
            });
            
            setNewAdminName('');
            setNewAdminEmail('');
            setNewAdminPassword('');
            setAddAdminModalOpen(false);
            alert(`Successfully created Admin for ${selectedCommunity.name}`);
        } catch (err: any) {
            console.error(err);
            alert(`Error: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const openAddAdminModal = (community: CommunityStat) => {
        setSelectedCommunity(community);
        setAddAdminModalOpen(true);
    };

    return (
        <div className="flex flex-col h-screen bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] text-[var(--text-light)] dark:text-[var(--text-dark)]">
            <AdminHeader theme={theme} toggleTheme={toggleTheme} />
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold">Platform Overview</h2>
                        <Button onClick={openCreateCommunityModal} leftIcon={<PlusIcon className="w-5 h-5" />}>
                            Create Community
                        </Button>
                    </div>

                    {loading && <Spinner />}
                    {error && <p className="text-red-500">Error: {error}</p>}
                    
                    {!loading && !error && (
                         <Card className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-black/5 dark:bg-white/5">
                                    <tr>
                                        <th className="p-4 font-semibold">Community</th>
                                        <th className="p-4 font-semibold">Type</th>
                                        <th className="p-4 font-semibold">Residents</th>
                                        <th className="p-4 font-semibold">Maintenance</th>
                                        <th className="p-4 font-semibold">Status</th>
                                        <th className="p-4 font-semibold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-light)] dark:divide-[var(--border-dark)]">
                                    {stats.map(stat => (
                                        <tr key={stat.id}>
                                            <td className="p-4">
                                                <div className="font-medium">{stat.name}</div>
                                                <div className="text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">{stat.address}</div>
                                            </td>
                                            <td className="p-4">
                                                {stat.communityType || 'N/A'}
                                                {stat.communityType === 'Gated' && stat.blocks && (
                                                    <div className="text-xs text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                                                        {stat.blocks.length} Blocks
                                                    </div>
                                                )}
                                                {stat.communityType === 'Standalone' && stat.blocks && stat.blocks[0] && (
                                                    <div className="text-xs text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                                                        {stat.blocks[0].floorCount} Floors
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4">{stat.resident_count}</td>
                                            <td className="p-4">
                                                {stat.communityType === 'Standalone' ? (
                                                     <span>₹{stat.fixedMaintenanceAmount || 0} / mo</span>
                                                ) : (
                                                     <span>₹{stat.maintenanceRate || 0} / sq ft</span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${stat.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                    {stat.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right space-x-2">
                                                <button 
                                                    onClick={() => openEditCommunityModal(stat)}
                                                    className="text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] hover:text-[var(--accent)] transition-colors p-1"
                                                    title="Edit Details"
                                                >
                                                    <PencilIcon className="w-5 h-5" />
                                                </button>
                                                <Button size="sm" onClick={() => openAddAdminModal(stat)}>Add Admin</Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Card>
                    )}
                </div>
            </main>

             <Modal isOpen={isCommunityModalOpen} onClose={() => setCommunityModalOpen(false)} title={isEditMode ? "Edit Community" : "Create Community"}>
                <form className="space-y-4" onSubmit={handleSubmitCommunity}>
                    <div>
                        <label htmlFor="communityName" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Name</label>
                        <input type="text" id="communityName" value={communityName} onChange={e => setCommunityName(e.target.value)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"/>
                    </div>
                     <div>
                        <label htmlFor="communityAddress" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Address</label>
                        <input type="text" id="communityAddress" value={communityAddress} onChange={e => setCommunityAddress(e.target.value)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"/>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Community Type</label>
                        <div className="flex gap-4 mt-1">
                            <label className="flex items-center">
                                <input 
                                    type="radio" 
                                    name="communityType" 
                                    value="Gated" 
                                    checked={communityType === 'Gated'} 
                                    onChange={() => setCommunityType('Gated')}
                                    className="mr-2"
                                />
                                Gated Community
                            </label>
                            <label className="flex items-center">
                                <input 
                                    type="radio" 
                                    name="communityType" 
                                    value="Standalone" 
                                    checked={communityType === 'Standalone'} 
                                    onChange={() => setCommunityType('Standalone')}
                                    className="mr-2"
                                />
                                Standalone Apartment
                            </label>
                        </div>
                    </div>

                    {communityType === 'Standalone' ? (
                        <>
                            <div>
                                <label htmlFor="standaloneFloors" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Number of Floors</label>
                                <input 
                                    type="number" 
                                    id="standaloneFloors" 
                                    value={standaloneFloorCount} 
                                    onChange={e => setStandaloneFloorCount(parseInt(e.target.value) || 0)} 
                                    min="1"
                                    required 
                                    className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"
                                />
                            </div>
                            <div>
                                <label htmlFor="fixedMaintenance" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Monthly Maintenance (₹)</label>
                                <input 
                                    type="number" 
                                    id="fixedMaintenance" 
                                    value={fixedMaintenanceAmount} 
                                    onChange={e => setFixedMaintenanceAmount(parseFloat(e.target.value) || 0)} 
                                    min="0"
                                    className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"
                                />
                            </div>
                        </>
                    ) : (
                        <div className="border-t border-[var(--border-light)] dark:border-[var(--border-dark)] pt-4 mt-2">
                             <div className="mb-4">
                                <label htmlFor="maintenanceRate" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Maintenance Rate (₹ per Sq. Ft)</label>
                                <input 
                                    type="number" 
                                    id="maintenanceRate" 
                                    value={maintenanceRate} 
                                    onChange={e => setMaintenanceRate(parseFloat(e.target.value) || 0)} 
                                    min="0"
                                    step="0.1"
                                    className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"
                                />
                            </div>

                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Blocks / Towers</label>
                                <button type="button" onClick={addBlock} className="text-xs text-[var(--accent)] hover:underline flex items-center">
                                    <PlusIcon className="w-3 h-3 mr-1"/> Add Block
                                </button>
                            </div>

                            {/* Header Row for Blocks */}
                            <div className="flex gap-2 mb-2 px-1">
                                <span className="flex-1 text-xs font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] uppercase tracking-wide">Name</span>
                                <span className="w-24 text-xs font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] uppercase tracking-wide">Floor Count</span>
                                <span className="w-6"></span> {/* Spacer for actions */}
                            </div>

                            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                                {blocks.map((block, index) => (
                                    <div key={index} className="flex gap-2 items-center">
                                        <div className="flex-1">
                                            <input 
                                                type="text" 
                                                placeholder="e.g. Block A" 
                                                value={block.name} 
                                                onChange={e => handleBlockChange(index, 'name', e.target.value)}
                                                className="block w-full px-3 py-1.5 text-sm border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"
                                                aria-label="Block Name"
                                            />
                                        </div>
                                        <div className="w-24">
                                            <input 
                                                type="number" 
                                                placeholder="0" 
                                                value={block.floorCount} 
                                                onChange={e => handleBlockChange(index, 'floorCount', parseInt(e.target.value) || 0)}
                                                min="1"
                                                className="block w-full px-3 py-1.5 text-sm border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"
                                                aria-label="Floor Count"
                                            />
                                        </div>
                                        <div className="w-6 flex justify-center">
                                            {blocks.length > 1 && (
                                                <button 
                                                    type="button" 
                                                    onClick={() => removeBlock(index)}
                                                    className="text-red-500 hover:text-red-700 p-1"
                                                    title="Remove Block"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end pt-4 space-x-2">
                        <Button type="button" variant="outlined" onClick={() => setCommunityModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>{isEditMode ? 'Update' : 'Create'}</Button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={isAddAdminModalOpen} onClose={() => setAddAdminModalOpen(false)} title={`Add Admin for ${selectedCommunity?.name}`}>
                 <form className="space-y-4" onSubmit={handleAddAdmin}>
                    <div>
                        <label htmlFor="adminName" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Admin Name</label>
                        <input type="text" id="adminName" value={newAdminName} onChange={e => setNewAdminName(e.target.value)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"/>
                    </div>
                     <div>
                        <label htmlFor="adminEmail" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Admin Email</label>
                        <input type="email" id="adminEmail" value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"/>
                    </div>
                     <div>
                        <label htmlFor="adminPassword" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Temporary Password</label>
                        <input type="password" id="adminPassword" value={newAdminPassword} onChange={e => setNewAdminPassword(e.target.value)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"/>
                    </div>
                    <div className="flex justify-end pt-4 space-x-2">
                        <Button type="button" variant="outlined" onClick={() => setAddAdminModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>Create Admin</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default AdminPanel;
