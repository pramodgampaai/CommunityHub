import React, { useState, useEffect } from 'react';
import { getNotices, getComplaints, getVisitors } from '../services/api';
import type { Notice, Complaint, Visitor } from '../types';
import { ComplaintStatus, VisitorStatus } from '../types';
import Card from '../components/ui/Card';

const useCountUp = (end: number, duration: number = 1.5) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (end === 0) {
            setCount(0);
            return;
        }
        let start = 0;
        const startTimestamp = performance.now();
        const step = (timestamp: number) => {
            const progress = (timestamp - startTimestamp) / (duration * 1000);
            if (progress < 1) {
                setCount(Math.floor(end * progress));
                requestAnimationFrame(step);
            } else {
                setCount(end);
            }
        };
        requestAnimationFrame(step);
    }, [end, duration]);

    return count;
}

const CountUp: React.FC<{ value: number }> = ({ value }) => {
    const count = useCountUp(value);
    return <>{count}</>;
};

const SkeletonCard: React.FC<{ className?: string }> = ({ className }) => (
    <div className={`p-6 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse ${className}`}>
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-md w-1/3 mb-4"></div>
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-md w-1/4"></div>
    </div>
);

const SkeletonText: React.FC<{ className?: string }> = ({ className }) => (
    <div className={`space-y-2 ${className}`}>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
    </div>
);

const Dashboard: React.FC = () => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [noticesData, complaintsData, visitorsData] = await Promise.all([
          getNotices(),
          getComplaints(),
          getVisitors(),
        ]);
        setNotices(noticesData);
        setComplaints(complaintsData);
        setVisitors(visitorsData);
      } catch (error) {
        console.error("Failed to fetch dashboard data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const latestNotice = notices[0];
  const pendingComplaints = complaints.filter(c => c.status !== ComplaintStatus.Resolved);
  const expectedVisitors = visitors.filter(v => v.status === VisitorStatus.Expected);

  if (loading) {
      return (
          <div className="space-y-6">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg w-1/4 animate-pulse"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <SkeletonCard className="col-span-1 md:col-span-2" />
                <SkeletonCard />
                <SkeletonCard />
                <div className="col-span-1 md:col-span-2 lg:col-span-3 p-6 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse">
                    <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-md w-1/3 mb-4"></div>
                    <SkeletonText />
                </div>
            </div>
          </div>
      )
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl sm:text-4xl font-bold text-[var(--text-light)] dark:text-[var(--text-dark)] mb-2 animated-card">Dashboard</h2>
        <p className="text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] text-lg animated-card" style={{ animationDelay: '100ms' }}>Here's a quick overview of your community.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="p-6 col-span-1 md:col-span-2 animated-card" style={{ animationDelay: '200ms' }}>
          <h3 className="text-md font-medium mb-2 text-googleBlue-600 dark:text-blue-300">Latest Notice</h3>
          {latestNotice ? (
            <div>
              <h4 className="font-bold text-lg text-[var(--text-light)] dark:text-[var(--text-dark)]">{latestNotice.title}</h4>
              <p className="text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mt-2 text-sm line-clamp-2">{latestNotice.content}</p>
            </div>
          ) : <p>No new notices.</p>}
        </Card>
        
        <Card className="p-6 animated-card" style={{ animationDelay: '300ms' }}>
           <h3 className="text-md font-medium mb-2 text-yellow-800 dark:text-yellow-300">Pending Complaints</h3>
           <p className="text-5xl font-bold text-yellow-900 dark:text-yellow-400"><CountUp value={pendingComplaints.length} /></p>
        </Card>

        <Card className="p-6 animated-card" style={{ animationDelay: '400ms' }}>
            <h3 className="text-md font-medium mb-2 text-green-800 dark:text-green-300">Expected Visitors</h3>
            <p className="text-5xl font-bold text-green-900 dark:text-green-400"><CountUp value={expectedVisitors.length} /></p>
        </Card>

        <Card className="p-6 col-span-1 md:col-span-2 lg:col-span-3 animated-card" style={{ animationDelay: '500ms' }}>
          <h3 className="text-md font-medium mb-2 text-googleBlue-600 dark:text-blue-300">Upcoming Visitors</h3>
          {expectedVisitors.length > 0 ? (
            <ul className="space-y-3 divide-y divide-[var(--border-light)] dark:divide-[var(--border-dark)]">
              {expectedVisitors.slice(0, 3).map((v) => (
                <li key={v.id} className="flex justify-between items-center text-sm pt-3 first:pt-0">
                  <span className="font-medium text-[var(--text-light)] dark:text-[var(--text-dark)]">{v.name}</span>
                  <span className="text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">{new Date(v.expectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] text-sm">No visitors expected today.</p>}
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;