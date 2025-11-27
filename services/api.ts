

import { supabase, supabaseKey } from './supabase';
import { Notice, Complaint, Visitor, Amenity, Booking, User, ComplaintCategory, ComplaintStatus, CommunityStat, Community, UserRole, CommunityType, Block, MaintenanceRecord, MaintenanceStatus, Unit, Expense, ExpenseCategory, ExpenseStatus, VisitorStatus } from '../types';

// =================================================================
// USER / ADMIN / RESIDENT-FACING API
// =================================================================

// READ operations
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
    // We use a join to get the name of the person assigned to the ticket
    let query = supabase
        .from('complaints')
        .select('*, assigned_user:users!assigned_to(name)')
        .eq('community_id', communityId)
        .order('created_at', { ascending: false });

    // Helpdesk Agents can only see tickets assigned to them
    if (role === UserRole.HelpdeskAgent && userId) {
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

const normalizeRole = (r: string): UserRole => {
    if (!r) return UserRole.Resident;
    const lower = r.toLowerCase();
    if (lower === 'admin') return UserRole.Admin;
    if (lower === 'resident') return UserRole.Resident;
    if (lower === 'security') return UserRole.Security;
    if (lower === 'helpdesk') return UserRole.HelpdeskAdmin; // Map legacy/shorthand
    if (lower === 'helpdeskadmin') return UserRole.HelpdeskAdmin;
    if (lower === 'helpdeskagent') return UserRole.HelpdeskAgent;
    if (lower === 'securityadmin') return UserRole.SecurityAdmin;
    if (lower === 'superadmin') return UserRole.SuperAdmin;
    // Fallback to capitalization
    return (r.charAt(0).toUpperCase() + r.slice(1)) as UserRole;
};

// Helper to map DB user to User interface
const mapUserFromDB = (u: any, units: any[] = []): User => {
    // Map units specific to this user
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
        // Display purpose: Use first unit or legacy field
        flatNumber: primaryUnit ? primaryUnit.flatNumber : u.flat_number,
        role: normalizeRole(u.role),
        communityId: u.community_id,
        status: u.status,
        units: mappedUnits,
        maintenanceStartDate: u.maintenance_start_date // Legacy
    } as User;
};

export const getResidents = async (communityId: string): Promise<User[]> => {
    // ROBUST STRATEGY: Decoupled Fetching
    // This guarantees the directory loads even if the 'units' table or relationship is broken.
    
    // Step 1: Fetch Users (Guaranteed to exist)
    // Removed .order('created_at') to prevent 400 Bad Request if column is missing
    const { data: users, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('community_id', communityId);
    
    if (userError) throw userError;
    if (!users) return [];

    // Step 2: Fetch Units (Best effort)
    let allUnits: any[] = [];
    try {
        const { data: units, error: unitsError } = await supabase
            .from('units')
            .select('*')
            .eq('community_id', communityId);
        
        if (!unitsError && units) {
            allUnits = units;
        }
    } catch (err) {
        console.warn("Failed to fetch units (table might be missing), proceeding with users only.", err);
    }

    // Step 3: Combine
    const mappedUsers = users.map(user => mapUserFromDB(user, allUnits));

    // Sort by Name client-side for stability
    return mappedUsers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
};

export const getCommunity = async (communityId: string): Promise<Community> => {
    const { data, error } = await supabase
        .from('communities')
        .select('*')
        .eq('id', communityId)
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
        fixedMaintenanceAmount: data.fixed_maintenance_amount
    } as Community;
};

