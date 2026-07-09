
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';
import { 
  LogIn, Lock, User, ShieldCheck, PlayCircle, Fingerprint, ShieldAlert, Clock, Smartphone, Download, Monitor, Share2, Truck, Plus, Send, LayoutGrid, BarChart3, Settings as SettingsIcon, Wallet, Info, MapPin, Navigation, ExternalLink, Phone, X
} from 'lucide-react';
import { 
  CallStatus, CollectionCall, Phlebotomist, 
  SystemConfig, CallMetrics, Location, CallType, PaymentMode, TatBracket, DiagnosticTest, StaffRole, UserStatus, Appointment, DiagnosticLab, Hospital
} from './types';
import { INITIAL_CONFIG, MOCK_TESTS, MOCK_LABS, MOCK_HOSPITALS } from './mockData';
import { LogoBird } from './LogoBird';
import { calculateDistance } from './geoUtils';
import { calculateTatTarget, calculateIncentive } from './calculators';
import { indexedDbHelper } from './indexedDbHelper';

// Components
import Dashboard from './Dashboard';
import PhleboApp from './PhleboApp';
import AdminPanel from './AdminPanel';

type MauiRoute = 'FIELD' | 'DISPATCH' | 'ADMIN' | 'PROFILE';

const TrackingPage: React.FC<{ callId: string }> = ({ callId }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTracking = async () => {
      try {
        const res = await fetch(`/api/public/track/${callId}`);
        const json = await res.json();
        if (json.success) setData(json);
        else setError(json.message);
      } catch (e) {
        setError("Failed to load tracking info");
      } finally {
        setLoading(false);
      }
    };
    fetchTracking();
    const interval = setInterval(fetchTracking, 10000);
    return () => clearInterval(interval);
  }, [callId]);

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-black uppercase tracking-widest text-slate-400">Loading Tracking...</div>;
  if (error) return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-black uppercase tracking-widest text-red-400">{error}</div>;

  const { call, phlebo } = data;

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl border-4 border-brand-purple/5 overflow-hidden">
        <div className="bg-brand-purple p-8 text-white text-center">
          <LogoBird size={48} />
          <h1 className="text-xl font-black uppercase tracking-widest">Live Tracking</h1>
          <p className="text-[10px] opacity-60 font-bold mt-1">Booking ID: {call.id}</p>
        </div>
        
        <div className="p-8 space-y-8">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</p>
              <p className="text-lg font-black text-slate-900 uppercase">{call.status}</p>
            </div>
            <div className="bg-green-50 px-4 py-2 rounded-xl border border-green-100 flex items-center gap-2">
              <div className="w-2 h-2 bg-brand-green rounded-full animate-pulse" />
              <span className="text-[10px] font-black text-brand-green uppercase tracking-widest">Live</span>
            </div>
          </div>

          <div className="space-y-4">
             <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-brand-purple/10 rounded-full flex items-center justify-center text-brand-purple shrink-0">
                   <User size={20} />
                </div>
                <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phlebotomist</p>
                   <p className="text-sm font-black text-slate-900">{phlebo ? phlebo.name : 'Awaiting Assignment'}</p>
                </div>
             </div>

             {phlebo?.currentLocation && (
               <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-brand-green/10 rounded-full flex items-center justify-center text-brand-green shrink-0">
                     <MapPin size={20} />
                  </div>
                  <div>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Location</p>
                     <p className="text-sm font-black text-slate-900">
                        {phlebo.currentLocation.lat.toFixed(4)}, {phlebo.currentLocation.lng.toFixed(4)}
                     </p>
                     <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Last seen: {new Date(phlebo.lastActive).toLocaleTimeString()}</p>
                  </div>
               </div>
             )}

             <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 shrink-0">
                   <Navigation size={20} />
                </div>
                <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Destination</p>
                   <p className="text-sm font-black text-slate-900">{call.destination.address}</p>
                </div>
             </div>
          </div>

          <div className="pt-4">
             <a 
               href={`https://www.google.com/maps/dir/?api=1&destination=${call.destination.lat},${call.destination.lng}`}
               target="_blank"
               rel="noopener noreferrer"
               className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2"
             >
               <ExternalLink size={14} /> Open in Google Maps
             </a>
          </div>
        </div>
      </div>
      
      <p className="mt-8 text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Disha Diagnostics Cloud</p>
    </div>
  );
};

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    try {
      return sessionStorage.getItem('MAUI_SHELL_AUTH') === 'true';
    } catch (e) {
      return false;
    }
  });
  
  const [loginForm, setLoginForm] = useState({ userId: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [activeRoute, setActiveRoute] = useState<MauiRoute>('FIELD');
  const [config, setConfig] = useState<SystemConfig>(INITIAL_CONFIG);
  const [tests, setTests] = useState<DiagnosticTest[]>([]);
  const [labs, setLabs] = useState<DiagnosticLab[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [calls, setCalls] = useState<CollectionCall[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [performanceHistory, setPerformanceHistory] = useState<CallMetrics[]>([]);
  const [allPhlebos, setAllPhlebos] = useState<Phlebotomist[]>([]);
  const [emergencies, setEmergencies] = useState<any[]>([]);

  const [currentUser, setCurrentUser] = useState<Phlebotomist | null>(() => {
    return null;
  });

  const [trackingCallId, setTrackingCallId] = useState<string | null>(() => {
    const path = window.location.pathname;
    if (path.startsWith('/track/')) return path.split('/track/')[1];
    return null;
  });

  useEffect(() => {
    const handlePathChange = () => {
      const path = window.location.pathname;
      if (path.startsWith('/track/')) setTrackingCallId(path.split('/track/')[1]);
      else setTrackingCallId(null);
    };
    window.addEventListener('popstate', handlePathChange);
    return () => window.removeEventListener('popstate', handlePathChange);
  }, []);

  if (trackingCallId) {
    return <TrackingPage callId={trackingCallId} />;
  }

  const fetchData = useCallback(async () => {
    try {
      const [callsRes, usersRes, metricsRes, configRes, labsRes, hospitalsRes, testsRes, emergenciesRes] = await Promise.all([
        fetch('/api/calls'),
        fetch('/api/users'),
        fetch('/api/metrics'),
        fetch('/api/config'),
        fetch('/api/labs'),
        fetch('/api/hospitals'),
        fetch('/api/tests'),
        fetch('/api/emergencies').catch(() => null)
      ]);

      let fetchedCalls: CollectionCall[] = [];
      let fetchedUsers: Phlebotomist[] = [];
      let fetchedMetrics: CallMetrics[] = [];
      let fetchedConfig: SystemConfig | null = null;
      let fetchedLabs: DiagnosticLab[] = [];
      let fetchedHospitals: Hospital[] = [];
      let fetchedTests: DiagnosticTest[] = [];
      let fetchedEmergencies: any[] = [];

      if (callsRes.ok) fetchedCalls = await callsRes.json();
      if (usersRes.ok) fetchedUsers = await usersRes.json();
      if (metricsRes.ok) fetchedMetrics = await metricsRes.json();
      if (configRes.ok) fetchedConfig = await configRes.json();
      if (labsRes.ok) fetchedLabs = await labsRes.json();
      if (hospitalsRes.ok) fetchedHospitals = await hospitalsRes.json();
      if (testsRes.ok) fetchedTests = await testsRes.json();
      if (emergenciesRes && emergenciesRes.ok) {
        fetchedEmergencies = await emergenciesRes.json();
      }
      setEmergencies(fetchedEmergencies);

      let needReFetch = false;

      // 1. Sync & Restore SYSTEM_CONFIG
      const localConfigStr = localStorage.getItem('disha_config');
      if (localConfigStr) {
        const localConfig = JSON.parse(localConfigStr);
        if (!fetchedConfig || JSON.stringify(fetchedConfig) !== JSON.stringify(localConfig)) {
          await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(localConfig)
          });
          fetchedConfig = localConfig;
          needReFetch = true;
        }
      } else if (fetchedConfig) {
        localStorage.setItem('disha_config', JSON.stringify(fetchedConfig));
      }

      // 2. Sync & Restore HOSPITALS 
      const localHospitalsStr = localStorage.getItem('disha_hospitals');
      if (localHospitalsStr) {
        const localHospitals = JSON.parse(localHospitalsStr);
        const serverIds = new Set(fetchedHospitals.map(h => h.id));
        const missingLocals = localHospitals.filter((h: Hospital) => !serverIds.has(h.id));
        
        // If server got wiped or holds fewer/only subset of hospitals than local storage, push custom ones
        if (missingLocals.length > 0 || localHospitals.length > fetchedHospitals.length) {
          const mergedHospitals = [...fetchedHospitals];
          localHospitals.forEach((lh: Hospital) => {
            if (!serverIds.has(lh.id)) {
              mergedHospitals.push(lh);
            }
          });
          await fetch('/api/hospitals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mergedHospitals)
          });
          fetchedHospitals = mergedHospitals;
          needReFetch = true;
        }
      } else if (fetchedHospitals.length > 0) {
        localStorage.setItem('disha_hospitals', JSON.stringify(fetchedHospitals));
      }

      // 3. Sync & Restore LABS
      const localLabsStr = localStorage.getItem('disha_labs');
      if (localLabsStr) {
        const localLabs = JSON.parse(localLabsStr);
        const serverIds = new Set(fetchedLabs.map(l => l.id));
        const missingLocals = localLabs.filter((l: DiagnosticLab) => !serverIds.has(l.id));

        if (missingLocals.length > 0 || localLabs.length > fetchedLabs.length) {
          const mergedLabs = [...fetchedLabs];
          localLabs.forEach((ll: DiagnosticLab) => {
            if (!serverIds.has(ll.id)) {
              mergedLabs.push(ll);
            }
          });
          await fetch('/api/labs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mergedLabs)
          });
          fetchedLabs = mergedLabs;
          needReFetch = true;
        }
      } else if (fetchedLabs.length > 0) {
        localStorage.setItem('disha_labs', JSON.stringify(fetchedLabs));
      }

      // 4. Sync & Restore USERS (Roster shifts are stored in here!)
      const localUsersStr = localStorage.getItem('disha_users');
      if (localUsersStr) {
        const localUsers = JSON.parse(localUsersStr) as Phlebotomist[];
        const serverUsersMap = new Set(fetchedUsers.map(u => u.id));
        
        let didSyncUser = false;
        for (const lu of localUsers) {
          // If server is missing the user, or if server's copy of user has different shifts/roles (rosters got reset)
          const su = fetchedUsers.find(cu => cu.id === lu.id);
          if (!su || su.shiftStart !== lu.shiftStart || su.shiftEnd !== lu.shiftEnd || su.role !== lu.role || su.status !== lu.status) {
            await fetch('/api/users', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-user-id': 'system' },
              body: JSON.stringify(lu)
            });
            didSyncUser = true;
          }
        }
        if (didSyncUser) {
          needReFetch = true;
        }
      } else if (fetchedUsers.length > 0) {
        localStorage.setItem('disha_users', JSON.stringify(fetchedUsers));
      }

      // 5. Sync & Restore CALLS
      const localCallsStr = localStorage.getItem('disha_calls');
      if (localCallsStr) {
        const localCalls = JSON.parse(localCallsStr) as CollectionCall[];
        const serverCallIds = new Set(fetchedCalls.map(c => c.id));
        
        let didSyncCall = false;
        for (const lc of localCalls) {
          if (!serverCallIds.has(lc.id)) {
            await fetch('/api/calls', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-user-id': 'system' },
              body: JSON.stringify(lc)
            });
            didSyncCall = true;
          }
        }
        if (didSyncCall) {
          needReFetch = true;
        }
      } else if (fetchedCalls.length > 0) {
        localStorage.setItem('disha_calls', JSON.stringify(fetchedCalls));
      }

      // 6. Sync & Restore TESTS
      const localTestsStr = localStorage.getItem('disha_tests');
      if (localTestsStr) {
        const localTests = JSON.parse(localTestsStr);
        if (localTests.length > fetchedTests.length) {
          await fetch('/api/tests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(localTests)
          });
          fetchedTests = localTests;
          needReFetch = true;
        }
      } else if (fetchedTests.length > 0) {
        localStorage.setItem('disha_tests', JSON.stringify(fetchedTests));
      }

      // If we performed self-healing restoring, re-query server list for accurate states
      if (needReFetch) {
        const [reCalls, reUsers, reTests, reLabs, reHospitals, reConfig] = await Promise.all([
          fetch('/api/calls'),
          fetch('/api/users'),
          fetch('/api/tests'),
          fetch('/api/labs'),
          fetch('/api/hospitals'),
          fetch('/api/config')
        ]);
        if (reCalls.ok) fetchedCalls = await reCalls.json();
        if (reUsers.ok) fetchedUsers = await reUsers.json();
        if (reTests.ok) fetchedTests = await reTests.json();
        if (reLabs.ok) fetchedLabs = await reLabs.json();
        if (reHospitals.ok) fetchedHospitals = await reHospitals.json();
        if (reConfig.ok) fetchedConfig = await reConfig.json();
      }

      // Final state updates
      const uniqueCalls = Array.from(new Map(fetchedCalls.map((c: any) => [c.id, c])).values()) as CollectionCall[];
      setCalls(uniqueCalls);
      localStorage.setItem('disha_calls', JSON.stringify(uniqueCalls));

      setAllPhlebos(fetchedUsers);
      localStorage.setItem('disha_users', JSON.stringify(fetchedUsers));

      const uniqueMetrics = Array.from(new Map(fetchedMetrics.map((m: any) => [m.id || m.callId, m])).values()) as CallMetrics[];
      setPerformanceHistory(uniqueMetrics);

      if (fetchedConfig) {
        setConfig(fetchedConfig);
        localStorage.setItem('disha_config', JSON.stringify(fetchedConfig));
      }
      if (fetchedLabs.length > 0) {
        setLabs(fetchedLabs);
        localStorage.setItem('disha_labs', JSON.stringify(fetchedLabs));
      }
      if (fetchedHospitals.length > 0) {
        setHospitals(fetchedHospitals);
        localStorage.setItem('disha_hospitals', JSON.stringify(fetchedHospitals));
      }
      if (fetchedTests.length > 0) {
        setTests(fetchedTests);
        localStorage.setItem('disha_tests', JSON.stringify(fetchedTests));
      }

    } catch (e) {
      console.error("Fetch error:", e);
      try {
        const savedCalls = await indexedDbHelper.getCalls();
        if (savedCalls && savedCalls.length > 0) {
          setCalls(savedCalls);
        } else {
          const localCallsStr = localStorage.getItem('disha_calls');
          if (localCallsStr) {
            setCalls(JSON.parse(localCallsStr));
          }
        }

        const localConfigStr = localStorage.getItem('disha_config');
        if (localConfigStr) setConfig(JSON.parse(localConfigStr));

        const localLabsStr = localStorage.getItem('disha_labs');
        if (localLabsStr) setLabs(JSON.parse(localLabsStr));

        const localHospitalsStr = localStorage.getItem('disha_hospitals');
        if (localHospitalsStr) setHospitals(JSON.parse(localHospitalsStr));

        const localTestsStr = localStorage.getItem('disha_tests');
        if (localTestsStr) setTests(JSON.parse(localTestsStr));

        const localUsersStr = localStorage.getItem('disha_users');
        if (localUsersStr) setAllPhlebos(JSON.parse(localUsersStr));
      } catch (err) {
        console.error("Failed to load offline fallback data:", err);
      }
    }
  }, []);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    if (calls && calls.length > 0) {
      indexedDbHelper.saveCalls(calls);
    }
  }, [calls]);

  // Initial data fetch and Socket.io setup
  useEffect(() => {
    fetchData();
    
    const socket = io();
    
    socket.on('call_created', (call) => {
      setCalls(prev => {
        const exists = prev.some(c => c.id === call.id);
        if (exists) return prev;
        return [call, ...prev];
      });
    });
    
    socket.on('call_updated', (updates) => {
      setCalls(prev => {
        const updated = prev.map(c => c.id === updates.id ? { ...c, ...updates } : c);
        // Ensure no duplicates even after update (unlikely but safe)
        const unique = Array.from(new Map(updated.map(c => [c.id, c])).values());
        return unique;
      });
    });
    
    socket.on('user_updated', (updates) => {
      setAllPhlebos(prev => prev.map(p => p.id === updates.id ? { ...p, ...updates } : p));
    });
    
    socket.on('metrics_updated', (metric) => {
      setPerformanceHistory(prev => {
        if (prev.some(m => m.callId === metric.callId)) return prev;
        return [metric, ...prev];
      });
    });

    socket.on('notification', (notif) => {
      setToast({ message: notif.message, type: notif.type || 'info' });
    });

    socket.on('emergency_alert', (alert) => {
      setEmergencies(prev => {
        if (prev.some(e => e.id === alert.id)) return prev;
        return [alert, ...prev];
      });
      // Sound cue
      try {
        const context = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.connect(gain);
        gain.connect(context.destination);
        osc.frequency.value = 1100;
        gain.gain.setValueAtTime(0.2, context.currentTime);
        osc.start();
        setTimeout(() => osc.stop(), 800);
      } catch(e) {}
    });

    socket.on('emergency_resolved', ({ alertId }) => {
      setEmergencies(prev => prev.filter(e => e.id !== alertId));
    });

    return () => {
      socket.disconnect();
    };
  }, [fetchData]);

  // Sync currentUser with latest allPhlebos state
  useEffect(() => {
    try {
      const id = sessionStorage.getItem('MAUI_USER_ID');
      if (id) {
        const user = allPhlebos.find(p => p.id === id);
        if (user) setCurrentUser(user);
      }
    } catch (e) {}
  }, [allPhlebos]);

  const recordMetrics = useCallback(async (metrics: CallMetrics) => {
    try {
      await fetch('/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metrics)
      });
      setPerformanceHistory(prev => {
        if (prev.some(m => m.callId === metrics.callId)) return prev;
        return [metrics, ...prev];
      });
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
    } catch (e) {
      console.error("Failed to record metrics:", e);
    }
  }, []);

  const handleCreateCall = useCallback(async (call: Partial<CollectionCall>) => {
    const now = Date.now();
    const newCallObj: CollectionCall = {
      ...call,
      id: 'D' + Date.now() + Math.random().toString(36).substring(2, 7),
      status: CallStatus.PENDING,
      labId: call.labId || (labs.length > 0 ? labs[0].id : ''),
      placedAt: now,
      verificationCode: Math.floor(1000 + Math.random() * 9000).toString(),
      handoverCode: Math.floor(1000 + Math.random() * 9000).toString(),
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
        setCalls(prev => {
          const exists = prev.some(c => c.id === newCallObj.id);
          if (exists) return prev;
          const updated = [newCallObj, ...prev];
          localStorage.setItem('disha_calls', JSON.stringify(updated));
          return updated;
        });
        setToast({ message: `Deployment Active: ${newCallObj.patientName}`, type: 'success' });
        fetchData();
      }
    } catch (e) {
      setToast({ message: "Failed to deploy call", type: 'info' });
    }
  }, [labs, currentUser]);



  const handleResendOtp = useCallback(async (callId: string, isHandover: boolean = false) => {
    if (currentUser && !['SYSTEM_ADMIN', 'ADMIN', 'RECEPTION', 'DEVELOPER'].includes(currentUser.role)) {
       const call = calls.find(c => c.id === callId);
       if (call) {
          if (isHandover) {
              alert("Only Admin/Dispatch can regenerate the authorisation (handover) PIN.");
              return;
          } else {
              if (call.isOtpLocked || Date.now() > call.otpExpiresAt) {
                  alert("This OTP is expired or locked. Only Admin/Dispatch has the authority to regenerate it.");
                  return;
              }
          }
       }
    }

    const now = Date.now();
    const newPin = Math.floor(1000 + Math.random() * 9000).toString();
    const updates: any = isHandover ? {
      handoverCode: newPin
    } : {
      verificationCode: newPin,
      otpGeneratedAt: now,
      otpExpiresAt: now + (10 * 60 * 1000),
      otpRetryCount: 0,
      isOtpLocked: false
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
  }, [currentUser, calls]);

  const updateCallStatus = async (callId: string, status: CallStatus, phleboId?: string, updates?: Partial<CollectionCall>) => {
    const update: any = { ...updates, status };
    if (status === CallStatus.ACCEPTED) {
      update.acceptedAt = Date.now();
      update.assignedPhleboId = phleboId;
      const phlebo = allPhlebos.find(p => p.id === phleboId);
      if (updates && (updates as any).acceptedLocation) {
        update.acceptedLocation = (updates as any).acceptedLocation;
      } else if (phlebo?.currentLocation) {
        update.acceptedLocation = phlebo.currentLocation;
      }
    }
    if (status === CallStatus.PENDING) {
      update.assignedPhleboId = null;
      update.acceptedAt = null;
      update.arrivedLocation = null;
      update.visitPhoto = null;
      update.samplePhoto = null;
      update.sampleType = null;
      update.voiceNote = null;
      update.acceptedLocation = null;
    }
    if (status === CallStatus.COLLECTED) {
      update.collectedAt = Date.now();
    }
    if (status === CallStatus.IN_TRANSIT) {
      update.transitAt = Date.now();
    }
    if (status === CallStatus.RECEIVED_AT_LAB) {
      update.receivedAt = Date.now();
    }
    if (status === CallStatus.DELIVERED || status === CallStatus.RECEIVED_AT_LAB) {
      const now = Date.now();
      const call = calls.find(c => c.id === callId);
      const lab = labs.find(l => l.id === (call?.labId)) || labs[0];
      if (call && lab) {
        const phlebo = allPhlebos.find(p => p.id === (phleboId || call.assignedPhleboId));
        // Find phlebo's assigned HUB (lab)
        const phleboLab = phlebo?.labId ? (labs.find(l => l.id === phlebo.labId) || labs[0]) : lab;
        
        // Find starting location:
        // Use the acceptedLocation if available, otherwise the phlebo's current location, otherwise fallback to their assigned hub location
        let startLoc = phleboLab?.location || lab.location;
        if (phlebo?.currentLocation && phlebo.currentLocation.lat !== 0 && phlebo.currentLocation.lng !== 0) {
          const distToHub = calculateDistance(phlebo.currentLocation, phleboLab?.location || { lat: 0, lng: 0, address: "" });
          // If within 100km of the assigned hub, it's a valid live location
          if (distToHub <= 100) {
            startLoc = phlebo.currentLocation;
          }
        }
        
        const callAcceptedLoc = (updates as any)?.acceptedLocation || call.acceptedLocation;
        if (callAcceptedLoc && callAcceptedLoc.lat !== 0 && callAcceptedLoc.lng !== 0) {
          const distToHub = calculateDistance(callAcceptedLoc, phleboLab?.location || { lat: 0, lng: 0, address: "" });
          if (distToHub <= 100) {
            startLoc = callAcceptedLoc;
          }
        }

        const dist = calculateDistance(call.destination, startLoc);
        const tatTarget = calculateTatTarget(dist, config);
        const totalMins = (now - call.placedAt) / 60000;
        
        const metrics: CallMetrics = {
          callId: call.id,
          phleboId: phlebo?.id || 'Unknown',
          phleboName: phlebo?.name || 'Unknown',
          patientName: call.patientName,
          totalTat: Math.round(totalMins),
          targetTat: tatTarget,
          distance: dist,
          incentive: calculateIncentive(dist, totalMins, tatTarget, !!call.isPriority, config),
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

    // Optimistic UI Update: update state and localStorage immediately
    setCalls(prev => {
      const updated = prev.map(c => c.id === callId ? { ...c, ...update } : c);
      localStorage.setItem('disha_calls', JSON.stringify(updated));
      return updated;
    });

    try {
      await fetch(`/api/calls/${callId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser?.id || 'system' },
        body: JSON.stringify(update)
      });
    } catch (e) {
      console.warn("Deferred sync due to network error:", e);
    }
  };

















  const handleVerifyOtp = useCallback(async (callId: string, inputPin: string) => {
    try {
      const response = await fetch('/api/calls/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId, otp: inputPin }),
      });
      
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error('Non-JSON response received:', text.slice(0, 100));
        return { success: false, errorMsg: `Server Error: Received unexpected response format (${response.status})` };
      }

      const data = await response.json();
      if (data.success) {
        updateCallStatus(callId, CallStatus.IN_PROGRESS, currentUser!.id);
        return { success: true, errorMsg: '' };
      } else {
        return { success: false, errorMsg: data.message || 'Verification failed' };
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      return { success: false, errorMsg: 'Connection error. Please check your network.' };
    }
  }, [updateCallStatus, currentUser]);







  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordInput, setForgotPasswordInput] = useState('');
  const [forgotPasswordMsg, setForgotPasswordMsg] = useState<{ text: string, type: 'error' | 'success' | '' }>({ text: '', type: '' });
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);

  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('password');
  const [otpStep, setOtpStep] = useState<1 | 2>(1);
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpInput, setOtpInput] = useState('');

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError('');
    if (!loginForm.userId) {
      setOtpError('Please enter your Phone or Username');
      return;
    }
    setOtpLoading(true);
    try {
      const res = await fetch('/api/public/login-otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginForm.userId })
      });
      const data = await res.json();
      if (data.success) {
        setOtpStep(2);
      } else {
        setOtpError(data.message || 'Verification failed');
      }
    } catch (e) {
      setOtpError('Network error');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtpLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError('');
    if (!otpInput) {
      setOtpError('Please enter the OTP');
      return;
    }
    setOtpLoading(true);
    try {
      const res = await fetch('/api/public/login-otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginForm.userId, otp: otpInput })
      });
      const data = await res.json();
      if (data.success) {
        processSuccessfulLogin(data.user);
      } else {
        setOtpError(data.message || 'Invalid OTP');
      }
    } catch (e) {
      setOtpError('Network error');
    } finally {
      setOtpLoading(false);
    }
  };

  const processSuccessfulLogin = (user: any) => {
    if (user.status === 'LOCKED') {
      setLoginError('Access Restricted: Node Locked');
      setOtpError('Access Restricted: Node Locked');
      return;
    }
    setIsAuthenticated(true);
    setCurrentUser(user);
    try {
      sessionStorage.setItem('MAUI_SHELL_AUTH', 'true');
      sessionStorage.setItem('MAUI_USER_ID', user.id);
    } catch (e) {}
    if (['ADMIN', 'DEVELOPER', 'SYSTEM_ADMIN'].includes(user.role)) setActiveRoute('ADMIN');
    else if (['RECEPTION', 'DISPATCHER'].includes(user.role)) setActiveRoute('DISPATCH');
    else setActiveRoute('FIELD');
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotPasswordMsg({ text: '', type: '' });
    if (!forgotPasswordInput) {
      setForgotPasswordMsg({ text: 'Please enter your username or email', type: 'error' });
      return;
    }
    setForgotPasswordLoading(true);
    try {
      const res = await fetch('/api/public/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: forgotPasswordInput })
      });
      const data = await res.json();
      if (data.success) {
        setForgotPasswordMsg({ text: data.message, type: 'success' });
      } else {
        setForgotPasswordMsg({ text: data.message || 'Recovery failed', type: 'error' });
      }
    } catch (e) {
      setForgotPasswordMsg({ text: 'Network error', type: 'error' });
    } finally {
      setForgotPasswordLoading(false);
    }
  };

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
        processSuccessfulLogin(data.user);
      } else {
        setLoginError('Credential Failure: Identity Unknown');
      }
    } catch (e) {
      setLoginError('Network Error: Server Unreachable');
    }
  };

  const handleUpdateConfig = async (newConfig: SystemConfig) => {
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });
      if (res.ok) {
        setConfig(newConfig);
        localStorage.setItem('disha_config', JSON.stringify(newConfig));
        setToast({ message: "Enterprise standards synchronized", type: 'success' });
      }
    } catch (e) {
      setToast({ message: "Failed to sync config", type: 'info' });
    }
  };

  const handleUpdateLabs = async (newLabs: DiagnosticLab[]) => {
    try {
      const res = await fetch('/api/labs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLabs)
      });
      if (res.ok) {
        setLabs(newLabs);
        localStorage.setItem('disha_labs', JSON.stringify(newLabs));
        setToast({ message: "Labs synchronized", type: 'success' });
      }
    } catch (e) {
      setToast({ message: "Failed to sync labs", type: 'info' });
    }
  };

  const handleUpdateHospitals = async (newHospitals: Hospital[]) => {
    try {
      const res = await fetch('/api/hospitals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newHospitals)
      });
      if (res.ok) {
        setHospitals(newHospitals);
        localStorage.setItem('disha_hospitals', JSON.stringify(newHospitals));
        setToast({ message: "Hospitals synchronized", type: 'success' });
      }
    } catch (e) {
      setToast({ message: "Failed to sync hospitals", type: 'info' });
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    try {
      sessionStorage.removeItem('MAUI_SHELL_AUTH');
      sessionStorage.removeItem('MAUI_USER_ID');
    } catch (e) {}
    setActiveRoute('FIELD');
    setLoginForm({ userId: '', password: '' });
  };

  const handleRegisterPhlebo = async (p: Partial<Phlebotomist>) => {
    const id = 'P' + Date.now() + Math.random().toString(36).substring(2, 7);
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

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser?.id || 'system' },
        body: JSON.stringify(newP)
      });
      if (res.ok) {
        setAllPhlebos(prev => {
          const updated = [...prev, newP];
          localStorage.setItem('disha_users', JSON.stringify(updated));
          return updated;
        });
        setToast({ message: `Staff Provisioned: ${newP.name} (User: ${newP.username})`, type: 'success' });
      } else {
        setToast({ message: "Failed to provision staff", type: 'info' });
      }
    } catch (e) {
      setToast({ message: "Network error while provisioning staff", type: 'info' });
    }
  };

  const handleUpdateUser = async (id: string, updates: Partial<Phlebotomist>) => {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        setAllPhlebos(prev => {
          const updated = prev.map(p => p.id === id ? { ...p, ...updates } : p);
          localStorage.setItem('disha_users', JSON.stringify(updated));
          return updated;
        });
      }
    } catch (e) {
      console.error("Failed to update user:", e);
    }
  };

  const handleRemovePhlebo = async (id: string) => {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setAllPhlebos(prev => {
          const updated = prev.filter(p => p.id !== id);
          localStorage.setItem('disha_users', JSON.stringify(updated));
          return updated;
        });
        setToast({ message: "Staff record decommissioned", type: 'success' });
      }
    } catch (e) {
      console.error("Failed to remove phlebo:", e);
    }
  };

  const handleUpdateTests = async (newTests: DiagnosticTest[]) => {
    try {
      const res = await fetch('/api/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTests)
      });
      if (res.ok) {
        setTests(newTests);
        setToast({ message: "Service catalog synchronized", type: 'success' });
      }
    } catch (e) {
      console.error("Failed to update tests:", e);
    }
  };




  const visibleCalls = useMemo(() => {
    if (!currentUser) return [];
    if (['SYSTEM_ADMIN', 'DEVELOPER'].includes(currentUser.role)) return calls;
    if (currentUser.labId) return calls.filter(c => c.labId === currentUser.labId);
    return calls;
  }, [calls, currentUser]);

  const visiblePhlebos = useMemo(() => {
    if (!currentUser) return [];
    if (['SYSTEM_ADMIN', 'DEVELOPER'].includes(currentUser.role)) return allPhlebos;
    if (currentUser.labId) return allPhlebos.filter(p => p.labId === currentUser.labId);
    return allPhlebos;
  }, [allPhlebos, currentUser]);

  const visibleLabs = useMemo(() => {
    if (!currentUser) return [];
    if (['SYSTEM_ADMIN', 'DEVELOPER'].includes(currentUser.role)) return labs;
    if (currentUser.labId) return labs.filter(l => l.id === currentUser.labId);
    return labs;
  }, [labs, currentUser]);

  const visibleHistory = useMemo(() => {
    if (!currentUser) return [];
    if (['SYSTEM_ADMIN', 'DEVELOPER'].includes(currentUser.role)) return performanceHistory;
    if (currentUser.labId) {
       const labPhleboIds = new Set(visiblePhlebos.map(p => p.id));
       return performanceHistory.filter(h => labPhleboIds.has(h.phleboId));
    }
    return performanceHistory;
  }, [performanceHistory, currentUser, visiblePhlebos]);

  if (!isAuthenticated || !currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-[4rem] shadow-2xl overflow-hidden animate-slide-up">
          <div className="bg-brand-purple p-12 text-center text-white">
            <div className="inline-block bg-white p-4 rounded-3xl mb-6"><LogoBird id="maui-login" size={80} /></div>
            <h1 className="text-3xl font-black uppercase tracking-tight">Disha Field Ops</h1>
            <p className="text-white/40 text-[10px] font-black uppercase mt-2 tracking-[0.4em]">Node Authentication</p>
          </div>
          {showForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="p-12 space-y-8">
              <div className="space-y-4">
                 <p className="text-sm font-bold text-slate-700 text-center">Enter your username or email to receive a temporary recovery password.</p>
                 <input type="text" placeholder="Username or Email" value={forgotPasswordInput} onChange={(e) => setForgotPasswordInput(e.target.value)} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-bold" required />
              </div>
              {forgotPasswordMsg.text && (
                <div className={`p-4 rounded-2xl text-[10px] font-black uppercase text-center ${forgotPasswordMsg.type === 'error' ? 'bg-red-50 text-red-500 animate-shake' : 'bg-brand-green/10 text-brand-green'}`}>
                  {forgotPasswordMsg.text}
                </div>
              )}
              <div className="space-y-4">
                <button type="submit" disabled={forgotPasswordLoading} className="w-full bg-brand-purple text-white py-6 rounded-3xl font-black uppercase text-xs tracking-[0.4em] shadow-2xl active:scale-95 transition-all disabled:opacity-50">
                  {forgotPasswordLoading ? 'Sending...' : 'Send Recovery Code'}
                </button>
                <button type="button" onClick={() => setShowForgotPassword(false)} className="w-full text-slate-400 font-bold uppercase text-[10px] tracking-widest hover:text-slate-600">Back to Login</button>
              </div>
            </form>
          ) : (
            <div className="p-12 space-y-8">
              {/* Login Method Toggle */}
              <div className="flex bg-slate-100 p-1 rounded-2xl">
                <button 
                  onClick={() => { setLoginMethod('password'); setOtpError(''); setLoginError(''); }} 
                  className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${loginMethod === 'password' ? 'bg-white shadow-sm text-brand-purple' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Password
                </button>
                <button 
                  onClick={() => { setLoginMethod('otp'); setOtpError(''); setLoginError(''); setOtpStep(1); }} 
                  className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${loginMethod === 'otp' ? 'bg-white shadow-sm text-brand-purple' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  OTP
                </button>
              </div>

              {loginMethod === 'password' ? (
                <form onSubmit={handleLogin} className="space-y-8">
                  <div className="space-y-4">
                     <input type="text" placeholder="Username" value={loginForm.userId} onChange={(e) => setLoginForm({ ...loginForm, userId: e.target.value })} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-bold focus:outline-brand-purple" required />
                     <input type="password" placeholder="Password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-bold focus:outline-brand-purple" required />
                  </div>
                  {loginError && <div className="p-4 bg-red-50 text-red-500 rounded-2xl text-[10px] font-black uppercase text-center animate-shake">{loginError}</div>}
                  <div className="space-y-4">
                    <button type="submit" className="w-full bg-brand-purple text-white py-6 rounded-3xl font-black uppercase text-xs tracking-[0.4em] shadow-2xl active:scale-95 transition-all">Authenticate</button>
                    <button type="button" onClick={() => { setShowForgotPassword(true); setForgotPasswordMsg({text:'',type:''}); }} className="w-full text-slate-400 font-bold uppercase text-[10px] tracking-widest hover:text-slate-600">Forgot Password?</button>
                  </div>
                </form>
              ) : (
                otpStep === 1 ? (
                  <form onSubmit={handleRequestOtp} className="space-y-8">
                     <div className="space-y-4">
                       <input type="text" placeholder="Phone Number or Username" value={loginForm.userId} onChange={(e) => setLoginForm({ ...loginForm, userId: e.target.value })} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-bold focus:outline-brand-purple" required />
                     </div>
                     {otpError && <div className="p-4 bg-red-50 text-red-500 rounded-2xl text-[10px] font-black uppercase text-center animate-shake">{otpError}</div>}
                     <button type="submit" disabled={otpLoading} className="w-full bg-brand-purple text-white py-6 rounded-3xl font-black uppercase text-xs tracking-[0.4em] shadow-2xl active:scale-95 transition-all disabled:opacity-50">
                       {otpLoading ? 'Sending...' : 'Send OTP via SMS'}
                     </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtpLogin} className="space-y-8">
                     <div className="space-y-4">
                       <p className="text-center text-xs font-bold text-slate-500">OTP Code sent to your mobile.</p>
                       <input type="text" placeholder="Enter 6-digit OTP" value={otpInput} onChange={(e) => setOtpInput(e.target.value)} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black text-center tracking-[1em] text-xl focus:outline-brand-purple" maxLength={6} required />
                     </div>
                     {otpError && <div className="p-4 bg-red-50 text-red-500 rounded-2xl text-[10px] font-black uppercase text-center animate-shake">{otpError}</div>}
                     <div className="space-y-4">
                       <button type="submit" disabled={otpLoading} className="w-full bg-brand-purple text-white py-6 rounded-3xl font-black uppercase text-xs tracking-[0.4em] shadow-2xl active:scale-95 transition-all disabled:opacity-50">
                         {otpLoading ? 'Verifying...' : 'Verify & Login'}
                       </button>
                       <button type="button" onClick={() => setOtpStep(1)} className="w-full text-slate-400 font-bold uppercase text-[10px] tracking-widest hover:text-slate-600">Back</button>
                     </div>
                  </form>
                )
              )}
            </div>
          )}
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

      {currentUser && ['ADMIN', 'SYSTEM_ADMIN', 'RECEPTION', 'DEVELOPER', 'DISPATCHER'].includes(currentUser.role) && emergencies.length > 0 && (
        <div className="bg-red-600 text-white z-[9999] border-b-4 border-red-700 animate-pulse-slow">
          <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-white/20 pb-3">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                </span>
                <ShieldAlert className="text-white animate-bounce" size={24} />
                <h3 className="text-base font-black uppercase tracking-wider">CRITICAL: ACTIVE EMERGENCY ALERT ({emergencies.length})</h3>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest bg-red-800 px-3 py-1.5 rounded-xl border border-red-500 animate-pulse">IMMEDIATE DISPATCH REQUIRED</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {emergencies.map((alert) => (
                <div key={alert.id} className="bg-slate-950/95 border-2 border-red-500 rounded-3xl p-6 text-slate-100 flex flex-col gap-4 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-bl-full flex items-center justify-center">
                    <ShieldAlert size={20} className="text-red-500" />
                  </div>
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-red-500">PHLEBOTOMIST</span>
                    <h4 className="text-base font-black">{alert.phleboName} <span className="text-xs font-bold text-slate-400">({alert.phleboId})</span></h4>
                  </div>
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">CURRENT GPS LOCATION</span>
                    <p className="text-xs font-mono font-bold mt-0.5">{alert.location.lat.toFixed(6)}, {alert.location.lng.toFixed(6)}</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase">{alert.location.address || 'Live Signal'}</p>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <a 
                      href={`tel:${alert.phone}`}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black text-[10px] uppercase tracking-widest py-3 px-4 rounded-xl flex items-center justify-center gap-2 border border-red-500 transition-all active:scale-95 shadow-md"
                    >
                      <Phone size={14} /> CALL PHLEBO
                    </a>
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${alert.location.lat},${alert.location.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-slate-800 hover:bg-slate-700 text-white font-black text-[10px] uppercase tracking-widest py-3 px-4 rounded-xl flex items-center justify-center gap-2 border border-slate-700 transition-all active:scale-95"
                    >
                      <MapPin size={14} /> MAP
                    </a>
                    <button 
                      onClick={async () => {
                        try {
                          await fetch('/api/emergencies/resolve', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ alertId: alert.id })
                          });
                          setEmergencies(prev => prev.filter(e => e.id !== alert.id));
                        } catch(e) {
                          console.error("Failed to resolve emergency:", e);
                        }
                      }}
                      className="bg-brand-green hover:bg-green-700 text-white font-black text-[10px] uppercase tracking-widest py-3 px-4 rounded-xl flex items-center justify-center transition-all active:scale-95"
                    >
                      RESOLVE
                    </button>
                  </div>
                  <div className="text-[8px] text-slate-500 font-bold uppercase mt-1 self-end">
                    TRIGGERED: {new Date(alert.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
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
            calls={visibleCalls} 
            labs={visibleLabs}
            appointments={appointments} 
            config={config} 
            history={visibleHistory}
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
            onBookAppointment={(a) => setAppointments(prev => [...prev, {...a, id: 'A'+Date.now()+Math.random().toString(36).substring(2, 7), status: 'SCHEDULED'} as any])}
            onUpdateAppointmentStatus={(id, s) => setAppointments(prev => prev.map(a => a.id === id ? {...a, status: s} : a) as Appointment[])}
          />
        )}
        {activeRoute === 'DISPATCH' && (
          <Dashboard 
            currentUser={currentUser} 
            calls={visibleCalls} 
            appointments={appointments} 
            config={config} 
            labs={visibleLabs} 
            hospitals={hospitals} 
            tests={tests} 
            phleboList={visiblePhlebos} 
            onCreateCall={handleCreateCall} 
            onUpdateStatus={updateCallStatus} 
            onResendOtp={handleResendOtp}
            onUpdateAppointmentStatus={(id, s) => setAppointments(prev => prev.map(a => a.id === id ? {...a, status: s} : a) as Appointment[])} 
          />
        )}
        {activeRoute === 'ADMIN' && (
          <AdminPanel 
            config={config} 
            labs={visibleLabs}
            tests={tests}
            hospitals={hospitals}
            onUpdateConfig={handleUpdateConfig} 
            onRegisterLab={(l, a) => {
              const lid = 'LAB'+Date.now()+Math.random().toString(36).substring(2, 7);
              const newLabs = [...labs, {...l, id: lid} as DiagnosticLab];
              handleUpdateLabs(newLabs);
              if(a) handleRegisterPhlebo({...a, labId: lid});
            }}
            onUpdateLab={(l) => handleUpdateLabs(labs.map(lab => lab.id === l.id ? l : lab))}
            history={visibleHistory} 
            phleboList={visiblePhlebos}
            activeCalls={visibleCalls}
            currentUser={currentUser}
            onUpdateShift={(id, s, e) => handleUpdateUser(id, { shiftStart: s, shiftEnd: e })}
            onRegisterPhlebo={handleRegisterPhlebo}
            onRemovePhlebo={handleRemovePhlebo}
            onUpdateUserStatus={(id, s) => handleUpdateUser(id, { status: s })}
            onUpdateTests={handleUpdateTests}
            onUpdateLabs={handleUpdateLabs}
            onUpdateHospitals={handleUpdateHospitals}
            onUpdatePhleboRole={(id, r) => handleUpdateUser(id, { role: r })}
            onUpdateCallStatus={updateCallStatus}
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
