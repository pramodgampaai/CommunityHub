
import { supabase, supabaseKey } from './supabase';
import { Notice, Complaint, Visitor, Amenity, Booking, User, ComplaintCategory, ComplaintStatus, CommunityStat, Community, UserRole, CommunityType, Block, MaintenanceRecord, MaintenanceStatus, Unit, Expense, ExpenseCategory, ExpenseStatus, VisitorStatus, MaintenanceConfiguration, AuditLog, AuditAction } from '../types';

// =================================================================
// INTERNAL: AUDIT LOGGING HELPER
// =================================================================

const logAudit = async (
    user: User, 
    action: AuditAction, 
    entity: string, 
    entityId: string, 
    oldData?: any, 
    newData?: any,
    description?: string
) => {
    try {
        if (!user.communityId) return;

        const payload = {
            community_id: user.communityId,
            actor_id: user.id,
            action,
            entity,
            entity_id: entityId,
            details: {
                old: oldData,
                new: newData,
                description
            }
        };

        // Fire and forget - don't block the UI for logging
        supabase.from('audit_logs').insert(payload).then(({ error }) => {
            if (error) console.error("Audit Log Error:", error);
        });
    } catch (e) {
        console.error("Failed to log audit", e);
    }
};

// =================================================================
// USER / ADMIN / RESIDENT-FACING API
// =================================================================

export const getAuditLogs = async (communityId: string, userId?: string, role?: UserRole): Promise<AuditLog[]> => {
    let query = supabase
        .from('audit_logs')
        .select('*, actor:users(name, role)')
        .eq('community_id', communityId)
        .order('created_at', { ascending: false });

    // Residents only see their own actions
    if (role === UserRole.Resident && userId) {
        query = query.eq('actor_id', userId);
    }

    const { data, error } = await query;
    if (error) {
        if (error.code === '42P01') return []; // Table doesn't exist yet
        throw error;
    }

    return data.map((log: any) => ({
        id: log.id,
        createdAt: log.created_at,
        communityId: log.community_id,
        actorId: log.actor_id,
        actorName: log.actor?.name || 'Unknown',
        actorRole: log.actor?.role || '',
        entity: log.entity,
        entityId: log.entity_id,
        action: log.action as AuditAction,
        details: log.details
    })) as AuditLog[];
};

// ... (Existing Read Operations - Truncated for brevity, assuming no changes to generic Gets) ...
export const getNotices = async (communityId: string): Promise<Notice[]> => {
    const { data, error } = await supabase.from('notices').select('*').eq('community_id', communityId).order('created_at', { ascending: false });
    if (error) throw error;
    
    return data.map((n: any) => ({
        id: n.id,
        title: n.title,
        content: n.content,
        author: n.author,
        createdAt: n.created_at,
        type: n.type,
        communityId: n.community_id,
        validFrom: n.valid_from,
        validUntil: n.valid_until
    })) as Notice[];
};

export const getComplaints = async (communityId: string, userId?: string, role?: UserRole): Promise<Complaint[]> => {
    let query = supabase
        .from('complaints')
        .select('*, assigned_user:users!assigned_to(name)')
        .eq('community_id', communityId)
        .order('created_at', { ascending: false });

    // 1. Helpdesk Agents only see tickets assigned to them
    if (role === UserRole.HelpdeskAgent && userId) {
        query = query.eq('assigned_to', userId);
    }
    // 2. Residents only see tickets they created
    else if (role === UserRole.Resident && userId) {
        query = query.eq('user_id', userId);
    }
    // 3. Admins, HelpdeskAdmins, SecurityAdmins see ALL tickets for the community (No filter applied)
        
    const { data, error } = await query;
        
    if (error) throw error;
    
    return data.map((c: any) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        residentName: c.resident_name,
        flatNumber: c.flat_number,
        status: c.status,
        createdAt: c.created_at,
        category: c.category,
        userId: c.user_id,
        communityId: c.community_id,
        assignedTo: c.assigned_to,
        assignedToName: c.assigned_user?.name
    })) as Complaint[];
};

