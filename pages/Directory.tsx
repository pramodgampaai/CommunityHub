
import React, { useState, useEffect } from 'react';
import { getResidents, createCommunityUser, getCommunity, getMaintenanceRecords, updateMaintenanceStartDate } from '../services/api';
import type { User, Community, Block, MaintenanceRecord, Unit } from '../types';
import { UserRole, MaintenanceStatus } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { PlusIcon, FunnelIcon, MagnifyingGlassIcon, ClockIcon, PencilIcon, TrashIcon, AlertTriangleIcon } from '../components/icons';
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

    // Edit User Maintenance State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
    const [editMaintenanceDate, setEditMaintenanceDate] = useState('');


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
                // If user has no community ID, we stop loading but list remains empty
                console.warn("Logged in user has no Community ID");
                setLoading(false);
            }
        }
    }, [user]);

    // Reset form when modal opens/closes
    useEffect(() => {
        if (isModalOpen) {
            // Default role based on who is creating
            if (user?.role === UserRole.Helpdesk) {
                setNewRole(UserRole.HelpdeskAgent);
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

    const getFloorOptions = (blockName: string) => {
        if (!community) return [];
        let floorCount = 0;

        if (community.communityType === 'Gated' && blockName) {
            const block = community.blocks?.find(b => b.name === blockName);
            floorCount = block?.floorCount || 0;
        } else if (community.communityType === 'Standalone' && community.blocks && community.blocks.length > 0) {
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

    const handleAddResident = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !user.communityId) return;
        
        setIsSubmitting(true);

        try {
            if (newRole === UserRole.Resident) {
                // Prepare Units Array
                const unitsPayload = newUnits.map(u => ({
                    flat_number: u.flatNumber,
                    block: community?.communityType === 'Gated' ? u.block : undefined,
                    floor: u.floor ? parseInt(u.floor) : undefined,
                    flat_size: u.flatSize ? parseFloat(u.flatSize) : 0,
                    maintenance_start_date: u.maintenanceStartDate
                }));

                await createCommunityUser({
                    name: newName,
                    email: newEmail,
                    password: newPassword,
                    community_id: user.communityId,
                    role: newRole,
                    units: unitsPayload
                });
            } else {
                // Create Staff
                await createCommunityUser({
                    name: newName,
                    email: newEmail,
                    password: newPassword,
                    community_id: user.communityId,
                    role: newRole,
                    flat_number: newStaffLocation // Simple string for location
                });
            }
            
            setIsModalOpen(false);
            alert(`${newRole} added successfully!`);
            await fetchResidents(user.communityId);
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

    // Handle Edit Maintenance Date
    const handleEditClick = (resident: User, unit: Unit) => {
        setEditingUser(resident);
        setEditingUnit(unit);
        setEditMaintenanceDate(unit.maintenanceStartDate || '');
        setIsEditModalOpen(true);
    };

    const handleUpdateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser || !editingUnit) return;

        setIsSubmitting(true);
        try {
            // Call API with Unit ID
            await updateMaintenanceStartDate(editingUser.id, editMaintenanceDate, editingUnit.id);
            setIsEditModalOpen(false);
            alert("Maintenance start date updated successfully!");
            if (user?.communityId) await fetchResidents(user.communityId);
        } catch (error: any) {
            console.error("Update failed", error);
            alert("Failed to update: " + (error.message || "Unknown error"));
        } finally {
            setIsSubmitting(false);
        }
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

        // 1. Determine allowed roles based on current user's role
        let allowedRoles: UserRole[] = [];

        if (user.role === UserRole.Admin) {
            // Admin sees: Admin, Resident, Helpdesk (Helpdesk Admin), Security
            allowedRoles = [UserRole.Admin, UserRole.Resident, UserRole.Helpdesk, UserRole.Security];
        } else if (user.role === UserRole.Resident) {
            // Resident sees: Admin, Resident
            allowedRoles = [UserRole.Admin, UserRole.Resident];
        } else if (user.role === UserRole.Helpdesk) {
            // Helpdesk Admin sees: Helpdesk, HelpdeskAgent
            allowedRoles = [UserRole.Helpdesk, UserRole.HelpdeskAgent];
        } else if (user.role === UserRole.HelpdeskAgent) {
            // Helpdesk Agent should not see anything
            return [];
        }

        // 2. First pass filter: Remove unauthorized roles
        let filtered = residents.filter(r => allowedRoles.includes(r.role));

        // 3. Second pass filter: Dropdown Role Selection (UI Filter)
        if (filterRole !== 'All') {
            filtered = filtered.filter(r => r.role === filterRole);
        }

        // 4. Third pass filter: Search Query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(r => 
                r.name.toLowerCase().includes(query) ||
                r.email.toLowerCase().includes(query) ||
                (r.units && r.units.some(u => u.flatNumber.toLowerCase().includes(query))) ||
                (!r.units && r.flatNumber && r.flatNumber.toLowerCase().includes(query)) // Legacy/Staff
            );
        }

        return filtered;
    };

    const filteredResidents = getFilteredResidents();

    // Grouping logic
    const groupedResidents = filteredResidents.reduce((acc, curr) => {
        const group = curr.role;
        if (!acc[group]) acc[group] = [];
        acc[group].push(curr);
        return acc;
    }, {} as Record<string, User[]>);

    // Permission Checks for Actions
    const canViewHistory = user?.role === UserRole.Admin; // Only Admins can view maintenance history
    const canViewMaintenanceStart = user?.role === UserRole.Admin;
    const canAddUser = user?.role === UserRole.Admin || user?.role === UserRole.Helpdesk;

    // If Helpdesk Agent tries to view, render nothing (Access Control)
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
                                            {/* Modern Initials Avatar */}
                                            <div className="w-10 h-10 rounded-lg bg-[var(--bg-light)] dark:bg-gray-800 border border-[var(--border-light)] dark:border-[var(--border-dark)] flex items-center justify-center text-sm font-bold text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                                                {getInitials(resident.name)}
                                            </div>
                                            <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[var(--card-bg-light)] dark:border-[var(--card-bg-dark)] ${resident.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                        </div>
                                        <div className="ml-3">
                                            <div className="text-sm font-medium text-[var(--text-light)] dark:text-[var(--text-dark)]">{resident.name}</div>
                                            {/* Display Unit Count if multiple */}
                                            {resident.units && resident.units.length > 1 && (
                                                <div className="text-xs text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">{resident.units.length} Properties</div>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4">
                                    {/* MULTI-UNIT DISPLAY LOGIC */}
                                    {resident.role === UserRole.Resident && resident.units && resident.units.length > 0 ? (
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
                                                    
                                                    {/* Unit Specific Action (Edit Date) */}
                                                    {canViewMaintenanceStart && (
                                                        <button 
                                                            onClick={() => handleEditClick(resident, u)}
                                                            className="p-1 text-[var(--text-secondary-light)] hover:text-[var(--accent)] rounded transition-colors"
                                                            title="Edit Maintenance Start Date"
                                                        >
                                                            <PencilIcon className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        // STAFF or LEGACY View
                                        <div className="text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                                            {resident.flatNumber || 'N/A'}
                                            {resident.role !== UserRole.Resident && (
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
                                          resident.role === UserRole.Helpdesk ? 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300' :
                                          resident.role === UserRole.HelpdeskAgent ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300' :
                                          'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'}`}>
                                        {resident.role}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${resident.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'}`}>
                                        {resident.status}
                                    </span>
                                </td>
                                {canViewHistory && (
                                    <td className="p-4 text-right">
                                        {resident.role === UserRole.Resident && (
                                            <Button size="sm" variant="outlined" onClick={() => handleViewHistory(resident)} title="View Maintenance History">
                                                <ClockIcon className="w-4 h-4" />
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
                        {/* Header: Avatar + Name + Role */}
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
                                  resident.role === UserRole.Helpdesk ? 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300' :
                                  resident.role === UserRole.HelpdeskAgent ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300' :
                                  'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'}`}>
                                {resident.role}
                            </span>
                        </div>

                        {/* Units / Location Info */}
                        <div className="bg-black/5 dark:bg-white/5 rounded-lg p-3 mb-3">
                             {resident.role === UserRole.Resident && resident.units && resident.units.length > 0 ? (
                                <div className="space-y-2">
                                    {resident.units.map((u) => (
                                        <div key={u.id} className="flex items-center justify-between text-sm">
                                            <span className="font-medium text-[var(--text-light)] dark:text-[var(--text-dark)]">
                                                {u.block ? `${u.block} - ` : ''}{u.flatNumber}
                                            </span>
                                            {canViewMaintenanceStart && (
                                                <button 
                                                    onClick={() => handleEditClick(resident, u)}
                                                    className="text-[var(--accent)] text-xs"
                                                >
                                                    Edit Date
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                             ) : (
                                <div className="text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                                    <span className="font-medium">Location:</span> {resident.flatNumber || 'N/A'}
                                </div>
                             )}
                        </div>

                        {/* Footer: Status + Actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-[var(--border-light)] dark:border-[var(--border-dark)]">
                             <span className={`px-2 py-1 text-xs font-medium rounded-full ${resident.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'}`}>
                                {resident.status}
                            </span>
                             {canViewHistory && resident.role === UserRole.Resident && (
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
                            {/* Dynamic Dropdown options based on strict visibility rules */}
                            <option value="All">All Roles</option>
                            {user?.role === UserRole.Helpdesk ? (
                                <>
                                    <option value={UserRole.Helpdesk}>Helpdesk</option>
                                    <option value={UserRole.HelpdeskAgent}>Helpdesk Agent</option>
                                </>
                            ) : (
                                <>
                                    <option value={UserRole.Resident}>Residents</option>
                                    <option value={UserRole.Admin}>Admins</option>
                                    {user?.role === UserRole.Admin && (
                                        <>
                                            <option value={UserRole.Security}>Security</option>
                                            <option value={UserRole.Helpdesk}>Helpdesk</option>
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
                         <h3 className="text-lg font-bold text-[var(--text-light)] dark:text-[var(--text-dark)] px-2 capitalize">{role}s ({(users as User[]).length})</h3>
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

            {/* Add User Modal */}
            <Modal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                title="Add New User"
                footer={(
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outlined" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
                        <Button type="submit" form="add-user-form" disabled={isSubmitting}>{isSubmitting ? 'Adding...' : 'Add User'}</Button>
                    </div>
                )}
            >
                <form id="add-user-form" className="space-y-4" onSubmit={handleAddResident}>
                    
                    {/* Role Selection - Strictly limited by who is adding */}
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Role</label>
                        <select 
                            value={newRole} 
                            onChange={e => setNewRole(e.target.value as UserRole)}
                            className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-[var(--bg-light)] dark:bg-[var(--bg-dark)]"
                        >
                            {user?.role === UserRole.Helpdesk ? (
                                 <option value={UserRole.HelpdeskAgent}>Helpdesk Agent</option>
                            ) : (
                                <>
                                    <option value={UserRole.Resident}>Resident</option>
                                    <option value={UserRole.Security}>Security</option>
                                    <option value={UserRole.Admin}>Admin</option>
                                    <option value={UserRole.Helpdesk}>Helpdesk</option>
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
                                    General Info
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('units')}
                                    className={`${activeTab === 'units' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] hover:text-[var(--text-light)] dark:hover:text-[var(--text-dark)] hover:border-gray-300'} whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
                                >
                                    Units & Maintenance
                                </button>
                            </nav>
                        </div>
                    )}

                    {/* General Tab Content (or Staff View) */}
                    {(activeTab === 'general' || newRole !== UserRole.Resident) && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Name</label>
                                <input type="text" value={newName} onChange={e => setNewName(e.target.value)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Email</label>
                                <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Password</label>
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
                                    
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        {community?.communityType === 'Gated' && (
                                            <div>
                                                <label className="block text-xs font-medium mb-1 text-[var(--text-secondary-light)]">Block</label>
                                                <select 
                                                    value={unit.block} 
                                                    onChange={e => handleUnitChange(index, 'block', e.target.value)}
                                                    className="block w-full px-2 py-1.5 text-sm border rounded bg-[var(--bg-light)] dark:bg-[var(--bg-dark)]"
                                                    required
                                                >
                                                    <option value="">Select Block</option>
                                                    {community.blocks?.map((b, i) => <option key={i} value={b.name}>{b.name}</option>)}
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

                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <label className="block text-xs font-medium mb-1 text-[var(--text-secondary-light)]">Flat No.</label>
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
                                                Flat Size (SqFt) {community?.communityType === 'Gated' && <span className="text-red-500">*</span>}
                                            </label>
                                            <input 
                                                type="number" 
                                                value={unit.flatSize} 
                                                onChange={e => handleUnitChange(index, 'flatSize', e.target.value)}
                                                className="block w-full px-2 py-1.5 text-sm border rounded bg-transparent"
                                                required={community?.communityType === 'Gated'}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium mb-1 text-[var(--text-secondary-light)]">Maintenance Start Date</label>
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

            {/* Edit Maintenance Date Modal */}
            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Update Maintenance Start">
                <form onSubmit={handleUpdateSubmit} className="space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md mb-4">
                        <p className="text-sm font-medium text-[var(--text-light)] dark:text-[var(--text-dark)]">
                            Resident: {editingUser?.name}
                        </p>
                        <p className="text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                            Unit: {editingUnit?.block ? `${editingUnit?.block}-` : ''}{editingUnit?.flatNumber}
                        </p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Start Date</label>
                        <input 
                            type="date" 
                            value={editMaintenanceDate} 
                            onChange={e => setEditMaintenanceDate(e.target.value)} 
                            required 
                            className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"
                        />
                        <p className="text-xs text-[var(--text-secondary-light)] mt-2">
                            Changing this will recalculate the pro-rata maintenance for the starting month.
                        </p>
                    </div>
                    <div className="flex justify-end pt-4 space-x-2">
                        <Button type="button" variant="outlined" onClick={() => setIsEditModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Updating...' : 'Update'}</Button>
                    </div>
                </form>
            </Modal>

        </div>
    );
};

export default Directory;
