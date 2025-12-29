
export enum UserRole {
  SuperAdmin = 'SuperAdmin',
  Admin = 'Admin',
  Resident = 'Resident',
  Security = 'Security',
  HelpdeskAdmin = 'HelpdeskAdmin', // Previously Helpdesk, Acts as Helpdesk Admin
  HelpdeskAgent = 'HelpdeskAgent', // Acts as Worker
  SecurityAdmin = 'SecurityAdmin', // Manages Security Guards
  Tenant = 'Tenant', // New Role
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
    helpdesk_count: number;
    security_count: number;
    staff_count: number; // Aggregate of all staff roles for billing
    income_generated: number;
    current_month_paid?: number; // New field for billing status
}

export interface FinancialHistory {
    year: number;
    totalCollected: number;
    monthlyBreakdown: { month: string; amount: number; transactionCount: number }[];
    communityBreakdown: { communityName: string; totalPaid: number }[];
}

export interface Unit {
    id: string;
    userId: string;
    communityId: string;
    flatNumber: string;
    block?: string;
    floor?: number;
    // Fix: Changed flat_size to flatSize to resolve property missing errors in components
    flatSize?: number;
    // Fix: Changed maintenance_start_date to maintenanceStartDate to resolve property missing errors in components
    maintenanceStartDate?: string;
}

export interface TenantProfile {
    aadharNumber: string;
    panNumber: string;
    aadharUrl?: string; // Base64 or URL
    panUrl?: string;    // Base64 or URL
    workInfo: {
        companyName: string;
        designation: string;
        officeAddress?: string;
    };
    maritalStatus: 'Single' | 'Married';
    spouseName?: string;
    kidsCount?: number;
    kidsDetails?: string; // Simple text summary for now
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
  theme?: 'light' | 'dark';
  tenantDetails?: TenantProfile; // Optional profile data for tenants
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
  OnHold = 'On Hold',
  Completed = 'Completed',
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
    CheckedIn = 'Checked In', // Inside premises
    CheckedOut = 'Checked Out', // Left premises
    Denied = 'Denied', // Rejected by Resident or Security
    Expired = 'Expired' // Did not arrive on time
}

export enum VisitorType {
    Guest = 'Guest',
    Delivery = 'Delivery',
    Cab = 'Cab',
    Service = 'Service'
}

export interface Visitor {
  id: string;
  name: string;
  visitorType: VisitorType;
  vehicleNumber?: string;
  purpose: string; // Optional if type is specific
  status: VisitorStatus;
  
  // Timing
  expectedAt: string; // ISO String
  validUntil?: string; // ISO String - Entry expiry
  entryTime?: string; // ISO String
  exitTime?: string; // ISO String
  
  // Security
  entryToken?: string; // Secure random string for QR Code
  
  // Relations
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
    actorId: string;
    communityId: string;
    actorName?: string; // Joined
    actorRole?: string; // Joined
    entity: string; // e.g. 'Complaint', 'Visitor'
    entityId: string;
    action: AuditAction;
    details: {
        old?: any;
        new?: any;
        description?: string;
        amount?: number; // For fallback payments
        data?: any;
    };
}

export type Page = 'Dashboard' | 'AdminPanel' | 'Notices' | 'Help Desk' | 'Visitors' | 'Amenities' | 'Directory' | 'Maintenance' | 'Expenses' | 'CommunitySetup' | 'Billing' | 'BulkOperations';
