
export enum UserRole {
  SuperAdmin = 'SuperAdmin',
  Admin = 'Admin',
  Resident = 'Resident',
  Security = 'Security',
  HelpdeskAdmin = 'HelpdeskAdmin', // Previously Helpdesk, Acts as Helpdesk Admin
  HelpdeskAgent = 'HelpdeskAgent', // Acts as Worker
  SecurityAdmin = 'SecurityAdmin', // Manages Security Guards
}

export interface Block {
    name: string;
    floorCount: number;
    unitsPerFloor?: number; // For Standalone metadata
}

export type CommunityType = 'High-Rise Apartment' | 'Standalone Apartment' | 'Gated Community Villa' | 'Standalone' | 'Gated';

export interface CommunityContact {
    name: string;
    email: string;
    primaryPhone: string;
    secondaryPhone?: string;
}

export interface CommunityPricing {
    resident: number;
    admin: number;
    staff: number;
}

export interface Community {
  id: string;
  name: string;
  address: string;
  status: 'active' | 'disabled';
  communityType?: CommunityType;
  blocks?: Block[];
  maintenanceRate?: number; // Legacy/Current Snapshot
  fixedMaintenanceAmount?: number; // Legacy/Current Snapshot
  
  // New Fields
  contacts?: CommunityContact[];
  subscriptionType?: 'Monthly' | 'Yearly';
  subscriptionStartDate?: string;
  pricePerUser?: CommunityPricing;
}

export interface MaintenanceConfiguration {
    id: string;
    communityId: string;
    maintenanceRate: number;
    fixedMaintenanceAmount: number;
    effectiveDate: string;
    createdAt: string;
}

export interface CommunityStat extends Community {
    resident_count: number;
    admin_count: number;
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
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  // Legacy fields for backward compatibility or Staff location
  flatNumber?: string; 
  role: UserRole;
  communityId?: string;
  communityName?: string; // Display name of the community
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
  validFrom?: string;
  validUntil?: string;
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
    PendingApproval = 'Pending Approval', // Created by Security, waiting for Resident
    Expected = 'Expected', // Created by Resident OR Approved by Resident
    Arrived = 'Arrived',
    Departed = 'Departed',
    Denied = 'Denied' // Rejected by Resident
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
  userId?: string; // ID of the resident being visited
}

export interface Amenity {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  capacity: number;
  communityId: string;
  maxDuration?: number; // Max duration in hours (0 or null = unlimited)
  status?: 'Active' | 'Maintenance'; // Maintenance = Disabled
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

export enum ExpenseCategory {
    Electricity = 'Electricity',
    Water = 'Water',
    Fuel = 'Fuel',
    Salary = 'Salary',
    Maintenance = 'Maintenance',
    Other = 'Other'
}

export enum ExpenseStatus {
    Pending = 'Pending',
    Approved = 'Approved',
    Rejected = 'Rejected'
}

export interface Expense {
    id: string;
    title: string;
    amount: number;
    category: ExpenseCategory;
    description: string;
    date: string;
    submittedBy: string; // User ID
    submittedByName?: string;
    status: ExpenseStatus;
    approvedBy?: string; // User ID
    approvedByName?: string;
    communityId: string;
    createdAt: string;
    receiptUrl?: string;
}

// --- Audit Log Interfaces ---

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

export interface AuditLog {
    id: string;
    createdAt: string;
    communityId: string;
    actorId: string;
    actorName?: string; // Joined
    actorRole?: string; // Joined
    entity: string; // e.g. 'Complaint', 'Visitor'
    entityId: string;
    action: AuditAction;
    details: {
        old?: any;
        new?: any;
        description?: string;
    };
}

export type Page = 'Dashboard' | 'Notices' | 'Help Desk' | 'Visitors' | 'Amenities' | 'Directory' | 'Maintenance' | 'Expenses' | 'CommunitySetup';
