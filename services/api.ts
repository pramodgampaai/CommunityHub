import { supabase, supabaseKey, supabaseProjectUrl } from './supabase';
import { 
    User, Community, CommunityStat, Notice, Complaint, Visitor, 
    Amenity, Booking, MaintenanceRecord, Expense, AuditLog, 
    Unit, UserRole, Asset, MarketplaceItem, MarketplaceMessage, MarketplaceItemStatus,
    RealEstateListing, FinancialHistory, MaintenanceStatus
} from '../types';

export interface MonthlyLedger {
    previousBalance: number;
    collectedThisMonth: number;
    pendingThisMonth: number;
    expensesThisMonth: number;
    closingBalance: number;
}

// Global Memory Cache for zero-flicker transitions
const apiCache = new Map<string, any>();

export const getCachedData = (key: string) => apiCache.get(key);
export const setCachedData = (key: string, data: any) => apiCache.set(key, data);

/**
 * Robust error extraction to handle strings, nested objects, and Supabase error formats
 */
const extractErrorMessage = (err: any): string => {
    if (!err) return "An unknown error occurred.";
    if (typeof err === 'string') return err;
    
    // Check for standard Supabase error format
    if (err.message && typeof err.message === 'string') {
        if (err.code === '42P17') return "Database Security Conflict (Recursion). Retrying via secure bridge...";
        return err.message;
    }
    
    // Deep search for error/message keys
    if (err.error) return extractErrorMessage(err.error);
    if (err.details && typeof err.details === 'string') return err.details;
    if (err.msg && typeof err.msg === 'string') return err.msg;
    
    try {
        const str = JSON.stringify(err);
        return str === '{}' ? String(err) : str;
    } catch {
        return String(err);
    }
};

const pendingRequests = new Map<string, Promise<any>>();

const callEdgeFunction = async (functionName: string, body: any, options: { token?: string, signal?: AbortSignal, anonymous?: boolean } = {}) => {
    let accessToken = options.token;
    
    if (!accessToken && !options.anonymous) {
        const { data: { session } } = await supabase.auth.getSession();
        accessToken = session?.access_token;
        if (!accessToken) {
            const { data: { session: refreshed } } = await supabase.auth.refreshSession();
            accessToken = refreshed?.access_token;
        }
    }

    const requestKey = `${functionName}:${accessToken?.substring(0, 10)}:${JSON.stringify(body)}`;
    if (pendingRequests.has(requestKey)) return pendingRequests.get(requestKey);

    const requestPromise = (async () => {
        if (!accessToken && !options.anonymous) {
            pendingRequests.delete(requestKey);
            throw new Error("Authentication session expired. Please re-login.");
        }

        const baseUrl = (supabaseProjectUrl || '').replace(/\/$/, '');
        const url = `${baseUrl}/functions/v1/${functionName}`;

        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json', 'apikey': supabaseKey };
            if (accessToken) headers['Authorization'] = `Bearer ${accessToken.trim()}`;
            else if (options.anonymous) headers['Authorization'] = `Bearer ${supabaseKey}`;

            const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: options.signal });
            if (options.signal?.aborted) return null;

            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                const result = await response.json();
                if (result?.error) throw new Error(extractErrorMessage(result.error));
                if (!response.ok) throw new Error(`Server status ${response.status} in ${functionName}`);
                return result;
            } else {
                const text = await response.text();
                if (!response.ok) throw new Error(text || `Server status ${response.status} in ${functionName}`);
                return text;
            }
        } catch (error: any) {
            if (error.name === 'AbortError' || options.signal?.aborted) return null;
            throw new Error(extractErrorMessage(error));
        } finally {
            setTimeout(() => pendingRequests.delete(requestKey), 500);
        }
    })();

    pendingRequests.set(requestKey, requestPromise);
    return requestPromise;
};

// --- AUTH MODULES ---
export const getUserProfile = (token: string) => callEdgeFunction('get-user-profile', {}, { token });
export const updateTheme = (userId: string, theme: 'light' | 'dark') => callEdgeFunction('update-user-theme', { theme });
export const updateUserPassword = (password: string) => callEdgeFunction('update-user-password', { password });
export const requestPasswordReset = (email: string) => supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
export const sendContactEnquiry = (data: any) => callEdgeFunction('send-enquiry', data, { anonymous: true });

