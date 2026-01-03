
import { supabase, supabaseKey, supabaseProjectUrl } from './supabase';
import { 
    User, Community, CommunityStat, Notice, Complaint, Visitor, 
    Amenity, Booking, MaintenanceRecord, Expense, AuditLog, 
    Unit, UserRole, ComplaintStatus, Asset
} from '../types';

export interface MonthlyLedger {
    previousBalance: number;
    collectedThisMonth: number;
    pendingThisMonth: number;
    expensesThisMonth: number;
    closingBalance: number;
}

// --- Internal Mapping Helpers ---
const mapCommunityToDb = (community: Partial<Community>) => {
    const mapped: any = {};
    if (community.name !== undefined) mapped.name = community.name;
    if (community.address !== undefined) mapped.address = community.address;
    if (community.status !== undefined) mapped.status = community.status;
    if (community.communityType !== undefined) mapped.community_type = community.communityType;
    if (community.blocks !== undefined) mapped.blocks = community.blocks;
    if (community.maintenanceRate !== undefined) mapped.maintenance_rate = community.maintenanceRate;
    // Fix: correct property name from fixed_maintenance_amount to fixedMaintenanceAmount
    if (community.fixedMaintenanceAmount !== undefined) mapped.fixed_maintenance_amount = community.fixedMaintenanceAmount;
    if (community.openingBalance !== undefined) mapped.opening_balance = community.openingBalance;
    if (community.openingBalanceLocked !== undefined) mapped.opening_balance_locked = community.openingBalanceLocked;
    if (community.pendingBalanceUpdate !== undefined) mapped.pending_balance_update = community.pendingBalanceUpdate;
    if (community.contacts !== undefined) mapped.contact_info = community.contacts;
    if (community.subscriptionType !== undefined) mapped.subscription_type = community.subscriptionType;
    if (community.subscriptionStartDate !== undefined) mapped.subscription_start_date = community.subscriptionStartDate;
    if (community.pricePerUser !== undefined) mapped.pricing_config = community.pricePerUser;
    return mapped;
};

/**
 * Standardizes Visitor objects from DB to Frontend Interface
 */
const mapDbToVisitor = (v: any): Visitor => ({
    id: v.id,
    name: v.name,
    visitorType: v.visitor_type,
    vehicleNumber: v.vehicle_number,
    purpose: v.purpose,
    status: v.status,
    expectedAt: v.expected_at,
    validUntil: v.valid_until,
    entryTime: v.entry_time,
    exitTime: v.exit_time,
    entryToken: v.entry_token,
    residentName: v.resident_name,
    flatNumber: v.flat_number,
    communityId: v.community_id,
    userId: v.user_id,
    totalGuests: v.total_guests
});

// --- Global Request Coalescing Layer ---
const pendingRequests = new Map<string, Promise<any>>();

/**
 * Standardizes calls to Supabase Edge Functions.
 * Function endpoints follow the pattern: [BASE_URL]/functions/v1/[functionName]
 */
const callEdgeFunction = async (functionName: string, body: any, options: { token?: string, signal?: AbortSignal } = {}) => {
    let accessToken = options.token;
    if (!accessToken) {
        const { data: { session } } = await supabase.auth.getSession();
        accessToken = session?.access_token;
    }

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
        const url = `${baseUrl}/functions/v1/${functionName}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken.trim()}`,
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
            throw error;
        } finally {
            setTimeout(() => pendingRequests.delete(requestKey), 500);
        }
    })();

    pendingRequests.set(requestKey, requestPromise);
    return requestPromise;
};

// --- API MODULES: NOTICES ---
export const getNotices = async (communityId: string, signal?: AbortSignal): Promise<Notice[]> => {
    const response = await callEdgeFunction('get-notices', { community_id: communityId }, { signal });
    const data = response?.data || [];
    return data.map((n: any) => ({
        id: n.id, title: n.title, content: n.content, author: n.author,
        createdAt: n.created_at, type: n.type, communityId: n.community_id,
        validFrom: n.valid_from, validUntil: n.valid_until
    }));
};

export const createNotice = (data: any, user: User) => 
    callEdgeFunction('manage-notice', { 
        action: 'CREATE', 
        data: data, 
        community_id: user.communityId 
    });