export const getVisitors = async (communityId: string): Promise<Visitor[]> => {
    const { data, error } = await supabase.from('visitors').select('*').eq('community_id', communityId).order('expected_at', { ascending: false });
    if (error) throw error;
    
    return data.map((v: any) => ({
        id: v.id,
        name: v.name,
        purpose: v.purpose,
        expectedAt: v.expected_at,
        status: v.status,
        residentName: v.resident_name,
        flatNumber: v.flat_number,
        communityId: v.community_id,
        userId: v.user_id
    })) as Visitor[];
};

export const getAmenities = async (communityId: string): Promise<Amenity[]> => {
    const { data, error } = await supabase.from('amenities').select('*').eq('community_id', communityId).order('name');
    if (error) throw error;
    
    return data.map((a: any) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        imageUrl: a.image_url,
        capacity: a.capacity,
        communityId: a.community_id,
        maxDuration: a.max_duration,
        status: a.status || 'Active'
    })) as Amenity[];
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
    })) as Booking[];
};

// ... (Role Helper and MapUserFromDB - No Changes) ...
const normalizeRole = (r: string): UserRole => {
    if (!r) return UserRole.Resident;
    const lower = r.toLowerCase();
    if (lower === 'admin') return UserRole.Admin;
    if (lower === 'resident') return UserRole.Resident;
    if (lower === 'security') return UserRole.Security;
    if (lower === 'helpdesk') return UserRole.HelpdeskAdmin;
    if (lower === 'helpdeskadmin') return UserRole.HelpdeskAdmin;
    if (lower === 'helpdeskagent') return UserRole.HelpdeskAgent;
    if (lower === 'securityadmin') return UserRole.SecurityAdmin;
    if (lower === 'superadmin') return UserRole.SuperAdmin;
    return (r.charAt(0).toUpperCase() + r.slice(1)) as UserRole;
};

const mapUserFromDB = (u: any, units: any[] = []): User => {
    const userUnitsRaw = units.filter((unit: any) => unit.user_id === u.id);
    const mappedUnits: Unit[] = userUnitsRaw.map((unit: any) => ({
        id: unit.id,
        userId: unit.user_id,
        communityId: unit.community_id,
        flatNumber: unit.flat_number,
        block: unit.block,
        floor: unit.floor,
        flatSize: unit.flat_size,
        maintenanceStartDate: unit.maintenance_start_date
    }));
    const primaryUnit = mappedUnits.length > 0 ? mappedUnits[0] : null;
    return {
        id: u.id,
        name: u.name,
        email: u.email,
        avatarUrl: u.avatar_url,
        flatNumber: primaryUnit ? primaryUnit.flatNumber : u.flat_number,
        role: normalizeRole(u.role),
        communityId: u.community_id,
        status: u.status,
        units: mappedUnits,
        maintenanceStartDate: u.maintenance_start_date,
        theme: u.theme
    } as User;
};

export const getResidents = async (communityId: string): Promise<User[]> => {
    const { data: users, error: userError } = await supabase.from('users').select('*').eq('community_id', communityId);
    if (userError) throw userError;
    if (!users) return [];

    let allUnits: any[] = [];
    try {
        const { data: units, error: unitsError } = await supabase.from('units').select('*').eq('community_id', communityId);
        if (!unitsError && units) {
            allUnits = units;
        }
    } catch (err) {
        console.warn("Failed to fetch units", err);
    }
    const mappedUsers = users.map(user => mapUserFromDB(user, allUnits));
    return mappedUsers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
};

export const updateTheme = async (userId: string, theme: 'light' | 'dark'): Promise<void> => {
    const { error } = await supabase.from('users').update({ theme }).eq('id', userId);
    if (error) throw error;
};

export const getCommunity = async (communityId: string): Promise<Community> => {
    const { data, error } = await supabase.from('communities').select('*').eq('id', communityId).single();
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
    } as Community;
};