// --- COMMUNITY MODULES ---
export const getCommunityStats = async (): Promise<CommunityStat[]> => {
    const response = await callEdgeFunction('get-community-stats', {});
    const data = response?.data || [];
    setCachedData('communityStats', data);
    return data;
};
export const getCommunity = async (id: string): Promise<Community> => {
    const response = await callEdgeFunction('get-community-profile', { id });
    const data = response?.data;
    setCachedData(`community:${id}`, data);
    return data;
};
export const createCommunity = (data: any) => callEdgeFunction('manage-community', { action: 'CREATE', data });
export const updateCommunity = (id: string, data: any) => callEdgeFunction('manage-community', { action: 'UPDATE_PROFILE', community_id: id, data });
export const deleteCommunity = (id: string) => callEdgeFunction('delete-community', { community_id: id });
export const setInitialOpeningBalance = (id: string, balance: number) => callEdgeFunction('manage-community', { action: 'SET_INITIAL_BALANCE', community_id: id, data: { balance } });
export const requestOpeningBalanceUpdate = (id: string, amount: number, reason: string, user: User) => callEdgeFunction('manage-community', { action: 'REQUEST_BALANCE_UPDATE', community_id: id, data: { amount, reason, requesterName: user.name } });
export const approveOpeningBalanceUpdate = (id: string, amount: number) => callEdgeFunction('manage-community', { action: 'APPROVE_BALANCE_UPDATE', community_id: id, data: { amount } });
export const rejectOpeningBalanceUpdate = (id: string) => callEdgeFunction('manage-community', { action: 'REJECT_BALANCE_UPDATE', community_id: id });

// --- USER MODULES ---
export const getResidents = async (communityId: string): Promise<User[]> => {
    const response = await callEdgeFunction('get-directory', { community_id: communityId });
    const data = response?.data || [];
    const mapped = data.map((u: any) => ({
        id: u.id, name: u.name, email: u.email, avatarUrl: u.avatar_url,
        flatNumber: u.flat_number, role: u.role, communityId: u.community_id,
        status: u.status, theme: u.theme, tenantDetails: u.profile_data, profile_data: u.profile_data
    }));
    setCachedData(`residents:${communityId}`, mapped);
    return mapped;
};
export const createAdminUser = (data: any) => callEdgeFunction('create-admin-user', data);
export const createCommunityUser = (data: any) => callEdgeFunction('create-community-user', data);
export const bulkCreateCommunityUsers = (users: any[], communityId: string) => callEdgeFunction('bulk-create-users', { users, community_id: communityId });
export const assignAdminUnit = (unitData: any, user: User, community: Community) => callEdgeFunction('assign-unit', { unitData, communityId: community.id, userId: user.id });
export const onboardTenant = (tenantData: any, ownerId: string, communityId: string, flatNumber: string) => callEdgeFunction('onboard-tenant', { tenantData, ownerId, communityId, flatNumber });
export const deleteTenant = (tenantId: string) => callEdgeFunction('delete-tenant', { tenantId });

// --- VISITOR MODULES ---
export const getVisitors = async (communityId: string, role?: UserRole, signal?: AbortSignal): Promise<Visitor[]> => {
    const response = await callEdgeFunction('get-visitors', { community_id: communityId }, { signal });
    const data = response?.data || [];
    const mapped = data.map((v: any) => ({
        id: v.id, name: v.name, visitorType: v.visitor_type, vehicleNumber: v.vehicle_number,
        purpose: v.purpose, status: v.status, expectedAt: v.expected_at,
        entryToken: v.entry_token, residentName: v.resident_name, flatNumber: v.flat_number,
        totalGuests: v.total_guests, photoUrl: v.photo_url
    }));
    setCachedData(`visitors:${communityId}:${role || 'std'}`, mapped);
    return mapped;
};
export const createVisitor = async (data: any, user: User) => {
    const response = await callEdgeFunction('manage-visitor', { action: 'CREATE', data: { ...data, resident_name: user.name, flat_number: user.flatNumber } });
    return response.data;
};
export const updateVisitor = (id: string, data: any) => callEdgeFunction('manage-visitor', { action: 'UPDATE', id, data });
export const deleteVisitor = (id: string) => callEdgeFunction('manage-visitor', { action: 'DELETE', id });
export const verifyVisitorEntry = (visitor_id: string, entry_token: string, photo_data?: string) => callEdgeFunction('verify-visitor', { visitor_id, entry_token, photo_data });

