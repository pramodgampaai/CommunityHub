
export enum UserRole {
  SuperAdmin = 'SuperAdmin',
  Admin = 'Admin',
  Resident = 'Resident',
  Security = 'Security',
  HelpdeskAdmin = 'HelpdeskAdmin',
  HelpdeskAgent = 'HelpdeskAgent',
  SecurityAdmin = 'SecurityAdmin',
  Tenant = 'Tenant',
}

export interface Block {
    name: string;
    floorCount: number;
    unitsPerFloor?: number;
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

export interface PendingBalanceUpdate {
    amount: number;
    reason: string;
    requesterId: string;
    requesterName: string;
}

export interface Community {
  id: string;
  name: string;
  address: string;
  status: 'active' | 'disabled';
  communityType?: CommunityType;
  blocks?: Block[];
  maintenanceRate?: number;
  fixedMaintenanceAmount?: number;
  
  // opening balance logic
  openingBalance?: number;
  openingBalanceLocked?: boolean;
  pendingBalanceUpdate?: PendingBalanceUpdate | null;

  contacts?: CommunityContact[];
  subscriptionType?: 'Monthly' | 'Yearly';
  subscriptionStartDate?: string;
  pricePerUser?: CommunityPricing;
}

export interface CommunityStat extends Community {
    resident_count: number;
    admin_count: number;
    helpdesk_count: number;
    security_count: number;
    staff_count: number;
    income_generated: number;
    current_month_paid?: number;
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

// Added TenantProfile interface to fix errors in Directory.tsx
export interface TenantProfile {
    aadharNumber: string;
    panNumber: string;
    aadharUrl?: string;
    panUrl?: string;
    maritalStatus: 'Single' | 'Married';
    spouseName?: string;
    kidsCount: number;
    workInfo: {
        companyName: string;
        designation?: string;
        officeAddress?: string;
    };
    is_tenant?: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  flatNumber?: string; 
  role: UserRole;
  communityId?: string;
  communityName?: string;
  status: 'active' | 'disabled';
  units?: Unit[];
  theme?: 'light' | 'dark';
  // Added tenantDetails and profile_data to fix errors in Directory.tsx and useAuth.tsx
  tenantDetails?: TenantProfile;
  profile_data?: any;
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
  // Added optional validFrom and validUntil to fix errors in NoticeBoard.tsx
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
  assignedTo?: string;
  assignedToName?: string;
}

export enum VisitorStatus {
    PendingApproval = 'Pending Approval',
    Expected = 'Expected',
    CheckedIn = 'Checked In',
    CheckedOut = 'Checked Out',
    Denied = 'Denied',
    Expired = 'Expired'
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
  purpose: string;
  status: VisitorStatus;
  expectedAt: string;
  validUntil?: string;
  entryTime?: string;
  exitTime?: string;
  entryToken?: string;
  residentName: string;
  flatNumber: string;
  communityId: string;
  userId?: string;
}

export interface Amenity {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  capacity: number;
  communityId: string;
  maxDuration?: number;
  status?: 'Active' | 'Maintenance';
}

export enum AssetStatus {
    Active = 'Active',
    UnderRepair = 'Under Repair',
    Scrapped = 'Scrapped'
}

export interface Asset {
    id: string;
    name: string;
    description: string;
    category: string;
    quantity: number;
    status: AssetStatus;
    purchaseDate?: string;
    warrantyExpiry?: string;
    nextServiceDate?: string;
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
    unitId?: string;
    communityId: string;
    amount: number;
    periodDate: string;
    status: MaintenanceStatus;
    paymentReceiptUrl?: string;
    upiTransactionId?: string;
    transactionDate?: string;
    createdAt: string;
    userName?: string;
    flatNumber?: string;
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
    submittedBy: string;
    submittedByName?: string;
    status: ExpenseStatus;
    approvedBy?: string;
    approvedByName?: string;
    communityId: string;
    createdAt: string;
    receiptUrl?: string;
}

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

export interface AuditLog {
    id: string;
    createdAt: string;
    actorId: string;
    communityId: string;
    actorName?: string;
    actorRole?: string;
    entity: string;
    entityId: string;
    action: AuditAction;
    details: {
        old?: any;
        new?: any;
        description?: string;
        amount?: number;
        data?: any;
    };
}

// Added FinancialHistory interface to fix errors in api.ts, Billing.tsx and pdfGenerator.ts
export interface FinancialHistory {
    year: number;
    totalCollected: number;
    monthlyBreakdown: { month: string; amount: number; transactionCount: number }[];
    communityBreakdown: { communityName: string; totalPaid: number }[];
}

export type Page = 'Dashboard' | 'AdminPanel' | 'Notices' | 'Help Desk' | 'Visitors' | 'Amenities' | 'Assets' | 'Directory' | 'Maintenance' | 'Expenses' | 'CommunitySetup' | 'Billing' | 'BulkOperations';
