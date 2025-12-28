
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
const callEdgeFunction = async (functionName: string, body: any, token?: string) => {
    let accessToken = token;
    
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
            body: JSON.stringify(body)
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
    return callEdgeFunction('get-user-profile', {}, token);
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
    const data = response.data || [];
    
    return data.map((u: any) => {
        const units = u.units ? u.units.map((unit: any) => ({
            id: unit.id,
            userId: unit.user_id,
            communityId: unit.community_id,
            flatNumber: unit.flat_number,
            block: unit.block,
            floor: unit.floor,
            flat_size: unit.flat_size,
            maintenance_start_date: unit.maintenance_start_date
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
    
    const stats: CommunityStat[] = (result.data || []).map((item: any) => ({
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
        maintenance_rate: data.maintenance_rate,
        fixed_maintenance_amount: data.fixed_maintenance_amount,
        contact_info: data.contacts,
        subscription_type: data.subscription_type,
        subscription_start_date: data.subscriptionStartDate,
        pricing_config: data.pricePerUser,
        status: 'active'
    };
    
    const { error } = await supabase.from('communities').insert(payload);
    if (error) throw error;
};

export const updateCommunity = async (id: string, data: any) => {
    const payload: any = {};
    if (data.name) payload.name = data.name;
    if (data.address) payload.address = data.address;
    if (data.blocks) payload.blocks = data.blocks;
    if (data.maintenanceRate !== undefined) payload.maintenance_rate = data.maintenanceRate;
    if (data.fixedMaintenanceAmount !== undefined) payload.fixed_maintenance_amount = data.fixedMaintenanceAmount;
    if (data.contacts) payload.contact_info = data.contacts;
    if (data.subscriptionType) payload.subscription_type = data.subscriptionType;
    if (data.subscriptionStartDate) payload.subscription_start_date = data.subscriptionStartDate;
    if (data.pricePerUser) payload.pricing_config = data.pricePerUser;
    if (data.communityType) payload.community_type = data.communityType;

    const { error = null } = await supabase.from('communities').update(payload).eq('id', id);
    if (error) throw error;
};

export const deleteCommunity = async (id: string) => {
    return callEdgeFunction('delete-community', { community_id: id });
};

// --- Notices ---

export const getNotices = async (communityId: string): Promise<Notice[]> => {
    const response = await callEdgeFunction('get-notices', { community_id: communityId });
    const data = response.data || [];
    
    return data.map((n: any) => ({
        id: n.id,
        title: n.title,
        content: n.content,
        author: n.author,
        createdAt: n.created_at,
        type: n.type as NoticeType,
        communityId: n.community_id,
        validFrom: n.valid_from,
        validUntil: n.valid_until
    }));
};

export const createNotice = async (data: Partial<Notice>, user: User) => {
    await callEdgeFunction('create-notice', {
        title: data.title,
        content: data.content,
        type: data.type,
        author_name: user.name,
        community_id: user.communityId,
        valid_from: data.validFrom,
        valid_until: data.validUntil
    });
};

export const updateNotice = async (id: string, data: Partial<Notice>, user?: User) => {
    const { data: oldNotice } = await supabase.from('notices').select('*').eq('id', id).single();
    const payload: any = {};
    if (data.title) payload.title = data.title;
    if (data.content) payload.content = data.content;
    if (data.type) payload.type = data.type;
    if (data.validFrom !== undefined) payload.valid_from = data.validFrom;
    if (data.validUntil !== undefined) payload.valid_until = data.validUntil;

    const { error } = await supabase.from('notices').update(payload).eq('id', id);
    if (error) throw error;

    if (user) {
        await supabase.from('audit_logs').insert({
            community_id: user.communityId,
            actor_id: user.id,
            action: 'UPDATE',
            entity: 'Notice',
            entity_id: id,
            details: { description: `Notice updated: ${data.title || oldNotice?.title}`, old: oldNotice, new: payload }
        });
    }
};

export const deleteNotice = async (id: string, user?: User) => {
    const { data: oldNotice } = await supabase.from('notices').select('*').eq('id', id).single();
    const { error } = await supabase.from('notices').delete().eq('id', id);
    if (error) throw error;

    if (user) {
        await supabase.from('audit_logs').insert({
            community_id: user.communityId,
            actor_id: user.id,
            action: 'DELETE',
            entity: 'Notice',
            entity_id: id,
            details: { description: `Notice removed: ${oldNotice?.title}`, old: oldNotice }
        });
    }
};

// --- Complaints ---

export const getComplaints = async (communityId: string, userId?: string, role?: UserRole): Promise<Complaint[]> => {
    const response = await callEdgeFunction('get-complaints', { community_id: communityId });
    
    const raw = response.data || [];
    return raw.map((c: any) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        residentName: c.resident_name,
        flatNumber: c.flat_number,
        status: c.status as ComplaintStatus,
        createdAt: c.created_at,
        category: c.category as ComplaintCategory,
        userId: c.user_id,
        communityId: c.community_id,
        assignedTo: c.assigned_to,
        assignedToName: c.assigned_user?.name
    }));
};

export const getComplaintActivity = async (id: string): Promise<AuditLog[]> => {
    const { data: { session } } = await supabase.auth.getSession();
    const { data: profile } = await supabase.from('users').select('community_id').eq('id', session?.user.id).single();
    
    if (!profile?.community_id) throw new Error("Could not identify community context");

    return getAuditLogs(profile.community_id, session?.user.id || '', '', 'Complaint', id);
};

export const createComplaint = async (data: Partial<Complaint>, user: User, unitId?: string, flatNumber?: string) => {
    await callEdgeFunction('create-complaint', {
        title: data.title,
        description: data.description,
        category: data.category,
        community_id: user.communityId,
        user_id: user.id,
        resident_name: user.name,
        flat_number: flatNumber || user.flatNumber,
        unit_id: unitId
    });
};

export const updateComplaintStatus = async (id: string, status: ComplaintStatus) => {
    const response = await callEdgeFunction('update-complaint', { id, status });
    const c = response.data;
    return {
        id: c.id,
        title: c.title,
        description: c.description,
        residentName: c.resident_name,
        flatNumber: c.flat_number,
        status: c.status as ComplaintStatus,
        createdAt: c.created_at,
        category: c.category as ComplaintCategory,
        userId: c.user_id,
        communityId: c.community_id,
        assignedTo: c.assigned_to,
        assignedToName: c.assigned_user?.name
    } as Complaint;
};

export const assignComplaint = async (id: string, agentId: string) => {
    await callEdgeFunction('update-complaint', { id, assigned_to: agentId });
};

// --- Visitors ---

export const getVisitors = async (communityId: string, role?: UserRole): Promise<Visitor[]> => {
    const response = await callEdgeFunction('get-visitors', { community_id: communityId });
    const raw = response.data || [];
    return raw.map((v: any) => ({
        id: v.id,
        name: v.name,
        visitorType: v.visitor_type as VisitorType,
        vehicleNumber: v.vehicle_number,
        purpose: v.purpose,
        status: v.status as VisitorStatus,
        expectedAt: v.expected_at,
        validUntil: v.valid_until,
        entryToken: v.entry_token,
        residentName: v.resident_name,
        flatNumber: v.flat_number,
        communityId: v.community_id,
        userId: v.user_id
    }));
};

export const createVisitor = async (data: Partial<Visitor>, user: User) => {
    const entryToken = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const { data: newVisitor, error } = await supabase.from('visitors').insert({
        name: data.name,
        visitor_type: data.visitorType,
        vehicle_number: data.vehicleNumber,
        purpose: data.purpose,
        expected_at: data.expectedAt,
        flat_number: data.flatNumber || user.flatNumber,
        resident_name: user.name,
        community_id: user.communityId,
        user_id: user.id,
        status: 'Expected',
        entry_token: entryToken
    }).select().single();

    if (error) throw error;

    await supabase.from('audit_logs').insert({
        community_id: user.communityId,
        actor_id: user.id,
        action: 'CREATE',
        entity: 'Visitor',
        entity_id: newVisitor.id,
        details: { description: `Visitor pre-authorized: ${data.name}`, new: newVisitor }
    });
    
    return {
        ...newVisitor,
        visitorType: newVisitor.visitor_type,
        vehicleNumber: newVisitor.vehicle_number,
        expectedAt: newVisitor.expected_at,
        entryToken: newVisitor.entry_token,
        flatNumber: newVisitor.flat_number,
        residentName: newVisitor.resident_name,
        communityId: newVisitor.community_id,
        userId: newVisitor.user_id
    } as Visitor;
};

export const updateVisitor = async (id: string, data: Partial<Visitor>, user?: User) => {
    const { data: oldVisitor } = await supabase.from('visitors').select('*').eq('id', id).single();
    const payload: any = {
        name: data.name,
        visitor_type: data.visitorType,
        vehicle_number: data.vehicleNumber,
        purpose: data.purpose,
        expected_at: data.expectedAt,
    };

    const { error } = await supabase.from('visitors').update(payload).eq('id', id);
    if (error) throw error;

    if (user) {
        await supabase.from('audit_logs').insert({
            community_id: user.communityId,
            actor_id: user.id,
            action: 'UPDATE',
            entity: 'Visitor',
            entity_id: id,
            details: { description: `Visitor details modified: ${data.name || oldVisitor?.name}`, old: oldVisitor, new: payload }
        });
    }
};

export const deleteVisitor = async (id: string, user?: User) => {
    const { data: oldVisitor } = await supabase.from('visitors').select('*').eq('id', id).single();
    const { error } = await supabase.from('visitors').delete().eq('id', id);
    if (error) throw error;

    if (user) {
        await supabase.from('audit_logs').insert({
            community_id: user.communityId,
            actor_id: user.id,
            action: 'DELETE',
            entity: 'Visitor',
            entity_id: id,
            details: { description: `Visitor invitation cancelled: ${oldVisitor?.name}`, old: oldVisitor }
        });
    }
};

export const updateVisitorStatus = async (id: string, status: VisitorStatus) => {
    const { error } = await supabase.from('visitors').update({ status }).eq('id', id);
    if (error) throw error;
};

export const verifyVisitorEntry = async (visitorId: string, token: string, user: User) => {
    await callEdgeFunction('verify-visitor', { visitor_id: visitorId, entry_token: token });
};

export const checkOutVisitor = async (id: string, user: User) => {
    const { error } = await supabase.from('visitors').update({
        status: 'Checked Out'
    }).eq('id', id);
    if (error) throw error;

    await supabase.from('audit_logs').insert({
        community_id: user.communityId,
        actor_id: user.id,
        action: 'UPDATE',
        entity: 'Visitor',
        entity_id: id,
        details: { description: `Visitor checked out at gate.` }
    });
};

// --- Amenities & Bookings ---

export const getAmenities = async (communityId: string): Promise<Amenity[]> => {
    const response = await callEdgeFunction('get-amenities', { community_id: communityId });
    const data = response.data || [];
    
    return data.map((a: any) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        imageUrl: a.image_url,
        capacity: a.capacity,
        communityId: a.community_id,
        maxDuration: a.max_duration,
        status: a.status
    }));
};

export const createAmenity = async (data: Partial<Amenity>, user: User) => {
    await callManageAmenity({
        action: 'CREATE',
        data: {
            name: data.name,
            description: data.description,
            image_url: data.imageUrl,
            capacity: data.capacity,
            max_duration: data.maxDuration,
            community_id: user.communityId,
            status: 'Active'
        }
    });
};

export const updateAmenity = async (id: string, data: Partial<Amenity>) => {
    await callManageAmenity({
        action: 'UPDATE',
        id,
        data: {
            name: data.name,
            description: data.description,
            image_url: data.imageUrl,
            capacity: data.capacity,
            max_duration: data.maxDuration,
            status: data.status
        }
    });
};

export const deleteAmenity = async (id: string) => {
    await callManageAmenity({
        action: 'DELETE',
        id
    });
};

export const getBookings = async (communityId: string): Promise<Booking[]> => {
    const response = await callEdgeFunction('get-bookings', { community_id: communityId });
    const data = response.data || [];
    
    return data.map((b: any) => ({
        id: b.id,
        amenityId: b.amenity_id,
        residentName: b.resident_name,
        flatNumber: b.flat_number,
        startTime: b.start_time,
        endTime: b.end_time,
        communityId: b.community_id
    }));
};

export const createBooking = async (data: Partial<Booking>, user: User) => {
    const { data: newBooking, error = null } = await supabase.from('bookings').insert({
        amenity_id: data.amenityId,
        user_id: user.id,
        resident_name: user.name,
        flat_number: user.flatNumber,
        start_time: data.startTime,
        end_time: data.endTime,
        community_id: user.communityId
    }).select().single();

    if (error) throw error;

    await supabase.from('audit_logs').insert({
        community_id: user.communityId,
        actor_id: user.id,
        action: 'CREATE',
        entity: 'Booking',
        entity_id: newBooking.id,
        details: { description: `Facility reserved: ${newBooking.amenity_id}`, new: newBooking }
    });
    
    return {
        id: newBooking.id,
        amenityId: newBooking.amenity_id,
        residentName: newBooking.resident_name,
        flatNumber: newBooking.flat_number,
        startTime: newBooking.start_time,
        endTime: newBooking.end_time,
        communityId: newBooking.community_id
    } as Booking;
};

export const deleteBooking = async (id: string, user?: User) => {
    const { data: oldBooking } = await supabase.from('bookings').select('*').eq('id', id).single();
    const { error } = await supabase.from('bookings').delete().eq('id', id);
    if (error) throw error;

    if (user) {
        await supabase.from('audit_logs').insert({
            community_id: user.communityId,
            actor_id: user.id,
            action: 'DELETE',
            entity: 'Booking',
            entity_id: id,
            details: { description: `Facility reservation cancelled.`, old: oldBooking }
        });
    }
};

// --- Maintenance ---

export const getMaintenanceRecords = async (communityId: string, userId?: string): Promise<MaintenanceRecord[]> => {
    const response = await callEdgeFunction('get-maintenance-records', { community_id: communityId, user_id: userId });
    
    const data = response.data || [];
    return data.map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        unitId: r.unit_id,
        communityId: r.community_id,
        amount: r.amount,
        periodDate: r.period_date,
        status: r.status as MaintenanceStatus,
        paymentReceiptUrl: r.payment_receipt_url,
        upiTransactionId: r.upi_transaction_id,
        transactionDate: r.transaction_date,
        createdAt: r.created_at,
        userName: r.users?.name,
        flatNumber: r.units?.flat_number
    }));
};