export const updateNotice = (id: string, data: any, user: User) => 
    callEdgeFunction('manage-notice', { 
        action: 'UPDATE', 
        id, 
        data: data, 
        community_id: user.communityId 
    });

export const deleteNotice = (id: string) => 
    callEdgeFunction('manage-notice', { action: 'DELETE', id });

// --- API MODULES: BOOKINGS ---
export const getAmenities = async (communityId: string): Promise<Amenity[]> => {
    const response = await callEdgeFunction('get-amenities', { community_id: communityId });
    const data = response?.data || [];
    return data.map((a: any) => ({
        id: a.id, name: a.name, description: a.description, imageUrl: a.image_url,
        capacity: Number(a.capacity) || 0, communityId: a.community_id,
        maxDuration: Number(a.max_duration) || 0, status: a.status
    }));
};

export const getBookings = async (communityId: string): Promise<Booking[]> => {
    const response = await callEdgeFunction('get-bookings', { community_id: communityId });
    const data = response?.data || [];
    return data.map((b: any) => ({
        id: b.id, amenityId: b.amenity_id, residentName: b.resident_name,
        flatNumber: b.flat_number, startTime: b.start_time, endTime: b.end_time, communityId: b.community_id
    }));
};

export const createAmenity = (data: any, user: User) => callEdgeFunction('manage-amenity', { action: 'CREATE', data: { ...data, community_id: user.communityId } });
export const updateAmenity = (id: string, data: any) => callEdgeFunction('manage-amenity', { action: 'UPDATE', id, data });
export const deleteAmenity = (id: string) => callEdgeFunction('manage-amenity', { action: 'DELETE', id });

export const createBooking = (data: any, user: User) => 
    callEdgeFunction('manage-booking', { action: 'CREATE', community_id: user.communityId, data });

// --- API MODULES: MAINTENANCE ---
export const getMaintenanceRecords = async (communityId: string, userId?: string, signal?: AbortSignal): Promise<MaintenanceRecord[]> => {
    const response = await callEdgeFunction('get-maintenance-records', { community_id: communityId, user_id: userId }, { signal });
    const data = response?.data || [];
    return data.map((r: any) => ({
        id: r.id, userId: r.user_id, unitId: r.unit_id, communityId: r.community_id,
        amount: Number(r.amount) || 0, periodDate: r.period_date, status: r.status,
        paymentReceiptUrl: r.payment_receipt_url, upiTransactionId: r.upi_transaction_id,
        transactionDate: r.transaction_date, createdAt: r.created_at, userName: r.users?.name,
        flatNumber: r.units?.flat_number
    }));
};

export const submitMaintenancePayment = (id: string, receiptUrl: string, upiId: string, date: string) => 
    callEdgeFunction('manage-maintenance', { action: 'SUBMIT_PAYMENT', id, data: { receiptUrl, upiId, date } });

export const verifyMaintenancePayment = (id: string) => 
    callEdgeFunction('manage-maintenance', { action: 'VERIFY_PAYMENT', id });

