import React, { useState, useEffect, useMemo } from 'react';
import { createComplaint, getComplaints, updateComplaintStatus, getResidents, assignComplaint, getComplaintActivity, getCachedData } from '../services/api';
import type { Complaint, User, AuditLog } from '../types';
import { ComplaintStatus, ComplaintCategory, UserRole } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import AuditLogModal from '../components/AuditLogModal';
import FeedbackModal from '../components/ui/FeedbackModal';
import { 
    PlusIcon, 
    ChevronDownIcon, 
    HistoryIcon, 
    ClipboardDocumentListIcon, 
    ClockIcon, 
    ArrowRightIcon, 
    CheckCircleIcon, 
    UserIcon, 
    WrenchIcon, 
    ShieldCheckIcon,
    IdentificationIcon,
    HomeIcon,
    AlertTriangleIcon
} from '../components/icons';
import { useAuth } from '../hooks/useAuth';

const StatusBadge: React.FC<{ status: ComplaintStatus }> = ({ status }) => {
    const statusStyles: Record<ComplaintStatus, string> = {
        [ComplaintStatus.Pending]: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400',
        [ComplaintStatus.InProgress]: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
        [ComplaintStatus.OnHold]: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400',
        [ComplaintStatus.Completed]: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
        [ComplaintStatus.Resolved]: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
    };
    return <span className={`px-2.5 py-1 text-[8px] font-black uppercase tracking-widest rounded-lg shadow-sm border border-black/5 dark:border-white/5 ${statusStyles[status]}`}>{status}</span>;
}

