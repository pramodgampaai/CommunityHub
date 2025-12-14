
// ... existing imports ...
import { supabase, supabaseKey } from './supabase';
import { Notice, Complaint, Visitor, Amenity, Booking, User, ComplaintCategory, ComplaintStatus, CommunityStat, Community, UserRole, CommunityType, Block, MaintenanceRecord, MaintenanceStatus, Unit, Expense, ExpenseCategory, ExpenseStatus, VisitorStatus, VisitorType, MaintenanceConfiguration, AuditLog, AuditAction } from '../types';

// ... (Internal Helpers - No Change) ...
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
        const payload = { community_id: user.communityId, actor_id: user.id, action, entity, entity_id: entityId, details: { old: oldData, new: newData, description } };
        supabase.from('audit_logs').insert(payload).then(({ error }) => { if (error) console.error("Audit Log Error:", error); });
    } catch (e) { console.error("Failed to log audit", e); }
};

// ... (Generic getters - No Change) ...
export const getAuditLogs = async (communityId: string, userId?: string, role?: UserRole): Promise<AuditLog[]> => {
    let query = supabase.from('audit_logs').select('*, actor:users(name, role)').eq('community_id', communityId).order('created_at', { ascending: false });
    if (role === UserRole.Resident && userId) { query = query.eq('actor_id', userId); }
    const { data, error } = await query;
    if (error) { if (error.code === '42P01') return []; throw error; }
    return data.map((log: any) => ({ id: log.id, createdAt: log.created_at, communityId: log.community_id, actorId: log.actor_id, actorName: log.actor?.name || 'Unknown', actorRole: log.actor?.role || '', entity: log.entity, entityId: log.entity_id, action: log.action as AuditAction, details: log.details })) as AuditLog[];
};

export const getNotices = async (communityId: string): Promise<Notice[]> => {
    const { data, error } = await supabase.from('notices').select('*').eq('community_id', communityId).order('created_at', { ascending: false });
    if (error) throw error;
    return data.map((n: any) => ({ id: n.id, title: n.title, content: n.content, author: n.author, createdAt: n.created_at, type: n.type, communityId: n.community_id, validFrom: n.valid_from, validUntil: n.valid_until })) as Notice[];
};

// --- UPDATED getComplaints ---
export const getComplaints = async (communityId: string, userId?: string, role?: UserRole): Promise<Complaint[]> => {
    const r = role ? role.toLowerCase() : '';
    const shouldUseEdgeFunction = r === 'admin' || 
                                  r === 'helpdeskadmin' || 
                                  r === 'securityadmin' || 
                                  r === 'helpdeskagent' ||
                                  r === 'superadmin';

    if (shouldUseEdgeFunction) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            const response = await fetch('https://vnfmtbkhptkntaqzfdcx.supabase.co/functions/v1/get-complaints', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': supabaseKey
                },
                body: JSON.stringify({ community_id: communityId })
            });

            if (response.ok) {
                const resData = await response.json();
                const data = resData.data;
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
            } else {
                console.warn("Edge function fetch failed, falling back to standard client.");
            }
        }
    }

    let query = supabase
        .from('complaints')
        .select('*, assigned_user:users!assigned_to(name)')
        .eq('community_id', communityId)
        .order('created_at', { ascending: false });

    if (role === UserRole.Resident && userId) {
        query = query.eq('user_id', userId);
    } else if (r === 'helpdeskagent' && userId) {
        query = query.eq('assigned_to', userId);
    }
        
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

