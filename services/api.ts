
import { supabase, supabaseKey, supabaseProjectUrl } from './supabase';
import { 
    User, Community, CommunityStat, Notice, Complaint, Visitor, 
    Amenity, Booking, MaintenanceRecord, Expense, AuditLog, 
    FinancialHistory, Unit, UserRole, 
    ComplaintStatus, VisitorStatus, ExpenseStatus, MaintenanceStatus
} from '../types';

export interface MonthlyLedger {
    previousBalance: number;
    collectedThisMonth: number;
    pendingThisMonth: number;
    expensesThisMonth: number;
    closingBalance: number;
}

// --- Global Request Coalescing Layer ---
const pendingRequests = new Map<string, Promise<any>>();

const callEdgeFunction = async (functionName: string, body: any, options: { token?: string, signal?: AbortSignal } = {}) => {
    // Determine the token to use
    let accessToken = options.token;
    if (!accessToken) {
        const { data: { session } } = await supabase.auth.getSession();
        accessToken = session?.access_token;
    }

    // Include token in requestKey to prevent coalescing requests with different auth states
    const requestKey = `${functionName}:${accessToken?.substring(0, 10)}:${JSON.stringify(body)}`;
    
    if (pendingRequests.has(requestKey)) {
        return pendingRequests.get(requestKey);
    }

    const requestPromise = (async () => {
        if (!accessToken) {
            pendingRequests.delete(requestKey);
            throw new Error("Authentication session expired. Please re-login.");
        }

        const baseUrl = (supabaseProjectUrl || '').replace(/\/$/, '');
        if (!baseUrl) {
            pendingRequests.delete(requestKey);
            throw new Error("Supabase URL is not configured.");
        }
        
        const url = `${baseUrl}/functions/v1/${functionName}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken.trim()}`,
                    // CRITICAL FIX: Supabase Gateway requires the apikey (anon key) 
                    // even when an Authorization header is present to avoid CORS 'Failed to fetch'
                    'apikey': supabaseKey 
                },
                body: JSON.stringify(body),
                signal: options.signal
            });

            if (options.signal?.aborted) return null;

            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                const result = await response.json();
                if (result && result.error) throw new Error(result.error);
                if (!response.ok) throw new Error(result.error || `Server error (${response.status}) in ${functionName}`);
                return result;
            } else {
                const text = await response.text();
                if (!response.ok) throw new Error(text || `Server error (${response.status}) in ${functionName}`);
                return text;
            }
        } catch (error: any) {
            if (error.name === 'AbortError' || options.signal?.aborted) return null;
            
            // Transform generic network errors into readable ones
            if (error.message === 'Failed to fetch') {
                throw new Error("Connection failed: The server is unreachable or the request was blocked. Please check your internet.");
            }
            throw error;
        } finally {
            // Clean up cache after a short delay
            setTimeout(() => pendingRequests.delete(requestKey), 500);
        }
    })();

    pendingRequests.set(requestKey, requestPromise);
    return requestPromise;
};

// --- API EXPORTS ---

export const getUserProfile = async (token?: string) => {
    return callEdgeFunction('get-user-profile', {}, { token });
};

export const updateTheme = async (userId: string, theme: 'light' | 'dark') => {
    return callEdgeFunction('update-user-theme', { theme });
};

export const getNotices = async (communityId: string, signal?: AbortSignal): Promise<Notice[]> => {
    if (!communityId) return [];
    const response = await callEdgeFunction('get-notices', { community_id: communityId }, { signal });
    const data = response?.data || [];
    return data.map((n: any) => ({
        id: n.id, title: n.title, content: n.content, author: n.author,
        createdAt: n.created_at, type: n.type, communityId: n.community_id,
        validFrom: n.valid_from, validUntil: n.valid_until
    }));
};

export const getComplaints = async (communityId: string, userId?: string, role?: UserRole, signal?: AbortSignal): Promise<Complaint[]> => {
    if (!communityId) return [];
    const response = await callEdgeFunction('get-complaints', { community_id: communityId }, { signal });
    const data = response?.data || [];
    return data.map((c: any) => ({
        id: c.id, title: c.title, description: c.description, residentName: c.resident_name,
        flatNumber: c.flat_number, status: c.status, createdAt: c.created_at, category: c.category,
        userId: c.user_id, communityId: c.community_id, assignedTo: c.assigned_to, assignedToName: c.assigned_user?.name
    }));
};

