
import React, { useState, useMemo } from 'react';
import { SystemConfig, CallMetrics, Phlebotomist, CollectionCall, CallStatus, DiagnosticTest, UserStatus, DiagnosticLab, StaffRole, TatBracket, Hospital } from './types';
import { 
  Settings, Zap, Save, Users, FlaskConical, Route, Clock, 
  Trash2, IndianRupee, Wallet, Database, ShieldCheck, 
  CheckCircle2, MapPin, Plus, Building2, Search, Timer, Radar, 
  Activity, X, UserPlus, Phone, ShieldAlert, Send, Home, UserCheck, Lock, Unlock,
  Truck, Target, Locate, TrendingUp, Sparkles, UserCircle, AlertCircle, Fingerprint, Shield,
  Globe, Server, AlertTriangle, Edit3, Trash, Calendar, Filter, Download, ChevronRight, BarChart3, PlusCircle, Printer, Mail, User as UserIcon, Hospital as HospitalIcon, Volume2, Key
} from 'lucide-react';

import { GoogleGenAI } from '@google/genai';

const SUPER_USER_ROLES: Set<StaffRole> = new Set(['ADMIN', 'SYSTEM_ADMIN', 'DEVELOPER']);
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

interface PerformanceReport {
  grade: 'A' | 'B' | 'C' | 'D';
  feedback: string;
}

export const RadarMap: React.FC<{ phleboList: Phlebotomist[], activeCalls: CollectionCall[] }> = ({ phleboList, activeCalls }) => {
  return (
    <div className="bg-slate-900 rounded-[2.5rem] h-[400px] relative overflow-hidden border-4 border-white shadow-2xl flex items-center justify-center">
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 border border-brand-purple/30 rounded-full scale-[0.2]"></div>
        <div className="absolute inset-0 border border-brand-purple/30 rounded-full scale-[0.4]"></div>
        <div className="absolute inset-0 border border-brand-purple/30 rounded-full scale-[0.6]"></div>
        <div className="absolute inset-0 border border-brand-purple/30 rounded-full scale-[0.8]"></div>
      </div>
      <div className="relative z-10 text-center">
        <Radar size={48} className="text-brand-purple mx-auto mb-4 animate-pulse" />
        <p className="text-[10px] font-black text-brand-purple uppercase tracking-[0.4em]">Grid Synchronized</p>
        <p className="text-[8px] text-slate-500 font-bold mt-2 uppercase">Tracking {phleboList.length} Nodes • {activeCalls.filter(c => c.status !== CallStatus.COMPLETED).length} Active Tasks</p>
      </div>
      {phleboList.map((p, i) => (
        <div 
          key={p.id}
          className="absolute w-3 h-3 bg-brand-green rounded-full shadow-[0_0_15px_rgba(41,166,67,0.8)] animate-pulse"
          style={{ 
            top: `${40 + Math.sin(i * 1.5) * 30}%`, 
            left: `${50 + Math.cos(i * 1.5) * 40}%` 
          }}
        >
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-white px-2 py-0.5 rounded text-[7px] font-black whitespace-nowrap shadow-sm text-slate-900 border">
            {p.name.split(' ')[0]}
          </div>
        </div>
      ))}
    </div>
  );
};

