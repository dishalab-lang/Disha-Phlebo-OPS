
import React, { useState, useMemo, useEffect } from 'react';
import { CollectionCall, CallType, CallStatus, DiagnosticTest, PaymentMode, SystemConfig, Phlebotomist, DiagnosticLab, ConvenienceTier, Hospital } from './types';
import { Plus, Building2, Home, MapPin, Search, X, Zap, Truck, Clock, CheckCircle2, FlaskConical, Send, Radar, Share2, FileText, Key, Info, Banknote, ShieldCheck, Map as MapIcon, ChevronRight, PlusCircle } from 'lucide-react';
import { TEST_CATALOG } from './constants';
import { RadarMap } from './AdminPanel';
import { calculateDistance } from './geoUtils';

interface DashboardProps {
  calls: CollectionCall[];
  config: SystemConfig;
  labs: DiagnosticLab[];
  hospitals: Hospital[];
  phleboList: Phlebotomist[];
  onCreateCall: (call: Partial<CollectionCall>) => void;
  onUpdateStatus?: (id: string, status: CallStatus) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ calls, config, labs, hospitals, phleboList, onCreateCall, onUpdateStatus }) => {
  const [activeTab, setActiveTab] = useState<'QUEUE' | 'RADAR'>('QUEUE');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [testSearch, setTestSearch] = useState('');
  const [selectedTests, setSelectedTests] = useState<DiagnosticTest[]>([]);
  
  const [newCall, setNewCall] = useState({
    patientName: '',
    patientPhone: '',
    type: CallType.HOME_VISIT,
    address: '',
    isPriority: false,
    manualVisitCharge: 0,
    isWaived: false,
    selectedLabId: labs[0]?.id || '',
    generatedDestination: { lat: 19.1, lng: 72.8 },
    selectedHospitalName: ''
  });

  useEffect(() => {
    if (labs.length > 0 && !newCall.selectedLabId) {
      setNewCall(prev => ({ ...prev, selectedLabId: labs[0].id }));
    }
  }, [labs, newCall.selectedLabId]);

  useEffect(() => {
    if (isModalOpen && newCall.type === CallType.HOME_VISIT) {
       const baseLab = labs.find(l => l.id === newCall.selectedLabId) || labs[0];
       if (baseLab && !newCall.selectedHospitalName) {
         setNewCall(prev => ({
           ...prev,
           generatedDestination: {
             lat: baseLab.location.lat + (Math.random() - 0.5) * 0.05,
             lng: baseLab.location.lng + (Math.random() - 0.5) * 0.05
           }
         }));
       }
    }
  }, [isModalOpen, newCall.selectedLabId, labs, newCall.type]);

  const distanceToSelectedHub = useMemo(() => {
    const hub = labs.find(l => l.id === newCall.selectedLabId) || labs[0];
    if (!hub) return 0;
    return calculateDistance(hub.location, { lat: newCall.generatedDestination.lat, lng: newCall.generatedDestination.lng, address: '' });
  }, [newCall.generatedDestination, newCall.selectedLabId, labs]);

  const activeTier = useMemo(() => {
    return config.convenienceMatrix.find(t => distanceToSelectedHub >= t.minKm && distanceToSelectedHub < t.maxKm) || config.convenienceMatrix[config.convenienceMatrix.length - 1];
  }, [distanceToSelectedHub, config.convenienceMatrix]);

  useEffect(() => {
    if (isModalOpen) {
      setNewCall(prev => ({
        ...prev,
        manualVisitCharge: activeTier.fee,
        isWaived: activeTier.fee === 0
      }));
    }
  }, [isModalOpen, activeTier]);

  const filteredTests = useMemo(() => {
    const query = testSearch.toLowerCase();
    return TEST_CATALOG.filter(t => 
      t.name.toLowerCase().includes(query) || 
      t.category.toLowerCase().includes(query)
    );
  }, [testSearch]);

  const subTotal = useMemo(() => selectedTests.reduce((acc, t) => acc + t.price, 0), [selectedTests]);
  const currentVisitCharge = newCall.isWaived ? 0 : newCall.manualVisitCharge;
  const totalAmount = subTotal + (newCall.type === CallType.HOME_VISIT ? currentVisitCharge : 0);

  const toggleTest = (test: DiagnosticTest) => {
    if (selectedTests.find(t => t.id === test.id)) {
      setSelectedTests(selectedTests.filter(t => t.id !== test.id));
    } else {
      setSelectedTests([...selectedTests, test]);
    }
  };

  const handleHospitalSelect = (hospital: Hospital) => {
    setNewCall({
      ...newCall,
      selectedHospitalName: hospital.name,
      address: hospital.address,
      generatedDestination: { lat: hospital.lat, lng: hospital.lng }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTests.length === 0) {
      alert("Error: Please select diagnostic items from the catalogue.");
      return;
    }
    if (!newCall.address.trim() || !newCall.patientName.trim()) {
      alert("Error: All fields are mandatory.");
      return;
    }

    onCreateCall({
      patientName: newCall.patientName,
      patientPhone: newCall.patientPhone,
      type: newCall.type,
      isPriority: newCall.isPriority,
      labId: newCall.selectedLabId,
      destination: { 
        lat: newCall.generatedDestination.lat, 
        lng: newCall.generatedDestination.lng, 
        address: newCall.selectedHospitalName ? `${newCall.selectedHospitalName} - ${newCall.address}` : newCall.address 
      },
      estimatedTatMinutes: newCall.isPriority ? 30 : 60,
      billing: {
        tests: selectedTests,
        subTotal,
        collectionCharge: newCall.type === CallType.HOME_VISIT ? currentVisitCharge : 0,
        totalAmount,
        paymentStatus: 'PENDING',
        paymentMode: PaymentMode.UNPAID
      }
    });
    
    setIsModalOpen(false);
    setSelectedTests([]);
    setNewCall({
      patientName: '',
      patientPhone: '',
      type: CallType.HOME_VISIT,
      address: '',
      isPriority: false,
      manualVisitCharge: 0,
      isWaived: false,
      selectedLabId: labs[0]?.id || '',
      generatedDestination: { lat: 19.1, lng: 72.8 },
      selectedHospitalName: ''
    });
  };

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight uppercase">Dispatcher Portal</h2>
          <div className="flex bg-white p-1 rounded-2xl border shadow-sm mt-3 gap-1">
             <button onClick={() => setActiveTab('QUEUE')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'QUEUE' ? 'bg-brand-purple text-white' : 'text-slate-400'}`}>Queue</button>
             <button onClick={() => setActiveTab('RADAR')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'RADAR' ? 'bg-brand-purple text-white' : 'text-slate-400'}`}>Fleet</button>
          </div>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="w-full md:w-auto bg-brand-green text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center gap-3">
          <Plus size={20} /> Deploy Call
        </button>
      </div>

      {activeTab === 'RADAR' ? (
        <RadarMap phleboList={phleboList} activeCalls={calls} />
      ) : (
        <div className="bg-white rounded-[2rem] border shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex justify-between items-center">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Active deployments</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <tr>
                  <th className="px-6 py-4">Patient</th>
                  <th className="px-6 py-4 text-center">Authorization PIN</th>
                  <th className="px-6 py-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {calls.map(call => (
                  <tr key={call.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-6">
                      <span className="text-sm font-black text-slate-900 block">{call.patientName}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase">{call.billing.tests.length} Tests</span>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <span className="text-sm font-black text-brand-purple bg-brand-purple/5 px-4 py-2 rounded-xl border border-brand-purple/20 font-mono tracking-widest">
                        {call.verificationCode}
                      </span>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${call.status === CallStatus.PENDING ? 'bg-slate-50 text-slate-400' : 'bg-brand-purple/5 text-brand-purple'}`}>
                        {call.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl flex items-center justify-center z-[200] p-4 lg:p-6">
          <div className="bg-white w-full max-w-6xl rounded-[2rem] lg:rounded-[4rem] shadow-2xl overflow-hidden flex flex-col lg:flex-row h-[95vh] lg:h-[90vh]">
            <div className="flex-[1.2] p-6 lg:p-12 overflow-y-auto border-r border-slate-100 space-y-8 scroll-smooth">
              <h3 className="text-2xl font-black text-brand-purple uppercase">Call Placement</h3>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <input required placeholder="Patient Name" value={newCall.patientName} onChange={e => setNewCall({...newCall, patientName: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" />
                  <input required type="tel" placeholder="Mobile" value={newCall.patientPhone} onChange={e => setNewCall({...newCall, patientPhone: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" />
                </div>
                
                <div className="bg-slate-50 p-6 rounded-3xl border">
                   <p className="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest">Select Diagnostic Tests</p>
                   <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto no-scrollbar">
                      {filteredTests.map(test => {
                        const isSelected = !!selectedTests.find(t => t.id === test.id);
                        return (
                          <button key={test.id} type="button" onClick={() => toggleTest(test)} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all border-2 ${isSelected ? 'bg-brand-purple text-white' : 'bg-white text-slate-400'}`}>
                             {test.name}
                          </button>
                        );
                      })}
                   </div>
                </div>

                <div className="flex gap-4">
                  <button type="button" onClick={() => setNewCall({...newCall, type: CallType.HOME_VISIT, selectedHospitalName: ''})} className={`flex-1 p-6 rounded-2xl border-2 font-black text-[10px] uppercase transition-all ${newCall.type === CallType.HOME_VISIT ? 'border-brand-purple bg-brand-purple/5' : 'bg-white'}`}>
                    <Home size={24} className="mx-auto mb-2" /> Home
                  </button>
                  <button type="button" onClick={() => setNewCall({...newCall, type: CallType.HOSPITAL})} className={`flex-1 p-6 rounded-2xl border-2 font-black text-[10px] uppercase transition-all ${newCall.type === CallType.HOSPITAL ? 'border-brand-purple bg-brand-purple/5' : 'bg-white'}`}>
                    <Building2 size={24} className="mx-auto mb-2" /> Hospital
                  </button>
                </div>

                {newCall.type === CallType.HOSPITAL && (
                  <div className="bg-slate-50 p-6 rounded-3xl border animate-slide-up">
                    <p className="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest flex items-center gap-2"><Building2 size={12}/> Select Medical Facility</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {hospitals.map(h => (
                        <button 
                          key={h.id} 
                          type="button" 
                          onClick={() => handleHospitalSelect(h)}
                          className={`px-3 py-3 rounded-xl text-[9px] font-black uppercase transition-all border-2 flex flex-col items-center justify-center text-center gap-1 ${newCall.selectedHospitalName === h.name ? 'border-brand-purple bg-brand-purple/10 text-brand-purple' : 'bg-white border-slate-100 text-slate-400'}`}
                        >
                          <span className="truncate w-full">{h.name}</span>
                          <span className="text-[7px] opacity-60 font-bold truncate w-full">{h.address.split(',')[0]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <textarea required placeholder="Full Collection Address..." value={newCall.address} onChange={e => setNewCall({...newCall, address: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-2xl h-24 font-bold resize-none" />

                <div className="pt-8 flex gap-4">
                   <button onClick={() => setIsModalOpen(false)} className="px-10 font-black text-[10px] uppercase text-slate-400">Cancel</button>
                   <button type="submit" className="flex-1 bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl flex items-center justify-center gap-3">
                     <Send size={18} /> Deploy Call
                   </button>
                </div>
              </form>
            </div>
            
            <div className="flex-1 bg-slate-50/50 p-6 lg:p-12 overflow-y-auto hidden lg:block">
               <h3 className="text-xl font-black text-slate-900 mb-8 uppercase tracking-widest">Active Quote</h3>
               {selectedTests.length > 0 ? (
                  <div className="bg-white p-8 rounded-[2.5rem] border-4 border-brand-purple/5 shadow-2xl">
                     <div className="space-y-3">
                        {selectedTests.map(t => (
                           <div key={t.id} className="flex justify-between items-center text-xs border-b border-slate-50 pb-2">
                              <span className="font-black text-slate-800">{t.name}</span>
                              <span className="font-black text-slate-900">₹{t.price}</span>
                           </div>
                        ))}
                        <div className="flex justify-between items-baseline pt-4">
                           <span className="text-[10px] font-black text-brand-purple uppercase">Total Payable</span>
                           <span className="text-4xl font-black text-brand-purple">₹{totalAmount.toLocaleString()}</span>
                        </div>
                     </div>
                  </div>
               ) : (
                 <div className="flex-1 flex flex-col items-center justify-center text-slate-300 opacity-50 py-32">
                    <FlaskConical size={64} className="mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-center">Add diagnostic items to<br/>generate quotation</p>
                 </div>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
