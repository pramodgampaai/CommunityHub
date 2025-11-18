import { supabase } from './supabase';
import { Notice, Complaint, Visitor, Amenity, Booking, User, ComplaintCategory, ComplaintStatus } from '../types';

// READ operations
export const getNotices = async (): Promise<Notice[]> => {
    const { data, error } = await supabase.from('notices').select('*').order('createdAt', { ascending: false });
    if (error) throw error;
    return data;
};

export const getComplaints = async (): Promise<Complaint[]> => {
    const { data, error } = await supabase.from('complaints').select('*').order('createdAt', { ascending: false });
    if (error) throw error;
    return data;
};

export const getVisitors = async (): Promise<Visitor[]> => {
    const { data, error } = await supabase.from('visitors').select('*').order('expectedAt', { ascending: false });
    if (error) throw error;
    return data;
};

export const getAmenities = async (): Promise<Amenity[]> => {
    const { data, error } = await supabase.from('amenities').select('*').order('name');
    if (error) throw error;
    return data;
};

export const getBookings = async (): Promise<Booking[]> => {
    const { data, error } = await supabase.from('bookings').select('*');
    if (error) throw error;
    return data;
};

// CREATE operations
export const createNotice = async (noticeData: { title: string; content: string; type: Notice['type']; author: string; }): Promise<Notice> => {
    const { data, error } = await supabase.from('notices').insert(noticeData).select();
    if (error) throw error;
    return data[0];
};

export const createComplaint = async (complaintData: { title: string; description: string; category: ComplaintCategory; }, user: User): Promise<Complaint> => {
    const newComplaint = {
        ...complaintData,
        residentName: user.name,
        flatNumber: user.flatNumber,
        status: 'Pending',
        user_id: user.id,
    };
    const { data, error } = await supabase.from('complaints').insert(newComplaint).select();
    if (error) throw error;
    return data[0];
};

export const createVisitor = async (visitorData: { name: string; purpose: string; expectedAt: string; }, user: User): Promise<Visitor> => {
     const newVisitor = {
        ...visitorData,
        residentName: user.name,
        flatNumber: user.flatNumber,
        status: 'Expected',
    };
    const { data, error } = await supabase.from('visitors').insert(newVisitor).select();
    if (error) throw error;
    return data[0];
};

export const createBooking = async (bookingData: { amenityId: string; startTime: string; endTime: string; }, user: User): Promise<Booking> => {
    const newBooking = {
        ...bookingData,
        residentName: user.name,
        flatNumber: user.flatNumber,
    };
    const { data, error } = await supabase.from('bookings').insert(newBooking).select();
    if (error) throw error;
    return data[0];
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
    return data;
};
