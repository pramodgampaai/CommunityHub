import React, { useState, useEffect, useMemo } from 'react';
import { 
    getMarketplaceItems, 
    createMarketplaceItem, 
    updateMarketplaceItemStatus, 
    getMarketplaceMessages, 
    sendMarketplaceMessage,
    markMarketplaceMessagesRead,
    getRealEstateListings,
    createRealEstateListing,
    updateRealEstateStatus,
    getCachedData 
} from '../services/api';
import type { MarketplaceItem, MarketplaceMessage, RealEstateListing } from '../types';
import { MarketplaceItemStatus, MarketplaceCategory, UserRole } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import FeedbackModal from '../components/ui/FeedbackModal';
import { 
    PlusIcon, 
    MagnifyingGlassIcon, 
    ShoppingBagIcon, 
    ChatBubbleOvalLeftEllipsisIcon, 
    CheckCircleIcon, 
    ChevronDownIcon, 
    ArrowRightIcon, 
    ClockIcon, 
    HistoryIcon,
    IdentificationIcon,
    TagIcon,
    CameraIcon,
    XMarkIcon,
    UserIcon,
    EnvelopeIcon,
    HomeIcon,
    Squares2X2Icon,
    CalendarIcon,
    ShieldCheckIcon,
    SparklesIcon
} from '../components/icons';
import { useAuth } from '../hooks/useAuth';
import { GoogleGenAI } from "@google/genai";

