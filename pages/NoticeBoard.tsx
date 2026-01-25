
import React, { useState, useEffect, useMemo } from 'react';
import { createNotice, getNotices, updateNotice, deleteNotice, getCachedData } from '../services/api';
import type { Notice } from '../types';
import { NoticeType, UserRole } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import Modal from '../components/ui/Modal';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import AuditLogModal from '../components/AuditLogModal';
import FeedbackModal from '../components/ui/FeedbackModal';
import { 
    PlusIcon, 
    ClockIcon, 
    PencilIcon, 
    TrashIcon, 
    HistoryIcon, 
    BellIcon, 
    ChevronDownIcon, 
    MagnifyingGlassIcon,
    CalendarIcon,
    ArrowRightIcon,
    IdentificationIcon
} from '../components/icons';
import { useAuth } from '../hooks/useAuth';

const NoticeTag: React.FC<{ type: NoticeType }> = ({ type }) => {
    const typeStyles: Record<NoticeType, string> = {
        [NoticeType.Event]: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
        [NoticeType.Maintenance]: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
        [NoticeType.Urgent]: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400',
        [NoticeType.General]: 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    };
    return <span className={`px-2.5 py-1 text-[8px] font-black uppercase tracking-widest rounded-lg shadow-sm border border-black/5 dark:border-white/5 ${typeStyles[type]}`}>{type}</span>;
}

