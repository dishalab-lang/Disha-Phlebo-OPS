
// Fix: Added Truck and Clock to imports
import React, { useState, useMemo } from 'react';
import { CollectionCall, CallType, CallStatus, DiagnosticTest, PaymentMode } from '../types';
import { Plus, Building2, Home, MapPin, Search, X, Zap, Truck, Clock } from 'lucide-react';
import { TEST_CATALOG, DEFAULT_CONFIG } from '../constants';

interface DashboardProps {
  calls: CollectionCall[];
  onCreateCall: (call: Partial<CollectionCall>) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ calls, onCreateCall }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [testSearch, setTestSearch] = useState('');
  const [selectedTests, setSelectedTests] = useState<DiagnosticTest[]>([]);
  const [newCall, setNewCall] = useState({
    patientName: '',
    patientPhone: '',
    type: CallType.HOME_VISIT,
    address: '',
    isPriority: false
  });

  const filteredTests = useMemo(() => {
    return TEST_CATALOG.filter(t => 
      t.name.toLowerCase().includes(testSearch.toLowerCase()) && 
      !selectedTests.find(st => st.id === t.id)
    );
  }, [testSearch, selectedTests]);

  const subTotal = useMemo(() => selectedTests.reduce((acc, t) => acc + t.price, 0), [selectedTests]);
  const totalAmount = subTotal + (newCall.type === CallType.HOME_VISIT ? DEFAULT_CONFIG.flatCollectionCharge : 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTests.length === 0) return alert("Select tests.");
    onCreateCall({
      ...newCall,
      destination: { lat: 19.1, lng: 72.8, address: newCall.address },
      estimatedTatMinutes: newCall.isPriority ? 20 : 30,
      billing: {
        tests: selectedTests,
        subTotal,
        collectionCharge: newCall.type === CallType.HOME_VISIT ? DEFAULT_CONFIG.flatCollectionCharge : 0,
        totalAmount,
        paymentStatus: 'PENDING',
        paymentMode: PaymentMode.UNPAID
      }
    });
    setIsModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setNewCall({ patientName: '', patientPhone: '', type: CallType.HOME_VISIT, address: '', isPriority: false });
    setSelectedTests([]);
  };

  const toggleTest = (test: DiagnosticTest) => {
    if (selectedTests.find(t => t.id === test.id)) {
      setSelectedTests(selectedTests.filter(t => t.id !== test.id));
    } else {
      setSelectedTests([...selectedTests, test]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Dispatcher Hub</h2>
          <p className="text-sm text-slate-500 font-medium mt-2">Route calls to Disha's expert phlebotomy fleet</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-brand-green hover:bg-brand-green/90 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl transition-all flex items-center gap-3"
        >
          <Plus size={20} /> New Collection
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center">
           <div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Fleet</p>
             <h3 className="text-4xl font-black text-brand-purple mt-2">{calls.filter(c => c.status !== CallStatus.COMPLETED).length}</h3>
           </div>
           <div className="p-4 bg-brand-purple/5 rounded-2xl text-brand-purple"><Truck size={32} /></div>
        </div>
        <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center">
           <div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Priority Calls</p>
             <h3 className="text-4xl font-black text-orange-500 mt-2">{calls.filter(c => c.isPriority).length}</h3>
           </div>
           <div className="p-4 bg-orange-50 rounded-2xl text-orange-500"><Zap size={32} /></div>
        </div>
        <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center">
           <div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Today's Revenue</p>
             <h3 className="text-4xl font-black text-brand-green mt-2">₹{calls.filter(c => c.status === CallStatus.COMPLETED).reduce((acc, c) => acc + c.billing.totalAmount, 0).toLocaleString()}</h3>
           </div>
           <div className="p-4 bg-green-50 rounded-2xl text-brand-green">₹</div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex justify-between items-center">
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Operation Queue</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-8 py-5">Patient & Request</th>
                <th className="px-8 py-5">Workflow</th>
                <th className="px-8 py-5">Net Amount</th>
                <th className="px-8 py-5">Tier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {calls.map(call => (
                <tr key={call.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-slate-900">{call.patientName}</span>
                      <span className="text-[10px] text-brand-purple font-bold uppercase tracking-widest mt-1">{call.billing.tests.length} tests</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${call.status === CallStatus.PENDING ? 'bg-slate-100 text-slate-500' : 'bg-brand-purple/10 text-brand-purple'}`}>{call.status}</span>
                  </td>
                  <td className="px-8 py-6 font-black text-sm text-slate-700 tracking-tight">₹{call.billing.totalAmount}</td>
                  <td className="px-8 py-6">
                    {call.isPriority ? <span className="brand-gradient text-white p-1.5 rounded-lg shadow-sm block w-fit"><Zap size={14} /></span> : <span className="bg-slate-100 p-1.5 rounded-lg text-slate-400 block w-fit"><Clock size={14} /></span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-brand-purple/30 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white w-full max-w-5xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col md:flex-row h-[85vh]">
            <div className="flex-1 p-10 overflow-y-auto border-r border-slate-50">
              <h3 className="text-2xl font-black text-brand-purple mb-8">Service Request</h3>
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Patient Full Name</label>
                    <input required value={newCall.patientName} onChange={e => setNewCall({...newCall, patientName: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold focus:ring-2 ring-brand-purple outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Contact Link</label>
                    <input required type="tel" value={newCall.patientPhone} onChange={e => setNewCall({...newCall, patientPhone: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold focus:ring-2 ring-brand-purple outline-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Service Location</label>
                  <div className="flex gap-4">
                    <button type="button" onClick={() => setNewCall({...newCall, type: CallType.HOME_VISIT})} className={`flex-1 p-4 rounded-2xl border-2 font-black text-xs uppercase transition-all flex items-center justify-center gap-2 ${newCall.type === CallType.HOME_VISIT ? 'border-brand-purple bg-brand-purple/5 text-brand-purple' : 'border-slate-50 bg-slate-50 text-slate-400'}`}>
                      <Home size={18} /> Home Visit
                    </button>
                    <button type="button" onClick={() => setNewCall({...newCall, type: CallType.HOSPITAL})} className={`flex-1 p-4 rounded-2xl border-2 font-black text-xs uppercase transition-all flex items-center justify-center gap-2 ${newCall.type === CallType.HOSPITAL ? 'border-brand-purple bg-brand-purple/5 text-brand-purple' : 'border-slate-50 bg-slate-50 text-slate-400'}`}>
                      <Building2 size={18} /> Hospital Visit
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Full Destination Address</label>
                  <textarea required value={newCall.address} onChange={e => setNewCall({...newCall, address: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl h-28 font-bold focus:ring-2 ring-brand-purple outline-none resize-none" />
                </div>

                <label className="flex items-center gap-4 p-5 brand-gradient rounded-3xl cursor-pointer shadow-lg transform transition-all hover:scale-[1.01]">
                  <input type="checkbox" checked={newCall.isPriority} onChange={e => setNewCall({...newCall, isPriority: e.target.checked})} className="w-6 h-6 accent-white" />
                  <div className="text-white">
                    <span className="block text-sm font-black uppercase tracking-widest">Mark as Priority Call</span>
                    <span className="text-[10px] opacity-90 font-bold uppercase">Urgent 20-min target • 1.5x TA Multiplier</span>
                  </div>
                </label>

                <div className="flex gap-4 pt-6 border-t border-slate-50">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 font-black text-xs uppercase text-slate-400 tracking-widest">Cancel</button>
                  <button type="submit" className="flex-[2] bg-brand-purple text-white py-4 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl hover:bg-brand-purple/90">Deploy Phlebo</button>
                </div>
              </form>
            </div>

            <div className="flex-1 bg-slate-50/50 p-10 overflow-y-auto">
              <h3 className="text-2xl font-black text-slate-900 mb-8">Test Catalogue</h3>
              <div className="relative mb-6">
                <Search className="absolute left-4 top-4 text-slate-400" size={18} />
                <input 
                  placeholder="Search CBC, Lipid, Diabetes..." 
                  value={testSearch}
                  onChange={e => setTestSearch(e.target.value)}
                  className="w-full pl-12 p-4 bg-white border border-slate-200 rounded-2xl font-bold shadow-sm outline-none focus:ring-2 ring-brand-purple"
                />
              </div>

              <div className="space-y-3 mb-10 max-h-60 overflow-y-auto px-1">
                {filteredTests.map(test => (
                  <button key={test.id} onClick={() => toggleTest(test)} className="w-full p-4 bg-white border border-slate-100 rounded-2xl flex justify-between items-center hover:border-brand-purple hover:shadow-md transition-all group">
                    <div className="text-left">
                      <p className="text-sm font-black text-slate-900">{test.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{test.category}</p>
                    </div>
                    <span className="text-sm font-black text-brand-purple">₹{test.price}</span>
                  </button>
                ))}
              </div>

              <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-100">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Quote Breakdown</h4>
                <div className="space-y-4">
                  {selectedTests.map(t => (
                    <div key={t.id} className="flex justify-between items-center text-sm">
                      <span className="text-slate-600 font-bold flex items-center gap-2">
                        <X size={14} className="text-red-400 cursor-pointer" onClick={() => toggleTest(t)} /> {t.name}
                      </span>
                      <span className="font-black text-slate-900">₹{t.price}</span>
                    </div>
                  ))}
                  <div className="pt-6 border-t-2 border-dashed border-slate-100 space-y-3">
                    <div className="flex justify-between text-xs font-bold text-slate-400 uppercase">
                      <span>Subtotal</span>
                      <span>₹{subTotal}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-slate-400 uppercase">
                      <span>Collection (Disha)</span>
                      <span>₹{newCall.type === CallType.HOME_VISIT ? DEFAULT_CONFIG.flatCollectionCharge : 0}</span>
                    </div>
                    <div className="flex justify-between text-2xl font-black pt-4 text-brand-purple tracking-tight">
                      <span>Grand Total</span>
                      <span>₹{totalAmount}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