// --- NEW: Maintenance Configuration APIs ---

export const getMaintenanceHistory = async (communityId: string): Promise<MaintenanceConfiguration[]> => {
    const { data, error } = await supabase
        .from('maintenance_configurations')
        .select('*')
        .eq('community_id', communityId)
        .order('effective_date', { ascending: false });

    if (error) {
        // Fallback for dev if table doesn't exist yet
        if (error.code === '42P01') return []; 
        throw error;
    }

    return data.map((c: any) => ({
        id: c.id,
        communityId: c.community_id,
        maintenanceRate: c.maintenance_rate,
        fixedMaintenanceAmount: c.fixed_maintenance_amount,
        effectiveDate: c.effective_date,
        createdAt: c.created_at
    })) as MaintenanceConfiguration[];
};

export const addMaintenanceConfiguration = async (config: {
    communityId: string;
    maintenanceRate: number;
    fixedMaintenanceAmount: number;
    effectiveDate: string;
}): Promise<void> => {
    // 1. Insert into history
    const { error } = await supabase.from('maintenance_configurations').insert({
        community_id: config.communityId,
        maintenance_rate: config.maintenanceRate,
        fixed_maintenance_amount: config.fixedMaintenanceAmount,
        effective_date: config.effectiveDate
    });
    if (error) throw error;

    // 2. Update parent community table to reflect "current" values for display purposes (snapshot)
    await supabase.from('communities').update({
        maintenance_rate: config.maintenanceRate,
        fixed_maintenance_amount: config.fixedMaintenanceAmount
    }).eq('id', config.communityId);
};

// ... (Existing Maintenance Record & Expense Getters - No Changes) ...
export const getMaintenanceRecords = async (communityId: string, userId?: string): Promise<MaintenanceRecord[]> => {
    let query = supabase.from('maintenance_records').select('*, user:users(name)').eq('community_id', communityId).order('period_date', { ascending: false });
    if (userId) query = query.eq('user_id', userId);
    const { data: records, error } = await query;
    if (error) throw error;

    let unitsMap: Record<string, any> = {};
    try {
        const { data: units } = await supabase.from('units').select('*').eq('community_id', communityId);
        if (units) units.forEach((u: any) => unitsMap[u.id] = u);
    } catch (e) { /* ignore */ }

    return records.map((r: any) => {
        let displayFlat = 'Unknown';
        const linkedUnit = r.unit_id ? unitsMap[r.unit_id] : null;
        if (linkedUnit) {
            displayFlat = linkedUnit.block ? `${linkedUnit.block}-${linkedUnit.flat_number}` : linkedUnit.flat_number;
        } else {
             displayFlat = r.user?.flat_number || 'N/A';
        }
        return {
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
            userName: r.user?.name,
            flatNumber: displayFlat
        };
    }) as MaintenanceRecord[];
}

export const getExpenses = async (communityId: string): Promise<Expense[]> => {
    const { data, error } = await supabase.from('expenses').select('*, submitted_user:users!submitted_by(name), approved_user:users!approved_by(name)').eq('community_id', communityId).order('date', { ascending: false });
    if (error) { if (error.code === '42P01') { return []; } throw error; }
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
    })) as Expense[];
}

// ... (Create Operations - Updated with Audit Logs) ...

export const createNotice = async (noticeData: any, user: User): Promise<Notice> => {
    const newNotice = { title: noticeData.title, content: noticeData.content, type: noticeData.type, author: noticeData.author, community_id: user.communityId, valid_from: noticeData.validFrom, valid_until: noticeData.validUntil };
    const { data, error } = await supabase.from('notices').insert(newNotice).select().single();
    if (error) throw error;
    
    // Log Audit
    await logAudit(user, 'CREATE', 'Notice', data.id, null, data, `Posted notice: ${data.title}`);
    
    return { id: data.id, title: data.title, content: data.content, author: data.author, createdAt: data.created_at, type: data.type, communityId: data.community_id, validFrom: data.valid_from, validUntil: data.valid_until } as Notice;
};

