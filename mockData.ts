import { SystemConfig, DiagnosticTest, DiagnosticLab, Hospital } from './types';

export const INITIAL_CONFIG: SystemConfig = {
  withinTatRate: 15,
  outsideTatRate: 10,
  tatBrackets: [
    { maxKm: 5, tatMinutes: 60 },
    { maxKm: 10, tatMinutes: 90 },
    { maxKm: 20, tatMinutes: 120 },
  ],
  securityPin: '1234',
  standardTatMinutes: 180,
  convenienceMatrix: [],
  geofenceRadiusMeters: 5000,
  flatCollectionCharge: 100,
};

export const MOCK_TESTS: DiagnosticTest[] = [
  { id: 'T01', name: 'Complete Blood Count (CBC)', category: 'Hematology', price: 350 },
  { id: 'T02', name: 'Lipid Profile', category: 'Biochemistry', price: 600 },
  { id: 'T03', name: 'Thyroid Stimulating Hormone (TSH)', category: 'Endocrinology', price: 400 },
];

export const MOCK_LABS: DiagnosticLab[] = [
  { id: 'LAB01', name: 'Main Hub', location: { lat: 19.0760, lng: 72.8777, address: 'Mumbai' }, geofenceRadiusMeters: 10000 },
];

export const MOCK_HOSPITALS: Hospital[] = [
    { id: 'HOS01', name: 'City Hospital', address: '123 Main St, Mumbai', lat: 19.0760, lng: 72.8777 },
    { id: 'HOS02', name: 'General Hospital', address: '456 Park Ave, Mumbai', lat: 19.0760, lng: 72.8777 },
];