export const getVisitors = async (communityId: string, role?: UserRole, signal?: AbortSignal): Promise<Visitor[]> => {
    if (!communityId) return [];
    const response = await callEdgeFunction('get-visitors', { community_id: communityId }, { signal });
    const data = response?.data || [];
    return data.map((v: any) => ({
        id: v.id, name: v.name, visitorType: v.visitor_type, vehicleNumber: v.vehicle_number,
        purpose: v.purpose, status: v.status, expectedAt: v.expected_at, validUntil: v.valid_until,
        entryTime: v.entry_time, exitTime: v.exit_time, entryToken: v.entry_token,
        residentName: v.resident_name, flatNumber: v.flat_number, communityId: v.community_id, userId: v.user_id
    }));
};

export const getMaintenanceRecords = async (communityId: string, userId?: string, signal?: AbortSignal): Promise<MaintenanceRecord[]> => {
    if (!communityId) return [];
    const response = await callEdgeFunction('get-maintenance-records', { community_id: communityId, user_id: userId }, { signal });
    const data = response?.data || [];
    return data.map((r: any) => ({
        id: r.id, userId: r.user_id, unitId: r.unit_id, communityId: r.community_id,
        amount: Number(r.amount) || 0, periodDate: r.period_date, status: r.status,
        paymentReceiptUrl: r.payment_receipt_url, upiTransactionId: r.upi_transaction_id,
        transaction_date: r.transaction_date, createdAt: r.created_at, userName: r.users?.name,
        flatNumber: r.units?.flat_number
    }));
};

export const getExpenses = async (communityId: string, signal?: AbortSignal): Promise<Expense[]> => {
    if (!communityId) return [];
    const response = await callEdgeFunction('get-expenses', { community_id: communityId }, { signal });
    const data = response?.data || [];
    return data.map((e: any) => ({
        id: e.id, title: e.title, amount: Number(e.amount) || 0, category: e.category,
        description: e.description, date: e.date, submittedBy: e.submitted_by,
        submittedByName: e.submitted_user?.name, status: e.status, approvedBy: e.approved_by,
        approvedByName: e.approved_user?.name, communityId: e.community_id,
        createdAt: e.created_at, receiptUrl: e.receipt_url
    }));
};

export const getResidents = async (communityId: string): Promise<User[]> => {
    if (!communityId) return [];
    const response = await callEdgeFunction('get-directory', { community_id: communityId });
    const data = response?.data || [];
    return data.map((u: any) => {
        const units: Unit[] = u.units ? u.units.map((unit: any) => ({
            id: unit.id, userId: unit.user_id, communityId: unit.community_id,
            flatNumber: unit.flat_number, block: unit.block, floor: unit.floor,
            flatSize: Number(unit.flat_size) || 0, maintenanceStartDate: unit.maintenance_start_date
        })) : [];
        let displayFlatNumber = u.flat_number;
        if (units.length > 0) {
            const p = units[0];
            displayFlatNumber = p.block ? `${p.block}-${p.flatNumber}` : p.flatNumber;
        }
        let userRole = u.role as UserRole;
        if (userRole === UserRole.Resident && u.profile_data?.is_tenant) userRole = UserRole.Tenant;
        return { ...u, role: userRole, flatNumber: displayFlatNumber, units };
    });
};

export const getCommunity = async (id: string): Promise<Community> => {
    // Route through Edge Function to avoid RLS recursion on the users table
    const result = await callEdgeFunction('get-community-profile', { id });
    const data = result.data;
    return {
        id: data.id,
        name: data.name,
        address: data.address,
        status: data.status,
        communityType: data.community_type,
        blocks: data.blocks,
        maintenanceRate: Number(data.maintenance_rate) || 0,
        fixedMaintenanceAmount: Number(data.fixed_maintenance_amount) || 0,
        contacts: data.contact_info,
        subscriptionType: data.subscription_type,
        subscriptionStartDate: data.subscription_start_date,
        pricePerUser: data.pricing_config
    };
};