export const createComplaint = async (complaintData: any, user: User, specificUnitId?: string, specificFlatNumber?: string): Promise<Complaint> => {
    let displayFlat = specificFlatNumber;
    if (!displayFlat) {
        if (user.units && user.units.length > 0) {
            const u = user.units[0];
            displayFlat = u.block ? `${u.block}-${u.flatNumber}` : u.flatNumber;
        } else {
            displayFlat = user.flatNumber || 'N/A';
        }
    }
    const newComplaint = { title: complaintData.title, description: complaintData.description, category: complaintData.category, status: ComplaintStatus.Pending, resident_name: user.name, flat_number: displayFlat, user_id: user.id, community_id: user.communityId, unit_id: specificUnitId };
    const { data, error } = await supabase.from('complaints').insert(newComplaint).select().single();
    if (error) throw error;

    // Log Audit
    await logAudit(user, 'CREATE', 'Complaint', data.id, null, data, `Raised complaint: ${data.title}`);

    return { id: data.id, title: data.title, description: data.description, residentName: data.resident_name, flatNumber: data.flat_number, status: data.status, createdAt: data.created_at, category: data.category, userId: data.user_id, communityId: data.community_id } as Complaint;
};

export const createVisitor = async (visitorData: any, user: User): Promise<Visitor> => {
    let targetUserId = user.id; let residentName = user.name; let displayFlat = 'N/A'; let status: VisitorStatus = VisitorStatus.Expected;
    if (user.role === UserRole.Resident) {
        displayFlat = user.units && user.units.length > 0 ? user.units[0].flatNumber : (user.flatNumber || 'N/A');
    } else if (user.role === UserRole.Security || user.role === UserRole.SecurityAdmin || user.role === UserRole.Admin) {
        if (!visitorData.targetFlat) throw new Error("Flat number is required.");
        const flatInput = visitorData.targetFlat.trim();
        let blockSearch = ''; let flatSearch = flatInput;
        if (flatInput.includes('-')) { const parts = flatInput.split('-'); if (parts.length >= 2) { blockSearch = parts[0].trim(); flatSearch = parts.slice(1).join('-').trim(); } }
        let unitData = null;
        if (blockSearch) { const { data } = await supabase.from('units').select('user_id, users(name), flat_number, block').eq('community_id', user.communityId).ilike('block', blockSearch).eq('flat_number', flatSearch).limit(1).maybeSingle(); unitData = data; }
        if (!unitData) { const { data } = await supabase.from('units').select('user_id, users(name), flat_number, block').eq('community_id', user.communityId).eq('flat_number', flatInput).limit(1).maybeSingle(); unitData = data; }
        if (unitData) { targetUserId = unitData.user_id; const userData = unitData.users as any; residentName = userData?.name || 'Resident'; displayFlat = unitData.block ? `${unitData.block}-${unitData.flat_number}` : unitData.flat_number; status = VisitorStatus.PendingApproval; } 
        else { const { data: legacyUser } = await supabase.from('users').select('id, name, flat_number').eq('community_id', user.communityId).eq('flat_number', flatInput).limit(1).maybeSingle(); if (!legacyUser) throw new Error(`No resident found.`); targetUserId = legacyUser.id; residentName = legacyUser.name; displayFlat = legacyUser.flat_number; status = VisitorStatus.PendingApproval; }
    }
    const newVisitor = { name: visitorData.name, purpose: visitorData.purpose, expected_at: visitorData.expectedAt, status: status, resident_name: residentName, flat_number: displayFlat, user_id: targetUserId, community_id: user.communityId };
    const { data, error } = await supabase.from('visitors').insert(newVisitor).select().single();
    if (error) throw error;

    await logAudit(user, 'CREATE', 'Visitor', data.id, null, data, `Registered visitor: ${data.name}`);

    return { id: data.id, name: data.name, purpose: data.purpose, expectedAt: data.expected_at, status: data.status, residentName: data.resident_name, flatNumber: data.flat_number, communityId: data.community_id, userId: data.user_id } as Visitor;
};

