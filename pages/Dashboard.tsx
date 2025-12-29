
import React, { useState, useEffect, useRef } from 'react';
import { getNotices, getComplaints, getVisitors, getMaintenanceRecords, getExpenses } from '../services/api';
import type { Notice, Complaint, Visitor, MaintenanceRecord, Expense } from '../types';
import { ComplaintStatus, VisitorStatus, MaintenanceStatus, UserRole, ExpenseStatus, Page } from '../types';
import Card from '../components/ui/Card';
import ErrorCard from '../components/ui/ErrorCard';
import { useAuth } from '../hooks/useAuth';
import { UsersIcon, ShieldCheckIcon, PlusIcon, ArrowRightIcon, BellIcon } from '../components/icons';
import Button from '../components/ui/Button';

// Static memory cache for zero-flicker transitions
let dashboardCache: any = null;

const Dashboard: React.FC<{ navigateToPage: (page: Page, params?: any) => void }> = ({ navigateToPage }) => {
  const { user } = useAuth();
  
  // Initialize from cache if available
  const [data, setData] = useState(dashboardCache || {
      notices: [], complaints: [], visitors: [], 
      maintenance: { lifetimeCollected: 0, myDues: 0, pendingVerifications: 0 },
      expenses: { totalExpenses: 0 }
  });
  
  const [loading, setLoading] = useState(!dashboardCache);
  const [error, setError] = useState<string | null>(null);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    // HYDRATION GUARD: Don't fetch if the user profile isn't fully ready yet
    // SuperAdmins might not have a communityId, but they also shouldn't really land here
    if (!user?.communityId || isFetchingRef.current) {
        if (user?.role === UserRole.SuperAdmin) setLoading(false);
        return;
    }
    
    isFetchingRef.current = true;
    const controller = new AbortController();
    let isMounted = true;

    const fetchData = async () => {
      try {
        const isAdmin = user.role === UserRole.Admin || user.role === UserRole.SuperAdmin;
        
        // Promises now return the actual data arrays directly thanks to api.ts fixes
        const promises: Promise<any>[] = [
            getNotices(user.communityId, controller.signal),
            getComplaints(user.communityId, user.id, user.role, controller.signal),
            getVisitors(user.communityId, user.role, controller.signal),
            getMaintenanceRecords(user.communityId, isAdmin ? undefined : user.id, controller.signal)
        ];
        if (isAdmin) promises.push(getExpenses(user.communityId, controller.signal));
        
        const results = await Promise.all(promises);
        if (!isMounted) return;

        const noticesArr = (results[0] as Notice[]) || [];
        const complaintsArr = (results[1] as Complaint[]) || [];
        const visitorsArr = (results[2] as Visitor[]) || [];
        const recordsArr = (results[3] as MaintenanceRecord[]) || [];
        
        let lifetime = 0, myDues = 0, pendingVerifications = 0;
        recordsArr.forEach(r => {
            if (r.status === MaintenanceStatus.Paid) lifetime += Number(r.amount);
            else if (r.userId === user.id && r.status === MaintenanceStatus.Pending) myDues += Number(r.amount);
            if (r.status === MaintenanceStatus.Submitted) pendingVerifications++;
        });

        let totalExpenses = 0;
        if (isAdmin && results[4]) {
            totalExpenses = (results[4] as Expense[]).filter((e: Expense) => e.status === ExpenseStatus.Approved).reduce((sum: number, e: Expense) => sum + e.amount, 0);
        }

        const newState = {
            notices: noticesArr,
            complaints: complaintsArr,
            visitors: visitorsArr,
            maintenance: { lifetimeCollected: lifetime, myDues, pendingVerifications },
            expenses: { totalExpenses }
        };

        dashboardCache = newState;
        setData(newState);
        setError(null);
      } catch (err: any) { 
          // ABORTION GUARD: Ignore errors caused by component unmounting or route changes
          if (err.name !== 'AbortError' && isMounted) {
              console.error("Dashboard Fetch Error:", err);
              setError(err.message); 
          }
      } finally { 
          if (isMounted) setLoading(false); 
          isFetchingRef.current = false;
      }
    };

    fetchData();
    return () => { isMounted = false; controller.abort(); isFetchingRef.current = false; };
  }, [user?.id, user?.communityId]);

  if (loading && !dashboardCache) return (
    <div className="max-w-7xl mx-auto p-4 space-y-4">
        <div className="h-24 bg-gray-100 dark:bg-zinc-900 rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-40 bg-gray-100 dark:bg-zinc-900 rounded-xl animate-pulse" />
            <div className="h-40 bg-gray-100 dark:bg-zinc-900 rounded-xl animate-pulse" />
        </div>
    </div>
  );

  if (error && !dashboardCache) return <ErrorCard title="Dashboard Sync Error" message={error} />;

  const isAdmin = user?.role === UserRole.Admin || user?.role === UserRole.SuperAdmin;
  const treasuryVal = data.maintenance.lifetimeCollected - data.expenses.totalExpenses;
  const pendingTickets = data.complaints.filter((c: Complaint) => c.status !== ComplaintStatus.Resolved).length;
  const latestNotice = data.notices[0];
  const activeVisitors = data.visitors.filter((v: Visitor) => v.status === VisitorStatus.Expected).slice(0, 3);

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 space-y-6">
      <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3">
          <div className="flex items-start gap-2.5">
              <div className="w-1 h-10 bg-brand-500 rounded-full mt-0.5" />
              <div>
                  <span className="text-[8px] font-mono font-black uppercase tracking-[0.3em] text-brand-600 dark:text-brand-400 mb-0.5 block">Live Status</span>
                  <h1 className="text-2xl sm:text-3xl font-brand font-extrabold text-brand-600 tracking-tight leading-tight">Welcome, {user?.name.split(' ')[0]}.</h1>
                  <p className="text-sm text-slate-500 font-medium">Community: <span className="font-bold text-brand-600">{user?.communityName || 'Global Access'}</span></p>
              </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outlined" size="md" onClick={() => navigateToPage('Visitors')} className="flex-1 sm:flex-none" leftIcon={<PlusIcon />}>Invite</Button>
              <Button size="md" onClick={() => navigateToPage('Help Desk')} className="flex-1 sm:flex-none" leftIcon={<ShieldCheckIcon />}>Support</Button>
          </div>
      </section>

      <Card className="p-0 border-none bg-brand-600 dark:bg-[#0f1115] overflow-hidden shadow-lg rounded-2xl">
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-white/10 dark:divide-white/5">
              <div className="flex-1 p-5 text-white">
                  <p className="text-[8px] font-mono font-black uppercase tracking-[0.2em] opacity-70 mb-1">{isAdmin ? 'Net Treasury' : 'Current Due'}</p>
                  <h4 className="text-4xl font-brand font-extrabold tracking-tight">₹{(isAdmin ? treasuryVal : data.maintenance.myDues).toLocaleString()}</h4>
                  <div className="flex items-center justify-between mt-3">
                    <button onClick={() => navigateToPage('Maintenance')} className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 opacity-70 hover:opacity-100 transition-opacity">Ledger View <ArrowRightIcon className="w-3.5 h-3.5" /></button>
                    {isAdmin && data.maintenance.pendingVerifications > 0 && (
                        <span className="bg-amber-500 text-white px-2 py-0.5 rounded text-[8px] font-black uppercase">{data.maintenance.pendingVerifications} Pending Verify</span>
                    )}
                  </div>
              </div>
              <div className="flex-1 p-5 text-white bg-black/10">
                  <p className="text-[8px] font-mono font-black uppercase tracking-[0.2em] opacity-70 mb-1">Queue Status</p>
                  <div className="flex items-center gap-3">
                      <h4 className="text-4xl font-brand font-extrabold tracking-tight">{pendingTickets}</h4>
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Active Tickets</p>
                  </div>
                  <button onClick={() => navigateToPage('Help Desk')} className="mt-3 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 opacity-70 hover:opacity-100 transition-opacity">Open Desk <ArrowRightIcon className="w-3.5 h-3.5" /></button>
              </div>
          </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-7 space-y-3">
              <h3 className="text-[10px] font-black text-brand-600 dark:text-brand-400 font-mono uppercase tracking-[0.3em] px-1">Announcements</h3>
              {latestNotice ? (
                  <Card key={latestNotice.id} className="p-5 group rounded-2xl bg-white dark:bg-zinc-900/40 border border-slate-50 dark:border-white/5 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                           <span className="bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 text-[8px] font-black uppercase px-2 py-0.5 rounded-md">{latestNotice.type}</span>
                           <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">{new Date(latestNotice.createdAt).toLocaleDateString()}</span>
                      </div>
                      <h4 className="text-xl font-brand font-extrabold text-slate-900 dark:text-slate-50">{latestNotice.title}</h4>
                      <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400 line-clamp-2">{latestNotice.content}</p>
                      <button onClick={() => navigateToPage('Notices')} className="mt-4 text-[9px] font-black text-brand-600 uppercase tracking-widest">Read All Notices</button>
                  </Card>
              ) : (
                  <div className="p-10 text-center opacity-30 border-2 border-dashed border-slate-200 dark:border-white/5 rounded-2xl">
                      <BellIcon className="w-8 h-8 mx-auto mb-1.5" />
                      <p className="font-bold uppercase tracking-widest text-[9px]">No active notices</p>
                  </div>
              )}
          </div>

          <div className="lg:col-span-5 space-y-3">
              <h3 className="text-[10px] font-black text-brand-600 dark:text-brand-400 font-mono uppercase tracking-[0.3em] px-1">Security Registry</h3>
              <Card className="p-5 rounded-2xl bg-slate-50/50 dark:bg-zinc-900/20 border-none">
                  {activeVisitors.length > 0 ? (
                      <div className="space-y-3">
                          {activeVisitors.map((v: Visitor) => (
                              <div key={v.id} className="bg-white dark:bg-white/5 p-3 rounded-lg flex items-center justify-between shadow-sm">
                                  <div>
                                      <p className="font-bold text-xs text-slate-900 dark:text-slate-50">{v.name}</p>
                                      <p className="text-[8px] text-slate-400 font-black uppercase mt-0.5">{v.visitorType}</p>
                                  </div>
                                  <div className="text-right">
                                      <p className="text-[10px] font-black text-brand-600">{new Date(v.expectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                  </div>
                              </div>
                          ))}
                      </div>
                  ) : (
                      <div className="py-8 text-center opacity-20">
                          <UsersIcon className="w-10 h-10 mx-auto mb-2" />
                          <p className="text-[8px] font-black uppercase">Registry Clear</p>
                      </div>
                  )}
              </Card>
          </div>
      </div>
    </div>
  );
};

export default Dashboard;
