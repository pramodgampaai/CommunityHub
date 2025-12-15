
import { supabase } from './supabase';
import { Notice, Complaint, Visitor, Amenity, Booking, User, ComplaintCategory, ComplaintStatus, CommunityStat, Community, UserRole, CommunityType, Block, MaintenanceRecord, MaintenanceStatus, Unit, Expense, ExpenseCategory, ExpenseStatus, VisitorStatus, VisitorType, MaintenanceConfiguration, AuditLog, AuditAction, FinancialHistory } from '../types';

export const getCommunity = async (id: string): Promise<Community> => {
    const { data, error } = await supabase.from('communities').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
};

export const updateTheme = async (userId: string, theme: 'light' | 'dark'): Promise<void> => {
    const { error } = await supabase.from('users').update({ theme }).eq('id', userId);
    if (error) throw error;
};

export const requestPasswordReset = async (email: string): Promise<void> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password',
    });
    if (error) throw error;
};

export const getNotices = async (communityId: string): Promise<Notice[]> => {
    const { data, error } = await supabase.from('notices').select('*').eq('community_id', communityId).order('created_at', { ascending: false });
    if (error) throw error;
    return data.map((n: any) => ({
        ...n,
        communityId: n.community_id,
        validFrom: n.valid_from,
        validUntil: n.valid_until,
        createdAt: n.created_at
    }));
};

export const createNotice = async (notice: Partial<Notice>, user: User): Promise<void> => {
    const { error } = await supabase.from('notices').insert({
        title: notice.title,
        content: notice.content,
        type: notice.type,
        community_id: user.communityId,
        author: notice.author,
        valid_from: notice.validFrom,
        valid_until: notice.validUntil
    });
    if (error) throw error;
};

export const updateNotice = async (id: string, updates: Partial<Notice>): Promise<void> => {
    const payload: any = { ...updates };
    if (updates.validFrom) payload.valid_from = updates.validFrom;
    if (updates.validUntil) payload.valid_until = updates.validUntil;
    delete payload.validFrom;
    delete payload.validUntil;
    
    const { error } = await supabase.from('notices').update(payload).eq('id', id);
    if (error) throw error;
};

export const deleteNotice = async (id: string): Promise<void> => {
    const { error } = await supabase.from('notices').delete().eq('id', id);
    if (error) throw error;
};

export const getComplaints = async (communityId: string, userId?: string, role?: string): Promise<Complaint[]> => {
    const { data, error } = await supabase.functions.invoke('get-complaints', {
        body: { community_id: communityId }
    });
    
    if (error) throw error;
    if (data.error) throw new Error(data.error);

    return data.data.map((c: any) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        category: c.category,
        status: c.status,
        createdAt: c.created_at,
        residentName: c.resident_name,
        flatNumber: c.flat_number,
        userId: c.user_id,
        communityId: c.community_id,
        assignedTo: c.assigned_to,
        assignedToName: c.assigned_user?.name
    }));
};

export const createComplaint = async (complaint: Partial<Complaint>, user: User, unitId?: string, flatNumber?: string): Promise<void> => {
    const { error } = await supabase.functions.invoke('create-complaint', {
        body: {
            title: complaint.title,
            description: complaint.description,
            category: complaint.category,
            community_id: user.communityId,
            user_id: user.id,
            resident_name: user.name,
            flat_number: flatNumber || user.flatNumber,
            unit_id: unitId
        }
    });
    if (error) throw error;
};

export const updateComplaintStatus = async (id: string, status: ComplaintStatus): Promise<Complaint> => {
    const { data, error } = await supabase.functions.invoke('update-complaint', {
        body: { id, status }
    });
    if (error) throw error;
    if (data.error) throw new Error(data.error);
    
    const c = data.data;
    return {
        id: c.id,
        title: c.title,
        description: c.description,
        category: c.category,
        status: c.status,
        createdAt: c.created_at,
        residentName: c.resident_name,
        flatNumber: c.flat_number,
        userId: c.user_id,
        communityId: c.community_id,
        assignedTo: c.assigned_to,
        assignedToName: c.assigned_user?.name
    };
};

export const assignComplaint = async (complaintId: string, agentId: string): Promise<void> => {
    const { error } = await supabase.functions.invoke('update-complaint', {
        body: { id: complaintId, assigned_to: agentId }
    });
    if (error) throw error;
};