const NoticeBoard: React.FC = () => {
  const { user } = useAuth();
  const cacheKey = `notices:${user?.communityId}`;
  
  const [notices, setNotices] = useState<Notice[]>(() => getCachedData(cacheKey) || []);
  const [loading, setLoading] = useState(!getCachedData(cacheKey));
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'live' | 'past'>('live');
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
      isOpen: boolean; title: string; message: string; action: () => Promise<void>; isDestructive?: boolean;
  }>({ isOpen: false, title: '', message: '', action: async () => {}, isDestructive: false });

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [noticeType, setNoticeType] = useState<NoticeType>(NoticeType.General);
  const [validFrom, setValidFrom] = useState(new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [feedback, setFeedback] = useState<{ isOpen: boolean; type: 'success' | 'error' | 'info'; title: string; message: string }>({
      isOpen: false, type: 'success', title: '', message: ''
  });

  // ROBUST ADMIN CHECK
  const isAdmin = useMemo(() => {
    if (!user?.role) return false;
    const r = user.role.toLowerCase();
    return ['admin', 'superadmin', 'helpdeskadmin'].includes(r);
  }, [user?.role]);

  const fetchNoticesData = async () => {
    if (!user?.communityId) return;
    try {
      const data = await getNotices(user.communityId);
      setNotices(data);
    } catch (error) {
      console.error("Notice Fetch Failed:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNoticesData(); }, [user]);

  const handleFormSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      setIsSubmitting(true);
      try {
          const payload = { 
              title, content, type: noticeType, 
              validFrom: validFrom ? new Date(validFrom).toISOString() : undefined, 
              validUntil: validUntil ? new Date(validUntil).toISOString() : undefined 
          };

          if (editingId) await updateNotice(editingId, payload, user);
          else await createNotice({ ...payload, author: user.name }, user);
          
          setIsModalOpen(false);
          resetForm();
          await fetchNoticesData();
          setFeedback({ 
              isOpen: true, 
              type: 'success', 
              title: editingId ? 'Notice Updated' : 'Notice Broadcast', 
              message: editingId ? 'Information has been synchronized.' : 'Your announcement is now live on all resident dashboards.' 
          });
      } catch (error: any) {
          setFeedback({ isOpen: true, type: 'error', title: 'Action Failed', message: error.message || 'Could not process the notice.' });
      } finally { setIsSubmitting(false); }
  };

  const resetForm = () => {
      setTitle(''); setContent(''); setNoticeType(NoticeType.General);
      setValidFrom(new Date().toISOString().split('T')[0]); setValidUntil(''); setEditingId(null);
  };

  const handleEditClick = (notice: Notice) => {
      setTitle(notice.title); setContent(notice.content); setNoticeType(notice.type);
      if (notice.validFrom) setValidFrom(new Date(notice.validFrom).toISOString().split('T')[0]);
      if (notice.validUntil) setValidUntil(new Date(notice.validUntil).toISOString().split('T')[0]);
      setEditingId(notice.id); setIsModalOpen(true);
  };

  const handleDeleteClick = (id: string) => {
      setConfirmConfig({
          isOpen: true, title: 'Revoke Broadcast', message: 'Permanently remove this announcement from the notice board? This action will be logged in the community audit trail.', isDestructive: true,
          action: async () => { await deleteNotice(id); await fetchNoticesData(); }
      });
  };

  const filteredNotices = useMemo(() => {
      const now = new Date();
      return notices.filter(n => {
          // 1. Tab filtering (Live vs Past)
          const until = n.validUntil ? new Date(n.validUntil) : null;
          const isExpired = until && until < now;
          if (activeTab === 'live' && isExpired) return false;
          if (activeTab === 'past' && !isExpired) return false;

          // 2. Search filtering
          if (!searchQuery) return true;
          const q = searchQuery.toLowerCase();
          return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
      });
  }, [notices, activeTab, searchQuery]);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 min-h-[5rem]">
        <div className="flex items-start gap-3">
            <div className="w-1 h-10 bg-brand-500 rounded-full mt-1" />
            <div>
                <span className="text-[9px] font-mono font-black uppercase tracking-[0.3em] text-brand-600 dark:text-brand-400 mb-0.5 block">Broadcast Hub</span>
                <h1 className="text-2xl sm:text-3xl font-brand font-extrabold text-brand-600 dark:text-brand-400 tracking-tight leading-tight">Notice Board</h1>
            </div>
        </div>
        <div className="flex gap-2">
            <Button onClick={() => setIsAuditOpen(true)} variant="outlined" size="md" leftIcon={<HistoryIcon />}>Audit Logs</Button>
            {isAdmin && <Button onClick={() => setIsModalOpen(true)} size="md" leftIcon={<PlusIcon />}>New Post</Button>}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white dark:bg-zinc-900/40 p-4 rounded-[2rem] border border-slate-50 dark:border-white/5 shadow-sm">
          <div className="relative flex-1 w-full">
              <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                  type="text" 
                  placeholder="Search announcements..." 
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)} 
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl input-field text-sm font-bold shadow-sm" 
              />
          </div>
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-black/20 p-1.5 rounded-2xl w-full sm:w-auto">
              <button 
                  onClick={() => setActiveTab('live')} 
                  className={`flex-1 sm:flex-none px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'live' ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400'}`}
              >
                  Live Alerts
              </button>
              <button 
                  onClick={() => setActiveTab('past')} 
                  className={`flex-1 sm:flex-none px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'past' ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400'}`}
              >
                  History
              </button>
          </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading && notices.length === 0 ? (
             Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-44 bg-slate-100 dark:bg-white/5 rounded-[2.5rem] animate-pulse" />)
        ) : filteredNotices.length === 0 ? (
            <div className="py-24 text-center border-2 border-dashed border-slate-100 dark:border-white/5 rounded-[3rem] opacity-30">
                <BellIcon className="w-16 h-16 mx-auto mb-4" />
                <p className="font-brand font-extrabold text-xl">Registry Clear</p>
                <p className="text-[10px] font-black uppercase tracking-widest mt-1">No {activeTab} notices found</p>
            </div>
        ) : (
            filteredNotices.map((notice) => (
                <Card key={notice.id} className="p-6 bg-white dark:bg-zinc-900/40 rounded-[2.5rem] border border-slate-50 dark:border-white/5 shadow-sm hover:scale-[1.005] transition-transform group">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-4">
                                <NoticeTag type={notice.type} />
                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                                    <ClockIcon className="w-3.5 h-3.5" />
                                    {new Date(notice.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                                {notice.validUntil && (
                                    <span className="text-[9px] text-rose-400 font-bold uppercase tracking-widest flex items-center gap-1.5 ml-auto sm:ml-0">
                                        <AlertTriangleIcon className="w-3.5 h-3.5" />
                                        Exp: {new Date(notice.validUntil).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                    </span>
                                )}
                            </div>
                            <h3 className="text-2xl font-brand font-extrabold text-slate-900 dark:text-slate-50 tracking-tight leading-tight mb-3 group-hover:text-brand-600 transition-colors">{notice.title}</h3>
                            <p className="text-sm text-slate-500 dark:text-zinc-400 font-medium whitespace-pre-wrap leading-relaxed max-w-4xl">{notice.content}</p>
                            
                            <div className="mt-6 pt-5 border-t border-slate-50 dark:border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-xl bg-brand-500/10 flex items-center justify-center font-black text-brand-600 text-[10px] shadow-inner">{notice.author?.[0]?.toUpperCase()}</div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Published By: <span className="text-slate-800 dark:text-zinc-200 ml-1">{notice.author}</span></p>
                                </div>
                                {isAdmin && (
                                    <div className="flex gap-1.5">
                                        <button onClick={() => handleEditClick(notice)} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-white/5 rounded-xl transition-all" title="Edit Post">
                                            <PencilIcon className="w-5 h-5" />
                                        </button>
                                        <button onClick={() => handleDeleteClick(notice.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-white/5 rounded-xl transition-all" title="Delete Post">
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </Card>
            ))
        )}
      </div>

      <AuditLogModal isOpen={isAuditOpen} onClose={() => setIsAuditOpen(false)} entityType="Notice" title="Notice Audit" />
      <FeedbackModal isOpen={feedback.isOpen} onClose={() => setFeedback({ ...feedback, isOpen: false })} title={feedback.title} message={feedback.message} type={feedback.type} />
      <ConfirmationModal 
          isOpen={confirmConfig.isOpen} 
          onClose={() => setConfirmConfig({ ...confirmConfig, isOpen: false })} 
          onConfirm={async () => {
              setIsSubmitting(true);
              try {
                  await confirmConfig.action();
                  setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                  setFeedback({ isOpen: true, type: 'success', title: 'Removed', message: 'Broadcast has been terminated successfully.' });
              } catch (e: any) {
                  setFeedback({ isOpen: true, type: 'error', title: 'Action Failed', message: e.message });
              } finally { setIsSubmitting(false); }
          }} 
          title={confirmConfig.title} 
          message={confirmConfig.message} 
          isDestructive={confirmConfig.isDestructive} 
          isLoading={isSubmitting} 
      />

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title={editingId ? "Modify Notice" : "Broadcast Notice"} subtitle="COMMUNICATION ENGINE" size="lg">
        <form className="space-y-6" onSubmit={handleFormSubmit}>
            <div className="p-6 bg-slate-50 dark:bg-black/20 rounded-[2rem] border border-slate-100 dark:border-white/5 space-y-4">
                <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Subject Header</label>
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Society General Meeting" className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold"/>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Alert Category</label>
                        <div className="relative">
                            <select value={noticeType} onChange={e => setNoticeType(e.target.value as NoticeType)} className="block w-full px-4 py-3 rounded-xl input-field text-xs font-bold appearance-none bg-white dark:bg-zinc-900">
                                {Object.values(NoticeType).map(type => <option key={type} value={type}>{type}</option>)}
                            </select>
                            <ChevronDownIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Expiry Date (Optional)</label>
                        <div className="relative">
                            <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="block w-full px-4 py-3 rounded-xl input-field text-xs font-bold appearance-none bg-white dark:bg-zinc-900"/>
                            <CalendarIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                </div>
            </div>

            <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Detailed Content</label>
                <textarea value={content} onChange={e => setContent(e.target.value)} required rows={8} placeholder="Provide comprehensive details about the announcement..." className="block w-full px-5 py-4 rounded-[2rem] input-field text-sm font-medium leading-relaxed resize-none shadow-inner"/>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-50 dark:border-white/5 gap-3">
                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Discard</Button>
                <Button type="submit" disabled={isSubmitting} size="lg" className="px-10 shadow-xl" leftIcon={isSubmitting ? <Spinner /> : <CheckCircleIcon />}>
                    {isSubmitting ? 'Syncing...' : (editingId ? 'Update Broadcast' : 'Publish to Board')}
                </Button>
            </div>
        </form>
      </Modal>
    </div>
  );
};

const AlertTriangleIcon = (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
);

const CheckCircleIcon = (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
    </svg>
);

export default NoticeBoard;
