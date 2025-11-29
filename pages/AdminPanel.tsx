import React, { useState, useEffect } from 'react';
import { getCommunityStats, createCommunity, updateCommunity, deleteCommunity, createAdminUser } from '../services/api';
import type { CommunityStat, User, Community, Block, CommunityType, CommunityContact, CommunityPricing } from '../types';
import { UserRole } from '../types';
import { useAuth } from '../hooks/useAuth';
import type { Theme } from '../App';
import { LogOutIcon, MoonIcon, SunIcon, PlusIcon, ChevronDownIcon, AlertTriangleIcon, PencilIcon, TrashIcon, CheckCircleIcon } from '../components/icons';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import ProfileModal from '../components/ProfileModal';
import Logo from '../components/ui/Logo';
import { useScreen } from '../hooks/useScreen';

const AdminHeader: React.FC<{ theme: Theme; toggleTheme: () => void; }> = ({ theme, toggleTheme }) => {
    const { user, logout } = useAuth();
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(part => part[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
    };

    return (
        <>
            <header className="flex justify-between items-center p-4 bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] border-b border-[var(--border-light)] dark:border-[var(--border-dark)] z-10 sticky top-0">
                <div className="flex items-center gap-3">
                    <Logo className="w-10 h-10 text-[var(--accent)]" />
                    <div className="flex flex-col">
                        <h1 className="text-3xl font-brand font-bold text-brand-500 tracking-wide leading-none">Elevate</h1>
                        <span className="text-[10px] text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] font-medium uppercase tracking-wide">Platform Management</span>
                    </div>
                </div>
                <div className="flex items-center">
                    <button
                        onClick={toggleTheme}
                        className="mr-4 p-2 rounded-lg text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-200"
                        aria-label="Toggle theme"
                    >
                        {theme === 'light' ? <MoonIcon className="w-6 h-6" /> : <SunIcon className="w-6 h-6" />}
                    </button>
                     <div 
                        className="flex items-center gap-3 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 p-1.5 rounded-xl transition-colors"
                        onClick={() => setIsProfileOpen(true)}
                        role="button"
                        tabIndex={0}
                     >
                        <div className="text-right hidden sm:block">
                            <p className="font-semibold text-sm text-[var(--text-light)] dark:text-[var(--text-dark)] leading-tight">{user?.name}</p>
                            <p className="text-[10px] text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] font-bold uppercase tracking-wider">Super Admin</p>
                        </div>
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 text-white flex items-center justify-center text-sm font-bold shadow-sm">
                            {getInitials(user?.name || 'SA')}
                        </div>
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
    const { isMobile } = useScreen();

    // Modal States
    const [isCommunityModalOpen, setCommunityModalOpen] = useState(false);
    const [isAddAdminModalOpen, setAddAdminModalOpen] = useState(false);
    const [selectedCommunity, setSelectedCommunity] = useState<CommunityStat | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);

    // Feedback Modal State
    const [feedbackModal, setFeedbackModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'success' | 'error';
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'success'
    });

    // --- Create Community Wizard State ---
    const [activeTab, setActiveTab] = useState<'details' | 'contacts' | 'pricing'>('details');

    // Tab 1: Details
    const [communityName, setCommunityName] = useState('');
    const [communityAddress, setCommunityAddress] = useState('');
    const [communityType, setCommunityType] = useState<CommunityType>('High-Rise Apartment');
    
    // Tab 2: Contacts
    const [contacts, setContacts] = useState<CommunityContact[]>([
        { name: '', email: '', primaryPhone: '', secondaryPhone: '' }
    ]);
    
    // Tab 3: Pricing
    const [subscriptionType, setSubscriptionType] = useState<'Monthly' | 'Yearly'>('Monthly');
    const [subscriptionStartDate, setSubscriptionStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [pricing, setPricing] = useState<CommunityPricing>({ resident: 0, admin: 0, staff: 0 });

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

    const isStandaloneType = (type: CommunityType) => {
        return type === 'Standalone Apartment' || type === 'Standalone';
    }

    const isGatedVillaType = (type: CommunityType) => {
        return type === 'Gated Community Villa';
    }

    // Reset and Open Community Modal for Create
    const openCreateCommunityModal = () => {
        setIsEditMode(false);
        setSelectedCommunity(null);
        
        // Reset ALL fields
        setCommunityName('');
        setCommunityAddress('');
        setCommunityType('High-Rise Apartment');
        setContacts([{ name: '', email: '', primaryPhone: '', secondaryPhone: '' }]);
        setSubscriptionType('Monthly');
        setSubscriptionStartDate(new Date().toISOString().split('T')[0]);
        setPricing({ resident: 0, admin: 0, staff: 0 });
        
        setActiveTab('details');
        setCommunityModalOpen(true);
    };

    // Reset and Open Community Modal for Edit
    const openEditCommunityModal = (community: CommunityStat) => {
        setIsEditMode(true);
        setSelectedCommunity(community);
        
        // Populate fields
        setCommunityName(community.name);
        setCommunityAddress(community.address);
        setCommunityType(community.communityType || 'High-Rise Apartment');
        setContacts(community.contacts && community.contacts.length > 0 ? community.contacts : [{ name: '', email: '', primaryPhone: '', secondaryPhone: '' }]);
        setSubscriptionType(community.subscriptionType || 'Monthly');
        setSubscriptionStartDate(community.subscriptionStartDate || new Date().toISOString().split('T')[0]);
        setPricing(community.pricePerUser || { resident: 0, admin: 0, staff: 0 });

        setActiveTab('details');
        setCommunityModalOpen(true);
    };

    // Contact Handlers
    const addContact = () => {
        setContacts([...contacts, { name: '', email: '', primaryPhone: '', secondaryPhone: '' }]);
    };
    
    const removeContact = (index: number) => {
        if (contacts.length > 1) {
            setContacts(contacts.filter((_, i) => i !== index));
        }
    };

    const updateContact = (index: number, field: keyof CommunityContact, value: string) => {
        const updated = [...contacts];
        updated[index] = { ...updated[index], [field]: value };
        setContacts(updated);
    };

    // Validation Logic - Pure Boolean functions now
    const checkDetailsValidity = () => {
        if (!communityName.trim()) return false;
        if (!communityAddress.trim()) return false;
        if (!communityType) return false;
        return true;
    };

    const checkContactsValidity = () => {
        // Filter contacts that have all required fields filled
        const validContacts = contacts.filter(c => c.name.trim() && c.email.trim() && c.primaryPhone.trim());
        // Must have at least 2 valid contacts
        return validContacts.length >= 2;
    };

    const checkPricingValidity = () => {
        return pricing.resident > 0 && pricing.admin > 0 && pricing.staff > 0;
    };

    // Real-time status for enabling/disabling UI
    const isDetailsValid = checkDetailsValidity();
    const isContactsValid = checkContactsValidity();
    const isPricingValid = checkPricingValidity();


    const handleSubmitCommunity = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Final guard clause
        if (!isDetailsValid || !isContactsValid || !isPricingValid) return;

        setIsSubmitting(true);

        const payload = {
            name: communityName,
            address: communityAddress,
            communityType,
            blocks: [], // Handled by community admin
            contacts,
            subscriptionType,
            subscriptionStartDate,
            pricePerUser: pricing
        };

        try {
            if (isEditMode && selectedCommunity) {
                await updateCommunity(selectedCommunity.id, payload);
            } else {
                await createCommunity(payload);
            }
            setCommunityModalOpen(false);
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
            
            setFeedbackModal({
                isOpen: true,
                title: 'Success',
                message: `Successfully created Admin for ${selectedCommunity.name}`,
                type: 'success'
            });
            
            // Refresh to update admin count
            await fetchData();
        } catch (err: any) {
            console.error(err);
            setFeedbackModal({
                isOpen: true,
                title: 'Error',
                message: err.message || "Failed to create admin.",
                type: 'error'
            });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const openAddAdminModal = (community: CommunityStat) => {
        setSelectedCommunity(community);
        setNewAdminName('');
        setNewAdminEmail('');
        setNewAdminPassword('');
        setAddAdminModalOpen(true);
    };

    const renderMobileCommunityCard = (stat: CommunityStat) => (
        <Card key={stat.id} className="p-4 mb-4 animated-card">
            <div className="flex justify-between items-start mb-3">
                <div>
                    <h3 className="text-lg font-bold text-[var(--text-light)] dark:text-[var(--text-dark)]">{stat.name}</h3>
                    <p className="text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">{stat.address}</p>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    stat.status === 'active' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' 
                        : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                }`}>
                    {stat.status}
                </span>
            </div>

            <div className="bg-black/5 dark:bg-white/5 p-3 rounded-lg mb-4 text-sm space-y-2">
                <div className="flex justify-between">
                    <span className="text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Type:</span>
                    <span className="font-medium">{stat.communityType || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Residents:</span>
                    <span className="font-medium">{stat.resident_count}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Admins:</span>
                    <span className="font-medium">{stat.admin_count}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Plan:</span>
                    <span className="font-medium">{stat.subscriptionType || 'Monthly'}</span>
                </div>
                 {stat.subscriptionStartDate && (
                     <div className="flex justify-between">
                        <span className="text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Since:</span>
                        <span className="font-medium">{new Date(stat.subscriptionStartDate).toLocaleDateString()}</span>
                    </div>
                )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border-light)] dark:border-[var(--border-dark)]">
                <Button size="sm" variant="outlined" onClick={() => openEditCommunityModal(stat)}>
                    Edit Details
                </Button>
                <Button size="sm" onClick={() => openAddAdminModal(stat)}>
                    Add Admin
                </Button>
            </div>
        </Card>
    );

    return (
        <div className="flex flex-col h-screen bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] text-[var(--text-light)] dark:text-[var(--text-dark)]">
            <AdminHeader theme={theme} toggleTheme={toggleTheme} />
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold">Communities</h2>
                        <Button onClick={openCreateCommunityModal} leftIcon={<PlusIcon className="w-5 h-5" />}>
                            {isMobile ? 'Create' : 'Create Community'}
                        </Button>
                    </div>

                    {loading && <Spinner />}
                    {error && <p className="text-red-500">Error: {error}</p>}
                    
                    {!loading && !error && (
                        isMobile ? (
                            <div className="space-y-4">
                                {stats.map(stat => renderMobileCommunityCard(stat))}
                            </div>
                        ) : (
                            <Card className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-black/5 dark:bg-white/5 border-b border-[var(--border-light)] dark:border-[var(--border-dark)]">
                                        <tr>
                                            <th className="p-4 font-semibold text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Community</th>
                                            <th className="p-4 font-semibold text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Type</th>
                                            <th className="p-4 font-semibold text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Subscription</th>
                                            <th className="p-4 font-semibold text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Status</th>
                                            <th className="p-4 font-semibold text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--border-light)] dark:divide-[var(--border-dark)]">
                                        {stats.map(stat => (
                                            <tr key={stat.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                                <td className="p-4">
                                                    <div className="font-medium text-[var(--text-light)] dark:text-[var(--text-dark)]">{stat.name}</div>
                                                    <div className="text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">{stat.address}</div>
                                                    <div className="text-xs text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mt-1 flex gap-2">
                                                        <span>{stat.resident_count} Residents</span>
                                                        <span className="text-gray-300 dark:text-gray-600">|</span>
                                                        <span>{stat.admin_count} Admins</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-[var(--text-light)] dark:text-[var(--text-dark)]">
                                                    {stat.communityType || 'N/A'}
                                                </td>
                                                <td className="p-4 text-[var(--text-light)] dark:text-[var(--text-dark)]">
                                                    {stat.subscriptionType || 'N/A'}
                                                    {stat.subscriptionStartDate && (
                                                        <div className="text-xs text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                                                            Since: {new Date(stat.subscriptionStartDate).toLocaleDateString()}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                                        stat.status === 'active' 
                                                            ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' 
                                                            : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                                                    }`}>
                                                        {stat.status}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right space-x-2">
                                                    <button 
                                                        onClick={() => openEditCommunityModal(stat)}
                                                        className="text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] hover:text-[var(--accent)] transition-colors p-1"
                                                        title="Edit Details"
                                                    >
                                                        <PencilIcon className="w-5 h-5" />
                                                    </button>
                                                    <Button size="sm" onClick={() => openAddAdminModal(stat)}>Add Admin</Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </Card>
                        )
                    )}
                </div>
            </main>

             <Modal 
                isOpen={isCommunityModalOpen} 
                onClose={() => setCommunityModalOpen(false)} 
                title={isEditMode ? "Edit Community" : "Create Community"}
                size="xl"
                footer={
                     <div className="flex justify-between w-full">
                        <Button type="button" variant="outlined" onClick={() => setCommunityModalOpen(false)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <div className="flex gap-2">
                             {activeTab !== 'details' && (
                                <Button type="button" variant="outlined" onClick={() => setActiveTab(activeTab === 'pricing' ? 'contacts' : 'details')} disabled={isSubmitting}>
                                    Back
                                </Button>
                             )}
                             {activeTab !== 'pricing' ? (
                                <Button 
                                    type="button" 
                                    onClick={() => {
                                        if (activeTab === 'details') setActiveTab('contacts');
                                        if (activeTab === 'contacts') setActiveTab('pricing');
                                    }}
                                    disabled={
                                        (activeTab === 'details' && !isDetailsValid) || 
                                        (activeTab === 'contacts' && !isContactsValid)
                                    }
                                >
                                    Next
                                </Button>
                             ) : (
                                <Button type="submit" form="community-form" disabled={isSubmitting || !isPricingValid}>
                                    {isEditMode ? 'Update Community' : 'Create Community'}
                                </Button>
                             )}
                        </div>
                    </div>
                }
            >
                <div>
                    {/* Tabs */}
                    <div className="flex border-b border-[var(--border-light)] dark:border-[var(--border-dark)] mb-6">
                        <button
                            className={`flex-1 pb-2 text-sm font-medium transition-colors 
                                ${activeTab === 'details' ? 'border-b-2 border-[var(--accent)] text-[var(--accent)]' : 'text-gray-500'}
                            `}
                            onClick={() => setActiveTab('details')}
                            type="button"
                        >
                            1. Details
                        </button>
                        <button
                            className={`flex-1 pb-2 text-sm font-medium transition-colors 
                                ${activeTab === 'contacts' ? 'border-b-2 border-[var(--accent)] text-[var(--accent)]' : 'text-gray-500'}
                                ${!isDetailsValid ? 'opacity-50 cursor-not-allowed' : 'hover:text-[var(--text-light)]'}
                            `}
                            onClick={() => {
                                if (isDetailsValid) setActiveTab('contacts');
                            }}
                            disabled={!isDetailsValid}
                            type="button"
                        >
                            2. Contacts
                        </button>
                        <button
                            className={`flex-1 pb-2 text-sm font-medium transition-colors 
                                ${activeTab === 'pricing' ? 'border-b-2 border-[var(--accent)] text-[var(--accent)]' : 'text-gray-500'}
                                ${!isDetailsValid || !isContactsValid ? 'opacity-50 cursor-not-allowed' : 'hover:text-[var(--text-light)]'}
                            `}
                            onClick={() => {
                                if (isDetailsValid && isContactsValid) setActiveTab('pricing');
                            }}
                            disabled={!isDetailsValid || !isContactsValid}
                            type="button"
                        >
                            3. Pricing
                        </button>
                    </div>

                    <form id="community-form" className="space-y-4" onSubmit={handleSubmitCommunity}>
                        
                        {/* TAB 1: DETAILS */}
                        {activeTab === 'details' && (
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="communityName" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Name <span className="text-red-500">*</span></label>
                                    <input type="text" id="communityName" value={communityName} onChange={e => setCommunityName(e.target.value)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"/>
                                </div>
                                <div>
                                    <label htmlFor="communityAddress" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Address <span className="text-red-500">*</span></label>
                                    <input type="text" id="communityAddress" value={communityAddress} onChange={e => setCommunityAddress(e.target.value)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"/>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Community Type <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <select 
                                            value={communityType} 
                                            onChange={(e) => setCommunityType(e.target.value as CommunityType)}
                                            className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] appearance-none"
                                        >
                                            <option value="High-Rise Apartment">High-Rise Apartment</option>
                                            <option value="Standalone Apartment">Standalone Apartment</option>
                                            <option value="Gated Community Villa">Gated Community Villa</option>
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                                            <ChevronDownIcon className="w-4 h-4" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 2: CONTACTS */}
                        {activeTab === 'contacts' && (
                            <div className="space-y-6">
                                <p className="text-sm text-[var(--text-secondary-light)] bg-blue-50 dark:bg-blue-900/20 p-2 rounded text-blue-700 dark:text-blue-300">
                                    At least two contacts are mandatory. All fields marked * are required.
                                </p>
                                {contacts.map((contact, index) => (
                                    <div key={index} className="bg-black/5 dark:bg-white/5 p-4 rounded-lg relative border border-[var(--border-light)] dark:border-[var(--border-dark)]">
                                        <h4 className="text-sm font-bold mb-3 text-[var(--text-light)] dark:text-[var(--text-dark)] Contact Person {index + 1}">Contact Person {index + 1}</h4>
                                        {contacts.length > 1 && (
                                            <button 
                                                type="button" 
                                                onClick={() => removeContact(index)}
                                                className="absolute top-3 right-3 text-red-500 hover:text-red-700"
                                                title="Remove Contact"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                        
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium mb-1 text-[var(--text-secondary-light)]">Name <span className="text-red-500">*</span></label>
                                                <input 
                                                    type="text" 
                                                    value={contact.name} 
                                                    onChange={e => updateContact(index, 'name', e.target.value)}
                                                    className="block w-full px-2 py-1.5 text-sm border rounded bg-transparent"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium mb-1 text-[var(--text-secondary-light)]">Email <span className="text-red-500">*</span></label>
                                                <input 
                                                    type="email" 
                                                    value={contact.email} 
                                                    onChange={e => updateContact(index, 'email', e.target.value)}
                                                    className="block w-full px-2 py-1.5 text-sm border rounded bg-transparent"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium mb-1 text-[var(--text-secondary-light)]">Primary Phone <span className="text-red-500">*</span></label>
                                                <input 
                                                    type="tel" 
                                                    value={contact.primaryPhone} 
                                                    onChange={e => updateContact(index, 'primaryPhone', e.target.value)}
                                                    className="block w-full px-2 py-1.5 text-sm border rounded bg-transparent"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium mb-1 text-[var(--text-secondary-light)]">Secondary Phone</label>
                                                <input 
                                                    type="tel" 
                                                    value={contact.secondaryPhone} 
                                                    onChange={e => updateContact(index, 'secondaryPhone', e.target.value)}
                                                    className="block w-full px-2 py-1.5 text-sm border rounded bg-transparent"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <button 
                                    type="button" 
                                    onClick={addContact} 
                                    className="w-full py-2 border-2 border-dashed border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-lg text-sm text-[var(--text-secondary-light)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors flex items-center justify-center gap-2"
                                >
                                    <PlusIcon className="w-4 h-4" /> New Contact
                                </button>
                            </div>
                        )}

                        {/* TAB 3: PRICING */}
                        {activeTab === 'pricing' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Subscription Type</label>
                                        <div className="relative">
                                            <select 
                                                value={subscriptionType} 
                                                onChange={(e) => setSubscriptionType(e.target.value as 'Monthly' | 'Yearly')}
                                                className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] appearance-none"
                                            >
                                                <option value="Monthly">Monthly</option>
                                                <option value="Yearly">Yearly</option>
                                            </select>
                                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                                                <ChevronDownIcon className="w-4 h-4" />
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Effective Start Date</label>
                                        <input 
                                            type="date" 
                                            value={subscriptionStartDate} 
                                            onChange={e => setSubscriptionStartDate(e.target.value)} 
                                            required 
                                            className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent"
                                        />
                                    </div>
                                </div>

                                <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-lg border border-[var(--border-light)] dark:border-[var(--border-dark)] mt-4">
                                    <h4 className="font-bold text-sm mb-3 text-[var(--text-light)] dark:text-[var(--text-dark)] uppercase tracking-wide">Price Per User (₹)</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium mb-1 text-[var(--text-secondary-light)]">Resident <span className="text-red-500">*</span></label>
                                            <input 
                                                type="number" 
                                                min="0"
                                                value={pricing.resident} 
                                                onChange={e => setPricing({...pricing, resident: parseFloat(e.target.value) || 0})}
                                                className="block w-full px-2 py-1.5 text-sm border rounded bg-transparent"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium mb-1 text-[var(--text-secondary-light)]">Admin <span className="text-red-500">*</span></label>
                                            <input 
                                                type="number" 
                                                min="0"
                                                value={pricing.admin} 
                                                onChange={e => setPricing({...pricing, admin: parseFloat(e.target.value) || 0})}
                                                className="block w-full px-2 py-1.5 text-sm border rounded bg-transparent"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium mb-1 text-[var(--text-secondary-light)]">Staff <span className="text-red-500">*</span></label>
                                            <input 
                                                type="number" 
                                                min="0"
                                                value={pricing.staff} 
                                                onChange={e => setPricing({...pricing, staff: parseFloat(e.target.value) || 0})}
                                                className="block w-full px-2 py-1.5 text-sm border rounded bg-transparent"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </form>
                </div>
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

            {/* Feedback Modal */}
            <Modal 
                isOpen={feedbackModal.isOpen} 
                onClose={() => setFeedbackModal(prev => ({ ...prev, isOpen: false }))} 
                title={feedbackModal.title}
                size="md"
            >
                <div className="space-y-4">
                     <div className={`p-4 rounded-lg flex items-start gap-3 ${
                         feedbackModal.type === 'success' 
                         ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' 
                         : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
                     }`}>
                        {feedbackModal.type === 'success' ? (
                            <CheckCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        ) : (
                            <AlertTriangleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        )}
                        <p className="text-sm">{feedbackModal.message}</p>
                     </div>
                     <div className="flex justify-end">
                        <Button onClick={() => setFeedbackModal(prev => ({ ...prev, isOpen: false }))}>
                            OK
                        </Button>
                     </div>
                </div>
            </Modal>
        </div>
    );
};

export default AdminPanel;