// ... (getVisitors, getAmenities, etc. - No Change) ...
export const getVisitors = async (communityId: string, userRole?: UserRole): Promise<Visitor[]> => {
    
    const isPrivileged = userRole === UserRole.Security || 
                         userRole === UserRole.SecurityAdmin || 
                         userRole === UserRole.Admin || 
                         userRole === UserRole.SuperAdmin;

    if (isPrivileged) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            const response = await fetch('https://vnfmtbkhptkntaqzfdcx.supabase.co/functions/v1/get-visitors', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': supabaseKey
                },
                body: JSON.stringify({ community_id: communityId })
            });

            if (response.ok) {
                const resData = await response.json();
                const data = resData.data;
                return data.map((v: any) => ({ 
                    id: v.id, 
                    name: v.name, 
                    visitorType: v.visitor_type || VisitorType.Guest,
                    vehicleNumber: v.vehicle_number,
                    purpose: v.purpose, 
                    expectedAt: v.expected_at, 
                    validUntil: v.valid_until,
                    status: v.status, 
                    residentName: v.resident_name, 
                    flatNumber: v.flat_number, 
                    communityId: v.community_id, 
                    userId: v.user_id, 
                    entryToken: v.entry_token || v.id,
                    entryTime: v.entry_time,
                    exitTime: v.exit_time
                })) as Visitor[];
            } else {
                console.warn("Edge function fetch failed, falling back to standard client.");
            }
        }
    }

    const { data, error } = await supabase
        .from('visitors')
        .select('*')
        .eq('community_id', communityId)
        .order('expected_at', { ascending: false });

    if (error) throw error;
    
    return data.map((v: any) => ({ 
        id: v.id, 
        name: v.name, 
        visitorType: v.visitor_type || VisitorType.Guest,
        vehicleNumber: v.vehicle_number,
        purpose: v.purpose, 
        expectedAt: v.expected_at, 
        validUntil: v.valid_until,
        status: v.status, 
        residentName: v.resident_name, 
        flatNumber: v.flat_number, 
        communityId: v.community_id, 
        userId: v.user_id, 
        entryToken: v.entry_token || v.id,
        entryTime: v.entry_time,
        exitTime: v.exit_time
    })) as Visitor[];
};

export const getAmenities = async (communityId: string): Promise<Amenity[]> => {
    const { data, error } = await supabase.from('amenities').select('*').eq('community_id', communityId).order('name');
    if (error) throw error;
    return data.map((a: any) => ({ id: a.id, name: a.name, description: a.description, imageUrl: a.image_url, capacity: a.capacity, communityId: a.community_id, maxDuration: a.max_duration, status: a.status || 'Active' })) as Amenity[];
};

export const getBookings = async (communityId: string): Promise<Booking[]> => {
    const { data, error } = await supabase.from('bookings').select('*').eq('community_id', communityId);
    if (error) throw error;
    return data.map((b: any) => ({ id: b.id, amenityId: b.amenity_id, residentName: b.resident_name, flatNumber: b.flat_number, startTime: b.start_time, endTime: b.end_time, communityId: b.community_id })) as Booking[];
};

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
    const mappedUnits: Unit[] = userUnitsRaw.map((unit: any) => ({ id: unit.id, userId: unit.user_id, communityId: unit.community_id, flatNumber: unit.flat_number, block: unit.block, floor: unit.floor, flatSize: unit.flat_size, maintenanceStartDate: unit.maintenance_start_date }));
    const primaryUnit = mappedUnits.length > 0 ? mappedUnits[0] : null;
    return { id: u.id, name: u.name, email: u.email, avatarUrl: u.avatar_url, flatNumber: primaryUnit ? primaryUnit.flatNumber : u.flat_number, role: normalizeRole(u.role), communityId: u.community_id, status: u.status, units: mappedUnits, maintenanceStartDate: u.maintenance_start_date, theme: u.theme } as User;
};

export const getResidents = async (communityId: string): Promise<User[]> => {
    const { data: users, error: userError } = await supabase.from('users').select('*').eq('community_id', communityId);
    if (userError) throw userError;
    if (!users) return [];
    let allUnits: any[] = [];
    try { const { data: units } = await supabase.from('units').select('*').eq('community_id', communityId); if (units) allUnits = units; } catch (err) { console.warn("Failed to fetch units", err); }
    return users.map(user => mapUserFromDB(user, allUnits)).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
};

export const updateTheme = async (userId: string, theme: 'light' | 'dark'): Promise<void> => { const { error } = await supabase.from('users').update({ theme }).eq('id', userId); if (error) throw error; };

