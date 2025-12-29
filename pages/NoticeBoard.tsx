
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { createNotice, getNotices, updateNotice, deleteNotice } from '../services/api';
import type { Notice } from '../types';
import { NoticeType, UserRole } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import AuditLogModal from '../components/AuditLogModal';
import FeedbackModal from '../components/ui/FeedbackModal';
import { PlusIcon, ClockIcon, PencilIcon, TrashIcon, HistoryIcon, BellIcon, ChevronDownIcon } from '../components/icons';
import { useAuth } from '../hooks/useAuth';

const NoticeTag: React.FC<{ type: NoticeType }> = ({ type }) => {
    const typeStyles: Record<NoticeType, string> = {
        [NoticeType.Event]: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
        [NoticeType.Maintenance]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
        [NoticeType.Urgent]: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
        [NoticeType.General]: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
    };
    return <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-md ${typeStyles[type]}`}>{type}</span>;
}

const NoticeBoard: React.FC = () => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [noticeType, setNoticeType] = useState<NoticeType>(NoticeType.General);
  const [validFrom, setValidFrom] = useState(new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<{ isOpen: boolean; type: 'success' | 'error' | 'info'; title: string; message: string }>({
      isOpen: false, type: 'success', title: '', message: ''
  });

  const [confirmConfig, setConfirmConfig] = useState<{
      isOpen: boolean; title: string; message: string; action: () => Promise<void>; isDestructive?: boolean; confirmLabel?: string;
  }>({
      isOpen: false, title: '', message: '', action: async () => {}, isDestructive: false, confirmLabel: 'Confirm'
  });

  const fetchNotices = async (communityId: string) => {
    try {
      setLoading(true);
      const data = await getNotices(communityId);
      setNotices(data);
    } catch (error) {
      console.error("Failed to fetch notices", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.communityId) fetchNotices(user.communityId);
  }, [user]);

  const handleFormSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      setIsSubmitting(true);
      try {
          const payload = { 
              title, 
              content, 
              type: noticeType, 
              validFrom: validFrom ? new Date(validFrom).toISOString() : undefined, 
              validUntil: validUntil ? new Date(validUntil).toISOString() : undefined 
          };

          if (editingId) {
              await updateNotice(editingId, payload, user);
          } else {
              await createNotice({ ...payload, author: user.name }, user);
          }
          setIsModalOpen(false);
          resetForm();
          await fetchNotices(user.communityId);
          setFeedback({ isOpen: true, type: 'success', title: 'Action Successful', message: editingId ? 'Notice updated successfully.' : 'New notice posted.' });
      } catch (error) {
          console.error("Failed to save notice:", error);
          setFeedback({ isOpen: true, type: 'error', title: 'Post Failed', message: 'Could not save the notice to the database.' });
      } finally { setIsSubmitting(false); }
  };

  const resetForm = () => {
      setTitle(''); setContent(''); setNoticeType(NoticeType.General);
      setValidFrom(new Date().toISOString().split('T')[0]); setValidUntil(''); setEditingId(null);
  };

  const handleEditClick = (notice: Notice) => {
      setTitle(notice.title); 
      setContent(notice.content); 
      setNoticeType(notice.type);
      
      if (notice.validFrom) {
          setValidFrom(new Date(notice.validFrom).toISOString().split('T')[0]);
      }
      if (notice.validUntil) {
          setValidUntil(new Date(notice.validUntil).toISOString().split('T')[0]);
      } else {
          setValidUntil('');
      }

      setEditingId(notice.id); 
      setIsModalOpen(true);
  };

  const handleDeleteClick = (id: string) => {
      setConfirmConfig({
          isOpen: true,
          title: 'Delete Notice',
          message: 'Are you sure you want to permanently delete this notice? This action cannot be undone.',
          isDestructive: true,
          confirmLabel: 'Delete',
          action: async () => {
              await deleteNotice(id);
              if (user?.communityId) await fetchNotices(user.communityId);
          }
      });
  };

  const handleConfirmAction = async () => {
      setIsSubmitting(true);
      try { 
          await confirmConfig.action(); 
          setConfirmConfig(prev => ({ ...prev, isOpen: false })); 
          setFeedback({ isOpen: true, type: 'success', title: 'Success', message: 'Operation completed.' });
      }
      catch (error: any) { 
          setFeedback({ isOpen: true, type: 'error', title: 'Action Failed', message: error.message || "Error" }); 
      }
      finally {
          setIsSubmitting(false);
      }
  };

  const isAdmin = user?.role === UserRole.Admin || user?.role === UserRole.SuperAdmin || user?.role === UserRole.HelpdeskAdmin;

  const filteredNotices = notices.filter(n => {
      const now = new Date();
      const until = n.validUntil ? new Date(n.validUntil) : null;
      if (activeTab === 'active') {
          return !until || until >= now;
      } else {
          return until && until < now;
      }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div className="flex items-start gap-3">
            <div className="w-1 h-10 bg-brand-500 rounded-full mt-1" />
            <div>
                <span className="text-[9px] font-mono font-black uppercase tracking-[0.3em] text-brand-600 dark:text-brand-400 mb-0.5 block">Communication Flow</span>
                <h1 className="text-2xl sm:text-3xl font-brand font-extrabold text-brand-600 tracking-tight leading-tight">Notice Board</h1>
            </div>
        </div>
        <div className="flex gap-2">
            <Button onClick={() => setIsAuditOpen(true)} variant="outlined" size="md" leftIcon={<HistoryIcon />}>Audit Logs</Button>
            {isAdmin && <Button onClick={() => setIsModalOpen(true)} size="md" leftIcon={<PlusIcon />}>Publish Notice</Button>}
        </div>
      </div>

      <div className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-900/40 p-1.5 rounded-xl w-fit">
          <button 
            onClick={() => setActiveTab('active')} 
            className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'active' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
          >
            Current
          </button>
          <button 
            onClick={() => setActiveTab('archived')} 
            className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'archived' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
          >
            Archived
          </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
             Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 bg-slate-100 dark:bg-white/5 rounded-2xl animate-pulse" />)
        ) : (
            filteredNotices.length === 0 ? (
                <div className="p-16 text-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-white/5 rounded-3xl">
                    <BellIcon className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="font-bold uppercase tracking-widest text-[9px]">No {activeTab} notices</p>
                </div>
            ) : (
                filteredNotices.map((notice) => (
                    <Card key={notice.id} className="p-6 bg-white dark:bg-zinc-900/40 rounded-3xl border border-slate-50 dark:border-white/5 shadow-sm">
                        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-3">
                                    <NoticeTag type={notice.type} />
                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
                                        <ClockIcon className="w-3.5 h-3.5" />
                                        {new Date(notice.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </span>
                                </div>
                                <h3 className="text-xl font-brand font-extrabold text-slate-900 dark:text-slate-50 tracking-tight leading-tight mb-2">{notice.title}</h3>
                                <p className="text-sm text-slate-500 dark:text-zinc-400 font-medium whitespace-pre-wrap leading-relaxed">{notice.content}</p>
                                <div className="mt-5 pt-4 border-t border-slate-50 dark:border-white/5 flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-lg bg-brand-500/10 flex items-center justify-center font-black text-brand-600 text-[8px]">{notice.author[0]}</div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">By: <span className="text-slate-800 dark:text-zinc-300 ml-1">{notice.author}</span></p>
                                    </div>
                                    {isAdmin && (
                                        <div className="flex gap-2">
                                            <button onClick={() => handleEditClick(notice)} className="p-2 text-slate-400 hover:text-brand-600 transition-colors"><PencilIcon className="w-4 h-4" /></button>
                                            <button onClick={() => handleDeleteClick(notice.id)} className="p-2 text-slate-400 hover:text-rose-500 transition-colors"><TrashIcon className="w-4 h-4" /></button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Card>
                ))
            )
        )}
      </div>

      <AuditLogModal isOpen={isAuditOpen} onClose={() => setIsAuditOpen(false)} entityType="Notice" title="Notice Audit" />
      <FeedbackModal isOpen={feedback.isOpen} onClose={() => setFeedback({ ...feedback, isOpen: false })} title={feedback.title} message={feedback.message} type={feedback.type} />
      <ConfirmationModal isOpen={confirmConfig.isOpen} onClose={() => setConfirmConfig({ ...confirmConfig, isOpen: false })} onConfirm={handleConfirmAction} title={confirmConfig.title} message={confirmConfig.message} isDestructive={confirmConfig.isDestructive} confirmLabel={confirmConfig.confirmLabel} isLoading={isSubmitting} />

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title={editingId ? "Edit Notice" : "Post Notice"} subtitle="System Broadcast" size="lg">
        <form className="space-y-4" onSubmit={handleFormSubmit}>
            <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Subject Title</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Scheduled Water Maintenance" className="block w-full px-4 py-3 rounded-xl input-field text-sm font-bold"/>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Notice Type</label>
                    <div className="relative">
                        <select value={noticeType} onChange={e => setNoticeType(e.target.value as NoticeType)} className="block w-full px-4 py-3 rounded-xl input-field text-xs font-bold appearance-none bg-white dark:bg-zinc-900">
                            {Object.values(NoticeType).map(type => <option key={type} value={type}>{type}</option>)}
                        </select>
                        <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                </div>
                <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Expiration Date (Optional)</label>
                    <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="block w-full px-4 py-3 rounded-xl input-field text-xs font-bold"/>
                </div>
            </div>
            <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Detailed Content</label>
                <textarea value={content} onChange={e => setContent(e.target.value)} required rows={6} placeholder="Provide clear details for the residents..." className="block w-full px-4 py-3 rounded-xl input-field text-sm font-medium leading-relaxed"/>
            </div>
            <div className="flex justify-end pt-4">
                <Button type="submit" disabled={isSubmitting} size="lg" className="w-full sm:w-auto">{isSubmitting ? 'Publishing...' : (editingId ? 'Update Broadcast' : 'Post to Board')}</Button>
            </div>
        </form>
      </Modal>
    </div>
  );
};

export default NoticeBoard;
