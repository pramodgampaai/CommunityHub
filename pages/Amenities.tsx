import React, { useState, useEffect } from 'react';
import { getAmenities, createAmenity, updateAmenity, deleteAmenity, createBooking, getBookings } from '../services/api';
import type { Amenity, Booking } from '../types';
import { UserRole } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import AuditLogModal from '../components/AuditLogModal';
import { PlusIcon, HistoryIcon, PencilIcon, TrashIcon, CheckCircleIcon, ClockIcon, AlertTriangleIcon, CalendarIcon } from '../components/icons';
import { useAuth } from '../hooks/useAuth';

const Amenities: React.FC = () => {
  const { user } = useAuth();
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal States
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedAmenity, setSelectedAmenity] = useState<Amenity | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });

  // Form States
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
        setLoading(true);
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

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        if (file.size > 1024 * 1024) {
            alert("Image too large. Please select a file under 1MB.");
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            setImageUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
    }
  };

  const handleSaveAmenity = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      if (!imageUrl) {
          alert("Please select an image for the amenity.");
          return;
      }
      setIsSubmitting(true);
      try {
          const payload = {
              name, description, imageUrl,
              capacity: parseInt(capacity),
              maxDuration: parseInt(maxDuration) || 0
          };

          if (editingId) {
              await updateAmenity(editingId, payload);
          } else {
              await createAmenity(payload, user);
          }

          setIsCreateModalOpen(false);
          resetForm();
          await fetchData();
      } catch (err) { console.error(err); } finally { setIsSubmitting(false); }
  };

  const handleEditClick = (amenity: Amenity) => {
      setEditingId(amenity.id);
      setName(amenity.name);
      setDescription(amenity.description);
      setImageUrl(amenity.imageUrl);
      setCapacity(amenity.capacity.toString());
      setMaxDuration((amenity.maxDuration || 4).toString());
      setIsCreateModalOpen(true);
  };

  const handleDelete = async () => {
      if (!confirmDelete.id) return;
      setIsSubmitting(true);
      try {
          await deleteAmenity(confirmDelete.id);
          setConfirmDelete({ isOpen: false, id: null });
          await fetchData();
      } catch (error) {
          console.error("Delete failed:", error);
          alert("Failed to remove amenity.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleBooking = async (e: React.FormEvent) => {
      e.preventDefault();
      setBookingError(null);
      if (!user || !selectedAmenity) return;

      const start = new Date(startTime);
      const end = new Date(endTime);

      if (end <= start) {
          setBookingError("End time must be after start time.");
          return;
      }

      // Check against Max Duration (in hours)
      if (selectedAmenity.maxDuration && selectedAmenity.maxDuration > 0) {
          const diffMs = end.getTime() - start.getTime();
          const diffHrs = diffMs / (1000 * 60 * 60);
          
          if (diffHrs > selectedAmenity.maxDuration) {
              setBookingError(`Max duration for this facility is ${selectedAmenity.maxDuration}h. You requested ${diffHrs.toFixed(1)}h.`);
              return;
          }
      }

      // Check for overlap locally before submitting
      const hasOverlap = allBookings.some(b => {
          if (b.amenityId !== selectedAmenity.id) return false;
          const bStart = new Date(b.startTime);
          const bEnd = new Date(b.endTime);
          return (start < bEnd && end > bStart);
      });

      if (hasOverlap) {
          setBookingError("The selected time slot overlaps with an existing booking.");
          return;
      }

      setIsSubmitting(true);
      try {
          await createBooking({
              amenityId: selectedAmenity.id,
              startTime: start.toISOString(),
              endTime: end.toISOString(),
          }, user);
          setIsBookingModalOpen(false);
          alert("Confirmed!");
          resetBookingForm();
          await fetchData();
      } catch (err: any) { 
          setBookingError(err.message || "Failed to create booking."); 
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
  };

  const isAdmin = user?.role === UserRole.Admin;

  // Filter bookings for the selected amenity in the modal strictly for the chosen/current day
  const activeAmenityBookings = selectedAmenity 
    ? allBookings
        .filter(b => {
            const isSameAmenity = b.amenityId === selectedAmenity.id;
            if (!isSameAmenity) return false;

            // Target date is either what user selected or Today
            const targetDate = startTime ? new Date(startTime) : new Date();
            const targetDateStr = targetDate.toDateString();
            
            const bookingStartDateStr = new Date(b.startTime).toDateString();
            const bookingEndDateStr = new Date(b.endTime).toDateString();
            
            // Show if it overlaps with the specific calendar day
            return bookingStartDateStr === targetDateStr || bookingEndDateStr === targetDateStr;
        })
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    : [];

  const formatTimeRange = (startStr: string, endStr: string) => {
      const s = new Date(startStr);
      const e = new Date(endStr);
      
      const timeS = s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const timeE = e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      return `${timeS} - ${timeE}`;
  };

  const getDayHeader = () => {
      const date = startTime ? new Date(startTime) : new Date();
      const isToday = date.toDateString() === new Date().toDateString();
      const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return isToday ? "Today's Busy Slots" : `Busy Slots (${dateStr})`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div className="flex items-start gap-3">
            <div className="w-1 h-10 bg-brand-500 rounded-full mt-1" />
            <div>
                <span className="text-[9px] font-mono font-black uppercase tracking-[0.3em] text-brand-600 dark:text-brand-400 mb-0.5 block">Assets</span>
                <h2 className="text-3xl font-brand font-extrabold text-brand-600 dark:text-slate-50 tracking-tight">Amenities</h2>
            </div>
        </div>
        <div className="flex gap-2">
            <Button onClick={() => setIsAuditOpen(true)} variant="outlined" size="sm" leftIcon={<HistoryIcon />}>
                Log
            </Button>
            {isAdmin && (
                 <Button onClick={() => { resetForm(); setIsCreateModalOpen(true); }} size="sm" leftIcon={<PlusIcon />}>
                    New Amenity
                </Button>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
             Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-64 bg-slate-100 dark:bg-white/5 rounded-xl animate-pulse" />)
        ) : (
            amenities.map(amenity => (
                <Card key={amenity.id} className="p-0 flex flex-col overflow-hidden rounded-xl bg-white dark:bg-zinc-900/40 border border-slate-100 dark:border-white/5 group">
                    <div className="h-40 relative overflow-hidden">
                        <img src={amenity.imageUrl} alt={amenity.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
                        <span className="absolute bottom-3 left-4 bg-brand-600 text-white text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-md">
                            {amenity.status || 'Active'}
                        </span>
                        
                        {isAdmin && (
                            <div className="absolute top-3 right-3 flex gap-2">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleEditClick(amenity); }}
                                    className="p-2 bg-white/90 dark:bg-zinc-800/90 text-slate-600 dark:text-slate-300 hover:text-brand-600 rounded-lg shadow-sm backdrop-blur-md transition-all hover:scale-110"
                                >
                                    <PencilIcon className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setConfirmDelete({ isOpen: true, id: amenity.id }); }}
                                    className="p-2 bg-white/90 dark:bg-zinc-800/90 text-slate-600 dark:text-slate-300 hover:text-rose-600 rounded-lg shadow-sm backdrop-blur-md transition-all hover:scale-110"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="p-5 flex flex-col flex-grow">
                        <div className="flex justify-between items-start mb-1.5">
                            <h3 className="text-xl font-brand font-extrabold text-slate-900 dark:text-slate-50">{amenity.name}</h3>
                            {amenity.maxDuration && (
                                <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 dark:bg-white/5 px-2 py-1 rounded-md">
                                    <ClockIcon className="w-3 h-3" /> {amenity.maxDuration}h limit
                                </div>
                            )}
                        </div>
                        <p className="text-slate-500 dark:text-zinc-400 text-xs leading-relaxed mb-5 line-clamp-2 font-medium">{amenity.description}</p>
                        <Button 
                            onClick={() => { setSelectedAmenity(amenity); setBookingError(null); setIsBookingModalOpen(true); }}
                            className="w-full text-[10px] uppercase tracking-widest font-black"
                            size="sm"
                        >
                            Reserve
                        </Button>
                    </div>
                </Card>
            ))
        )}
      </div>

      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title={editingId ? "Update Amenity" : "New Amenity"} subtitle="ASSET REGISTRATION">
          <form className="space-y-4" onSubmit={handleSaveAmenity}>
              <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Amenity Name</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Community Clubhouse" className="block w-full px-4 py-2.5 rounded-xl input-field text-sm font-bold"/>
              </div>
              
              <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Gallery Image</label>
                  <div className="space-y-3">
                      {imageUrl && (
                          <div className="w-full h-40 rounded-2xl overflow-hidden border-2 border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-black/20">
                              <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                          </div>
                      )}
                      <div className="relative">
                          <input 
                              type="file" 
                              accept="image/*" 
                              onChange={handleImageUpload} 
                              required={!imageUrl}
                              className="block w-full text-[11px] text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:tracking-widest file:bg-brand-50 file:text-brand-600 hover:file:bg-brand-100 cursor-pointer"
                          />
                      </div>
                  </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                      <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Guest Capacity</label>
                      <input type="number" value={capacity} onChange={e => setCapacity(e.target.value)} required min="1" className="block w-full px-4 py-2.5 rounded-xl input-field text-sm font-bold"/>
                  </div>
                  <div>
                      <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Max Duration (Hours)</label>
                      <input type="number" value={maxDuration} onChange={e => setMaxDuration(e.target.value)} required min="1" className="block w-full px-4 py-2.5 rounded-xl input-field text-sm font-bold"/>
                  </div>
              </div>
              <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Description</label>
                  <textarea value={description} onChange={e => setDescription(e.target.value)} required rows={3} placeholder="Describe rules and features..." className="block w-full px-4 py-2.5 rounded-xl input-field text-sm font-medium leading-relaxed"></textarea>
              </div>
              <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={isSubmitting} size="lg" className="w-full sm:w-auto">
                    {isSubmitting ? 'Syncing...' : (editingId ? 'Update Amenity' : 'Add Amenity')}
                  </Button>
              </div>
          </form>
      </Modal>

      <Modal isOpen={isBookingModalOpen} onClose={() => { setIsBookingModalOpen(false); setBookingError(null); }} title="Reserve" subtitle={selectedAmenity?.name.toUpperCase()} size="md">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Form Section */}
              <form className="space-y-5" onSubmit={handleBooking}>
                  {bookingError && (
                      <div className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 rounded-2xl flex items-start gap-3 text-rose-600 dark:text-rose-400">
                          <AlertTriangleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                          <p className="text-xs font-bold leading-relaxed">{bookingError}</p>
                      </div>
                  )}
                  
                  {selectedAmenity?.maxDuration && !bookingError && (
                    <div className="p-4 bg-brand-50 dark:bg-brand-500/10 rounded-2xl border border-brand-100 dark:border-brand-500/20 text-center">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400">Duration Constraint</p>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1">Maximum limit: <span className="text-brand-600">{selectedAmenity.maxDuration} hours</span></p>
                    </div>
                  )}
                  
                  <div className="space-y-4">
                      <div>
                          <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Start Time</label>
                          <input type="datetime-local" value={startTime} onChange={e => { setStartTime(e.target.value); setBookingError(null); }} required className="block w-full px-4 py-2 rounded-xl input-field text-xs font-bold"/>
                      </div>
                      <div>
                          <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">End Time</label>
                          <input type="datetime-local" value={endTime} onChange={e => { setEndTime(e.target.value); setBookingError(null); }} required className="block w-full px-4 py-2 rounded-xl input-field text-xs font-bold"/>
                      </div>
                  </div>
                  <Button type="submit" disabled={isSubmitting} className="w-full shadow-lg shadow-brand-500/10" size="lg">Confirm Slot</Button>
              </form>

              {/* Occupancy Section */}
              <div className="bg-slate-50 dark:bg-zinc-900/40 p-5 rounded-3xl border border-slate-100 dark:border-white/5 h-fit max-h-[400px] overflow-y-auto no-scrollbar">
                  <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                          <CalendarIcon className="w-4 h-4 text-brand-600" />
                          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                             {getDayHeader()}
                          </h4>
                      </div>
                  </div>
                  
                  {activeAmenityBookings.length === 0 ? (
                      <div className="py-8 text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                             No bookings on this day
                          </p>
                      </div>
                  ) : (
                      <div className="space-y-3">
                          {activeAmenityBookings.map(b => {
                              return (
                                  <div key={b.id} className="p-3 bg-white dark:bg-white/5 rounded-xl border border-slate-200/50 dark:border-white/5 shadow-sm">
                                      <div className="flex justify-between items-start mb-1">
                                          <p className="text-[8px] font-black text-brand-600 uppercase">Reserved</p>
                                          <p className="text-[8px] font-bold text-slate-400 uppercase">{b.flatNumber}</p>
                                      </div>
                                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{formatTimeRange(b.startTime, b.endTime)}</p>
                                      <p className="text-[9px] text-slate-400 mt-1 truncate">{b.residentName}</p>
                                  </div>
                              );
                          })}
                      </div>
                  )}
              </div>
          </div>
      </Modal>

      <ConfirmationModal
          isOpen={confirmDelete.isOpen}
          onClose={() => setConfirmDelete({ isOpen: false, id: null })}
          onConfirm={handleDelete}
          title="Delete Amenity"
          message="Are you sure you want to permanently remove this amenity? All existing bookings and logs related to this asset will be lost."
          isDestructive
          isLoading={isSubmitting}
          confirmLabel="Yes, Remove"
      />

      <AuditLogModal isOpen={isAuditOpen} onClose={() => setIsAuditOpen(false)} entityType={['Amenity', 'Booking']} title="Booking Log" />
    </div>
  );
};

export default Amenities;