const CategoryBadge: React.FC<{ category: MarketplaceCategory }> = ({ category }) => {
    const styles: Record<MarketplaceCategory, string> = {
        [MarketplaceCategory.Electronics]: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
        [MarketplaceCategory.Furniture]: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
        [MarketplaceCategory.Apparel]: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
        [MarketplaceCategory.Groceries]: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
        [MarketplaceCategory.Appliances]: 'bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400',
        [MarketplaceCategory.Vehicles]: 'bg-slate-50 text-slate-600 dark:bg-slate-900/20 dark:text-slate-400',
        [MarketplaceCategory.Other]: 'bg-gray-50 text-gray-600 dark:bg-gray-900/20 dark:text-gray-400',
    };
    return <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded-md ${styles[category] || styles[MarketplaceCategory.Other]}`}>{category}</span>;
}

const Marketplace: React.FC = () => {
    const { user } = useAuth();
    const cacheKey = `marketplace:${user?.communityId}`;
    const cacheKeyRE = `real_estate:${user?.communityId}`;
    
    const [viewMode, setViewMode] = useState<'items' | 'rentals'>('items');
    const [items, setItems] = useState<MarketplaceItem[]>(() => getCachedData(cacheKey) || []);
    const [rentals, setRentals] = useState<RealEstateListing[]>(() => getCachedData(cacheKeyRE) || []);
    const [messages, setMessages] = useState<MarketplaceMessage[]>([]);
    const [loading, setLoading] = useState(!getCachedData(cacheKey));
    const [activeTab, setActiveTab] = useState<'shop' | 'activity' | 'history'>('shop');
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('All');

    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isCreateRentalOpen, setIsCreateRentalOpen] = useState(false);
    const [isMessageCenterOpen, setIsMessageCenterOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<MarketplaceItem | null>(null);
    const [selectedRental, setSelectedRental] = useState<RealEstateListing | null>(null);
    const [activeBuyerId, setActiveBuyerId] = useState<string | null>(null);

    // Form State (Items)
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [category, setCategory] = useState<MarketplaceCategory>(MarketplaceCategory.Other);
    const [imageUrl, setImageUrl] = useState('');
    const [chatMessage, setChatMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);

    // Form State (Rentals)
    const [selectedUnitId, setSelectedUnitId] = useState('');
    const [rentAmount, setRentAmount] = useState('');
    const [depositAmount, setDepositAmount] = useState('');
    const [availableFrom, setAvailableFrom] = useState(new Date().toISOString().split('T')[0]);
    const [furnishing, setFurnishing] = useState<'Unfurnished' | 'Semi-furnished' | 'Fully-furnished'>('Unfurnished');

    const [feedback, setFeedback] = useState<{ isOpen: boolean; type: 'success' | 'error' | 'info'; title: string; message: string }>({
        isOpen: false, type: 'success', title: '', message: ''
    });

    const fetchData = async () => {
        if (!user?.communityId) return;
        try {
            const [itemsData, msgData, reData] = await Promise.all([
                getMarketplaceItems(user.communityId),
                getMarketplaceMessages(user.id),
                getRealEstateListings(user.communityId)
            ]);
            setItems(itemsData);
            setMessages(msgData);
            setRentals(reData);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [user]);

    const generateAIDescription = async () => {
        if (!selectedUnitId) {
            setFeedback({ isOpen: true, type: 'info', title: 'Missing Unit', message: 'Please select a unit first so the AI knows the specifications.' });
            return;
        }

        const unit = user?.units?.find(u => u.id === selectedUnitId);
        if (!unit) return;

        setIsGeneratingAI(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `Generate a catchy, inviting, and professional real estate rental description for a residential unit. 
                Unit Specifications:
                - Size: ${unit.flatSize} SqFt
                - Location: ${unit.block || 'Main'} Block, Floor ${unit.floor}
                - Furnishing: ${furnishing}
                - User Notes: ${description || 'None provided'}
                
                The description should be concise (max 3 sentences) and highlight that it is an "Owner-Direct" listing within the Nilayam community.`,
            });
            
            if (response.text) {
                setDescription(response.text.trim());
                setFeedback({ isOpen: true, type: 'success', title: 'AI Assistant', message: 'Professional description generated successfully!' });
            }
        } catch (err: any) {
            console.error("Gemini Error:", err);
            setFeedback({ isOpen: true, type: 'error', title: 'AI Offline', message: 'Could not reach the AI assistant. Please try manually.' });
        } finally {
            setIsGeneratingAI(false);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 1 * 1024 * 1024) {
                setFeedback({ isOpen: true, type: 'error', title: 'Limit Exceeded', message: 'Images must be under 1MB.' });
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => setImageUrl(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleCreateItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setIsSubmitting(true);
        try {
            await createMarketplaceItem({ title, description, price: parseFloat(price), category, imageUrl }, user);
            setFeedback({ isOpen: true, type: 'success', title: 'Listing Live', message: 'Your item is now visible to all neighbors.' });
            setIsCreateModalOpen(false);
            setTitle(''); setDescription(''); setPrice(''); setImageUrl('');
            await fetchData();
        } catch (err: any) {
            setFeedback({ isOpen: true, type: 'error', title: 'Posting Failed', message: err.message });
        } finally { setIsSubmitting(false); }
    };

    const handleCreateRental = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !selectedUnitId) return;
        setIsSubmitting(true);
        try {
            await createRealEstateListing({
                unitId: selectedUnitId,
                rentAmount: parseFloat(rentAmount),
                depositAmount: parseFloat(depositAmount),
                availableFrom,
                furnishingStatus: furnishing,
                description,
                imageUrl
            });
            setFeedback({ isOpen: true, type: 'success', title: 'Rental Listed', message: 'Your property is now advertised to all residents.' });
            setIsCreateRentalOpen(false);
            setSelectedUnitId(''); setRentAmount(''); setDepositAmount(''); setImageUrl('');
            await fetchData();
        } catch (err: any) {
            setFeedback({ isOpen: true, type: 'error', title: 'Listing Failed', message: err.message });
        } finally { setIsSubmitting(false); }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || (!selectedItem && !selectedRental) || !chatMessage.trim()) return;
        
        const ownerId = selectedItem ? selectedItem.sellerId : selectedRental?.ownerId;
        const isOwner = ownerId === user.id;
        const receiverId = isOwner ? activeBuyerId : ownerId;
        
        if (!receiverId) return;

        setIsSubmitting(true);
        try {
            await sendMarketplaceMessage({
                itemId: selectedItem?.id,
                rentalId: selectedRental?.id,
                receiverId,
                message: chatMessage
            }, user);
            setChatMessage('');
            await fetchData();
        } catch (err: any) {
            setFeedback({ isOpen: true, type: 'error', title: 'Error', message: err.message });
        } finally { setIsSubmitting(false); }
    };

    const markAsSold = async (id: string) => {
        setIsSubmitting(true);
        try {
            await updateMarketplaceItemStatus(id, MarketplaceItemStatus.Sold);
            setFeedback({ isOpen: true, type: 'success', title: 'Success', message: 'Item marked as sold.' });
            await fetchData();
        } catch (err: any) {
            setFeedback({ isOpen: true, type: 'error', title: 'Error', message: err.message });
        } finally { setIsSubmitting(false); }
    };

    const markAsLeased = async (id: string) => {
        setIsSubmitting(true);
        try {
            await updateRealEstateStatus(id, 'Leased');
            setFeedback({ isOpen: true, type: 'success', title: 'Success', message: 'Property marked as leased.' });
            await fetchData();
        } catch (err: any) {
            setFeedback({ isOpen: true, type: 'error', title: 'Error', message: err.message });
        } finally { setIsSubmitting(false); }
    };

    const filteredHubList = useMemo(() => {
        if (viewMode === 'items') {
            return items.filter(item => {
                const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || item.description.toLowerCase().includes(searchQuery.toLowerCase());
                const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
                if (!matchesSearch || !matchesCategory) return false;
                if (activeTab === 'shop') return item.status === MarketplaceItemStatus.Active && item.sellerId !== user?.id;
                if (activeTab === 'activity') return item.sellerId === user?.id && item.status === MarketplaceItemStatus.Active;
                if (activeTab === 'history') return item.status === MarketplaceItemStatus.Sold && (item.sellerId === user?.id || messages.some(m => m.itemId === item.id));
                return true;
            });
        } else {
            return rentals.filter(r => {
                const matchesSearch = r.description.toLowerCase().includes(searchQuery.toLowerCase()) || (r.unitFlat && r.unitFlat.toLowerCase().includes(searchQuery.toLowerCase()));
                if (!matchesSearch) return false;
                if (activeTab === 'shop') return r.status === 'Active' && r.ownerId !== user?.id;
                if (activeTab === 'activity') return r.ownerId === user?.id && r.status === 'Active';
                if (activeTab === 'history') return r.status === 'Leased' && (r.ownerId === user?.id || messages.some(m => m.rentalId === r.id));
                return true;
            });
        }
    }, [items, rentals, searchQuery, categoryFilter, activeTab, user, messages, viewMode]);

    const unreadCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        messages.forEach(m => {
            if (!m.isRead && m.receiverId === user?.id) {
                const key = m.itemId || m.rentalId || 'general';
                counts[key] = (counts[key] || 0) + 1;
            }
        });
        return counts;
    }, [messages, user]);

    return (
        <div className="space-y-6 pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 min-h-[5rem]">
                <div className="flex items-start gap-2.5">
                    <div className="w-1 h-10 bg-brand-500 rounded-full mt-1" />
                    <div>
                        <span className="text-[9px] font-mono font-black uppercase tracking-[0.3em] text-brand-600 dark:text-brand-400 mb-0.5 block">Community Hub</span>
                        <h1 className="text-2xl sm:text-3xl font-brand font-extrabold text-brand-600 dark:text-brand-400 tracking-tight leading-tight">Marketplace</h1>
                    </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-xl flex-1 sm:flex-none">
                        <button onClick={() => setViewMode('items')} className={`flex-1 px-4 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${viewMode === 'items' ? 'bg-white dark:bg-zinc-800 text-brand-600 shadow-sm' : 'text-slate-400'}`}>Items</button>
                        <button onClick={() => setViewMode('rentals')} className={`flex-1 px-4 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${viewMode === 'rentals' ? 'bg-white dark:bg-zinc-800 text-brand-600 shadow-sm' : 'text-slate-400'}`}>Rentals</button>
                    </div>
                    <Button onClick={() => viewMode === 'items' ? setIsCreateModalOpen(true) : setIsCreateRentalOpen(true)} size="md" leftIcon={<PlusIcon />}>List {viewMode === 'items' ? 'Item' : 'Rental'}</Button>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 bg-white dark:bg-zinc-900/40 p-4 rounded-[2.5rem] border border-slate-50 dark:border-white/5 shadow-sm">
                <div className="relative flex-1 w-full">
                    <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder={viewMode === 'items' ? "Search for gadgets, furniture, or toys..." : "Search for block, flat or description..."} 
                        value={searchQuery} 
                        onChange={e => setSearchQuery(e.target.value)} 
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl input-field text-sm font-bold shadow-sm" 
                    />
                </div>
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-black/20 p-1.5 rounded-2xl w-full sm:w-auto">
                    <button onClick={() => setActiveTab('shop')} className={`flex-1 sm:flex-none px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'shop' ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400'}`}>Explore</button>
                    <button onClick={() => setActiveTab('activity')} className={`flex-1 sm:flex-none px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'activity' ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400'}`}>My Listings</button>
                    <button onClick={() => setActiveTab('history')} className={`flex-1 sm:flex-none px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400'}`}>Archived</button>
                </div>
            </div>

            {loading ? <div className="flex justify-center p-20"><Spinner /></div> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredHubList.length === 0 ? (
                        <div className="col-span-full py-24 text-center border-2 border-dashed border-slate-100 dark:border-white/5 rounded-[3rem] opacity-30">
                            <ShoppingBagIcon className="w-16 h-16 mx-auto mb-4" />
                            <p className="font-brand font-extrabold text-xl text-slate-500">Hub Registry Clear</p>
                        </div>
                    ) : filteredHubList.map(item => (
                        <Card key={item.id} className="p-0 overflow-hidden bg-white dark:bg-zinc-900/40 border border-slate-50 dark:border-white/5 shadow-premium hover:shadow-xl transition-all group flex flex-col rounded-[2.5rem]">
                            <div className="h-56 relative bg-slate-50 dark:bg-black/20 overflow-hidden">
                                {item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={item.title || "Listing"} /> : (
                                    <div className="w-full h-full flex items-center justify-center opacity-10">
                                        <ShoppingBagIcon className="w-20 h-20" />
                                    </div>
                                )}
                                <div className="absolute top-4 left-4 flex gap-2">
                                    {viewMode === 'items' ? <CategoryBadge category={(item as MarketplaceItem).category} /> : <span className="bg-indigo-50 text-indigo-600 text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest">Property</span>}
                                </div>
                            </div>
                            <div className="p-6 flex flex-col flex-1">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="text-lg font-brand font-extrabold text-slate-900 dark:text-slate-50 leading-tight truncate">{viewMode === 'items' ? (item as MarketplaceItem).title : `Unit ${(item as RealEstateListing).unitFlat}`}</h3>
                                    <p className="text-xl font-brand font-black text-brand-600">₹{(viewMode === 'items' ? (item as MarketplaceItem).price : (item as RealEstateListing).rentAmount).toLocaleString()}</p>
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium line-clamp-2 leading-relaxed mb-6">
                                    {item.description}
                                </p>
                                <div className="mt-auto space-y-4">
                                    <div className="flex items-center justify-between border-t border-slate-50 dark:border-white/5 pt-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-lg bg-brand-500/10 flex items-center justify-center font-black text-brand-600 text-[9px] shadow-inner">{(viewMode === 'items' ? (item as MarketplaceItem).sellerName : (item as RealEstateListing).ownerName)?.[0]}</div>
                                            <div>
                                                <p className="text-[9px] font-black text-slate-800 dark:text-zinc-200 uppercase">{(viewMode === 'items' ? (item as MarketplaceItem).sellerName : (item as RealEstateListing).ownerName)}</p>
                                                <p className="text-[8px] font-bold text-slate-400 uppercase">Unit: {(viewMode === 'items' ? (item as MarketplaceItem).sellerFlat : (item as RealEstateListing).unitFlat)}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        {activeTab === 'shop' && (
                                            <Button 
                                                onClick={() => {
                                                    if (viewMode === 'items') setSelectedItem(item as MarketplaceItem);
                                                    else setSelectedRental(item as RealEstateListing);
                                                    setIsMessageCenterOpen(true);
                                                }}
                                                className="flex-1 text-[9px] uppercase tracking-widest font-black"
                                                variant="filled"
                                                leftIcon={<ChatBubbleOvalLeftEllipsisIcon />}
                                            >
                                                Interested
                                            </Button>
                                        )}
                                        {activeTab === 'activity' && (
                                            <>
                                                <Button 
                                                    onClick={() => {
                                                        if (viewMode === 'items') setSelectedItem(item as MarketplaceItem);
                                                        else setSelectedRental(item as RealEstateListing);
                                                        setIsMessageCenterOpen(true);
                                                    }}
                                                    className="flex-1 text-[9px] uppercase tracking-widest font-black"
                                                    variant="outlined"
                                                    leftIcon={<EnvelopeIcon />}
                                                >
                                                    Enquiries {unreadCounts[item.id] > 0 && `(${unreadCounts[item.id]})`}
                                                </Button>
                                                <Button 
                                                    onClick={() => viewMode === 'items' ? markAsSold(item.id) : markAsLeased(item.id)}
                                                    className="p-3 bg-emerald-500 hover:bg-emerald-600 border-none"
                                                    size="md"
                                                    disabled={isSubmitting}
                                                    leftIcon={isSubmitting ? <Spinner /> : <CheckCircleIcon />}
                                                >
                                                    <span className="sr-only">Mark as Settled</span>
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* List Item Modal */}
            <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Marketplace Listing" subtitle="NEIGHBORHOOD TRADE">
                <form onSubmit={handleCreateItem} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Item Headline</label>
                            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Ergonomic Office Chair" className="rounded-xl input-field text-sm font-bold"/>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Price (₹)</label>
                            <input type="number" value={price} onChange={e => setPrice(e.target.value)} required placeholder="0.00" className="rounded-xl input-field text-sm font-bold"/>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Category</label>
                            <select value={category} onChange={e => setCategory(e.target.value as MarketplaceCategory)} className="rounded-xl input-field text-xs font-bold">
                                {Object.values(MarketplaceCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Image (Max 1MB)</label>
                            <div className="mt-1 flex items-center gap-4">
                                <div className="w-16 h-16 rounded-xl bg-slate-50 dark:bg-black/20 border-2 border-dashed border-slate-200 dark:border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                                    {imageUrl ? <img src={imageUrl} className="w-full h-full object-cover" /> : <CameraIcon className="w-6 h-6 text-slate-300" />}
                                </div>
                                <input type="file" accept="image/*" onChange={handleImageUpload} className="block w-full text-[10px] text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[9px] file:font-black file:uppercase file:bg-brand-50 file:text-brand-600 cursor-pointer"/>
                            </div>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Item Narrative</label>
                            <textarea value={description} onChange={e => setDescription(e.target.value)} required rows={3} placeholder="Tell neighbors about the condition, usage, etc." className="rounded-xl input-field text-sm font-medium leading-relaxed"/>
                        </div>
                    </div>
                    <div className="pt-4 flex justify-end gap-3 border-t border-slate-50 dark:border-white/5">
                        <Button variant="ghost" type="button" onClick={() => setIsCreateModalOpen(false)}>Discard</Button>
                        <Button type="submit" disabled={isSubmitting} leftIcon={isSubmitting ? <Spinner /> : <CheckCircleIcon />}>{isSubmitting ? 'Syncing...' : 'Publish Listing'}</Button>
                    </div>
                </form>
            </Modal>

            {/* Advertise Rental Modal */}
            <Modal isOpen={isCreateRentalOpen} onClose={() => setIsCreateRentalOpen(false)} title="Advertise Rental" subtitle="OWNER DIRECT" size="lg">
                <form onSubmit={handleCreateRental} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="sm:col-span-2">
                            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1.5 ml-1">Select Property</label>
                            <div className="relative">
                                <select 
                                    value={selectedUnitId} 
                                    onChange={e => setSelectedUnitId(e.target.value)} 
                                    required 
                                    className="block w-full px-4 py-3 rounded-xl input-field text-xs font-bold appearance-none bg-white dark:bg-zinc-900"
                                >
                                    <option value="">Choose your registered unit...</option>
                                    {user?.units?.map(u => (
                                        <option key={u.id} value={u.id}>{u.block ? `${u.block} - ` : ''}{u.flatNumber} ({u.flatSize} SqFt)</option>
                                    ))}
                                </select>
                                <ChevronDownIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1.5 ml-1">Monthly Rent (₹)</label>
                            <input type="number" value={rentAmount} onChange={e => setRentAmount(e.target.value)} required placeholder="e.g. 25000" className="rounded-xl input-field text-sm font-bold"/>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1.5 ml-1">Security Deposit (₹)</label>
                            <input type="number" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} required placeholder="e.g. 150000" className="rounded-xl input-field text-sm font-bold"/>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1.5 ml-1">Availability Date</label>
                            <div className="relative">
                                <input type="date" value={availableFrom} onChange={e => setAvailableFrom(e.target.value)} required className="rounded-xl input-field text-xs font-bold appearance-none bg-white dark:bg-zinc-900"/>
                                <CalendarIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1.5 ml-1">Furnishing Status</label>
                            <div className="relative">
                                <select 
                                    value={furnishing} 
                                    onChange={e => setFurnishing(e.target.value as any)} 
                                    className="rounded-xl input-field text-xs font-bold appearance-none bg-white dark:bg-zinc-900"
                                >
                                    <option value="Unfurnished">Unfurnished</option>
                                    <option value="Semi-furnished">Semi-furnished</option>
                                    <option value="Fully-furnished">Fully-furnished</option>
                                </select>
                                <ChevronDownIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>

                        <div className="sm:col-span-2">
                             <div className="flex items-center justify-between mb-1.5 ml-1">
                                <label className="block text-[9px] font-black uppercase text-slate-400">Marketing Description</label>
                                <button 
                                    type="button" 
                                    onClick={generateAIDescription}
                                    disabled={isGeneratingAI || !selectedUnitId}
                                    className="flex items-center gap-1.5 px-3 py-1 bg-brand-50 text-brand-600 rounded-full text-[8px] font-black uppercase tracking-widest hover:bg-brand-100 transition-colors disabled:opacity-50"
                                >
                                    {isGeneratingAI ? <Spinner className="w-3 h-3" /> : <SparklesIcon className="w-3 h-3" />}
                                    Generate AI Description
                                </button>
                            </div>
                            <textarea 
                                value={description} 
                                onChange={e => setDescription(e.target.value)} 
                                required 
                                rows={4} 
                                placeholder="Highlight key features like park facing, balcony view, etc." 
                                className="rounded-2xl input-field text-sm font-medium leading-relaxed resize-none"
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3 border-t border-slate-50 dark:border-white/5">
                        <Button variant="ghost" type="button" onClick={() => setIsCreateRentalOpen(false)}>Discard</Button>
                        <Button type="submit" disabled={isSubmitting} leftIcon={isSubmitting ? <Spinner /> : <CheckCircleIcon />}>
                            {isSubmitting ? 'Syncing...' : 'Advertise Rental'}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Message Center / Enquiry Modal */}
            <Modal 
                isOpen={isMessageCenterOpen} 
                onClose={() => { setIsMessageCenterOpen(false); setSelectedItem(null); setSelectedRental(null); setActiveBuyerId(null); }} 
                title={(selectedItem ? selectedItem.title : (selectedRental ? `Rental Unit ${selectedRental.unitFlat}` : 'Enquiry Center'))} 
                subtitle="RESIDENT DIALOGUE"
                size="lg"
            >
                {(selectedItem || selectedRental) && (
                    <div className="flex flex-col h-[500px]">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 overflow-hidden">
                            {/* Buyer Sidebar (Only for owner/activity tab) */}
                            {activeTab === 'activity' && (
                                <div className="md:col-span-4 border-r border-slate-50 dark:border-white/5 pr-4 overflow-y-auto no-scrollbar">
                                    <p className="text-[8px] font-black uppercase text-slate-400 mb-3 tracking-widest px-2">Enquiries</p>
                                    <div className="space-y-2">
                                        {Array.from(new Set(messages.filter(m => (selectedItem ? m.itemId === selectedItem.id : m.rentalId === selectedRental?.id)).map(m => m.senderId === user?.id ? m.receiverId : m.senderId))).map(buddyId => {
                                            const lastMsg = [...messages].reverse().find(m => (selectedItem ? m.itemId === selectedItem.id : m.rentalId === selectedRental?.id) && (m.senderId === buddyId || m.receiverId === buddyId));
                                            const unread = messages.filter(m => (selectedItem ? m.itemId === selectedItem.id : m.rentalId === selectedRental?.id) && m.senderId === buddyId && !m.isRead).length;
                                            
                                            return (
                                                <button 
                                                    key={buddyId} 
                                                    onClick={() => {
                                                        setActiveBuyerId(buddyId);
                                                        markMarketplaceMessagesRead(selectedItem?.id || null, buddyId, selectedRental?.id || null).then(fetchData);
                                                    }}
                                                    className={`w-full p-3 rounded-2xl text-left transition-all ${activeBuyerId === buddyId ? 'bg-brand-50 dark:bg-brand-900/20 border border-brand-100' : 'hover:bg-slate-50 dark:hover:bg-white/5 border border-transparent'}`}
                                                >
                                                    <div className="flex justify-between items-center mb-1">
                                                        <p className="text-[10px] font-black text-slate-800 dark:text-zinc-200 uppercase truncate pr-2">{lastMsg?.senderId === user?.id ? lastMsg?.receiverId.substring(0, 8) : lastMsg?.senderName}</p>
                                                        {unread > 0 && <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shadow-[0_0_8px_#14b8a6]" />}
                                                    </div>
                                                    <p className="text-[9px] text-slate-400 font-medium truncate">Flat: {lastMsg?.senderId === user?.id ? 'Prospective' : lastMsg?.senderFlat}</p>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Chat Area */}
                            <div className={`${activeTab === 'activity' ? 'md:col-span-8' : 'md:col-span-12'} flex flex-col overflow-hidden`}>
                                <div className="flex-1 overflow-y-auto space-y-3 p-2 no-scrollbar bg-slate-50/50 dark:bg-black/10 rounded-2xl border border-slate-100/50 dark:border-white/5">
                                    {(activeTab === 'shop' || activeBuyerId) ? messages
                                        .filter(m => {
                                            const itemMatch = selectedItem ? m.itemId === selectedItem.id : m.rentalId === selectedRental?.id;
                                            if (!itemMatch) return false;
                                            if (activeTab === 'shop') return true;
                                            return m.senderId === activeBuyerId || m.receiverId === activeBuyerId;
                                        })
                                        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                                        .map(m => {
                                            const isMe = m.senderId === user?.id;
                                            return (
                                                <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                                    <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl shadow-sm text-sm ${isMe ? 'bg-brand-600 text-white rounded-tr-none' : 'bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-100 dark:border-white/5 rounded-tl-none'}`}>
                                                        <p className="leading-relaxed font-medium">{m.message}</p>
                                                        <p className={`text-[8px] mt-1 font-bold uppercase tracking-tighter ${isMe ? 'text-white/60 text-right' : 'text-slate-400'}`}>
                                                            {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        }) : (
                                        <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-40">
                                            <ChatBubbleOvalLeftEllipsisIcon className="w-12 h-12 mb-3" />
                                            <p className="text-[10px] font-black uppercase tracking-widest">Select an enquiry to view dialogue</p>
                                        </div>
                                    )}
                                </div>

                                {/* Message Input */}
                                <form onSubmit={handleSendMessage} className="mt-4 flex gap-2">
                                    <input 
                                        type="text" 
                                        value={chatMessage} 
                                        onChange={e => setChatMessage(e.target.value)} 
                                        placeholder="Type your message..." 
                                        disabled={activeTab === 'activity' && !activeBuyerId}
                                        className="flex-1 rounded-xl input-field text-sm"
                                    />
                                    <Button 
                                        type="submit" 
                                        disabled={isSubmitting || !chatMessage.trim() || (activeTab === 'activity' && !activeBuyerId)} 
                                        className="w-12 h-12 p-0"
                                        leftIcon={isSubmitting ? <Spinner className="w-5 h-5" /> : <ArrowRightIcon className="w-5 h-5" />}
                                    >
                                        <span className="sr-only">Send Message</span>
                                    </Button>
                                </form>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            <FeedbackModal isOpen={feedback.isOpen} onClose={() => setFeedback({ ...feedback, isOpen: false })} title={feedback.title} message={feedback.message} type={feedback.type} />
        </div>
    );
};

export default Marketplace;