export const getCommunity = async (communityId: string): Promise<Community> => {
    const { data, error } = await supabase.from('communities').select('*').eq('id', communityId).single();
    if (error) throw error;
    return { id: data.id, name: data.name, address: data.address, status: data.status, communityType: data.community_type, blocks: data.blocks, maintenanceRate: data.maintenance_rate, fixedMaintenanceAmount: data.fixed_maintenance_amount, contacts: data.contact_info, subscriptionType: data.subscription_type, subscriptionStartDate: data.subscription_start_date, pricePerUser: data.pricing_config } as Community;
};

export const getMaintenanceHistory = async (communityId: string): Promise<MaintenanceConfiguration[]> => {
    const { data, error } = await supabase.from('maintenance_configurations').select('*').eq('community_id', communityId).order('effective_date', { ascending: false });
    if (error) { if (error.code === '42P01') return []; throw error; }
    return data.map((c: any) => ({ id: c.id, communityId: c.community_id, maintenanceRate: c.maintenance_rate, fixedMaintenanceAmount: c.fixed_maintenance_amount, effectiveDate: c.effective_date, createdAt: c.created_at })) as MaintenanceConfiguration[];
};

export const addMaintenanceConfiguration = async (config: { communityId: string; maintenanceRate: number; fixedMaintenanceAmount: number; effectiveDate: string; }): Promise<void> => {
    const { error } = await supabase.from('maintenance_configurations').insert({ community_id: config.communityId, maintenance_rate: config.maintenanceRate, fixed_maintenance_amount: config.fixedMaintenanceAmount, effective_date: config.effectiveDate });
    if (error) throw error;
    await supabase.from('communities').update({ maintenance_rate: config.maintenanceRate, fixed_maintenance_amount: config.fixedMaintenanceAmount }).eq('id', config.communityId);
};

export const getMaintenanceRecords = async (communityId: string, userId?: string): Promise<MaintenanceRecord[]> => {
    let query = supabase.from('maintenance_records').select('*, user:users(name)').eq('community_id', communityId).order('period_date', { ascending: false });
    if (userId) query = query.eq('user_id', userId);
    const { data: records, error } = await query;
    if (error) throw error;
    let unitsMap: Record<string, any> = {};
    try { const { data: units } = await supabase.from('units').select('*').eq('community_id', communityId); if (units) units.forEach((u: any) => unitsMap[u.id] = u); } catch (e) { }
    return records.map((r: any) => {
        let displayFlat = 'Unknown';
        const linkedUnit = r.unit_id ? unitsMap[r.unit_id] : null;
        if (linkedUnit) { displayFlat = linkedUnit.block ? `${linkedUnit.block}-${linkedUnit.flat_number}` : linkedUnit.flat_number; } else { displayFlat = r.user?.flat_number || 'N/A'; }
        return { id: r.id, userId: r.user_id, unitId: r.unit_id, communityId: r.community_id, amount: r.amount, periodDate: r.period_date, status: r.status as MaintenanceStatus, paymentReceiptUrl: r.payment_receipt_url, upiTransactionId: r.upi_transaction_id, transactionDate: r.transaction_date, createdAt: r.created_at, userName: r.user?.name, flatNumber: displayFlat };
    }) as MaintenanceRecord[];
}

export const getExpenses = async (communityId: string): Promise<Expense[]> => {
    const { data, error } = await supabase.from('expenses').select('*, submitted_user:users!submitted_by(name), approved_user:users!approved_by(name)').eq('community_id', communityId).order('date', { ascending: false });
    if (error) { if (error.code === '42P01') { return []; } throw error; }
    return data.map((e: any) => ({ id: e.id, title: e.title, amount: e.amount, category: e.category, description: e.description, date: e.date, submittedBy: e.submitted_by, submittedByName: e.submitted_user?.name, status: e.status, approvedBy: e.approved_by, approvedByName: e.approved_user?.name, communityId: e.community_id, createdAt: e.created_at, receiptUrl: e.receipt_url })) as Expense[];
}