export const submitMaintenancePayment = async (recordId: string, receiptUrl: string, upiId: string, date: string, user?: User) => {
    const { error } = await supabase.from('maintenance_records').update({
        status: 'Submitted',
        payment_receipt_url: receiptUrl,
        upi_transaction_id: upiId,
        transaction_date: date
    }).eq('id', recordId);
    if (error) throw error;

    if (user) {
        await supabase.from('audit_logs').insert({
            community_id: user.communityId,
            actor_id: user.id,
            action: 'UPDATE',
            entity: 'MaintenanceRecord',
            entity_id: recordId,
            details: { description: `Payment proof submitted for verification. UPI: ${upiId}` }
        });
    }
};

export const verifyMaintenancePayment = async (recordId: string, user?: User) => {
    const { error } = await supabase.from('maintenance_records').update({
        status: 'Paid'
    }).eq('id', recordId);
    if (error) throw error;

    if (user) {
        await supabase.from('audit_logs').insert({
            community_id: user.communityId,
            actor_id: user.id,
            action: 'UPDATE',
            entity: 'MaintenanceRecord',
            entity_id: recordId,
            details: { description: `Payment verified and reconciled in ledger.` }
        });
    }
};

export const getMaintenanceHistory = async (communityId: string): Promise<MaintenanceConfiguration[]> => {
    const { data, error } = await supabase
        .from('maintenance_configurations')
        .select('*')
        .eq('community_id', communityId)
        .order('effective_date', { ascending: false });
    
    if (error) throw error;
    return data.map((c: any) => ({
        id: c.id,
        communityId: c.community_id,
        maintenanceRate: c.maintenance_rate,
        fixedMaintenanceAmount: c.fixed_maintenance_amount,
        effectiveDate: c.effective_date,
        createdAt: c.created_at
    }));
};