export const getMaintenanceRecords = async (communityId: string, userId?: string): Promise<MaintenanceRecord[]> => {
    // Similar decoupled strategy for robust loading
    let query = supabase
        .from('maintenance_records')
        .select('*, user:users(name)') // Only join user (reliable)
        .eq('community_id', communityId)
        .order('period_date', { ascending: false });

    if (userId) {
        query = query.eq('user_id', userId);
    }

    const { data: records, error } = await query;
    if (error) throw error;

    // Fetch Units separately to map flat details safely
    let unitsMap: Record<string, any> = {};
    try {
        const { data: units } = await supabase.from('units').select('*').eq('community_id', communityId);
        if (units) {
            units.forEach((u: any) => unitsMap[u.id] = u);
        }
    } catch (e) { /* ignore */ }

    return records.map((r: any) => {
        // Determine Display Flat
        let displayFlat = 'Unknown';
        const linkedUnit = r.unit_id ? unitsMap[r.unit_id] : null;

        if (linkedUnit) {
            displayFlat = linkedUnit.block ? `${linkedUnit.block}-${linkedUnit.flat_number}` : linkedUnit.flat_number;
        } else {
             // Fallback
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
    const { data, error } = await supabase
        .from('expenses')
        .select('*, submitted_user:users!submitted_by(name), approved_user:users!approved_by(name)')
        .eq('community_id', communityId)
        .order('date', { ascending: false });

    if (error) {
        // Check if error is because table doesn't exist (during dev/preview)
        if (error.code === '42P01') { 
            console.warn("Expenses table missing");
            return [];
        }
        throw error;
    }

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

// CREATE operations
export const createNotice = async (noticeData: { title: string; content: string; type: Notice['type']; author: string; validFrom?: string; validUntil?: string }, user: User): Promise<Notice> => {
    const newNotice = {
        title: noticeData.title,
        content: noticeData.content,
        type: noticeData.type,
        author: noticeData.author,
        community_id: user.communityId,
        valid_from: noticeData.validFrom,
        valid_until: noticeData.validUntil
    };
    const { data, error } = await supabase.from('notices').insert(newNotice).select().single();
    if (error) throw error;
    
    return {
        id: data.id,
        title: data.title,
        content: data.content,
        author: data.author,
        createdAt: data.created_at,
        type: data.type,
        communityId: data.community_id,
        validFrom: data.valid_from,
        validUntil: data.valid_until
    } as Notice;
};

export const createComplaint = async (
    complaintData: { title: string; description: string; category: ComplaintCategory; }, 
    user: User,
    specificUnitId?: string,
    specificFlatNumber?: string
): Promise<Complaint> => {
    
    let displayFlat = specificFlatNumber;
    
    if (!displayFlat) {
        if (user.units && user.units.length > 0) {
            const u = user.units[0];
            displayFlat = u.block ? `${u.block}-${u.flatNumber}` : u.flatNumber;
        } else {
            displayFlat = user.flatNumber || 'N/A';
        }
    }

    const newComplaint = {
        title: complaintData.title,
        description: complaintData.description,
        category: complaintData.category,
        status: ComplaintStatus.Pending,
        resident_name: user.name,
        flat_number: displayFlat,
        user_id: user.id,
        community_id: user.communityId,
        unit_id: specificUnitId
    };

    const { data, error } = await supabase.from('complaints').insert(newComplaint).select().single();
    if (error) throw error;
    
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
        communityId: data.community_id
    } as Complaint;
};

export const createVisitor = async (
    visitorData: { name: string; purpose: string; expectedAt: string, targetFlat?: string }, 
    user: User
): Promise<Visitor> => {
     
    let targetUserId = user.id;
    let residentName = user.name;
    let displayFlat = 'N/A';
    let status: VisitorStatus = VisitorStatus.Expected;

    // 1. If Creator is Resident
    if (user.role === UserRole.Resident) {
        displayFlat = user.units && user.units.length > 0 ? user.units[0].flatNumber : (user.flatNumber || 'N/A');
    } 
    // 2. If Creator is Security/Admin, we MUST resolve the resident by flat number
    else if (user.role === UserRole.Security || user.role === UserRole.SecurityAdmin || user.role === UserRole.Admin) {
        if (!visitorData.targetFlat) throw new Error("Flat number is required for security created visitors.");
        
        const flatInput = visitorData.targetFlat.trim();
        let blockSearch = '';
        let flatSearch = flatInput;

        // Simple parsing: if contains hyphen, assume Block-Flat
        if (flatInput.includes('-')) {
            const parts = flatInput.split('-');
            if (parts.length >= 2) {
                 blockSearch = parts[0].trim();
                 flatSearch = parts.slice(1).join('-').trim();
            }
        }

        let unitData = null;
        
        // Try Block+Flat search first if block detected
        if (blockSearch) {
             const { data } = await supabase
                .from('units')
                .select('user_id, users(name), flat_number, block')
                .eq('community_id', user.communityId)
                .ilike('block', blockSearch) // case insensitive
                .eq('flat_number', flatSearch)
                .limit(1)
                .maybeSingle();
             unitData = data;
        }

        // If not found or no block, try direct flat match (e.g. '101' or user entered 'A-101' but stored as 'A-101' in flat_number legacy)
        if (!unitData) {
             const { data } = await supabase
                .from('units')
                .select('user_id, users(name), flat_number, block')
                .eq('community_id', user.communityId)
                .eq('flat_number', flatInput)
                .limit(1)
                .maybeSingle();
             unitData = data;
        }
        
        if (unitData) {
             // Found in Units
             targetUserId = unitData.user_id;
             // unitData.users could be object or array depending on join, safely cast
             const userData = unitData.users as any;
             residentName = userData?.name || 'Resident';
             displayFlat = unitData.block ? `${unitData.block}-${unitData.flat_number}` : unitData.flat_number;
             status = VisitorStatus.PendingApproval;
        } else {
            // Fallback to USERS table (Legacy/Standalone)
             const { data: legacyUser } = await supabase
                .from('users')
                .select('id, name, flat_number')
                .eq('community_id', user.communityId)
                .eq('flat_number', flatInput)
                .limit(1)
                .maybeSingle();
            
            if (!legacyUser) throw new Error(`No resident found for flat ${visitorData.targetFlat}`);
            
            targetUserId = legacyUser.id;
            residentName = legacyUser.name;
            displayFlat = legacyUser.flat_number;
            status = VisitorStatus.PendingApproval;
        }
    }

    const newVisitor = {
        name: visitorData.name,
        purpose: visitorData.purpose,
        expected_at: visitorData.expectedAt,
        status: status,
        resident_name: residentName,
        flat_number: displayFlat,
        user_id: targetUserId,
        community_id: user.communityId,
    };

    const { data, error } = await supabase.from('visitors').insert(newVisitor).select().single();
    if (error) throw error;
    
    return {
        id: data.id,
        name: data.name,
        purpose: data.purpose,
        expectedAt: data.expected_at,
        status: data.status,
        residentName: data.resident_name,
        flatNumber: data.flat_number,
        communityId: data.community_id,
        userId: data.user_id
    } as Visitor;
};

export const updateVisitorStatus = async (visitorId: string, status: VisitorStatus): Promise<void> => {
    const { error } = await supabase.from('visitors').update({ status }).eq('id', visitorId);
    if (error) throw error;
};

export const createBooking = async (bookingData: { amenityId: string; startTime: string; endTime: string; }, user: User): Promise<Booking> => {
     const displayFlat = user.units && user.units.length > 0 ? user.units[0].flatNumber : (user.flatNumber || 'N/A');
    const newBooking = {
        amenity_id: bookingData.amenityId,
        start_time: bookingData.startTime,
        end_time: bookingData.endTime,
        resident_name: user.name,
        flat_number: displayFlat,
        user_id: user.id,
        community_id: user.communityId,
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

export const deleteBooking = async (bookingId: string): Promise<void> => {
    const { error } = await supabase.from('bookings').delete().eq('id', bookingId);
    if (error) throw error;
}

export const createAmenity = async (amenityData: { name: string; description: string; imageUrl: string; capacity: number; maxDuration?: number }, user: User): Promise<Amenity> => {
    const newAmenity = {
        name: amenityData.name,
        description: amenityData.description,
        image_url: amenityData.imageUrl,
        capacity: amenityData.capacity,
        community_id: user.communityId,
        max_duration: amenityData.maxDuration || 0,
        status: 'Active'
    };
    const { data, error } = await supabase.from('amenities').insert(newAmenity).select().single();
    if (error) throw error;
    
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
    // Map camelCase to snake_case for DB
    const dbUpdates: any = {};
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.name) dbUpdates.name = updates.name;
    // Add other fields as needed

    const { error } = await supabase.from('amenities').update(dbUpdates).eq('id', id);
    if (error) throw error;
}

export const deleteAmenity = async (id: string): Promise<void> => {
    const { error } = await supabase.from('amenities').delete().eq('id', id);
    if (error) throw error;
}

export const updateNotice = async (id: string, updates: Partial<Notice>): Promise<Notice> => {
    const dbUpdates: any = {};
    if (updates.title) dbUpdates.title = updates.title;
    if (updates.content) dbUpdates.content = updates.content;
    if (updates.type) dbUpdates.type = updates.type;
    if (updates.validFrom) dbUpdates.valid_from = updates.validFrom;
    // Explicitly allow setting valid_until to null if needed, but for now strict type mapping
    if (updates.validUntil !== undefined) dbUpdates.valid_until = updates.validUntil;

    const { data, error } = await supabase.from('notices').update(dbUpdates).eq('id', id).select().single();
    if (error) throw error;

    return {
        id: data.id,
        title: data.title,
        content: data.content,
        author: data.author,
        createdAt: data.created_at,
        type: data.type,
        communityId: data.community_id,
        validFrom: data.valid_from,
        validUntil: data.valid_until
    } as Notice;
};

export const deleteNotice = async (id: string): Promise<void> => {
    const { error } = await supabase.from('notices').delete().eq('id', id);
    if (error) throw error;
};

export const createExpense = async (
    expenseData: { title: string; amount: number; category: ExpenseCategory; description: string; date: string; receiptUrl?: string },
    user: User
): Promise<Expense> => {
    const newExpense = {
        title: expenseData.title,
        amount: expenseData.amount,
        category: expenseData.category,
        description: expenseData.description,
        date: expenseData.date,
        receipt_url: expenseData.receiptUrl,
        submitted_by: user.id,
        community_id: user.communityId,
        status: ExpenseStatus.Pending
    };

    const { data, error } = await supabase.from('expenses').insert(newExpense).select().single();
    if (error) throw error;

    return {
        id: data.id,
        title: data.title,
        amount: data.amount,
        category: data.category,
        description: data.description,
        date: data.date,
        submittedBy: data.submitted_by,
        submittedByName: user.name, // Local optimisation
        status: data.status,
        communityId: data.community_id,
        createdAt: data.created_at,
        receiptUrl: data.receipt_url
    } as Expense;
}

// UPDATE operations
export const updateComplaintStatus = async (id: string, status: ComplaintStatus): Promise<Complaint> => {
    const { data, error } = await supabase.from('complaints').update({ status }).eq('id', id).select('*, assigned_user:users!assigned_to(name)').single();
    if (error) throw error;
    
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
    const { error } = await supabase
        .from('complaints')
        .update({ assigned_to: agentId })
        .eq('id', complaintId);

    if (error) throw error;
};

export const updateMaintenanceStartDate = async (userId: string, date: string, unitId?: string): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("No active session");

    const { data: user, error: userError } = await supabase
        .from('users')
        .select('community_id')
        .eq('id', userId)
        .single();

    if (userError || !user) throw new Error("User not found");

    const response = await fetch('https://vnfmtbkhptkntaqzfdcx.supabase.co/functions/v1/update-maintenance-date', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': supabaseKey
        },
        body: JSON.stringify({ 
            user_id: userId, 
            maintenance_start_date: date,
            community_id: user.community_id,
            unit_id: unitId 
        })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update maintenance date');
    }
};

export const submitMaintenancePayment = async (recordId: string, receiptUrl: string, upiId: string, transactionDate: string): Promise<void> => {
    const { error } = await supabase
        .from('maintenance_records')
        .update({
            payment_receipt_url: receiptUrl,
            upi_transaction_id: upiId,
            transaction_date: transactionDate,
            status: 'Submitted'
        })
        .eq('id', recordId);

    if (error) throw error;
}

export const verifyMaintenancePayment = async (recordId: string): Promise<void> => {
    const { error } = await supabase
        .from('maintenance_records')
        .update({
            status: 'Paid'
        })
        .eq('id', recordId);

    if (error) throw error;
}

export const approveExpense = async (expenseId: string, userId: string): Promise<void> => {
    const { error } = await supabase
        .from('expenses')
        .update({
            status: ExpenseStatus.Approved,
            approved_by: userId
        })
        .eq('id', expenseId);

    if (error) throw error;
}

export const rejectExpense = async (expenseId: string, userId: string, reason: string): Promise<void> => {
    // 1. Fetch current description to append the reason (safest approach without schema migration)
    const { data: currentData, error: fetchError } = await supabase
        .from('expenses')
        .select('description')
        .eq('id', expenseId)
        .single();
    
    if (fetchError) throw fetchError;

    // 2. Append Reason
    const updatedDescription = currentData.description 
        ? `${currentData.description}\n\n[REJECTION REASON]: ${reason}` 
        : `[REJECTION REASON]: ${reason}`;

    // 3. Update Status and Description
    const { error } = await supabase
        .from('expenses')
        .update({
            status: ExpenseStatus.Rejected,
            approved_by: userId,
            description: updatedDescription
        })
        .eq('id', expenseId);

    if (error) throw error;
}


// =================================================================
// SUPER ADMIN API
// =================================================================

export const getCommunityStats = async (): Promise<CommunityStat[]> => {
    const { data: communities, error } = await supabase
        .from('communities')
        .select('*')
        .order('name');
    
    if (error) throw error;

    const stats: CommunityStat[] = [];
    for (const c of communities) {
        const { count } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('community_id', c.id)
            .eq('role', 'Resident');
            
        stats.push({
            id: c.id,
            name: c.name,
            address: c.address,
            status: c.status,
            communityType: c.community_type,
            blocks: c.blocks,
            maintenanceRate: c.maintenance_rate,
            fixedMaintenanceAmount: c.fixed_maintenance_amount,
            resident_count: count || 0,
            income_generated: 0
        });
    }
    return stats;
};

export const createCommunity = async (communityData: Partial<Community>): Promise<Community> => {
    const { data, error } = await supabase.from('communities').insert({
        name: communityData.name,
        address: communityData.address,
        community_type: communityData.communityType,
        blocks: communityData.blocks,
        maintenance_rate: communityData.maintenanceRate,
        fixed_maintenance_amount: communityData.fixedMaintenanceAmount,
        status: 'active'
    }).select().single();

    if (error) throw error;
    
    return {
        id: data.id,
        name: data.name,
        address: data.address,
        status: data.status,
        communityType: data.community_type,
        blocks: data.blocks,
        maintenanceRate: data.maintenance_rate,
        fixedMaintenanceAmount: data.fixed_maintenance_amount
    } as Community;
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

    const { data, error } = await supabase.from('communities').update(dbUpdates).eq('id', id).select().single();
    if (error) throw error;

    return {
        id: data.id,
        name: data.name,
        address: data.address,
        status: data.status,
        communityType: data.community_type,
        blocks: data.blocks,
        maintenanceRate: data.maintenance_rate,
        fixedMaintenanceAmount: data.fixed_maintenance_amount
    } as Community;
};

export const deleteCommunity = async (id: string): Promise<void> => {
    const { error } = await supabase.from('communities').delete().eq('id', id);
    if (error) throw error;
};

export const createAdminUser = async (payload: any): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("No active session");

    const response = await fetch('https://vnfmtbkhptkntaqzfdcx.supabase.co/functions/v1/create-admin-user', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': supabaseKey
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create admin user');
    }
};

export const createCommunityUser = async (payload: any): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("No active session");

    const response = await fetch('https://vnfmtbkhptkntaqzfdcx.supabase.co/functions/v1/create-community-user', {
        method: 'POST',
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
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': supabaseKey
        },
        body: JSON.stringify({ password })
    });

    if (!response.ok) {
         const err = await response.json();
        throw new Error(err.error || 'Failed to update password');
    }
};

export const requestPasswordReset = async (email: string): Promise<void> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password',
    });
    if (error) throw error;
};
