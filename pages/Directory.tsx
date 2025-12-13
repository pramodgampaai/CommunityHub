
import React, { useState, useEffect } from 'react';
import { getResidents, createCommunityUser, getCommunity, getMaintenanceRecords } from '../services/api';
import type { User, Community, Block, MaintenanceRecord, Unit, CommunityType } from '../types';
import { UserRole, MaintenanceStatus } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { PlusIcon, FunnelIcon, MagnifyingGlassIcon, PencilIcon, TrashIcon, AlertTriangleIcon, HistoryIcon } from '../components/icons';
import { useAuth } from '../hooks/useAuth';
import { useScreen } from '../hooks/useScreen';

const DirectoryRowSkeleton: React.FC = () => (
    <tr className="animate-pulse">
        <td className="p-4">
            <div className="flex items-center">
                <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                <div className="ml-3 h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
        </td>
        <td className="p-4"><div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
        <td className="p-4"><div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
        <td className="p-4"><div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded-full"></div></td>
        <td className="p-4"><div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div></td>
    </tr>
);

const MobileCardSkeleton: React.FC = () => (
    <div className="p-4 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse mb-4">
        <div className="flex items-center justify-between mb-4">
             <div className="flex items-center">
                <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                <div className="ml-3 h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
            <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
        </div>
        <div className="space-y-2">
            <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-4 w-2/3 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
    </div>
);

interface UnitFormData {
    block: string;
    floor: string;
    flatNumber: string;
    flatSize: string;
    maintenanceStartDate: string;
}