// --- COMPLAINT MODULES ---
export const getComplaints = async (communityId: string, userId?: string, role?: UserRole, signal?: AbortSignal): Promise<Complaint[]> => {
    const response = await callEdgeFunction('get-complaints', { community_id: communityId }, { signal });
    const data = response?.data || [];
    const mapped = data.map((c: any) => ({
        id: c.id, title: c.title, description: c.description, residentName: c.resident_name,
        flatNumber: c.flat_number, status: c.status, createdAt: c.created_at,
        category: c.category, userId: c.user_id, communityId: c.community_id,
        assignedTo: c.assigned_to, assignedToName: c.assigned_user?.name
    }));
    setCachedData(`complaints:${communityId}:${role === UserRole.Admin ? 'all' : userId}`, mapped);
    return mapped;
};
export const createComplaint = (data: any, user: User) => callEdgeFunction('create-complaint', { ...data, community_id: user.communityId, user_id: user.id, resident_name: user.name, flat_number: user.flatNumber });
export const updateComplaintStatus = (id: string, status: string) => callEdgeFunction('update-complaint', { id, status });
export const assignComplaint = (id: string, userId: string | null) => callEdgeFunction('update-complaint', { id, assigned_to: userId });
export const getComplaintActivity = async (id: string, communityId: string): Promise<AuditLog[]> => {
    const response = await callEdgeFunction('get-audit-logs', { community_id: communityId, entity: 'Complaint', entity_id: id });
    return (response.data || []).map((l: any) => ({
        id: l.id, createdAt: l.created_at, actorId: l.actor_id, communityId: l.community_id,
        actorName: l.users?.name, actorRole: l.users?.role, entity: l.entity, entity_id: l.entity_id,
        action: l.action, details: l.details
    }));
};

// --- ASSET MODULES ---
export const getAssets = async (communityId: string): Promise<Asset[]> => {
    const response = await callEdgeFunction('manage-asset', { action: 'LIST', community_id: communityId });
    const data = (response.data || []).map((a: any) => ({
        id: a.id, name: a.name, description: a.description, category: a.category,
        quantity: a.quantity, status: a.status, purchaseDate: a.purchase_date,
        warrantyExpiry: a.warranty_expiry, nextServiceDate: a.next_service_date,
        communityId: a.community_id
    }));
    setCachedData(`assets:${communityId}`, data);
    return data;
};
export const createAsset = (data: any, communityId: string) => callEdgeFunction('manage-asset', { action: 'CREATE', community_id: communityId, data });
export const updateAsset = (id: string, data: any) => callEdgeFunction('manage-asset', { action: 'UPDATE', id, data });
export const deleteAsset = (id: string) => callEdgeFunction('manage-asset', { action: 'DELETE', id });

// --- MISC MODULES ---
export const getAuditLogs = async (communityId: string): Promise<AuditLog[]> => {
    const response = await callEdgeFunction('get-audit-logs', { community_id: communityId });
    return (response.data || []).map((l: any) => ({
        id: l.id, createdAt: l.created_at, actorId: l.actor_id, communityId: l.community_id,
        actorName: l.users?.name, actorRole: l.users?.role, entity: l.entity, entity_id: l.entity_id,
        action: l.action, details: l.details
    }));
};

export const getFinancialYears = async (): Promise<number[]> => {
    const response = await callEdgeFunction('get-financial-years', {});
    return response.years || [];
};

export const getFinancialHistory = async (year: number): Promise<FinancialHistory> => {
    const response = await callEdgeFunction('get-financial-history', { year });
    return response;
};

export const recordCommunityPayment = (data: any) => callEdgeFunction('record-payment', data);

export const getMonthlyLedger = async (communityId: string, month: number, year: number): Promise<MonthlyLedger> => {
    // Fix: replaced undefined community_id with parameter communityId
    return callEdgeFunction('get-monthly-ledger', { community_id: communityId, month, year });
};

