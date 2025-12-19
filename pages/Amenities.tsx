import React, { useState, useEffect } from 'react';
import { getAmenities, createAmenity, createBooking } from '../services/api';
import type { Amenity } from '../types';
import { UserRole } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import AuditLogModal from '../components/AuditLogModal';
import { PlusIcon, HistoryIcon, SparklesIcon, ClockIcon, UserGroupIcon } from '../components/icons';
import { useAuth } from '../hooks/useAuth';

const Amenities: React.FC = () => {
  const { user } = useAuth();
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal States
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedAmenity, setSelectedAmenity] = useState<Amenity | null>(null);

  // Form States
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [capacity, setCapacity] = useState('50');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAmenities = async () => {
    if (user?.communityId) {
        setLoading(true);
        try {
            const data = await getAmenities(user.communityId);
            setAmenities(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }
  };

  useEffect(() => {
    fetchAmenities();
  }, [user]);

  const handleCreateAmenity = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      setIsSubmitting(true);
      try {
          await createAmenity({
              name, description, imageUrl,
              capacity: parseInt(capacity),
              maxDuration: 4
          }, user);
          setIsCreateModalOpen(false);
          await fetchAmenities();
      } catch (err) { console.error(err); } finally { setIsSubmitting(false); }
  };

  const handleBooking = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user || !selectedAmenity) return;
      setIsSubmitting(true);
      try {
          await createBooking({
              amenityId: selectedAmenity.id,
              startTime: new Date(startTime).toISOString(),
              endTime: new Date(endTime).toISOString(),
          }, user);
          setIsBookingModalOpen(false);
          alert("Confirmed!");
      } catch (err: any) { alert(err.message); } finally { setIsSubmitting(false); }
  };

  const isAdmin = user?.role === UserRole.Admin;

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
                 <Button onClick={() => setIsCreateModalOpen(true)} size="sm" leftIcon={<PlusIcon />}>
                    New Asset
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
                    </div>
                    <div className="p-5 flex flex-col flex-grow">
                        <h3 className="text-xl font-brand font-extrabold text-slate-900 dark:text-slate-50 mb-1.5">{amenity.name}</h3>
                        <p className="text-slate-500 dark:text-zinc-400 text-xs leading-relaxed mb-5 line-clamp-2 font-medium">{amenity.description}</p>
                        <Button 
                            onClick={() => { setSelectedAmenity(amenity); setIsBookingModalOpen(true); }}
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

      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="New Amenity">
          <form className="space-y-4" onSubmit={handleCreateAmenity}>
              <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1">Name</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} required className="block w-full px-4 py-2.5 rounded-lg input-field text-sm font-bold"/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1">Capacity</label>
                      <input type="number" value={capacity} onChange={e => setCapacity(e.target.value)} required className="block w-full px-4 py-2.5 rounded-lg input-field text-sm font-bold"/>
                  </div>
                  <div>
                      <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1">Image</label>
                      <input type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)} className="block w-full px-4 py-2.5 rounded-lg input-field text-xs font-bold"/>
                  </div>
              </div>
              <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1">Description</label>
                  <textarea value={description} onChange={e => setDescription(e.target.value)} required rows={3} className="block w-full px-4 py-2.5 rounded-lg input-field text-sm"></textarea>
              </div>
              <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={isSubmitting} size="md">Register</Button>
              </div>
          </form>
      </Modal>

      <Modal isOpen={isBookingModalOpen} onClose={() => setIsBookingModalOpen(false)} title="Reserve" subtitle={selectedAmenity?.name.toUpperCase()} size="sm">
          <form className="space-y-5" onSubmit={handleBooking}>
              <div className="space-y-4">
                  <div>
                      <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1">Start</label>
                      <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} required className="block w-full px-4 py-2 rounded-lg input-field text-xs font-bold"/>
                  </div>
                  <div>
                      <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1">End</label>
                      <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} required className="block w-full px-4 py-2 rounded-lg input-field text-xs font-bold"/>
                  </div>
              </div>
              <Button type="submit" disabled={isSubmitting} className="w-full" size="md">Confirm Slot</Button>
          </form>
      </Modal>

      <AuditLogModal isOpen={isAuditOpen} onClose={() => setIsAuditOpen(false)} entityType={['Amenity', 'Booking']} title="Booking Log" />
    </div>
  );
};

export default Amenities;