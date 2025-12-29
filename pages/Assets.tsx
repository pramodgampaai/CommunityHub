
import React, { useState, useEffect, useMemo } from 'react';
import { getAssets, createAsset, updateAsset, deleteAsset } from '../services/api';
import type { Asset } from '../types';
import { AssetStatus, UserRole } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import Modal from '../components/ui/Modal';
import FeedbackModal from '../components/ui/FeedbackModal';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import { useAuth } from '../hooks/useAuth';
import { PlusIcon, MagnifyingGlassIcon, TrashIcon, PencilIcon, CheckCircleIcon, AlertTriangleIcon, ClockIcon, ClipboardDocumentCheckIcon, ChevronDownIcon, CalendarIcon } from '../components/icons';

const Assets: React.FC = () => {
    const { user } = useAuth();
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'all' | 'maintenance'>('all');
    
    // Modal States
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });
    
    // Form States
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('Furniture');
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
            setLoading(true);
            const data = await getAssets(user.communityId);
            setAssets(data);
        } catch (e) {
            console.error("Asset fetch failed", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAssetsData(); }, [user]);

    const resetForm = () => {
        setName('');
        setDescription('');
        setCategory('Furniture');
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
        setPurchaseDate(asset.purchaseDate || '');
        setWarrantyExpiry(asset.warrantyExpiry || '');
        setNextServiceDate(asset.nextServiceDate || '');
        setIsFormOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.communityId) return;
        setIsSubmitting(true);
        
        try {
            const payload = { name, description, category, quantity, status, purchaseDate, warrantyExpiry, nextServiceDate };
            if (editingAsset) {
                await updateAsset(editingAsset.id, payload);
                setFeedback({ isOpen: true, type: 'success', title: 'Asset Updated', message: 'The asset configuration has been successfully modified.' });
            } else {
                await createAsset(payload, user.communityId);
                setFeedback({ isOpen: true, type: 'success', title: 'Asset Registered', message: 'A new entity has been added to the community registry.' });
            }
            setIsFormOpen(false);
            resetForm();
            await fetchAssetsData();
        } catch (err: any) {
            setFeedback({ isOpen: true, type: 'error', title: 'Action Failed', message: err.message || 'Error syncing with database.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!confirmDelete.id) return;
        setIsSubmitting(true);
        try {
            await deleteAsset(confirmDelete.id);
            setConfirmDelete({ isOpen: false, id: null });
            await fetchAssetsData();
            setFeedback({ isOpen: true, type: 'success', title: 'Asset Excised', message: 'The item has been permanently removed from the community manifest.' });
        } catch (err: any) {
            setFeedback({ isOpen: true, type: 'error', title: 'Deletion Error', message: err.message });
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
            result = result.filter(a => {
                const nextS = a.nextServiceDate ? new Date(a.nextServiceDate) : null;
                const warnDate = new Date(); warnDate.setMonth(warnDate.getMonth() + 1);
                return (nextS && nextS <= warnDate) || a.status === AssetStatus.UnderRepair;
            });
        }
        return result;
    }, [assets, searchQuery, activeTab]);

    const getStatusColor = (s: AssetStatus) => {
        switch(s) {
            case AssetStatus.Active: return 'bg-emerald-500';
            case AssetStatus.UnderRepair: return 'bg-amber-500';
            case AssetStatus.Scrapped: return 'bg-rose-500';
            default: return 'bg-slate-300';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
                <div className="flex items-start gap-2.5">
                    <div className="w-1 h-10 bg-brand-500 rounded-full mt-1" />
                    <div>
                        <span className="text-[8px] font-mono font-black uppercase tracking-[0.3em] text-brand-600 dark:text-brand-400 mb-0.5 block">Inventory Registry</span>
                        <h1 className="text-2xl sm:text-3xl font-brand font-extrabold text-brand-600 tracking-tight">Community Assets</h1>
                    </div>
                </div>
                {isAdmin && (
                    <Button onClick={() => { resetForm(); setIsFormOpen(true); }} size="md" leftIcon={<PlusIcon />}>Register Asset</Button>
                )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white dark:bg-zinc-900/40 p-4 rounded-[2rem] border border-slate-50 dark:border-white/5 shadow-sm">
                <div className="relative flex-1 w-full">
                    <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Search registry..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl input-field text-sm font-bold shadow-sm"
                    />
                </div>
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-black/20 p-1.5 rounded-2xl w-full sm:w-auto">
                    <button onClick={() => setActiveTab('all')} className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'all' ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400'}`}>Full Log</button>
                    <button onClick={() => setActiveTab('maintenance')} className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'maintenance' ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400'}`}>Service Queue</button>
                </div>
            </div>

            {loading ? (
                <div className="py-20 flex justify-center"><Spinner /></div>
            ) : filteredAssets.length === 0 ? (
                <div className="p-20 text-center border-2 border-dashed border-slate-100 dark:border-white/5 rounded-[3rem] opacity-40">
                    <ClipboardDocumentCheckIcon className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                    <p className="text-sm font-black uppercase tracking-widest text-slate-400">Registry is empty</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredAssets.map(asset => {
                        const nextS = asset.nextServiceDate ? new Date(asset.nextServiceDate) : null;
                        const isOverdue = nextS && nextS < new Date();
                        const isNearing = nextS && !isOverdue && (nextS.getTime() - new Date().getTime() < 14 * 24 * 60 * 60 * 1000);

                        return (
                            <Card key={asset.id} className="p-0 overflow-hidden bg-white dark:bg-zinc-900/40 border border-slate-50 dark:border-white/5 group shadow-sm flex flex-col">
                                <div className="p-5 flex-1">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${getStatusColor(asset.status)}`} />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{asset.category}</span>
                                        </div>
                                        <div className="px-2 py-1 bg-brand-50 dark:bg-brand-900/30 text-brand-600 rounded-lg text-[9px] font-black uppercase">Qty: {asset.quantity}</div>
                                    </div>
                                    <h3 className="text-xl font-brand font-extrabold text-slate-900 dark:text-slate-50 mb-1 leading-tight group-hover:text-brand-600 transition-colors">{asset.name}</h3>
                                    <p className="text-xs text-slate-500 font-medium line-clamp-2 leading-relaxed">{asset.description}</p>
                                    
                                    <div className="mt-5 space-y-2.5">
                                        {asset.nextServiceDate && (
                                            <div className={`flex items-center justify-between p-2.5 rounded-xl border ${isOverdue ? 'bg-rose-50 border-rose-100 text-rose-700 dark:bg-rose-900/10 dark:border-rose-900/30' : isNearing ? 'bg-amber-50 border-amber-100 text-amber-700 dark:bg-amber-900/10 dark:border-amber-900/30' : 'bg-slate-50 dark:bg-white/5 border-transparent text-slate-500'}`}>
                                                <div className="flex items-center gap-2">
                                                    <ClockIcon className="w-3.5 h-3.5" />
                                                    <span className="text-[9px] font-black uppercase tracking-widest">Next Service</span>
                                                </div>
                                                <span className="text-[10px] font-bold">{new Date(asset.nextServiceDate).toLocaleDateString()}</span>
                                            </div>
                                        )}
                                        {asset.warrantyExpiry && (
                                            <div className="flex items-center justify-between px-2.5 py-1 text-slate-400">
                                                <div className="flex items-center gap-2">
                                                    <CalendarIcon className="w-3 h-3" />
                                                    <span className="text-[8px] font-black uppercase tracking-widest">Warranty Ends</span>
                                                </div>
                                                <span className="text-[9px] font-bold">{new Date(asset.warrantyExpiry).toLocaleDateString()}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                {isAdmin && (
                                    <div className="flex border-t border-slate-50 dark:border-white/5 bg-slate-50/50 dark:bg-black/10">
                                        <button onClick={() => handleEdit(asset)} className="flex-1 py-3.5 flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-brand-600 hover:bg-white dark:hover:bg-zinc-800 transition-all border-r border-slate-100 dark:border-white/5">
                                            <PencilIcon className="w-3.5 h-3.5" /> Configure
                                        </button>
                                        <button onClick={() => setConfirmDelete({ isOpen: true, id: asset.id })} className="flex-1 py-3.5 flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-rose-600 hover:bg-white dark:hover:bg-zinc-800 transition-all">
                                            <TrashIcon className="w-3.5 h-3.5" /> Excise
                                        </button>
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}

            <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title={editingAsset ? "Update Registry" : "Asset Registration"} subtitle="LOGISTICS & LIFECYCLE" size="lg">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Asset Identity</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Cummins 500kVA Generator" className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold"/>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Quantity Profile</label>
                            <input type="number" value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 1)} required min="1" className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold"/>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Functional Category</label>
                            <div className="relative">
                                <select value={category} onChange={e => setCategory(e.target.value)} className="block w-full px-4 py-3 rounded-xl input-field text-xs font-bold appearance-none bg-white dark:bg-zinc-900">
                                    <option value="Furniture">Furniture & Fittings</option>
                                    <option value="Machinery">Machinery & Plants</option>
                                    <option value="Electrical">Electrical / Lighting</option>
                                    <option value="Safety">Safety & Fire Systems</option>
                                    <option value="Elevators">Vertical Transit (Lifts)</option>
                                    <option value="Other">Miscellaneous</option>
                                </select>
                                <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-black/20 p-5 rounded-3xl border border-slate-100 dark:border-white/5 space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 ml-1">Lifecycle Tracking</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1">Purchase Date</label>
                                <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} className="block w-full px-3 py-2.5 rounded-lg input-field text-xs font-bold"/>
                            </div>
                            <div>
                                <label className="block text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1">Warranty Maturity</label>
                                <input type="date" value={warrantyExpiry} onChange={e => setWarrantyExpiry(e.target.value)} className="block w-full px-3 py-2.5 rounded-lg input-field text-xs font-bold"/>
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1">Next Periodic Service / Checkup</label>
                                <input type="date" value={nextServiceDate} onChange={e => setNextServiceDate(e.target.value)} className="block w-full px-3 py-2.5 rounded-lg input-field text-xs font-bold ring-2 ring-brand-500/20"/>
                                <p className="text-[8px] text-slate-400 mt-2 ml-1 italic">Authorized: Set a yearly or quarterly follow-up date for maintenance.</p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Operational State</label>
                        <div className="grid grid-cols-3 gap-3">
                            {Object.values(AssetStatus).map(s => (
                                <button 
                                    key={s} 
                                    type="button"
                                    onClick={() => setStatus(s)}
                                    className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border-2 transition-all ${status === s ? 'border-brand-600 bg-brand-50 text-brand-600 dark:bg-brand-900/20' : 'border-slate-50 dark:border-white/5 text-slate-400'}`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="pt-2 flex justify-end gap-3">
                        <Button type="button" variant="outlined" size="lg" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting} size="lg" className="px-10" leftIcon={<CheckCircleIcon />}>{isSubmitting ? 'Syncing...' : (editingAsset ? 'Update Asset' : 'Commit to Registry')}</Button>
                    </div>
                </form>
            </Modal>

            <ConfirmationModal isOpen={confirmDelete.isOpen} onClose={() => setConfirmDelete({ isOpen: false, id: null })} onConfirm={handleDelete} title="Excise Asset" message="Are you sure you want to permanently remove this asset from the community manifest?" isDestructive isLoading={isSubmitting} confirmLabel="Yes, Excise Item" />
            <FeedbackModal isOpen={feedback.isOpen} onClose={() => setFeedback({ ...feedback, isOpen: false })} title={feedback.title} message={feedback.message} type={feedback.type} />
        </div>
    );
};

export default Assets;
