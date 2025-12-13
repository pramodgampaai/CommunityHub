
import React, { useState, useEffect } from 'react';
import { createComplaint, getComplaints, updateComplaintStatus, getResidents, assignComplaint } from '../services/api';
import type { Complaint, User } from '../types';
import { ComplaintStatus, ComplaintCategory, UserRole } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import AuditLogModal from '../components/AuditLogModal';
import { PlusIcon, ChevronDownIcon, CheckCircleIcon, HistoryIcon, ClipboardDocumentListIcon, ShieldCheckIcon, UsersIcon, UserGroupIcon } from '../components/icons';
import { useAuth } from '../hooks/useAuth';

const StatusBadge: React.FC<{ status: ComplaintStatus }> = ({ status }) => {
    const statusStyles: Record<ComplaintStatus, string> = {
        [ComplaintStatus.Pending]: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
        [ComplaintStatus.InProgress]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
        [ComplaintStatus.Completed]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
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

type AdminTab = 'unassigned' | 'mine' | 'team' | 'all';
type AgentTab = 'mine' | 'unassigned' | 'history';

const HelpDesk: React.FC = () => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [availableAgents, setAvailableAgents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user } = useAuth();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  
  // Routing / View State
  const [activeAdminTab, setActiveAdminTab] = useState<AdminTab>('unassigned');
  const [activeAgentTab, setActiveAgentTab] = useState<AgentTab>('mine');

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
  
  // ROLES & PERMISSIONS
  const isHelpdeskAdmin = user?.role === UserRole.HelpdeskAdmin;
  const isAdmin = user?.role === UserRole.Admin;
  const isAgent = user?.role === UserRole.HelpdeskAgent;
  const isStaff = isHelpdeskAdmin || isAgent || isAdmin;

  // FETCH DATA
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
          // Only list Helpdesk Staff (Agents or Admins) as potential assignees
          const agents = users.filter(u => u.role === UserRole.HelpdeskAgent || u.role === UserRole.HelpdeskAdmin);
          setAvailableAgents(agents);
      } catch (error) {
          console.error("Failed to fetch agents", error);
      }
  }
  
  useEffect(() => {
    if (user?.communityId) {
        fetchComplaints(user.communityId);
        // Only fetch agents if the user has permission to assign (HelpdeskAdmin)
        if (isHelpdeskAdmin) {
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
        await fetchComplaints(user.communityId); 
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
          // Optimistic update
          const agent = availableAgents.find(a => a.id === agentId);
          setComplaints(prev => prev.map(c => c.id === complaintId ? { ...c, assignedTo: agentId, assignedToName: agent?.name || 'Assigned' } : c));
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
          message: "Are you sure you want to close this ticket? This confirms the issue is fixed.",
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

  // --- Filtering Logic for View Routing ---
  const getFilteredComplaints = () => {
      // 1. Admin: Global Dashboard
      if (isAdmin) return complaints;
      
      // 2. Helpdesk Admin: Distinct Tabs to manage flow
      if (isHelpdeskAdmin) {
          if (activeAdminTab === 'unassigned') {
              // Strictly Unassigned AND Active
              return complaints.filter(c => !c.assignedTo && c.status !== ComplaintStatus.Resolved);
          }
          if (activeAdminTab === 'mine') {
              // Assigned to Me AND Active
              return complaints.filter(c => c.assignedTo === user?.id && c.status !== ComplaintStatus.Resolved);
          }
          if (activeAdminTab === 'team') {
              // Assigned to Others AND Active
              return complaints.filter(c => c.assignedTo && c.assignedTo !== user?.id && c.status !== ComplaintStatus.Resolved);
          }
          // 'all' - Everything (Active + Resolved)
          return complaints; 
      }

      // 3. Helpdesk Agent: Distinct Tabs
      if (isAgent) {
          if (activeAgentTab === 'mine') {
              // Assigned to Me AND Active
              return complaints.filter(c => c.assignedTo === user?.id && c.status !== ComplaintStatus.Resolved);
          }
          if (activeAgentTab === 'unassigned') {
              // Unassigned work (Cherry Picking)
              return complaints.filter(c => !c.assignedTo && c.status !== ComplaintStatus.Resolved);
          }
          // My History
          return complaints.filter(c => c.assignedTo === user?.id && c.status === ComplaintStatus.Resolved);
      }

      // 4. Resident: See what API returned (Own)
      return complaints; 
  };

  const displayedComplaints = getFilteredComplaints();
  
  // Badge Counts for Helpdesk Admin
  const unassignedCount = complaints.filter(c => !c.assignedTo && c.status !== ComplaintStatus.Resolved).length;
  const myAdminCount = complaints.filter(c => c.assignedTo === user?.id && c.status !== ComplaintStatus.Resolved).length;
  
  // Badge Counts for Agent
  const myAgentCount = complaints.filter(c => c.assignedTo === user?.id && c.status !== ComplaintStatus.Resolved).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center animated-card">
        <div>
            <h2 className="text-2xl font-bold text-[var(--text-light)] dark:text-[var(--text-dark)]">Help Desk</h2>
            {isHelpdeskAdmin && <p className="text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Dispatcher Dashboard</p>}
            {isAgent && <p className="text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Agent Dashboard</p>}
            {isAdmin && <p className="text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Global Dashboard</p>}
        </div>
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
            {/* Residents or Admins (acting as residents) can create complaints */}
            {(!isAgent && !isHelpdeskAdmin) || isAdmin ? (
                <Button onClick={() => setIsModalOpen(true)} leftIcon={<PlusIcon className="w-5 h-5"/>} aria-label="Raise New Complaint" variant="fab">
                    <span className="hidden sm:inline">New Complaint</span>
                    <span className="sm:hidden">New</span>
                </Button>
            ) : null}
        </div>
      </div>
      
      {/* Helpdesk Admin Tabs */}
      {isHelpdeskAdmin && (
          <div className="flex space-x-1 p-1 bg-black/5 dark:bg-white/5 rounded-xl mb-4 animated-card overflow-x-auto no-scrollbar">
              <button
                  onClick={() => setActiveAdminTab('unassigned')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
                      activeAdminTab === 'unassigned'
                          ? 'bg-white dark:bg-gray-800 text-[var(--accent)] shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                          : 'text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] hover:bg-white/50 dark:hover:bg-black/20'
                  }`}
              >
                  <ShieldCheckIcon className="w-4 h-4" />
                  <span>Inbox</span>
                  {unassignedCount > 0 && (
                      <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center font-bold">
                          {unassignedCount}
                      </span>
                  )}
              </button>
              <button
                  onClick={() => setActiveAdminTab('mine')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
                      activeAdminTab === 'mine'
                          ? 'bg-white dark:bg-gray-800 text-[var(--accent)] shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                          : 'text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] hover:bg-white/50 dark:hover:bg-black/20'
                  }`}
              >
                  <span>My Tasks</span>
                  {myAdminCount > 0 && (
                      <span className="bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center font-bold">
                          {myAdminCount}
                      </span>
                  )}
              </button>
              <button
                  onClick={() => setActiveAdminTab('team')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
                      activeAdminTab === 'team'
                          ? 'bg-white dark:bg-gray-800 text-[var(--accent)] shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                          : 'text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] hover:bg-white/50 dark:hover:bg-black/20'
                  }`}
              >
                  <UserGroupIcon className="w-4 h-4" />
                  <span>Team</span>
              </button>
              <button
                  onClick={() => setActiveAdminTab('all')}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
                      activeAdminTab === 'all'
                          ? 'bg-white dark:bg-gray-800 text-[var(--text-light)] dark:text-[var(--text-dark)] shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                          : 'text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] hover:bg-white/50 dark:hover:bg-black/20'
                  }`}
              >
                  All History
              </button>
          </div>
      )}

      {/* Helpdesk Agent Tabs */}
      {isAgent && (
          <div className="flex space-x-1 p-1 bg-black/5 dark:bg-white/5 rounded-xl mb-4 animated-card overflow-x-auto">
              <button
                  onClick={() => setActiveAgentTab('mine')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
                      activeAgentTab === 'mine'
                          ? 'bg-white dark:bg-gray-800 text-[var(--accent)] shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                          : 'text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] hover:bg-white/50 dark:hover:bg-black/20'
                  }`}
              >
                  <span>My Tasks</span>
                  {myAgentCount > 0 && (
                      <span className="bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center font-bold">
                          {myAgentCount}
                      </span>
                  )}
              </button>
              <button
                  onClick={() => setActiveAgentTab('unassigned')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
                      activeAgentTab === 'unassigned'
                          ? 'bg-white dark:bg-gray-800 text-[var(--accent)] shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                          : 'text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] hover:bg-white/50 dark:hover:bg-black/20'
                  }`}
              >
                  <ShieldCheckIcon className="w-4 h-4" />
                  <span>Inbox</span>
                  {unassignedCount > 0 && (
                      <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center font-bold">
                          {unassignedCount}
                      </span>
                  )}
              </button>
              <button
                  onClick={() => setActiveAgentTab('history')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
                      activeAgentTab === 'history'
                          ? 'bg-white dark:bg-gray-800 text-[var(--text-light)] dark:text-[var(--text-dark)] shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                          : 'text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] hover:bg-white/50 dark:hover:bg-black/20'
                  }`}
              >
                  <HistoryIcon className="w-4 h-4" />
                  <span>History</span>
              </button>
          </div>
      )}

      <div className="space-y-4">
        {loading ? (
             Array.from({ length: 3 }).map((_, index) => <ComplaintSkeleton key={index} />)
        ) : (
            displayedComplaints.length === 0 ? (
                <div className="p-12 flex flex-col items-center justify-center text-center text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] border-2 border-dashed border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-xl">
                    <ClipboardDocumentListIcon className="w-12 h-12 mb-3 opacity-20" />
                    <p className="text-lg font-medium">No tickets found.</p>
                    {isHelpdeskAdmin && activeAdminTab === 'unassigned' && <p className="text-sm mt-1 text-green-600 dark:text-green-400">Inbox clear! All tickets dispatched.</p>}
                    {isAgent && activeAgentTab === 'mine' && <p className="text-sm mt-1 text-green-600 dark:text-green-400">You have no pending tasks assigned to you.</p>}
                    {isAgent && activeAgentTab === 'unassigned' && <p className="text-sm mt-1 text-green-600 dark:text-green-400">No unassigned tickets available.</p>}
                </div>
            ) : (
                displayedComplaints.map((complaint, index) => {
                    const isResolved = complaint.status === ComplaintStatus.Resolved;
                    const isCompleted = complaint.status === ComplaintStatus.Completed;

                    // --- PERMISSION LOGIC ---
                    
                    const isAssignedToMe = complaint.assignedTo === user?.id;
                    const isUnassigned = !complaint.assignedTo;
                    const isOwner = user?.id === complaint.userId;

                    // 1. Resolve Action: Visible Only to Ticket Owner AND only when status is Completed
                    const canResolve = isOwner && isCompleted;
                    
                    // 2. Complete Action: Visible to Assigned Agent/Admin AND only when In Progress
                    const canComplete = !isResolved && !isCompleted && 
                        complaint.status === ComplaintStatus.InProgress && 
                        (isAdmin || isHelpdeskAdmin || (isAgent && isAssignedToMe));

                    // 3. Assignment: STRICTLY restricted to Helpdesk Admin.
                    const canAssign = isHelpdeskAdmin && !isResolved && !isCompleted;

                    // 4. Agent "Cherry Pick": If unassigned, Agent can assign to self
                    const canSelfAssign = isAgent && isUnassigned && !isResolved && !isCompleted;

                    return (
                        <Card key={complaint.id} className="p-5 animated-card border-l-4 border-l-transparent hover:border-l-[var(--accent)] transition-all" style={{ animationDelay: `${index * 50}ms` }}>
                            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-start gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                                            {complaint.category}
                                        </span>
                                        <span className="text-xs text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                                            #{String(complaint.id).substring(0, 6)}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-semibold text-[var(--text-light)] dark:text-[var(--text-dark)]">{complaint.title}</h3>
                                    <p className="text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mt-1">
                                        From <span className="font-medium text-[var(--text-light)] dark:text-[var(--text-dark)]">{complaint.residentName}</span> ({complaint.flatNumber})
                                    </p>
                                    <p className="text-xs text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mt-0.5">
                                        {new Date(complaint.createdAt).toLocaleString()}
                                    </p>
                                    
                                    {/* Assignment Status Display */}
                                    <div className="mt-3 text-sm flex items-center gap-2">
                                        <span className="text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Assigned to: </span>
                                        {complaint.assignedToName ? (
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">
                                                    {complaint.assignedToName.charAt(0)}
                                                </div>
                                                <span className="font-medium text-[var(--text-light)] dark:text-[var(--text-dark)]">
                                                    {complaint.assignedToName}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="font-medium px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
                                                Unassigned
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-col items-stretch sm:items-end gap-3 w-full sm:w-auto sm:min-w-[200px]">
                                    <div className="flex items-center gap-2 w-full justify-end">
                                        <StatusBadge status={complaint.status} />
                                    </div>

                                    {/* Staff: Mark Completed */}
                                    {canComplete && (
                                        <Button 
                                            size="sm" 
                                            variant="outlined" 
                                            className="text-xs py-1.5 px-3 border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 w-full justify-center"
                                            onClick={() => handleStatusChange(complaint.id, ComplaintStatus.Completed)}
                                            leftIcon={<CheckCircleIcon className="w-3.5 h-3.5" />}
                                        >
                                            Mark Completed
                                        </Button>
                                    )}

                                    {/* Resident: Mark Resolved (Closure) */}
                                    {canResolve && (
                                        <Button 
                                            size="sm" 
                                            variant="outlined" 
                                            className="text-xs py-1.5 px-3 border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 w-full justify-center"
                                            onClick={() => promptResolve(complaint)}
                                            leftIcon={<CheckCircleIcon className="w-3.5 h-3.5" />}
                                        >
                                            Mark Resolved
                                        </Button>
                                    )}
                                    
                                    {/* Agent Self-Assign */}
                                    {canSelfAssign && (
                                        <Button 
                                            size="sm"
                                            onClick={() => handleStatusChange(complaint.id, ComplaintStatus.InProgress)
                                                .then(() => handleAssignAgent(complaint.id, user!.id))
                                            }
                                            disabled={assigningId === complaint.id}
                                            className="w-full justify-center"
                                        >
                                            {assigningId === complaint.id ? 'Assigning...' : 'Pick Up Ticket'}
                                        </Button>
                                    )}

                                    {/* Assignment Dropdown - STRICTLY Helpdesk Admin Only */}
                                    {canAssign && (
                                        <div className="w-full pt-2 border-t border-[var(--border-light)] dark:border-[var(--border-dark)] mt-1">
                                            <label className="text-[10px] text-[var(--text-secondary-light)] uppercase font-bold mb-1 block">Dispatch To</label>
                                            <div className="relative">
                                                <select
                                                    value={complaint.assignedTo || ""}
                                                    onChange={(e) => handleAssignAgent(complaint.id, e.target.value)}
                                                    disabled={assigningId === complaint.id}
                                                    className="w-full text-sm appearance-none bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md pl-3 pr-8 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50 text-[var(--text-light)] dark:text-[var(--text-dark)] cursor-pointer"
                                                >
                                                    <option value="">-- Unassigned --</option>
                                                    {availableAgents.map(agent => (
                                                        <option key={agent.id} value={agent.id}>{agent.name} ({agent.role})</option>
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
                            <div className="mt-4 p-3 bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] rounded-lg border border-[var(--border-light)] dark:border-[var(--border-dark)]">
                                <p className="text-sm text-[var(--text-light)] dark:text-[var(--text-dark)] whitespace-pre-wrap">{complaint.description}</p>
                            </div>
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