interface AdminPanelProps {
  config: SystemConfig;
  labs: DiagnosticLab[];
  hospitals: Hospital[];
  onUpdateConfig: (config: SystemConfig) => void;
  onRegisterLab: (lab: Partial<DiagnosticLab>, admin: Partial<Phlebotomist> | null) => void;
  onUpdateLab: (lab: DiagnosticLab) => void;
  history: CallMetrics[];
  phleboList: Phlebotomist[];
  activeCalls: CollectionCall[];
  currentUser: Phlebotomist;
  tests: DiagnosticTest[];
  onUpdateShift: (id: string, start: string, end: string) => void;
  onRegisterPhlebo: (p: Partial<Phlebotomist>) => void;
  onRemovePhlebo: (id: string) => void;
  onUpdateUserStatus: (id: string, status: UserStatus) => void;
  onUpdateTests: (tests: DiagnosticTest[]) => void;
  onUpdateLabs: (labs: DiagnosticLab[]) => void;
  onUpdateHospitals: (hospitals: Hospital[]) => void;
  onUpdatePhleboRole: (id: string, role: StaffRole) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ 
  config, labs, hospitals, onUpdateConfig, onRegisterLab, onUpdateLab, history, 
  phleboList, activeCalls, currentUser, tests, onUpdateShift, 
  onRegisterPhlebo, onRemovePhlebo, onUpdateUserStatus, onUpdateTests, onUpdateLabs, onUpdateHospitals, onUpdatePhleboRole
}) => {
  const [activeTab, setActiveTab] = useState<'FLEET' | 'ROSTER' | 'TRIPS' | 'CATALOG' | 'INFRA' | 'HOSPITALS' | 'FINANCE' | 'CONFIG' | 'PERFORMANCE'>('FLEET');
  const [editedConfig, setEditedConfig] = useState(config);
  const [performanceReports, setPerformanceReports] = useState<Record<string, PerformanceReport>>({});
  
  const [isRegisteringStaff, setIsRegisteringStaff] = useState(false);
  const [editingTest, setEditingTest] = useState<DiagnosticTest | null>(null);
  const [editingLab, setEditingLab] = useState<DiagnosticLab | null>(null);
  const [editingHospital, setEditingHospital] = useState<Hospital | null>(null);
  const [isAddingTest, setIsAddingTest] = useState(false);
  const [isAddingLab, setIsAddingLab] = useState(false);
  const [isAddingHospital, setIsAddingHospital] = useState(false);

  const canEditSettings = currentUser && SUPER_USER_ROLES.has(currentUser.role);

  // Ledger Filter State
  const [ledgerStartDate, setLedgerStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [ledgerEndDate, setLedgerEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const initialStaffState: Partial<Phlebotomist> = { 
    name: '', 
    phone: '', 
    email: '',
    aadhaar: '',
    age: 25,
    sex: 'MALE',
    role: 'EMPLOYEE' as StaffRole, 
    labId: labs[0]?.id || '',
    shiftStart: '09:00', 
    shiftEnd: '18:00' 
  };
  const [newStaff, setNewStaff] = useState<Partial<Phlebotomist>>(initialStaffState);
  const [newTest, setNewTest] = useState<Partial<DiagnosticTest>>({ name: '', category: 'Pathology', price: 0 });
  const [newLab, setNewLab] = useState<Partial<DiagnosticLab>>({ name: '', location: { lat: 19.0, lng: 72.0, address: '' }, geofenceRadiusMeters: 500 });
  const [newHospital, setNewHospital] = useState<Partial<Hospital>>({ name: '', address: '', lat: 19.0760, lng: 72.8777 });

  const filteredHistory = useMemo(() => {
    const start = new Date(ledgerStartDate).getTime();
    const end = new Date(ledgerEndDate).getTime() + (24 * 60 * 60 * 1000); // end of day
    return history.filter(h => h.timestamp >= start && h.timestamp <= end);
  }, [history, ledgerStartDate, ledgerEndDate]);

  const stats = useMemo(() => {
    const totalRevenue = filteredHistory.reduce((sum, item) => sum + item.revenue, 0);
    const avgTat = filteredHistory.length > 0 ? filteredHistory.reduce((sum, item) => sum + item.totalTat, 0) / filteredHistory.length : 0;
    return { totalRevenue, totalSamples: filteredHistory.length, avgTat, premiumCount: filteredHistory.filter(h => h.isPremiumIncentive).length };
  }, [filteredHistory]);

  const handleRegisterStaff = (e: React.FormEvent) => {
    e.preventDefault();
    onRegisterPhlebo({ ...newStaff, age: Number(newStaff.age) });
    setIsRegisteringStaff(false);
    setNewStaff(initialStaffState);
  };

  const handleAddTest = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateTests([...tests, { ...newTest, price: Number(newTest.price), id: 'T' + Date.now() + Math.random().toString(36).substring(2, 7) } as DiagnosticTest]);
    setIsAddingTest(false);
    setNewTest({ name: '', category: 'Pathology', price: 0 });
  };

  const handleSaveEditedTest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTest) return;
    const updatedTest = { ...editingTest, price: Number(editingTest.price) };
    onUpdateTests(tests.map(t => t.id === updatedTest.id ? updatedTest : t));
    setEditingTest(null);
  };

  const handleAddLab = (e: React.FormEvent) => {
    e.preventDefault();
    const labToSave = {
      ...newLab,
      location: {
        ...newLab.location!,
        lat: Number(newLab.location?.lat),
        lng: Number(newLab.location?.lng)
      },
      geofenceRadiusMeters: Number(newLab.geofenceRadiusMeters)
    };
    onRegisterLab(labToSave, null);
    setIsAddingLab(false);
    setNewLab({ name: '', location: { lat: 19.0, lng: 72.0, address: '' }, geofenceRadiusMeters: 500 });
  };

  const handleSaveEditedLab = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLab) return;
    const updatedLab = {
      ...editingLab,
      location: {
        ...editingLab.location,
        lat: Number(editingLab.location.lat),
        lng: Number(editingLab.location.lng)
      },
      geofenceRadiusMeters: Number(editingLab.geofenceRadiusMeters)
    };
    onUpdateLabs(labs.map(l => l.id === updatedLab.id ? updatedLab : l));
    setEditingLab(null);
  };

  const handleAddHospital = (e: React.FormEvent) => {
    e.preventDefault();
    const hospitalToSave = {
      ...newHospital,
      lat: Number(newHospital.lat),
      lng: Number(newHospital.lng),
      id: 'HOS' + Date.now() + Math.random().toString(36).substring(2, 7)
    } as Hospital;
    onUpdateHospitals([...hospitals, hospitalToSave]);
    setIsAddingHospital(false);
    setNewHospital({ name: '', address: '', lat: 19.0760, lng: 72.8777 });
  };

  const handleSaveEditedHospital = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHospital) return;
    const updatedHospital = {
      ...editingHospital,
      lat: Number(editingHospital.lat),
      lng: Number(editingHospital.lng)
    };
    onUpdateHospitals(hospitals.map(h => h.id === updatedHospital.id ? updatedHospital : h));
    setEditingHospital(null);
  };

  const handleAddTatBracket = () => {
    const newBrackets = [...(editedConfig.tatBrackets || []), { maxKm: 0, tatMinutes: 0 }];
    setEditedConfig({ ...editedConfig, tatBrackets: newBrackets });
  };

  const handleRemoveTatBracket = (index: number) => {
    const newBrackets = (editedConfig.tatBrackets || []).filter((_, i) => i !== index);
    setEditedConfig({ ...editedConfig, tatBrackets: newBrackets });
  };

  const handleUpdateTatBracket = (index: number, field: keyof TatBracket, value: number) => {
    const newBrackets = (editedConfig.tatBrackets || []).map((b, i) => i === index ? { ...b, [field]: value } : b);
    setEditedConfig({ ...editedConfig, tatBrackets: newBrackets });
  };

  const handlePrintLedger = () => {
    const doc = new jsPDF() as any;
    doc.setFontSize(18);
    doc.text('DISHA DIAGNOSTICS - FINANCE LEDGER', 20, 20);
    doc.setFontSize(10);
    doc.text(`Period: ${ledgerStartDate} to ${ledgerEndDate}`, 20, 30);
    doc.text(`Generated On: ${new Date().toLocaleString()}`, 20, 35);

    const tableData = filteredHistory.map(h => [
      new Date(h.timestamp).toLocaleDateString(),
      h.patientName,
      h.phleboName,
      `₹${h.revenue.toFixed(2)}`,
      `₹${h.incentive.toFixed(2)}`,
      h.paymentMode
    ]);

    doc.autoTable({
      startY: 45,
      head: [['Date', 'Patient', 'Phlebo', 'Revenue', 'Incentive', 'Mode']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [95, 37, 159] }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 150;
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Revenue: ₹${stats.totalRevenue.toFixed(2)}`, 130, finalY + 15);
    doc.text(`Total Samples: ${stats.totalSamples}`, 130, finalY + 22);

    doc.save(`Disha_Ledger_${ledgerStartDate}_${ledgerEndDate}.pdf`);
  };

  const NavBtn = ({ label, tab, icon: Icon }: { label: string, tab: typeof activeTab, icon: any }) => (
    <button 
      onClick={() => setActiveTab(tab)} 
      className={`flex-1 lg:flex-none lg:px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === tab ? 'bg-brand-purple text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
    >
      <Icon size={14} /> <span className="hidden sm:inline">{label}</span>
    </button>
  );

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 w-full lg:w-fit shadow-sm gap-1 overflow-x-auto no-scrollbar scroll-smooth">
        <NavBtn label="Fleet" tab="FLEET" icon={Truck} />
        <NavBtn label="Roster" tab="ROSTER" icon={Users} />
        <NavBtn label="Trips" tab="TRIPS" icon={Route} />
        <NavBtn label="Diagnostics" tab="CATALOG" icon={FlaskConical} />
        <NavBtn label="Hubs" tab="INFRA" icon={Building2} />
        <NavBtn label="Hospitals" tab="HOSPITALS" icon={HospitalIcon} />
        <NavBtn label="Ledger" tab="FINANCE" icon={IndianRupee} />
        <NavBtn label="Performance" tab="PERFORMANCE" icon={BarChart3} />
        <NavBtn label="Config" tab="CONFIG" icon={Settings} />
      </div>

      {activeTab === 'FLEET' && (
        <div className="space-y-6">
          <RadarMap phleboList={phleboList} activeCalls={activeCalls} />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
             <div className="bg-white p-6 rounded-[1.5rem] border shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Fleet</p>
                <h3 className="text-3xl font-black">{phleboList.length}</h3>
             </div>
             <div className="bg-white p-6 rounded-[1.5rem] border shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Samples</p>
                <h3 className="text-3xl font-black text-brand-green">{stats.totalSamples}</h3>
             </div>
             <div className="bg-white p-6 rounded-[1.5rem] border shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Urgent</p>
                <h3 className="text-3xl font-black text-orange-600">{stats.premiumCount}</h3>
             </div>
             <div className="bg-white p-6 rounded-[1.5rem] border shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">TAT (Avg)</p>
                <h3 className="text-3xl font-black text-brand-purple">{stats.avgTat.toFixed(0)}m</h3>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'ROSTER' && (
        <div className="space-y-6 animate-slide-up">
          <div className="flex justify-between items-center bg-white p-8 rounded-[2rem] border shadow-sm">
            <div>
               <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Enterprise Staff Registry</h3>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Enterprise node & access control</p>
            </div>
            <button onClick={() => setIsRegisteringStaff(true)} className="bg-brand-purple text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg">
               <UserPlus size={18} /> Onboard Staff
            </button>
          </div>

          <div className="bg-white rounded-[2rem] border shadow-sm overflow-hidden">
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                   <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <tr>
                        <th className="px-8 py-5">Personnel</th>
                        <th className="px-8 py-5 text-center">Shift Roster</th>
                        <th className="px-8 py-5">Credential Node</th>
                        <th className="px-8 py-5">Assigned Hub</th>
                        <th className="px-8 py-5 text-center">Status</th>
                        <th className="px-8 py-5 text-right">Access Control</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                      {phleboList.map(p => {
                        const assignedLab = labs.find(l => l.id === p.labId);
                        return (
                          <tr key={p.id} className="hover:bg-slate-50/50 transition-all">
                            <td className="px-8 py-6">
                                <div className="flex items-center gap-4">
                                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${p.name}`} className="w-10 h-10 rounded-xl border bg-slate-50" />
                                  <div className="flex flex-col">
                                      <span className="text-sm font-black text-slate-900">{p.name}</span>
                                      <span className="text-[10px] font-bold text-slate-400">{p.role}</span>
                                  </div>
                                </div>
                            </td>
                            <td className="px-8 py-6 text-center">
                               <div className="inline-flex items-center gap-2 bg-slate-50 border p-2 rounded-xl">
                                  <input type="time" value={p.shiftStart} onChange={(e) => onUpdateShift(p.id, e.target.value, p.shiftEnd)} className="bg-transparent text-[10px] font-black outline-none w-16" />
                                  <span className="text-slate-300">»</span>
                                  <input type="time" value={p.shiftEnd} onChange={(e) => onUpdateShift(p.id, p.shiftStart, e.target.value)} className="bg-transparent text-[10px] font-black outline-none w-16" />
                               </div>
                            </td>
                            <td className="px-8 py-6">
                                <div className="bg-slate-50 px-3 py-2 rounded-xl border text-[10px] font-bold text-slate-600 inline-block">
                                  <span className="text-brand-purple font-black">USER ID:</span> {p.username || 'N/A'} <br/>
                                  <span className="text-brand-purple font-black">ACCESS KEY:</span> {p.password || 'N/A'}
                                </div>
                            </td>
                            <td className="px-8 py-6">
                               <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{assignedLab?.name || 'Unassigned'}</span>
                            </td>
                            <td className="px-8 py-6 text-center">
                                <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${p.status === 'APPROVED' ? 'bg-green-50 text-brand-green border-brand-green/20' : 'bg-red-50 text-red-500 border-red-500/20'}`}>
                                  {p.status}
                                </span>
                            </td>
                            <td className="px-8 py-6 text-right space-x-2">
                                <button onClick={() => onUpdateUserStatus(p.id, p.status === 'APPROVED' ? 'LOCKED' : 'APPROVED')} className={`p-3 rounded-xl transition-all ${p.status === 'APPROVED' ? 'text-red-400 hover:bg-red-50' : 'text-brand-green hover:bg-green-50'}`}>
                                  {p.status === 'APPROVED' ? <Lock size={18} /> : <Unlock size={18} />}
                                </button>
                                {canEditSettings && p.id !== currentUser.id && !SUPER_USER_ROLES.has(p.role) && (
                                  <button onClick={() => onRemovePhlebo(p.id)} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                                    <Trash2 size={18} />
                                  </button>
                                )}
                            </td>
                          </tr>
                        );
                      })}
                   </tbody>
                </table>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'TRIPS' && (
        <div className="space-y-6 animate-slide-up">
           <div className="flex justify-between items-center bg-white p-8 rounded-[2rem] border shadow-sm">
              <div>
                 <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Mission Control Center</h3>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Real-time progress of all active and completed diagnostic collection trips</p>
              </div>
           </div>

           {/* Active Missions Section */}
           <div className="bg-white rounded-[2rem] border shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-50 bg-brand-purple/5">
                 <h4 className="text-[10px] font-black text-brand-purple uppercase tracking-[0.2em] flex items-center gap-2">
                    <Radar size={14} className="animate-pulse" /> Live Active Missions
                 </h4>
              </div>
              <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                       <tr>
                          <th className="px-8 py-5">Patient</th>
                          <th className="px-8 py-5">Personnel</th>
                          <th className="px-8 py-5 text-center">Status</th>
                          <th className="px-8 py-5 text-right">Progress</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                       {activeCalls.filter(c => c.status !== CallStatus.COMPLETED && c.status !== CallStatus.REJECTED).length > 0 ? (
                          activeCalls.filter(c => c.status !== CallStatus.COMPLETED && c.status !== CallStatus.REJECTED).map((call) => {
                             const phlebo = phleboList.find(p => p.id === call.assignedPhleboId);
                             return (
                                <tr key={call.id} className="hover:bg-slate-50 transition-all">
                                   <td className="px-8 py-6">
                                      <span className="text-sm font-black text-slate-900">{call.patientName}</span>
                                      <span className="block text-[9px] font-bold text-slate-400 uppercase">{call.destination.address}</span>
                                      {call.arrivedLocation && (
                                        <span className="block text-[9px] font-bold text-brand-green uppercase mt-1">
                                          Arrived: {call.arrivedLocation.lat.toFixed(4)}, {call.arrivedLocation.lng.toFixed(4)}
                                        </span>
                                      )}
                                   </td>
                                   <td className="px-8 py-6">
                                      <span className="text-sm font-black text-brand-purple uppercase">{phlebo?.name || 'Searching...'}</span>
                                   </td>
                                   <td className="px-8 py-6 text-center">
                                      <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${
                                         call.status === CallStatus.PENDING ? 'bg-slate-50 text-slate-400' :
                                         call.status === CallStatus.ACCEPTED ? 'bg-blue-50 text-blue-500 border-blue-100' :
                                         call.status === CallStatus.VISITING ? 'bg-orange-50 text-orange-500 border-orange-100' :
                                         call.status === CallStatus.IN_PROGRESS ? 'bg-brand-purple/10 text-brand-purple border-brand-purple/20' :
                                         'bg-green-50 text-brand-green border-green-100'
                                      }`}>
                                         {call.status}
                                      </span>
                                   </td>
                                   <td className="px-8 py-6 text-right">
                                      <div className="w-full max-w-[100px] ml-auto bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                         <div 
                                            className={`h-full transition-all duration-500 ${
                                               call.status === CallStatus.PENDING ? 'w-[10%] bg-slate-300' :
                                               call.status === CallStatus.ACCEPTED ? 'w-[30%] bg-blue-400' :
                                               call.status === CallStatus.VISITING ? 'w-[50%] bg-orange-400' :
                                               call.status === CallStatus.IN_PROGRESS ? 'w-[75%] bg-brand-purple' :
                                               'w-[90%] bg-brand-green'
                                            }`}
                                         />
                                      </div>
                                   </td>
                                </tr>
                             );
                          })
                       ) : (
                          <tr>
                             <td colSpan={4} className="px-8 py-12 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">No active missions in the grid.</td>
                          </tr>
                       )}
                    </tbody>
                 </table>
              </div>
           </div>

           <div className="bg-white rounded-[2rem] border shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-50">
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Mission History Ledger</h4>
              </div>
              <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                       <tr>
                          <th className="px-8 py-5">Timestamp</th>
                          <th className="px-8 py-5">Personnel</th>
                          <th className="px-8 py-5">Patient</th>
                          <th className="px-8 py-5 text-center">TAT Status</th>
                          <th className="px-8 py-5 text-right">Incentive</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                       {history.length > 0 ? history.map((trip, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-all">
                             <td className="px-8 py-6 text-xs font-bold text-slate-500">{new Date(trip.timestamp).toLocaleString()}</td>
                             <td className="px-8 py-6">
                                <span className="text-sm font-black text-brand-purple uppercase">{trip.phleboName}</span>
                             </td>
                             <td className="px-8 py-6">
                                <span className="text-sm font-black text-slate-900">{trip.patientName}</span>
                             </td>
                             <td className="px-8 py-6 text-center">
                                <div className="flex items-center justify-center gap-2">
                                   <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${trip.totalTat <= trip.targetTat ? 'bg-green-50 text-brand-green border-brand-green/20' : 'bg-orange-50 text-orange-600 border-orange-600/20'}`}>
                                      {trip.totalTat <= trip.targetTat ? 'WITHIN TAT' : 'OUTSIDE TAT'} ({trip.totalTat}m)
                                   </span>
                                   {trip.voiceNote && (
                                      <button 
                                         onClick={() => new Audio(trip.voiceNote).play()}
                                         className="p-2 bg-brand-purple/10 text-brand-purple rounded-lg hover:bg-brand-purple/20 transition-all"
                                         title="Play Voice Note"
                                      >
                                         <Volume2 size={12} />
                                      </button>
                                   )}
                                </div>
                             </td>
                             <td className="px-8 py-6 text-right font-black text-brand-green">₹{trip.incentive.toFixed(2)}</td>
                          </tr>
                       )) : (
                          <tr>
                             <td colSpan={5} className="px-8 py-20 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">Grid history silent... No completed missions found.</td>
                          </tr>
                       )}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'HOSPITALS' && (
        <div className="space-y-6 animate-slide-up">
          <div className="flex justify-between items-center bg-white p-8 rounded-[2rem] border shadow-sm">
            <div>
               <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Hospital Facility Management</h3>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Medical institutions registry & GPS nodes</p>
            </div>
            <button onClick={() => setIsAddingHospital(true)} className="bg-brand-purple text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg">
               <PlusCircle size={18} /> Register Hospital
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             {hospitals.map(hos => (
               <div key={hos.id} className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6 hover:shadow-xl transition-all border-l-8 border-l-brand-green">
                  <div className="flex justify-between items-center">
                     <div className="p-4 bg-brand-green/5 text-brand-green rounded-3xl"><HospitalIcon size={32} /></div>
                     <div className="text-right">
                        <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Facility ID</span>
                        <span className="text-xl font-black text-slate-900">{hos.id}</span>
                     </div>
                  </div>
                  <div>
                     <h4 className="text-2xl font-black text-slate-900 tracking-tight">{hos.name}</h4>
                     <p className="text-xs font-bold text-slate-400 uppercase mt-2 leading-relaxed flex items-center gap-2">
                       <MapPin size={14} className="text-brand-green" /> {hos.address}
                     </p>
                     <div className="mt-4 flex gap-4">
                        <div className="bg-slate-50 px-3 py-1.5 rounded-lg border">
                           <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Lat</span>
                           <span className="text-xs font-black">{hos.lat.toFixed(6)}</span>
                        </div>
                        <div className="bg-slate-50 px-3 py-1.5 rounded-lg border">
                           <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Lng</span>
                           <span className="text-xs font-black">{hos.lng.toFixed(6)}</span>
                        </div>
                     </div>
                  </div>
                  <div className="pt-6 border-t border-slate-50 flex gap-4">
                     <button onClick={() => setEditingHospital(hos)} className="flex-1 p-3 bg-slate-50 rounded-2xl text-[10px] font-black uppercase tracking-widest text-brand-green hover:bg-brand-green/5">Update Facility</button>
                     <button onClick={() => onUpdateHospitals(hospitals.filter(h => h.id !== hos.id))} className="p-3 text-red-400 hover:bg-red-50 rounded-2xl transition-all"><Trash2 size={20} /></button>
                  </div>
               </div>
             ))}
          </div>
        </div>
      )}

      {activeTab === 'INFRA' && (
        <div className="space-y-6 animate-slide-up">
          <div className="flex justify-between items-center bg-white p-8 rounded-[2rem] border shadow-sm">
            <div>
               <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Hub Infrastructure Registry</h3>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lab locations & collection radius management</p>
            </div>
            <button onClick={() => setIsAddingLab(true)} className="bg-brand-purple text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg">
               <Building2 size={18} /> Add New HUB
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             {labs.map(lab => (
               <div key={lab.id} className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6 hover:shadow-xl transition-all border-l-8 border-l-brand-purple">
                  <div className="flex justify-between items-center">
                     <div className="p-4 bg-brand-purple/5 text-brand-purple rounded-3xl"><Building2 size={32} /></div>
                     <div className="text-right">
                        <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Node ID</span>
                        <span className="text-xl font-black text-slate-900">{lab.id}</span>
                     </div>
                  </div>
                  <div>
                     <h4 className="text-2xl font-black text-slate-900 tracking-tight">{lab.name}</h4>
                     <p className="text-xs font-bold text-slate-400 uppercase mt-2 leading-relaxed flex items-center gap-2">
                       <MapPin size={14} className="text-brand-purple" /> {lab.location.address}
                     </p>
                     <div className="mt-4 flex gap-4">
                        <div className="bg-slate-50 px-3 py-1.5 rounded-lg border">
                           <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Geofence</span>
                           <span className="text-xs font-black">{lab.geofenceRadiusMeters}m</span>
                        </div>
                        <div className="bg-slate-50 px-3 py-1.5 rounded-lg border">
                           <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Coordinates</span>
                           <span className="text-xs font-black">{lab.location.lat.toFixed(4)}, {lab.location.lng.toFixed(4)}</span>
                        </div>
                     </div>
                  </div>
                  <div className="pt-6 border-t border-slate-50 flex gap-4">
                     <button onClick={() => setEditingLab(lab)} className="flex-1 p-3 bg-slate-50 rounded-2xl text-[10px] font-black uppercase tracking-widest text-brand-purple hover:bg-brand-purple/5">Configure Hub</button>
                     <button onClick={() => onUpdateLabs(labs.filter(l => l.id !== lab.id))} className="p-3 text-red-400 hover:bg-red-50 rounded-2xl transition-all"><Trash2 size={20} /></button>
                  </div>
               </div>
             ))}
          </div>
        </div>
      )}

      {activeTab === 'CATALOG' && (
        <div className="space-y-6 animate-slide-up">
           <div className="flex justify-between items-center bg-white p-8 rounded-[2rem] border shadow-sm">
            <div>
               <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Diagnostic Service Catalogue</h3>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Enterprise grade test menu & pricing tiers</p>
            </div>
            <button onClick={() => setIsAddingTest(true)} className="bg-brand-purple text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg">
               <PlusCircle size={18} /> New Diagnostic Item
            </button>
          </div>

          <div className="bg-white rounded-[2rem] border shadow-sm overflow-hidden">
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                   <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <tr>
                        <th className="px-8 py-5">Diagnostic Identity</th>
                        <th className="px-8 py-5">Service Category</th>
                        <th className="px-8 py-5 text-center">Base Price</th>
                        <th className="px-8 py-5 text-right">Service Control</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                      {tests.map((test) => (
                        <tr key={test.id} className="hover:bg-slate-50/50 group transition-all">
                           <td className="px-8 py-6">
                              <div className="flex items-center gap-4">
                                 <div className="p-2.5 bg-brand-purple/5 text-brand-purple rounded-xl">
                                    <FlaskConical size={16} />
                                 </div>
                                 <span className="text-sm font-black text-slate-900 uppercase">{test.name}</span>
                              </div>
                           </td>
                           <td className="px-8 py-6">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{test.category}</span>
                           </td>
                           <td className="px-8 py-6 text-center">
                              <span className="text-sm font-black text-brand-purple">₹{test.price.toLocaleString()}</span>
                           </td>
                           <td className="px-8 py-6 text-right space-x-2">
                              <button onClick={() => setEditingTest(test)} className="p-2 text-slate-300 hover:text-brand-purple hover:bg-brand-purple/5 rounded-lg transition-all">
                                 <Edit3 size={18} />
                              </button>
                              <button onClick={() => onUpdateTests(tests.filter(t => t.id !== test.id))} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                                 <Trash size={18} />
                              </button>
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'FINANCE' && (
        <div className="space-y-6 animate-slide-up">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="bg-white p-10 rounded-[2.5rem] border shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Period Gross Revenue</p>
                <h3 className="text-5xl font-black text-brand-purple tracking-tighter">₹{stats.totalRevenue.toLocaleString()}</h3>
             </div>
             <div className="bg-white p-10 rounded-[2.5rem] border shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Incentives Disbursed</p>
                <h3 className="text-5xl font-black text-orange-600 tracking-tighter">₹{filteredHistory.reduce((a, b) => a + b.incentive, 0).toLocaleString()}</h3>
             </div>
             <div className="bg-white p-10 rounded-[2.5rem] border shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Total Handovers</p>
                <h3 className="text-5xl font-black text-brand-green tracking-tighter">{stats.totalSamples}</h3>
             </div>
          </div>

          <div className="bg-white p-8 rounded-[2rem] border shadow-sm">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                   <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Finance Ledger</h3>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Audit-ready operational ledger</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                   <div className="flex bg-slate-50 p-1.5 rounded-xl border gap-3 items-center">
                      <Calendar size={14} className="text-slate-400 ml-2" />
                      <input type="date" value={ledgerStartDate} onChange={e => setLedgerStartDate(e.target.value)} className="bg-transparent text-[10px] font-black outline-none" />
                      <span className="text-slate-300">to</span>
                      <input type="date" value={ledgerEndDate} onChange={e => setLedgerEndDate(e.target.value)} className="bg-transparent text-[10px] font-black outline-none" />
                   </div>
                   <button onClick={handlePrintLedger} className="p-3 bg-brand-purple text-white rounded-xl shadow-lg flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                      <Printer size={16} /> Print Report
                   </button>
                </div>
             </div>

             <div className="overflow-x-auto">
                <table className="w-full text-left">
                   <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <tr>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Patient</th>
                        <th className="px-6 py-4">Phlebo</th>
                        <th className="px-6 py-4">Revenue</th>
                        <th className="px-6 py-4">Incentive</th>
                        <th className="px-6 py-4 text-right">Payment</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                      {filteredHistory.map((h, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-all">
                           <td className="px-6 py-4 text-[11px] font-bold text-slate-500">{new Date(h.timestamp).toLocaleDateString()}</td>
                           <td className="px-6 py-4 text-sm font-black text-slate-900">{h.patientName}</td>
                           <td className="px-6 py-4 text-[11px] font-black text-brand-purple uppercase">{h.phleboName}</td>
                           <td className="px-6 py-4 text-sm font-black text-slate-900">₹{h.revenue}</td>
                           <td className="px-6 py-4 text-sm font-black text-brand-green">₹{h.incentive.toFixed(0)}</td>
                           <td className="px-6 py-4 text-right">
                              <span className="text-[10px] font-black uppercase text-slate-400 bg-slate-50 px-2 py-1 rounded-lg border">{h.paymentMode}</span>
                           </td>
                        </tr>
                      ))}
                      {filteredHistory.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-20 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">No entries found for selected period</td>
                        </tr>
                      )}
                   </tbody>
                </table>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'CONFIG' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-slide-up">
          {canEditSettings ? (
            <>
              <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-3 uppercase tracking-tight"><Settings className="text-brand-purple" /> Enterprise Standards</h3>
                <div className="space-y-8">
                  <div className="grid grid-cols-3 gap-6">
                     <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Within TAT Rate (₹/KM)</label>
                        <input type="number" value={editedConfig.withinTatRate} onChange={e => setEditedConfig({...editedConfig, withinTatRate: e.target.value as any})} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black text-lg text-brand-purple outline-none" />
                     </div>
                     <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Outside TAT Rate (₹/KM)</label>
                        <input type="number" value={editedConfig.outsideTatRate} onChange={e => setEditedConfig({...editedConfig, outsideTatRate: e.target.value as any})} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black text-lg text-brand-purple outline-none" />
                     </div>
                     <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Base Incentive (₹)</label>
                        <input type="number" value={editedConfig.baseIncentive} onChange={e => setEditedConfig({...editedConfig, baseIncentive: e.target.value as any})} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black text-lg text-brand-purple outline-none" />
                     </div>
                  </div>
                  <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Security Authorization PIN</label>
                     <input type="text" maxLength={4} value={editedConfig.securityPin} onChange={e => setEditedConfig({...editedConfig, securityPin: e.target.value})} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black text-2xl text-brand-purple tracking-[1em] text-center outline-none" />
                  </div>
                  <button onClick={() => { 
                    const parsedConfig = {
                      ...editedConfig,
                      withinTatRate: Number(editedConfig.withinTatRate),
                      outsideTatRate: Number(editedConfig.outsideTatRate),
                      baseIncentive: Number(editedConfig.baseIncentive),
                      tatBrackets: (editedConfig.tatBrackets || []).map(b => ({ maxKm: Number(b.maxKm), tatMinutes: Number(b.tatMinutes) }))
                    };
                    onUpdateConfig(parsedConfig); 
                    alert("Global enterprise standards updated."); 
                  }} className="w-full bg-brand-purple text-white py-6 rounded-2xl font-black uppercase tracking-[0.2em] shadow-2xl hover:bg-brand-purple/90 transition-all flex items-center justify-center gap-3">
                    <Save size={20} /> Synchronize Global Config
                  </button>
                </div>
              </div>

              <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-8">
                   <h3 className="text-xl font-black text-slate-900 flex items-center gap-3 uppercase tracking-tight"><Clock className="text-brand-purple" /> Multi-Hub TAT Matrix</h3>
                   <button onClick={handleAddTatBracket} className="p-2 text-brand-purple hover:bg-brand-purple/5 rounded-xl transition-all">
                      <PlusCircle size={24} />
                   </button>
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6 leading-relaxed">Dynamic TAT allocation based on radial distance from assignment hub.</p>
                
                <div className="space-y-4 flex-1 overflow-y-auto pr-2 no-scrollbar mb-6">
                   {(editedConfig.tatBrackets || []).map((bracket, idx) => (
                      <div key={idx} className="bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100 flex items-center gap-4 animate-slide-up">
                         <div className="flex-1">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Max Radius (KM)</label>
                            <input 
                               type="number" 
                               value={bracket.maxKm} 
                               onChange={e => handleUpdateTatBracket(idx, 'maxKm', e.target.value as any)}
                               className="w-full bg-white p-3 rounded-xl font-black text-slate-900 outline-none border focus:border-brand-purple"
                            />
                         </div>
                         <div className="flex-1">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Target TAT (Mins)</label>
                            <input 
                               type="number" 
                               value={bracket.tatMinutes} 
                               onChange={e => handleUpdateTatBracket(idx, 'tatMinutes', e.target.value as any)}
                               className="w-full bg-white p-3 rounded-xl font-black text-brand-purple outline-none border focus:border-brand-purple"
                            />
                         </div>
                         <button onClick={() => handleRemoveTatBracket(idx)} className="p-3 text-red-300 hover:text-red-500 transition-all mt-4">
                            <Trash2 size={18} />
                         </button>
                      </div>
                   ))}
                </div>
                <button onClick={() => { 
                  const parsedBrackets = [...(editedConfig.tatBrackets || [])].map(b => ({ maxKm: Number(b.maxKm), tatMinutes: Number(b.tatMinutes) })).sort((a,b) => a.maxKm - b.maxKm);
                  onUpdateConfig({...editedConfig, tatBrackets: parsedBrackets}); 
                  alert("TAT Matrix saved successfully."); 
                }} className="w-full bg-slate-900 text-white py-4 rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg">
                   <Save size={18} /> Save Matrix
                </button>
              </div>
            </>
          ) : (
            <div className="col-span-1 lg:col-span-2 bg-white p-12 rounded-[2.5rem] border shadow-sm animate-slide-up text-center">
                <Lock size={48} className="mx-auto text-slate-200 mb-4" />
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Access Denied</h3>
                <p className="text-sm text-slate-500 mt-2">You do not have sufficient privileges to modify system settings.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'PERFORMANCE' && (
        <div className="space-y-6 animate-slide-up">
          <div className="bg-white p-8 rounded-[2rem] border shadow-sm">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Performance Analytics</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AI-powered performance review</p>
          </div>
          <div className="bg-white rounded-[2rem] border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <tr>
                    <th className="px-8 py-5">Personnel</th>
                    <th className="px-8 py-5">AI Grade</th>
                    <th className="px-8 py-5">AI Feedback</th>
                    <th className="px-8 py-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {phleboList.map(p => (
                    <tr key={p.id}>
                      <td className="px-8 py-6">
                        <span className="text-sm font-black text-slate-900">{p.name}</span>
                      </td>
                      <td className="px-8 py-6">
                        {performanceReports[p.id] ? (
                          <span className='font-black text-2xl text-brand-purple'>{performanceReports[p.id].grade}</span>
                        ) : (
                          <span className='text-slate-300'>-</span>
                        )}
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-xs text-slate-600 max-w-md">{performanceReports[p.id]?.feedback}</p>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={async () => {
                              const relevantHistory = history.filter(h => h.phleboId === p.id);
                              const res = await fetch('/api/analyze-performance', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ phlebotomist: p, history: relevantHistory })
                              });
                              if (res.ok) {
                                const report = await res.json();
                                setPerformanceReports(prev => ({...prev, [p.id]: report}));
                              }
                            }}
                            className="bg-brand-purple text-white px-4 py-2 rounded-lg text-xs font-bold"
                          >
                            Analyze
                          </button>
                          <button 
                            onClick={async () => {
                              const res = await fetch(`/api/users/${p.id}/report-data`);
                              if (res.ok) {
                                const { user, calls } = await res.json();
                                const doc = new jsPDF();
                                doc.text(`Performance Report for ${user.name}`, 14, 16);
                                doc.setFontSize(12);
                                doc.text(`ID: ${user.id}`, 14, 24);
                                doc.text(`Grade: ${user.grade || 'N/A'}`, 14, 30);
                                doc.text(`Monthly Earnings: $${user.monthlyEarnings.toFixed(2)}`, 14, 36);
                                doc.text(`Completed Calls: ${user.completedCalls}`, 14, 42);

                                (doc as any).autoTable({
                                  startY: 50,
                                  head: [['ID', 'Patient', 'Status', 'Collected At', 'TAT / Trip Time (Mins)', 'Km Traveled']],
                                  body: calls.map((c: any) => {
                                    const tat = c.collectedAt && c.placedAt ? ((c.collectedAt - c.placedAt) / 60000).toFixed(2) : 'N/A';
                                    const tripTime = c.collectedAt && c.acceptedAt ? ((c.collectedAt - c.acceptedAt) / 60000).toFixed(2) : 'N/A';
                                    return [
                                      c.id,
                                      c.patientName,
                                      c.status,
                                      c.collectedAt ? new Date(c.collectedAt).toLocaleString() : 'N/A',
                                      `${tat}\n${tripTime}`,
                                      c.distance ? c.distance.toFixed(2) : 'N/A'
                                    ];
                                  }),
                                });

                                doc.save(`report-${user.id}.pdf`);
                              }
                            }}
                            className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2"
                          >
                            <Download size={14} /> Report
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      {editingTest && (
        <div className="fixed inset-0 bg-brand-purple/40 backdrop-blur-md z-[500] flex items-center justify-center p-6">
           <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-slide-up">
              <div className="p-10 bg-brand-purple text-white flex justify-between items-center">
                 <h3 className="text-xl font-black uppercase tracking-widest">Modify Diagnostic</h3>
                 <button onClick={() => setEditingTest(null)} className="bg-white/10 p-2 rounded-xl"><X /></button>
              </div>
              <form onSubmit={handleSaveEditedTest} className="p-10 space-y-6">
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Test Identity</label>
                    <input required value={editingTest.name} onChange={e => setEditingTest({...editingTest, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Price Tier (₹)</label>
                    <input required type="number" value={editingTest.price} onChange={e => setEditingTest({...editingTest, price: e.target.value as any})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xl text-brand-purple" />
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Patient Phone Number</label>
                    <input type="tel" value={editingTest.patientPhone || ''} onChange={e => setEditingTest({...editingTest, patientPhone: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" placeholder="e.g. 9876543210" />
                 </div>
                 <button type="submit" className="w-full bg-brand-green text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl">Update Catalogue</button>
              </form>
           </div>
        </div>
      )}

      {isRegisteringStaff && (
        <div className="fixed inset-0 bg-brand-purple/40 backdrop-blur-md z-[500] flex items-center justify-center p-6">
           <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
              <div className="p-10 bg-brand-purple text-white flex justify-between items-center sticky top-0 z-10">
                 <h3 className="text-xl font-black uppercase tracking-widest">Provision Personnel</h3>
                 <button onClick={() => setIsRegisteringStaff(false)} className="bg-white/10 p-2 rounded-xl"><X /></button>
              </div>
              <form onSubmit={handleRegisterStaff} className="p-10 space-y-6 overflow-y-auto no-scrollbar">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                       <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block flex items-center gap-2"><UserIcon size={12}/> Full Name</label>
                       <input required value={newStaff.name} onChange={e => setNewStaff({...newStaff, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 ring-brand-purple/20" />
                    </div>
                    <div>
                       <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block flex items-center gap-2"><Phone size={12}/> Mobile Node</label>
                       <input required type="tel" value={newStaff.phone} onChange={e => setNewStaff({...newStaff, phone: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 ring-brand-purple/20" />
                    </div>
                    <div>
                       <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block flex items-center gap-2"><Mail size={12}/> Email Address</label>
                       <input required type="email" value={newStaff.email} onChange={e => setNewStaff({...newStaff, email: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 ring-brand-purple/20" />
                    </div>
                    <div>
                       <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block flex items-center gap-2"><Fingerprint size={12}/> Aadhaar ID</label>
                       <input required value={newStaff.aadhaar} onChange={e => setNewStaff({...newStaff, aadhaar: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 ring-brand-purple/20" />
                    </div>
                    <div>
                       <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Age</label>
                       <input required type="number" value={newStaff.age} onChange={e => setNewStaff({...newStaff, age: e.target.value as any})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 ring-brand-purple/20" />
                    </div>
                    <div>
                       <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Sex</label>
                       <select required value={newStaff.sex} onChange={e => setNewStaff({...newStaff, sex: e.target.value as any})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 ring-brand-purple/20 appearance-none">
                          <option value="MALE">Male</option>
                          <option value="FEMALE">Female</option>
                          <option value="OTHER">Other</option>
                       </select>
                    </div>
                    <div>
                       <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block flex items-center gap-2"><Shield size={12}/> Enterprise Role</label>
                       <select required value={newStaff.role} onChange={e => setNewStaff({...newStaff, role: e.target.value as StaffRole})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 ring-brand-purple/20 appearance-none">
                          <option value="EMPLOYEE">Field Phlebotomist</option>
                          <option value="RECEPTION">Reception / Dispatch</option>
                          <option value="ADMIN">Lab Administrator</option>
                          <option value="ACCOUNT">Accountant</option>
                       </select>
                    </div>
                    <div>
                       <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block flex items-center gap-2"><Building2 size={12}/> Assigned Hub</label>
                       <select required value={newStaff.labId} onChange={e => setNewStaff({...newStaff, labId: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 ring-brand-purple/20 appearance-none">
                          <option value="">Select Lab Node</option>
                          {labs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                       </select>
                    </div>
                    <div>
                       <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Shift Start</label>
                       <input required type="time" value={newStaff.shiftStart} onChange={e => setNewStaff({...newStaff, shiftStart: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 ring-brand-purple/20" />
                    </div>
                    <div>
                       <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Shift End</label>
                       <input required type="time" value={newStaff.shiftEnd} onChange={e => setNewStaff({...newStaff, shiftEnd: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 ring-brand-purple/20" />
                    </div>
                 </div>
                 <button type="submit" className="w-full bg-brand-green text-white py-6 rounded-3xl font-black uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all mt-4">Complete Onboarding</button>
              </form>
           </div>
        </div>
      )}

      {isAddingHospital && (
        <div className="fixed inset-0 bg-brand-green/40 backdrop-blur-md z-[500] flex items-center justify-center p-6">
           <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-slide-up">
              <div className="p-10 bg-brand-green text-white flex justify-between items-center">
                 <h3 className="text-xl font-black uppercase tracking-widest">New Hospital Node</h3>
                 <button onClick={() => setIsAddingHospital(false)} className="bg-white/10 p-2 rounded-xl"><X /></button>
              </div>
              <form onSubmit={handleAddHospital} className="p-10 space-y-6">
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Facility Name</label>
                    <input required value={newHospital.name} onChange={e => setNewHospital({...newHospital, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Latitude</label>
                        <input required type="number" step="any" value={newHospital.lat} onChange={e => setNewHospital({...newHospital, lat: e.target.value as any})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Longitude</label>
                        <input required type="number" step="any" value={newHospital.lng} onChange={e => setNewHospital({...newHospital, lng: e.target.value as any})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
                    </div>
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Full Address</label>
                    <textarea required value={newHospital.address} onChange={e => setNewHospital({...newHospital, address: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold resize-none h-24" />
                 </div>
                 <button type="submit" className="w-full bg-brand-green text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl">Deploy Node</button>
              </form>
           </div>
        </div>
      )}

      {editingHospital && (
        <div className="fixed inset-0 bg-brand-green/40 backdrop-blur-md z-[500] flex items-center justify-center p-6">
           <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-slide-up">
              <div className="p-10 bg-brand-green text-white flex justify-between items-center">
                 <h3 className="text-xl font-black uppercase tracking-widest">Update Facility</h3>
                 <button onClick={() => setEditingHospital(null)} className="bg-white/10 p-2 rounded-xl"><X /></button>
              </div>
              <form onSubmit={handleSaveEditedHospital} className="p-10 space-y-6">
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Facility Name</label>
                    <input required value={editingHospital.name} onChange={e => setEditingHospital({...editingHospital, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Latitude</label>
                        <input required type="number" step="any" value={editingHospital.lat} onChange={e => setEditingHospital({...editingHospital, lat: e.target.value as any})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Longitude</label>
                        <input required type="number" step="any" value={editingHospital.lng} onChange={e => setEditingHospital({...editingHospital, lng: e.target.value as any})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
                    </div>
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Full Address</label>
                    <textarea required value={editingHospital.address} onChange={e => setEditingHospital({...editingHospital, address: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold resize-none h-24" />
                 </div>
                 <button type="submit" className="w-full bg-brand-purple text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl">Commit Changes</button>
              </form>
           </div>
        </div>
      )}

      {isAddingLab && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[500] flex items-center justify-center p-6">
           <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-slide-up">
              <div className="p-10 bg-slate-900 text-white flex justify-between items-center">
                 <h3 className="text-xl font-black uppercase tracking-widest">HUB Deployment</h3>
                 <button onClick={() => setIsAddingLab(false)} className="bg-white/10 p-2 rounded-xl"><X /></button>
              </div>
              <form onSubmit={handleAddLab} className="p-10 space-y-6">
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Lab / Hub Identity</label>
                    <input required value={newLab.name} onChange={e => setNewLab({...newLab, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Latitude</label>
                        <input required type="number" step="any" value={newLab.location?.lat} onChange={e => setNewLab({...newLab, location: {...newLab.location!, lat: e.target.value as any}})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Longitude</label>
                        <input required type="number" step="any" value={newLab.location?.lng} onChange={e => setNewLab({...newLab, location: {...newLab.location!, lng: e.target.value as any}})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
                    </div>
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Geofence Radius (Meters)</label>
                    <input required type="number" value={newLab.geofenceRadiusMeters} onChange={e => setNewLab({...newLab, geofenceRadiusMeters: e.target.value as any})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black" />
                 </div>
                 <button type="submit" className="w-full bg-brand-purple text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl">Activate Infrastructure</button>
              </form>
           </div>
        </div>
      )}

      {editingLab && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[500] flex items-center justify-center p-6">
           <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-slide-up">
              <div className="p-10 bg-slate-900 text-white flex justify-between items-center">
                 <h3 className="text-xl font-black uppercase tracking-widest">Update Hub Node</h3>
                 <button onClick={() => setEditingLab(null)} className="bg-white/10 p-2 rounded-xl"><X /></button>
              </div>
              <form onSubmit={handleSaveEditedLab} className="p-10 space-y-6">
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Hub Identity</label>
                    <input required value={editingLab.name} onChange={e => setEditingLab({...editingLab, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Latitude</label>
                        <input required type="number" step="any" value={editingLab.location.lat} onChange={e => setEditingLab({...editingLab, location: {...editingLab.location, lat: e.target.value as any}})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Longitude</label>
                        <input required type="number" step="any" value={editingLab.location.lng} onChange={e => setEditingLab({...editingLab, location: {...editingLab.location, lng: e.target.value as any}})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
                    </div>
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Geofence (Meters)</label>
                    <input required type="number" value={editingLab.geofenceRadiusMeters} onChange={e => setEditingLab({...editingLab, geofenceRadiusMeters: e.target.value as any})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black" />
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Address</label>
                    <textarea required value={editingLab.location.address} onChange={e => setEditingLab({...editingLab, location: {...editingLab.location, address: e.target.value}})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold resize-none" />
                 </div>
                 <button type="submit" className="w-full bg-brand-purple text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl">Update Infrastructure</button>
              </form>
           </div>
        </div>
      )}

      {isAddingTest && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[500] flex items-center justify-center p-6">
           <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-slide-up">
              <div className="p-10 bg-slate-900 text-white flex justify-between items-center">
                 <h3 className="text-xl font-black uppercase tracking-widest">Catalogue Addition</h3>
                 <button onClick={() => setIsAddingTest(false)} className="bg-white/10 p-2 rounded-xl"><X /></button>
              </div>
              <form onSubmit={handleAddTest} className="p-10 space-y-6">
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Test Identity</label>
                    <input required value={newTest.name} onChange={e => setNewTest({...newTest, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Service Category</label>
                    <input required value={newTest.category} onChange={e => setNewTest({...newTest, category: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Base Price (₹)</label>
                    <input required type="number" value={newTest.price} onChange={e => setNewTest({...newTest, price: e.target.value as any})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xl text-brand-purple" />
                 </div>
                 <button type="submit" className="w-full bg-brand-purple text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl">Commit to Global Catalog</button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