// --- API MODULES: EXPENSES ---
export const getExpenses = async (communityId: string, signal?: AbortSignal): Promise<Expense[]> => {
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

export const createExpense = (data: any, user: User) => 
    callEdgeFunction('manage-expense', { action: 'CREATE', community_id: user.communityId, data });

export const approveExpense = (id: string, approverId: string) => 
    callEdgeFunction('manage-expense', { action: 'APPROVE', id });

export const rejectExpense = (id: string, approverId: string, reason: string) => 
    callEdgeFunction('manage-expense', { action: 'REJECT', id, data: { reason } });

// --- CORE UTILITIES ---
export const getUserProfile = (token?: string) => callEdgeFunction('get-user-profile', {}, { token });
export const updateTheme = (userId: string, theme: 'light' | 'dark') => callEdgeFunction('update-user-theme', { theme });
export const getCommunity = async (id: string): Promise<Community> => {
    const result = await callEdgeFunction('get-community-profile', { id });
    const data = result.data;
    return {
        id: data.id, name: data.name, address: data.address, status: data.status,
        communityType: data.community_type, blocks: data.blocks,
        maintenanceRate: Number(data.maintenance_rate) || 0,
        fixedMaintenanceAmount: Number(data.fixed_maintenance_amount) || 0,
        openingBalance: data.opening_balance ? Number(data.opening_balance) : 0,
        openingBalanceLocked: data.opening_balance_locked || false,
        pendingBalanceUpdate: data.pending_balance_update || null,
        contacts: data.contact_info, subscriptionType: data.subscription_type,
        subscriptionStartDate: data.subscription_start_date, pricePerUser: data.pricing_config
    };
};

export const getCommunityStats = async (): Promise<CommunityStat[]> => {
    const result = await callEdgeFunction('get-community-stats', {});
    const data = result?.data || [];
    return data.map((stat: any) => ({
        id: stat.id,
        name: stat.name,
        address: stat.address,
        status: stat.status,
        communityType: stat.community_type,
        blocks: stat.blocks,
        maintenanceRate: Number(stat.maintenance_rate) || 0,
        fixedMaintenanceAmount: Number(stat.fixed_maintenance_amount) || 0,
        openingBalance: stat.opening_balance ? Number(stat.opening_balance) : 0,
        openingBalanceLocked: stat.opening_balance_locked || false,
        pendingBalanceUpdate: stat.pending_balance_update || null,
        contacts: stat.contact_info,
        subscriptionType: stat.subscription_type,
        subscriptionStartDate: stat.subscription_start_date,
        pricePerUser: stat.pricing_config,
        resident_count: Number(stat.resident_count) || 0,
        admin_count: Number(stat.admin_count) || 0,
        helpdesk_count: Number(stat.helpdesk_count) || 0,
        security_count: Number(stat.security_count) || 0,
        staff_count: Number(stat.staff_count) || 0,
        income_generated: Number(stat.income_generated) || 0,
        current_month_paid: Number(stat.current_month_paid) || 0
    }));
};

export const createCommunity = (data: Partial<Community>) => callEdgeFunction('manage-community', { action: 'CREATE', data: mapCommunityToDb(data) });
export const updateCommunity = (id: string, data: Partial<Community>) => callEdgeFunction('manage-community', { action: 'UPDATE_PROFILE', community_id: id, data: mapCommunityToDb(data) });
export const deleteCommunity = (id: string) => callEdgeFunction('delete-community', { community_id: id });

export const getComplaints = async (communityId: string, userId?: string, role?: UserRole, signal?: AbortSignal): Promise<Complaint[]> => {
    const response = await callEdgeFunction('get-complaints', { community_id: communityId }, { signal });
    const data = response?.data || [];
    return data.map((c: any) => ({
        id: c.id, title: c.title, description: c.description, residentName: c.resident_name,
        flatNumber: c.flat_number, status: c.status, createdAt: c.created_at, category: c.category,
        userId: c.user_id, communityId: c.community_id, assignedTo: c.assigned_to, assignedToName: c.assigned_user?.name
    }));
};

export const createComplaint = (data: any, user: User) => callEdgeFunction('create-complaint', { ...data, community_id: user.communityId, user_id: user.id, resident_name: user.name, flat_number: user.flatNumber });
export const updateComplaintStatus = (id: string, status: string) => callEdgeFunction('update-complaint', { id, status });
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

// --- API MODULES: VISITORS ---
export const getVisitors = async (communityId: string, role?: UserRole, signal?: AbortSignal): Promise<Visitor[]> => {
    const response = await callEdgeFunction('get-visitors', { community_id: communityId }, { signal });
    const data = response?.data || [];
    return data.map(mapDbToVisitor);
};

export const createVisitor = async (data: any, user: User): Promise<Visitor> => {
    const response = await callEdgeFunction('manage-visitor', { 
        action: 'CREATE', 
        data: { ...data, resident_name: user.name, flat_number: user.flatNumber } 
    });
    return mapDbToVisitor(response.data);
};

export const updateVisitor = async (id: string, data: any): Promise<Visitor> => {
    const response = await callEdgeFunction('manage-visitor', { action: 'UPDATE', id, data });
    return mapDbToVisitor(response.data);
};

export const verifyVisitorEntry = (visitor_id: string, entry_token: string) => callEdgeFunction('verify-visitor', { visitor_id, entry_token });
export const deleteVisitor = (id: string) => callEdgeFunction('manage-visitor', { action: 'DELETE', id });

export const getResidents = async (communityId: string): Promise<User[]> => {
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
        return { 
            id: u.id, name: u.name, email: u.email, avatarUrl: u.avatar_url,
            flatNumber: displayFlatNumber, role: userRole, communityId: u.community_id,
            status: u.status, units, tenantDetails: u.profile_data, profile_data: u.profile_data
        };
    });
};

