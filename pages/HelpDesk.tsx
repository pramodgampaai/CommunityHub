
import React, { useState, useEffect } from 'react';
import { createComplaint, getComplaints, updateComplaintStatus, getResidents, assignComplaint, getComplaintActivity } from '../services/api';
import type { Complaint, User, AuditLog } from '../types';
import { ComplaintStatus, ComplaintCategory, UserRole } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import AuditLogModal from '../components/AuditLogModal';
import FeedbackModal from '../components/ui/FeedbackModal';
import { PlusIcon, ChevronDownIcon, CheckCircleIcon, HistoryIcon, ClipboardDocumentListIcon, ShieldCheckIcon, UserGroupIcon, ClockIcon, FunnelIcon, ArrowRightIcon } from '../components/icons';
import { useAuth } from '../hooks/useAuth';

const StatusBadge: React.FC<{ status: ComplaintStatus }> = ({ status }) => {
    const statusStyles: Record<ComplaintStatus, string> = {
        [ComplaintStatus.Pending]: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
        [ComplaintStatus.InProgress]: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400',
        [ComplaintStatus.OnHold]: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400',
        [ComplaintStatus.Completed]: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
        [ComplaintStatus.Resolved]: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
    };
    return <span className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-full ${statusStyles[status]}`}>{status}</span>;
}

const HelpDesk: React.FC = () => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [agents, setAgents] = useState<User[]>([]);
  const [activityLogs, setActivityLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isThreadOpen, setIsThreadOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  
  const { user } = useAuth();
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ComplaintCategory>(ComplaintCategory.Other);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');

  const isHelpdeskAdmin = user?.role === UserRole.HelpdeskAdmin;
  const isAgent = user?.role === UserRole.HelpdeskAgent;
  const isSuperOrAdmin = user?.role === UserRole.Admin || user?.role === UserRole.SuperAdmin;

  const fetchComplaints = async () => {
    if (user?.communityId) {
        setLoading(true);
        try {
            const data = await getComplaints(user.communityId, user?.id, user?.role);
            setComplaints(data);
            
            if (selectedComplaint) {
                const updated = data.find(c => c.id === selectedComplaint.id);
                if (updated) setSelectedComplaint(updated);
            }
        } catch (e) { console.error(e); } finally { setLoading(false); }
    }
  };

  const fetchAgents = async () => {
      if (user?.communityId && isHelpdeskAdmin) {
          try {
              const allUsers = await getResidents(user.communityId);
              const helpStaff = allUsers.filter(u => u.role === UserRole.HelpdeskAgent || u.role === UserRole.HelpdeskAdmin);
              setAgents(helpStaff);
          } catch (e) {
              console.error("Failed to fetch staff for routing", e);
          }
      }
  };

  const fetchActivity = async (complaintId: string) => {
      setHistoryLoading(true);
      try {
          const logs = await getComplaintActivity(complaintId);
          setActivityLogs(logs);
      } catch (e) {
          console.error("Activity fetch failed", e);
      } finally {
          setHistoryLoading(false);
      }
  };

  useEffect(() => { 
      fetchComplaints();
      if (isHelpdeskAdmin) fetchAgents();
  }, [user]);

  const handleCreateTicket = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      setIsSubmitting(true);
      try {
          await createComplaint({ title, description, category }, user);
          setIsModalOpen(false); setTitle(''); setDescription(''); setCategory(ComplaintCategory.Other);
          await fetchComplaints();
      } catch (error) { console.error("Failed to create ticket:", error); } finally { setIsSubmitting(false); }
  };

  const handleUpdateStatus = async (newStatus: ComplaintStatus) => {
      if (!selectedComplaint) return;
      setIsSubmitting(true);
      try {
          await updateComplaintStatus(selectedComplaint.id, newStatus);
          await fetchComplaints();
          await fetchActivity(selectedComplaint.id);
      } catch (error) {
          console.error("Status update failed", error);
          alert("Failed to update ticket status.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleClaimTicket = async () => {
      if (!selectedComplaint || !user) return;
      setIsSubmitting(true);
      try {
          await assignComplaint(selectedComplaint.id, user.id);
          await fetchComplaints();
          await fetchActivity(selectedComplaint.id);
      } catch (error) {
          console.error("Assignment failed", error);
          alert("Failed to claim ticket.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleManualAssign = async () => {
      if (!selectedComplaint || !selectedAgentId) return;
      setIsSubmitting(true);
      try {
          await assignComplaint(selectedComplaint.id, selectedAgentId);
          await fetchComplaints();
          await fetchActivity(selectedComplaint.id);
          alert("Ticket routed successfully.");
      } catch (error) {
          console.error("Manual routing failed", error);
          alert("Failed to route ticket.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const displayedComplaints = filterCategory === 'All' ? complaints : complaints.filter(c => c.category === filterCategory);

  const openThread = (complaint: Complaint) => {
      setSelectedComplaint(complaint);
      setIsThreadOpen(true);
      setSelectedAgentId(complaint.assignedTo || '');
      fetchActivity(complaint.id);
  };

  const isCreator = user?.id === selectedComplaint?.userId;
  const isAssigned = user?.id === selectedComplaint?.assignedTo;
  const canManageWorkflow = isAssigned;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div className="flex items-start gap-3">
            <div className="w-1 h-10 bg-brand-500 rounded-full mt-1" />
            <div>
                <span className="text-[9px] font-mono font-black uppercase tracking-[0.3em] text-brand-600 dark:text-brand-400 mb-0.5 block">Support Workflow</span>
                <h2 className="text-2xl sm:text-3xl font-brand font-extrabold text-brand-600 tracking-tight leading-tight">Help Desk</h2>
            </div>
        </div>
        <div className="flex gap-2">
            <Button onClick={() => setIsAuditOpen(true)} variant="outlined" size="md" leftIcon={<HistoryIcon />}>Audit</Button>
            <Button onClick={() => setIsModalOpen(true)} size="md" leftIcon={<PlusIcon />}>New Ticket</Button>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-900/40 p-1.5 rounded-xl w-fit overflow-x-auto no-scrollbar max-w-full">
          {['All', ...Object.values(ComplaintCategory)].map(cat => (
              <button key={cat} onClick={() => setFilterCategory(cat)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${filterCategory === cat ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}>{cat}</button>
          ))}
      </div>
      
      <div className="grid grid-cols-1 gap-4">
        {loading ? (
             Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 bg-slate-100 dark:bg-white/5 rounded-2xl animate-pulse" />)
        ) : (
            displayedComplaints.length === 0 ? (
                <div className="p-16 text-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-white/5 rounded-3xl">
                    <ClipboardDocumentListIcon className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="font-bold uppercase tracking-widest text-[10px]">Clear pipeline</p>
                </div>
            ) : (
                displayedComplaints.map((complaint) => (
                    <Card key={complaint.id} className="p-6 hover:scale-[1.002] transition-all bg-white dark:bg-zinc-900/40 rounded-3xl border border-slate-50 dark:border-white/5">
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400 bg-slate-50 dark:bg-white/5 px-2 py-0.5 rounded-md">{complaint.category}</span>
                                    <StatusBadge status={complaint.status} />
                                </div>
                                <h3 className="text-xl font-brand font-extrabold text-slate-900 dark:text-slate-50 tracking-tight leading-tight">{complaint.title}</h3>
                                <p className="mt-2 text-sm text-slate-500 font-medium line-clamp-2">{complaint.description}</p>
                                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400">
                                    <p>Resident: <span className="text-slate-800 dark:text-zinc-300 ml-1">{complaint.residentName}</span></p>
                                    <p>Unit: <span className="text-slate-800 dark:text-zinc-300 ml-1">{complaint.flatNumber}</span></p>
                                    <p className="flex items-center gap-1.5"><ClockIcon className="w-4 h-4" /> {new Date(complaint.createdAt).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <div className="w-full sm:w-auto">
                                <Button variant="outlined" size="md" className="w-full sm:w-auto" onClick={() => openThread(complaint)} leftIcon={<ArrowRightIcon />}>Open Thread</Button>
                            </div>
                        </div>
                    </Card>
                ))
            )
        )}
      </div>

      <AuditLogModal isOpen={isAuditOpen} onClose={() => setIsAuditOpen(false)} entityType="Complaint" title="Support Audit" />
      
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Request" subtitle="Help Desk Ticket" size="md">
        <form className="space-y-4" onSubmit={handleCreateTicket}>
            <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Subject</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Water leak in kitchen" className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold"/>
            </div>
            <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Category</label>
                <select value={category} onChange={e => setCategory(e.target.value as ComplaintCategory)} className="block w-full px-4 py-3 rounded-xl input-field text-xs font-bold appearance-none bg-white dark:bg-zinc-900">
                    {Object.values(ComplaintCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Issue Details</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} required rows={4} placeholder="Describe the problem in detail..." className="block w-full px-4 py-3 rounded-xl input-field text-sm font-medium leading-relaxed"/>
            </div>
            <div className="flex justify-end pt-4">
                <Button type="submit" disabled={isSubmitting} size="lg" className="w-full sm:w-auto">{isSubmitting ? 'Processing...' : 'Log Ticket'}</Button>
            </div>
        </form>
      </Modal>

      <Modal 
        isOpen={isThreadOpen} 
        onClose={() => setIsThreadOpen(false)} 
        title="Ticket Details" 
        subtitle={`REF: ${String(selectedComplaint?.id || '').substring(0, 8).toUpperCase()}`} 
        size="lg"
      >
        {selectedComplaint && (
            <div className="space-y-6">
                <div className="flex flex-wrap gap-2 items-center justify-between">
                    <div className="flex gap-2">
                        <StatusBadge status={selectedComplaint.status} />
                        <span className="px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-full bg-slate-100 dark:bg-white/5 text-slate-500">
                            {selectedComplaint.category}
                        </span>
                    </div>
                    <div className="text-right">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Logged On</p>
                        <p className="text-xs font-bold">{new Date(selectedComplaint.createdAt).toLocaleString()}</p>
                    </div>
                </div>

                <div className="bg-slate-50 dark:bg-white/5 p-6 rounded-[2rem] border border-slate-100 dark:border-white/5">
                    <h4 className="text-xl font-brand font-extrabold text-slate-900 dark:text-slate-50 mb-3 leading-tight">{selectedComplaint.title}</h4>
                    <p className="text-sm text-slate-600 dark:text-zinc-300 font-medium leading-relaxed whitespace-pre-wrap">
                        {selectedComplaint.description}
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-white dark:bg-zinc-900/40 rounded-2xl border border-slate-100 dark:border-white/5">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Requester</p>
                        <p className="text-sm font-extrabold">{selectedComplaint.residentName}</p>
                        <p className="text-[10px] font-bold text-brand-600 mt-0.5">Loc: {selectedComplaint.flatNumber}</p>
                    </div>
                    <div className="p-4 bg-white dark:bg-zinc-900/40 rounded-2xl border border-slate-100 dark:border-white/5">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Assigned Agent</p>
                        <p className="text-sm font-extrabold">
                            {selectedComplaint.assignedToName || <span className="text-slate-400 font-medium italic">Unassigned</span>}
                        </p>
                        {!selectedComplaint.assignedTo && (isAgent || isHelpdeskAdmin) && (
                            <button onClick={handleClaimTicket} className="text-[10px] font-black text-brand-600 uppercase tracking-widest hover:underline mt-1">Claim Ticket</button>
                        )}
                    </div>
                </div>

                {isHelpdeskAdmin && (
                    <div className="p-4 bg-brand-500/5 dark:bg-brand-500/10 rounded-2xl border border-brand-500/20">
                        <h5 className="text-[9px] font-black text-brand-600 dark:text-brand-400 uppercase tracking-[0.2em] mb-3 ml-1">Route & Dispatch</h5>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <div className="flex-1 relative">
                                <select 
                                    value={selectedAgentId} 
                                    onChange={e => setSelectedAgentId(e.target.value)}
                                    className="block w-full px-4 py-2.5 rounded-xl input-field text-xs font-bold appearance-none bg-white dark:bg-zinc-900"
                                >
                                    <option value="">Select Helpdesk Staff...</option>
                                    {agents.map(agent => (
                                        <option key={agent.id} value={agent.id}>{agent.name} ({agent.flatNumber || 'No Post'})</option>
                                    ))}
                                </select>
                                <ChevronDownIcon className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                            <Button 
                                size="md" 
                                disabled={!selectedAgentId || isSubmitting} 
                                onClick={handleManualAssign}
                                className="sm:w-auto w-full"
                            >
                                {isSubmitting ? 'Routing...' : 'Assign Staff'}
                            </Button>
                        </div>
                        <p className="text-[8px] text-slate-400 font-medium mt-2 ml-1 italic">Authorized: Dispatch tickets to specialized agents.</p>
                    </div>
                )}

                <div className="space-y-3 pt-2">
                    <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Activity Trace</h5>
                    <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100 dark:before:bg-white/5">
                        {historyLoading ? (
                             <p className="text-[10px] text-slate-400 animate-pulse italic">Replaying history...</p>
                        ) : activityLogs.length === 0 ? (
                             <p className="text-[10px] text-slate-400 italic">No historical events tracked yet.</p>
                        ) : (
                            activityLogs.map((log) => {
                                let content = log.details.description || `${log.action} performed`;
                                let color = "bg-slate-300";
                                
                                if (log.action === 'CREATE') {
                                    content = `Ticket logged by ${log.actorName}`;
                                    color = "bg-brand-500";
                                } else if (log.details.new?.status) {
                                    content = `Moved to ${log.details.new.status} by ${log.actorName}`;
                                    color = "bg-yellow-500";
                                } else if (log.details.new?.assigned_to) {
                                    content = `Routed to staff by ${log.actorName}`;
                                    color = "bg-blue-500";
                                }

                                return (
                                    <div key={log.id} className="relative">
                                        <div className={`absolute -left-6 w-4 h-4 rounded-full border-4 border-white dark:border-zinc-900 shadow-sm ${color}`} />
                                        <p className="text-xs font-bold text-slate-700 dark:text-zinc-200">{content}</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">{new Date(log.createdAt).toLocaleString()}</p>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {(canManageWorkflow || isCreator) && (
                    <div className="pt-6 border-t border-slate-100 dark:border-white/5">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1 text-center">Manage Resolution</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {canManageWorkflow && [ComplaintStatus.Pending, ComplaintStatus.InProgress, ComplaintStatus.OnHold, ComplaintStatus.Completed].map((status) => (
                                <button 
                                    key={status}
                                    onClick={() => handleUpdateStatus(status)}
                                    disabled={isSubmitting}
                                    className={`px-3 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border-2 text-center flex items-center justify-center ${
                                        selectedComplaint.status === status 
                                        ? 'border-brand-600 text-brand-600 bg-brand-50/50 dark:bg-brand-500/10' 
                                        : 'border-slate-50 dark:border-white/5 text-slate-400 hover:border-slate-200 dark:hover:border-white/10'
                                    }`}
                                >
                                    {status}
                                </button>
                            ))}
                            
                            {isCreator && (
                                <button 
                                    onClick={() => handleUpdateStatus(ComplaintStatus.Resolved)}
                                    disabled={isSubmitting}
                                    className={`px-3 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border-2 text-center flex items-center justify-center sm:col-span-4 ${
                                        selectedComplaint.status === ComplaintStatus.Resolved 
                                        ? 'border-emerald-600 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-500/10' 
                                        : 'border-slate-50 dark:border-white/5 text-slate-400 hover:border-emerald-200 dark:hover:border-emerald-900/20'
                                    }`}
                                >
                                    {selectedComplaint.status === ComplaintStatus.Resolved ? 'Ticket Resolved' : 'Mark as Resolved'}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                <div className="flex justify-end pt-4">
                    <Button variant="outlined" onClick={() => setIsThreadOpen(false)} size="md">Close Thread</Button>
                </div>
            </div>
        )}
      </Modal>
    </div>
  );
};

export default HelpDesk;
