import { SystemConfig, DiagnosticTest, DiagnosticLab, Hospital } from './types.ts';

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
  baseIncentive: 20,
};

export const MOCK_TESTS: DiagnosticTest[] = [
  { id: 'T01', name: 'Complete Blood Count (CBC)', category: 'Hematology', price: 350 },
  { id: 'T02', name: 'Lipid Profile', category: 'Biochemistry', price: 600 },
  { id: 'T03', name: 'Thyroid Profile (T3, T4, TSH)', category: 'Endocrinology', price: 850 },
  { id: 'T04', name: 'HbA1c (Glycated Hemoglobin)', category: 'Diabetes', price: 450 },
  { id: 'T05', name: 'Liver Function Test (LFT)', category: 'Biochemistry', price: 750 },
  { id: 'T06', name: 'Kidney Function Test (KFT)', category: 'Biochemistry', price: 700 },
  { id: 'T07', name: 'Vitamin B12', category: 'Vitamins', price: 900 },
  { id: 'T08', name: 'Vitamin D (25-OH)', category: 'Vitamins', price: 1200 },
  { id: 'T09', name: 'Urine Routine & Microscopy', category: 'Clinical Pathology', price: 200 },
  { id: 'T10', name: 'Blood Sugar (Fasting/PP)', category: 'Diabetes', price: 150 },
  { id: 'T11', name: 'Iron Studies', category: 'Biochemistry', price: 800 },
  { id: 'T12', name: 'C-Reactive Protein (CRP)', category: 'Immunology', price: 500 },
  { id: 'T13', name: 'Erythrocyte Sedimentation Rate (ESR)', category: 'Hematology', price: 150 },
  { id: 'T14', name: 'Calcium', category: 'Biochemistry', price: 300 },
  { id: 'T15', name: 'Electrolytes (Na, K, Cl)', category: 'Biochemistry', price: 550 },
  { id: 'T16', name: 'Prostate Specific Antigen (PSA)', category: 'Tumor Markers', price: 950 },
  { id: 'T17', name: 'D-Dimer', category: 'Coagulation', price: 1500 },
  { id: 'T18', name: 'Ferritin', category: 'Biochemistry', price: 650 },
  { id: 'T19', name: 'Uric Acid', category: 'Biochemistry', price: 250 },
  { id: 'T20', name: 'Malaria Parasite (MP)', category: 'Microbiology', price: 300 },
  { id: 'T21', name: 'Dengue NS1 Antigen', category: 'Microbiology', price: 800 },
  { id: 'T22', name: 'Widal Test (Typhoid)', category: 'Microbiology', price: 350 },
  { id: 'T23', name: 'HBsAg (Hepatitis B)', category: 'Serology', price: 400 },
  { id: 'T24', name: 'HIV I & II', category: 'Serology', price: 500 },
  { id: 'T25', name: 'Beta HCG (Pregnancy)', category: 'Endocrinology', price: 600 },
];

export const MOCK_LABS: DiagnosticLab[] = [
  { id: 'LAB01', name: 'Disha Main lab HUB', email: 'PHLEBO.DISHA@GMAIL.COM', location: { lat: 17.684942, lng: 73.998142, address: 'Satara, Maharashtra' }, geofenceRadiusMeters: 10000 },
];

export const MOCK_HOSPITALS: Hospital[] = [
    { id: 'HOS01', name: 'Satara Civic Hospital', email: 'PHLEBO.DISHA@GMAIL.COM', address: 'Radhika Road, Satara', lat: 17.6900, lng: 74.0000 },
    { id: 'HOS02', name: 'Ajinkya Hospital', email: 'PHLEBO.DISHA@GMAIL.COM', address: 'Powai Naka, Satara', lat: 17.6800, lng: 73.9850 },
];