const HelpDesk: React.FC = () => {
  const { user } = useAuth();
  const cacheKey = `complaints:${user?.communityId}:${user?.role === UserRole.Admin ? 'all' : user?.id}`;
  
  const [complaints, setComplaints] = useState<Complaint[]>(() => getCachedData(cacheKey) || []);
  const [agents, setAgents] = useState<User[]>([]);
  const [activityLogs, setActivityLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(!getCachedData(cacheKey));
  const [historyLoading, setHistoryLoading] = useState(false);
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isThreadOpen, setIsThreadOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  
  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ComplaintCategory>(ComplaintCategory.Other);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');

  const [feedback, setFeedback] = useState<{ isOpen: boolean; type: 'success' | 'error' | 'info'; title: string; message: string }>({
      isOpen: false, type: 'success', title: '', message: ''
  });

  // Policy: Only HelpdeskAdmin and SuperAdmin have routing powers. 
  // Community Admins (UserRole.Admin) can only oversee status.
  const isHelpdeskAdmin = user?.role === UserRole.HelpdeskAdmin || user?.role === UserRole.SuperAdmin;
  const isAgent = user?.role === UserRole.HelpdeskAgent;
  const isCommunityAdmin = user?.role === UserRole.Admin;
  const canSeeWorkspace = isHelpdeskAdmin || isAgent || isCommunityAdmin;

  const fetchComplaints = async () => {
    if (user?.communityId) {
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
          } catch (e) { console.error(e); }
      }
  };

  const fetchActivity = async (complaintId: string) => {
      if (!user?.communityId) return;
      setHistoryLoading(true);
      try {
          const logs = await getComplaintActivity(complaintId, user.communityId);
          setActivityLogs(Array.isArray(logs) ? logs : []);
      } catch (e) { 
          console.error("Activity Fetch Failure:", e);
          setActivityLogs([]);
      } finally { setHistoryLoading(false); }
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
          setFeedback({ isOpen: true, type: 'success', title: 'Ticket Logged', message: 'Your support request has been dispatched to the helpdesk team shared queue.' });
          setIsModalOpen(false); 
          setTitle(''); setDescription(''); setCategory(ComplaintCategory.Other);
          await fetchComplaints();
      } catch (error: any) { 
          setFeedback({ isOpen: true, type: 'error', title: 'Transmission Error', message: error.message });
      } finally { setIsSubmitting(false); }
  };

  const handleUpdateStatus = async (newStatus: ComplaintStatus) => {
      if (!selectedComplaint) return;
      setIsSubmitting(true);
      try {
          await updateComplaintStatus(selectedComplaint.id, newStatus);
          await fetchComplaints();
          await fetchActivity(selectedComplaint.id);
      } catch (error: any) { 
          setFeedback({ isOpen: true, type: 'error', title: 'Update Failed', message: error.message });
      } finally { setIsSubmitting(false); }
  };

  const handleClaimTicket = async () => {
      if (!selectedComplaint || !user) return;
      setIsSubmitting(true);
      try {
          await assignComplaint(selectedComplaint.id, user.id);
          await fetchComplaints();
          await fetchActivity(selectedComplaint.id);
      } catch (error: any) { 
          setFeedback({ isOpen: true, type: 'error', title: 'Routing Error', message: error.message });
      } finally { setIsSubmitting(false); }
  };

  const handleManualAssign = async () => {
      if (!selectedComplaint || !selectedAgentId) return;
      setIsSubmitting(true);
      try {
          await assignComplaint(selectedComplaint.id, selectedAgentId);
          await fetchComplaints();
          await fetchActivity(selectedComplaint.id);
      } catch (error: any) { 
          setFeedback({ isOpen: true, type: 'error', title: 'Assignment Failed', message: error.message });
      } finally { setIsSubmitting(false); }
  };

  const displayedComplaints = filterCategory === 'All' ? complaints : complaints.filter(c => c.category === filterCategory);

  const openThread = (complaint: Complaint) => {
      setSelectedComplaint(complaint);
      setIsThreadOpen(true);
      setSelectedAgentId(complaint.assignedTo || '');
      fetchActivity(complaint.id);
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 min-h-[5rem]">
        <div className="flex items-start gap-3">
            <div className="w-1 h-10 bg-brand-500 rounded-full mt-1" />
            <div>
                <span className="text-[9px] font-mono font-black uppercase tracking-[0.3em] text-brand-600 dark:text-brand-400 mb-0.5 block">Service Management</span>
                <h1 className="text-2xl sm:text-3xl font-brand font-extrabold text-brand-600 dark:text-brand-400 tracking-tight leading-tight">Help Desk</h1>
            </div>
        </div>
        <div className="flex gap-2">
            <Button onClick={() => setIsAuditOpen(true)} variant="outlined" size="md" leftIcon={<HistoryIcon />}>System Logs</Button>
            <Button onClick={() => setIsModalOpen(true)} size="md" leftIcon={<PlusIcon />}>Raise Ticket</Button>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-white dark:bg-zinc-900/40 p-1.5 rounded-2xl w-fit overflow-x-auto no-scrollbar max-w-full shadow-sm border border-slate-50 dark:border-white/5">
          {['All', ...Object.values(ComplaintCategory)].map(cat => (
              <button 
                  key={cat} 
                  onClick={() => setFilterCategory(cat)} 
                  className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${filterCategory === cat ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
              >
                  {cat}
              </button>
          ))}
      </div>
      
      <div className="grid grid-cols-1 gap-4">
        {loading && complaints.length === 0 ? (
             Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-36 bg-slate-100 dark:bg-white/5 rounded-[2.5rem] animate-pulse" />)
        ) : displayedComplaints.length === 0 ? (
            <div className="py-24 text-center border-2 border-dashed border-slate-100 dark:border-white/5 rounded-[3rem] opacity-30">
                <ShieldCheckIcon className="w-16 h-16 mx-auto mb-4" />
                <p className="font-brand font-extrabold text-xl">Inbox Clear</p>
                <p className="text-[10px] font-black uppercase tracking-widest mt-1">No pending issues in this category</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayedComplaints.map((complaint) => (
                    <Card 
                        key={complaint.id} 
                        onClick={() => openThread(complaint)}
                        className="p-6 bg-white dark:bg-zinc-900/40 rounded-[2.5rem] border border-slate-50 dark:border-white/5 shadow-sm hover:scale-[1.005] transition-all cursor-pointer group"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-2">
                                    <StatusBadge status={complaint.status} />
                                    <span className="text-[9px] font-black uppercase text-slate-400 bg-slate-50 dark:bg-white/5 px-2 py-0.5 rounded-md">{complaint.category}</span>
                                </div>
                                <h3 className="text-xl font-brand font-extrabold text-slate-900 dark:text-slate-50 leading-tight group-hover:text-brand-600 transition-colors">{complaint.title}</h3>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-[8px] font-black uppercase text-slate-400 mb-1">Log Date</p>
                                <p className="text-xs font-bold text-slate-900 dark:text-slate-200">{new Date(complaint.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                            </div>
                        </div>

                        <p className="text-sm text-slate-500 dark:text-zinc-400 font-medium line-clamp-2 leading-relaxed max-w-4xl leading-relaxed">
                            {complaint.description}
                        </p>

                        <div className="mt-6 pt-5 border-t border-slate-50 dark:border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-brand-500/10 flex items-center justify-center font-black text-brand-600 text-[10px]">{complaint.residentName?.[0]?.toUpperCase()}</div>
                                {<div>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-800 dark:text-zinc-300">{complaint.residentName}</p>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase">Unit: {complaint.flatNumber}</p>
                                </div>}
                            </div>
                            <ArrowRightIcon className="w-4 h-4 text-slate-300 group-hover:text-brand-600 transition-colors" />
                        </div>
                    </Card>
                ))}
            </div>
        )}
      </div>

      {/* Raised Ticket Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Support Request" subtitle="LOG SERVICE TICKET" size="lg">
        <form className="space-y-6" onSubmit={handleCreateTicket}>
            <div className="p-6 bg-slate-50 dark:bg-black/20 rounded-[2rem] border border-slate-100 dark:border-white/5 space-y-4">
                <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Issue Summary</label>
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} required placeholder="Brief title of the problem..." className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold shadow-inner"/>
                </div>
                <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Service Category</label>
                    <div className="relative">
                        <select value={category} onChange={e => setCategory(e.target.value as ComplaintCategory)} className="block w-full px-4 py-3 rounded-xl input-field text-xs font-bold appearance-none bg-white dark:bg-zinc-900">
                            {Object.values(ComplaintCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                        <ChevronDownIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                </div>
            </div>
            <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Detailed Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} required rows={6} placeholder="Provide specific details to help the maintenance team..." className="block w-full px-5 py-4 rounded-[2rem] input-field text-sm font-medium leading-relaxed resize-none shadow-inner"/>
            </div>
            <div className="flex justify-end pt-4 border-t border-slate-50 dark:border-white/5 gap-3">
                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Discard</Button>
                <Button type="submit" disabled={isSubmitting} size="lg" className="px-10" leftIcon={isSubmitting ? <Spinner /> : <CheckCircleIcon />}>
                    {isSubmitting ? 'Transmitting...' : 'Log Ticket'}
                </Button>
            </div>
        </form>
      </Modal>

      {/* Ticket Thread / Detail Modal */}
      <Modal isOpen={isThreadOpen} onClose={() => setIsThreadOpen(false)} title="Issue Thread" subtitle={`REF: ${String(selectedComplaint?.id || '').substring(0, 8).toUpperCase()}`} size="lg">
        {selectedComplaint && (
            <div className="space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-5 bg-slate-50 dark:bg-black/20 rounded-3xl border border-slate-100 dark:border-white/5">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Current Standing</p>
                        <StatusBadge status={selectedComplaint.status} />
                    </div>
                    <div className="p-5 bg-slate-50 dark:bg-black/20 rounded-3xl border border-slate-100 dark:border-white/5">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Assigned Agent</p>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-md bg-brand-500/10 flex items-center justify-center font-black text-brand-600 text-[8px]">{selectedComplaint.assignedToName?.[0] || '?' }</div>
                            <p className="text-[11px] font-bold text-slate-900 dark:text-zinc-200">{selectedComplaint.assignedToName || 'Helpdesk Team Pool'}</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <h4 className="text-2xl font-brand font-extrabold text-slate-900 dark:text-slate-50 leading-tight">{selectedComplaint.title}</h4>
                        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[9px] font-black uppercase text-slate-400 tracking-widest">
                            <p className="flex items-center gap-1.5"><IdentificationIcon className="w-4 h-4" /> By: <span className="text-slate-900 dark:text-zinc-200">{selectedComplaint.residentName}</span></p>
                            <p className="flex items-center gap-1.5"><HomeIcon className="w-4 h-4" /> Unit: <span className="text-slate-900 dark:text-zinc-200">{selectedComplaint.flatNumber}</span></p>
                            <p className="flex items-center gap-1.5"><ClockIcon className="w-4 h-4" /> Reported: <span className="text-slate-900 dark:text-zinc-200">{new Date(selectedComplaint.createdAt).toLocaleString()}</span></p>
                        </div>
                    </div>
                    <div className="p-6 bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 rounded-[2rem]">
                        <p className="text-sm text-slate-600 dark:text-zinc-300 font-medium leading-relaxed whitespace-pre-wrap">{selectedComplaint.description}</p>
                    </div>
                </div>

                {/* Staff Actions Workspace */}
                {canSeeWorkspace && (
                    <div className="p-6 bg-brand-50/50 dark:bg-brand-900/10 rounded-[2rem] border border-brand-100/50 dark:border-brand-900/20 space-y-6">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-1.5 h-4 bg-brand-500 rounded-full" />
                            <h5 className="text-[10px] font-black uppercase tracking-widest text-brand-600">Helpdesk Staff Workspace</h5>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Transition Status</label>
                                <div className="relative">
                                    <select 
                                        className="block w-full px-4 py-2.5 rounded-xl input-field text-[10px] font-black uppercase tracking-widest appearance-none bg-white dark:bg-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                        value={selectedComplaint.status}
                                        onChange={(e) => handleUpdateStatus(e.target.value as ComplaintStatus)}
                                        disabled={isSubmitting || isCommunityAdmin}
                                    >
                                        {Object.values(ComplaintStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    {!isCommunityAdmin && <ChevronDownIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />}
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Route to Staff</label>
                                {isHelpdeskAdmin ? (
                                    <div className="relative">
                                        <select 
                                            className="block w-full px-4 py-2.5 rounded-xl input-field text-[10px] font-black uppercase tracking-widest appearance-none bg-white dark:bg-zinc-900"
                                            value={selectedAgentId}
                                            onChange={(e) => setSelectedAgentId(e.target.value)}
                                            disabled={isSubmitting}
                                        >
                                            <option value="">Choose Agent...</option>
                                            <option value="">Unassign / Return to Pool</option>
                                            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                        </select>
                                        <ChevronDownIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                    </div>
                                ) : isAgent ? (
                                    <Button 
                                        variant="outlined" 
                                        size="md" 
                                        className="w-full h-10 text-[9px]" 
                                        onClick={handleClaimTicket}
                                        disabled={selectedComplaint.assignedTo === user?.id || isSubmitting}
                                        leftIcon={isSubmitting ? <Spinner /> : undefined}
                                    >
                                        {selectedComplaint.assignedTo === user?.id ? 'Claimed by You' : 'Self-Assign'}
                                    </Button>
                                ) : (
                                    <div className="p-3 bg-white/50 rounded-xl text-[8px] font-bold text-slate-400 uppercase text-center border border-dashed">
                                        Routing Managed by Helpdesk Staff
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {isHelpdeskAdmin && selectedAgentId !== selectedComplaint.assignedTo && (
                            <Button 
                                className="w-full h-11" 
                                onClick={handleManualAssign} 
                                disabled={isSubmitting}
                                leftIcon={isSubmitting ? <Spinner /> : undefined}
                            >
                                Update Ticket Assignment
                            </Button>
                        )}
                    </div>
                )}

                {/* Audit Timeline */}
                <div className="space-y-4 pt-4 border-t border-slate-50 dark:border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-1.5 h-6 bg-brand-500 rounded-full" />
                        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Resolution Manifest</h2>
                    </div>
                    
                    <div className="space-y-4 max-h-[250px] overflow-y-auto pr-2 no-scrollbar">
                        {historyLoading ? (
                            <div className="flex justify-center p-8"><Spinner /></div>
                        ) : !activityLogs || !Array.isArray(activityLogs) || activityLogs.length === 0 ? (
                            <div className="py-10 text-center border-2 border-dashed border-slate-100 dark:border-white/5 rounded-3xl opacity-30">
                                <ClockIcon className="w-8 h-8 mx-auto mb-2" />
                                <p className="text-[9px] font-black uppercase tracking-widest">Awaiting system handshake</p>
                            </div>
                        ) : (
                            activityLogs.map((log, idx) => (
                                <div key={log.id} className="relative pl-8 pb-4 last:pb-0">
                                    {idx < activityLogs.length - 1 && <div className="absolute left-[11px] top-4 bottom-0 w-[1px] bg-slate-100 dark:bg-white/5" />}
                                    <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-white dark:bg-zinc-800 border-2 border-slate-100 dark:border-white/10 flex items-center justify-center z-10">
                                        <div className="w-2 h-2 rounded-full bg-brand-500 shadow-[0_0_8px_#14b8a6]" />
                                    </div>
                                    <div className="p-4 bg-slate-50/50 dark:bg-white/[0.01] rounded-2xl border border-slate-100 dark:border-white/5">
                                        <p className="text-sm font-bold text-slate-800 dark:text-zinc-200">{log.details.description}</p>
                                        <div className="mt-2 flex items-center justify-between text-[8px] font-black uppercase tracking-widest text-slate-400">
                                            <p className="flex items-center gap-1.5"><UserIcon className="w-3.5 h-3.5" /> {log.actorName}</p>
                                            <p className="flex items-center gap-1.5"><ClockIcon className="w-3.5 h-3.5" /> {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
                
                <div className="pt-4 border-t border-slate-50 dark:border-white/5 flex justify-end">
                    <Button variant="ghost" onClick={() => setIsThreadOpen(false)}>Close Thread</Button>
                </div>
            </div>
        )}
      </Modal>

      <AuditLogModal isOpen={isAuditOpen} onClose={() => setIsAuditOpen(false)} entityType="Complaint" title="Support Audit Logs" />
      <FeedbackModal isOpen={feedback.isOpen} onClose={() => setFeedback({ ...feedback, isOpen: false })} title={feedback.title} message={feedback.message} type={feedback.type} />
    </div>
  );
};

export default HelpDesk;