// --- REAL ESTATE MODULES ---
export const getRealEstateListings = async (communityId: string): Promise<RealEstateListing[]> => {
    const response = await callEdgeFunction('manage-real-estate', { action: 'LIST_LISTINGS', communityId });
    const mapped = (response.data || []).map((l: any) => ({
        id: l.id,
        ownerId: l.owner_id,
        ownerName: l.owner_name,
        ownerFlat: l.owner_flat,
        unitId: l.unit_id,
        unitFlat: l.unit_flat,
        unitBlock: l.unit_block,
        unitSize: Number(l.unit_size),
        unitFloor: Number(l.unit_floor),
        communityId: l.community_id,
        rentAmount: Number(l.rent_amount),
        depositAmount: Number(l.deposit_amount),
        availableFrom: l.available_from,
        furnishingStatus: l.furnishing_status,
        description: l.description,
        imageUrl: l.image_url,
        status: l.status,
        createdAt: l.created_at
    }));
    setCachedData(`real_estate:${communityId}`, mapped);
    return mapped;
};

export const createRealEstateListing = (data: any) => callEdgeFunction('manage-real-estate', { action: 'CREATE_LISTING', data });
export const updateRealEstateStatus = (id: string, status: string) => callEdgeFunction('manage-real-estate', { action: 'UPDATE_STATUS', id, status });

// --- MARKETPLACE MODULES ---
export const getMarketplaceItems = async (communityId: string): Promise<MarketplaceItem[]> => {
    const response = await callEdgeFunction('manage-marketplace', { action: 'LIST_ITEMS', communityId });
    const mapped = (response.data || []).map((item: any) => ({
        id: item.id,
        sellerId: item.seller_id,
        sellerName: item.seller_name,
        sellerFlat: item.seller_flat,
        communityId: item.community_id,
        title: item.title,
        description: item.description,
        price: Number(item.price),
        category: item.category,
        status: item.status,
        imageUrl: item.image_url,
        createdAt: item.created_at
    }));
    setCachedData(`marketplace:${communityId}`, mapped);
    return mapped;
};

export const createMarketplaceItem = async (data: any, user: User) => {
    return callEdgeFunction('manage-marketplace', { action: 'CREATE_ITEM', data });
};

export const updateMarketplaceItemStatus = async (id: string, status: MarketplaceItemStatus) => {
    if (status === MarketplaceItemStatus.Sold) {
        return callEdgeFunction('manage-marketplace', { action: 'MARK_SOLD', id });
    }
    throw new Error("Unsupported status update");
};

export const getMarketplaceMessages = async (userId: string): Promise<MarketplaceMessage[]> => {
    const response = await callEdgeFunction('manage-marketplace', { action: 'LIST_MESSAGES', userId });
    return (response.data || []).map((m: any) => ({
        id: m.id,
        itemId: m.item_id,
        itemTitle: m.item_title,
        rentalId: m.rental_id,
        rentalTitle: m.rental_title,
        senderId: m.sender_id,
        senderName: m.sender_name,
        senderFlat: m.sender_flat,
        receiverId: m.receiver_id,
        message: m.message,
        isRead: !!m.is_read,
        createdAt: m.created_at
    }));
};

export const sendMarketplaceMessage = async (data: any, user: User) => {
    return callEdgeFunction('manage-marketplace', { action: 'SEND_MESSAGE', data });
};

export const markMarketplaceMessagesRead = async (itemId: string | null, otherUserId: string, rentalId: string | null = null) => {
    return callEdgeFunction('manage-marketplace', { action: 'MARK_READ', itemId, otherUserId, rentalId });
};

// --- REST OF THE API (REMAINING EXISTING FUNCTIONS) ---
export const getNotices = async (communityId: string, signal?: AbortSignal): Promise<Notice[]> => {
    const response = await callEdgeFunction('get-notices', { community_id: communityId }, { signal });
    const data = response?.data || [];
    const mapped = data.map((n: any) => ({
        id: n.id, title: n.title, content: n.content, author: n.author,
        createdAt: n.created_at, type: n.type, communityId: n.community_id,
        validFrom: n.valid_from, validUntil: n.valid_until
    }));
    setCachedData(`notices:${communityId}`, mapped);
    return mapped;
};