export const getResidents = async (communityId: string): Promise<User[]> => {
    const { data, error } = await supabase
        .from('users')
        .select(`
            *,
            units (*)
        `)
        .eq('community_id', communityId);
        
    if (error) throw error;
    return data.map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        communityId: u.community_id,
        flatNumber: u.flat_number,
        avatarUrl: u.avatar_url,
        units: u.units ? u.units.map((unit: any) => ({
            id: unit.id,
            userId: unit.user_id,
            communityId: unit.community_id,
            flatNumber: unit.flat_number,
            block: unit.block,
            floor: unit.floor,
            flatSize: unit.flat_size,
            maintenanceStartDate: unit.maintenance_start_date
        })) : []
    }));
};

export const getVisitors = async (communityId: string, role?: string): Promise<Visitor[]> => {
    const { data, error } = await supabase.functions.invoke('get-visitors', {
        body: { community_id: communityId }
    });
    if (error) throw error;
    if (data.error) throw new Error(data.error);
    
    return data.data.map((v: any) => ({
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
        userId: v.user_id
    }));
};

export const createVisitor = async (visitor: Partial<Visitor>, user: User): Promise<Visitor> => {
    const token = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { data, error } = await supabase.from('visitors').insert({
        name: visitor.name,
        visitor_type: visitor.visitorType,
        vehicle_number: visitor.vehicleNumber,
        purpose: visitor.purpose,
        expected_at: visitor.expectedAt,
        status: 'Expected',
        resident_name: user.name,
        flat_number: visitor.flatNumber || user.flatNumber,
        community_id: user.communityId,
        user_id: user.id,
        entry_token: token
    }).select().single();

    if (error) throw error;
    
    return {
        id: data.id,
        name: data.name,
        visitorType: data.visitor_type,
        vehicleNumber: data.vehicle_number,
        purpose: data.purpose,
        status: data.status,
        expectedAt: data.expected_at,
        entryToken: data.entry_token,
        residentName: data.resident_name,
        flatNumber: data.flat_number,
        communityId: data.community_id,
        userId: data.user_id
    };
};

export const updateVisitorStatus = async (id: string, status: VisitorStatus): Promise<void> => {
    const update: any = { status };
    if (status === VisitorStatus.CheckedIn) update.entry_time = new Date().toISOString();
    if (status === VisitorStatus.CheckedOut) update.exit_time = new Date().toISOString();
    
    const { error } = await supabase.from('visitors').update(update).eq('id', id);
    if (error) throw error;
};

export const verifyVisitorEntry = async (visitorId: string, token: string, user: User): Promise<void> => {
    const { data, error } = await supabase.functions.invoke('verify-visitor', {
        body: { visitor_id: visitorId, entry_token: token }
    });
    if (error) throw error;
    if (data.error) throw new Error(data.error);
};

export const checkOutVisitor = async (visitorId: string, user: User): Promise<void> => {
    await updateVisitorStatus(visitorId, VisitorStatus.CheckedOut);
};