export const updateVisitorStatus = async (visitorId: string, status: VisitorStatus): Promise<void> => {
    // Audit: Get Old
    const { data: oldData } = await supabase.from('visitors').select('*').eq('id', visitorId).single();
    
    const { data: newData, error } = await supabase.from('visitors').update({ status }).eq('id', visitorId).select().single();
    if (error) throw error;

    if (oldData) {
        // We need user context. Since this is a void function, we assume the caller has auth context.
        // To properly log 'actor_id', we fetch current session user.
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            const user = { id: session.user.id, communityId: oldData.community_id } as User; // Minimal user obj
            await logAudit(user, 'UPDATE', 'Visitor', visitorId, { status: oldData.status }, { status: newData.status }, `Updated visitor status to ${status}`);
        }
    }
};

export const createBooking = async (bookingData: any, user: User): Promise<Booking> => {
    const displayFlat = user.units && user.units.length > 0 ? user.units[0].flatNumber : (user.flatNumber || 'N/A');
    const newBooking = { amenity_id: bookingData.amenityId, start_time: bookingData.startTime, end_time: bookingData.endTime, resident_name: user.name, flat_number: displayFlat, user_id: user.id, community_id: user.communityId };
    const { data, error } = await supabase.from('bookings').insert(newBooking).select().single();
    if (error) throw error;
    
    await logAudit(user, 'CREATE', 'Booking', data.id, null, data, `Booked amenity`);

    return { id: data.id, amenityId: data.amenity_id, residentName: data.resident_name, flatNumber: data.flat_number, startTime: data.start_time, endTime: data.end_time, communityId: data.community_id } as Booking;
};

export const deleteBooking = async (bookingId: string): Promise<void> => { 
    const { data: oldData } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
    const { error } = await supabase.from('bookings').delete().eq('id', bookingId); 
    if (error) throw error; 
    
    if (oldData) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
             const user = { id: session.user.id, communityId: oldData.community_id } as User;
             await logAudit(user, 'DELETE', 'Booking', bookingId, oldData, null, `Cancelled booking`);
        }
    }
}

export const createAmenity = async (amenityData: any, user: User): Promise<Amenity> => { const newAmenity = { name: amenityData.name, description: amenityData.description, image_url: amenityData.imageUrl, capacity: amenityData.capacity, community_id: user.communityId, max_duration: amenityData.maxDuration || 0, status: 'Active' }; const { data, error } = await supabase.from('amenities').insert(newAmenity).select().single(); if (error) throw error; return { id: data.id, name: data.name, description: data.description, imageUrl: data.image_url, capacity: data.capacity, communityId: data.community_id, maxDuration: data.max_duration, status: data.status } as Amenity; };
export const updateAmenity = async (id: string, updates: Partial<Amenity>): Promise<void> => { const dbUpdates: any = {}; if (updates.status) dbUpdates.status = updates.status; if (updates.name) dbUpdates.name = updates.name; const { error } = await supabase.from('amenities').update(dbUpdates).eq('id', id); if (error) throw error; }
export const deleteAmenity = async (id: string): Promise<void> => { const { error } = await supabase.from('amenities').delete().eq('id', id); if (error) throw error; }

export const updateNotice = async (id: string, updates: Partial<Notice>): Promise<Notice> => { 
    const dbUpdates: any = {}; 
    if (updates.title) dbUpdates.title = updates.title; 
    if (updates.content) dbUpdates.content = updates.content; 
    if (updates.type) dbUpdates.type = updates.type; 
    if (updates.validFrom) dbUpdates.valid_from = updates.validFrom; 
    if (updates.validUntil !== undefined) dbUpdates.valid_until = updates.validUntil; 
    
    const { data: oldData } = await supabase.from('notices').select('*').eq('id', id).single();
    const { data, error } = await supabase.from('notices').update(dbUpdates).eq('id', id).select().single(); 
    if (error) throw error; 
    
    if (oldData) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
             const user = { id: session.user.id, communityId: oldData.community_id } as User;
             await logAudit(user, 'UPDATE', 'Notice', id, oldData, data, `Updated notice: ${data.title}`);
        }
    }

    return { id: data.id, title: data.title, content: data.content, author: data.author, createdAt: data.created_at, type: data.type, communityId: data.community_id, validFrom: data.valid_from, validUntil: data.valid_until } as Notice; 
};