export const addMaintenanceConfiguration = async (data: any) => {
    const { error } = await supabase.from('maintenance_configurations').insert({
        community_id: data.communityId,
        maintenance_rate: data.maintenance_rate,
        fixed_maintenance_amount: data.fixed_maintenance_amount,
        effective_date: data.effective_date
    });
    if (error) throw error;
};

// --- Expenses ---

export const getExpenses = async (communityId: string): Promise<Expense[]> => {
    const response = await callEdgeFunction('get-expenses', { community_id: communityId });
    
    const data = response.data || [];
    return data.map((e: any) => ({
        id: e.id,
        title: e.title,
        amount: e.amount,
        category: e.category as ExpenseCategory,
        description: e.description,
        date: e.date,
        submittedBy: e.submitted_by,
        submittedByName: e.submitted_user?.name,
        status: e.status as ExpenseStatus,
        approvedBy: e.approved_by,
        approvedByName: e.approved_user?.name,
        communityId: e.community_id,
        createdAt: e.created_at,
        receiptUrl: e.receipt_url
    }));
};

export const createExpense = async (data: Partial<Expense>, user: User) => {
    const { data: newExpense, error = null } = await supabase.from('expenses').insert({
        title: data.title,
        amount: data.amount,
        category: data.category,
        description: data.description,
        date: data.date,
        receipt_url: data.receiptUrl,
        submitted_by: user.id,
        community_id: user.communityId,
        status: 'Pending'
    }).select().single();

    if (error) throw error;

    await supabase.from('audit_logs').insert({
        community_id: user.communityId,
        actor_id: user.id,
        action: 'CREATE',
        entity: 'Expense',
        entity_id: newExpense.id,
        details: { description: `Expense logged: ${data.title}`, new: newExpense }
    });
};

