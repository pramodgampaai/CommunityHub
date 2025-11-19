
import React, { useState, useEffect } from 'react';
import { getResidents, createCommunityUser } from '../services/api';
import type { User } from '../types';
import { UserRole } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { PlusIcon, FunnelIcon, MagnifyingGlassIcon } from '../components/icons';
import { useAuth } from '../hooks/useAuth';

const DirectorySkeleton: React.FC = () => (
    <div className="flex items-center p-4 bg-black/5 dark:bg-white/5 rounded-xl animate-pulse">
        <div className="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
        <div className="ml-4 flex-1 space-y-2">
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
        </div>
    </div>
);

const Directory: React.FC = () => {
    const [residents, setResidents] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { user } = useAuth();
    
    // View Controls
    const [filterRole, setFilterRole] = useState<UserRole | 'All'>('All');
    const [isGrouped, setIsGrouped] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Form State
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newFlatNumber, setNewFlatNumber] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

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

    useEffect(() => {
        if (user?.communityId) {
            fetchResidents(user.communityId);
        }
    }, [user]);

    const handleAddResident = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !user.communityId) return;
        
        setIsSubmitting(true);
        try {
            await createCommunityUser({
                name: newName,
                email: newEmail,
                flat_number: newFlatNumber,
                password: newPassword,
                community_id: user.communityId,
                role: UserRole.Resident
            });
            
            setIsModalOpen(false);
            setNewName('');
            setNewEmail('');
            setNewFlatNumber('');
            setNewPassword('');
            alert('Resident added successfully!');
            await fetchResidents(user.communityId);
        } catch (error: any) {
            console.error("Failed to create resident:", error);
            alert(error.message || "Failed to create resident.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Filtering logic
    const getFilteredResidents = () => {
        let filtered = residents;

        // Role Filter
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

    const renderResidentCard = (resident: User, index: number) => (
        <Card key={resident.id} className="p-4 flex items-center animated-card hover:shadow-md transition-shadow" style={{ animationDelay: `${(index % 10) * 50}ms` }}>
            <div className="relative">
                <img className="w-12 h-12 rounded-full ring-2 ring-[var(--border-light)] dark:ring-[var(--border-dark)] object-cover" src={resident.avatarUrl} alt={resident.name} />
                <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[var(--card-bg-light)] dark:border-[var(--card-bg-dark)] ${resident.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
            </div>
            <div className="ml-4 overflow-hidden flex-1">
                <h3 className="font-semibold text-[var(--text-light)] dark:text-[var(--text-dark)] truncate" title={resident.name}>{resident.name}</h3>
                <p className="text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] truncate">Flat: <span className="font-medium">{resident.flatNumber || 'N/A'}</span></p>
                 <p className="text-xs text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] truncate">{resident.email}</p>
                {resident.role !== UserRole.Resident && (
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full mt-1 inline-block font-medium ${
                        resident.role === UserRole.Admin 
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                    }`}>
                        {resident.role}
                    </span>
                )}
            </div>
        </Card>
    );

    const renderGrid = (users: User[]) => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map((resident, index) => renderResidentCard(resident, index))}
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 animated-card">
                <h2 className="text-3xl sm:text-4xl font-bold text-[var(--text-light)] dark:text-[var(--text-dark)]">Directory</h2>
                {user?.role === UserRole.Admin && (
                    <Button onClick={() => setIsModalOpen(true)} leftIcon={<PlusIcon className="w-5 h-5" />} aria-label="Add Resident" variant="fab">
                        <span className="hidden sm:inline">Add Resident</span>
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
                                    <option value={UserRole.Resident}>Residents</option>
                                    <option value={UserRole.Admin}>Admins</option>
                                    <option value={UserRole.Security}>Security</option>
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
                    Showing {filteredResidents.length} residents
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                     {Array.from({ length: 6 }).map((_, i) => <DirectorySkeleton key={i} />)}
                </div>
            ) : (
                <>
                    {filteredResidents.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] rounded-xl border border-[var(--border-light)] dark:border-[var(--border-dark)]">
                            <MagnifyingGlassIcon className="w-12 h-12 mb-4 opacity-20" />
                            <p className="text-lg font-medium">No residents found</p>
                            <p className="text-sm opacity-75">Try adjusting your search or filters</p>
                        </div>
                    )}

                    {isGrouped ? (
                        <div className="space-y-8">
                            {/* Admin Group */}
                            {groupedResidents[UserRole.Admin] && groupedResidents[UserRole.Admin].length > 0 && (
                                <div>
                                    <h3 className="text-lg font-semibold text-[var(--text-light)] dark:text-[var(--text-dark)] mb-4 flex items-center gap-2">
                                        <span className="w-2 h-6 bg-purple-500 rounded-full"></span>
                                        Admins ({groupedResidents[UserRole.Admin].length})
                                    </h3>
                                    {renderGrid(groupedResidents[UserRole.Admin])}
                                </div>
                            )}
                            
                            {/* Resident Group */}
                            {groupedResidents[UserRole.Resident] && groupedResidents[UserRole.Resident].length > 0 && (
                                <div>
                                    <h3 className="text-lg font-semibold text-[var(--text-light)] dark:text-[var(--text-dark)] mb-4 flex items-center gap-2">
                                        <span className="w-2 h-6 bg-[var(--accent)] rounded-full"></span>
                                        Residents ({groupedResidents[UserRole.Resident].length})
                                    </h3>
                                    {renderGrid(groupedResidents[UserRole.Resident])}
                                </div>
                            )}

                            {/* Security Group */}
                            {groupedResidents[UserRole.Security] && groupedResidents[UserRole.Security].length > 0 && (
                                <div>
                                    <h3 className="text-lg font-semibold text-[var(--text-light)] dark:text-[var(--text-dark)] mb-4 flex items-center gap-2">
                                        <span className="w-2 h-6 bg-gray-500 rounded-full"></span>
                                        Security ({groupedResidents[UserRole.Security].length})
                                    </h3>
                                    {renderGrid(groupedResidents[UserRole.Security])}
                                </div>
                            )}
                        </div>
                    ) : (
                        renderGrid(filteredResidents)
                    )}
                </>
            )}

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Resident">
                <form className="space-y-4" onSubmit={handleAddResident}>
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Full Name</label>
                        <input type="text" id="name" value={newName} onChange={e => setNewName(e.target.value)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"/>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                             <label htmlFor="flat" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Flat No.</label>
                             <input type="text" id="flat" value={newFlatNumber} onChange={e => setNewFlatNumber(e.target.value)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"/>
                        </div>
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Password</label>
                            <input type="password" id="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"/>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Email Address</label>
                        <input type="email" id="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"/>
                    </div>
                    
                    <div className="flex justify-end pt-4 space-x-2">
                        <Button type="button" variant="outlined" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Adding...' : 'Add Resident'}</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Directory;
