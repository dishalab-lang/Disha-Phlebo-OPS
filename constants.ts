
import { SystemConfig, Phlebotomist, DiagnosticTest, DiagnosticLab } from './types';

export const DEFAULT_CONFIG: SystemConfig = {
  withinTatRate: 3.50,
  outsideTatRate: 2.25,
  standardTatMinutes: 30,
  tatBrackets: [
    { maxKm: 2, tatMinutes: 30 },
    { maxKm: 5, tatMinutes: 45 },
    { maxKm: 10, tatMinutes: 60 },
    { maxKm: 20, tatMinutes: 90 },
    { maxKm: 999, tatMinutes: 120 }
  ],
  convenienceMatrix: [
    { minKm: 0, maxKm: 2, fee: 0, label: "Zone A: Ultra-Local" },
    { minKm: 2, maxKm: 5, fee: 100, label: "Zone B: Standard Radius" },
    { minKm: 5, maxKm: 10, fee: 200, label: "Zone C: Extended Radius" },
    { minKm: 10, maxKm: 999, fee: 350, label: "Zone D: Remote Service" }
  ],
  geofenceRadiusMeters: 150,
  flatCollectionCharge: 150.00,
  announcement: "Disha Diagnostics Enterprise Portal Active",
  securityPin: "1234"
};

export const LAB_LOCATION = {
  lat: 19.0760,
  lng: 72.8777,
  address: 'Disha Central Hub, BKC, Mumbai'
};

export const INITIAL_LABS: DiagnosticLab[] = [
  {
    id: 'LAB001',
    name: 'Disha Central Hub',
    location: LAB_LOCATION,
    geofenceRadiusMeters: 500
  },
  {
    id: 'LAB002',
    name: 'Disha Satellite - Bandra',
    location: { lat: 19.0596, lng: 72.8295, address: 'Bandra West, Mumbai' },
    geofenceRadiusMeters: 300
  }
];

export const PREDEFINED_HOSPITALS = [
  { name: 'City Hospital', address: 'A Wing, BKC, Mumbai', lat: 19.0760, lng: 72.8777 },
  { name: 'Apollo Spectra', address: 'Saraswat Colony, Chembur, Mumbai', lat: 19.0522, lng: 72.8996 },
  { name: 'Fortis Mulund', address: 'LBS Marg, Mulund West, Mumbai', lat: 19.1762, lng: 72.9463 },
  { name: 'Lilavati Hospital', address: 'A K Vaidya Marg, Bandra West, Mumbai', lat: 19.0514, lng: 72.8277 },
  { name: 'Nanavati Max', address: 'S V Road, Vile Parle West, Mumbai', lat: 19.0988, lng: 72.8415 },
  { name: 'SevenHills Hospital', address: 'Marol, Andheri East, Mumbai', lat: 19.1171, lng: 72.8788 },
  { name: 'Kokilaben Hospital', address: 'Four Bungalows, Andheri West, Mumbai', lat: 19.1311, lng: 72.8252 }
];

export const TEST_CATALOG: DiagnosticTest[] = [
  { id: 'T1', name: 'Complete Blood Count (CBC)', category: 'Pathology', price: 450 },
  { id: 'T2', name: 'HbA1c (Diabetes)', category: 'Biochemistry', price: 550 },
  { id: 'T3', name: 'Liver Function Test (LFT)', category: 'Biochemistry', price: 850 },
  { id: 'T4', name: 'Lipid Profile', category: 'Biochemistry', price: 900 },
  { id: 'T5', name: 'Thyroid Profile (T3, T4, TSH)', category: 'Hormones', price: 750 },
  { id: 'T6', name: 'Vitamin D', category: 'Vitamins', price: 1200 },
  { id: 'T7', name: 'Vitamin B12', category: 'Vitamins', price: 950 },
  { id: 'T8', name: 'RT-PCR (Covid-19)', category: 'Molecular', price: 600 },
  { id: 'T9', name: 'Urine Routine', category: 'Pathology', price: 200 },
  { id: 'T10', name: 'Kidney Function Test (KFT)', category: 'Biochemistry', price: 800 },
];

export const MOCK_PHLEBOTOMISTS: Phlebotomist[] = [
  { 
    id: 'SA01', 
    name: 'System Admin', 
    phone: '1111111111', 
    email: 'sysadmin@dishalab.com',
    aadhaar: '1111-1111-1111',
    age: 30,
    sex: 'MALE',
    username: 'admin', 
    password: '123', 
    isAvailable: true, 
    role: 'SYSTEM_ADMIN',
    status: 'APPROVED',
    grade: 'A', 
    monthlyEarnings: 0, 
    completedCalls: 0, 
    rejectedCalls: 0, 
    shiftStart: '00:00', 
    shiftEnd: '23:59', 
    currentLocation: { lat: 19.0760, lng: 72.8777, address: 'Command Center' } 
  },
  { 
    id: 'DEV01', 
    name: 'Developer Node', 
    phone: '0000000000', 
    email: 'dev@dishalab.com',
    aadhaar: '0000-0000-0000',
    age: 25,
    sex: 'MALE',
    username: 'dev', 
    password: 'dev', 
    isAvailable: true, 
    role: 'DEVELOPER',
    status: 'APPROVED',
    grade: 'A', 
    monthlyEarnings: 0, 
    completedCalls: 0, 
    rejectedCalls: 0, 
    shiftStart: '00:00', 
    shiftEnd: '23:59', 
    currentLocation: { lat: 19.0760, lng: 72.8777, address: 'Dev Environment' } 
  },
  { 
    id: 'P1', 
    name: 'Admin Controller', 
    phone: '9876543210', 
    email: 'admin@dishalab.com',
    aadhaar: '1234-5678-9012',
    age: 35,
    sex: 'MALE',
    username: 'disha', 
    password: '123', 
    isAvailable: true, 
    role: 'ADMIN',
    labId: 'LAB001',
    status: 'APPROVED',
    grade: 'A', 
    monthlyEarnings: 12500, 
    completedCalls: 85, 
    rejectedCalls: 0, 
    shiftStart: '08:00', 
    shiftEnd: '22:00', 
    currentLocation: { lat: 19.0760, lng: 72.8777, address: 'Central Lab' } 
  },
  { 
    id: 'P2', 
    name: 'Field Associate', 
    phone: '9876543211', 
    email: 'field@dishalab.com',
    aadhaar: '2345-6789-0123',
    age: 28,
    sex: 'MALE',
    username: 'phlebo', 
    password: '123', 
    isAvailable: true, 
    role: 'EMPLOYEE',
    labId: 'LAB001',
    status: 'APPROVED',
    grade: 'B', 
    monthlyEarnings: 4200, 
    completedCalls: 42, 
    rejectedCalls: 0, 
    shiftStart: '09:00', 
    shiftEnd: '18:00', 
    currentLocation: { lat: 19.0800, lng: 72.8700, address: 'Bandra West' } 
  },
];