export const approveExpense = async (id: string, userId: string) => {
    const { data: oldExpense } = await supabase.from('expenses').select('*').eq('id', id).single();

    const { data: updated, error } = await supabase.from('expenses').update({
        status: 'Approved',
        approved_by: userId
    }).eq('id', id).select().single();

    if (error) throw error;

    await supabase.from('audit_logs').insert({
        community_id: updated.community_id,
        actor_id: userId,
        action: 'UPDATE',
        entity: 'Expense',
        entity_id: id,
        details: { 
            description: `Expense authorized: ${updated.title}`, 
            old: { status: oldExpense?.status }, 
            new: { status: updated.status } 
        }
    });
};

export const rejectExpense = async (id: string, userId: string, reason: string) => {
    const { data: oldExpense } = await supabase.from('expenses').select('*').eq('id', id).single();
    const newDescription = `${oldExpense?.description || ''} \n[REJECTION REASON]: ${reason}`;

    const { data: updated, error = null } = await supabase.from('expenses').update({
        status: 'Rejected',
        approved_by: userId,
        description: newDescription
    }).eq('id', id).select().single();

    if (error) throw error;

    await supabase.from('audit_logs').insert({
        community_id: updated.community_id,
        actor_id: userId,
        action: 'UPDATE',
        entity: 'Expense',
        entity_id: id,
        details: { 
            description: `Expense declined: ${updated.title}. Reason: ${reason}`, 
            old: { status: oldExpense?.status, description: oldExpense?.description }, 
            new: { status: updated.status, description: updated.description } 
        }
    });
};

