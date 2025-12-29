
import React, { useState, useEffect, useRef } from 'react';
import { getNotices, getComplaints, getVisitors, getMaintenanceRecords, getExpenses } from '../services/api';
import type { Notice, Complaint, Visitor, MaintenanceRecord, Expense } from '../types';
import { ComplaintStatus, VisitorStatus, MaintenanceStatus, UserRole, ExpenseStatus } from '../types';
import Card from '../components/ui/Card';
import ErrorCard from '../components/ui/ErrorCard';
import { useAuth } from '../hooks/useAuth';
import { CurrencyRupeeIcon, UsersIcon, ShieldCheckIcon, PlusIcon, ArrowRightIcon, BellIcon } from '../components/icons';
import { Page } from '../types';
import Button from '../components/ui/Button';

/**
 * Robust count-up hook that handles interruptions and restarts gracefully.
 */
const useCountUp = (end: number, duration: number = 2) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (end === count) return;
        
        let startTimestamp: number | null = null;
        const startValue = count; 
        
        const step = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / (duration * 1000), 1);
            const current = Math.floor(progress * (end - startValue) + startValue);
            
            setCount(current);
            
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };

        const animationId = window.requestAnimationFrame(step);
        return () => window.cancelAnimationFrame(animationId);
    }, [end]);

    return count;
}

