
import React, { useState, useEffect } from 'react';
import { createBooking, getAmenities, createAmenity, getBookings, deleteBooking, deleteAmenity, updateAmenity } from '../services/api';
import type { Amenity, Booking } from '../types';
import { UserRole } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import { useAuth } from '../hooks/useAuth';
import { PlusIcon, TrashIcon, ClockIcon, AlertTriangleIcon, EyeSlashIcon, CheckCircleIcon } from '../components/icons';

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
  const [allBookings, setAllBookings] = useState<Booking[]>([]); // Store all to filter client side
  const [loading, setLoading] = useState(true);
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'browse' | 'my_bookings'>('browse');

  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedAmenity, setSelectedAmenity] = useState<Amenity | null>(null);
  const { user } = useAuth();
  
  // Booking Form State
  const [bookingDate, setBookingDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingSlots, setExistingSlots] = useState<{start: string, end: string}[]>([]);
  const [bookingError, setBookingError] = useState<string | null>(null);
  
  // Add Amenity Form State
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newCapacity, setNewCapacity] = useState<number>(10);
  const [newMaxDuration, setNewMaxDuration] = useState<number>(0);

  // Generic Confirmation Modal State
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


  const fetchAmenitiesAndBookings = async () => {
    if (!user?.communityId) return;
    try {
      setLoading(true);
      const [amenityData, bookingData] = await Promise.all([
          getAmenities(user.communityId),
          getBookings(user.communityId)
      ]);
      setAmenities(amenityData);
      setAllBookings(bookingData);
    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
     fetchAmenitiesAndBookings();
  }, [user]);
  
  const handleBookClick = (amenity: Amenity) => {
    if (amenity.status === 'Maintenance') return;
    setSelectedAmenity(amenity);
    setIsBookingModalOpen(true);
    setBookingError(null);
    // Default to today
    setBookingDate(new Date().toISOString().split('T')[0]);
  };
  
  const handleCloseBookingModal = () => {
    setIsBookingModalOpen(false);
    setSelectedAmenity(null);
    setBookingDate('');
    setStartTime('');
    setEndTime('');
    setExistingSlots([]);
    setBookingError(null);
  };

  // Update existing slots when date or amenity changes
  useEffect(() => {
      if (selectedAmenity && bookingDate) {
          const dayStart = new Date(bookingDate);
          const dayEnd = new Date(bookingDate);
          dayEnd.setDate(dayEnd.getDate() + 1);

          const relevantBookings = allBookings.filter(b => 
              b.amenityId === selectedAmenity.id &&
              new Date(b.startTime) >= dayStart &&
              new Date(b.startTime) < dayEnd
          );
          
          const slots = relevantBookings.map(b => ({
              start: new Date(b.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
              end: new Date(b.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
          }));
          
          setExistingSlots(slots.sort((a,b) => a.start.localeCompare(b.start)));
      } else {
          setExistingSlots([]);
      }
  }, [bookingDate, selectedAmenity, allBookings]);
  
  const handleBookingSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user || !selectedAmenity) return;
      setBookingError(null);

      const startDateTime = new Date(`${bookingDate}T${startTime}`);
      const endDateTime = new Date(`${bookingDate}T${endTime}`);

      if (startDateTime >= endDateTime) {
          setBookingError("End time must be after start time.");
          return;
      }
      
      if (startDateTime < new Date()) {
          setBookingError("Cannot book in the past.");
          return;
      }

      // Max Duration Validation
      if (selectedAmenity.maxDuration && selectedAmenity.maxDuration > 0) {
          const durationHours = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60);
          if (durationHours > selectedAmenity.maxDuration) {
              setBookingError(`Booking duration cannot exceed ${selectedAmenity.maxDuration} hours for this amenity.`);
              return;
          }
      }

      // Overlap Check
      const hasOverlap = allBookings.some(b => {
          if (b.amenityId !== selectedAmenity.id) return false;
          
          const existingStart = new Date(b.startTime);
          const existingEnd = new Date(b.endTime);
          
          // Overlap logic: (StartA < EndB) and (EndA > StartB)
          return (startDateTime < existingEnd && endDateTime > existingStart);
      });

      if (hasOverlap) {
          setBookingError("This time slot overlaps with an existing booking. Please check the schedule above.");
          return;
      }

      setIsSubmitting(true);

      try {
        await createBooking({
            amenityId: selectedAmenity.id,
            startTime: startDateTime.toISOString(),
            endTime: endDateTime.toISOString(),
        }, user);
        
        alert(`Booking for ${selectedAmenity?.name} confirmed!`);
        handleCloseBookingModal();
        fetchAmenitiesAndBookings(); // Refresh bookings
      } catch (error: any) {
          console.error("Failed to create booking:", error);
          setBookingError(error.message || "Failed to create booking. Please try again.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const promptCancelBooking = (bookingId: string) => {
      setConfirmConfig({
          isOpen: true,
          title: 'Cancel Booking',
          message: 'Are you sure you want to cancel this booking? This action cannot be undone.',
          isDestructive: true,
          confirmLabel: 'Yes, Cancel',
          action: async () => {
              await deleteBooking(bookingId);
              await fetchAmenitiesAndBookings();
          }
      });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        if (file.size > 1024 * 1024) {
            alert("File too large. Please select an image under 1MB.");
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            setNewImageUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
    }
  };
  
  const handleAmenityFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!newImageUrl) {
        alert("Please select an image.");
        return;
    }
    setIsSubmitting(true);
    try {
        await createAmenity({
            name: newName,
            description: newDescription,
            imageUrl: newImageUrl,
            capacity: Number(newCapacity),
            maxDuration: Number(newMaxDuration)
        }, user);
        setIsAddModalOpen(false);
        setNewName('');
        setNewDescription('');
        setNewImageUrl('');
        setNewCapacity(10);
        setNewMaxDuration(0);
        await fetchAmenitiesAndBookings(); 
    } catch (error) {
        console.error("Failed to create amenity:", error);
        alert("Failed to create amenity. Please try again.");
    } finally {
        setIsSubmitting(false);
    }
  };

  // --- CONFIRMATION HANDLERS ---

  const promptDeleteAmenity = (amenity: Amenity) => {
      setConfirmConfig({
          isOpen: true,
          title: 'Delete Amenity',
          message: `Are you sure you want to delete ${amenity.name}? This will delete all associated bookings.`,
          isDestructive: true,
          confirmLabel: 'Delete',
          action: async () => {
              await deleteAmenity(amenity.id);
              await fetchAmenitiesAndBookings();
          }
      });
  };

  const promptToggleStatus = (amenity: Amenity) => {
      const newStatus = amenity.status === 'Active' ? 'Disable' : 'Enable';
      setConfirmConfig({
          isOpen: true,
          title: `${newStatus} Amenity`,
          message: `Are you sure you want to ${newStatus.toLowerCase()} ${amenity.name}?`,
          isDestructive: newStatus === 'Disable',
          confirmLabel: newStatus,
          action: async () => {
              const statusValue = amenity.status === 'Active' ? 'Maintenance' : 'Active';
              await updateAmenity(amenity.id, { status: statusValue });
              await fetchAmenitiesAndBookings();
          }
      });
  };

  const handleConfirmAction = async () => {
      setIsSubmitting(true);
      try {
          await confirmConfig.action();
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      } catch (error: any) {
          console.error("Action failed", error);
          alert(`Failed to perform action: ${error.message}`);
      } finally {
          setIsSubmitting(false);
      }
  };


  // Filter bookings for "My Bookings" tab
  const myBookings = allBookings
    .filter(b => user?.units?.some(u => (u.flatNumber === b.flatNumber)))
    .sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center animated-card">
        <div>
            <h2 className="text-2xl font-bold text-[var(--text-light)] dark:text-[var(--text-dark)]">Amenity Booking</h2>
            <p className="text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] text-lg mt-1">Book community facilities for your use.</p>
        </div>
        {user?.role === UserRole.Admin && (
             <Button onClick={() => setIsAddModalOpen(true)} leftIcon={<PlusIcon className="w-5 h-5"/>} aria-label="Add New Amenity" variant="fab">
                <span className="hidden sm:inline">New Amenity</span>
                <span className="sm:hidden">New</span>
            </Button>
        )}
      </div>
      
      {/* Navigation Tabs */}
      <div className="border-b border-[var(--border-light)] dark:border-[var(--border-dark)]">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
                onClick={() => setActiveTab('browse')}
                className={`${activeTab === 'browse' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] hover:text-[var(--text-light)] dark:hover:text-[var(--text-dark)] hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
                Browse Amenities
            </button>
            <button
                onClick={() => setActiveTab('my_bookings')}
                className={`${activeTab === 'my_bookings' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] hover:text-[var(--text-light)] dark:hover:text-[var(--text-dark)] hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
                My Bookings
            </button>
        </nav>
      </div>

      {activeTab === 'browse' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
                Array.from({ length: 4 }).map((_, index) => <AmenitySkeleton key={index} />)
            ) : (
                amenities.map((amenity, index) => {
                    const isDisabled = amenity.status === 'Maintenance';
                    return (
                        <Card key={amenity.id} className={`flex flex-col animated-card relative ${isDisabled ? 'opacity-75 grayscale-[50%]' : ''}`} style={{ animationDelay: `${index * 100}ms` }}>
                            {isDisabled && (
                                <div className="absolute top-2 right-2 z-10 bg-gray-900/80 text-white text-xs px-2 py-1 rounded font-bold uppercase tracking-wider">
                                    Unavailable
                                </div>
                            )}
                            <img src={amenity.imageUrl} alt={amenity.name} className="w-full h-48 object-cover"/>
                            <div className="p-5 flex flex-col flex-grow">
                                <h3 className="text-xl font-semibold text-[var(--text-light)] dark:text-[var(--text-dark)]">{amenity.name}</h3>
                                <p className="text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mt-2 flex-grow">{amenity.description}</p>
                                <div className="flex flex-wrap gap-2 mt-3">
                                    <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-600 dark:text-gray-300">
                                        Capacity: {amenity.capacity}
                                    </span>
                                    {amenity.maxDuration && amenity.maxDuration > 0 && (
                                        <span className="text-xs bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded text-blue-600 dark:text-blue-300">
                                            Max {amenity.maxDuration} hr(s)
                                        </span>
                                    )}
                                </div>
                                <div className="mt-4 flex gap-2">
                                    <Button 
                                        onClick={() => handleBookClick(amenity)} 
                                        className="w-full"
                                        disabled={isDisabled}
                                    >
                                        {isDisabled ? 'Currently Unavailable' : 'Book Now'}
                                    </Button>
                                    
                                    {/* Admin Actions */}
                                    {user?.role === UserRole.Admin && (
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => promptToggleStatus(amenity)}
                                                className={`p-2 rounded-lg border transition-colors ${
                                                    isDisabled 
                                                    ? 'border-green-500 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20' 
                                                    : 'border-orange-500 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20'
                                                }`}
                                                title={isDisabled ? "Enable" : "Disable"}
                                            >
                                                {isDisabled ? <CheckCircleIcon className="w-5 h-5"/> : <EyeSlashIcon className="w-5 h-5"/>}
                                            </button>
                                            <button 
                                                onClick={() => promptDeleteAmenity(amenity)}
                                                className="p-2 rounded-lg border border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                title="Delete Amenity"
                                            >
                                                <TrashIcon className="w-5 h-5"/>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>
                    );
                })
            )}
          </div>
      )}

      {activeTab === 'my_bookings' && (
          <div className="space-y-4">
              {myBookings.length === 0 ? (
                   <div className="p-8 text-center text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] border-2 border-dashed border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-xl">
                        You have no upcoming bookings.
                    </div>
              ) : (
                  myBookings.map(booking => {
                      const amenityName = amenities.find(a => a.id === booking.amenityId)?.name || 'Unknown Amenity';
                      const start = new Date(booking.startTime);
                      const end = new Date(booking.endTime);
                      const isPast = end < new Date();

                      return (
                          <Card key={booking.id} className={`p-4 flex flex-col md:flex-row justify-between items-start md:items-center ${isPast ? 'opacity-60' : ''}`}>
                              <div>
                                  <h4 className="font-bold text-lg text-[var(--text-light)] dark:text-[var(--text-dark)]">{amenityName}</h4>
                                  <div className="flex items-center gap-2 text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mt-1">
                                      <ClockIcon className="w-4 h-4"/>
                                      <span>{start.toLocaleDateString()}</span>
                                      <span>•</span>
                                      <span>{start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - {end.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                  </div>
                              </div>
                              <div className="mt-3 md:mt-0">
                                  {!isPast && (
                                      <Button size="sm" variant="outlined" onClick={() => promptCancelBooking(booking.id)} className="text-red-500 border-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                                          Cancel
                                      </Button>
                                  )}
                                  {isPast && <span className="text-xs font-medium px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-gray-500">Completed</span>}
                              </div>
                          </Card>
                      );
                  })
              )}
          </div>
      )}

      {/* BOOKING MODAL */}
       <Modal isOpen={isBookingModalOpen} onClose={handleCloseBookingModal} title={`Book ${selectedAmenity?.name || 'Amenity'}`}>
        <form className="space-y-4" onSubmit={handleBookingSubmit}>
            
            {bookingError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 rounded-md text-sm border border-red-200 dark:border-red-800 flex items-start gap-2">
                    <AlertTriangleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <span>{bookingError}</span>
                </div>
            )}

            {selectedAmenity?.maxDuration && selectedAmenity.maxDuration > 0 && (
                <div className="text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-200 p-3 rounded-md border border-blue-100 dark:border-blue-900/30">
                    Note: Bookings for this amenity are limited to <strong>{selectedAmenity.maxDuration} hour(s)</strong> per session.
                </div>
            )}

            <div>
                <label htmlFor="bookingDate" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Select Date</label>
                <input type="date" id="bookingDate" value={bookingDate} onChange={e => setBookingDate(e.target.value)} required min={new Date().toISOString().split('T')[0]} className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] sm:text-sm bg-transparent"/>
            </div>

            {/* Availability Visualizer */}
            {bookingDate && (
                <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-md border border-[var(--border-light)] dark:border-[var(--border-dark)]">
                    <p className="text-xs font-bold text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] uppercase mb-2">Schedule for {new Date(bookingDate).toLocaleDateString()}</p>
                    {existingSlots.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {existingSlots.map((slot, i) => (
                                <span key={i} className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 font-medium border border-red-200 dark:border-red-800">
                                    Booked: {slot.start} - {slot.end}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-green-600 dark:text-green-400">All slots available</p>
                    )}
                </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="startTime" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Start Time</label>
                    <input type="time" id="startTime" value={startTime} onChange={e => setStartTime(e.target.value)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] sm:text-sm bg-transparent"></input>
                </div>
                <div>
                    <label htmlFor="endTime" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">End Time</label>
                    <input type="time" id="endTime" value={endTime} onChange={e => setEndTime(e.target.value)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] sm:text-sm bg-transparent"></input>
                </div>
            </div>

            <div className="flex justify-end pt-4 space-x-2">
                <Button type="button" variant="outlined" onClick={handleCloseBookingModal} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Confirming...' : 'Confirm Booking'}</Button>
            </div>
        </form>
      </Modal>

      {/* ADD AMENITY MODAL */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add New Amenity">
        <form className="space-y-4" onSubmit={handleAmenityFormSubmit}>
            <div>
                <label htmlFor="newName" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Name</label>
                <input type="text" id="newName" value={newName} onChange={e => setNewName(e.target.value)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] sm:text-sm bg-transparent"/>
            </div>
            <div>
                <label htmlFor="newDescription" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Description</label>
                <textarea id="newDescription" value={newDescription} onChange={e => setNewDescription(e.target.value)} required rows={3} className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] sm:text-sm bg-transparent"></textarea>
            </div>
            <div>
                <label htmlFor="newImageUrl" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Amenity Image</label>
                <div className="space-y-2">
                    <input 
                        type="file" 
                        id="newImageUrl" 
                        accept="image/*"
                        onChange={handleImageUpload} 
                        className="block w-full text-sm text-[var(--text-secondary-light)] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 dark:file:bg-teal-900/30 dark:file:text-teal-300 cursor-pointer"
                    />
                    {newImageUrl && (
                        <div className="relative w-full h-32 rounded-lg overflow-hidden border border-[var(--border-light)] dark:border-[var(--border-dark)]">
                            <img src={newImageUrl} alt="Preview" className="w-full h-full object-cover"/>
                        </div>
                    )}
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label htmlFor="newCapacity" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Capacity</label>
                    <input type="number" id="newCapacity" value={newCapacity} onChange={e => setNewCapacity(parseInt(e.target.value, 10))} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] sm:text-sm bg-transparent"/>
                </div>
                <div>
                    <label htmlFor="newMaxDuration" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Max Duration (Hours)</label>
                    <input 
                        type="number" 
                        id="newMaxDuration" 
                        value={newMaxDuration} 
                        onChange={e => setNewMaxDuration(parseFloat(e.target.value))} 
                        min="0" 
                        step="0.5"
                        placeholder="0 for unlimited"
                        className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] sm:text-sm bg-transparent"
                    />
                    <p className="text-xs text-[var(--text-secondary-light)] mt-1">Set 0 for unlimited time.</p>
                </div>
            </div>

            <div className="flex justify-end pt-4 space-x-2">
                <Button type="button" variant="outlined" onClick={() => setIsAddModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Adding...' : 'Add Amenity'}</Button>
            </div>
        </form>
      </Modal>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
        onConfirm={handleConfirmAction}
        title={confirmConfig.title}
        message={confirmConfig.message}
        isDestructive={confirmConfig.isDestructive}
        confirmLabel={confirmConfig.confirmLabel}
        isLoading={isSubmitting}
      />

    </div>
  );
};

export default Amenities;