// ... (Create Notice, Complaint, etc. - No Change) ...
export const createNotice = async (noticeData: any, user: User): Promise<Notice> => {
    const newNotice = { title: noticeData.title, content: noticeData.content, type: noticeData.type, author: noticeData.author, community_id: user.communityId, valid_from: noticeData.validFrom, valid_until: noticeData.validUntil };
    const { data, error } = await supabase.from('notices').insert(newNotice).select().single();
    if (error) throw error;
    await logAudit(user, 'CREATE', 'Notice', data.id, null, data, `Posted notice: ${data.title}`);
    return { id: data.id, title: data.title, content: data.content, author: data.author, createdAt: data.created_at, type: data.type, communityId: data.community_id, validFrom: data.valid_from, validUntil: data.valid_until } as Notice;
};

export const updateNotice = async (id: string, updates: Partial<Notice>): Promise<void> => {
    const dbUpdates: any = {};
    if (updates.title) dbUpdates.title = updates.title;
    if (updates.content) dbUpdates.content = updates.content;
    if (updates.type) dbUpdates.type = updates.type;
    if (updates.validFrom !== undefined) dbUpdates.valid_from = updates.validFrom;
    if (updates.validUntil !== undefined) dbUpdates.valid_until = updates.validUntil;

    const { error } = await supabase.from('notices').update(dbUpdates).eq('id', id);
    if (error) throw error;
};

export const deleteNotice = async (id: string): Promise<void> => {
    const { error } = await supabase.from('notices').delete().eq('id', id);
    if (error) throw error;
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
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("No active session");
    const response = await fetch('https://vnfmtbkhptkntaqzfdcx.supabase.co/functions/v1/create-complaint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': supabaseKey },
        body: JSON.stringify({ title: complaintData.title, description: complaintData.description, category: complaintData.category, resident_name: user.name, flat_number: displayFlat, user_id: user.id, community_id: user.communityId, unit_id: specificUnitId })
    });
    if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'Failed to create complaint'); }
    const responseData = await response.json(); const data = responseData.data;
    await logAudit(user, 'CREATE', 'Complaint', data.id, null, data, `Raised complaint: ${data.title}`);
    return { id: data.id, title: data.title, description: data.description, residentName: data.resident_name, flatNumber: data.flat_number, status: data.status, createdAt: data.created_at, category: data.category, userId: data.user_id, communityId: data.community_id, assignedTo: data.assigned_to } as Complaint;
};

export const updateComplaintStatus = async (id: string, status: ComplaintStatus): Promise<Complaint> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("No active session");
    
    const response = await fetch('https://vnfmtbkhptkntaqzfdcx.supabase.co/functions/v1/update-complaint', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': supabaseKey
        },
        body: JSON.stringify({ id, status })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update complaint status');
    }
    const resData = await response.json();
    const data = resData.data;
    return {
        id: data.id,
        title: data.title,
        description: data.description,
        residentName: data.resident_name,
        flatNumber: data.flat_number,
        status: data.status,
        createdAt: data.created_at,
        category: data.category,
        userId: data.user_id,
        communityId: data.community_id,
        assignedTo: data.assigned_to,
        assignedToName: data.assigned_user?.name
    } as Complaint;
};

export const assignComplaint = async (complaintId: string, agentId: string): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("No active session");

    const response = await fetch('https://vnfmtbkhptkntaqzfdcx.supabase.co/functions/v1/update-complaint', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': supabaseKey
        },
        body: JSON.stringify({ id: complaintId, assigned_to: agentId })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to assign complaint');
    }
};

export const createVisitor = async (visitorData: any, user: User): Promise<Visitor> => {
    const newVisitor = {
        name: visitorData.name,
        visitor_type: visitorData.visitorType,
        vehicle_number: visitorData.vehicleNumber,
        purpose: visitorData.purpose,
        expected_at: visitorData.expectedAt,
        status: 'Expected',
        resident_name: user.name,
        flat_number: visitorData.targetFlat || user.flatNumber || 'N/A',
        community_id: user.communityId,
        user_id: user.id
    };
    
    // Fallback token generation, though backend handles primary generation
    const entryToken = Math.random().toString(36).substring(2, 8).toUpperCase();
    (newVisitor as any).entry_token = entryToken;

    const { data, error } = await supabase.from('visitors').insert(newVisitor).select().single();
    if (error) throw error;
    
    await logAudit(user, 'CREATE', 'Visitor', data.id, null, data, `Invited visitor: ${data.name}`);

    return {
        id: data.id,
        name: data.name,
        visitorType: data.visitor_type,
        vehicleNumber: data.vehicle_number,
        purpose: data.purpose,
        status: data.status,
        expectedAt: data.expected_at,
        residentName: data.resident_name,
        flatNumber: data.flat_number,
        communityId: data.community_id,
        userId: data.user_id,
        entryToken: data.entry_token
    } as Visitor;
};

