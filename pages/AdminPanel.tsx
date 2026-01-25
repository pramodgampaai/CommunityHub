
import React, { useState, useEffect } from 'react';
import { getCommunityStats, createCommunity, updateCommunity, createAdminUser, deleteCommunity, getCachedData, createCommunityUser } from '../services/api';
import type { CommunityStat, CommunityType, CommunityPricing, Page } from '../types';
import { UserRole } from '../types';
import { useAuth } from '../hooks/useAuth';
import { 
    PlusIcon, 
    ChevronDownIcon, 
    CheckCircleIcon, 
    Squares2X2Icon, 
    IdentificationIcon, 
    CurrencyRupeeIcon, 
    TrashIcon, 
    UserGroupIcon, 
    ShieldCheckIcon,
    PencilIcon,
    MapPinIcon,
    WrenchIcon
} from '../components/icons';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import FeedbackModal from '../components/ui/FeedbackModal';
import ConfirmationModal from '../components/ui/ConfirmationModal';

interface AdminPanelProps {
    navigateToPage?: (page: Page, params?: any) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ navigateToPage }) => {
    const { user } = useAuth();
    const [stats, setStats] = useState<CommunityStat[]>(() => getCachedData('communityStats') || []);
    const [loading, setLoading] = useState(!getCachedData('communityStats'));
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
    const [isSuperAdminModalOpen, setIsSuperAdminModalOpen] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; id: string | null; name: string }>({ isOpen: false, id: null, name: '' });
    
    // Form States
    const [targetCommunityId, setTargetCommunityId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [type, setType] = useState<CommunityType>('High-Rise Apartment');
    const [pricing, setPricing] = useState<CommunityPricing>({ resident: 0, admin: 0, staff: 0 });

    // User Provisioning State
    const [adminName, setAdminName] = useState('');
    const [adminEmail, setAdminEmail] = useState('');
    const [adminPassword, setAdminPassword] = useState('Admin@Nilayam123');

    const [feedback, setFeedback] = useState<{ isOpen: boolean; type: 'success' | 'error' | 'info'; title: string; message: string }>({
        isOpen: false, type: 'success', title: '', message: ''
    });

    const fetchData = async () => {
        try {
            setLoading(true);
            const statsData = await getCommunityStats();
            setStats(statsData);
        } catch (err: any) {
            setFeedback({ isOpen: true, type: 'error', title: 'Registry Sync Error', message: err.message });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleCreateCommunity = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const result = await createCommunity({
                name, address, communityType: type, pricePerUser: pricing, status: 'active'
            });
            setTargetCommunityId(result.data.id);
            setIsCreateModalOpen(false);
            setIsAdminModalOpen(true);
            setFeedback({ 
                isOpen: true, type: 'success', title: 'Community Initialized', 
                message: `${name} has been registered. Now, provision the root administrator account.` 
            });
            await fetchData();
        } catch (err: any) {
            setFeedback({ isOpen: true, type: 'error', title: 'Registry Failed', message: err.message });
        } finally { setIsSubmitting(false); }
    };

    const handleUpdateCommunity = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!targetCommunityId) return;
        setIsSubmitting(true);
        try {
            await updateCommunity(targetCommunityId, {
                name, address, communityType: type, pricePerUser: pricing
            });
            setFeedback({ isOpen: true, type: 'success', title: 'Profile Updated', message: `Details for ${name} have been synchronized.` });
            setIsEditModalOpen(false);
            await fetchData();
        } catch (err: any) {
            setFeedback({ isOpen: true, type: 'error', title: 'Update Failed', message: err.message });
        } finally { setIsSubmitting(false); }
    };

    const handleDeleteCommunity = async () => {
        if (!confirmDelete.id) return;
        setIsSubmitting(true);
        try {
            await deleteCommunity(confirmDelete.id);
            setFeedback({ isOpen: true, type: 'success', title: 'Infrastructure Purged', message: `Community ${confirmDelete.name} and all associated data have been permanently removed.` });
            setConfirmDelete({ isOpen: false, id: null, name: '' });
            await fetchData();
        } catch (err: any) {
            setFeedback({ isOpen: true, type: 'error', title: 'Purge Failed', message: err.message });
        } finally { setIsSubmitting(false); }
    };

    const handleCreateAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!targetCommunityId) return;
        
        setIsSubmitting(true);
        try {
            const cleanEmail = adminEmail.toLowerCase().trim();
            await createAdminUser({
                name: adminName, 
                email: cleanEmail, 
                password: adminPassword, 
                community_id: targetCommunityId
            });
            setIsAdminModalOpen(false);
            setFeedback({ 
                isOpen: true, 
                type: 'success', 
                title: 'Provisioning Successful', 
                message: `The administrator account for ${name} is now active. The identity has been force-verified in the Auth registry.` 
            });
            resetUserForm();
            await fetchData();
        } catch (err: any) {
            setFeedback({ 
                isOpen: true, 
                type: 'error', 
                title: 'Provisioning Halted', 
                message: err.message || "The database rejected the account creation request. Verify identity uniqueness." 
            });
        } finally { setIsSubmitting(false); }
    };

    const handleCreateSuperAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const cleanEmail = adminEmail.toLowerCase().trim();
            await createCommunityUser({
                name: adminName, email: cleanEmail, password: adminPassword, role: UserRole.SuperAdmin, community_id: '00000000-0000-0000-0000-000000000000' 
            });
            setIsSuperAdminModalOpen(false);
            setFeedback({ isOpen: true, type: 'success', title: 'Global Access Granted', message: `${adminName} now has full platform oversight.` });
            resetUserForm();
        } catch (err: any) {
            setFeedback({ isOpen: true, type: 'error', title: 'Peer Creation Failed', message: err.message });
        } finally { setIsSubmitting(false); }
    };

    const resetUserForm = () => {
        setAdminName(''); setAdminEmail(''); setAdminPassword('Admin@Nilayam123'); setTargetCommunityId(null);
    };

    const resetCommunityForm = () => {
        setName(''); setAddress(''); setType('High-Rise Apartment');
        setPricing({ resident: 0, admin: 0, staff: 0 });
        setTargetCommunityId(null);
    };

    const openEditModal = (stat: CommunityStat) => {
        setTargetCommunityId(stat.id);
        setName(stat.name);
        setAddress(stat.address);
        setType(stat.communityType as CommunityType || 'High-Rise Apartment');
        setPricing(stat.pricePerUser || { resident: 0, admin: 0, staff: 0 });
        setIsEditModalOpen(true);
    };

    return (
        <div className="space-y-6 pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 min-h-[5rem]">
                <div className="flex items-start gap-3">
                    <div className="w-1 h-10 bg-brand-500 rounded-full mt-1" />
                    <div>
                        <span className="text-[9px] font-mono font-black uppercase tracking-[0.3em] text-brand-600 dark:text-brand-400 mb-0.5 block">Global Oversight</span>
                        <h1 className="text-2xl sm:text-3xl font-brand font-extrabold text-brand-600 dark:text-brand-400 tracking-tight leading-tight">Infrastructure</h1>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outlined" onClick={() => setIsSuperAdminModalOpen(true)} size="md" leftIcon={<ShieldCheckIcon />}>New SuperAdmin</Button>
                    <Button onClick={() => { resetCommunityForm(); setIsCreateModalOpen(true); }} size="md" leftIcon={<PlusIcon />}>Register Community</Button>
                </div>
            </div>

            {loading && stats.length === 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-56 bg-slate-100 dark:bg-white/5 rounded-3xl animate-pulse" />)}
                </div>
            ) : stats.length === 0 ? (
                <div className="py-24 text-center border-2 border-dashed border-slate-100 dark:border-white/5 rounded-[3rem] opacity-30">
                    <Squares2X2Icon className="w-16 h-16 mx-auto mb-4" />
                    <p className="font-brand font-extrabold text-xl">Platform Pristine</p>
                    <p className="text-[10px] font-black uppercase tracking-widest mt-1">No community assets found in registry</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {stats.map(stat => (
                        <Card key={stat.id} className="p-0 overflow-hidden bg-white dark:bg-zinc-900/40 border border-slate-50 dark:border-white/5 shadow-sm rounded-[2.5rem] hover:shadow-xl transition-all group">
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-xl font-brand font-extrabold text-slate-900 dark:text-slate-50 group-hover:text-brand-600 transition-colors truncate">{stat.name}</h3>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1 flex items-center gap-1.5 truncate">
                                            <MapPinIcon className="w-3 h-3" /> {stat.address}
                                        </p>
                                    </div>
                                    <div className="flex gap-1">
                                        <button 
                                            onClick={() => openEditModal(stat)}
                                            className="p-2 text-slate-300 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-xl transition-all"
                                            title="Edit Community"
                                        >
                                            <PencilIcon className="w-5 h-5" />
                                        </button>
                                        <button 
                                            onClick={() => setConfirmDelete({ isOpen: true, id: stat.id, name: stat.name })}
                                            className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all"
                                            title="Purge Community"
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    <div className="p-4 bg-slate-50 dark:bg-black/20 rounded-2xl flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-800 shadow-sm flex items-center justify-center text-brand-600"><UserGroupIcon className="w-5 h-5" /></div>
                                        <div className="text-left">
                                            <p className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Residents</p>
                                            <p className="text-lg font-brand font-extrabold text-slate-800 dark:text-slate-200 leading-none">{stat.resident_count}</p>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-slate-50 dark:bg-black/20 rounded-2xl flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-800 shadow-sm flex items-center justify-center text-brand-600"><ShieldCheckIcon className="w-5 h-5" /></div>
                                        <div className="text-left">
                                            <p className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Admins</p>
                                            <p className="text-lg font-brand font-extrabold text-slate-800 dark:text-slate-200 leading-none">{stat.admin_count}</p>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-slate-50 dark:bg-black/20 rounded-2xl flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-800 shadow-sm flex items-center justify-center text-brand-600"><WrenchIcon className="w-5 h-5" /></div>
                                        <div className="text-left">
                                            <p className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Staff</p>
                                            <p className="text-lg font-brand font-extrabold text-slate-800 dark:text-slate-200 leading-none">{stat.staff_count}</p>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-brand-50 dark:bg-brand-900/10 rounded-2xl flex items-center gap-3 border border-brand-100 dark:border-brand-900/20">
                                        <div className="w-8 h-8 rounded-lg bg-white dark:bg-brand-500/20 shadow-sm flex items-center justify-center text-brand-600"><CurrencyRupeeIcon className="w-5 h-5" /></div>
                                        <div className="text-left">
                                            <p className="text-[8px] font-black text-brand-600 uppercase mb-0.5">Revenue</p>
                                            <p className="text-lg font-brand font-extrabold text-brand-600 leading-none">₹{(stat.current_month_paid || 0).toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>
                                
                                <Button 
                                    className="w-full h-12 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-brand-500/10"
                                    onClick={() => { setTargetCommunityId(stat.id); setName(stat.name); setIsAdminModalOpen(true); }}
                                    leftIcon={<UserGroupIcon />}
                                    variant="outlined"
                                >
                                    Provision Community Admin
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Create Community Modal */}
            <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="New Registry" subtitle="INFRASTRUCTURE EXPANSION" size="lg">
                <form onSubmit={handleCreateCommunity} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="sm:col-span-2">
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Official Identity</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Prestige Lake Ridge" className="rounded-xl input-field text-sm font-bold"/>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Physical Address</label>
                            <input type="text" value={address} onChange={e => setAddress(e.target.value)} required placeholder="Street, City, State" className="rounded-xl input-field text-sm font-bold"/>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Infrastructure Type</label>
                            <div className="relative">
                                <select value={type} onChange={e => setType(e.target.value as CommunityType)} className="rounded-xl input-field text-xs font-bold appearance-none bg-white dark:bg-zinc-900">
                                    <option value="High-Rise Apartment">High-Rise Apartment</option>
                                    <option value="Standalone Apartment">Standalone Apartment</option>
                                    <option value="Gated Community Villa">Gated Community Villa</option>
                                </select>
                                <ChevronDownIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-slate-50 dark:bg-black/20 rounded-[2rem] border border-slate-100 dark:border-white/5 space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-brand-600 flex items-center gap-2">
                            <CurrencyRupeeIcon className="w-4 h-4" /> Platform Fee Setup (Per User / Mo)
                        </h4>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-[8px] font-black uppercase text-slate-400 mb-1">Resident</label>
                                <input type="number" value={pricing.resident} onChange={e => setPricing({...pricing, resident: parseInt(e.target.value) || 0})} className="input-field text-xs font-bold text-center py-2 px-1"/>
                            </div>
                            <div>
                                <label className="block text-[8px] font-black uppercase text-slate-400 mb-1">Admin</label>
                                <input type="number" value={pricing.admin} onChange={e => setPricing({...pricing, admin: parseInt(e.target.value) || 0})} className="input-field text-xs font-bold text-center py-2 px-1"/>
                            </div>
                            <div>
                                <label className="block text-[8px] font-black uppercase text-slate-400 mb-1">Staff</label>
                                <input type="number" value={pricing.staff} onChange={e => setPricing({...pricing, staff: parseInt(e.target.value) || 0})} className="input-field text-xs font-bold text-center py-2 px-1"/>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <Button type="button" variant="ghost" onClick={() => setIsCreateModalOpen(false)}>Discard</Button>
                        <Button type="submit" disabled={isSubmitting} leftIcon={isSubmitting ? <Spinner /> : <CheckCircleIcon />}>{isSubmitting ? 'Processing...' : 'Register Community'}</Button>
                    </div>
                </form>
            </Modal>

            {/* Edit Community Modal */}
            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Update Infrastructure" subtitle="REGISTRY SYNC" size="lg">
                <form onSubmit={handleUpdateCommunity} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="sm:col-span-2">
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Community Name</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} required className="rounded-xl input-field text-sm font-bold"/>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Official Address</label>
                            <input type="text" value={address} onChange={e => setAddress(e.target.value)} required className="rounded-xl input-field text-sm font-bold"/>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Landscape Model</label>
                            <div className="relative">
                                <select value={type} onChange={e => setType(e.target.value as CommunityType)} className="rounded-xl input-field text-xs font-bold appearance-none bg-white dark:bg-zinc-900">
                                    <option value="High-Rise Apartment">High-Rise Apartment</option>
                                    <option value="Standalone Apartment">Standalone Apartment</option>
                                    <option value="Gated Community Villa">Gated Community Villa</option>
                                </select>
                                <ChevronDownIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-slate-50 dark:bg-black/20 rounded-[2rem] border border-slate-100 dark:border-white/5 space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-brand-600 flex items-center gap-2">
                            <CurrencyRupeeIcon className="w-4 h-4" /> Revised Fee Structure
                        </h4>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-[8px] font-black uppercase text-slate-400 mb-1">Resident</label>
                                <input type="number" value={pricing.resident} onChange={e => setPricing({...pricing, resident: parseInt(e.target.value) || 0})} className="input-field text-xs font-bold text-center py-2 px-1"/>
                            </div>
                            <div>
                                <label className="block text-[8px] font-black uppercase text-slate-400 mb-1">Admin</label>
                                <input type="number" value={pricing.admin} onChange={e => setPricing({...pricing, admin: parseInt(e.target.value) || 0})} className="input-field text-xs font-bold text-center py-2 px-1"/>
                            </div>
                            <div>
                                <label className="block text-[8px] font-black uppercase text-slate-400 mb-1">Staff</label>
                                <input type="number" value={pricing.staff} onChange={e => setPricing({...pricing, staff: parseInt(e.target.value) || 0})} className="input-field text-xs font-bold text-center py-2 px-1"/>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <Button type="button" variant="ghost" onClick={() => setIsEditModalOpen(false)}>Discard</Button>
                        <Button type="submit" disabled={isSubmitting} leftIcon={isSubmitting ? <Spinner /> : <CheckCircleIcon />}>{isSubmitting ? 'Syncing...' : 'Update Infrastructure'}</Button>
                    </div>
                </form>
            </Modal>

            {/* Admin Provisioning Modal */}
            <Modal isOpen={isAdminModalOpen} onClose={() => setIsAdminModalOpen(false)} title="Provision Admin" subtitle={name.toUpperCase()} size="lg">
                <form onSubmit={handleCreateAdmin} className="space-y-6">
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 flex gap-3">
                        <AlertTriangleIcon className="w-5 h-5 text-amber-600 shrink-0" />
                        <p className="text-[11px] font-medium text-amber-700 leading-relaxed">Assign the first administrator. They will be responsible for completing community landscape and financial initialization.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Admin Legal Name</label>
                            <input type="text" value={adminName} onChange={e => setAdminName(e.target.value)} required className="rounded-xl input-field text-sm font-bold"/>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Email Identity</label>
                            <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} required className="rounded-xl input-field text-sm font-bold"/>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Access Key</label>
                            <input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} required className="rounded-xl input-field text-sm font-bold"/>
                        </div>
                    </div>
                    <Button type="submit" disabled={isSubmitting} className="w-full h-12 shadow-xl shadow-brand-500/10" leftIcon={isSubmitting ? <Spinner /> : <ShieldCheckIcon />}>{isSubmitting ? 'Provisioning...' : 'Grant Admin Privileges'}</Button>
                </form>
            </Modal>

            {/* SuperAdmin Provisioning Modal */}
            <Modal isOpen={isSuperAdminModalOpen} onClose={() => setIsSuperAdminModalOpen(false)} title="Platform Authority" subtitle="GLOBAL IDENTITY">
                <form onSubmit={handleCreateSuperAdmin} className="space-y-6">
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Full Name</label>
                            <input type="text" value={adminName} onChange={e => setAdminName(e.target.value)} required className="rounded-xl input-field text-sm font-bold"/>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Email Address</label>
                            <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} required className="rounded-xl input-field text-sm font-bold"/>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Master Password</label>
                            <input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} required className="rounded-xl input-field text-sm font-bold"/>
                        </div>
                    </div>
                    <Button type="submit" disabled={isSubmitting} className="w-full h-12" leftIcon={isSubmitting ? <Spinner /> : <ShieldCheckIcon />}>{isSubmitting ? 'Syncing...' : 'Authorize Global Peer'}</Button>
                </form>
            </Modal>

            <ConfirmationModal 
                isOpen={confirmDelete.isOpen} 
                onClose={() => setConfirmDelete({ isOpen: false, id: null, name: '' })} 
                onConfirm={handleDeleteCommunity}
                title="Infrastructure Purge"
                message={`Permanently remove ${confirmDelete.name}? This will annihilate all associated residents, maintenance ledgers, and community assets. This operation cannot be reversed.`}
                isDestructive
                isLoading={isSubmitting}
                confirmLabel="Annihilate Registry"
            />

            <FeedbackModal isOpen={feedback.isOpen} onClose={() => setFeedback({ ...feedback, isOpen: false })} title={feedback.title} message={feedback.message} type={feedback.type} />
        </div>
    );
};

const AlertTriangleIcon = (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
);

export default AdminPanel;