export const getAmenities = async (communityId: string): Promise<Amenity[]> => {
    const { data, error } = await supabase.from('amenities').select('*').eq('community_id', communityId);
    if (error) throw error;
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

export const createAmenity = async (amenity: Partial<Amenity>, user: User): Promise<void> => {
    const { error } = await supabase.from('amenities').insert({
        name: amenity.name,
        description: amenity.description,
        image_url: amenity.imageUrl,
        capacity: amenity.capacity,
        max_duration: amenity.maxDuration,
        community_id: user.communityId,
        status: 'Active'
    });
    if (error) throw error;
};

export const updateAmenity = async (amenityId: string, updates: Partial<Amenity>): Promise<void> => {
    const { error } = await supabase.from('amenities').update(updates).eq('id', amenityId);
    if (error) throw error;
};

export const deleteAmenity = async (amenityId: string): Promise<void> => {
    const { error } = await supabase.from('amenities').delete().eq('id', amenityId);
    if (error) throw error;
};

export const getBookings = async (communityId: string): Promise<Booking[]> => {
    const { data, error } = await supabase.from('bookings').select('*').eq('community_id', communityId);
    if (error) throw error;
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

export const createBooking = async (booking: {amenityId: string, startTime: string, endTime: string}, user: User): Promise<void> => {
    const { error } = await supabase.from('bookings').insert({
        amenity_id: booking.amenityId,
        start_time: booking.startTime,
        end_time: booking.endTime,
        user_id: user.id,
        resident_name: user.name,
        flat_number: user.flatNumber,
        community_id: user.communityId
    });
    if (error) throw error;
};

export const deleteBooking = async (bookingId: string): Promise<void> => {
    const { error } = await supabase.from('bookings').delete().eq('id', bookingId);
    if (error) throw error;
};

export const getMaintenanceRecords = async (communityId: string, userId?: string): Promise<MaintenanceRecord[]> => {
    let query = supabase
        .from('maintenance_records')
        .select(`
            *,
            users (name),
            units (flat_number, block)
        `)
        .eq('community_id', communityId)
        .order('period_date', { ascending: false });

    if (userId) {
        query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data.map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        unitId: r.unit_id,
        communityId: r.community_id,
        amount: r.amount,
        periodDate: r.period_date,
        status: r.status,
        paymentReceiptUrl: r.payment_receipt_url,
        upiTransactionId: r.upi_transaction_id,
        transactionDate: r.transaction_date,
        createdAt: r.created_at,
        userName: r.users?.name || 'Unknown',
        flatNumber: r.units ? (r.units.block ? `${r.units.block}-${r.units.flat_number}` : r.units.flat_number) : 'Unknown'
    }));
};

export const submitMaintenancePayment = async (recordId: string, receiptUrl: string, upiId: string, transactionDate: string): Promise<void> => {
    const { error } = await supabase.from('maintenance_records').update({
        status: 'Submitted',
        payment_receipt_url: receiptUrl,
        upi_transaction_id: upiId,
        transaction_date: transactionDate
    }).eq('id', recordId);
    if (error) throw error;
};

export const verifyMaintenancePayment = async (recordId: string): Promise<void> => {
    const { error } = await supabase.from('maintenance_records').update({
        status: 'Paid'
    }).eq('id', recordId);
    if (error) throw error;
};

export const getExpenses = async (communityId: string): Promise<Expense[]> => {
    const { data, error } = await supabase
        .from('expenses')
        .select(`
            *,
            submitted_user:users!submitted_by(name),
            approved_user:users!approved_by(name)
        `)
        .eq('community_id', communityId)
        .order('date', { ascending: false });
        
    if (error) throw error;
    
    return data.map((e: any) => ({
        id: e.id,
        title: e.title,
        amount: e.amount,
        category: e.category,
        description: e.description,
        date: e.date,
        submittedBy: e.submitted_by,
        submittedByName: e.submitted_user?.name,
        status: e.status,
        approvedBy: e.approved_by,
        approvedByName: e.approved_user?.name,
        communityId: e.community_id,
        createdAt: e.created_at,
        receiptUrl: e.receipt_url
    }));
};

export const createExpense = async (expense: Partial<Expense>, user: User): Promise<void> => {
    const { error } = await supabase.from('expenses').insert({
        title: expense.title,
        amount: expense.amount,
        category: expense.category,
        description: expense.description,
        date: expense.date,
        receipt_url: expense.receiptUrl,
        submitted_by: user.id,
        community_id: user.communityId,
        status: 'Pending'
    });
    if (error) throw error;
};

export const approveExpense = async (id: string, userId: string): Promise<void> => {
    const { error } = await supabase.from('expenses').update({
        status: 'Approved',
        approved_by: userId
    }).eq('id', id);
    if (error) throw error;
};

export const rejectExpense = async (id: string, userId: string, reason: string): Promise<void> => {
    const { data: current } = await supabase.from('expenses').select('description').eq('id', id).single();
    const newDesc = `${current?.description || ''}\n[REJECTION REASON]: ${reason}`;
    
    const { error } = await supabase.from('expenses').update({
        status: 'Rejected',
        approved_by: userId,
        description: newDesc
    }).eq('id', id);
    if (error) throw error;
};

export const getAuditLogs = async (communityId: string, userId: string, role: string): Promise<AuditLog[]> => {
    const { data, error } = await supabase
        .from('audit_logs')
        .select(`
            *,
            users (name, role)
        `)
        .eq('community_id', communityId)
        .order('created_at', { ascending: false });
        
    if (error) throw error;
    
    return data.map((log: any) => ({
        id: log.id,
        createdAt: log.created_at,
        actorId: log.actor_id,
        communityId: log.community_id,
        actorName: log.users?.name || 'System',
        actorRole: log.users?.role || 'System',
        entity: log.entity,
        entityId: log.entity_id,
        action: log.action,
        details: log.details
    }));
};