export const updateVisitorStatus = async (id: string, status: VisitorStatus): Promise<void> => {
    const { error } = await supabase.from('visitors').update({ status }).eq('id', id);
    if (error) throw error;
};

export const verifyVisitorEntry = async (visitorId: string, entryToken: string, user: User): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("No active session");

    const response = await fetch('https://vnfmtbkhptkntaqzfdcx.supabase.co/functions/v1/verify-visitor', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': supabaseKey
        },
        body: JSON.stringify({ visitor_id: visitorId, entry_token: entryToken })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Verification failed');
    }
};

export const checkOutVisitor = async (id: string, user: User): Promise<void> => {
    const { error } = await supabase.from('visitors').update({ status: 'Checked Out', exit_time: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    await logAudit(user, 'UPDATE', 'Visitor', id, null, null, 'Checked out visitor');
};

export const createAmenity = async (amenityData: any, user: User): Promise<Amenity> => {
    const newAmenity = {
        name: amenityData.name,
        description: amenityData.description,
        image_url: amenityData.imageUrl,
        capacity: amenityData.capacity,
        max_duration: amenityData.maxDuration,
        community_id: user.communityId,
        status: 'Active'
    };
    const { data, error } = await supabase.from('amenities').insert(newAmenity).select().single();
    if (error) throw error;
    await logAudit(user, 'CREATE', 'Amenity', data.id, null, data, `Created amenity: ${data.name}`);
    return {
        id: data.id,
        name: data.name,
        description: data.description,
        imageUrl: data.image_url,
        capacity: data.capacity,
        communityId: data.community_id,
        maxDuration: data.max_duration,
        status: data.status
    } as Amenity;
};

export const updateAmenity = async (id: string, updates: Partial<Amenity>): Promise<void> => {
    const dbUpdates: any = {};
    if (updates.status) dbUpdates.status = updates.status;
    const { error } = await supabase.from('amenities').update(dbUpdates).eq('id', id);
    if (error) throw error;
};

export const deleteAmenity = async (id: string): Promise<void> => {
    const { error } = await supabase.from('amenities').delete().eq('id', id);
    if (error) throw error;
};

export const createBooking = async (bookingData: any, user: User): Promise<Booking> => {
    const newBooking = {
        amenity_id: bookingData.amenityId,
        resident_name: user.name,
        flat_number: user.flatNumber || 'N/A',
        start_time: bookingData.startTime,
        end_time: bookingData.endTime,
        community_id: user.communityId,
        user_id: user.id
    };
    const { data, error } = await supabase.from('bookings').insert(newBooking).select().single();
    if (error) throw error;
    return {
        id: data.id,
        amenityId: data.amenity_id,
        residentName: data.resident_name,
        flatNumber: data.flat_number,
        startTime: data.start_time,
        endTime: data.end_time,
        communityId: data.community_id
    } as Booking;
};

export const deleteBooking = async (id: string): Promise<void> => {
    const { error } = await supabase.from('bookings').delete().eq('id', id);
    if (error) throw error;
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

export const createExpense = async (expenseData: any, user: User): Promise<Expense> => {
    const newExpense = {
        title: expenseData.title,
        amount: expenseData.amount,
        category: expenseData.category,
        description: expenseData.description,
        date: expenseData.date,
        receipt_url: expenseData.receiptUrl,
        submitted_by: user.id,
        community_id: user.communityId,
        status: 'Pending'
    };
    const { data, error } = await supabase.from('expenses').insert(newExpense).select().single();
    if (error) throw error;
    await logAudit(user, 'CREATE', 'Expense', data.id, null, data, `Logged expense: ${data.title}`);
    return {
        id: data.id,
        title: data.title,
        amount: data.amount,
        category: data.category,
        description: data.description,
        date: data.date,
        submittedBy: data.submitted_by,
        status: data.status,
        communityId: data.community_id,
        createdAt: data.created_at,
        receiptUrl: data.receipt_url
    } as Expense;
};

export const approveExpense = async (id: string, userId: string): Promise<void> => {
    const { error } = await supabase.from('expenses').update({
        status: 'Approved',
        approved_by: userId
    }).eq('id', id);
    if (error) throw error;
};

export const rejectExpense = async (id: string, userId: string, reason: string): Promise<void> => {
    const { data } = await supabase.from('expenses').select('description').eq('id', id).single();
    const currentDesc = data?.description || '';
    const newDesc = `${currentDesc}\n\n[REJECTION REASON]: ${reason}`;

    const { error } = await supabase.from('expenses').update({
        status: 'Rejected',
        approved_by: userId,
        description: newDesc
    }).eq('id', id);
    if (error) throw error;
};

export const assignAdminUnit = async (unitData: any, user: User, community: Community): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("No active session");

    const response = await fetch('https://vnfmtbkhptkntaqzfdcx.supabase.co/functions/v1/assign-unit', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': supabaseKey
        },
        body: JSON.stringify({ unitData, communityId: community.id, userId: user.id })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to assign unit');
    }
};

export const getCommunityStats = async (): Promise<CommunityStat[]> => {
    // UPDATED: Use Edge Function to get accurate stats bypassing the potentially stale DB View
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        const response = await fetch('https://vnfmtbkhptkntaqzfdcx.supabase.co/functions/v1/get-community-stats', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
                'apikey': supabaseKey
            },
            body: JSON.stringify({})
        });

        if (response.ok) {
            const resData = await response.json();
            // Manually map pricing_config to pricePerUser since Edge Function returns raw DB keys
            return resData.data.map((c: any) => ({
                ...c,
                pricePerUser: c.pricing_config || c.pricePerUser, // Fallback if API changed
                subscriptionStartDate: c.subscription_start_date,
                subscriptionType: c.subscription_type,
                communityType: c.community_type,
                maintenanceRate: c.maintenance_rate,
                fixedMaintenanceAmount: c.fixed_maintenance_amount
            })) as CommunityStat[];
        }
    }

    // Fallback Logic (View or Manual Count) - Kept for backup
    const { data, error } = await supabase.from('community_stats').select('*').order('name');
    if (error) { 
        if (error.code === '42P01') { 
            const { data: communities } = await supabase.from('communities').select('*').order('name'); 
            if (!communities) return []; 
            const stats: CommunityStat[] = []; 
            for (const c of communities) { 
                const { count: residentCount } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('community_id', c.id).eq('role', 'Resident'); 
                const { count: adminCount } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('community_id', c.id).eq('role', 'Admin'); 
                const { count: helpdeskCount } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('community_id', c.id).eq('role', 'HelpdeskAdmin'); 
                const { count: securityCount } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('community_id', c.id).eq('role', 'SecurityAdmin'); 

                stats.push({ 
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
                    resident_count: residentCount || 0, 
                    admin_count: adminCount || 0, 
                    helpdesk_count: helpdeskCount || 0,
                    security_count: securityCount || 0,
                    staff_count: (helpdeskCount || 0) + (securityCount || 0), // Basic fallback sum
                    income_generated: 0 
                }); 
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
        resident_count: c.resident_count || 0, 
        admin_count: c.admin_count || 0, 
        helpdesk_count: c.helpdesk_count || 0, 
        security_count: c.security_count || 0,
        staff_count: c.staff_count || 0,
        income_generated: c.income_generated || 0 
    })) as CommunityStat[];
};

