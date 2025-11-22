
import { supabase, supabaseKey } from './supabase';
import { Notice, Complaint, Visitor, Amenity, Booking, User, ComplaintCategory, ComplaintStatus, CommunityStat, Community, UserRole, CommunityType, Block, MaintenanceRecord, MaintenanceStatus, Unit } from '../types';

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
        communityId: n.community_id
    })) as Notice[];
};

export const getComplaints = async (communityId: string): Promise<Complaint[]> => {
    // We use a join to get the name of the person assigned to the ticket
    const { data, error } = await supabase
        .from('complaints')
        .select('*, assigned_user:users!assigned_to(name)')
        .eq('community_id', communityId)
        .order('created_at', { ascending: false });
        
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
        communityId: v.community_id
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
        communityId: a.community_id
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
        role: u.role as UserRole,
        communityId: u.community_id,
        status: u.status,
        units: mappedUnits,
        maintenanceStartDate: u.maintenance_start_date // Legacy
    } as User;
};

export const getResidents = async (communityId: string): Promise<User[]> => {
    // ROBUST STRATEGY: Decoupled Fetching
    // 1. Fetch Users (Guaranteed to exist)
    // 2. Fetch Units (Might fail if table missing, but shouldn't crash app)
    // 3. Combine in memory
    
    // Step 1: Fetch Users
    const { data: users, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('community_id', communityId)
        .order('created_at', { ascending: true });
    
    if (userError) throw userError;
    if (!users) return [];

    // Step 2: Fetch Units (Best Effort)
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
    return users.map(user => mapUserFromDB(user, allUnits));
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
             // Fallback to what might be on the user record? 
             // Since we didn't fetch user.flat_number in the join above, we might miss it if unit_id is null.
             // But for new system, unit_id should exist.
             displayFlat = 'Unit Not Found';
        }
        
        // IMPORTANT: If the user record has a flat_number (legacy), we could try to use it, 
        // but accessing r.user.flat_number requires updating the join above. 
        // For now, we rely on unit_id or basic fallback.

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


// CREATE operations
export const createNotice = async (noticeData: { title: string; content: string; type: Notice['type']; author: string; }, user: User): Promise<Notice> => {
    const newNotice = {
        title: noticeData.title,
        content: noticeData.content,
        type: noticeData.type,
        author: noticeData.author,
        community_id: user.communityId,
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
        communityId: data.community_id
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

export const createVisitor = async (visitorData: { name: string; purpose: string; expectedAt: string }, user: User): Promise<Visitor> => {
     const displayFlat = user.units && user.units.length > 0 ? user.units[0].flatNumber : (user.flatNumber || 'N/A');

    const newVisitor = {
        name: visitorData.name,
        purpose: visitorData.purpose,
        expected_at: visitorData.expectedAt,
        status: 'Expected',
        resident_name: user.name,
        flat_number: displayFlat,
        user_id: user.id,
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
        communityId: data.community_id
    } as Visitor;
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

export const createAmenity = async (amenityData: { name: string; description: string; imageUrl: string; capacity: number; }, user: User): Promise<Amenity> => {
    const newAmenity = {
        name: amenityData.name,
        description: amenityData.description,
        image_url: amenityData.imageUrl,
        capacity: amenityData.capacity,
        community_id: user.communityId,
    };
    const { data, error } = await supabase.from('amenities').insert(newAmenity).select().single();
    if (error) throw error;
    
    return {
        id: data.id,
        name: data.name,
        description: data.description,
        imageUrl: data.image_url,
        capacity: data.capacity,
        communityId: data.community_id
    } as Amenity;
};

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

export const createCommunity = async (data: Partial<Community>): Promise<Community> => {
    const { data: newCommunity, error } = await supabase.from('communities').insert({
        name: data.name,
        address: data.address,
        community_type: data.communityType,
        blocks: data.blocks,
        maintenance_rate: data.maintenanceRate,
        fixed_maintenance_amount: data.fixedMaintenanceAmount,
        status: 'active'
    }).select().single();
    
    if (error) throw error;
    
    return {
        ...newCommunity,
        communityType: newCommunity.community_type,
        maintenanceRate: newCommunity.maintenance_rate,
        fixedMaintenanceAmount: newCommunity.fixed_maintenance_amount
    };
};

export const updateCommunity = async (id: string, data: Partial<Community>): Promise<Community> => {
    const { data: updated, error } = await supabase.from('communities').update({
        name: data.name,
        address: data.address,
        community_type: data.communityType,
        blocks: data.blocks,
        maintenance_rate: data.maintenanceRate,
        fixed_maintenance_amount: data.fixedMaintenanceAmount
    }).eq('id', id).select().single();
    
    if (error) throw error;
    return {
        ...updated,
        communityType: updated.community_type,
        maintenanceRate: updated.maintenance_rate,
        fixedMaintenanceAmount: updated.fixed_maintenance_amount
    };
};

export const deleteCommunity = async (id: string): Promise<void> => {
    const { error } = await supabase.from('communities').delete().eq('id', id);
    if (error) throw error;
};


// EDGE FUNCTIONS

export const createAdminUser = async (userData: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("No active session");

    const response = await fetch('https://vnfmtbkhptkntaqzfdcx.supabase.co/functions/v1/create-admin-user', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': supabaseKey
        },
        body: JSON.stringify(userData)
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create admin');
    }
    return response.json();
};

export const createCommunityUser = async (userData: {
    name: string;
    email: string;
    password: string;
    community_id: string;
    role: string;
    units?: Array<{
        flat_number: string;
        block?: string;
        floor?: number;
        flat_size?: number;
        maintenance_start_date?: string;
    }>;
    flat_number?: string;
}) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("No active session");

    const response = await fetch('https://vnfmtbkhptkntaqzfdcx.supabase.co/functions/v1/create-community-user', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': supabaseKey
        },
        body: JSON.stringify(userData)
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create user');
    }
    return response.json();
};

export const updateUserPassword = async (password: string): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("No active session. Please log in again.");

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
        redirectTo: window.location.origin,
    });
    if (error) throw error;
};
