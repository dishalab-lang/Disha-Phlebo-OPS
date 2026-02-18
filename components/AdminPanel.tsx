
// Fix: Added Truck to imports
import React, { useState, useMemo } from 'react';
import { SystemConfig, CallMetrics, Phlebotomist, PaymentMode, CollectionCall, CallStatus } from '../types';
import { 
  Settings, Zap, Save, Users, FlaskConical, Route, Clock, 
  MapPin, Camera, Megaphone, UserPlus, Trash2, X, Eye, Phone, IndianRupee, Sparkles, Wallet, History, Truck
} from 'lucide-react';
import { analyzePerformance } from '../services/geminiService';

interface AdminPanelProps {
  config: SystemConfig;
  onUpdateConfig: (config: SystemConfig) => void;
  history: CallMetrics[];
  phlebotomist: Phlebotomist;
  phleboList: Phlebotomist[];
  activeCalls: CollectionCall[];
  onUpdateShift: (id: string, start: string, end: string) => void;
  onRegisterPhlebo: (p: Partial<Phlebotomist>) => void;
  onRemovePhlebo: (id: string) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ config, onUpdateConfig, history, phleboList, activeCalls, onUpdateShift, onRegisterPhlebo, onRemovePhlebo }) => {
  const [activeTab, setActiveTab] = useState<'CONFIG' | 'FINANCE' | 'FLEET' | 'TRACKER' | 'ROSTER'>('FLEET');
  const [editedConfig, setEditedConfig] = useState(config);
  const [announcementText, setAnnouncementText] = useState(config.announcement || '');
  const [loading, setLoading] = useState(false);
  const [selectedCall, setSelectedCall] = useState<CollectionCall | null>(null);

  const [isRegistering, setIsRegistering] = useState(false);
  const [newPhlebo, setNewPhlebo] = useState({ name: '', phone: '', shiftStart: '09:00', shiftEnd: '18:00' });

  const stats = useMemo(() => {
    const totalRevenue = history.reduce((sum, item) => sum + item.revenue, 0);
    const totalKm = history.reduce((sum, item) => sum + item.distance, 0);
    const avgTat = history.length > 0 ? history.reduce((sum, item) => sum + item.totalTat, 0) / history.length : 0;
    return { totalRevenue, totalKm, totalSamples: history.length, avgTat, premiumCount: history.filter(h => h.isPremiumIncentive).length };
  }, [history]);

  const phleboStats = useMemo(() => {
    return phleboList.map(p => {
      const pHistory = history.filter(h => h.phleboId === p.id);
      return { ...p, totalKm: pHistory.reduce((sum, h) => sum + h.distance, 0), samplesCollected: pHistory.length };
    });
  }, [phleboList, history]);

  const publishAnnouncement = () => {
    onUpdateConfig({ ...config, announcement: announcementText });
    alert("Flash broadcasted.");
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    onRegisterPhlebo(newPhlebo);
    setIsRegistering(false);
    setNewPhlebo({ name: '', phone: '', shiftStart: '09:00', shiftEnd: '18:00' });
  };

  const NavBtn = ({ label, tab }: { label: string, tab: typeof activeTab }) => (
    <button onClick={() => setActiveTab(tab)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === tab ? 'bg-brand-purple text-white shadow-lg' : 'text-slate-500 hover:text-brand-purple'}`}>{label}</button>
  );

  return (
    <div className="space-y-6 pb-20">
      <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 w-fit overflow-x-auto shadow-sm">
        <NavBtn label="Operations" tab="FLEET" />
        <NavBtn label="Staffing" tab="ROSTER" />
        <NavBtn label="Monitoring" tab="TRACKER" />
        <NavBtn label="Ledger" tab="FINANCE" />
        <NavBtn label="System" tab="CONFIG" />
      </div>

      {activeTab === 'FLEET' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
             <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-brand-purple/5 -mr-12 -mt-12 rounded-full"></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Total Fleet</p>
                <div className="flex items-center justify-between">
                   <h3 className="text-4xl font-black text-slate-900">{phleboList.length}</h3>
                   <div className="p-3 bg-brand-purple/10 text-brand-purple rounded-2xl"><Users size={24} /></div>
                </div>
             </div>
             <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Daily Samples</p>
                <div className="flex items-center justify-between">
                   <h3 className="text-4xl font-black text-brand-green">{stats.totalSamples}</h3>
                   <div className="p-3 bg-green-50 text-brand-green rounded-2xl"><FlaskConical size={24} /></div>
                </div>
             </div>
             <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Urgent Premium</p>
                <div className="flex items-center justify-between">
                   <h3 className="text-4xl font-black text-orange-600">{stats.premiumCount}</h3>
                   <div className="p-3 bg-orange-50 text-orange-600 rounded-2xl"><Zap size={24} /></div>
                </div>
             </div>
             <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Fleet TAT</p>
                <div className="flex items-center justify-between">
                   <h3 className="text-4xl font-black text-brand-purple">{stats.avgTat.toFixed(1)}m</h3>
                   <div className="p-3 bg-brand-purple/5 text-brand-purple rounded-2xl"><Clock size={24} /></div>
                </div>
             </div>
          </div>

          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-50">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Fleet Real-time Status</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <tr>
                    <th className="px-8 py-5">Phlebotomist</th>
                    <th className="px-8 py-5 text-center">Location</th>
                    <th className="px-8 py-5 text-center">Working</th>
                    <th className="px-8 py-5 text-center">Earnings (MTD)</th>
                    <th className="px-8 py-5 text-right">Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {phleboStats.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="px-8 py-6">
                         <div className="flex items-center gap-4">
                           <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${p.name}`} className="w-12 h-12 rounded-2xl border bg-slate-50" alt="" />
                           <div className="flex flex-col">
                              <span className="text-sm font-black text-slate-900">{p.name}</span>
                              <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{p.phone}</span>
                           </div>
                         </div>
                      </td>
                      <td className="px-8 py-6 text-center">
                        <span className="text-[10px] text-brand-purple font-black flex items-center justify-center gap-1.5 uppercase tracking-tighter">
                          <MapPin size={12} /> {p.currentLocation ? `${p.currentLocation.lat.toFixed(4)}` : 'Offline'}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-center">
                         <div className="flex items-center justify-center gap-2">
                           <div className={`w-2.5 h-2.5 rounded-full ${p.isAvailable ? 'bg-brand-green shadow-[0_0_10px_rgba(41,166,67,0.4)]' : 'bg-brand-purple shadow-[0_0_10px_rgba(95,37,159,0.4)]'}`}></div>
                           <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{p.isAvailable ? 'IDLE' : 'TASK'}</span>
                         </div>
                      </td>
                      <td className="px-8 py-6 text-center">
                         <span className="font-black text-brand-green tracking-tight">₹{p.monthlyEarnings.toLocaleString()}</span>
                      </td>
                      <td className="px-8 py-6 text-right">
                         <span className={`px-3 py-1 rounded-lg text-[10px] font-black border tracking-widest ${p.grade === 'A' ? 'bg-green-50 border-brand-green text-brand-green' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>GRADE {p.grade}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ROSTER' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
             <h3 className="text-2xl font-black text-slate-900 tracking-tight">Fleet Deployment</h3>
             <button onClick={() => setIsRegistering(true)} className="bg-brand-purple text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl flex items-center gap-3">
                <UserPlus size={18} /> Add New Staff
             </button>
          </div>

          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                   <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <tr>
                        <th className="px-8 py-5">Identification</th>
                        <th className="px-8 py-5 text-center">Shift Roster</th>
                        <th className="px-8 py-5 text-center">Credential</th>
                        <th className="px-8 py-5 text-right">Actions</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                      {phleboList.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50/50">
                           <td className="px-8 py-6">
                              <div className="flex items-center gap-4">
                                 <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${p.name}`} className="w-10 h-10 rounded-2xl border" alt="" />
                                 <span className="text-sm font-black text-slate-900 tracking-tight">{p.name}</span>
                              </div>
                           </td>
                           <td className="px-8 py-6 text-center">
                              <div className="inline-flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-2 shadow-inner">
                                 <input type="time" value={p.shiftStart} onChange={(e) => onUpdateShift(p.id, e.target.value, p.shiftEnd)} className="bg-transparent text-[10px] font-black outline-none" />
                                 <span className="text-slate-300 font-bold">»</span>
                                 <input type="time" value={p.shiftEnd} onChange={(e) => onUpdateShift(p.id, p.shiftStart, e.target.value)} className="bg-transparent text-[10px] font-black outline-none" />
                              </div>
                           </td>
                           <td className="px-8 py-6 text-center font-black text-[10px] text-slate-400 uppercase tracking-widest">{p.phone}</td>
                           <td className="px-8 py-6 text-right">
                              <button onClick={() => onRemovePhlebo(p.id)} className="p-3 text-red-400 hover:bg-red-50 rounded-2xl transition-all">
                                 <Trash2 size={20} />
                              </button>
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>

          {isRegistering && (
             <div className="fixed inset-0 bg-brand-purple/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden">
                   <div className="p-8 bg-brand-purple text-white flex justify-between items-center">
                      <h3 className="font-black text-lg uppercase tracking-widest flex items-center gap-3"><UserPlus /> Onboarding</h3>
                      <button onClick={() => setIsRegistering(false)} className="bg-white/10 p-2 rounded-xl"><X size={20} /></button>
                   </div>
                   <form onSubmit={handleRegister} className="p-10 space-y-6">
                      <div>
                         <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Legal Name</label>
                         <input required value={newPhlebo.name} onChange={e => setNewPhlebo({...newPhlebo, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" placeholder="Staff Name" />
                      </div>
                      <div>
                         <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Primary Mobile</label>
                         <input required value={newPhlebo.phone} onChange={e => setNewPhlebo({...newPhlebo, phone: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" placeholder="98765..." />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Login</label>
                            <input type="time" value={newPhlebo.shiftStart} onChange={e => setNewPhlebo({...newPhlebo, shiftStart: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" />
                         </div>
                         <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Logout</label>
                            <input type="time" value={newPhlebo.shiftEnd} onChange={e => setNewPhlebo({...newPhlebo, shiftEnd: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" />
                         </div>
                      </div>
                      <button type="submit" className="w-full bg-brand-green text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] transition-all mt-4">Confirm Registration</button>
                   </form>
                </div>
             </div>
          )}
        </div>
      )}

      {activeTab === 'TRACKER' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[70vh]">
          <div className="lg:col-span-1 bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
            <div className="p-8 border-b border-slate-50">
              <h3 className="font-black text-slate-900 flex items-center gap-3 uppercase text-sm tracking-tight"><Megaphone className="text-brand-purple" /> Flash Update</h3>
            </div>
            <div className="p-8 space-y-6">
              <textarea 
                value={announcementText}
                onChange={e => setAnnouncementText(e.target.value)}
                placeholder="Broadcast to all phlebos..."
                className="w-full h-48 p-5 bg-slate-50 border border-slate-100 rounded-3xl resize-none text-sm font-medium outline-none focus:ring-2 ring-brand-purple"
              />
              <button onClick={publishAnnouncement} className="w-full bg-brand-purple text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl hover:bg-brand-purple/90 transition-all flex items-center justify-center gap-3">
                <Megaphone size={18} /> Flash Now
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col relative">
            <div className="p-8 border-b border-slate-50">
               <h3 className="font-black text-slate-900 uppercase text-sm tracking-tight">Live Operations Feed</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-center text-slate-300">
               <Truck size={64} className="opacity-10 mb-6" />
               <p className="font-black text-xs uppercase tracking-widest">Waiting for field activity...</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'FINANCE' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Total Revenue</p>
                <div className="flex items-center justify-between">
                   <h3 className="text-5xl font-black text-brand-purple tracking-tighter">₹{stats.totalRevenue.toLocaleString()}</h3>
                   <div className="p-4 bg-brand-purple/5 text-brand-purple rounded-3xl"><IndianRupee size={32} /></div>
                </div>
             </div>
             <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Fleet Travel Allowance</p>
                <div className="flex items-center justify-between">
                   <h3 className="text-5xl font-black text-orange-600 tracking-tighter">₹{history.reduce((a, b) => a + b.incentive, 0).toLocaleString()}</h3>
                   <div className="p-4 bg-orange-50 text-orange-600 rounded-3xl"><Route size={32} /></div>
                </div>
             </div>
             <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Digital Payments</p>
                <div className="flex items-center justify-between">
                   <h3 className="text-5xl font-black text-brand-green tracking-tighter">
                      {history.length > 0 ? Math.round((history.filter(h => h.paymentMode === PaymentMode.UPI).length / history.length) * 100) : 0}%
                   </h3>
                   <div className="p-4 bg-green-50 text-brand-green rounded-3xl"><Wallet size={32} /></div>
                </div>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'CONFIG' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
              <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-3 uppercase tracking-tight"><Settings className="text-brand-purple" /> Operational Rates</h3>
              <div className="space-y-8">
                <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Within TAT Efficiency (₹/KM)</label>
                   <input type="number" value={editedConfig.withinTatRate} onChange={e => setEditedConfig({...editedConfig, withinTatRate: parseFloat(e.target.value)})} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black text-lg text-brand-purple outline-none" />
                </div>
                <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Base Travel Rate (₹/KM)</label>
                   <input type="number" value={editedConfig.outsideTatRate} onChange={e => setEditedConfig({...editedConfig, outsideTatRate: parseFloat(e.target.value)})} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black text-lg text-brand-purple outline-none" />
                </div>
                <button onClick={() => { onUpdateConfig(editedConfig); alert("Rates updated."); }} className="w-full bg-brand-purple text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-2xl hover:bg-brand-purple/90 transition-all flex items-center justify-center gap-3">
                  <Save size={20} /> Deploy Configuration
                </button>
              </div>
           </div>
           <div className="bg-[#5F259F] text-white p-10 rounded-[2.5rem] shadow-2xl flex flex-col justify-center">
              <h3 className="text-xl font-black mb-8 flex items-center gap-3 uppercase tracking-tight"><Sparkles /> Disha Smart Incentives</h3>
              <div className="space-y-6 text-xs font-bold leading-relaxed opacity-90 uppercase tracking-wider">
                 <p className="border-l-4 border-white/20 pl-6 py-2">Flash priority: 1.5x allowance applied instantly to critical diagnostic requests.</p>
                 <p className="border-l-4 border-white/20 pl-6 py-2">Off-duty support: +/- 1 hr grace period beyond shift hours rewarded at premium rates.</p>
                 <p className="border-l-4 border-white/20 pl-6 py-2">Efficiency bonus: Optimized for Disha's 30-min TAT standards.</p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
