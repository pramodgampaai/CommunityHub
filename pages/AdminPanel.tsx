
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
import ConfirmationModal from '../components/ui/ConfirmationModal';
import Spinner from '../components/ui/Spinner';
import ProfileModal from '../components/ProfileModal';
import Logo from '../components/ui/Logo';
import { useScreen } from '../hooks/useScreen';

const AdminPanel: React.FC = () => {
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

    // Confirmation Modal State
    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        action: () => Promise<void>;
        isDestructive?: boolean;
        confirmLabel?: string;
    }>({
        isOpen: false,
        title: '',
        message: '',
        action: async () => {},
        isDestructive: false
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

        const payload: any = {
            name: communityName,
            address: communityAddress,
            communityType,
            contacts,
            subscriptionType,
            subscriptionStartDate,
            pricePerUser: pricing
        };

        try {
            if (isEditMode && selectedCommunity) {
                // When editing, do NOT send empty blocks array to preserve landscape structure
                // Blocks are managed by community admin in setup, not here.
                await updateCommunity(selectedCommunity.id, payload);
            } else {
                // When creating, initialize empty blocks
                payload.blocks = []; 
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
    
    const handleDeleteCommunity = (community: CommunityStat) => {
        setConfirmConfig({
            isOpen: true,
            title: "Delete Community",
            message: `Are you sure you want to permanently delete "${community.name}"? This will wipe ALL related data including users, payments, and history. This action cannot be undone.`,
            confirmLabel: "Yes, Delete Everything",
            isDestructive: true,
            action: async () => {
                await deleteCommunity(community.id);
                await fetchData();
                setFeedbackModal({
                    isOpen: true,
                    title: 'Deleted',
                    message: `${community.name} has been deleted successfully.`,
                    type: 'success'
                });
            }
        });
    };

    const handleConfirmAction = async () => {
        setIsSubmitting(true);
        try {
            await confirmConfig.action();
            setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        } catch (error: any) {
            setFeedbackModal({
                isOpen: true,
                title: 'Error',
                message: error.message || "Failed to perform action.",
                type: 'error'
            });
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
                    <span className="text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Staff:</span>
                    <span className="font-medium">{stat.helpdesk_count} Helpdesk, {stat.security_count} Security</span>
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
                <Button size="sm" variant="outlined" className="text-red-500 border-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => handleDeleteCommunity(stat)}>
                    Delete
                </Button>
                <Button size="sm" variant="outlined" onClick={() => openEditCommunityModal(stat)}>
                    Edit
                </Button>
                <Button size="sm" onClick={() => openAddAdminModal(stat)}>
                    Add Admin
                </Button>
            </div>
        </Card>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div className="flex items-start gap-3">
                    <div className="w-1 h-10 bg-brand-500 rounded-full mt-1" />
                    <div>
                        <span className="text-[9px] font-mono font-black uppercase tracking-[0.3em] text-brand-600 dark:text-brand-400 mb-0.5 block">Organization Management</span>
                        <h2 className="text-2xl sm:text-3xl font-brand font-extrabold text-brand-600 tracking-tight leading-tight">Communities</h2>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button onClick={openCreateCommunityModal} leftIcon={<PlusIcon className="w-5 h-5" />}>
                        {isMobile ? 'Create' : 'Create Community'}
                    </Button>
                </div>
            </div>

            {loading && <div className="flex justify-center p-8"><Spinner /></div>}
            {error && <div className="text-red-500 bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">Error: {error}</div>}
            
            {!loading && !error && (
                isMobile ? (
                    <div className="space-y-4">
                        {stats.map(stat => renderMobileCommunityCard(stat))}
                    </div>
                ) : (
                    <Card className="overflow-x-auto animated-card p-0 border border-slate-50 dark:border-white/5">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5">
                                <tr>
                                    <th className="p-5 text-[9px] font-black uppercase tracking-widest text-slate-400">Community Identity</th>
                                    <th className="p-5 text-[9px] font-black uppercase tracking-widest text-slate-400">Architecture</th>
                                    <th className="p-5 text-[9px] font-black uppercase tracking-widest text-slate-400">Billing Cycle</th>
                                    <th className="p-5 text-[9px] font-black uppercase tracking-widest text-slate-400">Operational Status</th>
                                    <th className="p-5 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                                {stats.map(stat => (
                                    <tr key={stat.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors group">
                                        <td className="p-5">
                                            <div className="font-brand font-extrabold text-base text-slate-900 dark:text-slate-50">{stat.name}</div>
                                            <div className="text-[10px] text-slate-400 font-medium mt-1 uppercase tracking-tight">{stat.address}</div>
                                        </td>
                                        <td className="p-5">
                                            <div className="text-xs font-bold text-slate-700 dark:text-zinc-300">{stat.communityType || 'N/A'}</div>
                                            <div className="text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-widest flex gap-2">
                                                <span>{stat.resident_count} Residents</span>
                                                <span>•</span>
                                                <span>{stat.staff_count} Staff</span>
                                            </div>
                                        </td>
                                        <td className="p-5 text-xs font-bold text-slate-700 dark:text-zinc-300">
                                            {stat.subscriptionType || 'Monthly'}
                                            {stat.subscriptionStartDate && (
                                                <div className="text-[9px] text-brand-600 dark:text-brand-400 font-black mt-1 uppercase tracking-widest">
                                                    Eff: {new Date(stat.subscriptionStartDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-5">
                                            <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-md ${
                                                stat.status === 'active' 
                                                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300' 
                                                    : 'bg-rose-50 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300'
                                            }`}>
                                                {stat.status}
                                            </span>
                                        </td>
                                        <td className="p-5 text-right space-x-1">
                                            <button 
                                                onClick={() => openEditCommunityModal(stat)}
                                                className="text-slate-400 hover:text-brand-600 transition-colors p-2"
                                                title="Edit Details"
                                            >
                                                <PencilIcon className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteCommunity(stat)}
                                                className="text-slate-400 hover:text-rose-600 transition-colors p-2"
                                                title="Delete Community"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                            <Button size="sm" variant="outlined" onClick={() => openAddAdminModal(stat)}>+ Admin</Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                )
            )}

             <Modal 
                isOpen={isCommunityModalOpen} 
                onClose={() => setCommunityModalOpen(false)} 
                title={isEditMode ? "Update Community" : "Create Community"}
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
                                    Next Phase
                                </Button>
                             ) : (
                                <Button type="submit" form="community-form" disabled={isSubmitting || !isPricingValid} leftIcon={<CheckCircleIcon />}>
                                    {isEditMode ? 'Commit Changes' : 'Authorize Community'}
                                </Button>
                             )}
                        </div>
                    </div>
                }
            >
                <div>
                    <div className="flex border-b border-slate-100 dark:border-white/5 mb-6">
                        <button
                            className={`flex-1 pb-3 text-[10px] font-black uppercase tracking-widest transition-all 
                                ${activeTab === 'details' ? 'border-b-2 border-brand-600 text-brand-600' : 'text-slate-400'}
                            `}
                            onClick={() => setActiveTab('details')}
                            type="button"
                        >
                            1. Foundation
                        </button>
                        <button
                            className={`flex-1 pb-3 text-[10px] font-black uppercase tracking-widest transition-all 
                                ${activeTab === 'contacts' ? 'border-b-2 border-brand-600 text-brand-600' : 'text-slate-400'}
                                ${!isDetailsValid ? 'opacity-50 cursor-not-allowed' : 'hover:text-brand-600'}
                            `}
                            onClick={() => {
                                if (isDetailsValid) setActiveTab('contacts');
                            }}
                            disabled={!isDetailsValid}
                            type="button"
                        >
                            2. Stakeholders
                        </button>
                        <button
                            className={`flex-1 pb-3 text-[10px] font-black uppercase tracking-widest transition-all 
                                ${activeTab === 'pricing' ? 'border-b-2 border-brand-600 text-brand-600' : 'text-slate-400'}
                                ${!isDetailsValid || !isContactsValid ? 'opacity-50 cursor-not-allowed' : 'hover:text-brand-600'}
                            `}
                            onClick={() => {
                                if (isDetailsValid && isContactsValid) setActiveTab('pricing');
                            }}
                            disabled={!isDetailsValid || !isContactsValid}
                            type="button"
                        >
                            3. Subscription
                        </button>
                    </div>

                    <form id="community-form" className="space-y-4" onSubmit={handleSubmitCommunity}>
                        {activeTab === 'details' && (
                            <div className="space-y-4 animate-fadeIn">
                                <div>
                                    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Community Identity Name</label>
                                    <input type="text" value={communityName} onChange={e => setCommunityName(e.target.value)} required placeholder="e.g. Prestige Lakeview" className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold"/>
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Geographic Address</label>
                                    <input type="text" value={communityAddress} onChange={e => setCommunityAddress(e.target.value)} required placeholder="Primary Street, City" className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold"/>
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Architecture Profile</label>
                                    <div className="relative">
                                        <select 
                                            value={communityType} 
                                            onChange={(e) => setCommunityType(e.target.value as CommunityType)}
                                            className="block w-full px-4 py-3 rounded-xl input-field text-xs font-bold appearance-none bg-white dark:bg-zinc-900"
                                        >
                                            <option value="High-Rise Apartment">High-Rise Apartment</option>
                                            <option value="Standalone Apartment">Standalone Apartment</option>
                                            <option value="Gated Community Villa">Gated Community Villa</option>
                                        </select>
                                        <ChevronDownIcon className="absolute right-3 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'contacts' && (
                            <div className="space-y-6 animate-fadeIn">
                                <div className="p-4 bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-900/30 rounded-2xl flex items-start gap-3">
                                    <AlertTriangleIcon className="w-5 h-5 text-brand-600 mt-0.5 shrink-0" />
                                    <p className="text-[10px] font-bold text-brand-800 dark:text-brand-300 uppercase tracking-widest leading-relaxed">System requirement: Minimum 2 authorized stakeholders for auditing.</p>
                                </div>
                                {contacts.map((contact, index) => (
                                    <div key={index} className="bg-slate-50 dark:bg-white/5 p-5 rounded-2xl relative border border-slate-100 dark:border-white/5 shadow-sm">
                                        <div className="flex justify-between items-center mb-4">
                                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Representative {index + 1}</h4>
                                            {contacts.length > 1 && (
                                                <button type="button" onClick={() => removeContact(index)} className="text-rose-500 hover:bg-rose-50 p-1 rounded-lg transition-colors"><TrashIcon className="w-4 h-4" /></button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1">Authorized Name</label>
                                                <input type="text" value={contact.name} onChange={e => updateContact(index, 'name', e.target.value)} className="block w-full px-3 py-2 text-sm font-bold input-field rounded-lg" required/>
                                            </div>
                                            <div>
                                                <label className="block text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1">Email Interface</label>
                                                <input type="email" value={contact.email} onChange={e => updateContact(index, 'email', e.target.value)} className="block w-full px-3 py-2 text-sm font-bold input-field rounded-lg" required/>
                                            </div>
                                            <div>
                                                <label className="block text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1">Primary Phone</label>
                                                <input type="tel" value={contact.primaryPhone} onChange={e => updateContact(index, 'primaryPhone', e.target.value)} className="block w-full px-3 py-2 text-sm font-bold input-field rounded-lg" required/>
                                            </div>
                                            <div>
                                                <label className="block text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1">Backup Phone</label>
                                                <input type="tel" value={contact.secondaryPhone} onChange={e => updateContact(index, 'secondaryPhone', e.target.value)} className="block w-full px-3 py-2 text-sm font-bold input-field rounded-lg"/>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <Button type="button" variant="outlined" onClick={addContact} className="w-full h-12 border-dashed text-[10px]" leftIcon={<PlusIcon />}>Add Stakeholder</Button>
                            </div>
                        )}

                        {activeTab === 'pricing' && (
                            <div className="space-y-6 animate-fadeIn">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Subscription Model</label>
                                        <div className="relative">
                                            <select value={subscriptionType} onChange={(e) => setSubscriptionType(e.target.value as 'Monthly' | 'Yearly')} className="block w-full px-4 py-3 rounded-xl input-field text-xs font-bold appearance-none bg-white dark:bg-zinc-900">
                                                <option value="Monthly">Monthly</option>
                                                <option value="Yearly">Yearly</option>
                                            </select>
                                            <ChevronDownIcon className="absolute right-3 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Effective Start Date</label>
                                        <input type="date" value={subscriptionStartDate} onChange={e => setSubscriptionStartDate(e.target.value)} required className="block w-full px-4 py-3 rounded-xl input-field text-xs font-bold"/>
                                    </div>
                                </div>

                                <Card className="p-6 bg-slate-50 dark:bg-zinc-900/40 border-none rounded-2xl">
                                    <h4 className="font-black text-[10px] mb-4 text-slate-400 uppercase tracking-[0.2em]">Platform Fee Configuration (₹)</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                        <div>
                                            <label className="block text-[8px] font-bold mb-1 text-slate-400 uppercase tracking-widest text-center">Resident / Unit</label>
                                            <input type="number" value={pricing.resident} onChange={e => setPricing({...pricing, resident: parseFloat(e.target.value) || 0})} className="block w-full px-3 py-2 text-xl text-center font-black text-brand-600 bg-white dark:bg-black/20 rounded-xl border-none shadow-sm focus:ring-2 focus:ring-brand-500"/>
                                        </div>
                                        <div>
                                            <label className="block text-[8px] font-bold mb-1 text-slate-400 uppercase tracking-widest text-center">Administrative ID</label>
                                            <input type="number" value={pricing.admin} onChange={e => setPricing({...pricing, admin: parseFloat(e.target.value) || 0})} className="block w-full px-3 py-2 text-xl text-center font-black text-brand-600 bg-white dark:bg-black/20 rounded-xl border-none shadow-sm focus:ring-2 focus:ring-brand-500"/>
                                        </div>
                                        <div>
                                            <label className="block text-[8px] font-bold mb-1 text-slate-400 uppercase tracking-widest text-center">Staff Identity</label>
                                            <input type="number" value={pricing.staff} onChange={e => setPricing({...pricing, staff: parseFloat(e.target.value) || 0})} className="block w-full px-3 py-2 text-xl text-center font-black text-brand-600 bg-white dark:bg-black/20 rounded-xl border-none shadow-sm focus:ring-2 focus:ring-brand-500"/>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        )}
                    </form>
                </div>
            </Modal>

            <Modal isOpen={isAddAdminModalOpen} onClose={() => setAddAdminModalOpen(false)} title="Provision Admin" subtitle={selectedCommunity?.name.toUpperCase()}>
                 <form className="space-y-4" onSubmit={handleAddAdmin}>
                    <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Legal Name</label>
                        <input type="text" value={newAdminName} onChange={e => setNewAdminName(e.target.value)} required placeholder="e.g. Property Manager" className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold"/>
                    </div>
                     <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Interface Email</label>
                        <input type="email" value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} required placeholder="admin@community.com" className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold"/>
                    </div>
                     <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Initialization Key (Temporary)</label>
                        <input type="password" value={newAdminPassword} onChange={e => setNewAdminPassword(e.target.value)} required placeholder="••••••••" className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold"/>
                    </div>
                    <div className="flex justify-end pt-4 gap-3">
                        <Button type="button" variant="outlined" onClick={() => setAddAdminModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting} leftIcon={<CheckCircleIcon />}>{isSubmitting ? 'Provisioning...' : 'Assign Property Admin'}</Button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={feedbackModal.isOpen} onClose={() => setFeedbackModal(prev => ({ ...prev, isOpen: false }))} title={feedbackModal.title} size="md">
                <div className="space-y-8">
                     <div className={`p-8 rounded-[2.5rem] flex flex-col items-center text-center gap-4 border ${
                         feedbackModal.type === 'success' 
                         ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/20 text-emerald-800 dark:text-emerald-200' 
                         : 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/20 text-rose-800 dark:text-red-200'
                     }`}>
                        <div className="p-3 bg-white dark:bg-black/20 rounded-2xl shadow-sm">
                            {feedbackModal.type === 'success' ? <CheckCircleIcon className="w-8 h-8 text-emerald-600 dark:text-emerald-400" /> : <AlertTriangleIcon className="w-8 h-8 text-rose-600 dark:text-rose-400" />}
                        </div>
                        <p className="text-base font-semibold leading-relaxed">{feedbackModal.message}</p>
                     </div>
                     <div className="flex justify-center px-2">
                        <Button onClick={() => setFeedbackModal(prev => ({ ...prev, isOpen: false }))} className="w-full" size="lg">Acknowledge</Button>
                     </div>
                </div>
            </Modal>

            <ConfirmationModal isOpen={confirmConfig.isOpen} onClose={() => setConfirmConfig({ ...confirmConfig, isOpen: false })} onConfirm={handleConfirmAction} title={confirmConfig.title} message={confirmConfig.message} isDestructive={confirmConfig.isDestructive} confirmLabel={confirmConfig.confirmLabel} isLoading={isSubmitting} />
        </div>
    );
};

export default AdminPanel;
