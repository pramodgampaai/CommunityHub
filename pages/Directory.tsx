
import React, { useState, useEffect, useMemo } from 'react';
import { getResidents, createCommunityUser, getCommunity, onboardTenant, deleteTenant } from '../services/api';
import type { User, Community, Block, TenantProfile } from '../types';
import { UserRole } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import Modal from '../components/ui/Modal';
import FeedbackModal from '../components/ui/FeedbackModal';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import { useAuth } from '../hooks/useAuth';
import { MagnifyingGlassIcon, PlusIcon, UserGroupIcon, ChevronDownIcon, CheckCircleIcon, ArrowRightIcon, HomeIcon, IdentificationIcon, AlertTriangleIcon, PencilIcon, TrashIcon } from '../components/icons';

const Directory: React.FC = () => {
    const { user } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [community, setCommunity] = useState<Community | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Feedback State
    const [feedback, setFeedback] = useState<{ isOpen: boolean; type: 'success' | 'error' | 'info'; title: string; message: string }>({
        isOpen: false, type: 'success', title: '', message: ''
    });

    // Create User Modal State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'identity' | 'assignment'>('identity');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Tenant Management State
    const [isTenantModalOpen, setIsTenantModalOpen] = useState(false);
    const [isAddTenantOpen, setIsAddTenantOpen] = useState(false);
    const [tenantTab, setTenantTab] = useState<'personal' | 'docs' | 'family'>('personal');
    const [editingTenantEmail, setEditingTenantEmail] = useState<string | null>(null);
    
    // Confirmation Modal for Tenant Deletion
    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; tenantId: string | null }>({ isOpen: false, tenantId: null });

    // Form State - Identity
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<UserRole>(UserRole.Resident);
    
    // Form State - Assignment
    const [flatNumber, setFlatNumber] = useState('');
    const [selectedBlock, setSelectedBlock] = useState('');
    const [selectedFloor, setSelectedFloor] = useState('');
    const [flatSize, setFlatSize] = useState('');
    const [maintenanceStartDate, setMaintenanceStartDate] = useState(new Date().toISOString().split('T')[0]);

    // Tenant Form Data
    const [tenantData, setTenantData] = useState<TenantProfile & { name: string; email: string }>({
        name: '', email: '', 
        aadharNumber: '', panNumber: '', aadharUrl: '', panUrl: '',
        maritalStatus: 'Single', spouseName: '', kidsCount: 0,
        workInfo: { companyName: '', designation: '', officeAddress: '' }
    });

    // Logic: Residents and ground staff need the "Assignment" step.
    const isStaffRole = role === UserRole.HelpdeskAgent || role === UserRole.Security;
    const isResidentRole = role === UserRole.Resident;
    const needsAssignmentTab = isResidentRole || isStaffRole; 

    const isStandalone = community?.communityType?.includes('Standalone');
    const isVilla = community?.communityType === 'Gated Community Villa';

    useEffect(() => {
        if (!needsAssignmentTab && activeTab === 'assignment') {
            setActiveTab('identity');
        }
    }, [role, needsAssignmentTab]);

    const getAllowedRolesForCurrentActor = (): { value: UserRole; label: string }[] => {
        if (!user) return [];
        switch (user.role) {
            case UserRole.SuperAdmin:
                return Object.values(UserRole).map(r => ({ value: r, label: r.replace(/([A-Z])/g, ' $1').trim() }));
            case UserRole.Admin:
                return [
                    { value: UserRole.Resident, label: 'Resident' },
                    { value: UserRole.Admin, label: 'Property Admin' },
                    { value: UserRole.HelpdeskAdmin, label: 'Helpdesk Admin' },
                    { value: UserRole.SecurityAdmin, label: 'Security Admin' }
                ];
            case UserRole.HelpdeskAdmin:
                return [
                    { value: UserRole.HelpdeskAdmin, label: 'Helpdesk Admin' },
                    { value: UserRole.HelpdeskAgent, label: 'Helpdesk Staff (Agent)' }
                ];
            case UserRole.SecurityAdmin:
                return [
                    { value: UserRole.SecurityAdmin, label: 'Security Admin' },
                    { value: UserRole.Security, label: 'Security Staff (Guard)' }
                ];
            default: return [];
        }
    };

    const allowedRoles = getAllowedRolesForCurrentActor();

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
                console.error("Directory fetch failed", e);
            } finally {
                setLoading(false);
            }
        }
    };

    useEffect(() => { fetchUsers(); }, [user]);

    /**
     * Role-Based Visibility Filtering Logic (Strict Partitioning)
     * Ensures users only see relevant peers and supervisors within the same community.
     */
    const filteredUsers = useMemo(() => {
        if (!user) return [];
        
        return users.filter(u => {
            // 1. Search Query Match
            const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                (u.flatNumber && u.flatNumber.toLowerCase().includes(searchQuery.toLowerCase()));
            
            if (!matchesSearch) return false;

            // 2. Role-Based Access Rules (Strict Partitioning)
            const myRole = user.role;
            const targetRole = u.role;

            switch (myRole) {
                case UserRole.SuperAdmin:
                    return true; 

                case UserRole.Admin:
                    // Admin can see Residents, Tenants, Admins, Staff admins
                    return [UserRole.Admin, UserRole.Resident, UserRole.HelpdeskAdmin, UserRole.SecurityAdmin, UserRole.Tenant].includes(targetRole);

                case UserRole.Resident:
                    // Resident: Access to Resident, Admin
                    return [UserRole.Resident, UserRole.Admin].includes(targetRole);

                case UserRole.HelpdeskAdmin:
                    return [UserRole.HelpdeskAdmin, UserRole.HelpdeskAgent].includes(targetRole);

                case UserRole.SecurityAdmin:
                    return [UserRole.SecurityAdmin, UserRole.Security].includes(targetRole);

                default:
                    return false;
            }
        });
    }, [users, searchQuery, user]);

    const myTenants = useMemo(() => {
        if (user?.role !== UserRole.Resident) return [];
        return users.filter(u => u.role === UserRole.Tenant && u.flatNumber === user.flatNumber);
    }, [users, user]);

    const activeTenant = myTenants.find(t => t.status === 'active');
    const pastTenants = myTenants.filter(t => t.status !== 'active');

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.communityId) return;
        
        setIsSubmitting(true);
        try {
            const payload: any = {
                name, email, password, role,
                community_id: user.communityId
            };

            if (isResidentRole) {
                payload.unit_data = {
                    block: isStandalone ? 'Main Building' : selectedBlock,
                    floor: selectedFloor ? parseInt(selectedFloor) : undefined,
                    flat_number: flatNumber,
                    flat_size: parseFloat(flatSize),
                    maintenance_start_date: maintenanceStartDate
                };
            } else if (isStaffRole) {
                payload.flat_number = flatNumber; // Duty Post
            }

            await createCommunityUser(payload);
            setIsAddModalOpen(false);
            resetForm();
            await fetchUsers();
            
            setFeedback({
                isOpen: true,
                type: 'success',
                title: 'Member Onboarded',
                message: `${name} has been successfully registered and assigned access to the community portal.`
            });
        } catch (error: any) {
            setFeedback({
                isOpen: true,
                type: 'error',
                title: 'Onboarding Failed',
                message: error.message || "We encountered an issue while creating the member profile. Please verify the email identity."
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddTenant = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setIsSubmitting(true);
        try {
            await onboardTenant(tenantData, user);
            setIsAddTenantOpen(false);
            resetTenantForm();
            await fetchUsers();
            setFeedback({
                isOpen: true, type: 'success', title: editingTenantEmail ? 'Tenant Updated' : 'Tenant Onboarded', 
                message: editingTenantEmail ? "Tenant details updated successfully." : "New tenant access granted. Default password is 'Welcome@123'."
            });
        } catch (err: any) {
            setFeedback({ isOpen: true, type: 'error', title: 'Failed', message: err.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteTenant = async () => {
        if (!confirmDelete.tenantId || !user) return;
        setIsSubmitting(true);
        try {
            await deleteTenant(confirmDelete.tenantId);
            setConfirmDelete({ isOpen: false, tenantId: null });
            await fetchUsers();
            setFeedback({ isOpen: true, type: 'success', title: 'Tenant Removed', message: 'Tenant access has been revoked and profile removed.' });
        } catch (err: any) {
            setFeedback({ isOpen: true, type: 'error', title: 'Deletion Failed', message: err.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditTenant = (tenant: User) => {
        if (!tenant.tenantDetails) return;
        setTenantData({
            name: tenant.name,
            email: tenant.email,
            aadharNumber: tenant.tenantDetails.aadharNumber,
            panNumber: tenant.tenantDetails.panNumber,
            aadharUrl: tenant.tenantDetails.aadharUrl || '',
            panUrl: tenant.tenantDetails.panUrl || '',
            maritalStatus: tenant.tenantDetails.maritalStatus,
            spouseName: tenant.tenantDetails.spouseName || '',
            kidsCount: tenant.tenantDetails.kidsCount || 0,
            workInfo: tenant.tenantDetails.workInfo
        });
        setEditingTenantEmail(tenant.email);
        setIsAddTenantOpen(true);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'aadharUrl' | 'panUrl') => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setTenantData(prev => ({ ...prev, [field]: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const resetForm = () => {
        setName(''); setEmail(''); setPassword('');
        const roles = getAllowedRolesForCurrentActor();
        if (roles.length > 0) setRole(roles[0].value);
        setFlatNumber(''); setSelectedBlock(''); setSelectedFloor(''); setFlatSize('');
        setMaintenanceStartDate(new Date().toISOString().split('T')[0]);
        setActiveTab('identity');
    };

    const resetTenantForm = () => {
        setTenantData({
            name: '', email: '', aadharNumber: '', panNumber: '', aadharUrl: '', panUrl: '',
            maritalStatus: 'Single', spouseName: '', kidsCount: 0,
            workInfo: { companyName: '', designation: '', officeAddress: '' }
        });
        setTenantTab('personal');
        setEditingTenantEmail(null);
    }

    const isIdentityValid = name.trim() && email.trim() && password.trim() && role;
    const isAssignmentValid = !needsAssignmentTab || (
        isStaffRole ? flatNumber.trim() : (
            flatNumber.trim() && flatSize.trim() && (isStandalone || selectedBlock)
        )
    );

    const getFloorOptions = () => {
        if (!selectedBlock || !community?.blocks) return [];
        const block = community.blocks.find(b => b.name === selectedBlock);
        return block ? Array.from({ length: block.floorCount }, (_, i) => i + 1) : [];
    };

    const isTenantPersonalValid = tenantData.name && tenantData.email && tenantData.workInfo.companyName;
    const isTenantDocsValid = tenantData.aadharNumber && tenantData.panNumber && tenantData.aadharUrl && tenantData.panUrl;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
                <div className="flex items-start gap-2.5">
                    <div className="w-1 h-10 bg-brand-500 rounded-full mt-1" />
                    <div>
                        <span className="text-[8px] font-mono font-black uppercase tracking-[0.3em] text-brand-600 dark:text-brand-400 mb-0.5 block">Registry</span>
                        <h1 className="text-2xl sm:text-3xl font-brand font-extrabold text-brand-600 tracking-tight">Directory</h1>
                    </div>
                </div>
                <div className="flex gap-2">
                    {user?.role === UserRole.Resident && (
                        <>
                            <Button onClick={() => setIsTenantModalOpen(true)} size="md" variant="outlined" leftIcon={<HomeIcon />}>
                                My Tenants
                            </Button>
                            <Button onClick={() => { resetTenantForm(); setIsAddTenantOpen(true); }} size="md" leftIcon={<PlusIcon />}>
                                Onboard Tenant
                            </Button>
                        </>
                    )}
                    {allowedRoles.length > 0 && (
                        <Button onClick={() => { resetForm(); setIsAddModalOpen(true); }} size="md" leftIcon={<PlusIcon />}>
                            Add Member
                        </Button>
                    )}
                </div>
            </div>

            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className="h-5 w-5 text-slate-400" />
                </div>
                <input
                    type="text"
                    placeholder="Search visible members..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="block w-full pl-12 pr-4 py-2.5 rounded-xl input-field text-sm font-bold shadow-sm"
                />
            </div>

            {loading ? (
                <div className="flex justify-center p-20"><Spinner /></div>
            ) : filteredUsers.length === 0 ? (
                <div className="p-16 text-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-white/5 rounded-3xl">
                    <UserGroupIcon className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    <p className="font-bold uppercase tracking-widest text-[9px]">No records accessible</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredUsers.map((u) => (
                        <Card key={u.id} className="p-5 flex items-center space-x-4 hover:scale-[1.01] transition-transform shadow-md bg-white dark:bg-zinc-900/40 border border-slate-50 dark:border-white/5">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-brand font-extrabold shrink-0 overflow-hidden ${u.role === UserRole.Tenant ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-300' : 'bg-brand-500/10 text-brand-600'}`}>
                                {u.avatarUrl ? <img src={u.avatarUrl} alt={u.name} className="w-full h-full object-cover" /> : u.name.charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="text-base font-brand font-extrabold text-slate-900 dark:text-slate-50 leading-tight truncate">{u.name}</h3>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <p className={`text-[8px] font-black uppercase tracking-widest ${u.role === UserRole.Tenant ? 'text-indigo-500' : 'text-brand-600 dark:text-brand-400'}`}>{u.role}</p>
                                    {u.role === UserRole.Tenant && u.status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>}
                                </div>
                                {u.flatNumber && (
                                    <p className="text-[10px] font-bold text-slate-400 mt-1 truncate">Loc: {u.flatNumber}</p>
                                )}
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Add User Modal */}
            <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add Member" subtitle="ONBOARDING FLOW" size="lg">
                <div className="space-y-6">
                    {needsAssignmentTab && (
                        <div className="flex border-b border-slate-100 dark:border-white/5 pb-0">
                            <button onClick={() => setActiveTab('identity')} className={`flex-1 pb-3 text-[10px] font-black uppercase tracking-widest transition-all relative ${activeTab === 'identity' ? 'text-brand-600' : 'text-slate-400'}`}>
                                1. Account identity
                                {activeTab === 'identity' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600" />}
                            </button>
                            <button onClick={() => isIdentityValid && setActiveTab('assignment')} disabled={!isIdentityValid} className={`flex-1 pb-3 text-[10px] font-black uppercase tracking-widest transition-all relative ${activeTab === 'assignment' ? 'text-brand-600' : 'text-slate-400 disabled:opacity-50'}`}>
                                2. {isResidentRole ? 'Unit Assignment' : 'Duty Assignment'}
                                {activeTab === 'assignment' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600" />}
                            </button>
                        </div>
                    )}

                    <form onSubmit={handleCreateUser} className="space-y-4 pt-2">
                        {activeTab === 'identity' ? (
                            <div className="space-y-4 animate-fadeIn">
                                <div>
                                    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Full Name</label>
                                    <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. John Doe" className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold"/>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Email Identity</label>
                                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="john@example.com" className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold"/>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Temp Password</label>
                                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold"/>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Member Role</label>
                                    <div className="relative">
                                        <select value={role} onChange={e => setRole(e.target.value as UserRole)} className="block w-full px-4 py-3 rounded-xl input-field text-xs font-bold appearance-none bg-white dark:bg-zinc-900">
                                            {allowedRoles.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                        </select>
                                        <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>
                                <div className="flex justify-end pt-4">
                                    {needsAssignmentTab ? (
                                        <Button type="button" disabled={!isIdentityValid} onClick={() => setActiveTab('assignment')} size="lg" className="w-full sm:w-auto" leftIcon={<ArrowRightIcon />}>Next: Assignment</Button>
                                    ) : (
                                        <Button type="submit" disabled={isSubmitting || !isIdentityValid} size="lg" className="w-full sm:w-auto" leftIcon={<CheckCircleIcon />}>{isSubmitting ? 'Onboarding...' : 'Onboard Member'}</Button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4 animate-fadeIn">
                                {isResidentRole ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {!isStandalone && (
                                            <div className="sm:col-span-2">
                                                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">{isVilla ? 'Road / Street' : 'Block / Tower'}</label>
                                                <select value={selectedBlock} onChange={e => { setSelectedBlock(e.target.value); setSelectedFloor(''); }} required className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold appearance-none bg-white dark:bg-zinc-900">
                                                    <option value="">Select Location...</option>
                                                    {community?.blocks?.map((b, i) => <option key={i} value={b.name}>{b.name}</option>)}
                                                </select>
                                            </div>
                                        )}
                                        {!isVilla && (
                                            <div>
                                                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Floor</label>
                                                <select value={selectedFloor} onChange={e => setSelectedFloor(e.target.value)} required disabled={!isStandalone && !selectedBlock} className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold appearance-none bg-white dark:bg-zinc-900 disabled:opacity-50">
                                                    <option value="">Floor...</option>
                                                    {isStandalone ? (
                                                        Array.from({ length: community?.blocks?.[0]?.floorCount || 0 }, (_, i) => i + 1).map(f => <option key={f} value={f}>{f}</option>)
                                                    ) : getFloorOptions().map(f => <option key={f} value={f}>{f}</option>)}
                                                </select>
                                            </div>
                                        )}
                                        <div className={isVilla ? "sm:col-span-2" : ""}>
                                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">{isVilla ? 'Villa Number' : 'Flat Number'}</label>
                                            <input type="text" value={flatNumber} onChange={e => setFlatNumber(e.target.value)} required placeholder="e.g. 101" className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold"/>
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Size (Sq. Ft)</label>
                                            <input type="number" value={flatSize} onChange={e => setFlatSize(e.target.value)} required min="1" placeholder="e.g. 1200" className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold"/>
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Bill Start Date</label>
                                            <input type="date" value={maintenanceStartDate} onChange={e => setMaintenanceStartDate(e.target.value)} required className="block w-full px-4 py-3 rounded-xl input-field text-xs font-bold"/>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Duty Desk / Post</label>
                                        <input type="text" value={flatNumber} onChange={e => setFlatNumber(e.target.value)} required placeholder="e.g. Main Security Gate" className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold"/>
                                    </div>
                                )}
                                <div className="flex justify-between pt-4 gap-3">
                                    <Button type="button" variant="outlined" onClick={() => setActiveTab('identity')} size="lg">Back</Button>
                                    <Button type="submit" disabled={isSubmitting || !isAssignmentValid} size="lg" className="flex-1" leftIcon={<CheckCircleIcon />}>{isSubmitting ? 'Onboarding...' : 'Onboard Member'}</Button>
                                </div>
                            </div>
                        )}
                    </form>
                </div>
            </Modal>

            {/* Tenant History Modal */}
            <Modal isOpen={isTenantModalOpen} onClose={() => setIsTenantModalOpen(false)} title="My Tenants" subtitle="OCCUPANCY HISTORY" size="lg">
                <div className="space-y-6">
                    <div className="flex justify-between items-center bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Current Status</p>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                                {activeTenant ? activeTenant.name : 'Unit is Vacant'}
                            </h3>
                        </div>
                        <div className="flex gap-2">
                            {activeTenant && (
                                <>
                                    <Button size="sm" variant="outlined" onClick={() => handleEditTenant(activeTenant)} leftIcon={<PencilIcon />}>Edit</Button>
                                    <Button size="sm" variant="outlined" className="text-rose-600 border-rose-200 hover:bg-rose-50" onClick={() => setConfirmDelete({ isOpen: true, tenantId: activeTenant.id })} leftIcon={<TrashIcon />}>Remove</Button>
                                </>
                            )}
                            <Button onClick={() => { resetTenantForm(); setIsAddTenantOpen(true); }} size="sm" leftIcon={<PlusIcon />}>Onboard New</Button>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Tenancy History</h4>
                        {activeTenant && (
                            <div className="p-4 bg-white dark:bg-zinc-900/40 rounded-xl border border-emerald-500/30 shadow-sm flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-slate-900 dark:text-slate-50">{activeTenant.name}</p>
                                    <p className="text-xs text-slate-500">{activeTenant.email}</p>
                                </div>
                                <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase px-2 py-1 rounded">Active</span>
                            </div>
                        )}
                        {pastTenants.map(t => (
                            <div key={t.id} className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 flex justify-between items-center opacity-70 grayscale">
                                <div>
                                    <p className="font-bold text-slate-800 dark:text-slate-200">{t.name}</p>
                                    <p className="text-xs text-slate-500">{t.email}</p>
                                </div>
                                <span className="bg-slate-200 dark:bg-white/10 text-slate-600 text-[9px] font-black uppercase px-2 py-1 rounded">Past</span>
                            </div>
                        ))}
                    </div>
                </div>
            </Modal>

            {/* Add Tenant Wizard */}
            <Modal isOpen={isAddTenantOpen} onClose={() => { setIsAddTenantOpen(false); resetTenantForm(); }} title={editingTenantEmail ? "Edit Tenant" : "Onboard Tenant"} subtitle={editingTenantEmail ? "UPDATE DETAILS" : "NEW OCCUPANT"} size="lg">
                <div className="space-y-6">
                    <div className="flex border-b border-slate-100 dark:border-white/5 pb-0 mb-4">
                        <button onClick={() => setTenantTab('personal')} className={`flex-1 pb-3 text-[9px] font-black uppercase tracking-widest relative ${tenantTab === 'personal' ? 'text-brand-600' : 'text-slate-400'}`}>
                            1. Identity & Work
                            {tenantTab === 'personal' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600" />}
                        </button>
                        <button onClick={() => isTenantPersonalValid && setTenantTab('docs')} disabled={!isTenantPersonalValid} className={`flex-1 pb-3 text-[9px] font-black uppercase tracking-widest relative ${tenantTab === 'docs' ? 'text-brand-600' : 'text-slate-400 disabled:opacity-50'}`}>
                            2. Documents
                            {tenantTab === 'docs' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600" />}
                        </button>
                        <button onClick={() => isTenantPersonalValid && isTenantDocsValid && setTenantTab('family')} disabled={!isTenantPersonalValid || !isTenantDocsValid} className={`flex-1 pb-3 text-[9px] font-black uppercase tracking-widest relative ${tenantTab === 'family' ? 'text-brand-600' : 'text-slate-400 disabled:opacity-50'}`}>
                            3. Family Info
                            {tenantTab === 'family' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600" />}
                        </button>
                    </div>

                    <form onSubmit={handleAddTenant} className="space-y-4">
                        {tenantTab === 'personal' && (
                            <div className="space-y-4 animate-fadeIn">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Full Name</label>
                                        <input type="text" value={tenantData.name} onChange={e => setTenantData({...tenantData, name: e.target.value})} required className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold"/>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Email (Login ID)</label>
                                        <input type="email" value={tenantData.email} onChange={e => setTenantData({...tenantData, email: e.target.value})} required disabled={!!editingTenantEmail} className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold disabled:opacity-50"/>
                                    </div>
                                </div>
                                <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-slate-100 dark:border-white/5 space-y-4">
                                    <h5 className="text-[9px] font-black uppercase tracking-widest text-slate-400">Work Profile</h5>
                                    <div>
                                        <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Company Name</label>
                                        <input type="text" value={tenantData.workInfo.companyName} onChange={e => setTenantData({...tenantData, workInfo: {...tenantData.workInfo, companyName: e.target.value}})} required className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold"/>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Designation</label>
                                            <input type="text" value={tenantData.workInfo.designation} onChange={e => setTenantData({...tenantData, workInfo: {...tenantData.workInfo, designation: e.target.value}})} className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold"/>
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Office Location</label>
                                            <input type="text" value={tenantData.workInfo.officeAddress} onChange={e => setTenantData({...tenantData, workInfo: {...tenantData.workInfo, officeAddress: e.target.value}})} className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold"/>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end pt-2">
                                    <Button type="button" disabled={!isTenantPersonalValid} onClick={() => setTenantTab('docs')} size="lg" leftIcon={<ArrowRightIcon />}>Next</Button>
                                </div>
                            </div>
                        )}

                        {tenantTab === 'docs' && (
                            <div className="space-y-6 animate-fadeIn">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Aadhar Number</label>
                                        <input type="text" value={tenantData.aadharNumber} onChange={e => setTenantData({...tenantData, aadharNumber: e.target.value})} required className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold"/>
                                        <div className="mt-2 relative group">
                                            <div className="h-32 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl flex items-center justify-center bg-slate-50 dark:bg-black/20 overflow-hidden">
                                                {tenantData.aadharUrl ? <img src={tenantData.aadharUrl} className="w-full h-full object-contain" /> : <IdentificationIcon className="w-8 h-8 text-slate-300" />}
                                            </div>
                                            <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'aadharUrl')} className="absolute inset-0 opacity-0 cursor-pointer" />
                                            <p className="text-[8px] text-center mt-1 text-slate-400 uppercase font-black">Upload Aadhar Scan</p>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">PAN Number</label>
                                        <input type="text" value={tenantData.panNumber} onChange={e => setTenantData({...tenantData, panNumber: e.target.value})} required className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold"/>
                                        <div className="mt-2 relative group">
                                            <div className="h-32 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl flex items-center justify-center bg-slate-50 dark:bg-black/20 overflow-hidden">
                                                {tenantData.panUrl ? <img src={tenantData.panUrl} className="w-full h-full object-contain" /> : <IdentificationIcon className="w-8 h-8 text-slate-300" />}
                                            </div>
                                            <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'panUrl')} className="absolute inset-0 opacity-0 cursor-pointer" />
                                            <p className="text-[8px] text-center mt-1 text-slate-400 uppercase font-black">Upload PAN Scan</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end pt-2 gap-2">
                                    <Button type="button" variant="outlined" onClick={() => setTenantTab('personal')} size="lg">Back</Button>
                                    <Button type="button" disabled={!isTenantDocsValid} onClick={() => setTenantTab('family')} size="lg" leftIcon={<ArrowRightIcon />}>Next</Button>
                                </div>
                            </div>
                        )}

                        {tenantTab === 'family' && (
                            <div className="space-y-4 animate-fadeIn">
                                <div>
                                    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Marital Status</label>
                                    <div className="relative">
                                        <select value={tenantData.maritalStatus} onChange={e => setTenantData({...tenantData, maritalStatus: e.target.value as any})} className="block w-full px-4 py-3 rounded-xl input-field text-xs font-bold appearance-none bg-white dark:bg-zinc-900">
                                            <option value="Single">Single</option>
                                            <option value="Married">Married</option>
                                        </select>
                                        <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>
                                {tenantData.maritalStatus === 'Married' && (
                                    <div>
                                        <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Spouse Name</label>
                                        <input type="text" value={tenantData.spouseName} onChange={e => setTenantData({...tenantData, spouseName: e.target.value})} className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold"/>
                                    </div>
                                )}
                                <div>
                                    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Number of Kids</label>
                                    <input type="number" min="0" value={tenantData.kidsCount} onChange={e => setTenantData({...tenantData, kidsCount: parseInt(e.target.value) || 0})} className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold"/>
                                </div>
                                
                                <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/20 flex gap-3 text-amber-700 dark:text-amber-300">
                                    <AlertTriangleIcon className="w-5 h-5 shrink-0" />
                                    <p className="text-xs font-bold">{editingTenantEmail ? 'Updates will take effect immediately.' : 'Activating a new tenant will automatically revoke access for any currently active tenant in this unit.'}</p>
                                </div>

                                <div className="flex justify-end pt-2 gap-2">
                                    <Button type="button" variant="outlined" onClick={() => setTenantTab('docs')} size="lg">Back</Button>
                                    <Button type="submit" disabled={isSubmitting} size="lg" leftIcon={<CheckCircleIcon />}>{isSubmitting ? (editingTenantEmail ? 'Updating...' : 'Onboarding...') : (editingTenantEmail ? 'Save Changes' : 'Confirm Tenant')}</Button>
                                </div>
                            </div>
                        )}
                    </form>
                </div>
            </Modal>

            <ConfirmationModal 
                isOpen={confirmDelete.isOpen} 
                onClose={() => setConfirmDelete({ isOpen: false, tenantId: null })} 
                onConfirm={handleDeleteTenant} 
                title="Remove Tenant" 
                message="Are you sure you want to remove this tenant? This will permanently delete their account and access." 
                isDestructive 
                isLoading={isSubmitting} 
                confirmLabel="Yes, Remove" 
            />

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

export default Directory;
