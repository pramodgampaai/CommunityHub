
import { supabase, supabaseKey, supabaseProjectUrl } from './supabase';
import { 
    User, Community, CommunityStat, Notice, Complaint, Visitor, 
    Amenity, Booking, MaintenanceRecord, Expense, AuditLog, 
    FinancialHistory, Unit, MaintenanceConfiguration, UserRole, 
    ComplaintStatus, VisitorStatus, ExpenseStatus, NoticeType,
    ComplaintCategory, VisitorType, ExpenseCategory, CommunityType,
    CommunityContact, CommunityPricing, MaintenanceStatus, TenantProfile
} from '../types';

export interface MonthlyLedger {
    previousBalance: number;
    collectedThisMonth: number;
    pendingThisMonth: number;
    expensesThisMonth: number;
    closingBalance: number;
}

// --- Helper for calling Edge Functions securely ---
const callEdgeFunction = async (functionName: string, body: any, options: { token?: string, signal?: AbortSignal } = {}) => {
    let accessToken = options.token;
    
    if (!accessToken) {
        const { data: { session } } = await supabase.auth.getSession();
        accessToken = session?.access_token;
    }

    if (!accessToken) {
        throw new Error("Authentication required. Please re-authenticate.");
    }

    const baseUrl = supabaseProjectUrl.replace(/\/$/, '');
    const url = `${baseUrl}/functions/v1/${functionName}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'apikey': supabaseKey
            },
            body: JSON.stringify(body),
            signal: options.signal // Pass the abort signal to the fetch request
        });

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            const result = await response.json();
            if (!response.ok) {
                const msg = result.error || (typeof result === 'string' ? result : JSON.stringify(result));
                throw new Error(msg || `Failed to execute ${functionName}`);
            }
            return result;
        } else {
            const text = await response.text();
            if (!response.ok) {
                throw new Error(text || `Server error (${response.status}) in ${functionName}`);
            }
            return text;
        }
    } catch (networkError: any) {
        // Silently ignore aborted requests - this happens on page navigation.
        if (networkError.name === 'AbortError' || options.signal?.aborted) {
            return null;
        }
        
        console.error(`Network error calling ${functionName}:`, networkError);
        if (networkError.message === 'Failed to fetch') {
            throw new Error(`Connection to ${functionName} interrupted. This may be a CORS issue or server crash.`);
        }
        throw networkError;
    }
};

const callManageAmenity = async (body: any) => {
    return callEdgeFunction('manage-amenity', body);
};

// --- Auth & Users ---

export const getUserProfile = async (token?: string) => {
    return callEdgeFunction('get-user-profile', {}, { token });
};

export const requestPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password',
    });
    if (error) throw error;
};

/**
 * Updates the user's theme preference.
 * Uses an Edge Function to bypass recursive RLS policies on the users table.
 */
export const updateTheme = async (userId: string, theme: 'light' | 'dark') => {
    return callEdgeFunction('update-user-theme', { theme });
};

export const updateUserPassword = async (password: string) => {
    await callEdgeFunction('update-user-password', { password });
};

export const createAdminUser = async (data: any) => {
    await callEdgeFunction('create-admin-user', data);
};

export const createCommunityUser = async (data: any) => {
    await callEdgeFunction('create-community-user', data);
};

export const bulkCreateCommunityUsers = async (users: any[], communityId: string) => {
    return callEdgeFunction('bulk-create-users', { users, community_id: communityId });
};

export const getResidents = async (communityId: string): Promise<User[]> => {
    const response = await callEdgeFunction('get-directory', { community_id: communityId });
    const data = response?.data || [];
    
    return data.map((u: any) => {
        const units = u.units ? u.units.map((unit: any) => ({
            id: unit.id,
            userId: unit.user_id,
            communityId: unit.community_id,
            flatNumber: unit.flat_number,
            block: unit.block,
            floor: unit.floor,
            flatSize: unit.flat_size,
            maintenanceStartDate: unit.maintenance_start_date
        })) : [];

        let displayFlatNumber = u.flat_number;
        
        if (units.length > 0) {
            const primary = units[0];
            displayFlatNumber = primary.block ? `${primary.block}-${primary.flatNumber}` : primary.flatNumber;
            
            if (units.length > 1) {
                displayFlatNumber += ` (+${units.length - 1})`;
            }
        }

        let userRole = u.role as UserRole;
        if (userRole === UserRole.Resident && u.profile_data?.is_tenant) {
            userRole = UserRole.Tenant;
        }

        return {
            id: u.id,
            name: u.name,
            email: u.email,
            role: userRole,
            communityId: u.community_id,
            status: u.status,
            avatarUrl: u.avatar_url,
            flatNumber: displayFlatNumber,
            units: units,
            theme: u.theme,
            tenantDetails: u.profile_data
        };
    });
};

export const assignAdminUnit = async (unitData: any, user: User, community: Community) => {
    await callEdgeFunction('assign-unit', { 
        unitData, 
        communityId: community.id, 
        userId: user.id 
    });
};

export const onboardTenant = async (tenantData: any, ownerUser: User) => {
    return callEdgeFunction('onboard-tenant', { 
        tenantData, 
        ownerId: ownerUser.id, 
        communityId: ownerUser.communityId,
        flatNumber: ownerUser.flatNumber 
    });
};

export const deleteTenant = async (tenantId: string) => {
    return callEdgeFunction('delete-tenant', { tenantId });
};

// --- Community ---

export const getCommunity = async (id: string): Promise<Community> => {
    const { data, error } = await supabase
        .from('communities')
        .select('*')
        .eq('id', id)
        .single();
    
    if (error) throw error;
    
    return {
        id: data.id,
        name: data.name,
        address: data.address,
        status: data.status,
        communityType: data.community_type,
        blocks: data.blocks,
        maintenanceRate: data.maintenance_rate,
        fixedMaintenanceAmount: data.fixed_maintenance_amount,
        contacts: data.contact_info,
        subscriptionType: data.subscription_type,
        subscriptionStartDate: data.subscription_start_date,
        pricePerUser: data.pricing_config
    };
};

export const getCommunityStats = async (): Promise<CommunityStat[]> => {
    const result = await callEdgeFunction('get-community-stats', {});
    
    const stats: CommunityStat[] = (result?.data || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        address: item.address,
        status: item.status,
        communityType: item.community_type,
        blocks: item.blocks,
        maintenanceRate: item.maintenance_rate,
        fixed_maintenance_amount: item.fixed_maintenance_amount,
        contacts: item.contact_info,
        subscriptionType: item.subscription_type,
        subscriptionStartDate: item.subscription_start_date,
        pricePerUser: item.pricing_config,
        resident_count: item.resident_count,
        admin_count: item.admin_count,
        helpdesk_count: item.helpdesk_count,
        security_count: item.security_count,
        staff_count: item.staff_count,
        income_generated: item.income_generated,
        current_month_paid: item.current_month_paid
    }));

    return stats;
};

export const createCommunity = async (data: any) => {
    const payload = {
        name: data.name,
        address: data.address,
        community_type: data.communityType,
        blocks: data.blocks,
        maintenance_rate: data.maintenanceRate,
        fixed_maintenance_amount: data.fixedMaintenanceAmount,
        contact_info: data.contacts,
        subscription_type: data.subscriptionType,
        subscription_start_date: data.subscriptionStartDate,
        pricing_config: data.pricePerUser,
        status: 'active'
    };
    
    const { error } = await supabase.from('communities').insert(payload);
    if (error) throw error;
};

// Fix for AdminPanel and CommunitySetup
export const updateCommunity = async (id: string, data: any) => {
    const payload: any = {};
    if (data.name) payload.name = data.name;
    if (data.address) payload.address = data.address;
    if (data.communityType) payload.community_type = data.communityType;
    if (data.blocks) payload.blocks = data.blocks;
    if (data.maintenanceRate !== undefined) payload.maintenance_rate = data.maintenanceRate;
    if (data.fixedMaintenanceAmount !== undefined) payload.fixed_maintenance_amount = data.fixedMaintenanceAmount;
    if (data.contacts) payload.contact_info = data.contacts;
    if (data.subscriptionType) payload.subscription_type = data.subscriptionType;
    if (data.subscriptionStartDate) payload.subscription_start_date = data.subscriptionStartDate;
    if (data.pricePerUser) payload.pricing_config = data.pricePerUser;

    const { error } = await supabase.from('communities').update(payload).eq('id', id);
    if (error) throw error;
};

// Fix for AdminPanel
export const deleteCommunity = async (id: string) => {
    return callEdgeFunction('delete-community', { community_id: id });
};

// --- Notices ---

// Fix for Dashboard and NoticeBoard
export const getNotices = async (communityId: string, signal?: AbortSignal): Promise<Notice[]> => {
    const response = await callEdgeFunction('get-notices', { community_id: communityId }, { signal });
    return response?.data || [];
};

// Fix for NoticeBoard
export const createNotice = async (data: any, user: User) => {
    return callEdgeFunction('create-notice', {
        title: data.title,
        content: data.content,
        type: data.type,
        author_name: user.name,
        community_id: user.communityId,
        valid_from: data.validFrom,
        valid_until: data.validUntil
    });
};

// Fix for NoticeBoard
export const updateNotice = async (id: string, data: any, user: User) => {
    const { error } = await supabase.from('notices').update({
        title: data.title,
        content: data.content,
        type: data.type,
        valid_from: data.validFrom,
        valid_until: data.validUntil
    }).eq('id', id);
    if (error) throw error;
};

// Fix for NoticeBoard
export const deleteNotice = async (id: string, user?: User) => {
    const { error } = await supabase.from('notices').delete().eq('id', id);
    if (error) throw error;
};

// --- Help Desk ---

// Fix for Dashboard and HelpDesk
export const getComplaints = async (communityId: string, userId?: string, role?: UserRole, signal?: AbortSignal): Promise<Complaint[]> => {
    const response = await callEdgeFunction('get-complaints', { community_id: communityId }, { signal });
    const data = response?.data || [];
    return data.map((c: any) => ({
        ...c,
        residentName: c.resident_name,
        flatNumber: c.flat_number,
        createdAt: c.created_at,
        userId: c.user_id,
        communityId: c.community_id,
        assignedTo: c.assigned_to,
        assignedToName: c.assigned_user?.name
    }));
};

// Fix for HelpDesk
export const createComplaint = async (data: any, user: User) => {
    return callEdgeFunction('create-complaint', {
        title: data.title,
        description: data.description,
        category: data.category,
        community_id: user.communityId,
        user_id: user.id,
        resident_name: user.name,
        flat_number: user.flatNumber,
        unit_id: user.units && user.units.length > 0 ? user.units[0].id : null
    });
};

// Fix for HelpDesk
export const updateComplaintStatus = async (id: string, status: ComplaintStatus) => {
    return callEdgeFunction('update-complaint', { id, status });
};

// Fix for HelpDesk
export const assignComplaint = async (id: string, agentId: string) => {
    return callEdgeFunction('update-complaint', { id, assigned_to: agentId });
};

// Fix for HelpDesk
export const getComplaintActivity = async (complaintId: string): Promise<AuditLog[]> => {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await callEdgeFunction('get-audit-logs', { 
        community_id: session?.user.user_metadata.community_id,
        entity: 'Complaint', 
        entity_id: complaintId 
    });
    return (response?.data || []).map((log: any) => ({
        id: log.id,
        createdAt: log.created_at,
        actorId: log.actor_id,
        communityId: log.community_id,
        actorName: log.users?.name,
        actorRole: log.users?.role,
        entity: log.entity,
        entityId: log.entity_id,
        action: log.action,
        details: log.details
    }));
};

// --- Visitors ---

// Fix for Dashboard and Visitors
export const getVisitors = async (communityId: string, role?: UserRole, signal?: AbortSignal): Promise<Visitor[]> => {
    const response = await callEdgeFunction('get-visitors', { community_id: communityId }, { signal });
    const data = response?.data || [];
    return data.map((v: any) => ({
        ...v,
        visitorType: v.visitor_type,
        vehicleNumber: v.vehicle_number,
        expectedAt: v.expected_at,
        validUntil: v.valid_until,
        entryTime: v.entry_time,
        exitTime: v.exit_time,
        entryToken: v.entry_token,
        residentName: v.resident_name,
        flatNumber: v.flat_number,
        communityId: v.community_id,
        userId: v.user_id
    }));
};

// Fix for Visitors
export const createVisitor = async (data: any, user: User): Promise<Visitor> => {
    const entryToken = Math.random().toString(36).substring(2, 8).toUpperCase();
    const payload = {
        name: data.name,
        visitor_type: data.visitorType,
        vehicle_number: data.vehicleNumber,
        purpose: data.purpose,
        status: 'Expected',
        expected_at: data.expectedAt,
        entry_token: entryToken,
        resident_name: user.name,
        flat_number: user.flatNumber,
        community_id: user.communityId,
        user_id: user.id
    };

    const { data: visitor, error } = await supabase.from('visitors').insert(payload).select().single();
    if (error) throw error;
    
    return {
        ...visitor,
        visitorType: visitor.visitor_type,
        vehicleNumber: visitor.vehicle_number,
        expectedAt: visitor.expected_at,
        entryToken: visitor.entry_token,
        residentName: visitor.resident_name,
        flatNumber: visitor.flat_number,
        communityId: visitor.community_id,
        userId: visitor.user_id
    };
};

// Fix for Visitors
export const updateVisitor = async (id: string, data: any, user: User) => {
    const { error } = await supabase.from('visitors').update({
        name: data.name,
        visitor_type: data.visitorType,
        vehicle_number: data.vehicleNumber,
        purpose: data.purpose,
        expected_at: data.expectedAt
    }).eq('id', id);
    if (error) throw error;
};

// Fix for Visitors
export const deleteVisitor = async (id: string, user: User) => {
    const { error } = await supabase.from('visitors').delete().eq('id', id);
    if (error) throw error;
};

// Fix for Visitors
export const verifyVisitorEntry = async (visitor_id: string, entry_token: string, user: User) => {
    return callEdgeFunction('verify-visitor', { visitor_id, entry_token });
};

// --- Amenities ---

// Fix for Amenities
export const getAmenities = async (communityId: string): Promise<Amenity[]> => {
    const response = await callEdgeFunction('get-amenities', { community_id: communityId });
    const data = response?.data || [];
    return data.map((a: any) => ({
        ...a,
        imageUrl: a.image_url,
        maxDuration: a.max_duration
    }));
};

// Fix for Amenities
export const createAmenity = async (data: any, user: User) => {
    return callManageAmenity({ action: 'CREATE', data: { ...data, community_id: user.communityId } });
};

// Fix for Amenities
export const updateAmenity = async (id: string, data: any) => {
    return callManageAmenity({ action: 'UPDATE', id, data });
};

// Fix for Amenities
export const deleteAmenity = async (id: string) => {
    return callManageAmenity({ action: 'DELETE', id });
};

// Fix for Amenities
export const getBookings = async (communityId: string): Promise<Booking[]> => {
    const response = await callEdgeFunction('get-bookings', { community_id: communityId });
    const data = response?.data || [];
    return data.map((b: any) => ({
        ...b,
        residentName: b.resident_name,
        flatNumber: b.flat_number,
        startTime: b.start_time,
        endTime: b.end_time,
        amenityId: b.amenity_id,
        communityId: b.community_id
    }));
};

// Fix for Amenities
export const createBooking = async (data: any, user: User) => {
    const payload = {
        amenity_id: data.amenityId,
        resident_name: user.name,
        flat_number: user.flatNumber,
        start_time: data.startTime,
        end_time: data.endTime,
        community_id: user.communityId,
        user_id: user.id
    };
    
    const { error } = await supabase.from('bookings').insert(payload);
    if (error) throw error;
};

// --- Maintenance ---

// Fix for Dashboard and Maintenance
export const getMaintenanceRecords = async (communityId: string, userId?: string, signal?: AbortSignal): Promise<MaintenanceRecord[]> => {
    const response = await callEdgeFunction('get-maintenance-records', { community_id: communityId, user_id: userId }, { signal });
    const data = response?.data || [];
    return data.map((r: any) => ({
        ...r,
        userId: r.user_id,
        unitId: r.unit_id,
        communityId: r.community_id,
        periodDate: r.period_date,
        paymentReceiptUrl: r.payment_receipt_url,
        upiTransactionId: r.upi_transaction_id,
        transactionDate: r.transaction_date,
        createdAt: r.created_at,
        userName: r.users?.name,
        flatNumber: r.units?.flat_number
    }));
};

// Fix for Maintenance
export const submitMaintenancePayment = async (id: string, receiptUrl: string, upiId: string, date: string, user: User) => {
    const { error } = await supabase.from('maintenance_records').update({
        status: MaintenanceStatus.Submitted,
        payment_receipt_url: receiptUrl,
        upi_transaction_id: upiId,
        transaction_date: date
    }).eq('id', id);
    if (error) throw error;

    await supabase.from('audit_logs').insert({
        community_id: user.communityId,
        actor_id: user.id,
        action: 'UPDATE',
        entity: 'MaintenanceRecord',
        entity_id: id,
        details: { description: `Payment submitted for maintenance record ${id}`, upi_id: upiId }
    });
};

// Fix for Maintenance
export const verifyMaintenancePayment = async (id: string, user: User) => {
    const { error } = await supabase.from('maintenance_records').update({
        status: MaintenanceStatus.Paid
    }).eq('id', id);
    if (error) throw error;

    await supabase.from('audit_logs').insert({
        community_id: user.communityId,
        actor_id: user.id,
        action: 'UPDATE',
        entity: 'MaintenanceRecord',
        entity_id: id,
        details: { description: `Payment verified for maintenance record ${id}` }
    });
};

// --- Expenses ---

// Fix for Dashboard and Expenses
export const getExpenses = async (communityId: string, signal?: AbortSignal): Promise<Expense[]> => {
    const response = await callEdgeFunction('get-expenses', { community_id: communityId }, { signal });
    const data = response?.data || [];
    return data.map((e: any) => ({
        ...e,
        submittedBy: e.submitted_by,
        submittedByName: e.submitted_user?.name,
        approvedBy: e.approved_by,
        approvedByName: e.approved_user?.name,
        communityId: e.community_id,
        createdAt: e.created_at,
        receiptUrl: e.receipt_url
    }));
};

// Fix for Expenses
export const createExpense = async (data: any, user: User) => {
    const { data: expense, error } = await supabase.from('expenses').insert({
        title: data.title,
        amount: data.amount,
        category: data.category,
        description: data.description,
        date: data.date,
        receipt_url: data.receiptUrl,
        submitted_by: user.id,
        community_id: user.communityId,
        status: ExpenseStatus.Pending
    }).select().single();
    if (error) throw error;
    return expense;
};

// Fix for Expenses
export const approveExpense = async (id: string, approverId: string) => {
    const { error } = await supabase.from('expenses').update({
        status: ExpenseStatus.Approved,
        approved_by: approverId
    }).eq('id', id);
    if (error) throw error;
};

// Fix for Expenses
export const rejectExpense = async (id: string, approverId: string, reason: string) => {
    const { error } = await supabase.from('expenses').update({
        status: ExpenseStatus.Rejected,
        approved_by: approverId,
        description: reason
    }).eq('id', id);
    if (error) throw error;
};

// Fix for Expenses
export const getMonthlyLedger = async (community_id: string, month: number, year: number): Promise<MonthlyLedger> => {
    return callEdgeFunction('get-monthly-ledger', { community_id, month, year });
};

// --- Audit & Billing ---

// Fix for AuditLog and AuditLogModal
export const getAuditLogs = async (communityId: string, actorId?: string, role?: UserRole): Promise<AuditLog[]> => {
    const response = await callEdgeFunction('get-audit-logs', { community_id: communityId });
    const data = response?.data || [];
    return data.map((log: any) => ({
        id: log.id,
        createdAt: log.created_at,
        actorId: log.actor_id,
        communityId: log.community_id,
        actorName: log.users?.name,
        actorRole: log.users?.role,
        entity: log.entity,
        entityId: log.entity_id,
        action: log.action,
        details: log.details
    }));
};

// Fix for Billing
export const recordCommunityPayment = async (data: any) => {
    return callEdgeFunction('record-payment', data);
};

// Fix for Billing
export const getFinancialHistory = async (year: number): Promise<FinancialHistory> => {
    return callEdgeFunction('get-financial-history', { year });
};

// Fix for Billing
export const getFinancialYears = async (): Promise<number[]> => {
    const response = await callEdgeFunction('get-financial-years', {});
    return response?.years || [new Date().getFullYear()];
};