export const createCommunity = async (communityData: Partial<Community>): Promise<Community> => {
    const { data, error } = await supabase.from('communities').insert({ name: communityData.name, address: communityData.address, community_type: communityData.communityType, blocks: communityData.blocks, contact_info: communityData.contacts, subscription_type: communityData.subscriptionType, subscription_start_date: communityData.subscriptionStartDate, pricing_config: communityData.pricePerUser, status: 'active' }).select().single();
    if (error) throw error;
    return { id: data.id, name: data.name, address: data.address, status: data.status, communityType: data.community_type, blocks: data.blocks, maintenanceRate: data.maintenance_rate, fixedMaintenanceAmount: data.fixed_maintenance_amount, contacts: data.contact_info, subscriptionType: data.subscription_type, subscriptionStartDate: data.subscription_start_date, pricePerUser: data.pricing_config } as Community;
};

export const updateCommunity = async (id: string, updates: Partial<Community>): Promise<Community> => {
    const dbUpdates: any = {}; if (updates.name) dbUpdates.name = updates.name; if (updates.address) dbUpdates.address = updates.address; if (updates.communityType) dbUpdates.community_type = updates.communityType; if (updates.blocks) dbUpdates.blocks = updates.blocks; if (updates.maintenanceRate !== undefined) dbUpdates.maintenance_rate = updates.maintenanceRate; if (updates.fixedMaintenanceAmount !== undefined) dbUpdates.fixed_maintenance_amount = updates.fixedMaintenanceAmount; if (updates.status) dbUpdates.status = updates.status; if (updates.contacts) dbUpdates.contact_info = updates.contacts; if (updates.subscriptionType) dbUpdates.subscription_type = updates.subscriptionType; if (updates.subscriptionStartDate) dbUpdates.subscription_start_date = updates.subscriptionStartDate; if (updates.pricePerUser) dbUpdates.pricing_config = updates.pricePerUser;
    const { data, error } = await supabase.from('communities').update(dbUpdates).eq('id', id).select().maybeSingle();
    if (error) throw error; if (!data) throw new Error("Update failed or permission denied.");
    if (updates.maintenanceRate !== undefined || updates.fixedMaintenanceAmount !== undefined) { try { await supabase.from('maintenance_configurations').insert({ community_id: id, maintenance_rate: updates.maintenanceRate ?? data.maintenance_rate, fixed_maintenance_amount: updates.fixedMaintenanceAmount ?? data.fixed_maintenance_amount, effective_date: new Date().toISOString().split('T')[0] }); } catch (e) { console.warn("Could not write to maintenance history:", e); } }
    return { id: data.id, name: data.name, address: data.address, status: data.status, communityType: data.community_type, blocks: data.blocks, maintenanceRate: data.maintenance_rate, fixedMaintenanceAmount: data.fixed_maintenance_amount, contacts: data.contact_info, subscriptionType: data.subscription_type, subscriptionStartDate: data.subscription_start_date, pricePerUser: data.pricing_config } as Community;
};

