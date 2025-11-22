
import React, { useState, useEffect } from 'react';
import { getResidents, createCommunityUser, getCommunity, getMaintenanceRecords, updateMaintenanceStartDate } from '../services/api';
import type { User, Community, Block, MaintenanceRecord, Unit } from '../types';
import { UserRole, MaintenanceStatus } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { PlusIcon, FunnelIcon, MagnifyingGlassIcon, ClockIcon, PencilIcon, TrashIcon } from '../components/icons';
import { useAuth } from '../hooks/useAuth';

const DirectoryRowSkeleton: React.FC = () => (
    <tr className="animate-pulse">
        <td className="p-4">
            <div className="flex items-center">
                <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                <div className="ml-3 h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
        </td>
        <td className="p-4"><div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
        <td className="p-4"><div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
        <td className="p-4"><div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded-full"></div></td>
        <td className="p-4"><div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div></td>
    </tr>
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
        if (user?.communityId) {
            fetchResidents(user.communityId);
            fetchCommunityDetails(user.communityId);
        }
    }, [user]);

    // Reset form when modal opens/closes
    useEffect(() => {
        if (isModalOpen) {
            // Default role
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


    // Filtering logic
    const getFilteredResidents = () => {
        let filtered = residents;

        // Strict View Filtering for Helpdesk Admins
        if (user?.role === UserRole.Helpdesk) {
             filtered = filtered.filter(r => r.role === UserRole.Helpdesk || r.role === UserRole.HelpdeskAgent);
        }

        // Role Filter (Dropdown)
        if (filterRole !== 'All') {
            filtered = filtered.filter(r => r.role === filterRole);
        }

        // Search Filter
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

    // Permission Checks
    const canViewHistory = user?.role === UserRole.Admin || user?.role === UserRole.Helpdesk;
    const canViewMaintenanceStart = user?.role === UserRole.Admin;

    const renderTable = (users: User[]) => (
        <Card className="overflow-x-auto animated-card">
            <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="bg-black/5 dark:bg-white/5">
                    <tr>
                        <th className="p-4 font-semibold text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Name</th>
                        <th className="p-4 font-semibold text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Units Owned</th>
                        <th className="p-4 font-semibold text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Contact</th>
                        <th className="p-4 font-semibold text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Role</th>
                        <th className="p-4 font-semibold text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Status</th>
                        {canViewHistory && <th className="p-4 font-semibold text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] text-right">Actions</th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-light)] dark:divide-[var(--border-dark)]">
                    {users.map((resident) => (
                        <tr key={resident.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors align-top">
                            <td className="p-4">
                                <div className="flex items-center">
                                    <div className="relative flex-shrink-0">
                                        <img className="w-10 h-10 rounded-full object-cover ring-2 ring-[var(--border-light)] dark:ring-[var(--border-dark)]" src={resident.avatarUrl} alt={resident.name} />
                                        <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[var(--card-bg-light)] dark:border-[var(--card-bg-dark)] ${resident.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                                    </div>
                                    <div className="ml-3">
                                        <div className="font-medium text-[var(--text-light)] dark:text-[var(--text-dark)]">{resident.name}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="p-4">
                                {resident.role === UserRole.Resident && resident.units && resident.units.length > 0 ? (
                                    <div className="space-y-2">
                                        {resident.units.map(unit => (
                                            <div key={unit.id} className="flex items-center justify-between text-sm p-1.5 bg-black/5 dark:bg-white/5 rounded">
                                                <div>
                                                    <span className="font-semibold">{unit.block ? `${unit.block}-` : ''}{unit.flatNumber}</span>
                                                    <span className="text-xs text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] ml-2">
                                                        {unit.flatSize} sqft
                                                    </span>
                                                </div>
                                                {canViewMaintenanceStart && (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                                                            Start: {unit.maintenanceStartDate ? new Date(unit.maintenanceStartDate).toLocaleDateString() : '-'}
                                                        </span>
                                                        <button 
                                                            onClick={() => handleEditClick(resident, unit)}
                                                            className="text-[var(--accent)] hover:text-blue-700"
                                                            title="Edit Start Date"
                                                        >
                                                            <PencilIcon className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                                        {resident.flatNumber || '-'}
                                    </div>
                                )}
                            </td>
                            <td className="p-4 text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                                {resident.email}
                            </td>
                            <td className="p-4">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                    ${resident.role === UserRole.Admin ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' : 
                                      resident.role === UserRole.Helpdesk ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' :
                                      resident.role === UserRole.HelpdeskAgent ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300' :
                                      resident.role === UserRole.Security ? 'bg-gray-100 text-gray-800 dark:bg-gray-700/40 dark:text-gray-300' :
                                      'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'}`}>
                                    {resident.role}
                                </span>
                            </td>
                            <td className="p-4">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                    ${resident.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'}`}>
                                    {resident.status}
                                </span>
                            </td>
                             {canViewHistory && (
                                <td className="p-4 text-right space-x-2">
                                    {resident.role === UserRole.Resident && (
                                        <button 
                                            onClick={() => handleViewHistory(resident)}
                                            className="text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] hover:text-[var(--accent)] p-1 rounded transition-colors"
                                            title="View Maintenance History"
                                        >
                                            <ClockIcon className="w-5 h-5" />
                                        </button>
                                    )}
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </Card>
    );

    // Permission check for creating users
    const canCreateUser = user?.role === UserRole.Admin || user?.role === UserRole.Helpdesk;

    const isHelpdeskAdmin = user?.role === UserRole.Helpdesk;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 animated-card">
                <h2 className="text-3xl sm:text-4xl font-bold text-[var(--text-light)] dark:text-[var(--text-dark)]">
                    {isHelpdeskAdmin ? 'Helpdesk Staff' : 'Directory'}
                </h2>
                {canCreateUser && (
                    <Button onClick={() => setIsModalOpen(true)} leftIcon={<PlusIcon className="w-5 h-5" />} aria-label="Add User" variant="fab">
                        <span className="hidden sm:inline">{isHelpdeskAdmin ? 'Add Agent' : 'Add User'}</span>
                        <span className="sm:hidden">Add</span>
                    </Button>
                )}
            </div>

            {/* View Controls Toolbar */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] p-4 rounded-xl border border-[var(--border-light)] dark:border-[var(--border-dark)] shadow-sm animated-card" style={{ animationDelay: '100ms' }}>
                <div className="flex flex-col sm:flex-row items-center gap-4 flex-1 w-full">
                    <div className="relative w-full sm:max-w-md">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <MagnifyingGlassIcon className="h-5 w-5 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search by name, email, flat..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-lg leading-5 bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] text-[var(--text-light)] dark:text-[var(--text-dark)] placeholder-[var(--text-secondary-light)] dark:placeholder-[var(--text-secondary-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] sm:text-sm transition-shadow"
                        />
                    </div>
                    {/* Filters ... */}
                    <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
                         <div className="flex items-center gap-2">
                            <div className="relative">
                                <select 
                                    value={filterRole} 
                                    onChange={(e) => setFilterRole(e.target.value as any)}
                                    className="appearance-none bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] border border-[var(--border-light)] dark:border-[var(--border-dark)] text-[var(--text-light)] dark:text-[var(--text-dark)] text-sm rounded-lg block pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-shadow cursor-pointer"
                                >
                                    <option value="All">All Roles</option>
                                    {!isHelpdeskAdmin && <option value={UserRole.Resident}>Residents</option>}
                                    {!isHelpdeskAdmin && <option value={UserRole.Admin}>Admins</option>}
                                    {!isHelpdeskAdmin && <option value={UserRole.Security}>Security</option>}
                                    <option value={UserRole.Helpdesk}>Helpdesk Admin</option>
                                    <option value={UserRole.HelpdeskAgent}>Helpdesk Agent</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                                    <FunnelIcon className="w-4 h-4" />
                                </div>
                            </div>
                        </div>
                         {/* Group Toggle */}
                         <label className="flex items-center gap-2 cursor-pointer group" title="Group by Role">
                            <span className="text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] group-hover:text-[var(--text-light)] dark:group-hover:text-[var(--text-dark)] transition-colors font-medium">Group</span>
                            <div className="relative flex items-center">
                                <input type="checkbox" checked={isGrouped} onChange={(e) => setIsGrouped(e.target.checked)} className="sr-only peer" />
                                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--accent)] rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--accent)]"></div>
                            </div>
                        </label>
                    </div>
                </div>
            </div>

            {loading ? (
                 <Card className="overflow-x-auto">
                    <table className="w-full text-left">
                        {/* Header */}
                         <thead className="bg-black/5 dark:bg-white/5">
                            <tr>
                                <th className="p-4">Name</th><th className="p-4">Units</th><th className="p-4">Contact</th><th className="p-4">Role</th><th className="p-4">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-light)] dark:divide-[var(--border-dark)]">
                            {Array.from({ length: 5 }).map((_, i) => <DirectoryRowSkeleton key={i} />)}
                        </tbody>
                    </table>
                </Card>
            ) : (
                isGrouped ? (
                     <div className="space-y-8">
                        {Object.keys(groupedResidents).map(role => (
                            <div key={role}>
                                <h3 className="text-lg font-semibold mb-4">{role}s</h3>
                                {renderTable(groupedResidents[role])}
                            </div>
                        ))}
                    </div>
                ) : renderTable(filteredResidents)
            )}

            {/* Add User Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New User">
                <form className="space-y-4" onSubmit={handleAddResident}>
                    
                    {/* Tab Navigation */}
                    <div className="flex border-b border-[var(--border-light)] dark:border-[var(--border-dark)] mb-4">
                        <button type="button"
                            className={`px-4 py-2 font-medium text-sm focus:outline-none border-b-2 ${activeTab === 'general' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-secondary-light)] hover:text-[var(--text-light)]'}`}
                            onClick={() => setActiveTab('general')}
                        >
                            General
                        </button>
                        {newRole === UserRole.Resident && (
                            <button type="button"
                                className={`px-4 py-2 font-medium text-sm focus:outline-none border-b-2 ${activeTab === 'units' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-secondary-light)] hover:text-[var(--text-light)]'}`}
                                onClick={() => setActiveTab('units')}
                            >
                                Units
                            </button>
                        )}
                    </div>

                    {/* General Information Tab */}
                    {activeTab === 'general' && (
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="role" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Role</label>
                                <select 
                                    id="role" 
                                    value={newRole} 
                                    onChange={e => {
                                        const r = e.target.value as UserRole;
                                        setNewRole(r);
                                        // If switching away from resident, force tab to general
                                        if (r !== UserRole.Resident) setActiveTab('general');
                                    }} 
                                    required 
                                    disabled={user?.role === UserRole.Helpdesk} 
                                    className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] disabled:opacity-70"
                                >
                                    {user?.role === UserRole.Admin && (
                                        <>
                                            <option value={UserRole.Resident}>Resident</option>
                                            <option value={UserRole.Security}>Security</option>
                                            <option value={UserRole.Helpdesk}>Helpdesk Admin</option>
                                        </>
                                    )}
                                    {user?.role === UserRole.Helpdesk && (
                                        <option value={UserRole.HelpdeskAgent}>Helpdesk Agent</option>
                                    )}
                                </select>
                            </div>

                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Full Name</label>
                                <input type="text" id="name" value={newName} onChange={e => setNewName(e.target.value)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"/>
                            </div>

                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Email Address</label>
                                <input type="email" id="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"/>
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Password</label>
                                <input type="password" id="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"/>
                            </div>

                            {/* For Staff Roles */}
                            {newRole !== UserRole.Resident && (
                                <div>
                                    <label htmlFor="location" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Location / Desk ID</label>
                                    <input type="text" id="location" value={newStaffLocation} onChange={e => setNewStaffLocation(e.target.value)} placeholder="e.g. Main Gate" required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"/>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* Units Tab */}
                    {activeTab === 'units' && newRole === UserRole.Resident && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="text-sm font-semibold text-[var(--text-light)] dark:text-[var(--text-dark)]">Units Owned</h4>
                                <button type="button" onClick={addUnitField} className="text-xs text-[var(--accent)] flex items-center gap-1 hover:underline">
                                    <PlusIcon className="w-3 h-3" /> Add Unit
                                </button>
                            </div>
                            
                            <div className="max-h-[400px] overflow-y-auto pr-1 space-y-4">
                                {newUnits.map((unit, index) => (
                                    <div key={index} className="bg-black/5 dark:bg-white/5 p-4 rounded-lg space-y-3 relative border border-[var(--border-light)] dark:border-[var(--border-dark)]">
                                        {newUnits.length > 1 && (
                                            <button type="button" onClick={() => removeUnitField(index)} className="absolute top-3 right-3 text-red-500 hover:text-red-700 p-1">
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                        
                                        {community?.communityType === 'Gated' && (
                                            <div>
                                                <label className="block text-xs font-medium mb-1">Block</label>
                                                <select 
                                                    value={unit.block} 
                                                    onChange={e => handleUnitChange(index, 'block', e.target.value)} 
                                                    required 
                                                    className="block w-full px-2 py-1.5 text-sm border rounded bg-[var(--bg-light)] dark:bg-[var(--bg-dark)]"
                                                >
                                                    <option value="">Select Block</option>
                                                    {community.blocks?.map(block => (
                                                        <option key={block.name} value={block.name}>{block.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                        
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium mb-1">Floor</label>
                                                <select 
                                                    value={unit.floor} 
                                                    onChange={e => handleUnitChange(index, 'floor', e.target.value)} 
                                                    required 
                                                    disabled={community?.communityType === 'Gated' && !unit.block}
                                                    className="block w-full px-2 py-1.5 text-sm border rounded bg-[var(--bg-light)] dark:bg-[var(--bg-dark)]"
                                                >
                                                    <option value="">Select</option>
                                                    {getFloorOptions(unit.block).map(floor => (
                                                        <option key={floor} value={floor}>{floor}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium mb-1">Flat No.</label>
                                                <input type="text" value={unit.flatNumber} onChange={e => handleUnitChange(index, 'flatNumber', e.target.value)} required className="block w-full px-2 py-1.5 text-sm border rounded bg-transparent" />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium mb-1">Size (Sq. Ft)</label>
                                                <input type="number" value={unit.flatSize} onChange={e => handleUnitChange(index, 'flatSize', e.target.value)} required={community?.communityType === 'Gated'} className="block w-full px-2 py-1.5 text-sm border rounded bg-transparent" />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-medium mb-1">Maintenance Start</label>
                                                <input type="date" value={unit.maintenanceStartDate} onChange={e => handleUnitChange(index, 'maintenanceStartDate', e.target.value)} required className="block w-full px-2 py-1.5 text-sm border rounded bg-transparent" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    <div className="flex justify-end pt-4 space-x-2 border-t border-[var(--border-light)] dark:border-[var(--border-dark)] mt-6">
                        <Button type="button" variant="outlined" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Adding...' : 'Add User'}</Button>
                    </div>
                </form>
            </Modal>

            {/* Maintenance History Modal */}
            <Modal isOpen={isHistoryModalOpen} onClose={closeHistoryModal} title={`History: ${historyUser?.name}`}>
                {/* ... Existing History Modal Content ... */}
                <div className="space-y-4">
                    {isHistoryLoading ? <p>Loading...</p> : (
                        <div className="overflow-x-auto border rounded-lg">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-black/5 dark:bg-white/5"><tr><th className="p-2">Unit</th><th className="p-2">Month</th><th className="p-2">Amount</th><th className="p-2">Status</th></tr></thead>
                                <tbody>
                                    {maintenanceHistory.map(r => (
                                        <tr key={r.id} className="border-t">
                                            <td className="p-2">{r.flatNumber || '-'}</td>
                                            <td className="p-2">{new Date(r.periodDate).toLocaleDateString(undefined, {month:'short', year:'numeric'})}</td>
                                            <td className="p-2">₹{r.amount}</td>
                                            <td className="p-2">{r.status}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                     <div className="flex justify-end"><Button onClick={closeHistoryModal}>Close</Button></div>
                </div>
            </Modal>

            {/* Edit User Maintenance Modal */}
            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title={`Edit Unit: ${editingUnit?.flatNumber}`}>
                <form onSubmit={handleUpdateSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Maintenance Start Date</label>
                        <input type="date" value={editMaintenanceDate} onChange={(e) => setEditMaintenanceDate(e.target.value)} required className="block w-full px-3 py-2 border rounded-md bg-transparent"/>
                    </div>
                    <div className="flex justify-end pt-4 space-x-2">
                        <Button type="button" variant="outlined" onClick={() => setIsEditModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>Update</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Directory;