export const createNotice = (data: any, user: User) => callEdgeFunction('manage-notice', { action: 'CREATE', data, community_id: user.communityId });
export const updateNotice = (id: string, data: any, user: User) => callEdgeFunction('manage-notice', { action: 'UPDATE', id, data, community_id: user.communityId });
export const deleteNotice = (id: string) => callEdgeFunction('manage-notice', { action: 'DELETE', id });

export const getAmenities = async (communityId: string): Promise<Amenity[]> => {
    const response = await callEdgeFunction('get-amenities', { community_id: communityId });
    const data = response?.data || [];
    const mapped = data.map((a: any) => ({
        id: a.id, name: a.name, description: a.description, imageUrl: a.image_url,
        capacity: Number(a.capacity) || 0, communityId: a.community_id,
        maxDuration: Number(a.max_duration) || 0, status: a.status
    }));
    setCachedData(`amenities:${communityId}`, mapped);
    return mapped;
};

export const getBookings = async (communityId: string): Promise<Booking[]> => {
    const response = await callEdgeFunction('get-bookings', { community_id: communityId });
    const data = response?.data || [];
    const mapped = data.map((b: any) => ({
        id: b.id, amenityId: b.amenity_id, residentName: b.resident_name,
        flatNumber: b.flat_number, startTime: b.start_time, endTime: b.end_time, communityId: b.community_id
    }));
    setCachedData(`bookings:${communityId}`, mapped);
    return mapped;
};

export const createAmenity = (data: any, user: User) => callEdgeFunction('manage-amenity', { action: 'CREATE', data: { ...data, community_id: user.communityId } });
export const updateAmenity = (id: string, data: any) => callEdgeFunction('manage-amenity', { action: 'UPDATE', id, data });
export const deleteAmenity = (id: string) => callEdgeFunction('manage-amenity', { action: 'DELETE', id });
export const createBooking = (data: any, user: User) => callEdgeFunction('manage-booking', { action: 'CREATE', community_id: user.communityId, data });

export const getMaintenanceRecords = async (communityId: string, userId?: string, signal?: AbortSignal): Promise<MaintenanceRecord[]> => {
    const response = await callEdgeFunction('get-maintenance-records', { community_id: communityId, user_id: userId }, { signal });
    const data = response?.data || [];
    const mapped = data.map((r: any) => ({
        id: r.id, userId: r.user_id, communityId: r.community_id, amount: r.amount,
        periodDate: r.period_date, status: r.status as MaintenanceStatus,
        paymentReceiptUrl: r.payment_receipt_url, upiTransactionId: r.upi_transaction_id,
        transactionDate: r.transaction_date, createdAt: r.created_at,
        userName: r.users?.name, flatNumber: r.units?.flat_number
    }));
    setCachedData(`maintenance:${communityId}:${userId || 'all'}`, mapped);
    return mapped;
};
export const submitMaintenancePayment = (id: string, receiptUrl: string, upiId: string, date: string) => callEdgeFunction('manage-maintenance', { action: 'SUBMIT_PAYMENT', id, data: { receiptUrl, upiId, date } });
export const verifyMaintenancePayment = (id: string) => callEdgeFunction('manage-maintenance', { action: 'VERIFY_PAYMENT', id });

export const getExpenses = async (communityId: string, signal?: AbortSignal): Promise<Expense[]> => {
    const response = await callEdgeFunction('get-expenses', { community_id: communityId }, { signal });
    const data = response?.data || [];
    const mapped = data.map((e: any) => ({
        id: e.id, title: e.title, amount: e.amount, category: e.category,
        description: e.description, date: e.date, submittedBy: e.submitted_by,
        submittedByName: e.submitted_user?.name, status: e.status,
        approvedBy: e.approved_by, approvedByName: e.approved_user?.name,
        communityId: e.community_id, createdAt: e.created_at, receiptUrl: e.receipt_url
    }));
    setCachedData(`expenses:${communityId}`, mapped);
    return mapped;
};
export const createExpense = (data: any, user: User) => callEdgeFunction('manage-expense', { action: 'CREATE', data });
export const approveExpense = (id: string, userId: string) => callEdgeFunction('manage-expense', { action: 'APPROVE', id });
export const rejectExpense = (id: string, userId: string, reason: string) => callEdgeFunction('manage-expense', { action: 'REJECT', id, data: { reason } });