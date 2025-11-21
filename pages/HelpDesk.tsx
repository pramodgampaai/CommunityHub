
import React, { useState, useEffect } from 'react';
import { createComplaint, getComplaints, updateComplaintStatus } from '../services/api';
import type { Complaint } from '../types';
import { ComplaintStatus, ComplaintCategory, UserRole } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { PlusIcon, ChevronDownIcon } from '../components/icons';
import { useAuth } from '../hooks/useAuth';

const StatusBadge: React.FC<{ status: ComplaintStatus }> = ({ status }) => {
    const statusStyles: Record<ComplaintStatus, string> = {
        [ComplaintStatus.Pending]: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
        [ComplaintStatus.InProgress]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
        [ComplaintStatus.Resolved]: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    };
    return <span className={`px-3 py-1 text-sm font-medium rounded-full ${statusStyles[status]}`}>{status}</span>;
}

const ComplaintSkeleton: React.FC = () => (
    <div className="p-5 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center">
            <div className="flex-1 space-y-2">
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            </div>
            <div className="mt-3 sm:mt-0 h-8 w-28 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
        </div>
        <div className="mt-4 space-y-2">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
        </div>
    </div>
);


const HelpDesk: React.FC = () => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user } = useAuth();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ComplaintCategory>(ComplaintCategory.Other);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const fetchComplaints = async (communityId: string) => {
    try {
      setLoading(true);
      const data = await getComplaints(communityId);
      setComplaints(data);
    } catch (error) {
      console.error("Failed to fetch complaints", error);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    if (user?.communityId) {
        fetchComplaints(user.communityId);
    }
  }, [user]);
  
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    try {
        await createComplaint({ title, description, category }, user);
        setIsModalOpen(false);
        setTitle('');
        setDescription('');
        setCategory(ComplaintCategory.Other);
        await fetchComplaints(user.communityId); // Refresh list
    } catch (error) {
        console.error("Failed to create complaint:", error);
        alert("Failed to create complaint. Please try again.");
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (complaintId: string, newStatus: ComplaintStatus) => {
    setUpdatingId(complaintId);
    try {
        const updatedComplaint = await updateComplaintStatus(complaintId, newStatus);
        setComplaints(prev => prev.map(c => c.id === complaintId ? updatedComplaint : c));
    } catch (error) {
        console.error("Failed to update status", error);
        alert("Failed to update complaint status.");
    } finally {
        setUpdatingId(null);
    }
  };

  const canManageTickets = user?.role === UserRole.Admin || user?.role === UserRole.Helpdesk;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center animated-card">
        <h2 className="text-3xl sm:text-4xl font-bold text-[var(--text-light)] dark:text-[var(--text-dark)]">Help Desk</h2>
        {user?.role === UserRole.Resident && (
            <Button onClick={() => setIsModalOpen(true)} leftIcon={<PlusIcon className="w-5 h-5"/>} aria-label="Raise New Complaint" variant="fab">
                <span className="hidden sm:inline">New Complaint</span>
                <span className="sm:hidden">New</span>
            </Button>
        )}
      </div>
      
      <div className="space-y-4">
        {loading ? (
             Array.from({ length: 3 }).map((_, index) => <ComplaintSkeleton key={index} />)
        ) : (
            complaints.map((complaint, index) => (
                <Card key={complaint.id} className="p-5 animated-card" style={{ animationDelay: `${index * 100}ms` }}>
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center">
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-[var(--text-light)] dark:text-[var(--text-dark)]">{complaint.title}</h3>
                            <p className="text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mt-1">
                                From {complaint.flatNumber} on {new Date(complaint.createdAt).toLocaleDateString()}
                            </p>
                        </div>
                        <div className="mt-3 sm:mt-0 flex items-center gap-4">
                            <StatusBadge status={complaint.status} />
                            {canManageTickets && (
                                <div className="relative">
                                    <select
                                        value={complaint.status}
                                        onChange={(e) => handleStatusChange(complaint.id, e.target.value as ComplaintStatus)}
                                        disabled={updatingId === complaint.id}
                                        className="text-sm appearance-none bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md pl-3 pr-8 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50"
                                        aria-label={`Update status for complaint: ${complaint.title}`}
                                    >
                                        {Object.values(ComplaintStatus).map(status => (
                                            <option key={status} value={status}>{status}</option>
                                        ))}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                                        {updatingId === complaint.id ? (
                                            <div className="w-4 h-4 border-2 border-[var(--accent)] border-b-transparent rounded-full animate-spin" style={{ animationDuration: '0.75s' }}></div>
                                        ) : (
                                            <ChevronDownIcon className="w-4 h-4" />
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <p className="mt-3 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">{complaint.description}</p>
                </Card>
            ))
        )}
      </div>

       <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Raise a New Complaint">
        <form className="space-y-4" onSubmit={handleFormSubmit}>
            <div>
                <label htmlFor="title" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Subject</label>
                <input type="text" id="title" value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Leaky Faucet" className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] sm:text-sm bg-transparent"/>
            </div>
            <div>
                <label htmlFor="category" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Category</label>
                <select id="category" value={category} onChange={e => setCategory(e.target.value as ComplaintCategory)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] sm:text-sm bg-transparent">
                    {Object.values(ComplaintCategory).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                </select>
            </div>
             <div>
                <label htmlFor="description" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Description</label>
                <textarea id="description" value={description} onChange={e => setDescription(e.target.value)} required placeholder="Please provide details about the issue." rows={4} className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] sm:text-sm bg-transparent"></textarea>
            </div>
            <div className="flex justify-end pt-4 space-x-2">
                <Button type="button" variant="outlined" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Submitting...' : 'Submit'}</Button>
            </div>
        </form>
      </Modal>
    </div>
  );
};

export default HelpDesk;