export const onboardTenant = (tenantData: any, ownerId: string, communityId: string, flatNumber: string) => callEdgeFunction('onboard-tenant', { tenantData, ownerId, communityId, flatNumber });
export const deleteTenant = (tenantId: string) => callEdgeFunction('delete-tenant', { tenantId });

export const createAdminUser = (data: any) => callEdgeFunction('create-admin-user', data);
export const createCommunityUser = (data: any) => callEdgeFunction('create-community-user', data);
export const bulkCreateCommunityUsers = (users: any[], communityId: string) => callEdgeFunction('bulk-create-users', { users, community_id: communityId });
export const recordCommunityPayment = (data: any) => callEdgeFunction('record-payment', data);
export const getFinancialHistory = (year: number) => callEdgeFunction('get-financial-history', { year });
export const getFinancialYears = async () => (await callEdgeFunction('get-financial-years', {}))?.years || [new Date().getFullYear()];
export const getMonthlyLedger = (community_id: string, month: number, year: number) => callEdgeFunction('get-monthly-ledger', { community_id, month, year });

export const getAuditLogs = async (communityId: string): Promise<AuditLog[]> => {
    const response = await callEdgeFunction('get-audit-logs', { community_id: communityId });
    const data = response?.data || [];
    return data.map((l: any) => ({
        id: l.id, createdAt: l.created_at, actorId: l.actor_id, communityId: l.community_id,
        actorName: l.users?.name, actorRole: l.users?.role, entity: l.entity,
        entityId: l.entity_id, action: l.action, details: l.details
    }));
};

export const setInitialOpeningBalance = (id: string, balance: number) => callEdgeFunction('manage-community', { action: 'SET_INITIAL_BALANCE', community_id: id, data: { balance } });
export const requestOpeningBalanceUpdate = (id: string, amount: number, reason: string, user: User) => callEdgeFunction('manage-community', { action: 'REQUEST_BALANCE_UPDATE', community_id: id, data: { amount, reason, requesterName: user.name } });
export const approveOpeningBalanceUpdate = (id: string, amount: number) => callEdgeFunction('manage-community', { action: 'APPROVE_BALANCE_UPDATE', community_id: id, data: { amount } });
export const rejectOpeningBalanceUpdate = (id: string) => callEdgeFunction('manage-community', { action: 'REJECT_BALANCE_UPDATE', community_id: id });
export const assignAdminUnit = (unitData: any, user: User, community: Community) => callEdgeFunction('assign-unit', { unitData, communityId: community.id, userId: user.id });
export const requestPasswordReset = (email: string) => supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' });

/**
 * Updates the user's password.
 * Uses native Auth client to correctly handle recovery sessions from URL hash.
 */
export const updateUserPassword = async (password: string) => {
    // Session Verification Pre-check
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        throw new Error("Auth session missing! Please ensure you are arriving via a valid recovery link.");
    }

    const { data, error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    return data;
};

export const getAssets = async (communityId: string): Promise<Asset[]> => {
    const response = await callEdgeFunction('manage-asset', { action: 'LIST', community_id: communityId });
    const data = response?.data || [];
    return data.map((a: any) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        category: a.category,
        quantity: Number(a.quantity) || 0,
        status: a.status,
        purchaseDate: a.purchase_date,
        warrantyExpiry: a.warranty_expiry,
        nextServiceDate: a.next_service_date,
        communityId: a.community_id
    }));
};

export const createAsset = (data: any, communityId: string) => callEdgeFunction('manage-asset', { action: 'CREATE', community_id: communityId, data });
export const updateAsset = (id: string, data: any) => callEdgeFunction('manage-asset', { action: 'UPDATE', id, data });
export const deleteAsset = (id: string) => callEdgeFunction('manage-asset', { action: 'DELETE', id });
