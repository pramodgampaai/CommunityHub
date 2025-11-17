import React, { useState, useEffect } from 'react';
import { createBooking, getAmenities } from '../services/api';
import type { Amenity } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { useAuth } from '../hooks/useAuth';

const AmenitySkeleton: React.FC = () => (
    <div className="rounded-xl bg-black/5 dark:bg-white/5 animate-pulse overflow-hidden">
        <div className="h-48 bg-gray-200 dark:bg-gray-700"></div>
        <div className="p-5">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3"></div>
            <div className="space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
            </div>
            <div className="mt-4 h-10 w-28 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        </div>
    </div>
);


const Amenities: React.FC = () => {
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAmenity, setSelectedAmenity] = useState<Amenity | null>(null);
  const { user } = useAuth();
  
  // Form State
  const [bookingDate, setBookingDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);


  useEffect(() => {
    const fetchAmenities = async () => {
      try {
        setLoading(true);
        const data = await getAmenities();
        setAmenities(data);
      } catch (error) {
        console.error("Failed to fetch amenities", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAmenities();
  }, []);
  
  const handleBookClick = (amenity: Amenity) => {
    setSelectedAmenity(amenity);
    setIsModalOpen(true);
  };
  
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedAmenity(null);
    setBookingDate('');
    setStartTime('');
    setEndTime('');
  };
  
  const handleBookingSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user || !selectedAmenity) return;

      setIsSubmitting(true);
      
      const startDateTime = new Date(`${bookingDate}T${startTime}`);
      const endDateTime = new Date(`${bookingDate}T${endTime}`);

      try {
        await createBooking({
            amenityId: selectedAmenity.id,
            startTime: startDateTime.toISOString(),
            endTime: endDateTime.toISOString(),
        }, user);
        
        alert(`Booking for ${selectedAmenity?.name} confirmed!`);
        handleCloseModal();
      } catch (error) {
          console.error("Failed to create booking:", error);
          alert("Failed to create booking. Please try again.");
      } finally {
          setIsSubmitting(false);
      }
  };

  return (
    <div className="space-y-6">
      <div className="animated-card">
        <h2 className="text-3xl sm:text-4xl font-bold text-[var(--text-light)] dark:text-[var(--text-dark)]">Amenity Booking</h2>
         <p className="text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] text-lg mt-1">Book community facilities for your use.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
            Array.from({ length: 4 }).map((_, index) => <AmenitySkeleton key={index} />)
        ) : (
            amenities.map((amenity, index) => (
                <Card key={amenity.id} className="flex flex-col animated-card" style={{ animationDelay: `${index * 100}ms` }}>
                    <img src={amenity.imageUrl} alt={amenity.name} className="w-full h-48 object-cover"/>
                    <div className="p-5 flex flex-col flex-grow">
                        <h3 className="text-xl font-semibold text-[var(--text-light)] dark:text-[var(--text-dark)]">{amenity.name}</h3>
                        <p className="text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mt-2 flex-grow">{amenity.description}</p>
                         <p className="text-xs text-gray-500 mt-2">Capacity: {amenity.capacity} people</p>
                        <div className="mt-4">
                            <Button onClick={() => handleBookClick(amenity)} className="w-full">
                                Book Now
                            </Button>
                        </div>
                    </div>
                </Card>
            ))
        )}
      </div>

       <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={`Book ${selectedAmenity?.name || 'Amenity'}`}>
        <form className="space-y-4" onSubmit={handleBookingSubmit}>
            <div>
                <label htmlFor="bookingDate" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Date</label>
                <input type="date" id="bookingDate" value={bookingDate} onChange={e => setBookingDate(e.target.value)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] sm:text-sm bg-transparent"/>
            </div>
             <div>
                <label htmlFor="startTime" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Start Time</label>
                <input type="time" id="startTime" value={startTime} onChange={e => setStartTime(e.target.value)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] sm:text-sm bg-transparent"></input>
            </div>
            <div>
                <label htmlFor="endTime" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">End Time</label>
                <input type="time" id="endTime" value={endTime} onChange={e => setEndTime(e.target.value)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] sm:text-sm bg-transparent"></input>
            </div>
            <div className="flex justify-end pt-4 space-x-2">
                <Button type="button" variant="outlined" onClick={handleCloseModal} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Confirming...' : 'Confirm Booking'}</Button>
            </div>
        </form>
      </Modal>
    </div>
  );
};

export default Amenities;