export const getCommunityStats = async (): Promise<CommunityStat[]> => {
    const result = await callEdgeFunction('get-community-stats', {});
    const data = result?.data || [];
    
    // Fix: Map the raw database response to the CommunityStat interface
    // ensuring pricePerUser, communityType, etc. are properly populated.
    return data.map((stat: any) => ({
        id: stat.id,
        name: stat.name,
        address: stat.address,
        status: stat.status,
        communityType: stat.community_type,
        blocks: stat.blocks,
        maintenanceRate: Number(stat.maintenance_rate) || 0,
        fixedMaintenanceAmount: Number(stat.fixed_maintenance_amount) || 0,
        contacts: stat.contact_info,
        subscriptionType: stat.subscription_type,
        subscriptionStartDate: stat.subscription_start_date,
        pricePerUser: stat.pricing_config,
        // Aggregated counts from the Edge Function
        resident_count: Number(stat.resident_count) || 0,
        admin_count: Number(stat.admin_count) || 0,
        staff_count: Number(stat.staff_count) || 0,
        current_month_paid: Number(stat.current_month_paid) || 0,
        income_generated: Number(stat.income_generated) || 0
    }));
};

export const createCommunity = (data: any) => supabase.from('communities').insert(data).select().single();
export const updateCommunity = (id: string, data: any) => supabase.from('communities').update(data).eq('id', id);
export const deleteCommunity = (id: string) => callEdgeFunction('delete-community', { community_id: id });

export const createNotice = (data: any, user: User) => callEdgeFunction('create-notice', { ...data, author_name: user.name, community_id: user.communityId });
export const updateNotice = (id: string, data: any, user: User) => supabase.from('notices').update(data).eq('id', id);
export const deleteNotice = (id: string) => supabase.from('notices').delete().eq('id', id);

export const createComplaint = (data: any, user: User) => callEdgeFunction('create-complaint', { ...data, community_id: user.communityId, user_id: user.id, resident_name: user.name, flat_number: user.flatNumber });
export const updateComplaintStatus = (id: string, status: ComplaintStatus) => callEdgeFunction('update-complaint', { id, status });
export const assignComplaint = (id: string, agentId: string) => callEdgeFunction('update-complaint', { id, assigned_to: agentId });

export const getComplaintActivity = async (complaintId: string, communityId: string): Promise<AuditLog[]> => {
    const response = await callEdgeFunction('get-audit-logs', { entity: 'Complaint', entity_id: complaintId, community_id: communityId });
    const data = response?.data || [];
    return data.map((l: any) => ({
        id: l.id, createdAt: l.created_at, actorId: l.actor_id, communityId: l.community_id,
        actorName: l.users?.name, actorRole: l.users?.role, entity: l.entity,
        entityId: l.entity_id, action: l.action, details: l.details
    }));
};

export const createVisitor = async (data: any, user: User): Promise<Visitor> => {
    const response = await callEdgeFunction('manage-visitor', { 
        action: 'CREATE', 
        data: { ...data, resident_name: user.name, flat_number: user.flatNumber } 
    });
    const v = response.data;
    return { 
        ...v, visitorType: v.visitor_type, vehicleNumber: v.vehicle_number, 
        expectedAt: v.expected_at, entryToken: v.entry_token, residentName: v.resident_name, 
        flatNumber: v.flat_number, communityId: v.community_id, userId: v.user_id 
    };
};

export const updateVisitor = (id: string, data: any, user: User) => {
    return callEdgeFunction('manage-visitor', { action: 'UPDATE', id, data });
};

export const verifyVisitorEntry = (visitor_id: string, entry_token: string) => callEdgeFunction('verify-visitor', { visitor_id, entry_token });
export const deleteVisitor = (id: string) => callEdgeFunction('manage-visitor', { action: 'DELETE', id });

export const createAmenity = (data: any, user: User) => callEdgeFunction('manage-amenity', { action: 'CREATE', data: { ...data, community_id: user.communityId } });
export const updateAmenity = (id: string, data: any) => callEdgeFunction('manage-amenity', { action: 'UPDATE', id, data });
export const deleteAmenity = (id: string) => callEdgeFunction('manage-amenity', { action: 'DELETE', id });

