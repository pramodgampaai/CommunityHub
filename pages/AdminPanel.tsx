
import React, { useState, useEffect } from 'react';
import { getCommunityStats, createCommunity, updateCommunity, deleteCommunity, createAdminUser } from '../services/api';
import type { CommunityStat, User, Community } from '../types';
import { UserRole } from '../types';
import { useAuth } from '../hooks/useAuth';
import type { Theme } from '../App';
import { LogOutIcon, MoonIcon, SunIcon, PlusIcon, ChevronDownIcon, AlertTriangleIcon } from '../components/icons';
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
                <h1 className="text-xl font-bold text-[var(--accent)]">CommunityHub - Super Admin</h1>
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
    const [isCreateCommunityModalOpen, setCreateCommunityModalOpen] = useState(false);
    const [isAddAdminModalOpen, setAddAdminModalOpen] = useState(false);
    const [selectedCommunity, setSelectedCommunity] = useState<CommunityStat | null>(null);

    // Community Form States
    const [communityName, setCommunityName] = useState('');
    const [communityAddress, setCommunityAddress] = useState('');
    
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

    const handleCreateCommunity = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await createCommunity({ name: communityName, address: communityAddress });
            setCommunityName('');
            setCommunityAddress('');
            setCreateCommunityModalOpen(false);
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
                        <h2 className="text-3xl font-bold">Platform Overview</h2>
                        <Button onClick={() => setCreateCommunityModalOpen(true)} leftIcon={<PlusIcon className="w-5 h-5" />}>
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
                                        <th className="p-4 font-semibold">Residents</th>
                                        <th className="p-4 font-semibold">Income</th>
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
                                            <td className="p-4">{stat.resident_count}</td>
                                            <td className="p-4">${stat.income_generated.toLocaleString()}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${stat.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                    {stat.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
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

             <Modal isOpen={isCreateCommunityModalOpen} onClose={() => setCreateCommunityModalOpen(false)} title="Create Community">
                <form className="space-y-4" onSubmit={handleCreateCommunity}>
                    <div>
                        <label htmlFor="communityName" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Name</label>
                        <input type="text" id="communityName" value={communityName} onChange={e => setCommunityName(e.target.value)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"/>
                    </div>
                     <div>
                        <label htmlFor="communityAddress" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Address</label>
                        <input type="text" id="communityAddress" value={communityAddress} onChange={e => setCommunityAddress(e.target.value)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"/>
                    </div>
                    <div className="flex justify-end pt-4 space-x-2">
                        <Button type="button" variant="outlined" onClick={() => setCreateCommunityModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>Create</Button>
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
