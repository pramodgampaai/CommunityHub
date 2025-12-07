
import React, { useState, useEffect } from 'react';
import { createComplaint, getComplaints, updateComplaintStatus, getResidents, assignComplaint } from '../services/api';
import type { Complaint, User } from '../types';
import { ComplaintStatus, ComplaintCategory, UserRole } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import AuditLogModal from '../components/AuditLogModal';
import { PlusIcon, ChevronDownIcon, CheckCircleIcon, HistoryIcon } from '../components/icons';
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
  const [availableAgents, setAvailableAgents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user } = useAuth();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ComplaintCategory>(ComplaintCategory.Other);
  const [selectedUnitId, setSelectedUnitId] = useState<string>(''); // For multi-unit owners
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  
  const fetchComplaints = async (communityId: string) => {
    try {
      setLoading(true);
      const data = await getComplaints(communityId, user?.id, user?.role);
      setComplaints(data);
    } catch (error) {
      console.error("Failed to fetch complaints", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAgents = async (communityId: string) => {
      try {
          const users = await getResidents(communityId);
          const agents = users.filter(u => u.role === UserRole.HelpdeskAgent);
          setAvailableAgents(agents);
      } catch (error) {
          console.error("Failed to fetch agents", error);
      }
  }
  
  useEffect(() => {
    if (user?.communityId) {
        fetchComplaints(user.communityId);
        if (user.role === UserRole.HelpdeskAdmin) {
            fetchAgents(user.communityId);
        }
    }
  }, [user]);

  // Set default unit selection when modal opens
  useEffect(() => {
      if (isModalOpen && user?.units && user.units.length > 0) {
          // Default to first unit
          setSelectedUnitId(user.units[0].id);
      }
  }, [isModalOpen, user]);
  
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    try {
        let specificFlatNumber = undefined;
        let specificUnitId = undefined;

        // Determine specific unit details if resident/admin has multiple
        const isResidentOrAdmin = user.role === UserRole.Resident || user.role === UserRole.Admin;
        if (isResidentOrAdmin && user.units && user.units.length > 0) {
            const unit = user.units.find(u => u.id === selectedUnitId);
            if (unit) {
                specificUnitId = unit.id;
                specificFlatNumber = unit.block ? `${unit.block}-${unit.flatNumber}` : unit.flatNumber;
            } else {
                // Fallback to first unit if logic fails
                const first = user.units[0];
                specificUnitId = first.id;
                specificFlatNumber = first.block ? `${first.block}-${first.flatNumber}` : first.flatNumber;
            }
        }

        await createComplaint(
            { title, description, category }, 
            user, 
            specificUnitId, 
            specificFlatNumber
        );

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

  const handleAssignAgent = async (complaintId: string, agentId: string) => {
      setAssigningId(complaintId);
      try {
          await assignComplaint(complaintId, agentId);
          // Optimistic update or refresh
          const agent = availableAgents.find(a => a.id === agentId);
          setComplaints(prev => prev.map(c => c.id === complaintId ? { ...c, assignedTo: agentId, assignedToName: agent?.name } : c));
      } catch (error) {
          console.error("Failed to assign agent", error);
          alert("Failed to assign agent.");
      } finally {
          setAssigningId(null);
      }
  }

  const promptResolve = (complaint: Complaint) => {
      setConfirmConfig({
          isOpen: true,
          title: "Mark as Resolved",
          message: "Are you sure you want to mark this complaint as Resolved? You will not be able to make further changes.",
          confirmLabel: "Yes, Resolve",
          isDestructive: false,
          action: async () => {
              await handleStatusChange(complaint.id, ComplaintStatus.Resolved);
          }
      });
  };

  const handleConfirmAction = async () => {
      setIsSubmitting(true);
      try {
          await confirmConfig.action();
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      } catch (error: any) {
          console.error("Action error:", error);
          alert("Action failed. Please try again.");
      } finally {
          setIsSubmitting(false);
      }
  };

  // Determine Permissions
  const isHelpdeskAdmin = user?.role === UserRole.HelpdeskAdmin;
  const isHelpdeskAgent = user?.role === UserRole.HelpdeskAgent;
  const canCreateComplaint = user?.role === UserRole.Resident || user?.role === UserRole.Admin;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center animated-card">
        <h2 className="text-2xl font-bold text-[var(--text-light)] dark:text-[var(--text-dark)]">Help Desk</h2>
        <div className="flex gap-2">
            <Button 
                onClick={() => setIsAuditOpen(true)} 
                variant="outlined"
                size="sm"
                leftIcon={<HistoryIcon className="w-4 h-4" />}
                className="border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
                History
            </Button>
            {canCreateComplaint && (
                <Button onClick={() => setIsModalOpen(true)} leftIcon={<PlusIcon className="w-5 h-5"/>} aria-label="Raise New Complaint" variant="fab">
                    <span className="hidden sm:inline">New Complaint</span>
                    <span className="sm:hidden">New</span>
                </Button>
            )}
        </div>
      </div>
      
      <div className="space-y-4">
        {loading ? (
             Array.from({ length: 3 }).map((_, index) => <ComplaintSkeleton key={index} />)
        ) : (
            complaints.length === 0 ? (
                <div className="p-8 text-center text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] border-2 border-dashed border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-xl">
                    No tickets found.
                </div>
            ) : (
                complaints.map((complaint, index) => {
                    const isResolved = complaint.status === ComplaintStatus.Resolved;

                    // Permissions
                    // Agent can update status if assigned
                    const isAssignedAgent = isHelpdeskAgent && complaint.assignedTo === user?.id;
                    // Resident/Admin can resolve their own ticket
                    const isOwner = (user?.role === UserRole.Resident || user?.role === UserRole.Admin) && complaint.userId === user?.id;

                    const canUpdateStatus = !isResolved && isAssignedAgent;
                    const canResolve = !isResolved && (isAssignedAgent || isOwner);
                    
                    return (
                        <Card key={complaint.id} className="p-5 animated-card" style={{ animationDelay: `${index * 100}ms` }}>
                            <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-[var(--text-light)] dark:text-[var(--text-dark)]">{complaint.title}</h3>
                                    <p className="text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mt-1">
                                        From {complaint.flatNumber} on {new Date(complaint.createdAt).toLocaleDateString()}
                                    </p>
                                    <div className="mt-2 text-sm">
                                        <span className="text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Assigned to: </span>
                                        <span className="font-medium text-[var(--text-light)] dark:text-[var(--text-dark)]">
                                            {complaint.assignedToName || "Unassigned"}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex flex-col items-end gap-2 min-w-[180px]">
                                    <div className="flex items-center gap-2">
                                        <StatusBadge status={complaint.status} />
                                        {canUpdateStatus && (
                                            <div className="relative">
                                                <select
                                                    value={complaint.status}
                                                    onChange={(e) => handleStatusChange(complaint.id, e.target.value as ComplaintStatus)}
                                                    disabled={updatingId === complaint.id}
                                                    className="text-sm appearance-none bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md pl-3 pr-8 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50"
                                                >
                                                    {Object.values(ComplaintStatus)
                                                        .filter(s => s !== ComplaintStatus.Resolved) // Hide Resolved from dropdown, use button instead
                                                        .map(status => (
                                                        <option key={status} value={status}>{status}</option>
                                                    ))}
                                                </select>
                                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                                                    {updatingId === complaint.id ? (
                                                        <div className="w-4 h-4 border-2 border-[var(--accent)] border-b-transparent rounded-full animate-spin"></div>
                                                    ) : (
                                                        <ChevronDownIcon className="w-4 h-4" />
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Mark as Resolved Button */}
                                    {canResolve && (
                                        <Button 
                                            size="sm" 
                                            variant="outlined" 
                                            className="text-xs py-1.5 px-3 border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                                            onClick={() => promptResolve(complaint)}
                                            leftIcon={<CheckCircleIcon className="w-3.5 h-3.5" />}
                                        >
                                            Mark as Resolved
                                        </Button>
                                    )}

                                    {/* Assignment Dropdown - Only visible to Helpdesk Admins */}
                                    {isHelpdeskAdmin && !isResolved && (
                                        <div className="w-full">
                                            <div className="relative">
                                                <select
                                                    value={complaint.assignedTo || ""}
                                                    onChange={(e) => handleAssignAgent(complaint.id, e.target.value)}
                                                    disabled={assigningId === complaint.id}
                                                    className="w-full text-sm appearance-none bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md pl-3 pr-8 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50 text-[var(--text-light)] dark:text-[var(--text-dark)]"
                                                >
                                                    <option value="">Assign Agent...</option>
                                                    {availableAgents.map(agent => (
                                                        <option key={agent.id} value={agent.id}>{agent.name}</option>
                                                    ))}
                                                </select>
                                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                                                    {assigningId === complaint.id ? (
                                                         <div className="w-4 h-4 border-2 border-[var(--accent)] border-b-transparent rounded-full animate-spin"></div>
                                                    ) : (
                                                        <ChevronDownIcon className="w-4 h-4" />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <p className="mt-3 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">{complaint.description}</p>
                        </Card>
                    );
                })
            )
        )}
      </div>

       <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Raise a New Complaint">
        <form className="space-y-4" onSubmit={handleFormSubmit}>
            {/* Unit Selection for Multi-Unit Owners */}
            {user?.units && user.units.length > 1 && (
                <div>
                    <label htmlFor="unitSelect" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Select Property</label>
                    <div className="relative">
                        <select 
                            id="unitSelect" 
                            value={selectedUnitId} 
                            onChange={e => setSelectedUnitId(e.target.value)}
                            required
                            className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] sm:text-sm bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] appearance-none"
                        >
                            {user.units.map(unit => (
                                <option key={unit.id} value={unit.id}>
                                    {unit.block ? `${unit.block} - ` : ''}{unit.flatNumber}
                                </option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                            <ChevronDownIcon className="w-4 h-4" />
                        </div>
                    </div>
                </div>
            )}

            <div>
                <label htmlFor="title" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Subject</label>
                <input type="text" id="title" value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Leaky Faucet" className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] sm:text-sm bg-transparent"/>
            </div>
            <div>
                <label htmlFor="category" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Category</label>
                <div className="relative">
                    <select id="category" value={category} onChange={e => setCategory(e.target.value as ComplaintCategory)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] sm:text-sm bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] appearance-none">
                        {Object.values(ComplaintCategory).map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                     <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                        <ChevronDownIcon className="w-4 h-4" />
                    </div>
                </div>
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

      <AuditLogModal
        isOpen={isAuditOpen}
        onClose={() => setIsAuditOpen(false)}
        entityType="Complaint"
        title="Help Desk History"
      />
    </div>
  );
};

export default HelpDesk;
