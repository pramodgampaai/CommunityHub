
export enum UserRole {
  SuperAdmin = 'SuperAdmin',
  Admin = 'Admin',
  Resident = 'Resident',
  Security = 'Security',
  Helpdesk = 'Helpdesk', // Acts as Helpdesk Admin
  HelpdeskAgent = 'HelpdeskAgent', // Acts as Worker
}

export interface Block {
    name: string;
    floorCount: number;
}

export type CommunityType = 'Standalone' | 'Gated';

export interface Community {
  id: string;
  name: string;
  address: string;
  status: 'active' | 'disabled';
  communityType?: CommunityType;
  blocks?: Block[];
  maintenanceRate?: number; // For Gated: per sq ft
  fixedMaintenanceAmount?: number; // For Standalone: fixed monthly
}

export interface CommunityStat extends Community {
    resident_count: number;
    income_generated: number;
}

export interface Unit {
    id: string;
    userId: string;
    communityId: string;
    flatNumber: string;
    block?: string;
    floor?: number;
    flatSize?: number;
    maintenanceStartDate?: string;
}

export interface User {
  id:string;
  name: string;
  email: string;
  avatarUrl: string;
  // Legacy fields for backward compatibility or Staff location
  flatNumber?: string; 
  role: UserRole;
  communityId?: string;
  status: 'active' | 'disabled';
  units?: Unit[]; // One-to-Many relationship
  maintenanceStartDate?: string; // Legacy field
}

export enum NoticeType {
  Event = 'Event',
  Maintenance = 'Maintenance',
  Urgent = 'Urgent',
  General = 'General',
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  author: string;
  createdAt: string;
  type: NoticeType;
  communityId: string;
}

export enum ComplaintStatus {
  Pending = 'Pending',
  InProgress = 'In Progress',
  Resolved = 'Resolved',
}

export enum ComplaintCategory {
    Plumbing = 'Plumbing',
    Electrical = 'Electrical',
    Security = 'Security',
    Other = 'Other',
    Housekeeping = 'Housekeeping',
}

export interface Complaint {
  id: string;
  title: string;
  description: string;
  residentName: string;
  flatNumber: string;
  status: ComplaintStatus;
  createdAt: string;
  category: ComplaintCategory;
  userId: string;
  communityId: string;
  assignedTo?: string; // User ID of the agent
  assignedToName?: string; // Name of the agent (for display)
}

export enum VisitorStatus {
    Expected = 'Expected',
    Arrived = 'Arrived',
    Departed = 'Departed',
}

export interface Visitor {
  id: string;
  name: string;
  purpose: string;
  expectedAt: string;
  status: VisitorStatus;
  residentName: string;
  flatNumber: string;
  communityId: string;
}

export interface Amenity {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  capacity: number;
  communityId: string;
}

export interface Booking {
  id: string;
  amenityId: string;
  residentName: string;
  flatNumber: string;
  startTime: string;
  endTime: string;
  communityId: string;
}

export enum MaintenanceStatus {
    Pending = 'Pending',
    Submitted = 'Submitted',
    Paid = 'Paid'
}

export interface MaintenanceRecord {
    id: string;
    userId: string;
    unitId?: string; // Linked to specific unit
    communityId: string;
    amount: number;
    periodDate: string; // The 1st of the month
    status: MaintenanceStatus;
    paymentReceiptUrl?: string;
    upiTransactionId?: string;
    transactionDate?: string;
    createdAt: string;
    // Joins
    userName?: string;
    flatNumber?: string; // Display flat number
}

export type Page = 'Dashboard' | 'Notices' | 'Help Desk' | 'Visitors' | 'Amenities' | 'Directory' | 'Maintenance';
