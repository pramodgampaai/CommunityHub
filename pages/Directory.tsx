
import React, { useState, useEffect } from 'react';
import { getResidents, createCommunityUser } from '../services/api';
import type { User } from '../types';
import { UserRole } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import FeedbackModal from '../components/ui/FeedbackModal';
import Spinner from '../components/ui/Spinner';
import { useAuth } from '../hooks/useAuth';
import { MagnifyingGlassIcon, PlusIcon } from '../components/icons';

const Directory: React.FC = () => {
    const { user } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Form State
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRole, setNewRole] = useState<UserRole>(UserRole.Resident);
    
    // Staff Specific Form State
    const [newFlatNumber, setNewFlatNumber] = useState(''); // Used for Location/Desk for staff
    
    // Feedback
    const [feedback, setFeedback] = useState<{ isOpen: boolean; type: 'success' | 'error' | 'info'; title: string; message: string }>({
        isOpen: false,
        type: 'success',
        title: '',
        message: ''
    });

    const fetchUsers = async () => {
        if (!user?.communityId) return;
        try {
            setLoading(true);
            const data = await getResidents(user.communityId);
            setUsers(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, [user]);

    // Helper to determine allowed default role
    const getDefaultRole = () => {
        if (user?.role === UserRole.HelpdeskAdmin) return UserRole.HelpdeskAgent;
        if (user?.role === UserRole.SecurityAdmin) return UserRole.Security;
        return UserRole.Resident;
    };

    const handleOpenModal = () => {
        setNewName('');
        setNewEmail('');
        setNewPassword('');
        setNewRole(getDefaultRole());
        setNewFlatNumber('');
        setIsModalOpen(true);
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.communityId) return;
        
        setIsSubmitting(true);
        try {
            const payload: any = {
                name: newName,
                email: newEmail,
                password: newPassword,
                role: newRole,
                community_id: user.communityId
            };

            if (newRole === UserRole.Resident || newRole === UserRole.Admin) {
                // For Residents and Admins, unit assignment is deferred to their first login (CommunitySetup)
                payload.units = [];
                // Explicitly set flat_number to null to override any potential DB defaults
                payload.flat_number = null;
            } else {
                payload.flat_number = newFlatNumber; // Location for staff
            }

            await createCommunityUser(payload);
            
            setIsModalOpen(false);
            setNewName('');
            setNewEmail('');
            setNewPassword('');
            setNewRole(getDefaultRole());
            setNewFlatNumber('');
            
            setFeedback({
                isOpen: true,
                type: 'success',
                title: 'User Created',
                message: `${newName} has been added successfully.`
            });
            
            fetchUsers();

        } catch (error: any) {
            console.error(error);
            // Parse Supabase Functions error if available
            let msg = error.message || "Failed to create user.";
            if (msg.includes("non-2xx")) {
                // Try to extract useful info or provide a better hint
                msg = "Failed to create user. Please check permissions or if the email is already registered.";
            }

            setFeedback({
                isOpen: true,
                type: 'error',
                title: 'Creation Failed',
                message: msg
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredUsers = users.filter(u => 
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.flatNumber && u.flatNumber.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const canCreateUser = user?.role === UserRole.Admin || 
                          user?.role === UserRole.HelpdeskAdmin || 
                          user?.role === UserRole.SecurityAdmin ||
                          user?.role === UserRole.SuperAdmin;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center animated-card">
                <div>
                    <h2 className="text-2xl font-bold text-[var(--text-light)] dark:text-[var(--text-dark)]">Directory</h2>
                    <p className="text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Community members and staff.</p>
                </div>
                {canCreateUser && (
                    <Button onClick={handleOpenModal} leftIcon={<PlusIcon className="w-5 h-5"/>}>
                        Add User
                    </Button>
                )}
            </div>

            <div className="relative animated-card">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className="h-5 w-5 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]" />
                </div>
                <input
                    type="text"
                    placeholder="Search by name, email, or flat..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-lg bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
            </div>

            {loading ? (
                <div className="flex justify-center p-8"><Spinner /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredUsers.map((u, i) => (
                        <Card key={u.id} className="p-4 flex items-center space-x-4 animated-card" style={{ animationDelay: `${i * 50}ms` }}>
                            <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                {u.avatarUrl ? (
                                    <img src={u.avatarUrl} alt={u.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xl font-bold text-gray-500">
                                        {u.name.charAt(0)}
                                    </div>
                                )}
                            </div>
                            <div>
                                <h3 className="font-semibold text-[var(--text-light)] dark:text-[var(--text-dark)]">{u.name}</h3>
                                <p className="text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">{u.role}</p>
                                {u.flatNumber && (
                                    <p className="text-xs text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mt-1">
                                        {u.role === UserRole.Resident ? 'Flat: ' : 'Loc: '}{u.flatNumber}
                                    </p>
                                )}
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New User">
                <form className="space-y-4" onSubmit={handleCreateUser}>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Name <span className="text-red-500">*</span></label>
                        <input type="text" value={newName} onChange={e => setNewName(e.target.value)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md bg-transparent" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Email <span className="text-red-500">*</span></label>
                        <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md bg-transparent" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Password <span className="text-red-500">*</span></label>
                        <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md bg-transparent" />
                    </div>
                    
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
                                    {user?.role === UserRole.Admin && <option value={UserRole.Admin}>Admin</option>}
                                    <option value={UserRole.SecurityAdmin}>Security Admin</option>
                                    <option value={UserRole.HelpdeskAdmin}>Helpdesk Admin</option>
                                </>
                            )}
                        </select>
                    </div>

                    {/* Only show Location/Desk for Staff roles */}
                    {newRole !== UserRole.Resident && newRole !== UserRole.Admin && (
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Location / Desk</label>
                            <input type="text" value={newFlatNumber} onChange={e => setNewFlatNumber(e.target.value)} className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md bg-transparent" placeholder="e.g. Gate 1" />
                        </div>
                    )}

                    <div className="flex justify-end pt-4 space-x-2">
                        <Button type="button" variant="outlined" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating...' : 'Create User'}</Button>
                    </div>
                </form>
            </Modal>

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
