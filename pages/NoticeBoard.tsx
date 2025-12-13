
import React, { useState, useEffect } from 'react';
import { createNotice, getNotices, updateNotice, deleteNotice } from '../services/api';
import type { Notice } from '../types';
import { NoticeType, UserRole } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import AuditLogModal from '../components/AuditLogModal';
import { PlusIcon, ClockIcon, PencilIcon, TrashIcon, EyeSlashIcon, HistoryIcon } from '../components/icons';
import { useAuth } from '../hooks/useAuth';

const NoticeTag: React.FC<{ type: NoticeType }> = ({ type }) => {
    const typeStyles: Record<NoticeType, string> = {
        [NoticeType.Event]: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
        [NoticeType.Maintenance]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
        [NoticeType.Urgent]: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
        [NoticeType.General]: 'bg-gray-100 text-gray-800 dark:bg-gray-700/40 dark:text-gray-300',
    };
    return <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${typeStyles[type]}`}>{type}</span>;
}

const NoticeSkeleton: React.FC = () => (
    <div className="p-5 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse">
        <div className="flex justify-between items-start gap-2">
            <div className="flex-1 space-y-2">
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            </div>
            <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
        </div>
        <div className="mt-4 space-y-2">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
        </div>
    </div>
);


const NoticeBoard: React.FC = () => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user } = useAuth();
  
  // View State
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [noticeType, setNoticeType] = useState<NoticeType>(NoticeType.General);
  const [validFrom, setValidFrom] = useState(new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);

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
    if (user?.communityId) {
      fetchNotices(user.communityId);
    }
  }, [user]);

  // Handle Create or Update
  const handleFormSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      
      if (validUntil && new Date(validFrom) > new Date(validUntil)) {
          alert("End date cannot be before start date.");
          return;
      }

      setIsSubmitting(true);
      try {
          if (editingId) {
              await updateNotice(editingId, {
                  title,
                  content,
                  type: noticeType,
                  validFrom: validFrom ? new Date(validFrom).toISOString() : undefined,
                  validUntil: validUntil ? new Date(validUntil).toISOString() : undefined 
              });
          } else {
              await createNotice({ 
                  title, 
                  content, 
                  type: noticeType, 
                  author: user.name,
                  validFrom: validFrom ? new Date(validFrom).toISOString() : undefined,
                  validUntil: validUntil ? new Date(validUntil).toISOString() : undefined
              }, user);
          }

          setIsModalOpen(false);
          resetForm();
          await fetchNotices(user.communityId); // Refresh list
      } catch (error) {
          console.error("Failed to save notice:", error);
          alert("Failed to save notice. Please try again.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const resetForm = () => {
      setTitle('');
      setContent('');
      setNoticeType(NoticeType.General);
      setValidFrom(new Date().toISOString().split('T')[0]);
      setValidUntil('');
      setEditingId(null);
  };

  const handleCreateClick = () => {
      resetForm();
      setIsModalOpen(true);
  };

  const handleEditClick = (notice: Notice) => {
      setTitle(notice.title);
      setContent(notice.content);
      setNoticeType(notice.type);
      setValidFrom(notice.validFrom ? new Date(notice.validFrom).toISOString().split('T')[0] : '');
      setValidUntil(notice.validUntil ? new Date(notice.validUntil).toISOString().split('T')[0] : '');
      setEditingId(notice.id);
      setIsModalOpen(true);
  };

  const handleDeleteClick = (notice: Notice) => {
      setConfirmConfig({
          isOpen: true,
          title: "Delete Notice",
          message: "Are you sure you want to delete this notice? This action cannot be undone.",
          isDestructive: true,
          confirmLabel: "Delete",
          action: async () => {
              await deleteNotice(notice.id);
              await fetchNotices(user?.communityId!);
          }
      });
  };

  const handleDisableClick = (notice: Notice) => {
      setConfirmConfig({
          isOpen: true,
          title: "Disable Notice",
          message: "This will expire the notice immediately and move it to the Archive. Continue?",
          isDestructive: true,
          confirmLabel: "Disable",
          action: async () => {
              // Set validUntil to now, effectively expiring it
              await updateNotice(notice.id, { validUntil: new Date().toISOString() });
              await fetchNotices(user?.communityId!);
          }
      });
  };
  
  const handleConfirmAction = async () => {
      setIsSubmitting(true);
      try {
          await confirmConfig.action();
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      } catch (error: any) {
          alert("Action failed: " + error.message);
      } finally {
          setIsSubmitting(false);
      }
  };

  // Filter Logic
  const getFilteredNotices = () => {
      const now = new Date();
      
      return notices.filter(n => {
          const start = n.validFrom ? new Date(n.validFrom) : new Date(0); 
          const end = n.validUntil ? new Date(n.validUntil) : new Date(8640000000000000); 
          
          if (activeTab === 'active') {
              return start <= now && end >= now;
          } else {
              return end < now;
          }
      });
  };

  const displayedNotices = getFilteredNotices();
  const isAdmin = user?.role === UserRole.Admin;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center animated-card">
        <h2 className="text-2xl font-bold text-[var(--text-light)] dark:text-[var(--text-dark)]">Notice Board</h2>
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
            {isAdmin && (
                <Button onClick={handleCreateClick} leftIcon={<PlusIcon className="w-5 h-5"/>} aria-label="Create New Notice" variant="fab">
                    <span className="hidden sm:inline">New Notice</span>
                    <span className="sm:hidden">New</span>
                </Button>
            )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--border-light)] dark:border-[var(--border-dark)]">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
                onClick={() => setActiveTab('active')}
                className={`${activeTab === 'active' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] hover:text-[var(--text-light)] dark:hover:text-[var(--text-dark)] hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
                Active Notices
            </button>
            <button
                onClick={() => setActiveTab('archived')}
                className={`${activeTab === 'archived' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] hover:text-[var(--text-light)] dark:hover:text-[var(--text-dark)] hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
                Archived
            </button>
        </nav>
      </div>

      {/* List */}
      <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2">
        {loading ? (
             Array.from({ length: 4 }).map((_, index) => <NoticeSkeleton key={index} />)
        ) : displayedNotices.length === 0 ? (
            <div className="col-span-full p-8 text-center text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] border-2 border-dashed border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-xl">
                No notices found.
            </div>
        ) : (
            displayedNotices.map((notice) => (
                <Card key={notice.id} className="p-6 animated-card flex flex-col h-full">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <NoticeTag type={notice.type} />
                                {notice.validUntil && new Date(notice.validUntil) < new Date() && (
                                    <span className="text-xs font-bold text-red-500 border border-red-500 px-1.5 py-0.5 rounded">EXPIRED</span>
                                )}
                            </div>
                            <h3 className="text-xl font-bold text-[var(--text-light)] dark:text-[var(--text-dark)]">{notice.title}</h3>
                        </div>
                        
                        {isAdmin && (
                            <div className="flex gap-2 ml-4">
                                <button 
                                    onClick={() => handleEditClick(notice)}
                                    className="p-2 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors"
                                    title="Edit"
                                >
                                    <PencilIcon className="w-5 h-5" />
                                </button>
                                {notice.validUntil && new Date(notice.validUntil) > new Date() ? (
                                     <button 
                                        onClick={() => handleDisableClick(notice)}
                                        className="p-2 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-full transition-colors"
                                        title="Expire Now"
                                    >
                                        <EyeSlashIcon className="w-5 h-5" />
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => handleDeleteClick(notice)}
                                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                        title="Delete"
                                    >
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    
                    <div className="flex-grow">
                        <p className="text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] whitespace-pre-wrap">{notice.content}</p>
                    </div>

                    <div className="mt-4 pt-4 border-t border-[var(--border-light)] dark:border-[var(--border-dark)] flex justify-between items-center text-xs text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                        <span>Posted by {notice.author}</span>
                        <span>{new Date(notice.createdAt).toLocaleDateString()}</span>
                    </div>
                </Card>
            ))
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Edit Notice" : "Create New Notice"}>
        <form className="space-y-4" onSubmit={handleFormSubmit}>
            <div>
                <label htmlFor="title" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Title</label>
                <input type="text" id="title" value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Pool Maintenance" className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] sm:text-sm bg-transparent"/>
            </div>
            <div>
                <label htmlFor="type" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Type</label>
                <select id="type" value={noticeType} onChange={e => setNoticeType(e.target.value as NoticeType)} className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] sm:text-sm bg-[var(--bg-light)] dark:bg-[var(--bg-dark)]">
                    {Object.values(NoticeType).map(type => (
                        <option key={type} value={type}>{type}</option>
                    ))}
                </select>
            </div>
            <div>
                <label htmlFor="content" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Content</label>
                <textarea id="content" value={content} onChange={e => setContent(e.target.value)} required placeholder="Detailed information..." rows={4} className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] sm:text-sm bg-transparent"></textarea>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="validFrom" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Valid From</label>
                    <input type="date" id="validFrom" value={validFrom} onChange={e => setValidFrom(e.target.value)} className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] sm:text-sm bg-transparent"/>
                </div>
                <div>
                    <label htmlFor="validUntil" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Valid Until</label>
                    <input type="date" id="validUntil" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] sm:text-sm bg-transparent"/>
                </div>
            </div>
            <div className="flex justify-end pt-4 space-x-2">
                <Button type="button" variant="outlined" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : (editingId ? 'Update' : 'Post')}</Button>
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
        entityType="Notice"
        title="Notice Board History"
      />
    </div>
  );
};

export default NoticeBoard;