export const getCommunityStats = async (): Promise<CommunityStat[]> => {
    const { data, error } = await supabase.functions.invoke('get-community-stats');
    if (error) throw error;
    if (data.error) throw new Error(data.error);
    
    return data.data.map((c: any) => ({ 
        id: c.id, 
        name: c.name, 
        address: c.address, 
        status: c.status, 
        communityType: c.community_type, 
        blocks: c.blocks, 
        maintenanceRate: c.maintenance_rate, 
        fixedMaintenanceAmount: c.fixed_maintenance_amount, 
        contacts: c.contact_info, 
        subscriptionType: c.subscription_type, 
        subscriptionStartDate: c.subscription_start_date, 
        pricePerUser: c.pricing_config, 
        resident_count: c.resident_count || 0, 
        admin_count: c.admin_count || 0, 
        helpdesk_count: c.helpdesk_count || 0, 
        security_count: c.security_count || 0,
        staff_count: c.staff_count || 0,
        income_generated: c.income_generated || 0,
        current_month_paid: c.current_month_paid || 0
    }));
};

export const createCommunity = async (data: any): Promise<void> => {
    const { error } = await supabase.from('communities').insert({
        name: data.name,
        address: data.address,
        community_type: data.communityType,
        blocks: data.blocks,
        contact_info: data.contacts,
        subscription_type: data.subscriptionType,
        subscription_start_date: data.subscriptionStartDate,
        pricing_config: data.pricePerUser,
        status: 'active'
    });
    if (error) throw error;
};

export const updateCommunity = async (id: string, data: any): Promise<void> => {
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

    const { error } = await supabase.from('communities').update(payload).eq('id', id);
    if (error) throw error;
};

export const deleteCommunity = async (id: string): Promise<void> => {
    const { error } = await supabase.from('communities').update({ status: 'disabled' }).eq('id', id);
    if (error) throw error;
};

export const createAdminUser = async (data: any): Promise<void> => {
    const { error } = await supabase.functions.invoke('create-admin-user', {
        body: data
    });
    if (error) throw error;
};

export const createCommunityUser = async (data: any): Promise<void> => {
    const { error } = await supabase.functions.invoke('create-community-user', {
        body: data
    });
    if (error) throw error;
};

export const assignAdminUnit = async (unitData: any, user: User, community: Community): Promise<void> => {
    const { error } = await supabase.functions.invoke('assign-unit', {
        body: {
            unitData,
            communityId: community.id,
            userId: user.id
        }
    });
    if (error) throw error;
};

export const updateUserPassword = async (password: string): Promise<void> => {
    const { error } = await supabase.functions.invoke('update-user-password', {
        body: { password }
    });
    if (error) throw error;
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

export const addMaintenanceConfiguration = async (config: {communityId: string, maintenanceRate: number, fixedMaintenanceAmount: number, effectiveDate: string}): Promise<void> => {
    const { error } = await supabase.from('maintenance_configurations').insert({
        community_id: config.communityId,
        maintenance_rate: config.maintenanceRate,
        fixed_maintenance_amount: config.fixedMaintenanceAmount,
        effective_date: config.effectiveDate
    });
    if (error) throw error;
};

export const recordCommunityPayment = async (data: any): Promise<void> => {
    const { error } = await supabase.functions.invoke('record-payment', {
        body: data
    });
    if (error) throw error;
};

export const getFinancialHistory = async (year: number): Promise<FinancialHistory> => {
    // This SDK method calls: [PROJECT_URL]/functions/v1/get-financial-history
    const { data, error } = await supabase.functions.invoke('get-financial-history', {
        body: { year }
    });
    if (error) throw error;
    if (data.error) throw new Error(data.error);
    return data;
};

export const getFinancialYears = async (): Promise<number[]> => {
    // This calls https://vnfmtbkhptkntaqzfdcx.supabase.co/functions/v1/get-financial-years
    const { data, error } = await supabase.functions.invoke('get-financial-years');
    if (error) throw error;
    if (data.error) throw new Error(data.error);
    return data.years;
};
