
import React, { useState, useEffect } from 'react';
import { getNotices, getComplaints, getVisitors, getMaintenanceRecords } from '../services/api';
import type { Notice, Complaint, Visitor, MaintenanceRecord } from '../types';
import { ComplaintStatus, VisitorStatus, MaintenanceStatus, UserRole } from '../types';
import Card from '../components/ui/Card';
import ErrorCard from '../components/ui/ErrorCard';
import { useAuth } from '../hooks/useAuth';
import { CurrencyRupeeIcon } from '../components/icons';
import { Page } from '../types';

interface DashboardProps {
    navigateToPage: (page: Page, params?: any) => void;
}

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

const Dashboard: React.FC<DashboardProps> = ({ navigateToPage }) => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [maintenanceStats, setMaintenanceStats] = useState({
      monthlyCollected: 0,
      monthlyPaidCount: 0,
      monthlyDue: 0,
      monthlyPendingCount: 0,
      lifetimeCollected: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.communityId) {
      if (!loading) setLoading(true);
      return;
    };

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const promises: Promise<any>[] = [
            getNotices(user.communityId),
            getComplaints(user.communityId),
            getVisitors(user.communityId)
        ];

        // Only Admin/Helpdesk should see maintenance stats on dashboard
        const isAdmin = user.role === UserRole.Admin || user.role === UserRole.Helpdesk;
        if (isAdmin) {
            promises.push(getMaintenanceRecords(user.communityId));
        }

        const results = await Promise.all(promises);
        
        setNotices(results[0]);
        setComplaints(results[1]);
        setVisitors(results[2]);
        
        if (isAdmin && results[3]) {
            calculateMaintenanceStats(results[3]);
        }

      } catch (err: any) {
        console.error("Failed to fetch dashboard data:", err);
        let errorMessage = 'An unknown error occurred. This might be due to database security policies.';
        if (err && typeof err === 'object' && 'message' in err) {
            errorMessage = err.message as string;
        } else if (typeof err === 'string') {
            errorMessage = err;
        }
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const calculateMaintenanceStats = (records: MaintenanceRecord[]) => {
      const now = new Date();
      const currentMonthStr = now.toISOString().slice(0, 7); // YYYY-MM

      let monthlyCollected = 0;
      let monthlyPaidCount = new Set<string>();
      let monthlyDue = 0;
      let monthlyPendingCount = new Set<string>();
      let lifetimeCollected = 0;

      records.forEach(record => {
          const recordMonthStr = record.periodDate.slice(0, 7);
          const isCurrentMonth = recordMonthStr === currentMonthStr;
          const isPaid = record.status === MaintenanceStatus.Paid;
          
          // Lifetime
          if (isPaid) {
              lifetimeCollected += Number(record.amount);
          }

          // Monthly
          if (isCurrentMonth) {
              if (isPaid) {
                  monthlyCollected += Number(record.amount);
                  monthlyPaidCount.add(record.userId);
              } else {
                  // Pending or Submitted counts as Due for dashboard overview
                  monthlyDue += Number(record.amount);
                  monthlyPendingCount.add(record.userId);
              }
          }
      });

      setMaintenanceStats({
          monthlyCollected,
          monthlyPaidCount: monthlyPaidCount.size,
          monthlyDue,
          monthlyPendingCount: monthlyPendingCount.size,
          lifetimeCollected
      });
  };

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
  
  if (error) {
    return (
        <div className="space-y-6">
            <h2 className="text-3xl sm:text-4xl font-bold text-[var(--text-light)] dark:text-[var(--text-dark)]">Dashboard</h2>
            <ErrorCard title="Failed to Load Dashboard Data" message={error} />
        </div>
    );
  }

  const latestNotice = notices[0];
  const pendingComplaints = complaints.filter(c => c.status !== ComplaintStatus.Resolved);
  const expectedVisitors = visitors.filter(v => v.status === VisitorStatus.Expected);
  const isAdmin = user?.role === UserRole.Admin || user?.role === UserRole.Helpdesk;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl sm:text-4xl font-bold text-[var(--text-light)] dark:text-[var(--text-dark)] mb-2 animated-card">Dashboard</h2>
        <p className="text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] text-lg animated-card" style={{ animationDelay: '100ms' }}>Here's a quick overview of your community.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Maintenance Overview Widget (Admin Only) */}
        {isAdmin && (
            <Card className="col-span-1 md:col-span-3 p-6 animated-card border-l-4 border-l-blue-500" style={{ animationDelay: '150ms' }}>
                 <h3 className="text-lg font-medium mb-4 flex items-center gap-2 text-[var(--text-light)] dark:text-[var(--text-dark)]">
                    <CurrencyRupeeIcon className="w-5 h-5 text-[var(--accent)]"/> 
                    Maintenance Overview <span className="text-xs font-normal text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] ml-2 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">Current Month</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Collected */}
                    <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-100 dark:border-green-900/30">
                        <p className="text-sm text-green-800 dark:text-green-300 mb-1">Collected This Month</p>
                        <p className="text-2xl font-bold text-green-700 dark:text-green-400">₹{maintenanceStats.monthlyCollected.toLocaleString()}</p>
                        <div 
                            className="text-xs mt-2 text-green-600 dark:text-green-400/80 cursor-pointer hover:underline flex items-center gap-1"
                            onClick={() => navigateToPage('Maintenance', { filter: MaintenanceStatus.Paid })}
                        >
                            From <span className="font-bold">{maintenanceStats.monthlyPaidCount}</span> residents →
                        </div>
                    </div>

                    {/* Due */}
                    <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/30">
                        <p className="text-sm text-red-800 dark:text-red-300 mb-1">Due This Month</p>
                        <p className="text-2xl font-bold text-red-700 dark:text-red-400">₹{maintenanceStats.monthlyDue.toLocaleString()}</p>
                         <div 
                            className="text-xs mt-2 text-red-600 dark:text-red-400/80 cursor-pointer hover:underline flex items-center gap-1"
                            onClick={() => navigateToPage('Maintenance', { filter: MaintenanceStatus.Pending })}
                        >
                            Pending from <span className="font-bold">{maintenanceStats.monthlyPendingCount}</span> residents →
                        </div>
                    </div>

                    {/* Lifetime */}
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/30">
                        <p className="text-sm text-blue-800 dark:text-blue-300 mb-1">Lifetime Collected</p>
                        <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">₹{maintenanceStats.lifetimeCollected.toLocaleString()}</p>
                        <p className="text-xs mt-2 text-blue-600 dark:text-blue-400/80">Total since inception</p>
                    </div>
                </div>
            </Card>
        )}

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
