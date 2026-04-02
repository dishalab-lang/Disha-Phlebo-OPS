
export const CallStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  VISITING: 'VISITING',
  COLLECTED: 'COLLECTED',
  DELIVERED: 'DELIVERED', 
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
  IN_PROGRESS: 'IN_PROGRESS'
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
  location: Location;
  geofenceRadiusMeters: number;
  adminId?: string;
}

export interface Hospital {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface CollectionCall {
  id: string;
  patientName: string;
  patientPhone: string;
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
  handoverAt?: number;
  rejectedAt?: number;
  status: CallStatus;
  assignedPhleboId?: string;
  labId: string;
  distanceKm?: number;
  estimatedTatMinutes: number;
  billing: BillingInfo;
  isPriority?: boolean;
  visitPhoto?: string;
  samplePhoto?: string;
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
  announcement?: string | null;
  securityPin: string;
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
