
import { supabase, supabaseKey } from './supabase';
import { Notice, Complaint, Visitor, Amenity, Booking, User, ComplaintCategory, ComplaintStatus, CommunityStat, Community, UserRole } from '../types';

// =================================================================
// USER / ADMIN / RESIDENT-FACING API
// =================================================================

// READ operations
export const getNotices = async (communityId: string): Promise<Notice[]> => {
    const { data, error } = await supabase.from('notices').select('*').eq('community_id', communityId).order('created_at', { ascending: false });
    if (error) throw error;
    return data as Notice[];
};

export const getComplaints = async (communityId: string): Promise<Complaint[]> => {
    const { data, error } = await supabase.from('complaints').select('*').eq('community_id', communityId).order('created_at', { ascending: false });
    if (error) throw error;
    return data as Complaint[];
};

export const getVisitors = async (communityId: string): Promise<Visitor[]> => {
    const { data, error } = await supabase.from('visitors').select('*').eq('community_id', communityId).order('expected_at', { ascending: false });
    if (error) throw error;
    return data as Visitor[];
};

export const getAmenities = async (communityId: string): Promise<Amenity[]> => {
    const { data, error } = await supabase.from('amenities').select('*').eq('community_id', communityId).order('name');
    if (error) throw error;
    return data as Amenity[];
};

export const getBookings = async (communityId: string): Promise<Booking[]> => {
    const { data, error } = await supabase.from('bookings').select('*').eq('community_id', communityId);
    if (error) throw error;
    return data as Booking[];
};

export const getResidents = async (communityId: string): Promise<User[]> => {
    // Fetch all users belonging to the community
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('community_id', communityId)
        .order('flat_number', { ascending: true });
    
    if (error) throw error;
    
    // Map database columns to User interface
    return data.map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        avatarUrl: u.avatar_url,
        flatNumber: u.flat_number,
        role: u.role as UserRole,
        communityId: u.community_id,
        status: u.status
    })) as User[];
};

// CREATE operations
export const createNotice = async (noticeData: { title: string; content: string; type: Notice['type']; author: string; }, user: User): Promise<Notice> => {
    const newNotice = {
        ...noticeData,
        community_id: user.communityId,
    };
    const { data, error } = await supabase.from('notices').insert(newNotice).select().single();
    if (error) throw error;
    return data as Notice;
};

export const createComplaint = async (complaintData: { title: string; description: string; category: ComplaintCategory; }, user: User): Promise<Complaint> => {
    const newComplaint = {
        ...complaintData,
        residentName: user.name,
        flatNumber: user.flatNumber,
        status: 'Pending',
        user_id: user.id,
        community_id: user.communityId,
    };
    const { data, error } = await supabase.from('complaints').insert(newComplaint).select().single();
    if (error) throw error;
    return data as Complaint;
};

export const createVisitor = async (visitorData: { name: string; purpose: string; expectedAt: string; }, user: User): Promise<Visitor> => {
     const newVisitor = {
        name: visitorData.name,
        purpose: visitorData.purpose,
        expected_at: visitorData.expectedAt,
        residentName: user.name,
        flatNumber: user.flatNumber,
        status: 'Expected',
        user_id: user.id,
        community_id: user.communityId,
    };
    const { data, error } = await supabase.from('visitors').insert(newVisitor).select().single();
    if (error) throw error;
    return data as Visitor;
};

export const createBooking = async (bookingData: { amenityId: string; startTime: string; endTime: string; }, user: User): Promise<Booking> => {
    const newBooking = {
        amenity_id: bookingData.amenityId,
        start_time: bookingData.startTime,
        end_time: bookingData.endTime,
        user_id: user.id,
        residentName: user.name,
        flatNumber: user.flatNumber,
        community_id: user.communityId,
    };
    const { data, error } = await supabase.from('bookings').insert(newBooking).select().single();
    if (error) throw error;
    return data as Booking;
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
    return data as Amenity;
};


// UPDATE operations
export const updateComplaintStatus = async (id: string, status: ComplaintStatus): Promise<Complaint> => {
    const { data, error } = await supabase
        .from('complaints')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data as Complaint;
};

export const updateUserPassword = async (password: string): Promise<void> => {
    // 1. Verify Session locally first
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
        throw new Error("No active session. Please log in again.");
    }

    // 2. Call Edge Function to handle the update.
    // This decouples the update logic from the client-side session state, preventing infinite loops.
    const response = await fetch('https://vnfmtbkhptkntaqzfdcx.supabase.co/functions/v1/update-user-password', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': supabaseKey
        },
        body: JSON.stringify({ password })
    });

    const data = await response.json();

    if (!response.ok) {
        const message = data.error || data.message || "Failed to update password";
        throw new Error(message);
    }
};

export const requestPasswordReset = async (email: string): Promise<void> => {
    // redirectTo should point to the app URL. In development localhost, in prod the hosted URL.
    // window.location.origin works well for SPAs.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
    });
    if (error) throw error;
};


// =================================================================
// SUPER ADMIN API
// =================================================================

export const getCommunityStats = async (): Promise<CommunityStat[]> => {
    const { data, error } = await supabase.from('community_stats').select('*');
    if (error) throw error;
    return data as CommunityStat[];
};

export const createCommunity = async (communityData: { name: string, address: string }): Promise<Community> => {
    const { data, error } = await supabase.from('communities').insert(communityData).select().single();
    if (error) throw error;
    return data as Community;
};

export const updateCommunity = async (id: string, updates: Partial<Community>): Promise<Community> => {
    const { data, error } = await supabase.from('communities').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data as Community;
};

export const deleteCommunity = async (id: string): Promise<void> => {
    const { error } = await supabase.from('communities').delete().eq('id', id);
    if (error) throw error;
};

/**
 * Securely creates a new Admin user for a specific community.
 */
export const createAdminUser = async (adminData: { name: string, email: string, password: string, community_id: string }) => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch('https://vnfmtbkhptkntaqzfdcx.supabase.co/functions/v1/create-admin-user', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': supabaseKey
        },
        body: JSON.stringify(adminData)
    });

    const data = await response.json();

    if (!response.ok) {
        const message = data.error || data.message || "Failed to create admin user";
        throw new Error(message);
    }

    return data;
};

/**
 * Securely creates a new Resident/Security user for a community.
 */
export const createCommunityUser = async (userData: { name: string, email: string, password: string, community_id: string, role: UserRole, flat_number?: string }) => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch('https://vnfmtbkhptkntaqzfdcx.supabase.co/functions/v1/create-community-user', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': supabaseKey
        },
        body: JSON.stringify(userData)
    });

    const data = await response.json();

    if (!response.ok) {
        const message = data.error || data.message || "Failed to create user";
        throw new Error(message);
    }

    return data;
};