export const deleteNotice = async (id: string): Promise<void> => { const { error } = await supabase.from('notices').delete().eq('id', id); if (error) throw error; };

export const createExpense = async (expenseData: any, user: User): Promise<Expense> => { 
    const newExpense = { title: expenseData.title, amount: expenseData.amount, category: expenseData.category, description: expenseData.description, date: expenseData.date, receipt_url: expenseData.receiptUrl, submitted_by: user.id, community_id: user.communityId, status: ExpenseStatus.Pending }; 
    const { data, error } = await supabase.from('expenses').insert(newExpense).select().single(); 
    if (error) throw error; 
    
    await logAudit(user, 'CREATE', 'Expense', data.id, null, data, `Logged expense: ${data.title}`);

    return { id: data.id, title: data.title, amount: data.amount, category: data.category, description: data.description, date: data.date, submittedBy: data.submitted_by, submittedByName: user.name, status: data.status, communityId: data.community_id, createdAt: data.created_at, receiptUrl: data.receipt_url } as Expense; 
}

export const updateComplaintStatus = async (id: string, status: ComplaintStatus): Promise<Complaint> => { 
    const { data: oldData } = await supabase.from('complaints').select('*').eq('id', id).single();
    const { data, error } = await supabase.from('complaints').update({ status }).eq('id', id).select('*, assigned_user:users!assigned_to(name)').single(); 
    if (error) throw error; 
    
    if (oldData) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
             const user = { id: session.user.id, communityId: oldData.community_id } as User;
             await logAudit(user, 'UPDATE', 'Complaint', id, { status: oldData.status }, { status: data.status }, `Updated complaint status to ${status}`);
        }
    }

    return { id: data.id, title: data.title, description: data.description, residentName: data.resident_name, flatNumber: data.flat_number, status: data.status, createdAt: data.created_at, category: data.category, userId: data.user_id, communityId: data.community_id, assignedTo: data.assigned_to, assignedToName: data.assigned_user?.name } as Complaint; 
};

export const assignComplaint = async (complaintId: string, agentId: string): Promise<void> => { const { error } = await supabase.from('complaints').update({ assigned_to: agentId }).eq('id', complaintId); if (error) throw error; };

export const submitMaintenancePayment = async (recordId: string, receiptUrl: string, upiId: string, transactionDate: string): Promise<void> => { 
    const { data: oldData } = await supabase.from('maintenance_records').select('*').eq('id', recordId).single();
    const { data: newData, error } = await supabase.from('maintenance_records').update({ payment_receipt_url: receiptUrl, upi_transaction_id: upiId, transaction_date: transactionDate, status: 'Submitted' }).eq('id', recordId).select().single(); 
    if (error) throw error; 

    if (oldData) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
             const user = { id: session.user.id, communityId: oldData.community_id } as User;
             await logAudit(user, 'UPDATE', 'Maintenance', recordId, { status: oldData.status }, { status: newData.status }, `Submitted payment via UPI: ${upiId}`);
        }
    }
}

export const verifyMaintenancePayment = async (recordId: string): Promise<void> => { const { error } = await supabase.from('maintenance_records').update({ status: 'Paid' }).eq('id', recordId); if (error) throw error; }