export const getAmenities = async (communityId: string): Promise<Amenity[]> => {
    if (!communityId) return [];
    const response = await callEdgeFunction('get-amenities', { community_id: communityId });
    const data = response?.data || [];
    return data.map((a: any) => ({
        id: a.id, name: a.name, description: a.description, imageUrl: a.image_url,
        capacity: Number(a.capacity) || 0, communityId: a.community_id,
        maxDuration: Number(a.max_duration) || 0, status: a.status
    }));
};

export const getBookings = async (communityId: string): Promise<Booking[]> => {
    if (!communityId) return [];
    const response = await callEdgeFunction('get-bookings', { community_id: communityId });
    const data = response?.data || [];
    return data.map((b: any) => ({
        id: b.id, amenityId: b.amenity_id, residentName: b.resident_name,
        flatNumber: b.flat_number, startTime: b.start_time, endTime: b.end_time, communityId: b.community_id
    }));
};

export const createBooking = (data: any, user: User) => supabase.from('bookings').insert({ ...data, resident_name: user.name, flat_number: user.flatNumber, community_id: user.communityId, user_id: user.id });

export const submitMaintenancePayment = (id: string, receiptUrl: string, upiId: string, date: string) => supabase.from('maintenance_records').update({ status: MaintenanceStatus.Submitted, payment_receipt_url: receiptUrl, upi_transaction_id: upiId, transaction_date: date }).eq('id', id);
export const verifyMaintenancePayment = (id: string) => supabase.from('maintenance_records').update({ status: MaintenanceStatus.Paid }).eq('id', id);

export const createExpense = (data: any, user: User) => supabase.from('expenses').insert({ ...data, submitted_by: user.id, community_id: user.communityId, status: ExpenseStatus.Pending });
export const approveExpense = (id: string, approverId: string) => supabase.from('expenses').update({ status: ExpenseStatus.Approved, approved_by: approverId }).eq('id', id);
export const rejectExpense = (id: string, approverId: string, reason: string) => supabase.from('expenses').update({ status: ExpenseStatus.Rejected, approved_by: approverId, description: reason }).eq('id', id);
export const getMonthlyLedger = (community_id: string, month: number, year: number) => callEdgeFunction('get-monthly-ledger', { community_id, month, year });

export const getAuditLogs = async (communityId: string): Promise<AuditLog[]> => {
    if (!communityId) return [];
    const response = await callEdgeFunction('get-audit-logs', { community_id: communityId });
    const data = response?.data || [];
    return data.map((l: any) => ({
        id: l.id, createdAt: l.created_at, actorId: l.actor_id, communityId: l.community_id,
        actorName: l.users?.name, actorRole: l.users?.role, entity: l.entity,
        entityId: l.entity_id, action: l.action, details: l.details
    }));
};

export const recordCommunityPayment = (data: any) => callEdgeFunction('record-payment', data);
export const getFinancialHistory = (year: number) => callEdgeFunction('get-financial-history', { year });

export const getFinancialYears = async (): Promise<number[]> => {
    const response = await callEdgeFunction('get-financial-years', {});
    return response?.years || [new Date().getFullYear()];
};

export const createAdminUser = (data: any) => callEdgeFunction('create-admin-user', data);
export const createCommunityUser = (data: any) => callEdgeFunction('create-community-user', data);
export const bulkCreateCommunityUsers = (users: any[], communityId: string) => callEdgeFunction('bulk-create-users', { users, community_id: communityId });
export const onboardTenant = (tenantData: any, ownerId: string, communityId: string, flatNumber: string) => callEdgeFunction('onboard-tenant', { tenantData, ownerId, communityId, flatNumber });
export const deleteTenant = (tenantId: string) => callEdgeFunction('delete-tenant', { tenantId });
export const requestPasswordReset = (email: string) => supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' });
export const updateUserPassword = (password: string) => callEdgeFunction('update-user-password', { password });
export const assignAdminUnit = (unitData: any, user: User, community: Community) => callEdgeFunction('assign-unit', { unitData, communityId: community.id, userId: user.id });
