import React, { useState, useEffect } from 'react';
import { createNotice, getNotices } from '../services/api';
import type { Notice } from '../types';
import { NoticeType } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { PlusIcon } from '../components/icons';
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
  
  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [noticeType, setNoticeType] = useState<NoticeType>(NoticeType.General);
  const [isSubmitting, setIsSubmitting] = useState(false);


  const fetchNotices = async () => {
    try {
      setLoading(true);
      const data = await getNotices();
      setNotices(data);
    } catch (error) {
      console.error("Failed to fetch notices", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, []);
  
  const handleFormSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      setIsSubmitting(true);
      try {
          await createNotice({ title, content, type: noticeType, author: user.name });
          setIsModalOpen(false);
          setTitle('');
          setContent('');
          setNoticeType(NoticeType.General);
          await fetchNotices(); // Refresh list
      } catch (error) {
          console.error("Failed to create notice:", error);
          alert("Failed to create notice. Please try again.");
      } finally {
          setIsSubmitting(false);
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center animated-card">
        <h2 className="text-3xl sm:text-4xl font-bold text-[var(--text-light)] dark:text-[var(--text-dark)]">Notice Board</h2>
        <Button onClick={() => setIsModalOpen(true)} leftIcon={<PlusIcon className="w-5 h-5"/>} aria-label="Create New Notice" variant="fab">
            <span className="hidden sm:inline">New Notice</span>
            <span className="sm:hidden">New</span>
        </Button>
      </div>
      
      <div className="space-y-4">
        {loading ? (
            Array.from({ length: 4 }).map((_, index) => <NoticeSkeleton key={index} />)
        ) : (
            notices.map((notice, index) => (
                <Card key={notice.id} className="p-5 animated-card" style={{ animationDelay: `${index * 100}ms` }}>
                    <div className="flex justify-between items-start gap-2">
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-[var(--text-light)] dark:text-[var(--text-dark)]">{notice.title}</h3>
                            <p className="text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mt-1">By {notice.author} on {new Date(notice.createdAt).toLocaleDateString()}</p>
                        </div>
                        <NoticeTag type={notice.type} />
                    </div>
                    <p className="mt-3 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">{notice.content}</p>
                </Card>
            ))
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Notice">
        <form className="space-y-4" onSubmit={handleFormSubmit}>
            <div>
                <label htmlFor="title" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Title</label>
                <input type="text" id="title" value={title} onChange={e => setTitle(e.target.value)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] sm:text-sm bg-transparent"/>
            </div>
             <div>
                <label htmlFor="content" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Content</label>
                <textarea id="content" value={content} onChange={e => setContent(e.target.value)} required rows={4} className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] sm:text-sm bg-transparent"></textarea>
            </div>
             <div>
                <label htmlFor="noticeType" className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Type</label>
                <select id="noticeType" value={noticeType} onChange={e => setNoticeType(e.target.value as NoticeType)} required className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] sm:text-sm bg-transparent">
                    {Object.values(NoticeType).map(type => (
                        <option key={type} value={type}>{type}</option>
                    ))}
                </select>
            </div>
            <div className="flex justify-end pt-4 space-x-2">
                <Button type="button" variant="outlined" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Posting...' : 'Post Notice'}</Button>
            </div>
        </form>
      </Modal>
    </div>
  );
};

export default NoticeBoard;