export const getMonthlyLedger = async (communityId: string, month: number, year: number): Promise<MonthlyLedger> => {
    const result = await callEdgeFunction('get-monthly-ledger', { community_id: communityId, month, year });
    return result;
};

// --- Billing (SuperAdmin) ---

export const recordCommunityPayment = async (data: any) => {
    await callEdgeFunction('record-payment', data);
};

export const getFinancialHistory = async (year: number): Promise<FinancialHistory> => {
    const result = await callEdgeFunction('get-financial-history', { year });
    return result;
};

export const getFinancialYears = async (): Promise<number[]> => {
    const result = await callEdgeFunction('get-financial-years', {});
    return result.years;
};

// --- Audit ---

export const getAuditLogs = async (communityId: string, userId: string, role: string, entity?: string, entityId?: string): Promise<AuditLog[]> => {
    const response = await callEdgeFunction('get-audit-logs', { 
        community_id: communityId,
        entity: entity,
        entity_id: entityId
    });
    const data = response.data || [];
    
    return data.map((l: any) => ({
        id: l.id,
        createdAt: l.created_at,
        actorId: l.actor_id,
        communityId: l.community_id,
        actorName: l.users?.name || 'System',
        actorRole: l.users?.role,
        entity: l.entity,
        entityId: l.entity_id,
        action: l.action as any,
        details: l.details
    }));
};