const Directory: React.FC = () => {
    const [residents, setResidents] = useState<User[]>([]);
    const [community, setCommunity] = useState<Community | null>(null);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { user } = useAuth();
    const { isMobile } = useScreen();
    
    // View Controls
    const [filterRole, setFilterRole] = useState<UserRole | 'All'>('All');
    const [isGrouped, setIsGrouped] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Form State
    const [activeTab, setActiveTab] = useState<'general' | 'units'>('general');
    const [newRole, setNewRole] = useState<UserRole>(UserRole.Resident);
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newStaffLocation, setNewStaffLocation] = useState(''); // For staff "flat number"
    
    // New Unit List State (1:M)
    const [newUnits, setNewUnits] = useState<UnitFormData[]>([{
        block: '',
        floor: '',
        flatNumber: '',
        flatSize: '',
        maintenanceStartDate: new Date().toISOString().split('T')[0]
    }]);
    
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Maintenance History Modal State
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [historyUser, setHistoryUser] = useState<User | null>(null);
    const [maintenanceHistory, setMaintenanceHistory] = useState<MaintenanceRecord[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);

    const fetchResidents = async (communityId: string) => {
        try {
            setLoading(true);
            const data = await getResidents(communityId);
            setResidents(data);
        } catch (error) {
            console.error("Failed to fetch residents", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCommunityDetails = async (communityId: string) => {
        try {
            const data = await getCommunity(communityId);
            setCommunity(data);
        } catch (error) {
            console.error("Failed to fetch community details", error);
        }
    };

    useEffect(() => {
        if (user) {
            if (user.communityId) {
                fetchResidents(user.communityId);
                fetchCommunityDetails(user.communityId);
            } else {
                console.warn("Logged in user has no Community ID");
                setLoading(false);
            }
        }
    }, [user]);

    // Reset form when modal opens/closes
    useEffect(() => {
        if (isModalOpen) {
            // Default role based on who is creating
            if (user?.role === UserRole.HelpdeskAdmin) {
                setNewRole(UserRole.HelpdeskAgent);
            } else if (user?.role === UserRole.SecurityAdmin) {
                setNewRole(UserRole.Security);
            } else {
                setNewRole(UserRole.Resident);
            }
            setNewUnits([{
                block: '',
                floor: '',
                flatNumber: '',
                flatSize: '',
                maintenanceStartDate: new Date().toISOString().split('T')[0]
            }]);
            setActiveTab('general');
        } else {
            setNewName('');
            setNewEmail('');
            setNewPassword('');
            setNewStaffLocation('');
        }
    }, [isModalOpen, user]);

    const isStandaloneType = (type: CommunityType | undefined) => {
        return type === 'Standalone Apartment' || type === 'Standalone';
    }

    const getFloorOptions = (blockName: string) => {
        if (!community) return [];
        let floorCount = 0;

        // Check if Gated/High-Rise (Multiple Blocks) or Standalone
        if (!isStandaloneType(community.communityType) && blockName) {
            const block = community.blocks?.find(b => b.name === blockName);
            floorCount = block?.floorCount || 0;
        } else if (isStandaloneType(community.communityType) && community.blocks && community.blocks.length > 0) {
            floorCount = community.blocks[0].floorCount;
        }
        return Array.from({ length: floorCount }, (_, i) => i + 1);
    };

    // Unit Form Handlers
    const handleUnitChange = (index: number, field: keyof UnitFormData, value: string) => {
        const updatedUnits = [...newUnits];
        updatedUnits[index] = { ...updatedUnits[index], [field]: value };
        setNewUnits(updatedUnits);
    };

    const addUnitField = () => {
        setNewUnits([...newUnits, {
            block: '',
            floor: '',
            flatNumber: '',
            flatSize: '',
            maintenanceStartDate: new Date().toISOString().split('T')[0]
        }]);
    };

    const removeUnitField = (index: number) => {
        if (newUnits.length > 1) {
            setNewUnits(newUnits.filter((_, i) => i !== index));
        }
    };

    // --- Validation Logic ---

    const checkGeneralValidity = () => {
        if (!newName.trim()) return false;
        if (!newEmail.trim() || !newEmail.includes('@')) return false;
        if (!newPassword || newPassword.length < 6) return false;
        return true;
    };

    const checkUnitsValidity = () => {
        if (newRole !== UserRole.Resident) return true;
        
        // Must have at least one unit
        if (newUnits.length === 0) return false;

        // Check each unit
        for (const unit of newUnits) {
            if (!unit.flatNumber.trim()) return false;
            // Block is required if not standalone
            if (!isStandaloneType(community?.communityType) && !unit.block) return false;
            if (!unit.maintenanceStartDate) return false;
        }
        return true;
    };

    const isGeneralValid = checkGeneralValidity();
    const isUnitsValid = checkUnitsValidity();

    const handleAddResident = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!user || !user.communityId) {
            alert("Error: Your account is missing a valid Community ID.");
            return;
        }

        if (!isGeneralValid) {
            alert("Please fill all mandatory General Info fields correctly.");
            return;
        }

        if (newRole === UserRole.Resident && !isUnitsValid) {
            alert("Please ensure at least one Unit is added with all details.");
            return;
        }
        
        setIsSubmitting(true);

        try {
            const communityId = String(user.communityId);

            if (newRole === UserRole.Resident) {
                // Prepare Units Array
                const unitsPayload = newUnits.map(u => ({
                    flat_number: u.flatNumber,
                    block: !isStandaloneType(community?.communityType) ? u.block : undefined,
                    floor: u.floor ? parseInt(u.floor) : undefined,
                    flat_size: u.flatSize ? parseFloat(u.flatSize) : 0,
                    maintenance_start_date: u.maintenanceStartDate
                }));

                await createCommunityUser({
                    name: newName,
                    email: newEmail,
                    password: newPassword,
                    community_id: communityId, 
                    role: newRole,
                    units: unitsPayload
                });
            } else {
                // Create Staff
                await createCommunityUser({
                    name: newName,
                    email: newEmail,
                    password: newPassword,
                    community_id: communityId,
                    role: newRole,
                    flat_number: newStaffLocation.trim() || undefined
                });
            }
            
            setIsModalOpen(false);
            alert(`${newRole} added successfully!`);
            await fetchResidents(communityId);
        } catch (error: any) {
            console.error("Failed to create user:", error);
            alert(error.message || "Failed to create user.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle View History
    const handleViewHistory = async (resident: User) => {
        if (!user?.communityId) return;
        
        setHistoryUser(resident);
        setIsHistoryModalOpen(true);
        setIsHistoryLoading(true);
        setMaintenanceHistory([]);

        try {
            const history = await getMaintenanceRecords(user.communityId, resident.id);
            setMaintenanceHistory(history);
        } catch (error) {
            console.error("Failed to fetch history", error);
            alert("Could not load maintenance history.");
        } finally {
            setIsHistoryLoading(false);
        }
    };

    const closeHistoryModal = () => {
        setIsHistoryModalOpen(false);
        setHistoryUser(null);
        setMaintenanceHistory([]);
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(part => part[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
    };


    // ---------------------------------------------------------
    // ROLE-BASED VISIBILITY LOGIC (STRICT)
    // ---------------------------------------------------------
    const getFilteredResidents = () => {
        if (!user) return [];

        let allowedRoles: UserRole[] = [];

        if (user.role === UserRole.Admin) {
            allowedRoles = [UserRole.Admin, UserRole.Resident, UserRole.HelpdeskAdmin, UserRole.SecurityAdmin];
        } else if (user.role === UserRole.Resident) {
            allowedRoles = [UserRole.Admin, UserRole.Resident];
        } else if (user.role === UserRole.HelpdeskAdmin) {
            allowedRoles = [UserRole.HelpdeskAdmin, UserRole.HelpdeskAgent];
        } else if (user.role === UserRole.SecurityAdmin || user.role === UserRole.Security) {
            allowedRoles = [UserRole.SecurityAdmin, UserRole.Security];
        } else if (user.role === UserRole.HelpdeskAgent) {
            return [];
        }

        let filtered = residents.filter(r => allowedRoles.includes(r.role));

        if (filterRole !== 'All') {
            filtered = filtered.filter(r => r.role === filterRole);
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(r => 
                r.name.toLowerCase().includes(query) ||
                r.email.toLowerCase().includes(query) ||
                (r.units && r.units.some(u => u.flatNumber.toLowerCase().includes(query))) ||
                (!r.units && r.flatNumber && r.flatNumber.toLowerCase().includes(query))
            );
        }

        return filtered;
    };

    const filteredResidents = getFilteredResidents();

    const groupedResidents = filteredResidents.reduce((acc, curr) => {
        const group = curr.role;
        if (!acc[group]) acc[group] = [];
        acc[group].push(curr);
        return acc;
    }, {} as Record<string, User[]>);

    const canViewHistory = user?.role === UserRole.Admin;
    const canViewMaintenanceStart = user?.role === UserRole.Admin;
    const canAddUser = user?.role === UserRole.Admin || user?.role === UserRole.HelpdeskAdmin || user?.role === UserRole.SecurityAdmin;

    if (user?.role === UserRole.HelpdeskAgent) {
        return <div className="p-8 text-center text-red-500">Unauthorized Access</div>;
    }

    if (!user?.communityId && !loading) {
         return (
             <div className="p-8 flex flex-col items-center justify-center text-center">
                 <AlertTriangleIcon className="w-12 h-12 text-red-500 mb-4"/>
                 <h3 className="text-xl font-bold text-[var(--text-light)] dark:text-[var(--text-dark)]">Account Setup Incomplete</h3>
                 <p className="text-[var(--text-secondary-light)] mt-2">
                     Your account is not associated with any community. Please contact the Super Admin.
                 </p>
             </div>
         )
    }

    const renderTable = (users: User[]) => (
        <Card className="overflow-x-auto animated-card">
            <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="bg-black/5 dark:bg-white/5">
                    <tr>
                        <th className="p-4 font-semibold text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Name</th>
                        <th className="p-4 font-semibold text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Details / Units</th>
                        <th className="p-4 font-semibold text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Contact</th>
                        <th className="p-4 font-semibold text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Role</th>
                        <th className="p-4 font-semibold text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Status</th>
                        {canViewHistory && <th className="p-4 font-semibold text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] text-right">Actions</th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-light)] dark:divide-[var(--border-dark)]">
                    {users.length > 0 ? (
                        users.map((resident) => (
                            <tr key={resident.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors align-top">
                                <td className="p-4">
                                    <div className="flex items-center">
                                        <div className="relative flex-shrink-0">
                                            <div className="w-10 h-10 rounded-lg bg-[var(--bg-light)] dark:bg-gray-800 border border-[var(--border-light)] dark:border-[var(--border-dark)] flex items-center justify-center text-sm font-bold text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                                                {getInitials(resident.name)}
                                            </div>
                                            <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[var(--card-bg-light)] dark:border-[var(--card-bg-dark)] ${resident.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                        </div>
                                        <div className="ml-3">
                                            <div className="text-sm font-medium text-[var(--text-light)] dark:text-[var(--text-dark)]">{resident.name}</div>
                                            {resident.units && resident.units.length > 1 && (
                                                <div className="text-xs text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">{resident.units.length} Properties</div>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4">
                                    {(resident.role === UserRole.Resident || resident.role === UserRole.Admin) && resident.units && resident.units.length > 0 ? (
                                        <div className="space-y-2">
                                            {resident.units.map((u) => (
                                                <div key={u.id} className="flex items-center justify-between gap-3 p-1.5 rounded bg-black/5 dark:bg-white/5 border border-transparent hover:border-[var(--border-light)] dark:hover:border-[var(--border-dark)] transition-colors max-w-[280px]">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium text-[var(--text-light)] dark:text-[var(--text-dark)]">
                                                            {u.block ? `${u.block} - ` : ''}{u.flatNumber}
                                                        </span>
                                                        <div className="flex gap-2 text-xs text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                                                            {u.floor && <span>Flr {u.floor}</span>}
                                                            {u.floor && u.flatSize && <span>•</span>}
                                                            {u.flatSize && <span>{u.flatSize} sqft</span>}
                                                        </div>
                                                        {canViewMaintenanceStart && u.maintenanceStartDate && (
                                                             <span className="text-[10px] text-[var(--accent)] mt-0.5">
                                                                Start: {new Date(u.maintenanceStartDate).toLocaleDateString()}
                                                             </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                                            {resident.flatNumber || 'N/A'}
                                            {resident.role !== UserRole.Resident && resident.role !== UserRole.Admin && (
                                                <span className="block text-xs opacity-70">Location</span>
                                            )}
                                        </div>
                                    )}
                                </td>
                                <td className="p-4 text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                                    {resident.email}
                                </td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full 
                                        ${resident.role === UserRole.Admin ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' : 
                                          resident.role === UserRole.Security ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' : 
                                          resident.role === UserRole.SecurityAdmin ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border border-orange-200' :
                                          resident.role === UserRole.HelpdeskAdmin ? 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300' :
                                          resident.role === UserRole.HelpdeskAgent ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300' :
                                          'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'}`}>
                                        {resident.role === UserRole.HelpdeskAdmin ? 'Helpdesk Admin' : resident.role === UserRole.SecurityAdmin ? 'Security Admin' : resident.role}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${resident.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'}`}>
                                        {resident.status}
                                    </span>
                                </td>
                                {canViewHistory && (
                                    <td className="p-4 text-right">
                                        {(resident.role === UserRole.Resident || resident.role === UserRole.Admin) && (
                                            <Button size="sm" variant="outlined" onClick={() => handleViewHistory(resident)} title="View Maintenance History">
                                                <HistoryIcon className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </td>
                                )}
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={canViewHistory ? 6 : 5} className="p-8 text-center text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                                No users found matching your criteria.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </Card>
    );

    const renderMobileCards = (users: User[]) => (
        <div className="space-y-4">
            {users.length > 0 ? (
                users.map(resident => (
                    <div key={resident.id} className="p-4 rounded-xl bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] shadow-sm border border-[var(--border-light)] dark:border-[var(--border-dark)] animated-card">
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-[var(--bg-light)] dark:bg-gray-800 border border-[var(--border-light)] dark:border-[var(--border-dark)] flex items-center justify-center text-sm font-bold text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                                    {getInitials(resident.name)}
                                </div>
                                <div>
                                    <h4 className="font-medium text-[var(--text-light)] dark:text-[var(--text-dark)]">{resident.name}</h4>
                                    <p className="text-xs text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">{resident.email}</p>
                                </div>
                            </div>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full 
                                ${resident.role === UserRole.Admin ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' : 
                                  resident.role === UserRole.Security ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' : 
                                  resident.role === UserRole.SecurityAdmin ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border border-orange-200' :
                                  resident.role === UserRole.HelpdeskAdmin ? 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300' :
                                  resident.role === UserRole.HelpdeskAgent ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300' :
                                  'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'}`}>
                                {resident.role === UserRole.HelpdeskAdmin ? 'Helpdesk Admin' : resident.role === UserRole.SecurityAdmin ? 'Security Admin' : resident.role}
                            </span>
                        </div>

                        <div className="bg-black/5 dark:bg-white/5 rounded-lg p-3 mb-3">
                             {(resident.role === UserRole.Resident || resident.role === UserRole.Admin) && resident.units && resident.units.length > 0 ? (
                                <div className="space-y-2">
                                    {resident.units.map((u) => (
                                        <div key={u.id} className="flex items-center justify-between text-sm">
                                            <span className="font-medium text-[var(--text-light)] dark:text-[var(--text-dark)]">
                                                {u.block ? `${u.block} - ` : ''}{u.flatNumber}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                             ) : (
                                <div className="text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                                    <span className="font-medium">Location:</span> {resident.flatNumber || 'N/A'}
                                </div>
                             )}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-[var(--border-light)] dark:border-[var(--border-dark)]">
                             <span className={`px-2 py-1 text-xs font-medium rounded-full ${resident.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'}`}>
                                {resident.status}
                            </span>
                             {canViewHistory && (resident.role === UserRole.Resident || resident.role === UserRole.Admin) && (
                                <Button size="sm" variant="outlined" onClick={() => handleViewHistory(resident)}>
                                    History
                                </Button>
                            )}
                        </div>
                    </div>
                ))
            ) : (
                <div className="p-8 text-center text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                    No users found.
                </div>
            )}
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center animated-card">
                <h2 className="text-2xl font-bold text-[var(--text-light)] dark:text-[var(--text-dark)]">Directory</h2>
                {canAddUser && (
                    <Button onClick={() => setIsModalOpen(true)} leftIcon={<PlusIcon className="w-5 h-5" />} aria-label="Add New User" variant="fab">
                        <span className="hidden sm:inline">Add User</span>
                        <span className="sm:hidden">Add</span>
                    </Button>
                )}
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] p-4 rounded-xl border border-[var(--border-light)] dark:border-[var(--border-dark)] animated-card">
                <div className="relative flex-1 w-full">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <MagnifyingGlassIcon className="h-5 w-5 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search by name, flat no, or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-lg bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-[var(--text-light)] dark:text-[var(--text-dark)]"
                    />
                </div>
                <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:flex-none">
                         <select 
                            value={filterRole} 
                            onChange={(e) => setFilterRole(e.target.value as UserRole | 'All')}
                            className="appearance-none bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] border border-[var(--border-light)] dark:border-[var(--border-dark)] text-sm rounded-lg block w-full pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-[var(--text-light)] dark:text-[var(--text-dark)]"
                        >
                            <option value="All">All Roles</option>
                            {user?.role === UserRole.HelpdeskAdmin ? (
                                <>
                                    <option value={UserRole.HelpdeskAdmin}>Helpdesk Admin</option>
                                    <option value={UserRole.HelpdeskAgent}>Helpdesk Agent</option>
                                </>
                            ) : user?.role === UserRole.SecurityAdmin || user?.role === UserRole.Security ? (
                                <>
                                    <option value={UserRole.SecurityAdmin}>Security Admin</option>
                                    <option value={UserRole.Security}>Security</option>
                                </>
                            ) : (
                                <>
                                    <option value={UserRole.Resident}>Residents</option>
                                    <option value={UserRole.Admin}>Admins</option>
                                    {user?.role === UserRole.Admin && (
                                        <>
                                            <option value={UserRole.HelpdeskAdmin}>Helpdesk Admin</option>
                                            <option value={UserRole.SecurityAdmin}>Security Admin</option>
                                        </>
                                    )}
                                </>
                            )}
                        </select>
                         <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                            <FunnelIcon className="w-4 h-4" />
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 justify-between sm:justify-start">
                        <label className="text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Group</label>
                         <button 
                            onClick={() => setIsGrouped(!isGrouped)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 ${isGrouped ? 'bg-[var(--accent)]' : 'bg-gray-200 dark:bg-gray-700'}`}
                         >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isGrouped ? 'translate-x-6' : 'translate-x-1'}`} />
                         </button>
                    </div>
                </div>
            </div>

            {loading ? (
                isMobile ? (
                    <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <MobileCardSkeleton key={i} />)}</div>
                ) : (
                    <Card className="overflow-hidden">
                        <table className="w-full">
                            <tbody className="divide-y divide-[var(--border-light)] dark:divide-[var(--border-dark)]">
                                {Array.from({ length: 5 }).map((_, i) => <DirectoryRowSkeleton key={i} />)}
                            </tbody>
                        </table>
                    </Card>
                )
            ) : isGrouped ? (
                 Object.entries(groupedResidents).map(([role, users]) => (
                     <div key={role} className="space-y-2 animated-card">
                         <h3 className="text-lg font-bold text-[var(--text-light)] dark:text-[var(--text-dark)] px-2 capitalize">
                            {role === UserRole.HelpdeskAdmin ? 'Helpdesk Admin' : role === UserRole.SecurityAdmin ? 'Security Admin' : role}s ({(users as User[]).length})
                         </h3>
                         {isMobile ? renderMobileCards(users as User[]) : renderTable(users as User[])}
                     </div>
                 ))
            ) : (
                <>
                   <div className="text-right text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-2">
                       Showing {filteredResidents.length} users
                   </div>
                   {isMobile ? renderMobileCards(filteredResidents) : renderTable(filteredResidents)}
                </>
            )}

            <Modal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                title="Add New User"
                footer={(
                    <div className="flex justify-between w-full">
                        <Button type="button" variant="outlined" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <div className="flex gap-2">
                            {/* Logic for Resident Wizard Buttons */}
                            {newRole === UserRole.Resident && activeTab === 'general' && (
                                <Button 
                                    type="button" 
                                    onClick={() => setActiveTab('units')} 
                                    disabled={!isGeneralValid}
                                >
                                    Next
                                </Button>
                            )}
                            
                            {newRole === UserRole.Resident && activeTab === 'units' && (
                                <>
                                    <Button 
                                        type="button" 
                                        variant="outlined"
                                        onClick={() => setActiveTab('general')} 
                                        disabled={isSubmitting}
                                    >
                                        Back
                                    </Button>
                                    <Button 
                                        type="submit" 
                                        form="add-user-form" 
                                        disabled={isSubmitting || !isUnitsValid}
                                    >
                                        {isSubmitting ? 'Adding...' : 'Add User'}
                                    </Button>
                                </>
                            )}

                            {/* Logic for Non-Resident (Direct Submit) */}
                            {newRole !== UserRole.Resident && (
                                <Button 
                                    type="submit" 
                                    form="add-user-form" 
                                    disabled={isSubmitting || !isGeneralValid}
                                >
                                    {isSubmitting ? 'Adding...' : 'Add User'}
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            >
                <form id="add-user-form" className="space-y-4" onSubmit={handleAddResident}>
                    
                    {/* Role Selection */}
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Role <span className="text-red-500">*</span></label>
                        <select 
                            value={newRole} 
                            onChange={e => setNewRole(e.target.value as UserRole)}
                            className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-[var(--bg-light)] dark:bg-[var(--bg-dark)]"
                        >
                            {user?.role === UserRole.HelpdeskAdmin ? (
                                 <option value={UserRole.HelpdeskAgent}>Helpdesk Agent</option>
                            ) : user?.role === UserRole.SecurityAdmin ? (
                                 <option value={UserRole.Security}>Security</option>
                            ) : (
                                <>
                                    <option value={UserRole.Resident}>Resident</option>
                                    <option value={UserRole.SecurityAdmin}>Security Admin</option>
                                    <option value={UserRole.HelpdeskAdmin}>Helpdesk Admin</option>
                                </>
                            )}
                        </select>
                    </div>

                    {/* Tabs for Resident Creation */}
                    {newRole === UserRole.Resident && (
                         <div className="border-b border-[var(--border-light)] dark:border-[var(--border-dark)] mb-4">
                            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('general')}
                                    className={`${activeTab === 'general' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] hover:text-[var(--text-light)] dark:hover:text-[var(--text-dark)] hover:border-gray-300'} whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
                                >
                                    1. General Info
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if(isGeneralValid) setActiveTab('units');
                                    }}
                                    disabled={!isGeneralValid}
                                    className={`${activeTab === 'units' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]'} ${!isGeneralValid ? 'opacity-50 cursor-not-allowed' : 'hover:text-[var(--text-light)] hover:border-gray-300'} whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
                                >
                                    2. Units & Maintenance
                                </button>
                            </nav>
                        </div>
                    )}

                    {/* General Tab Content (or Staff View) */}
                    {(activeTab === 'general' || newRole !== UserRole.Resident) && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Name <span className="text-red-500">*</span></label>
                                <input type="text" value={newName} onChange={e => setNewName(e.target.value)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Email <span className="text-red-500">*</span></label>
                                <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Password <span className="text-red-500">*</span></label>
                                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"/>
                            </div>

                            {/* Staff Location Field */}
                            {newRole !== UserRole.Resident && (
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Location / Desk Info</label>
                                    <input 
                                        type="text" 
                                        value={newStaffLocation} 
                                        onChange={e => setNewStaffLocation(e.target.value)} 
                                        placeholder="e.g. Main Gate, Office A"
                                        className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Units Tab Content (Resident Only) */}
                    {activeTab === 'units' && newRole === UserRole.Resident && (
                        <div className="space-y-6">
                            {newUnits.map((unit, index) => (
                                <div key={index} className="bg-black/5 dark:bg-white/5 p-4 rounded-lg relative border border-[var(--border-light)] dark:border-[var(--border-dark)]">
                                    <h4 className="text-sm font-bold mb-3 text-[var(--text-light)] dark:text-[var(--text-dark)]">Unit {index + 1}</h4>
                                    {newUnits.length > 1 && (
                                        <button 
                                            type="button" 
                                            onClick={() => removeUnitField(index)}
                                            className="absolute top-3 right-3 text-red-500 hover:text-red-700"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                        {!isStandaloneType(community?.communityType) && (
                                            <div>
                                                <label className="block text-xs font-medium mb-1 text-[var(--text-secondary-light)]">Block <span className="text-red-500">*</span></label>
                                                <select 
                                                    value={unit.block} 
                                                    onChange={e => handleUnitChange(index, 'block', e.target.value)}
                                                    className="block w-full px-2 py-1.5 text-sm border rounded bg-[var(--bg-light)] dark:bg-[var(--bg-dark)]"
                                                    required
                                                >
                                                    <option value="">Select Block</option>
                                                    {community?.blocks?.map((b, i) => <option key={i} value={b.name}>{b.name}</option>)}
                                                </select>
                                            </div>
                                        )}
                                        
                                        <div>
                                            <label className="block text-xs font-medium mb-1 text-[var(--text-secondary-light)]">Floor</label>
                                            <select 
                                                value={unit.floor} 
                                                onChange={e => handleUnitChange(index, 'floor', e.target.value)}
                                                className="block w-full px-2 py-1.5 text-sm border rounded bg-[var(--bg-light)] dark:bg-[var(--bg-dark)]"
                                                required
                                            >
                                                <option value="">Select Floor</option>
                                                {getFloorOptions(unit.block).map(f => <option key={f} value={f}>{f}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <label className="block text-xs font-medium mb-1 text-[var(--text-secondary-light)]">Flat No. <span className="text-red-500">*</span></label>
                                            <input 
                                                type="text" 
                                                value={unit.flatNumber} 
                                                onChange={e => handleUnitChange(index, 'flatNumber', e.target.value)}
                                                className="block w-full px-2 py-1.5 text-sm border rounded bg-transparent"
                                                required
                                            />
                                        </div>
                                         <div>
                                            <label className="block text-xs font-medium mb-1 text-[var(--text-secondary-light)]">
                                                Flat Size (SqFt) {!isStandaloneType(community?.communityType) && <span className="text-red-500">*</span>}
                                            </label>
                                            <input 
                                                type="number" 
                                                value={unit.flatSize} 
                                                onChange={e => handleUnitChange(index, 'flatSize', e.target.value)}
                                                className="block w-full px-2 py-1.5 text-sm border rounded bg-transparent"
                                                required={!isStandaloneType(community?.communityType)}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium mb-1 text-[var(--text-secondary-light)]">Maintenance Start Date <span className="text-red-500">*</span></label>
                                        <input 
                                            type="date" 
                                            value={unit.maintenanceStartDate} 
                                            onChange={e => handleUnitChange(index, 'maintenanceStartDate', e.target.value)}
                                            className="block w-full px-2 py-1.5 text-sm border rounded bg-transparent"
                                            required
                                        />
                                    </div>
                                </div>
                            ))}
                            
                            <button 
                                type="button" 
                                onClick={addUnitField} 
                                className="w-full py-2 border-2 border-dashed border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-lg text-sm text-[var(--text-secondary-light)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors flex items-center justify-center gap-2"
                            >
                                <PlusIcon className="w-4 h-4" /> Add Another Unit
                            </button>
                        </div>
                    )}
                </form>
            </Modal>

            {/* Maintenance History Modal */}
            <Modal isOpen={isHistoryModalOpen} onClose={closeHistoryModal} title={`History: ${historyUser?.name}`}>
                 {isHistoryLoading ? (
                     <div className="space-y-3">
                         <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse"></div>
                         <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse"></div>
                         <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse"></div>
                     </div>
                 ) : maintenanceHistory.length === 0 ? (
                     <p className="text-center text-[var(--text-secondary-light)] py-4">No maintenance history found.</p>
                 ) : (
                     <div className="overflow-x-auto">
                         <table className="w-full text-left text-sm">
                             <thead className="bg-black/5 dark:bg-white/5">
                                 <tr>
                                     <th className="p-2">Month</th>
                                     <th className="p-2">Unit</th>
                                     <th className="p-2">Amount</th>
                                     <th className="p-2">Status</th>
                                     <th className="p-2">Date</th>
                                 </tr>
                             </thead>
                             <tbody>
                                 {maintenanceHistory.map(record => (
                                     <tr key={record.id} className="border-b border-[var(--border-light)] dark:border-[var(--border-dark)]">
                                         <td className="p-2">{new Date(record.periodDate).toLocaleDateString(undefined, { month: 'short', year: '2-digit'})}</td>
                                         <td className="p-2">{record.flatNumber}</td>
                                         <td className="p-2">₹{record.amount}</td>
                                         <td className="p-2">
                                             <span className={`px-2 py-0.5 text-xs rounded-full ${record.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                 {record.status}
                                             </span>
                                         </td>
                                         <td className="p-2 text-xs">{record.transactionDate ? new Date(record.transactionDate).toLocaleDateString() : '-'}</td>
                                     </tr>
                                 ))}
                             </tbody>
                         </table>
                     </div>
                 )}
            </Modal>
        </div>
    );
};

export default Directory;
