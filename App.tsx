
import React, { useState, useEffect, useCallback } from 'react';
import { 
  LogIn, Lock, User, ShieldCheck, PlayCircle, Fingerprint, ShieldAlert, Clock, Smartphone, Download, Monitor, Share2, Truck, Plus, Send, LayoutGrid, BarChart3, Settings as SettingsIcon, Wallet, Info
} from 'lucide-react';
import { 
  CallStatus, CollectionCall, Phlebotomist, 
  SystemConfig, CallMetrics, Location, CallType, PaymentMode, TatBracket, DiagnosticTest, StaffRole, UserStatus, Appointment, DiagnosticLab, Hospital
} from './types';
import { INITIAL_CONFIG, MOCK_TESTS, MOCK_LABS, MOCK_HOSPITALS } from './mockData';
import { LogoBird } from './LogoBird';
import { calculateDistance } from './geoUtils';

// Components
import Dashboard from './Dashboard';
import PhleboApp from './PhleboApp';
import AdminPanel from './AdminPanel';

type MauiRoute = 'FIELD' | 'DISPATCH' | 'ADMIN' | 'PROFILE';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('MAUI_SHELL_AUTH') === 'true';
  });
  
  const [loginForm, setLoginForm] = useState({ userId: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [activeRoute, setActiveRoute] = useState<MauiRoute>('FIELD');
  const [config, setConfig] = useState<SystemConfig>(INITIAL_CONFIG);
  const [tests, setTests] = useState<DiagnosticTest[]>(MOCK_TESTS);
  const [labs, setLabs] = useState<DiagnosticLab[]>(MOCK_LABS);
  const [hospitals, setHospitals] = useState<Hospital[]>(MOCK_HOSPITALS);
  const [calls, setCalls] = useState<CollectionCall[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [performanceHistory, setPerformanceHistory] = useState<CallMetrics[]>([]);
  const [allPhlebos, setAllPhlebos] = useState<Phlebotomist[]>([]);

  const [currentUser, setCurrentUser] = useState<Phlebotomist | null>(() => {
    return null;
  });

  const fetchData = useCallback(async () => {
    try {
      const [callsRes, usersRes] = await Promise.all([
        fetch('/api/calls'),
        fetch('/api/users')
      ]);
      if (callsRes.ok) setCalls(await callsRes.json());
      if (usersRes.ok) setAllPhlebos(await usersRes.json());
    } catch (e) {
      console.error("Fetch error:", e);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [fetchData]);

  // Sync currentUser with latest allPhlebos state
  useEffect(() => {
    const id = sessionStorage.getItem('MAUI_USER_ID');
    if (id) {
      const user = allPhlebos.find(p => p.id === id);
      if (user) setCurrentUser(user);
    }
  }, [allPhlebos]);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const recordMetrics = useCallback((metrics: CallMetrics) => {
    setPerformanceHistory(prev => [metrics, ...prev]);
    setAllPhlebos(prev => prev.map(p => {
      if (p.id === metrics.phleboId) {
        return {
          ...p,
          completedCalls: p.completedCalls + 1,
          monthlyEarnings: p.monthlyEarnings + metrics.incentive
        };
      }
      return p;
    }));
  }, []);

  const handleCreateCall = useCallback(async (call: Partial<CollectionCall>) => {
    const now = Date.now();
    const newCallObj: CollectionCall = {
      ...call,
      id: 'D' + Date.now(),
      status: CallStatus.PENDING,
      labId: call.labId || (labs.length > 0 ? labs[0].id : ''),
      placedAt: now,
      verificationCode: Math.floor(1000 + Math.random() * 9000).toString(),
      otpGeneratedAt: now,
      otpExpiresAt: now + (10 * 60 * 1000), // 10 minutes
      otpRetryCount: 0,
      isOtpLocked: false,
    } as CollectionCall;

    try {
      const res = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser?.id || 'system' },
        body: JSON.stringify(newCallObj)
      });
      if (res.ok) {
        setCalls(prev => [newCallObj, ...prev]);
        setToast({ message: `Deployment Active: ${newCallObj.patientName} (PIN: ${newCallObj.verificationCode})`, type: 'success' });
        fetchData();
      }
    } catch (e) {
      setToast({ message: "Failed to deploy call", type: 'info' });
    }
  }, [labs, currentUser]);



  const handleResendOtp = useCallback(async (callId: string) => {
    const now = Date.now();
    const newPin = Math.floor(1000 + Math.random() * 9000).toString();
    const updates = {
      verificationCode: newPin,
      otpGeneratedAt: now,
      otpExpiresAt: now + (10 * 60 * 1000),
      otpRetryCount: 0,
      isOtpLocked: 0
    };

    try {
      const res = await fetch(`/api/calls/${callId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser?.id || 'system' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        setCalls(prev => prev.map(c => c.id === callId ? { ...c, ...updates, isOtpLocked: false } : c));
        setToast({ message: `New PIN Generated for call ${callId.slice(-4)}`, type: 'info' });
      }
    } catch (e) {}
  }, [currentUser]);

  const updateCallStatus = async (callId: string, status: CallStatus, phleboId?: string, updates?: Partial<CollectionCall>) => {
    const update: any = { ...updates, status };
    if (status === CallStatus.ACCEPTED) {
      update.acceptedAt = Date.now();
      update.assignedPhleboId = phleboId;
    }
    if (status === CallStatus.DELIVERED) {
      const now = Date.now();
      const lab = labs.find(l => l.id === (calls.find(c => c.id === callId)?.labId)) || labs[0];
      const call = calls.find(c => c.id === callId);
      if (call && lab) {
        const dist = calculateDistance(call.destination, lab.location);
        const phlebo = allPhlebos.find(p => p.id === (phleboId || call.assignedPhleboId));
        const tatTarget = config.tatBrackets.find(b => dist <= b.maxKm)?.tatMinutes || config.standardTatMinutes;
        const totalMins = (now - call.placedAt) / 60000;
        const rate = totalMins <= tatTarget ? config.withinTatRate : config.outsideTatRate;
        
        const metrics: CallMetrics = {
          callId: call.id,
          phleboId: phlebo?.id || 'Unknown',
          phleboName: phlebo?.name || 'Unknown',
          patientName: call.patientName,
          totalTat: Math.round(totalMins),
          targetTat: tatTarget,
          distance: dist,
          incentive: dist * rate * (call.isPriority ? 1.5 : 1),
          revenue: call.billing.totalAmount,
          paymentMode: call.billing.paymentMode,
          timestamp: now,
          isPremiumIncentive: !!call.isPriority,
          voiceNote: call.voiceNote,
          status: 'COMPLETED'
        };
        recordMetrics(metrics);
        update.status = CallStatus.COMPLETED;
      }
    }

    try {
      await fetch(`/api/calls/${callId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser?.id || 'system' },
        body: JSON.stringify(update)
      });
      setCalls(prev => prev.map(c => c.id === callId ? { ...c, ...update } : c));
    } catch (e) {}
  };

















  const handleVerifyOtp = useCallback(async (callId: string, inputPin: string) => {
    try {
      const response = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId, otp: inputPin }),
      });
      const data = await response.json();
      if (data.success) {
        updateCallStatus(callId, CallStatus.IN_PROGRESS, currentUser!.id);
        return { success: true, errorMsg: '' };
      } else {
        return { success: false, errorMsg: data.message };
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      return { success: false, errorMsg: 'An unexpected error occurred.' };
    }
  }, [updateCallStatus]);







  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginForm.userId, password: loginForm.password })
      });
      const data = await res.json();
      if (data.success) {
        const user = data.user;
        if (user.status === 'LOCKED') {
          setLoginError('Access Restricted: Node Locked');
          return;
        }
        setIsAuthenticated(true);
        setCurrentUser(user);
        sessionStorage.setItem('MAUI_SHELL_AUTH', 'true');
        sessionStorage.setItem('MAUI_USER_ID', user.id);
        if (['ADMIN', 'DEVELOPER', 'SYSTEM_ADMIN'].includes(user.role)) setActiveRoute('ADMIN');
        else if (['RECEPTION', 'DISPATCHER'].includes(user.role)) setActiveRoute('DISPATCH');
        else setActiveRoute('FIELD');
      } else {
        setLoginError('Credential Failure: Identity Unknown');
      }
    } catch (e) {
      setLoginError('Network Error: Server Unreachable');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    sessionStorage.removeItem('MAUI_SHELL_AUTH');
    sessionStorage.removeItem('MAUI_USER_ID');
    setActiveRoute('FIELD');
    setLoginForm({ userId: '', password: '' });
  };

  const handleRegisterPhlebo = (p: Partial<Phlebotomist>) => {
    const id = 'P' + Date.now();
    const generatedUsername = (p.name || 'user').toLowerCase().replace(/\s+/g, '');
    const newP: Phlebotomist = {
      ...p,
      id,
      username: generatedUsername,
      password: '123',
      isAvailable: true,
      status: 'APPROVED',
      completedCalls: 0,
      rejectedCalls: 0,
      monthlyEarnings: 0,
      grade: 'B',
      shiftStart: p.shiftStart || '09:00',
      shiftEnd: p.shiftEnd || '18:00'
    } as Phlebotomist;
    setAllPhlebos(prev => [...prev, newP]);
    setToast({ message: `Staff Provisioned: ${newP.name} (User: ${newP.username})`, type: 'success' });
  };




  if (!isAuthenticated || !currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-[4rem] shadow-2xl overflow-hidden animate-slide-up">
          <div className="bg-brand-purple p-12 text-center text-white">
            <div className="inline-block bg-white p-4 rounded-3xl mb-6"><LogoBird id="maui-login" size={80} /></div>
            <h1 className="text-3xl font-black uppercase tracking-tight">Disha Field Ops</h1>
            <p className="text-white/40 text-[10px] font-black uppercase mt-2 tracking-[0.4em]">Node Authentication</p>
          </div>
          <form onSubmit={handleLogin} className="p-12 space-y-8">
            <div className="space-y-4">
               <input type="text" placeholder="Username" value={loginForm.userId} onChange={(e) => setLoginForm({ ...loginForm, userId: e.target.value })} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-bold" required />
               <input type="password" placeholder="Password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-bold" required />
            </div>
            {loginError && <div className="p-4 bg-red-50 text-red-500 rounded-2xl text-[10px] font-black uppercase text-center animate-shake">{loginError}</div>}
            <button type="submit" className="w-full bg-brand-purple text-white py-6 rounded-3xl font-black uppercase text-xs tracking-[0.4em] shadow-2xl active:scale-95 transition-all">Authenticate</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {toast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[1000] animate-slide-up">
          <div className="px-8 py-4 bg-brand-purple text-white rounded-2xl shadow-2xl font-black text-xs uppercase tracking-widest border-2 border-white">
            {toast.message}
          </div>
        </div>
      )}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-[100] px-8 h-20 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <LogoBird id="maui-header" size={50} />
          <div className="flex flex-col">
            <span className="text-xs font-black text-brand-purple tracking-[0.2em] uppercase">DISHA CLOUD</span>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{currentUser.role} SESSION</span>
          </div>
        </div>
        <button onClick={handleLogout} className="text-slate-300 hover:text-red-500 p-3 bg-slate-50 rounded-2xl"><ShieldAlert size={20} /></button>
      </header>

      <main className="flex-1 p-6 lg:p-10 overflow-auto pb-32">
        {activeRoute === 'FIELD' && (
          <PhleboApp 
            currentUser={currentUser} 
            calls={calls} 
            labs={labs}
            appointments={appointments} 
            config={config} 
            history={performanceHistory}
            tests={tests}
            onUpdateStatus={updateCallStatus} 
            onResendOtp={handleResendOtp}
            onVerifyOtp={handleVerifyOtp}

            onUpdateLocation={(id, loc) => {
              fetch(`/api/users/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'x-user-id': id },
                body: JSON.stringify({ currentLocation: loc })
              });
              setAllPhlebos(prev => prev.map(p => p.id === id ? {...p, currentLocation: loc, lastActive: Date.now()} : p));
            }}
            onBookAppointment={(a) => setAppointments(prev => [...prev, {...a, id: 'A'+Date.now(), status: 'SCHEDULED'} as any])}
            onUpdateAppointmentStatus={(id, s) => setAppointments(prev => prev.map(a => a.id === id ? {...a, status: s} : a) as Appointment[])}
          />
        )}
        {activeRoute === 'DISPATCH' && <Dashboard currentUser={currentUser} calls={calls} appointments={appointments} config={config} labs={labs} hospitals={hospitals} tests={tests} phleboList={allPhlebos} onCreateCall={handleCreateCall} onUpdateStatus={updateCallStatus} onUpdateAppointmentStatus={(id, s) => setAppointments(prev => prev.map(a => a.id === id ? {...a, status: s} : a) as Appointment[])} />}
        {activeRoute === 'ADMIN' && (
          <AdminPanel 
            config={config} 
            labs={labs}
            tests={tests}
            hospitals={hospitals}
            onUpdateConfig={setConfig} 
            onRegisterLab={(l, a) => {
              const lid = 'LAB'+Date.now();
              setLabs(prev => [...prev, {...l, id: lid} as DiagnosticLab]);
              if(a) handleRegisterPhlebo({...a, labId: lid});
            }}
            onUpdateLab={(l) => setLabs(prev => prev.map(lab => lab.id === l.id ? l : lab))}
            history={performanceHistory} 
            phleboList={allPhlebos}
            activeCalls={calls}
            currentUser={currentUser}
            onUpdateShift={(id, s, e) => setAllPhlebos(prev => prev.map(p => p.id === id ? {...p, shiftStart: s, shiftEnd: e} : p))}
            onRegisterPhlebo={handleRegisterPhlebo}
            onRemovePhlebo={(id) => setAllPhlebos(prev => prev.filter(p => p.id !== id))}
            onUpdateUserStatus={(id, s) => setAllPhlebos(prev => prev.map(p => p.id === id ? {...p, status: s} : p))}
            onUpdateTests={setTests}
            onUpdateLabs={setLabs}
            onUpdateHospitals={setHospitals}
            onUpdatePhleboRole={(id, r) => setAllPhlebos(prev => prev.map(p => p.id === id ? {...p, role: r} : p))}
          />
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 h-24 flex items-center justify-around z-[100] pb-safe shadow-lg">
        {['ADMIN', 'SYSTEM_ADMIN', 'EMPLOYEE', 'DEVELOPER'].includes(currentUser.role) && (
          <button onClick={() => setActiveRoute('FIELD')} className={`flex flex-col items-center gap-1 ${activeRoute === 'FIELD' ? 'text-brand-purple' : 'text-slate-300'}`}>
            <Truck size={24} /><span className="text-[9px] font-black uppercase tracking-widest">Ops</span>
          </button>
        )}
        {['ADMIN', 'SYSTEM_ADMIN', 'RECEPTION', 'DEVELOPER', 'DISPATCHER'].includes(currentUser.role) && (
          <button onClick={() => setActiveRoute('DISPATCH')} className={`flex flex-col items-center gap-1 ${activeRoute === 'DISPATCH' ? 'text-brand-purple' : 'text-slate-300'}`}>
            <LayoutGrid size={24} /><span className="text-[9px] font-black uppercase tracking-widest">Dispatch</span>
          </button>
        )}
        {['ADMIN', 'SYSTEM_ADMIN', 'ACCOUNT', 'DEVELOPER'].includes(currentUser.role) && (
          <button onClick={() => setActiveRoute('ADMIN')} className={`flex flex-col items-center gap-1 ${activeRoute === 'ADMIN' ? 'text-brand-purple' : 'text-slate-300'}`}>
            <Monitor size={24} /><span className="text-[9px] font-black uppercase tracking-widest">Enterprise</span>
          </button>
        )}
      </nav>
    </div>
  );
};

export default App;
