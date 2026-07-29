
export const CallStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  VISITING: 'VISITING',
  COLLECTED: 'COLLECTED',
  IN_TRANSIT: 'IN_TRANSIT',
  RECEIVED_AT_LAB: 'RECEIVED_AT_LAB',
  DELIVERED: 'DELIVERED', 
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
  IN_PROGRESS: 'IN_PROGRESS',
  CANCELLED: 'CANCELLED'
} as const;

export type CallStatus = typeof CallStatus[keyof typeof CallStatus];

export const CallType = {
  HOME_VISIT: 'HOME_VISIT',
  HOSPITAL: 'HOSPITAL'
} as const;

export type CallType = typeof CallType[keyof typeof CallType];

export const PaymentMode = {
  CASH: 'CASH',
  UPI: 'UPI',
  CARD: 'CARD',
  LINK: 'LINK',
  UNPAID: 'UNPAID'
} as const;

export type PaymentMode = typeof PaymentMode[keyof typeof PaymentMode];

export interface Location {
  lat: number;
  lng: number;
  address: string;
}

export interface DiagnosticTest {
  id: string;
  name: string;
  category: string;
  price: number;
  isUrgent?: boolean;
  patientPhone?: string;
}

export interface ConvenienceTier {
  minKm: number;
  maxKm: number;
  fee: number;
  label: string;
}

export interface BillingInfo {
  tests: DiagnosticTest[];
  subTotal: number;
  collectionCharge: number;
  totalAmount: number;
  paymentStatus: 'PAID' | 'PENDING';
  paymentMode: PaymentMode;
}

export interface TatBracket {
  maxKm: number;
  tatMinutes: number;
}

export interface DiagnosticLab {
  id: string;
  name: string;
  email?: string;
  location: Location;
  geofenceRadiusMeters: number;
  adminId?: string;
}

export interface Hospital {
  id: string;
  name: string;
  email?: string;
  address: string;
  lat: number;
  lng: number;
}

export interface CollectionCall {
  id: string;
  patientName: string;
  patientPhone: string;
  patientEmail?: string;
  verificationCode: string;
  handoverCode: string;
  otpGeneratedAt: number;
  otpExpiresAt: number;
  otpRetryCount: number;
  isOtpLocked: boolean;
  type: CallType;
  destination: Location;
  arrivedLocation?: Location;
  placedAt: number;
  acceptedAt?: number;
  visitedAt?: number;
  collectedAt?: number;
  transitAt?: number;
  receivedAt?: number;
  handoverAt?: number;
  rejectedAt?: number;
  status: CallStatus;
  assignedPhleboId?: string;
  labId: string;
  hospitalId?: string;
  distanceKm?: number;
  estimatedTatMinutes: number;
  billing: BillingInfo;
  isPriority?: boolean;
  visitPhoto?: string;
  samplePhoto?: string;
  sampleType?: string;
  handoverPhoto?: string;
  voiceNote?: string;
  rejectionReason?: string;
}

export interface Appointment {
  id: string;
  patientName: string;
  patientPhone: string;
  address?: string;
  testId: string;
  testName: string;
  scheduledAt: number;
  bookedByPhleboId: string;
  status: 'SCHEDULED' | 'CONVERTED' | 'CANCELLED' | 'COMPLETED';
}

export type StaffRole = 'DEVELOPER' | 'SYSTEM_ADMIN' | 'ADMIN' | 'EMPLOYEE' | 'RECEPTION' | 'ACCOUNT' | 'DISPATCHER';
export type UserStatus = 'PENDING' | 'APPROVED' | 'LOCKED';

export interface Phlebotomist {
  id: string;
  name: string;
  phone: string;
  email: string;
  aadhaar: string;
  age: number;
  sex: 'MALE' | 'FEMALE' | 'OTHER';
  role: StaffRole;
  status: UserStatus;
  username?: string;
  password?: string;
  isAvailable: boolean;
  currentLocation?: Location;
  labId?: string;
  grade: 'A' | 'B' | 'C' | 'N/A';
  monthlyEarnings: number;
  completedCalls: number;
  rejectedCalls: number;
  lastActive?: number;
  shiftStart: string;
  shiftEnd: string;
}

export interface SystemConfig {
  withinTatRate: number;
  outsideTatRate: number;
  standardTatMinutes: number; 
  tatBrackets: TatBracket[]; 
  convenienceMatrix: ConvenienceTier[];
  geofenceRadiusMeters: number;
  flatCollectionCharge: number;
  baseIncentive: number;
  dailyCallQuota?: number;
  announcement?: string | null;
  securityPin: string;
  exotelApiKey?: string;
  exotelApiToken?: string;
  exotelAccountSid?: string;
  exotelSubdomain?: string;
  exotelSenderId?: string;
  exotelDltEntityId?: string;
  exotelDltTemplateId?: string;
  fast2smsApiKey?: string;
  fast2smsRoute?: string;
}

export interface CallMetrics {
  callId: string;
  phleboId: string;
  phleboName: string;
  patientName: string;
  totalTat: number;
  targetTat: number; 
  distance: number;
  incentive: number;
  revenue: number;
  paymentMode: PaymentMode;
  timestamp: number;
  isPremiumIncentive: boolean;
  voiceNote?: string;
  status: 'COMPLETED' | 'REJECTED';
}

export interface EmergencyAlert {
  id: string;
  phleboId: string;
  phleboName: string;
  phone: string;
  location: Location;
  trackingUrl?: string;
  mapsUrl?: string;
  timestamp: number;
  status: 'ACTIVE' | 'RESOLVED';
}

