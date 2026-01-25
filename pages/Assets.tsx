
import React, { useState, useEffect, useMemo } from 'react';
import { getAssets, createAsset, updateAsset, deleteAsset, getCachedData } from '../services/api';
import type { Asset } from '../types';
import { AssetStatus, UserRole } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import Modal from '../components/ui/Modal';
import FeedbackModal from '../components/ui/FeedbackModal';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import AuditLogModal from '../components/AuditLogModal';
import { useAuth } from '../hooks/useAuth';
import { 
    PlusIcon, 
    MagnifyingGlassIcon, 
    TrashIcon, 
    PencilIcon, 
    CheckCircleIcon, 
    AlertTriangleIcon, 
    ClockIcon, 
    ClipboardDocumentCheckIcon, 
    ChevronDownIcon, 
    CalendarIcon,
    HistoryIcon
} from '../components/icons';

const Assets: React.FC = () => {
    const { user } = useAuth();
    const cacheKey = `assets:${user?.communityId}`;
    const [assets, setAssets] = useState<Asset[]>(() => getCachedData(cacheKey) || []);
    const [loading, setLoading] = useState(!getCachedData(cacheKey));
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'all' | 'maintenance'>('all');
    
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isAuditOpen, setIsAuditOpen] = useState(false);
    const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });
    
    // Form state
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('General');
    const [quantity, setQuantity] = useState(1);
    const [status, setStatus] = useState<AssetStatus>(AssetStatus.Active);
    const [purchaseDate, setPurchaseDate] = useState('');
    const [warrantyExpiry, setWarrantyExpiry] = useState('');
    const [nextServiceDate, setNextServiceDate] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [feedback, setFeedback] = useState<{ isOpen: boolean; type: 'success' | 'error' | 'info'; title: string; message: string }>({
        isOpen: false, type: 'success', title: '', message: ''
    });

    const isAdmin = user?.role === UserRole.Admin || user?.role === UserRole.SuperAdmin;

    const fetchAssetsData = async () => {
        if (!user?.communityId) return;
        try {
            const data = await getAssets(user.communityId);
            setAssets(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAssetsData(); }, [user]);

    const resetForm = () => {
        setName('');
        setDescription('');
        setCategory('General');
        setQuantity(1);
        setStatus(AssetStatus.Active);
        setPurchaseDate('');
        setWarrantyExpiry('');
        setNextServiceDate('');
        setEditingAsset(null);
    };

    const handleEdit = (asset: Asset) => {
        setEditingAsset(asset);
        setName(asset.name);
        setDescription(asset.description);
        setCategory(asset.category);
        setQuantity(asset.quantity);
        setStatus(asset.status);
        setPurchaseDate(asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().split('T')[0] : '');
        setWarrantyExpiry(asset.warrantyExpiry ? new Date(asset.warrantyExpiry).toISOString().split('T')[0] : '');
        setNextServiceDate(asset.nextServiceDate ? new Date(asset.nextServiceDate).toISOString().split('T')[0] : '');
        setIsFormOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.communityId) return;
        setIsSubmitting(true);
        try {
            const payload = {
                name, description, category, quantity, status,
                purchaseDate: purchaseDate || undefined,
                warrantyExpiry: warrantyExpiry || undefined,
                nextServiceDate: nextServiceDate || undefined,
                communityId: user.communityId
            };

            if (editingAsset) {
                await updateAsset(editingAsset.id, payload);
                setFeedback({ isOpen: true, type: 'success', title: 'Asset Updated', message: `Details for "${name}" have been saved.` });
            } else {
                await createAsset(payload, user.communityId);
                setFeedback({ isOpen: true, type: 'success', title: 'Asset Registered', message: `"${name}" has been added to the registry.` });
            }
            setIsFormOpen(false);
            resetForm();
            await fetchAssetsData();
        } catch (err: any) {
            setFeedback({ isOpen: true, type: 'error', title: 'System Error', message: err.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredAssets = useMemo(() => {
        let result = assets.filter(a => 
            a.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
            a.category.toLowerCase().includes(searchQuery.toLowerCase())
        );
        
        if (activeTab === 'maintenance') {
            const now = new Date();
            const horizon = new Date();
            horizon.setDate(now.getDate() + 30); // 30 day window

            result = result.filter(a => {
                const nextS = a.nextServiceDate ? new Date(a.nextServiceDate) : null;
                const isNear = nextS && nextS <= horizon && nextS >= now;
                return isNear || a.status === AssetStatus.UnderRepair;
            });
        }
        return result;
    }, [assets, searchQuery, activeTab]);

    const categories = ['Furniture', 'Electrical', 'Plumbing', 'Security', 'Gym', 'Pool', 'Landscaping', 'General'];

    return (
        <div className="space-y-6 pb-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 min-h-[5rem]">
                <div className="flex items-start gap-2.5">
                    <div className="w-1 h-10 bg-brand-500 rounded-full mt-1" />
                    <div>
                        <span className="text-[9px] font-mono font-black uppercase tracking-[0.3em] text-brand-600 dark:text-brand-400 mb-0.5 block">Inventory Registry</span>
                        <h1 className="text-2xl sm:text-3xl font-brand font-extrabold text-brand-600 dark:text-brand-400 tracking-tight leading-tight">Assets</h1>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => setIsAuditOpen(true)} variant="outlined" size="md" leftIcon={<HistoryIcon />}>Audit Log</Button>
                    {isAdmin && <Button onClick={() => { resetForm(); setIsFormOpen(true); }} size="md" leftIcon={<PlusIcon />}>Register Asset</Button>}
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white dark:bg-zinc-900/40 p-4 rounded-[2rem] border border-slate-50 dark:border-white/5 shadow-sm">
                <div className="relative flex-1 w-full">
                    <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Search registry by name or category..." 
                        value={searchQuery} 
                        onChange={e => setSearchQuery(e.target.value)} 
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl input-field text-sm font-bold shadow-sm" 
                    />
                </div>
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-black/20 p-1.5 rounded-2xl w-full sm:w-auto">
                    <button 
                        onClick={() => setActiveTab('all')} 
                        className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'all' ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400'}`}
                    >
                        Full Log
                    </button>
                    <button 
                        onClick={() => setActiveTab('maintenance')} 
                        className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'maintenance' ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400'}`}
                    >
                        Service Queue
                    </button>
                </div>
            </div>

            {loading && assets.length === 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-48 bg-slate-100 dark:bg-white/5 rounded-3xl animate-pulse" />)}
                </div>
            ) : filteredAssets.length === 0 ? (
                <div className="py-24 text-center border-2 border-dashed border-slate-100 dark:border-white/5 rounded-[3rem] opacity-30">
                    <ClipboardDocumentCheckIcon className="w-16 h-16 mx-auto mb-4" />
                    <p className="font-brand font-extrabold text-xl">Registry Clear</p>
                    <p className="text-xs font-bold uppercase tracking-widest mt-1">No matching assets found</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredAssets.map(asset => (
                        <Card key={asset.id} className="p-0 overflow-hidden bg-white dark:bg-zinc-900/40 border border-slate-50 dark:border-white/5 group shadow-sm flex flex-col rounded-[2rem]">
                            <div className="p-6 flex flex-col flex-1">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-2 py-0.5 bg-slate-50 dark:bg-white/5 rounded-md w-fit">
                                            {asset.category}
                                        </span>
                                        <h3 className="text-xl font-brand font-extrabold text-slate-900 dark:text-slate-50 leading-tight group-hover:text-brand-600 transition-colors">
                                            {asset.name}
                                        </h3>
                                    </div>
                                    <div className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase shadow-sm ${
                                        asset.status === AssetStatus.Active ? 'bg-emerald-50 text-emerald-600' : 
                                        asset.status === AssetStatus.UnderRepair ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
                                    }`}>
                                        {asset.status}
                                    </div>
                                </div>
                                
                                <p className="text-sm text-slate-500 dark:text-zinc-400 font-medium line-clamp-2 leading-relaxed mb-6">
                                    {asset.description}
                                </p>

                                <div className="mt-auto space-y-3">
                                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                                            Qty: <span className="text-slate-900 dark:text-slate-100 font-black">{asset.quantity}</span>
                                        </div>
                                        {asset.nextServiceDate && (
                                            <div className="flex items-center gap-1.5">
                                                <ClockIcon className="w-3.5 h-3.5" />
                                                Next Service: <span className="text-brand-600">{new Date(asset.nextServiceDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                            </div>
                                        )}
                                    </div>

                                    {isAdmin && (
                                        <div className="pt-4 border-t border-slate-50 dark:border-white/5 flex gap-2">
                                            <button 
                                                onClick={() => handleEdit(asset)}
                                                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-brand-600 rounded-xl transition-all font-black text-[9px] uppercase tracking-widest"
                                            >
                                                <PencilIcon className="w-4 h-4" /> Edit Details
                                            </button>
                                            <button 
                                                onClick={() => setConfirmDelete({ isOpen: true, id: asset.id })}
                                                className="p-2.5 bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-rose-500 rounded-xl transition-all"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Registration/Edit Modal */}
            <Modal 
                isOpen={isFormOpen} 
                onClose={() => { setIsFormOpen(false); resetForm(); }} 
                title={editingAsset ? "Modify Asset" : "Register Asset"} 
                subtitle="INVENTORY MANAGEMENT"
                size="lg"
            >
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="sm:col-span-2">
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Asset Name</label>
                            <input 
                                type="text" 
                                value={name} 
                                onChange={e => setName(e.target.value)} 
                                required 
                                placeholder="e.g. Lobby Air Conditioner" 
                                className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold"
                            />
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Category</label>
                            <div className="relative">
                                <select 
                                    value={category} 
                                    onChange={e => setCategory(e.target.value)} 
                                    className="block w-full px-4 py-3 rounded-xl input-field text-xs font-bold appearance-none bg-white dark:bg-zinc-900"
                                >
                                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                                <ChevronDownIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Quantity</label>
                            <input 
                                type="number" 
                                value={quantity} 
                                onChange={e => setQuantity(parseInt(e.target.value) || 1)} 
                                required 
                                min="1"
                                className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold"
                            />
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Current Status</label>
                            <div className="relative">
                                <select 
                                    value={status} 
                                    onChange={e => setStatus(e.target.value as AssetStatus)} 
                                    className="block w-full px-4 py-3 rounded-xl input-field text-xs font-bold appearance-none bg-white dark:bg-zinc-900"
                                >
                                    {Object.values(AssetStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <ChevronDownIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Next Service Date</label>
                            <div className="relative">
                                <input 
                                    type="date" 
                                    value={nextServiceDate} 
                                    onChange={e => setNextServiceDate(e.target.value)} 
                                    className="block w-full px-4 py-3 rounded-xl input-field text-xs font-bold"
                                />
                                <CalendarIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Description / Location Details</label>
                            <textarea 
                                value={description} 
                                onChange={e => setDescription(e.target.value)} 
                                rows={3} 
                                placeholder="Describe where it is located or specific model details..." 
                                className="block w-full px-4 py-3 rounded-xl input-field text-sm font-medium leading-relaxed"
                            />
                        </div>
                    </div>

                    <div className="pt-6 border-t border-slate-50 dark:border-white/5 flex justify-end gap-3">
                        <Button type="button" variant="ghost" onClick={() => setIsFormOpen(false)}>Discard</Button>
                        <Button type="submit" disabled={isSubmitting} leftIcon={isSubmitting ? <Spinner /> : <CheckCircleIcon />}>
                            {isSubmitting ? 'Saving...' : (editingAsset ? 'Update Asset' : 'Complete Registration')}
                        </Button>
                    </div>
                </form>
            </Modal>

            <ConfirmationModal 
                isOpen={confirmDelete.isOpen} 
                onClose={() => setConfirmDelete({ isOpen: false, id: null })} 
                onConfirm={async () => {
                    if (confirmDelete.id) {
                        await deleteAsset(confirmDelete.id);
                        setConfirmDelete({ isOpen: false, id: null });
                        await fetchAssetsData();
                        setFeedback({ isOpen: true, type: 'success', title: 'Asset Decommissioned', message: 'The item has been removed from the community registry.' });
                    }
                }}
                title="Decommission Asset"
                message="Are you sure you want to remove this item? This action is irreversible and will be logged in the audit trail."
                isDestructive
                confirmLabel="Remove Asset"
            />

            <AuditLogModal 
                isOpen={isAuditOpen} 
                onClose={() => setIsAuditOpen(false)} 
                entityType="Asset" 
                title="Inventory Audit" 
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

export default Assets;