// ... (Rest of Admin actions - No Change) ...
export const deleteCommunity = async (id: string): Promise<void> => { const { error } = await supabase.from('communities').delete().eq('id', id); if (error) throw error; };

export const createAdminUser = async (payload: any): Promise<void> => { 
    const { data: { session } } = await supabase.auth.getSession(); if (!session) throw new Error("No active session"); 
    const response = await fetch('https://vnfmtbkhptkntaqzfdcx.supabase.co/functions/v1/create-admin-user', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': supabaseKey }, body: JSON.stringify(payload) }); 
    if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'Failed to create admin user'); } 
};

export const createCommunityUser = async (payload: any): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession(); if (!session) throw new Error("No active session");
    const response = await fetch('https://vnfmtbkhptkntaqzfdcx.supabase.co/functions/v1/create-community-user', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': supabaseKey }, body: JSON.stringify(payload) });
    if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'Failed to create user'); }
};

export const updateUserPassword = async (password: string): Promise<void> => { 
    const { data: { session } } = await supabase.auth.getSession(); if (!session) throw new Error("No active session"); 
    const response = await fetch('https://vnfmtbkhptkntaqzfdcx.supabase.co/functions/v1/update-user-password', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': supabaseKey }, body: JSON.stringify({ password }) }); 
    if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'Failed to update password'); } 
};

export const requestPasswordReset = async (email: string): Promise<void> => { const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password', }); if (error) throw error; };