const Dashboard: React.FC<{ navigateToPage: (page: Page, params?: any) => void }> = ({ navigateToPage }) => {
  const { user } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [maintenanceStats, setMaintenanceStats] = useState({ lifetimeCollected: 0, myDues: 0, pendingVerifications: 0 });
  const [expenseStats, setExpenseStats] = useState({ totalExpenses: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role === UserRole.Admin;
  const treasuryVal = maintenanceStats.lifetimeCollected - expenseStats.totalExpenses;
  const animatedValue = useCountUp(isAdmin ? treasuryVal : maintenanceStats.myDues);

  useEffect(() => {
    if (!user?.communityId) return;
    
    // Create an AbortController for this fetch cycle
    const controller = new AbortController();
    let isMounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        const promises: Promise<any>[] = [
            getNotices(user.communityId, controller.signal),
            getComplaints(user.communityId, user.id, user.role, controller.signal),
            getVisitors(user.communityId, user.role, controller.signal),
            getMaintenanceRecords(user.communityId, isAdmin ? undefined : user.id, controller.signal)
        ];
        if (isAdmin) promises.push(getExpenses(user.communityId, controller.signal));
        
        const results = await Promise.all(promises);
        
        // Only update state if the component is still mounted and the request wasn't aborted
        if (!isMounted) return;

        if (results[0]) setNotices(results[0]);
        if (results[1]) setComplaints(results[1]);
        if (results[2]) setVisitors(results[2]);
        
        if (results[3]) {
            const records: MaintenanceRecord[] = results[3];
            let lifetime = 0, myDues = 0, pendingVerifications = 0;
            records.forEach(r => {
                if (r.status === MaintenanceStatus.Paid) lifetime += Number(r.amount);
                else if (r.userId === user.id && r.status === MaintenanceStatus.Pending) myDues += Number(r.amount);
                if (r.status === MaintenanceStatus.Submitted) pendingVerifications++;
            });
            setMaintenanceStats({ lifetimeCollected: lifetime, myDues, pendingVerifications });
        }

        if (isAdmin && results[4]) {
            const expenses: Expense[] = results[4];
            const total = expenses.filter(e => e.status === ExpenseStatus.Approved).reduce((sum, e) => sum + e.amount, 0);
            setExpenseStats({ totalExpenses: total });
        }
      } catch (err: any) { 
          if (err.name !== 'AbortError' && isMounted) {
            setError(err.message || 'Sync failed'); 
          }
      } finally { 
          if (isMounted) setLoading(false); 
      }
    };

    fetchData();

    return () => {
        isMounted = false;
        controller.abort(); // Cancel ongoing requests if user navigates away
    };
  }, [user, isAdmin]);

  if (loading) return (
    <div className="max-w-7xl mx-auto p-4 space-y-4">
        <div className="h-24 bg-gray-100 dark:bg-zinc-900 rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-40 bg-gray-100 dark:bg-zinc-900 rounded-xl animate-pulse" />
            <div className="h-40 bg-gray-100 dark:bg-zinc-900 rounded-xl animate-pulse" />
        </div>
    </div>
  );
  if (error) return <ErrorCard title="Dashboard Error" message={error} />;

  const latestNotice = notices[0];
  const pendingTickets = complaints.filter(c => c.status !== ComplaintStatus.Resolved).length;
  const activeVisitors = visitors.filter(v => v.status === VisitorStatus.Expected).slice(0, 3);

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 space-y-6">
      <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3">
          <div className="flex items-start gap-2.5">
              <div className="w-1 h-10 bg-brand-500 rounded-full mt-0.5" />
              <div>
                  <span className="text-[8px] font-mono font-black uppercase tracking-[0.3em] text-brand-600 dark:text-brand-400 mb-0.5 block">Community Pulse</span>
                  <h1 className="text-2xl sm:text-3xl font-brand font-extrabold text-brand-600 tracking-tight leading-tight">Hello, {user?.name.split(' ')[0]}.</h1>
                  <p className="text-sm text-[var(--text-secondary-light)] dark:text-zinc-400 font-medium">
                    Managed operations for <span className="font-bold text-brand-600 dark:text-brand-400">{user?.communityName}</span>.
                  </p>
              </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outlined" size="md" onClick={() => navigateToPage('Visitors')} className="flex-1 sm:flex-none" leftIcon={<PlusIcon />}>Invite</Button>
              <Button size="md" onClick={() => navigateToPage('Help Desk')} className="flex-1 sm:flex-none" leftIcon={<ShieldCheckIcon />}>Support</Button>
          </div>
      </section>

      <Card className="p-0 border-none bg-brand-600 dark:bg-[#0f1115] overflow-hidden shadow-lg rounded-2xl">
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-white/10 dark:divide-white/5">
              <div className="flex-1 p-5 text-white dark:text-slate-50">
                  <p className="text-[8px] font-mono font-black uppercase tracking-[0.2em] opacity-70 mb-1">{isAdmin ? 'Net Treasury' : 'Current Due'}</p>
                  <h4 className="text-4xl font-brand font-extrabold tracking-tight">₹{animatedValue.toLocaleString()}</h4>
                  <div className="flex items-center justify-between mt-3">
                    <button onClick={() => navigateToPage('Maintenance')} className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 opacity-70 hover:opacity-100 transition-opacity">Analyze Ledger <ArrowRightIcon className="w-3.5 h-3.5" /></button>
                    {isAdmin && maintenanceStats.pendingVerifications > 0 && (
                        <span className="flex items-center gap-1 bg-amber-500 text-white px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider animate-pulse">
                            {maintenanceStats.pendingVerifications} Pending Verification
                        </span>
                    )}
                  </div>
              </div>
              <div className="flex-1 p-5 text-white dark:text-slate-50 bg-black/10 dark:bg-white/[0.02]">
                  <p className="text-[8px] font-mono font-black uppercase tracking-[0.2em] opacity-70 mb-1">Pipeline Status</p>
                  <div className="flex items-center gap-3">
                      <h4 className="text-4xl font-brand font-extrabold tracking-tight">{pendingTickets}</h4>
                      <div className="h-8 w-0.5 bg-white/20" />
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Active Tickets</p>
                  </div>
                  <button onClick={() => navigateToPage('Help Desk')} className="mt-3 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 opacity-70 hover:opacity-100 transition-opacity">Open Help Desk <ArrowRightIcon className="w-3.5 h-3.5" /></button>
              </div>
          </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-7 space-y-3">
              <h3 className="text-[10px] font-black text-brand-600 dark:text-brand-400 font-mono uppercase tracking-[0.3em] px-1">Announcements</h3>
              {latestNotice ? (
                  <Card key={latestNotice.id} className="p-5 group rounded-2xl border border-slate-100 dark:border-white/5 bg-white dark:bg-zinc-900/40">
                      <div className="flex items-center gap-2 mb-3">
                           <span className="bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md">{latestNotice.type}</span>
                           <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">{new Date(latestNotice.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                      </div>
                      <h4 className="text-xl font-brand font-extrabold leading-tight text-slate-900 dark:text-slate-50 group-hover:text-brand-600 transition-colors">{latestNotice.title}</h4>
                      <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400 leading-relaxed line-clamp-3 font-medium">{latestNotice.content}</p>
                      <div className="mt-5 pt-4 border-t border-slate-100 dark:border-white/5 flex justify-between items-center">
                          <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center font-black text-brand-600 text-[10px]">{latestNotice.author[0]}</div>
                              <div>
                                  <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">By</p>
                                  <p className="text-xs font-bold text-slate-700 dark:text-zinc-300">{latestNotice.author}</p>
                              </div>
                          </div>
                          <button onClick={() => navigateToPage('Notices')} className="p-2 bg-brand-50 dark:bg-zinc-800 rounded-lg text-brand-600 hover:bg-brand-600 hover:text-white transition-all shadow-sm"><ArrowRightIcon className="w-4 h-4" /></button>
                      </div>
                  </Card>
              ) : (
                  <div className="p-10 text-center opacity-30 border-dashed border border-slate-200 dark:border-white/5 rounded-2xl">
                      <BellIcon className="w-8 h-8 mx-auto mb-1.5" />
                      <p className="font-bold uppercase tracking-widest text-[9px]">No active notices</p>
                  </div>
              )}
          </div>

          <div className="lg:col-span-5 space-y-3">
              <h3 className="text-[10px] font-black text-brand-600 dark:text-brand-400 font-mono uppercase tracking-[0.3em] px-1">Security Manifest</h3>
              <Card className="p-5 rounded-2xl bg-slate-50/50 dark:bg-zinc-900/20 border-none">
                  {activeVisitors.length > 0 ? (
                      <div className="space-y-3">
                          {activeVisitors.map(v => (
                              <div key={v.id} className="bg-white dark:bg-white/5 p-3 rounded-lg border border-slate-100 dark:border-white/5 flex items-center justify-between shadow-sm">
                                  <div>
                                      <p className="font-bold text-xs text-slate-900 dark:text-slate-50">{v.name}</p>
                                      <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest mt-0.5">{v.visitorType}</p>
                                  </div>
                                  <div className="text-right">
                                      <p className="text-[10px] font-black text-brand-600">{new Date(v.expectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">ETA</p>
                                  </div>
                              </div>
                          ))}
                          <Button variant="ghost" size="sm" onClick={() => navigateToPage('Visitors')} className="w-full text-[8px] font-black uppercase tracking-widest text-brand-600 mt-1 border border-brand-100 dark:border-white/5 h-8">Audit Gate Activity</Button>
                      </div>
                  ) : (
                      <div className="py-8 text-center opacity-20">
                          <UsersIcon className="w-10 h-10 mx-auto mb-2 stroke-[1px]" />
                          <p className="text-[8px] font-black uppercase tracking-[0.2em]">Ledger Clear</p>
                      </div>
                  )}
              </Card>

              <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => navigateToPage('Amenities')} className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-white/5 text-left hover:border-brand-500 transition-all shadow-sm group">
                      <div className="w-8 h-8 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-lg flex items-center justify-center mb-2 group-hover:scale-105 transition-transform"><PlusIcon className="w-5 h-5" /></div>
                      <p className="font-bold text-xs text-slate-900 dark:text-slate-50">Amenities</p>
                      <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest mt-0.5">Reserve Space</p>
                  </button>
                  <button onClick={() => navigateToPage('Directory')} className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-white/5 text-left hover:border-brand-500 transition-all shadow-sm group">
                      <div className="w-8 h-8 bg-orange-50 dark:bg-orange-900/30 text-orange-600 rounded-lg flex items-center justify-center mb-2 group-hover:scale-105 transition-transform"><UsersIcon className="w-5 h-5" /></div>
                      <p className="font-bold text-xs text-slate-900 dark:text-slate-50">Members</p>
                      <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest mt-0.5">Registry Access</p>
                  </button>
              </div>
          </div>
      </div>
    </div>
  );
};

export default Dashboard;