export const approveExpense = async (expenseId: string, userId: string): Promise<void> => { 
    const { data: oldData } = await supabase.from('expenses').select('*').eq('id', expenseId).single();
    const { data: newData, error } = await supabase.from('expenses').update({ status: ExpenseStatus.Approved, approved_by: userId }).eq('id', expenseId).select().single(); 
    if (error) throw error; 

    if (oldData) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
             const user = { id: session.user.id, communityId: oldData.community_id } as User;
             await logAudit(user, 'UPDATE', 'Expense', expenseId, { status: oldData.status }, { status: newData.status }, `Approved expense`);
        }
    }
}

export const rejectExpense = async (expenseId: string, userId: string, reason: string): Promise<void> => { 
    const { data: currentData, error: fetchError } = await supabase.from('expenses').select('description, status').eq('id', expenseId).single(); 
    if (fetchError) throw fetchError; 
    
    const updatedDescription = currentData.description ? `${currentData.description}\n\n[REJECTION REASON]: ${reason}` : `[REJECTION REASON]: ${reason}`; 
    const { data: newData, error } = await supabase.from('expenses').update({ status: ExpenseStatus.Rejected, approved_by: userId, description: updatedDescription }).eq('id', expenseId).select().single(); 
    if (error) throw error; 

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
            const user = { id: session.user.id, communityId: newData.community_id } as User;
            await logAudit(user, 'UPDATE', 'Expense', expenseId, { status: currentData.status }, { status: newData.status }, `Rejected expense: ${reason}`);
    }
}

export const assignAdminUnit = async (unitData: any, user: User, community: Community): Promise<void> => {
    if (unitData.flatSize === undefined || unitData.flatSize === null || isNaN(unitData.flatSize)) throw new Error("Invalid Flat Size.");
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("No active session");

    const response = await fetch('https://vnfmtbkhptkntaqzfdcx.supabase.co/functions/v1/assign-unit', {
        method: 'POST',
        cache: 'no-store', // Disable caching for this mutation
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': supabaseKey
        },
        body: JSON.stringify({
            unitData,
            communityId: community.id,
            userId: user.id
        })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to assign unit');
    }
}

export const getCommunityStats = async (): Promise<CommunityStat[]> => {
    // We now use the database view 'community_stats' for performance
    const { data, error } = await supabase
        .from('community_stats')
        .select('*')
        .order('name');

    if (error) {
        console.error("Error fetching community stats view:", error);
        // Fallback for dev/first run if view doesn't exist
        if (error.code === '42P01') { 
             const { data: communities } = await supabase.from('communities').select('*').order('name');
             if (!communities) return [];
             const stats: CommunityStat[] = [];
             for (const c of communities) {
                const { count: residentCount } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('community_id', c.id).eq('role', 'Resident');
                const { count: adminCount } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('community_id', c.id).eq('role', 'Admin');
                stats.push({ id: c.id, name: c.name, address: c.address, status: c.status, communityType: c.community_type, blocks: c.blocks, maintenanceRate: c.maintenance_rate, fixedMaintenanceAmount: c.fixed_maintenance_amount, contacts: c.contact_info, subscriptionType: c.subscription_type, subscriptionStartDate: c.subscription_start_date, pricePerUser: c.pricing_config, resident_count: residentCount || 0, admin_count: adminCount || 0, income_generated: 0 });
             }
             return stats;
        }
        throw error;
    }
    
    return data.map((c: any) => ({
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
        resident_count: c.resident_count,
        admin_count: c.admin_count,
        income_generated: c.income_generated || 0
    })) as CommunityStat[];
};

export const createCommunity = async (communityData: Partial<Community>): Promise<Community> => {
    const { data, error } = await supabase.from('communities').insert({ name: communityData.name, address: communityData.address, community_type: communityData.communityType, blocks: communityData.blocks, contact_info: communityData.contacts, subscription_type: communityData.subscriptionType, subscription_start_date: communityData.subscriptionStartDate, pricing_config: communityData.pricePerUser, status: 'active' }).select().single();
    if (error) throw error;
    return { id: data.id, name: data.name, address: data.address, status: data.status, communityType: data.community_type, blocks: data.blocks, maintenanceRate: data.maintenance_rate, fixedMaintenanceAmount: data.fixed_maintenance_amount, contacts: data.contact_info, subscriptionType: data.subscription_type, subscriptionStartDate: data.subscription_start_date, pricePerUser: data.pricing_config } as Community;
};

