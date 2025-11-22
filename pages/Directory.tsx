
import React, { useState, useEffect } from 'react';
import { getResidents, createCommunityUser, getCommunity, getMaintenanceRecords } from '../services/api';
import type { User, Community, Block, MaintenanceRecord } from '../types';
import { UserRole, MaintenanceStatus } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { PlusIcon, FunnelIcon, MagnifyingGlassIcon, ClockIcon } from '../components/icons';
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
    const [newRole, setNewRole] = useState<UserRole>(UserRole.Resident);
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newFlatNumber, setNewFlatNumber] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [selectedBlock, setSelectedBlock] = useState('');
    const [selectedFloor, setSelectedFloor] = useState('');
    const [newFlatSize, setNewFlatSize] = useState('');
    const [newMaintenanceStartDate, setNewMaintenanceStartDate] = useState('');
    
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
        if (user?.communityId) {
            fetchResidents(user.communityId);
            fetchCommunityDetails(user.communityId);
        }
    }, [user]);

    // Reset form when modal opens/closes
    useEffect(() => {
        if (isModalOpen) {
            // Default role based on logged in user
            if (user?.role === UserRole.Helpdesk) {
                setNewRole(UserRole.HelpdeskAgent);
            } else {
                setNewRole(UserRole.Resident);
            }
             // Set default start date to today
             setNewMaintenanceStartDate(new Date().toISOString().split('T')[0]);
        } else {
            setNewName('');
            setNewEmail('');
            setNewFlatNumber('');
            setNewPassword('');
            setSelectedBlock('');
            setSelectedFloor('');
            setNewFlatSize('');
            setNewMaintenanceStartDate('');
        }
    }, [isModalOpen, user]);

    const getFloorOptions = () => {
        if (!community) return [];
        let floorCount = 0;

        if (community.communityType === 'Gated' && selectedBlock) {
            const block = community.blocks?.find(b => b.name === selectedBlock);
            floorCount = block?.floorCount || 0;
        } else if (community.communityType === 'Standalone' && community.blocks && community.blocks.length > 0) {
            floorCount = community.blocks[0].floorCount;
        }

        return Array.from({ length: floorCount }, (_, i) => i + 1);
    };

    const handleAddResident = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !user.communityId) return;
        
        setIsSubmitting(true);

        // Construct full flat number string for display/simple fields
        let finalFlatNumber = newFlatNumber;
        
        // Only append block logic if it's a Resident in a Gated community
        if (newRole === UserRole.Resident && community?.communityType === 'Gated' && selectedBlock) {
             finalFlatNumber = `${selectedBlock}-${newFlatNumber}`;
        }

        try {
            await createCommunityUser({
                name: newName,
                email: newEmail,
                flat_number: finalFlatNumber,
                block: newRole === UserRole.Resident ? selectedBlock : undefined,
                floor: (newRole === UserRole.Resident && selectedFloor) ? parseInt(selectedFloor) : undefined,
                flat_size: (newRole === UserRole.Resident && newFlatSize) ? parseFloat(newFlatSize) : 0,
                maintenance_start_date: newRole === UserRole.Resident ? newMaintenanceStartDate : undefined,
                password: newPassword,
                community_id: user.communityId,
                role: newRole
            });
            
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

    // Filtering logic
    const getFilteredResidents = () => {
        let filtered = residents;

        // Strict View Filtering for Helpdesk Admins
        // Helpdesk Admins should ONLY see Helpdesk profiles and Agents.
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
                (r.flatNumber && r.flatNumber.toLowerCase().includes(query)) ||
                r.email.toLowerCase().includes(query)
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
    // Only show maintenance start date to Admin users
    const canViewMaintenanceStart = user?.role === UserRole.Admin;

    const renderTable = (users: User[]) => (
        <Card className="overflow-x-auto animated-card">
            <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="bg-black/5 dark:bg-white/5">
                    <tr>
                        <th className="p-4 font-semibold text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Name</th>
                        <th className="p-4 font-semibold text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Details</th>
                        <th className="p-4 font-semibold text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Contact</th>
                         {canViewMaintenanceStart && <th className="p-4 font-semibold text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Maintenance Start</th>}
                        <th className="p-4 font-semibold text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Role</th>
                        <th className="p-4 font-semibold text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Status</th>
                        {canViewHistory && <th className="p-4 font-semibold text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] text-right">Actions</th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-light)] dark:divide-[var(--border-dark)]">
                    {users.map((resident) => (
                        <tr key={resident.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
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
                                <div className="text-sm font-medium text-[var(--text-light)] dark:text-[var(--text-dark)]">
                                    {resident.flatNumber || 'N/A'}
                                </div>
                                {(resident.block || resident.floor || resident.flatSize) && (
                                    <div className="text-xs text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mt-0.5">
                                        {resident.block ? `Block ${resident.block}` : ''}
                                        {resident.block && (resident.floor || resident.flatSize) ? ' • ' : ''}
                                        {resident.floor ? `Floor ${resident.floor}` : ''}
                                        {resident.floor && resident.flatSize ? ' • ' : ''}
                                        {resident.flatSize ? `${resident.flatSize} sq ft` : ''}
                                    </div>
                                )}
                            </td>
                            <td className="p-4 text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                                {resident.email}
                            </td>
                             {canViewMaintenanceStart && (
                                <td className="p-4">
                                    {resident.role === UserRole.Resident && (
                                        <span className="text-sm font-medium text-[var(--text-light)] dark:text-[var(--text-dark)]">
                                            {resident.maintenanceStartDate 
                                                ? new Date(resident.maintenanceStartDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) 
                                                : '-'}
                                        </span>
                                    )}
                                </td>
                            )}
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
                                <td className="p-4 text-right">
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
    // Admins can create anyone. Helpdesk can create Helpdesk Agents.
    const canCreateUser = user?.role === UserRole.Admin || user?.role === UserRole.Helpdesk;

    // Role Options for Filter Dropdown
    // Helpdesk Admin only sees relevant filters
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
                     {/* Search Input */}
                    <div className="relative w-full sm:max-w-md">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <MagnifyingGlassIcon className="h-5 w-5 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search by name, flat no, or email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-lg leading-5 bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] text-[var(--text-light)] dark:text-[var(--text-dark)] placeholder-[var(--text-secondary-light)] dark:placeholder-[var(--text-secondary-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] sm:text-sm transition-shadow"
                        />
                    </div>

                    <div className="hidden sm:block h-6 w-px bg-[var(--border-light)] dark:bg-[var(--border-dark)]"></div>

                    <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
                        {/* Filter Dropdown */}
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
                            <span className="text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] group-hover:text-[var(--text-light)] dark:group-hover:text-[var(--text-dark)] transition-colors font-medium">
                                Group
                            </span>
                            <div className="relative flex items-center">
                                <input 
                                    type="checkbox" 
                                    checked={isGrouped} 
                                    onChange={(e) => setIsGrouped(e.target.checked)} 
                                    className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--accent)] rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--accent)]"></div>
                            </div>
                        </label>
                    </div>
                </div>
                
                <div className="text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] font-medium whitespace-nowrap text-right">
                    Showing {filteredResidents.length} users
                </div>
            </div>

            {loading ? (
                <Card className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-black/5 dark:bg-white/5">
                            <tr>
                                <th className="p-4 font-semibold text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Name</th>
                                <th className="p-4 font-semibold text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Details</th>
                                <th className="p-4 font-semibold text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Contact</th>
                                <th className="p-4 font-semibold text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Role</th>
                                <th className="p-4 font-semibold text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Status</th>
                                {canViewHistory && <th className="p-4"></th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-light)] dark:divide-[var(--border-dark)]">
                            {Array.from({ length: 5 }).map((_, i) => <DirectoryRowSkeleton key={i} />)}
                        </tbody>
                    </table>
                </Card>
            ) : (
                <>
                    {filteredResidents.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] rounded-xl border border-[var(--border-light)] dark:border-[var(--border-dark)]">
                            <MagnifyingGlassIcon className="w-12 h-12 mb-4 opacity-20" />
                            <p className="text-lg font-medium">No users found</p>
                            <p className="text-sm opacity-75">Try adjusting your search or filters</p>
                        </div>
                    )}

                    {isGrouped ? (
                        <div className="space-y-8">
                            {Object.keys(groupedResidents).map(role => (
                                <div key={role}>
                                    <h3 className="text-lg font-semibold text-[var(--text-light)] dark:text-[var(--text-dark)] mb-4 flex items-center gap-2">
                                        <span className={`w-2 h-6 rounded-full ${
                                            role === UserRole.Admin ? 'bg-purple-500' :
                                            role === UserRole.Helpdesk ? 'bg-orange-500' :
                                            role === UserRole.HelpdeskAgent ? 'bg-teal-500' :
                                            role === UserRole.Security ? 'bg-gray-500' :
                                            'bg-[var(--accent)]'
                                        }`}></span>
                                        {role}s ({groupedResidents[role].length})
                                    </h3>
                                    {renderTable(groupedResidents[role])}
                                </div>
                            ))}
                        </div>
                    ) : (
                        renderTable(filteredResidents)
                    )}
                </>
            )}

            {/* Add User Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New User">
                <form className="space-y-4" onSubmit={handleAddResident}>
                    
                    <div>
                        <label htmlFor="role" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Role</label>
                        <select 
                            id="role" 
                            value={newRole} 
                            onChange={e => setNewRole(e.target.value as UserRole)} 
                            required 
                            disabled={user?.role === UserRole.Helpdesk} // Helpdesk can only create agents
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
                    
                    {newRole === UserRole.Resident && community?.communityType === 'Gated' && (
                         <div>
                            <label htmlFor="block" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Block / Tower</label>
                            <select 
                                id="block" 
                                value={selectedBlock} 
                                onChange={e => { setSelectedBlock(e.target.value); setSelectedFloor(''); }} 
                                required 
                                className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-[var(--bg-light)] dark:bg-[var(--bg-dark)]"
                            >
                                <option value="">Select Block</option>
                                {community.blocks?.map(block => (
                                    <option key={block.name} value={block.name}>{block.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {newRole === UserRole.Resident ? (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                 <label htmlFor="floor" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Floor</label>
                                 <select 
                                    id="floor" 
                                    value={selectedFloor} 
                                    onChange={e => setSelectedFloor(e.target.value)} 
                                    required 
                                    disabled={community?.communityType === 'Gated' && !selectedBlock}
                                    className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] disabled:opacity-50"
                                 >
                                    <option value="">Select Floor</option>
                                    {getFloorOptions().map(floor => (
                                        <option key={floor} value={floor}>{floor}</option>
                                    ))}
                                 </select>
                            </div>
                             <div>
                                 <label htmlFor="flat" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Unit / Flat No.</label>
                                 <input type="text" id="flat" value={newFlatNumber} onChange={e => setNewFlatNumber(e.target.value)} placeholder="e.g. 101" required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"/>
                            </div>
                        </div>
                    ) : (
                        <div>
                             <label htmlFor="flat" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Location / Desk ID</label>
                             <input type="text" id="flat" value={newFlatNumber} onChange={e => setNewFlatNumber(e.target.value)} placeholder={newRole === UserRole.Security ? "e.g. Main Gate" : "e.g. Helpdesk Office"} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"/>
                        </div>
                    )}
                    
                    {newRole === UserRole.Resident && (
                        <>
                            <div>
                                <label htmlFor="flatSize" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">
                                    Flat Size (Sq. Ft) {community?.communityType === 'Gated' && <span className="text-red-500">*</span>}
                                </label>
                                <input 
                                    type="number" 
                                    id="flatSize" 
                                    value={newFlatSize} 
                                    onChange={e => setNewFlatSize(e.target.value)} 
                                    placeholder="e.g. 1200" 
                                    min="0" 
                                    required={community?.communityType === 'Gated'} 
                                    className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"
                                />
                                <p className="text-xs text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mt-1">Used to calculate maintenance for Gated communities.</p>
                            </div>
                             <div>
                                <label htmlFor="maintenanceStartDate" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Maintenance Start Date</label>
                                <input type="date" id="maintenanceStartDate" value={newMaintenanceStartDate} onChange={e => setNewMaintenanceStartDate(e.target.value)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"/>
                            </div>
                        </>
                    )}

                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Email Address</label>
                        <input type="email" id="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"/>
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Password</label>
                        <input type="password" id="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"/>
                    </div>
                    
                    <div className="flex justify-end pt-4 space-x-2">
                        <Button type="button" variant="outlined" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Adding...' : 'Add User'}</Button>
                    </div>
                </form>
            </Modal>

            {/* Maintenance History Modal */}
            <Modal isOpen={isHistoryModalOpen} onClose={closeHistoryModal} title={`Maintenance History: ${historyUser?.name}`}>
                <div className="space-y-4">
                    {isHistoryLoading ? (
                        <div className="text-center py-8 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                            Loading history...
                        </div>
                    ) : maintenanceHistory.length > 0 ? (
                         <div className="overflow-x-auto border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-lg">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-black/5 dark:bg-white/5">
                                    <tr>
                                        <th className="p-3 font-semibold text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Month</th>
                                        <th className="p-3 font-semibold text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Amount</th>
                                        <th className="p-3 font-semibold text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Status</th>
                                        <th className="p-3 font-semibold text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Paid Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-light)] dark:divide-[var(--border-dark)]">
                                    {maintenanceHistory.map(record => (
                                        <tr key={record.id} className="hover:bg-black/5 dark:hover:bg-white/5">
                                            <td className="p-3 text-[var(--text-light)] dark:text-[var(--text-dark)]">
                                                 {new Date(record.periodDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}
                                            </td>
                                            <td className="p-3 text-[var(--text-light)] dark:text-[var(--text-dark)] font-medium">₹{record.amount}</td>
                                            <td className="p-3">
                                                 <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                                    record.status === MaintenanceStatus.Paid ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' :
                                                    record.status === MaintenanceStatus.Submitted ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' :
                                                    'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                                                }`}>
                                                    {record.status}
                                                </span>
                                            </td>
                                            <td className="p-3 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                                                {record.transactionDate ? new Date(record.transactionDate).toLocaleDateString() : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                         <div className="text-center py-8 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                            No maintenance records found.
                        </div>
                    )}
                    <div className="flex justify-end pt-2">
                        <Button onClick={closeHistoryModal} variant="outlined">Close</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Directory;
