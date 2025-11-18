export enum UserRole {
  Admin = 'Admin',
  Resident = 'Resident',
  Security = 'Security',
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  flatNumber: string;
  role: UserRole;
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
}

export interface Amenity {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  capacity: number;
}

export interface Booking {
  id: string;
  amenityId: string;
  residentName: string;
  flatNumber: string;
  startTime: string;
  endTime: string;
}

export type Page = 'Dashboard' | 'Notices' | 'Help Desk' | 'Visitors' | 'Amenities';