export const updateCommunity = async (id: string, updates: Partial<Community>): Promise<Community> => {
    const dbUpdates: any = {};
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.address) dbUpdates.address = updates.address;
    if (updates.communityType) dbUpdates.community_type = updates.communityType;
    if (updates.blocks) dbUpdates.blocks = updates.blocks;
    
    if (updates.maintenanceRate !== undefined) dbUpdates.maintenance_rate = updates.maintenanceRate;
    if (updates.fixedMaintenanceAmount !== undefined) dbUpdates.fixed_maintenance_amount = updates.fixedMaintenanceAmount;
    
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.contacts) dbUpdates.contact_info = updates.contacts;
    if (updates.subscriptionType) dbUpdates.subscription_type = updates.subscriptionType;
    if (updates.subscriptionStartDate) dbUpdates.subscription_start_date = updates.subscriptionStartDate;
    if (updates.pricePerUser) dbUpdates.pricing_config = updates.pricePerUser;

    const { data, error } = await supabase.from('communities').update(dbUpdates).eq('id', id).select().maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Update failed or permission denied.");

    if (updates.maintenanceRate !== undefined || updates.fixedMaintenanceAmount !== undefined) {
        try {
            await supabase.from('maintenance_configurations').insert({
                community_id: id,
                maintenance_rate: updates.maintenanceRate ?? data.maintenance_rate,
                fixed_maintenance_amount: updates.fixedMaintenanceAmount ?? data.fixed_maintenance_amount,
                effective_date: new Date().toISOString().split('T')[0]
            });
        } catch (e) {
            console.warn("Could not write to maintenance history:", e);
        }
    }

    return { id: data.id, name: data.name, address: data.address, status: data.status, communityType: data.community_type, blocks: data.blocks, maintenanceRate: data.maintenance_rate, fixedMaintenanceAmount: data.fixed_maintenance_amount, contacts: data.contact_info, subscriptionType: data.subscription_type, subscriptionStartDate: data.subscription_start_date, pricePerUser: data.pricing_config } as Community;
};

export const deleteCommunity = async (id: string): Promise<void> => { const { error } = await supabase.from('communities').delete().eq('id', id); if (error) throw error; };

export const createAdminUser = async (payload: any): Promise<void> => { 
    const { data: { session } } = await supabase.auth.getSession(); 
    if (!session) throw new Error("No active session"); 
    const response = await fetch('https://vnfmtbkhptkntaqzfdcx.supabase.co/functions/v1/create-admin-user', { 
        method: 'POST', 
        cache: 'no-store', // Disable caching for this mutation
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': supabaseKey }, 
        body: JSON.stringify(payload) 
    }); 
    if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'Failed to create admin user'); } 
};

export const createCommunityUser = async (payload: any): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("No active session");

    const response = await fetch('https://vnfmtbkhptkntaqzfdcx.supabase.co/functions/v1/create-community-user', {
        method: 'POST',
        cache: 'no-store', // Disable caching for this mutation
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': supabaseKey
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create user');
    }
};

export const updateUserPassword = async (password: string): Promise<void> => { 
    const { data: { session } } = await supabase.auth.getSession(); 
    if (!session) throw new Error("No active session"); 
    const response = await fetch('https://vnfmtbkhptkntaqzfdcx.supabase.co/functions/v1/update-user-password', { 
        method: 'POST', 
        cache: 'no-store', // Disable caching for this mutation
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': supabaseKey }, 
        body: JSON.stringify({ password }) 
    }); 
    if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'Failed to update password'); } 
};

export const requestPasswordReset = async (email: string): Promise<void> => { const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password', }); if (error) throw error; };
