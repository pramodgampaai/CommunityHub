import React, { useState, useEffect } from 'react';
import { getAmenities, createAmenity, updateAmenity, deleteAmenity, createBooking, getBookings, getCachedData } from '../services/api';
import type { Amenity, Booking } from '../types';
import { UserRole } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import Modal from '../components/ui/Modal';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import AuditLogModal from '../components/AuditLogModal';
import FeedbackModal from '../components/ui/FeedbackModal';
import { PlusIcon, HistoryIcon, PencilIcon, TrashIcon, CheckCircleIcon, ClockIcon, AlertTriangleIcon, CalendarIcon, ChevronDownIcon, XIcon, HomeIcon } from '../components/icons';
import { useAuth } from '../hooks/useAuth';

const Amenities: React.FC = () => {
  const { user } = useAuth();
  const cacheKeyA = `amenities:${user?.communityId}`;
  const cacheKeyB = `bookings:${user?.communityId}`;
  
  const [amenities, setAmenities] = useState<Amenity[]>(() => getCachedData(cacheKeyA) || []);
  const [allBookings, setAllBookings] = useState<Booking[]>(() => getCachedData(cacheKeyB) || []);
  const [loading, setLoading] = useState(!getCachedData(cacheKeyA));
  
  const [feedback, setFeedback] = useState<{ isOpen: boolean; type: 'success' | 'error' | 'info'; title: string; message: string }>({
    isOpen: false, type: 'success', title: '', message: ''
  });

  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedAmenity, setSelectedAmenity] = useState<Amenity | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [capacity, setCapacity] = useState('50');
  const [maxDuration, setMaxDuration] = useState('4');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const fetchData = async () => {
    if (user?.communityId) {
        try {
            const [amenityData, bookingData] = await Promise.all([
                getAmenities(user.communityId),
                getBookings(user.communityId)
            ]);
            setAmenities(amenityData);
            setAllBookings(bookingData);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }
  };

  useEffect(() => { fetchData(); }, [user]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        // STRICT SIZE LIMIT: 1MB to prevent Gateway Timeout or 'Failed to fetch' errors
        if (file.size > 1 * 1024 * 1024) {
            setFeedback({ 
                isOpen: true, 
                type: 'error', 
                title: 'Image Too Large', 
                message: "Please select an image smaller than 1MB. High-resolution photos can cause connectivity failures." 
            });
            e.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => setImageUrl(reader.result as string);
        reader.readAsDataURL(file);
    }
  };

  const handleSaveAmenity = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      if (!imageUrl) {
          setFeedback({ isOpen: true, type: 'info', title: 'Data Missing', message: "A facility image is required for registration." });
          return;
      }
      setIsSubmitting(true);
      try {
          const payload = { 
              name, 
              description, 
              imageUrl, 
              capacity: parseInt(capacity), 
              maxDuration: parseInt(maxDuration) || 0 
          };

          if (editingId) await updateAmenity(editingId, payload);
          else await createAmenity(payload, user);

          setIsCreateModalOpen(false);
          resetForm();
          await fetchData();
          setFeedback({ 
              isOpen: true, 
              type: 'success', 
              title: 'Registry Updated', 
              message: `"${name}" has been successfully synchronized with the community database.` 
          });
      } catch (err: any) { 
          let msg = err.message || "An unexpected error occurred.";
          if (msg.includes("Failed to fetch")) {
              msg = "Network connection interrupted or the server rejected a large payload. Try a smaller image.";
          }
          setFeedback({ isOpen: true, type: 'error', title: 'Registry Error', message: msg });
      } finally { setIsSubmitting(false); }
  };

  const handleBooking = async (e: React.FormEvent) => {
      e.preventDefault();
      setBookingError(null);
      if (!user || !selectedAmenity) return;
      const start = new Date(startTime);
      const end = new Date(endTime);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          setBookingError("Please select valid start and end times.");
          return;
      }

      if (end <= start) { 
          setBookingError("End time must be after start time."); 
          return; 
      }
      
      if (selectedAmenity.maxDuration && selectedAmenity.maxDuration > 0) {
          const diffMs = end.getTime() - start.getTime();
          const diffHrs = diffMs / (1000 * 60 * 60);
          if (diffHrs > selectedAmenity.maxDuration) {
              setBookingError(`Max duration for this facility is ${selectedAmenity.maxDuration}h.`);
              return;
          }
      }

      setIsSubmitting(true);
      try {
          await createBooking({ 
              amenityId: selectedAmenity.id, 
              startTime: start.toISOString(), 
              endTime: end.toISOString() 
          }, user);
          setIsBookingModalOpen(false);
          setFeedback({ isOpen: true, type: 'success', title: 'Reservation Confirmed', message: `Booking for ${selectedAmenity.name} secured.` });
          resetBookingForm();
          await fetchData();
      } catch (err: any) { 
          setBookingError(err.message); 
      } finally { 
          setIsSubmitting(false); 
      }
  };

  const resetForm = () => { 
      setName(''); 
      setDescription(''); 
      setImageUrl(''); 
      setCapacity('50'); 
      setMaxDuration('4'); 
      setEditingId(null); 
  };

  const resetBookingForm = () => { 
      setStartTime(''); 
      setEndTime(''); 
      setBookingError(null); 
      setSelectedAmenity(null);
      setIsBookingModalOpen(false);
  };

  const isAdmin = user?.role === UserRole.Admin || user?.role === UserRole.SuperAdmin;

  // Filter bookings for the selected amenity
  const filteredBookings = allBookings
    .filter(b => b.amenityId === selectedAmenity?.id)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 min-h-[5rem]">
        <div className="flex items-start gap-3">
            <div className="w-1 h-10 bg-brand-500 rounded-full mt-1" />
            <div>
                <span className="text-[9px] font-mono font-black uppercase tracking-[0.3em] text-brand-600 dark:text-brand-400 mb-0.5 block">Assets & Facilities</span>
                <h1 className="text-2xl sm:text-3xl font-brand font-extrabold text-brand-600 dark:text-brand-400 tracking-tight leading-tight">Amenities</h1>
            </div>
        </div>
        <div className="flex gap-2">
            <Button onClick={() => setIsAuditOpen(true)} variant="outlined" size="md" leftIcon={<HistoryIcon />}>Audit Log</Button>
            {isAdmin && <Button onClick={() => { resetForm(); setIsCreateModalOpen(true); }} size="md" leftIcon={<PlusIcon />}>Add Facility</Button>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading && amenities.length === 0 ? (
             Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-64 bg-slate-100 dark:bg-white/5 rounded-xl animate-pulse" />)
        ) : (
            amenities.map(amenity => (
                <Card key={amenity.id} className="p-0 flex flex-col overflow-hidden rounded-3xl bg-white dark:bg-zinc-900/40 border border-slate-100 dark:border-white/5 group shadow-sm">
                    <div className="h-48 relative overflow-hidden">
                        {amenity.imageUrl ? (
                            <img src={amenity.imageUrl} alt={amenity.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
                        ) : (
                            <div className="w-full h-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center">
                                <PlusIcon className="w-8 h-8 text-slate-300" />
                            </div>
                        )}
                        <span className="absolute top-4 left-4 bg-brand-600 text-white text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg shadow-lg">
                            {amenity.status || 'Active'}
                        </span>
                    </div>
                    <div className="p-6 flex flex-col flex-grow">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="text-xl font-brand font-extrabold text-slate-900 dark:text-slate-50">{amenity.name}</h3>
                            <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 dark:bg-white/5 px-2 py-1 rounded-md">
                                {amenity.maxDuration || 0}h Limit
                            </div>
                        </div>
                        <p className="text-slate-500 dark:text-zinc-400 text-sm leading-relaxed mb-6 line-clamp-2 font-medium">
                            {amenity.description}
                        </p>
                        <div className="mt-auto flex gap-2">
                            <Button onClick={() => { setSelectedAmenity(amenity); setBookingError(null); setIsBookingModalOpen(true); }} className="flex-1 text-[10px] uppercase tracking-widest font-black" size="md">Reserve</Button>
                            {isAdmin && (
                                <button onClick={() => {
                                    setEditingId(amenity.id);
                                    setName(amenity.name);
                                    setDescription(amenity.description);
                                    setImageUrl(amenity.imageUrl);
                                    setCapacity(amenity.capacity.toString());
                                    setMaxDuration((amenity.maxDuration || 4).toString());
                                    setIsCreateModalOpen(true);
                                }} className="p-2.5 bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-brand-600 rounded-xl transition-all border border-slate-100 dark:border-white/5">
                                    <PencilIcon className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </div>
                </Card>
            ))
        )}
      </div>

      {/* Reservation Modal */}
      <Modal isOpen={isBookingModalOpen} onClose={resetBookingForm} title="Facility Reservation" subtitle={selectedAmenity?.name.toUpperCase()} size="lg">
        <div className="space-y-8">
            <div className="p-4 bg-brand-50/60 dark:bg-brand-900/10 rounded-[1.5rem] border border-brand-100/50 dark:border-brand-900/20 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-brand-500/10 shadow-sm flex items-center justify-center shrink-0">
                    <ClockIcon className="w-7 h-7 text-brand-600" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-brand-600">Policy Check</span>
                        <div className="h-[1px] flex-1 bg-brand-600/10" />
                    </div>
                    <p className="text-[13px] text-brand-700 dark:text-brand-300 font-bold leading-tight">
                        Maximum duration for this facility is {selectedAmenity?.maxDuration} hours per session.
                    </p>
                </div>
            </div>

            <form onSubmit={handleBooking} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Start Time</label>
                        <div className="relative">
                            <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} required className="block w-full px-4 py-3 rounded-xl input-field text-xs font-bold appearance-none"/>
                            <CalendarIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">End Time</label>
                        <div className="relative">
                            <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} required className="block w-full px-4 py-3 rounded-xl input-field text-xs font-bold appearance-none"/>
                            <CalendarIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                </div>

                {bookingError && (
                    <div className="p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-xl text-[10px] font-bold flex items-center gap-2">
                        <AlertTriangleIcon className="w-4 h-4" /> {bookingError}
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-4">
                    <Button variant="ghost" type="button" onClick={resetBookingForm}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting} leftIcon={isSubmitting ? <Spinner /> : <CheckCircleIcon />}>
                        {isSubmitting ? 'Securing...' : 'Confirm Booking'}
                    </Button>
                </div>
            </form>

            <div className="space-y-4 pt-6 border-t border-slate-50 dark:border-white/5">
                <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-brand-500 rounded-full" />
                    <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Upcoming Reservations</h2>
                </div>
                
                <div className="space-y-2 max-h-[240px] overflow-y-auto pr-2 no-scrollbar">
                    {filteredBookings.length === 0 ? (
                        <div className="py-10 text-center border-2 border-dashed border-slate-100 dark:border-white/5 rounded-3xl opacity-30">
                            <CalendarIcon className="w-8 h-8 mx-auto mb-2" />
                            <p className="text-[9px] font-black uppercase tracking-widest">No scheduled bookings</p>
                        </div>
                    ) : (
                        filteredBookings.map(booking => (
                            <div key={booking.id} className="p-4 bg-slate-50/50 dark:bg-white/[0.02] border border-slate-100/50 dark:border-white/5 rounded-2xl flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-9 h-9 rounded-xl bg-brand-50/50 dark:bg-brand-900/20 text-brand-600 flex items-center justify-center">
                                        <ClockIcon className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="text-xs font-bold text-slate-900 dark:text-slate-50">
                                                {new Date(booking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(booking.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                            <span className="w-1 h-1 bg-slate-200 rounded-full" />
                                            <p className="text-[9px] font-black uppercase text-slate-400">
                                                {new Date(booking.startTime).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <p className="text-[9px] font-black uppercase text-brand-600 flex items-center gap-1">
                                                <HomeIcon className="w-3 h-3" /> Unit: {booking.flatNumber}
                                            </p>
                                            <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                            <p className="text-[9px] font-black uppercase text-slate-400">
                                                {booking.residentName}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
      </Modal>

      <Modal isOpen={isCreateModalOpen} onClose={() => { setIsCreateModalOpen(false); resetForm(); }} title={editingId ? "Edit Facility" : "Add Facility"} subtitle="ASSET MANAGEMENT">
        <form onSubmit={handleSaveAmenity} className="space-y-5">
            <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Facility Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Swimming Pool" className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold"/>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Capacity</label>
                    <input type="number" value={capacity} onChange={e => setCapacity(e.target.value)} required className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold"/>
                </div>
                <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Max Session (Hrs)</label>
                    <input type="number" value={maxDuration} onChange={e => setMaxDuration(e.target.value)} required className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold"/>
                </div>
            </div>

            <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Facility Image (Max 1MB)</label>
                <div className="mt-1 flex items-center gap-4">
                    <div className="w-20 h-20 rounded-2xl bg-slate-50 dark:bg-black/20 border-2 border-dashed border-slate-200 dark:border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                        {imageUrl ? <img src={imageUrl} className="w-full h-full object-cover" alt="Preview" /> : <PlusIcon className="w-6 h-6 text-slate-300" />}
                    </div>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="block w-full text-[10px] text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[9px] file:font-black file:uppercase file:bg-brand-50 file:text-brand-600 cursor-pointer"/>
                </div>
            </div>

            <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} required rows={3} placeholder="Briefly describe the facility..." className="block w-full px-4 py-3 rounded-xl input-field text-sm font-medium leading-relaxed"/>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-50 dark:border-white/5">
                {editingId && (
                    <button type="button" onClick={() => {
                        setIsCreateModalOpen(false);
                        setConfirmDelete({ isOpen: true, id: editingId });
                    }} className="text-[10px] font-black uppercase text-rose-500 hover:underline">Decommission Facility</button>
                )}
                <div className="flex gap-3 ml-auto">
                    <Button variant="ghost" type="button" onClick={() => setIsCreateModalOpen(false)}>Discard</Button>
                    <Button type="submit" disabled={isSubmitting} leftIcon={isSubmitting ? <Spinner /> : <CheckCircleIcon />}>{isSubmitting ? 'Syncing...' : (editingId ? 'Update Facility' : 'Register Facility')}</Button>
                </div>
            </div>
        </form>
      </Modal>

      <ConfirmationModal 
        isOpen={confirmDelete.isOpen} 
        onClose={() => setConfirmDelete({ isOpen: false, id: null })} 
        onConfirm={async () => {
            if (confirmDelete.id) {
                await deleteAmenity(confirmDelete.id);
                setConfirmDelete({ isOpen: false, id: null });
                await fetchData();
                setFeedback({ isOpen: true, type: 'success', title: 'Removed', message: 'Facility has been decommissioned.' });
            }
        }}
        title="Remove Facility"
        message="Are you sure you want to permanently remove this facility? This will cancel all existing reservations."
        isDestructive
      />

      <AuditLogModal isOpen={isAuditOpen} onClose={() => setIsAuditOpen(false)} entityType={['Amenity', 'Booking']} title="Facilities Audit" />
      <FeedbackModal isOpen={feedback.isOpen} onClose={() => setFeedback({ ...feedback, isOpen: false })} title={feedback.title} message={feedback.message} type={feedback.type} />
    </div>
  );
};

export default Amenities;