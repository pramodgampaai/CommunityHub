
import React, { useState, useEffect, useMemo } from 'react';
import { getResidents, createCommunityUser, getCommunity, onboardTenant, deleteTenant, getCachedData } from '../services/api';
import type { User, Community, Block, TenantProfile } from '../types';
import { UserRole } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import Modal from '../components/ui/Modal';
import FeedbackModal from '../components/ui/FeedbackModal';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import { useAuth } from '../hooks/useAuth';
import { 
    MagnifyingGlassIcon, 
    PlusIcon, 
    UserGroupIcon, 
    ChevronDownIcon, 
    CheckCircleIcon, 
    ArrowRightIcon, 
    HomeIcon, 
    IdentificationIcon, 
    AlertTriangleIcon, 
    TrashIcon,
    EnvelopeIcon,
    XIcon,
    ClipboardDocumentListIcon,
    UserIcon,
    CalendarIcon,
    ShieldCheckIcon
} from '../components/icons';

const Directory: React.FC = () => {
    const { user } = useAuth();
    const cacheKeyR = `residents:${user?.communityId}`;
    const cacheKeyC = `community:${user?.communityId}`;
    
    const [users, setUsers] = useState<User[]>(() => getCachedData(cacheKeyR) || []);
    const [community, setCommunity] = useState<Community | null>(() => getCachedData(cacheKeyC) || null);
    const [loading, setLoading] = useState(!getCachedData(cacheKeyR));
    const [searchQuery, setSearchQuery] = useState('');
    
    const [feedback, setFeedback] = useState<{ isOpen: boolean; type: 'success' | 'error' | 'info'; title: string; message: string }>({
        isOpen: false, type: 'success', title: '', message: ''
    });

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Tenant Management States
    const [isTenantModalOpen, setIsTenantModalOpen] = useState(false);
    const [isAddTenantOpen, setIsAddTenantOpen] = useState(false);
    const [selectedTenantForDetail, setSelectedTenantForDetail] = useState<User | null>(null);
    const [tenantTab, setTenantTab] = useState<'identity' | 'docs' | 'family'>('identity');
    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });

    // New Member Form State
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('Welcome@123');
    const [role, setRole] = useState<UserRole>(UserRole.Resident);
    
    // Resident-specific Unit Provisioning
    const [selectedBlock, setSelectedBlock] = useState('');
    const [selectedFloor, setSelectedFloor] = useState('');
    const [flatNumber, setFlatNumber] = useState('');
    const [flatSize, setFlatSize] = useState('1200');
    const [maintenanceStartDate, setMaintenanceStartDate] = useState(new Date().toISOString().split('T')[0]);

    // Tenant Onboarding Form State
    const [tName, setTName] = useState('');
    const [tEmail, setTEmail] = useState('');
    const [tAadhar, setTAadhar] = useState('');
    const [tPan, setTPan] = useState('');
    const [tCompany, setTCompany] = useState('');
    const [tDesignation, setTDesignation] = useState('');
    const [tOfficeAddr, setTOfficeAddr] = useState('');
    const [tMarital, setTMarital] = useState<'Single' | 'Married'>('Single');
    const [tSpouse, setTSpouse] = useState('');
    const [tKids, setTKids] = useState(0);
    const [tTargetFlat, setTTargetFlat] = useState(user?.flatNumber || '');

    const isAdmin = user?.role === UserRole.Admin || user?.role === UserRole.SuperAdmin;
    const isHelpdeskAdmin = user?.role === UserRole.HelpdeskAdmin;
    const isResident = user?.role === UserRole.Resident;
    const canAddMember = isAdmin || isHelpdeskAdmin;

    const isStandalone = useMemo(() => community?.communityType?.includes('Standalone'), [community]);
    
    const fetchUsers = async () => {
        if (user?.communityId) {
            try {
                const [userData, communityData] = await Promise.all([
                    getResidents(user.communityId),
                    getCommunity(user.communityId)
                ]);
                setUsers(userData);
                setCommunity(communityData);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
    };

    useEffect(() => { fetchUsers(); }, [user]);

    // Auto-select initial role for HelpdeskAdmin
    useEffect(() => {
        if (isHelpdeskAdmin && isAddModalOpen) {
            setRole(UserRole.HelpdeskAgent);
        } else if (isAdmin && isAddModalOpen) {
            setRole(UserRole.Resident);
        }
    }, [isHelpdeskAdmin, isAdmin, isAddModalOpen]);

    // Auto-select block for Standalone
    useEffect(() => {
        if (isStandalone && community?.blocks?.[0] && isAddModalOpen) {
            setSelectedBlock(community.blocks[0].name);
        }
    }, [isStandalone, community, isAddModalOpen]);

    const getFloorOptions = () => {
        if (!community?.blocks) return [];
        const block = community.blocks.find(b => b.name === selectedBlock);
        if (!block) return [];
        return Array.from({ length: block.floorCount }, (_, i) => i + 1);
    };

    const handleAddMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.communityId) return;
        setIsSubmitting(true);
        try {
            const unit_data = role === UserRole.Resident ? {
                flat_number: flatNumber,
                block: selectedBlock,
                floor: parseInt(selectedFloor),
                flat_size: parseFloat(flatSize),
                maintenance_start_date: maintenanceStartDate
            } : undefined;

            await createCommunityUser({
                name, email, password, role,
                community_id: user.communityId,
                unit_data
            });

            setFeedback({ isOpen: true, type: 'success', title: 'Member Provisioned', message: `Account created for ${name}. Credential sent to ${email}.` });
            setIsAddModalOpen(false);
            resetForm();
            await fetchUsers();
        } catch (err: any) {
            setFeedback({ isOpen: true, type: 'error', title: 'Provisioning Error', message: err.message });
        } finally { setIsSubmitting(false); }
    };

    const handleAddTenant = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.communityId || !tTargetFlat) return;
        setIsSubmitting(true);
        try {
            const tenantData = {
                name: tName, email: tEmail, aadharNumber: tAadhar, panNumber: tPan,
                maritalStatus: tMarital, spouseName: tSpouse, kidsCount: tKids,
                workInfo: { companyName: tCompany, designation: tDesignation, officeAddress: tOfficeAddr }
            };
            await onboardTenant(tenantData, user.id, user.communityId, tTargetFlat);
            setFeedback({ isOpen: true, type: 'success', title: 'Tenant Onboarded', message: `${tName} has been granted digital access to unit ${tTargetFlat}.` });
            setIsAddTenantOpen(false);
            resetTenantForm();
            await fetchUsers();
        } catch (err: any) {
            setFeedback({ isOpen: true, type: 'error', title: 'Onboarding Failed', message: err.message });
        } finally { setIsSubmitting(false); }
    };

    const resetForm = () => {
        setName(''); setEmail(''); setRole(isAdmin ? UserRole.Resident : UserRole.HelpdeskAgent); setFlatNumber(''); setSelectedBlock(''); setSelectedFloor('');
    };

    const resetTenantForm = () => {
        setTName(''); setTEmail(''); setTAadhar(''); setTPan(''); setTCompany(''); setTMarital('Single'); setTKids(0);
        setTenantTab('identity');
    };

    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            const match = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         (u.flatNumber && u.flatNumber.toLowerCase().includes(searchQuery.toLowerCase()));
            if (!match) return false;
            
            // 1. SuperAdmin/Admin see everything
            if (isAdmin) return true;
            
            // 2. Helpdesk Admin see only peer Helpdesk staff
            if (isHelpdeskAdmin) {
                return [UserRole.HelpdeskAdmin, UserRole.HelpdeskAgent].includes(u.role);
            }
            
            // 3. Security/Resident/Tenant see core members
            return [UserRole.Resident, UserRole.Admin, UserRole.Tenant].includes(u.role);
        });
    }, [users, searchQuery, user, isAdmin, isHelpdeskAdmin]);

    const myTenants = useMemo(() => {
        if (!user?.units) return [];
        const myFlatNumbers = user.units.map(u => u.flatNumber);
        return users.filter(u => u.role === UserRole.Tenant && myFlatNumbers.includes(u.flatNumber || ''));
    }, [users, user?.units]);

    return (
        <div className="space-y-6 pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 min-h-[5rem]">
                <div className="flex items-start gap-2.5">
                    <div className="w-1 h-10 bg-brand-500 rounded-full mt-1" />
                    <div>
                        <span className="text-[9px] font-mono font-black uppercase tracking-[0.3em] text-brand-600 dark:text-brand-400 mb-0.5 block">Community Registry</span>
                        <h1 className="text-2xl sm:text-3xl font-brand font-extrabold text-brand-600 dark:text-brand-400 tracking-tight leading-tight">Directory</h1>
                    </div>
                </div>
                <div className="flex gap-2">
                    {isResident && (
                        <Button onClick={() => setIsTenantModalOpen(true)} size="md" variant="outlined" leftIcon={<HomeIcon />}>My Tenants</Button>
                    )}
                    {canAddMember && (
                        <Button onClick={() => setIsAddModalOpen(true)} size="md" leftIcon={<PlusIcon />}>Add Member</Button>
                    )}
                </div>
            </div>

            <div className="relative">
                <MagnifyingGlassIcon className="absolute inset-y-0 left-4 flex items-center pointer-events-none h-5 w-5 my-auto text-slate-400" />
                <input 
                    type="text" 
                    placeholder={isHelpdeskAdmin ? "Search helpdesk staff..." : "Search by name or unit number..."} 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)} 
                    className="block w-full pl-12 pr-4 py-3 rounded-2xl input-field text-sm font-bold shadow-sm" 
                />
            </div>

            {loading && users.length === 0 ? <div className="flex justify-center p-20"><Spinner /></div> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredUsers.length === 0 ? (
                        <div className="col-span-full py-24 text-center border-2 border-dashed border-slate-100 dark:border-white/5 rounded-[3rem] opacity-30">
                            <UserGroupIcon className="w-16 h-16 mx-auto mb-4" />
                            <p className="font-brand font-extrabold text-xl">No members found</p>
                        </div>
                    ) : filteredUsers.map((u) => (
                        <Card key={u.id} className="p-5 flex items-center space-x-4 hover:scale-[1.01] transition-transform shadow-sm bg-white dark:bg-zinc-900/40 border border-slate-50 dark:border-white/5 rounded-[2rem]">
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-brand font-extrabold shrink-0 bg-brand-500/10 text-brand-600 overflow-hidden shadow-inner">
                                {u.avatarUrl ? <img src={u.avatarUrl} alt={u.name} className="w-full h-full object-cover" /> : u.name.charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <h3 className="text-base font-brand font-extrabold text-slate-900 dark:text-slate-50 leading-tight truncate">{u.name}</h3>
                                    <span className={`px-2 py-0.5 text-[7px] font-black uppercase tracking-widest rounded-md ${
                                        u.role === UserRole.Admin ? 'bg-amber-50 text-amber-600' : 
                                        u.role === UserRole.Tenant ? 'bg-indigo-50 text-indigo-600' : 
                                        u.role.includes('Helpdesk') ? 'bg-purple-50 text-purple-600' : 'bg-brand-50 text-brand-600'
                                    }`}>
                                        {u.role}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                    <div className="flex items-center gap-1">
                                        <HomeIcon className="w-3 h-3" /> {u.flatNumber || 'N/A'}
                                    </div>
                                    <span className="w-1 h-1 bg-slate-200 rounded-full" />
                                    <div className="flex items-center gap-1">
                                        <EnvelopeIcon className="w-3 h-3" /> {u.email.split('@')[0]}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Add Member Modal */}
            <Modal isOpen={isAddModalOpen} onClose={() => { setIsAddModalOpen(false); resetForm(); }} title="Register Member" subtitle={isHelpdeskAdmin ? "STAFF PROVISIONING" : "PROVISIONING ENGINE"} size="lg">
                <form onSubmit={handleAddMember} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1.5 ml-1">Full Identity</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Legal Name" className="rounded-xl input-field text-sm font-bold"/>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1.5 ml-1">Email Address</label>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="name@domain.com" className="rounded-xl input-field text-sm font-bold"/>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1.5 ml-1">System Role</label>
                            <div className="relative">
                                <select value={role} onChange={e => setRole(e.target.value as UserRole)} className="rounded-xl input-field text-xs font-bold appearance-none bg-white dark:bg-zinc-900">
                                    {Object.values(UserRole).filter(r => {
                                        // HelpdeskAdmin can only create Helpdesk staff
                                        if (isHelpdeskAdmin) {
                                            return [UserRole.HelpdeskAdmin, UserRole.HelpdeskAgent].includes(r);
                                        }
                                        // Standard Admin Role filtering
                                        if (r === UserRole.SuperAdmin || r === UserRole.Tenant) return false;
                                        if (user?.role === UserRole.Admin) {
                                            return ![UserRole.Security, UserRole.HelpdeskAgent].includes(r);
                                        }
                                        return true;
                                    }).map(r => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                </select>
                                <ChevronDownIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>

                        {role === UserRole.Resident && (
                            <div className="sm:col-span-2 p-5 bg-slate-50 dark:bg-black/20 rounded-[1.5rem] border border-slate-100 dark:border-white/5 space-y-4">
                                <h4 className="text-[10px] font-black uppercase text-brand-600 tracking-widest flex items-center gap-2">
                                    <HomeIcon className="w-4 h-4" /> Unit Allocation
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className={isStandalone ? 'col-span-2' : ''}>
                                        <label className="block text-[9px] font-black uppercase text-slate-400 mb-1.5">{isStandalone ? 'Assigned Building' : 'Block / Road'}</label>
                                        <div className="relative">
                                            <select 
                                                value={selectedBlock} 
                                                onChange={e => { setSelectedBlock(e.target.value); setSelectedFloor(''); }} 
                                                required 
                                                disabled={isStandalone}
                                                className="rounded-xl input-field text-xs font-bold appearance-none bg-white dark:bg-zinc-900 disabled:opacity-70"
                                            >
                                                <option value="">Select...</option>
                                                {community?.blocks?.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                                            </select>
                                            {!isStandalone && <ChevronDownIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-black uppercase text-slate-400 mb-1.5">Floor Level</label>
                                        <div className="relative">
                                            <select 
                                                value={selectedFloor} 
                                                onChange={e => setSelectedFloor(e.target.value)} 
                                                required 
                                                disabled={!selectedBlock}
                                                className="rounded-xl input-field text-xs font-bold appearance-none bg-white dark:bg-zinc-900 disabled:opacity-50"
                                            >
                                                <option value="">Select Floor...</option>
                                                {getFloorOptions().map(f => <option key={f} value={f}>Floor {f}</option>)}
                                            </select>
                                            <ChevronDownIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-black uppercase text-slate-400 mb-1.5">Unit No.</label>
                                        <input type="text" value={flatNumber} onChange={e => setFlatNumber(e.target.value)} required placeholder="e.g. 101" className="rounded-xl input-field text-xs font-bold"/>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-black uppercase text-slate-400 mb-1.5">Area (SqFt)</label>
                                        <input type="number" value={flatSize} onChange={e => setFlatSize(e.target.value)} required className="rounded-xl input-field text-xs font-bold"/>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-black uppercase text-slate-400 mb-1.5 ml-1">Billing Start Date</label>
                                        <div className="relative">
                                            <input type="date" value={maintenanceStartDate} onChange={e => setMaintenanceStartDate(e.target.value)} required className="rounded-xl input-field text-xs font-bold appearance-none bg-white dark:bg-zinc-900"/>
                                            <CalendarIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-white/5">
                      <Button type="button" variant="ghost" onClick={() => setIsAddModalOpen(false)}>Discard</Button>
                      <Button type="submit" disabled={isSubmitting} leftIcon={isSubmitting ? <Spinner /> : <CheckCircleIcon />}>{isSubmitting ? 'Syncing...' : 'Provision Account'}</Button>
                    </div>
                </form>
            </Modal>

            {/* Resident: My Tenants Modal */}
            <Modal isOpen={isTenantModalOpen} onClose={() => setIsTenantModalOpen(false)} title="My Unit Tenants" subtitle="OCCUPANCY MANAGEMENT" size="lg">
                <div className="space-y-6">
                    {myTenants.length === 0 ? (
                        <div className="py-12 text-center border-2 border-dashed border-slate-100 dark:border-white/5 rounded-[2rem] opacity-40">
                            <UserGroupIcon className="w-12 h-12 mx-auto mb-3" />
                            <p className="text-[10px] font-black uppercase tracking-widest">No active tenants registered</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {myTenants.map(t => (
                                <div key={t.id} className="p-4 bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 rounded-2xl flex items-center justify-between group transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-lg shadow-indigo-600/20">{t.name[0]}</div>
                                        <div>
                                            <p className="font-bold text-slate-900 dark:text-slate-50">{t.name}</p>
                                            <p className="text-[9px] font-black uppercase text-slate-400">Unit: <span className="text-indigo-600">{t.flatNumber}</span> • {t.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => setSelectedTenantForDetail(t)}
                                            className="px-3 py-1.5 bg-white dark:bg-zinc-800 text-[8px] font-black uppercase tracking-widest text-slate-500 hover:text-brand-600 rounded-lg shadow-sm border border-slate-100 dark:border-white/5 transition-colors"
                                        >
                                            View Details
                                        </button>
                                        <button 
                                            onClick={() => setConfirmDelete({ isOpen: true, id: t.id })}
                                            className="p-2 text-slate-400 hover:text-rose-500 transition-all"
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <Button onClick={() => { setIsTenantModalOpen(false); setIsAddTenantOpen(true); }} className="w-full h-12" leftIcon={<PlusIcon />}>Onboard New Tenant</Button>
                </div>
            </Modal>

            {/* Tenant Detail Inspector Modal */}
            <Modal isOpen={!!selectedTenantForDetail} onClose={() => setSelectedTenantForDetail(null)} title="Tenant Credentials" subtitle="VETTING REPOSITORY" size="lg">
                {selectedTenantForDetail && (
                    <div className="space-y-8">
                        <div className="flex items-center gap-5 p-6 bg-indigo-50 dark:bg-indigo-900/10 rounded-[2.5rem] border border-indigo-100 dark:border-indigo-900/20">
                            <div className="w-16 h-16 rounded-3xl bg-white dark:bg-indigo-500/20 flex items-center justify-center text-3xl font-brand font-black text-indigo-600 shadow-xl shadow-indigo-500/10">
                                {selectedTenantForDetail.name[0]}
                            </div>
                            <div>
                                <h3 className="text-2xl font-brand font-extrabold text-slate-900 dark:text-slate-50 leading-tight">{selectedTenantForDetail.name}</h3>
                                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Unit Occupant • Flat {selectedTenantForDetail.flatNumber}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="p-4 bg-slate-50 dark:bg-black/20 rounded-2xl border border-slate-100 dark:border-white/5">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Aadhar Identification</p>
                                <p className="font-mono text-xs font-bold text-slate-800 dark:text-slate-100">{selectedTenantForDetail.tenantDetails?.aadharNumber || 'Not Provided'}</p>
                            </div>
                            <div className="p-4 bg-slate-50 dark:bg-black/20 rounded-2xl border border-slate-100 dark:border-white/5">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">PAN Card Registry</p>
                                <p className="font-mono text-xs font-bold text-slate-800 dark:text-slate-100">{selectedTenantForDetail.tenantDetails?.panNumber || 'Not Provided'}</p>
                            </div>
                            <div className="p-4 bg-slate-50 dark:bg-black/20 rounded-2xl border border-slate-100 dark:border-white/5 sm:col-span-2">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Professional Summary</p>
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-800 flex items-center justify-center text-indigo-600 shrink-0 shadow-sm">
                                        <IdentificationIcon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">
                                            {selectedTenantForDetail.tenantDetails?.workInfo?.designation || 'Staff'} at {selectedTenantForDetail.tenantDetails?.workInfo?.companyName || 'Private Entity'}
                                        </p>
                                        <p className="text-[10px] text-slate-400 mt-1 font-medium">{selectedTenantForDetail.tenantDetails?.workInfo?.officeAddress || 'Global Office'}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 bg-slate-50 dark:bg-black/20 rounded-2xl border border-slate-100 dark:border-white/5">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Marital Registry</p>
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{selectedTenantForDetail.tenantDetails?.maritalStatus}</p>
                                {selectedTenantForDetail.tenantDetails?.spouseName && (
                                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">Spouse: {selectedTenantForDetail.tenantDetails.spouseName}</p>
                                )}
                            </div>
                            <div className="p-4 bg-slate-50 dark:bg-black/20 rounded-2xl border border-slate-100 dark:border-white/5">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Family Units</p>
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{selectedTenantForDetail.tenantDetails?.kidsCount || 0} Dependents (Kids)</p>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-white/5">
                            <Button variant="outlined" onClick={() => setSelectedTenantForDetail(null)}>Close Inspector</Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Resident: Onboard Tenant Wizard */}
            <Modal isOpen={isAddTenantOpen} onClose={() => { setIsAddTenantOpen(false); resetTenantForm(); }} title="Tenant Onboarding" subtitle="ACCESS PRIVILEGE ASSIGNMENT" size="lg">
                <div className="space-y-8">
                    {/* Step Indicator */}
                    <div className="flex items-center justify-between px-2">
                        {[
                            { id: 'identity', label: 'Identity', icon: UserIcon },
                            { id: 'docs', label: 'Work & ID', icon: ClipboardDocumentListIcon },
                            { id: 'family', label: 'Family', icon: UserGroupIcon }
                        ].map((s, idx) => (
                            <React.Fragment key={s.id}>
                                <div className="flex flex-col items-center gap-2">
                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
                                        tenantTab === s.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-100 dark:bg-white/5 text-slate-400'
                                    }`}>
                                        <s.icon className="w-5 h-5" />
                                    </div>
                                    <span className={`text-[8px] font-black uppercase tracking-widest ${tenantTab === s.id ? 'text-indigo-600' : 'text-slate-400'}`}>{s.label}</span>
                                </div>
                                {idx < 2 && <div className="flex-1 h-0.5 mx-4 bg-slate-100 dark:bg-white/5" />}
                            </React.Fragment>
                        ))}
                    </div>

                    <form onSubmit={handleAddTenant} className="space-y-6">
                        {tenantTab === 'identity' && (
                            <div className="space-y-5 animate-fadeIn">
                                <div>
                                    <label className="block text-[9px] font-black uppercase text-slate-400 mb-1.5 ml-1">Legal Name</label>
                                    <input type="text" value={tName} onChange={e => setTName(e.target.value)} required className="rounded-xl input-field text-sm font-bold"/>
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black uppercase text-slate-400 mb-1.5 ml-1">Digital Identity (Email)</label>
                                    <input type="email" value={tEmail} onChange={e => setTEmail(e.target.value)} required className="rounded-xl input-field text-sm font-bold"/>
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black uppercase text-slate-400 mb-1.5 ml-1">Assignment Unit</label>
                                    <div className="relative">
                                        <select 
                                            value={tTargetFlat} 
                                            onChange={e => setTTargetFlat(e.target.value)} 
                                            required 
                                            className="rounded-xl input-field text-xs font-bold appearance-none bg-white dark:bg-zinc-900"
                                        >
                                            {user?.units?.map(u => (
                                                <option key={u.id} value={u.flatNumber}>Unit {u.flatNumber} ({u.block || 'Main'})</option>
                                            ))}
                                        </select>
                                        <ChevronDownIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>
                                <div className="flex justify-end pt-4">
                                    <Button type="button" onClick={() => setTenantTab('docs')} rightIcon={<ArrowRightIcon />}>Next: Documentation</Button>
                                </div>
                            </div>
                        )}

                        {tenantTab === 'docs' && (
                            <div className="space-y-5 animate-fadeIn">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[9px] font-black uppercase text-slate-400 mb-1.5 ml-1">Aadhar Number</label>
                                        <input type="text" value={tAadhar} onChange={e => setTAadhar(e.target.value)} placeholder="0000 0000 0000" className="rounded-xl input-field text-sm font-bold"/>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-black uppercase text-slate-400 mb-1.5 ml-1">PAN Number</label>
                                        <input type="text" value={tPan} onChange={e => setTPan(e.target.value)} placeholder="ABCDE1234F" className="rounded-xl input-field text-sm font-bold"/>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-[9px] font-black uppercase text-slate-400 mb-1.5 ml-1">Employer / Company</label>
                                        <input type="text" value={tCompany} onChange={e => setTCompany(e.target.value)} className="rounded-xl input-field text-sm font-bold"/>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-black uppercase text-slate-400 mb-1.5 ml-1">Designation</label>
                                        <input type="text" value={tDesignation} onChange={e => setTDesignation(e.target.value)} className="rounded-xl input-field text-sm font-bold"/>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-black uppercase text-slate-400 mb-1.5 ml-1">Office Location</label>
                                        <input type="text" value={tOfficeAddr} onChange={e => setTOfficeAddr(e.target.value)} className="rounded-xl input-field text-sm font-bold"/>
                                    </div>
                                </div>
                                <div className="flex justify-between pt-4">
                                    <Button type="button" variant="ghost" onClick={() => setTenantTab('identity')}>Previous</Button>
                                    <Button type="button" onClick={() => setTenantTab('family')} rightIcon={<ArrowRightIcon />}>Next: Family Details</Button>
                                </div>
                            </div>
                        )}

                        {tenantTab === 'family' && (
                            <div className="space-y-5 animate-fadeIn">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[9px] font-black uppercase text-slate-400 mb-1.5 ml-1">Marital Status</label>
                                        <select value={tMarital} onChange={e => setTMarital(e.target.value as any)} className="rounded-xl input-field text-xs font-bold">
                                            <option value="Single">Single</option>
                                            <option value="Married">Married</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-black uppercase text-slate-400 mb-1.5 ml-1">Kids Count</label>
                                        <input type="number" value={tKids} onChange={e => setTKids(parseInt(e.target.value) || 0)} className="rounded-xl input-field text-sm font-bold"/>
                                    </div>
                                </div>
                                {tMarital === 'Married' && (
                                    <div className="animate-fadeIn">
                                        <label className="block text-[9px] font-black uppercase text-slate-400 mb-1.5 ml-1">Spouse Name</label>
                                        <input type="text" value={tSpouse} onChange={e => setTSpouse(e.target.value)} className="rounded-xl input-field text-sm font-bold"/>
                                    </div>
                                )}
                                <div className="flex justify-between pt-4 border-t border-slate-100 dark:border-white/5">
                                    <Button type="button" variant="ghost" onClick={() => setTenantTab('docs')}>Back</Button>
                                    <Button type="submit" disabled={isSubmitting} leftIcon={isSubmitting ? <Spinner /> : <CheckCircleIcon />}>{isSubmitting ? 'Finalizing...' : 'Onboard Tenant'}</Button>
                                </div>
                            </div>
                        )}
                    </form>
                </div>
            </Modal>

            <ConfirmationModal 
                isOpen={confirmDelete.isOpen} 
                onClose={() => setConfirmDelete({ isOpen: false, id: null })} 
                onConfirm={async () => {
                    if (confirmDelete.id) {
                        await deleteTenant(confirmDelete.id);
                        setConfirmDelete({ isOpen: false, id: null });
                        await fetchUsers();
                        setFeedback({ isOpen: true, type: 'success', title: 'Access Revoked', message: 'Tenant has been removed from your unit registry.' });
                    }
                }}
                title="Revoke Access"
                message="Are you sure you want to remove this tenant? This will immediately terminate their digital access to community gates and facilities."
                isDestructive
                confirmLabel="Revoke Access"
            />

            <FeedbackModal isOpen={feedback.isOpen} onClose={() => setFeedback({ ...feedback, isOpen: false })} title={feedback.title} message={feedback.message} type={feedback.type} />
        </div>
    );
};

export default Directory;
