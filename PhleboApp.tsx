
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CollectionCall, CallStatus, Phlebotomist, SystemConfig, Location, PaymentMode, Appointment, CallMetrics, DiagnosticLab, DiagnosticTest } from './types';
import { 
  MapPin, Navigation, PackageCheck, AlertCircle, Clock, 
  Wallet, QrCode, Camera, FlaskConical, X, Key, Phone, 
  RefreshCw, FileCheck, Zap, ShieldCheck, ShieldAlert, History, ClipboardList, CalendarDays, PlusCircle, User, Calendar, CheckCircle2, XCircle, Maximize2, Ban, TrendingUp, CheckSquare,
  UserX, MapPinOff, Clock4, ShieldX, Info, AlertTriangle, ChevronRight,
  Lock, Plus, Smartphone, LocateFixed, Share2, Building2, Timer, FileText, Shield, Route, Database, Download, UserCircle, Target, Search, ExternalLink, Radar,
  Mic, Square, Play, Volume2
} from 'lucide-react';
import { isWithinGeofence, getCurrentLocation, calculateDistance } from './geoUtils';

import { LogoBird } from './LogoBird';

interface PhleboAppProps {
  currentUser: Phlebotomist;
  calls: CollectionCall[];
  labs: DiagnosticLab[];
  appointments: Appointment[];
  tests: DiagnosticTest[];
  config: SystemConfig;
  history: CallMetrics[];
  onUpdateStatus: (id: string, status: CallStatus, phleboId: string, updates?: any) => void;
  onResendOtp: (id: string) => void;
  onVerifyOtp: (id: string, pin: string) => Promise<{ success: boolean; errorMsg: string }>
  onUpdateLocation: (id: string, location: Location) => void;
  onBookAppointment: (apt: Partial<Appointment>) => void;
  onUpdateAppointmentStatus: (id: string, status: Appointment['status']) => void;
}

const PhleboApp: React.FC<PhleboAppProps> = ({ 
  currentUser, calls, labs, appointments, tests, config, history, 
  onUpdateStatus, onResendOtp, onVerifyOtp, onUpdateLocation, onBookAppointment, onUpdateAppointmentStatus 
}) => {
  const [activeTab, setActiveTab] = useState<'TASKS' | 'TRIPS' | 'SCHEDULE'>('TASKS');
  const [activeCall, setActiveCall] = useState<CollectionCall | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [isSimulatingGps, setIsSimulatingGps] = useState(false);
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [verificationInput, setVerificationInput] = useState('');
  const [currentTime, setCurrentTime] = useState(Date.now());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoType, setPhotoType] = useState<'VISIT' | 'SAMPLE' | 'HANDOVER' | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<{ url: string; label: string } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Appointment Booking State
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [newAppointment, setNewAppointment] = useState({
    patientName: '',
    patientPhone: '',
    testId: '',
    date: '',
    time: ''
  });

  const [tripFilter, setTripFilter] = useState<'DAY' | 'WEEK' | 'MONTH'>('DAY');

  const myCurrentCall = calls.find(c => c.assignedPhleboId === currentUser.id && ![CallStatus.COMPLETED, CallStatus.REJECTED].includes(c.status));
  const availableCalls = calls.filter(c => c.status === CallStatus.PENDING && (!currentUser.labId || c.labId === currentUser.labId));
  
  const myTrips = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const weekMs = 7 * dayMs;
    const monthMs = 30 * dayMs;

    return history.filter(h => {
      if (h.phleboId !== currentUser.id) return false;
      const timeDiff = now - h.timestamp;
      if (tripFilter === 'DAY') return timeDiff <= dayMs;
      if (tripFilter === 'WEEK') return timeDiff <= weekMs;
      return timeDiff <= monthMs;
    });
  }, [history, tripFilter, currentUser.id]);

  const personalTripStats = useMemo(() => {
    return {
      totalKm: myTrips.reduce((acc, curr) => acc + curr.distance, 0),
      totalIncentive: myTrips.reduce((acc, curr) => acc + curr.incentive, 0),
      totalTrips: myTrips.length
    };
  }, [myTrips]);

  useEffect(() => { setActiveCall(myCurrentCall || null); }, [myCurrentCall]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const syncLocation = async () => {
      if (isSimulatingGps) return;
      try {
        const pos = await getCurrentLocation();
        onUpdateLocation(currentUser.id, { lat: pos.coords.latitude, lng: pos.coords.longitude, address: 'Live Node' });
      } catch (e) {}
    };
    syncLocation();
    const interval = setInterval(syncLocation, 20000);
    return () => clearInterval(interval);
  }, [currentUser.id, isSimulatingGps]);

  const handleAccept = (id: string) => onUpdateStatus(id, CallStatus.ACCEPTED, currentUser.id);

  const handleArrived = async () => {
    if (!activeCall) return;
    if (isSimulatingGps) {
      onUpdateStatus(activeCall.id, CallStatus.VISITING, currentUser.id);
      setGeoError(null);
      return;
    }
    try {
      const pos = await getCurrentLocation();
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, address: 'Live' };
      if (isWithinGeofence(loc, activeCall.destination, config.geofenceRadiusMeters)) {
        onUpdateStatus(activeCall.id, CallStatus.VISITING, currentUser.id);
        setGeoError(null);
      } else {
        const dist = calculateDistance(loc, activeCall.destination);
        setGeoError(`Outside Geofence: You are ${dist.toFixed(2)}km away. Please move closer to patient.`);
      }
    } catch (e) {
      setGeoError("GPS Permission Lock. Please enable high accuracy or use Sim Mode.");
    }
  };

  const handleCollect = async () => {
    if (!activeCall) return;
    
    const { success, errorMsg } = await onVerifyOtp(activeCall.id, verificationInput);
    
    if (!success) {
      alert(errorMsg);
      return;
    }

    if (!activeCall.visitPhoto || !activeCall.samplePhoto) {
      alert("Evidence Required: Capture Visit Proof and Sample Photo first.");
      return;
    }
    onUpdateStatus(activeCall.id, CallStatus.COLLECTED, currentUser.id);
    setVerificationInput('');
  };

  const handleNavigate = () => {
    if (!activeCall) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${activeCall.destination.lat},${activeCall.destination.lng}`;
    window.open(url, '_blank');
  };

  const handleCallPatient = () => {
    if (!activeCall) return;
    window.location.href = `tel:${activeCall.patientPhone}`;
  };

  const handleCreateAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAppointment.patientName || !newAppointment.patientPhone || !newAppointment.testId || !newAppointment.date || !newAppointment.time) {
      alert("Please fill all booking details.");
      return;
    }
    
    const test = tests.find(t => t.id === newAppointment.testId);
    const scheduledTimestamp = new Date(`${newAppointment.date}T${newAppointment.time}`).getTime();

    onBookAppointment({
      patientName: newAppointment.patientName,
      patientPhone: newAppointment.patientPhone,
      testId: newAppointment.testId,
      testName: test?.name || 'Diagnostic Service',
      scheduledAt: scheduledTimestamp,
      bookedByPhleboId: currentUser.id,
      status: 'SCHEDULED'
    });

    setIsBookingModalOpen(false);
    setNewAppointment({ patientName: '', patientPhone: '', testId: '', date: '', time: '' });
  };

  const triggerCamera = (type: 'VISIT' | 'SAMPLE' | 'HANDOVER') => {
    setPhotoType(type);
    fileInputRef.current?.click();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          if (activeCall) {
            onUpdateStatus(activeCall.id, activeCall.status, currentUser.id, { voiceNote: base64Audio });
          }
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone access denied or not available.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const playVoiceNote = (url: string) => {
    const audio = new Audio(url);
    audio.play();
  };

  const upiId = "dishalab@okicici";
  const upiUrl = activeCall ? `upi://pay?pa=${upiId}&pn=Disha%20Diagnostics&am=${activeCall.billing.totalAmount}&cu=INR` : "";
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiUrl)}`;

  const ArtifactCard = ({ type, label, data, icon: Icon }: { type: 'VISIT' | 'SAMPLE' | 'HANDOVER', label: string, data?: string, icon: any }) => {
    const isDone = !!data;
    return (
      <button 
        type="button"
        onClick={() => { if (!isDone) triggerCamera(type); else setViewingPhoto({url: data, label}); }} 
        className={`relative aspect-[4/3] rounded-[1.5rem] flex flex-col items-center justify-center border-2 transition-all overflow-hidden ${isDone ? 'bg-white border-brand-green' : 'bg-slate-50 border-slate-100'}`}
      >
        {isDone ? (
          <img src={data} className="w-full h-full object-cover" alt={label} />
        ) : (
          <>
            <Icon className="text-slate-300" size={24} />
            <span className="text-[7px] font-black uppercase mt-1 tracking-widest text-slate-400">{label}</span>
          </>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-24">
      <input type="file" accept="image/*" capture="environment" className="hidden" ref={fileInputRef} onChange={e => {
        const file = e.target.files?.[0];
        if (file && activeCall && photoType) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const updates = photoType === 'VISIT' ? { visitPhoto: reader.result as string } : photoType === 'SAMPLE' ? { samplePhoto: reader.result as string } : { handoverPhoto: reader.result as string };
            onUpdateStatus(activeCall.id, activeCall.status, currentUser.id, updates);
            setPhotoType(null);
          };
          reader.readAsDataURL(file);
        }
      }} />

      <div className="flex bg-white p-2 rounded-2xl border shadow-sm sticky top-0 z-[70] gap-1 backdrop-blur-md">
        <button onClick={() => setActiveTab('TASKS')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'TASKS' ? 'bg-brand-purple text-white shadow-md' : 'text-slate-400'}`}>
          Field Task
        </button>
        <button onClick={() => setActiveTab('TRIPS')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'TRIPS' ? 'bg-brand-purple text-white shadow-md' : 'text-slate-400'}`}>
          My History
        </button>
        <button onClick={() => setActiveTab('SCHEDULE')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'SCHEDULE' ? 'bg-brand-purple text-white shadow-md' : 'text-slate-400'}`}>
          Schedule
        </button>
      </div>

      {activeTab === 'TASKS' && (
        <>
          <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border shadow-sm">
             <LocateFixed size={18} className={isSimulatingGps ? 'text-brand-purple animate-pulse' : 'text-slate-300'} />
             <div className="flex-1">
                <p className="text-[10px] font-black text-slate-700">{isSimulatingGps ? 'Simulating Field Node' : 'Satellite Telemetry Active'}</p>
             </div>
             <button onClick={() => setIsSimulatingGps(!isSimulatingGps)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase border ${isSimulatingGps ? 'bg-brand-purple text-white' : 'bg-slate-50 text-slate-500'}`}>{isSimulatingGps ? 'Stop Sim' : 'Start Sim'}</button>
          </div>

          {activeCall ? (
            <div className={`bg-white rounded-[2.5rem] shadow-2xl border-4 overflow-hidden animate-slide-up ${currentTime - activeCall.placedAt > activeCall.estimatedTatMinutes * 60000 ? 'border-red-500' : 'border-slate-50'}`}>
              <div className={`${activeCall.isPriority ? 'brand-gradient' : 'bg-brand-purple'} p-8 text-white relative`}>
                 <div className="absolute top-6 right-8 text-right">
                    <span className="block text-[8px] font-black uppercase opacity-60">Status</span>
                    <span className="text-xs font-black uppercase tracking-widest">{activeCall.status.replace('_', ' ')}</span>
                 </div>
                 <h2 className="text-3xl font-black tracking-tight">{activeCall.patientName}</h2>
                 <p className="text-[10px] font-bold opacity-80 mt-2 flex items-center gap-2 max-w-[80%] truncate"><MapPin size={12}/> {activeCall.destination.address}</p>
                 
                 <div className="flex gap-2 mt-6">
                    <button onClick={handleNavigate} className="flex-1 bg-white/20 hover:bg-white/30 backdrop-blur-md p-3 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all">
                       <ExternalLink size={14} /> Navigate
                    </button>
                    <button onClick={handleCallPatient} className="flex-1 bg-white/20 hover:bg-white/30 backdrop-blur-md p-3 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all">
                       <Phone size={14} /> Call
                    </button>
                 </div>
              </div>

              <div className="p-8 space-y-8">
                 <div className="grid grid-cols-3 gap-3">
                    <ArtifactCard type="VISIT" label="Visit Photo" data={activeCall.visitPhoto} icon={Camera} />
                    <ArtifactCard type="SAMPLE" label="Vial/Sample" data={activeCall.samplePhoto} icon={FlaskConical} />
                    <ArtifactCard type="HANDOVER" label="Receipt" data={activeCall.handoverPhoto} icon={PackageCheck} />
                 </div>

                 <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                       <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isRecording ? 'bg-red-500 text-white animate-pulse' : activeCall.voiceNote ? 'bg-brand-green/10 text-brand-green' : 'bg-slate-200 text-slate-400'}`}>
                          {isRecording ? <Square size={20} /> : activeCall.voiceNote ? <Volume2 size={20} /> : <Mic size={20} />}
                       </div>
                       <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Voice Context</p>
                          <p className="text-xs font-black text-slate-700">
                             {isRecording ? 'Recording Memo...' : activeCall.voiceNote ? 'Voice Note Attached' : 'Add Voice Memo'}
                          </p>
                       </div>
                    </div>
                    <div className="flex gap-2">
                       {activeCall.voiceNote && !isRecording && (
                          <button onClick={() => playVoiceNote(activeCall.voiceNote!)} className="bg-brand-purple text-white p-3 rounded-xl shadow-md active:scale-95 transition-all">
                             <Play size={16} fill="currentColor" />
                          </button>
                       )}
                       <button 
                          onClick={isRecording ? stopRecording : startRecording} 
                          className={`p-3 rounded-xl shadow-md active:scale-95 transition-all ${isRecording ? 'bg-red-500 text-white' : 'bg-white text-slate-600 border border-slate-100'}`}
                       >
                          {isRecording ? <Square size={16} /> : <Mic size={16} />}
                       </button>
                    </div>
                 </div>
                 
                 {activeCall.status === CallStatus.VISITING && (
                   <div className="bg-slate-900 text-white p-8 rounded-[2rem] space-y-4">
                      <div className="flex justify-between items-center px-2">
                        <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Enter Patient Auth PIN</p>
                        <div className="flex items-center gap-2">
                          <Clock size={10} className="text-orange-400" />
                          <span className="text-[9px] font-black text-orange-400 uppercase">
                            Exp: {Math.max(0, Math.floor((activeCall.otpExpiresAt - currentTime) / 1000))}s
                          </span>
                        </div>
                      </div>
                      <input 
                        type="text" maxLength={4} placeholder="----"
                        value={verificationInput}
                        disabled={activeCall.isOtpLocked}
                        onChange={(e) => setVerificationInput(e.target.value.replace(/[^0-9]/g, ''))}
                        className={`w-full bg-white/10 p-6 rounded-2xl text-center text-5xl font-black tracking-[0.5em] outline-none placeholder:text-white/10 ${activeCall.isOtpLocked ? 'opacity-50' : ''}`}
                      />
                      <div className="flex justify-between items-center px-2">
                        <span className="text-[8px] font-bold text-white/40 uppercase">
                          {activeCall.isOtpLocked ? 'NODE LOCKED' : `${3 - activeCall.otpRetryCount} attempts remaining`}
                        </span>
                        <button 
                          onClick={() => { onResendOtp(activeCall.id); setVerificationInput(''); }}
                          className="text-[9px] font-black text-brand-purple uppercase tracking-widest bg-white/10 px-3 py-1.5 rounded-lg hover:bg-white/20 transition-all"
                        >
                          Resend PIN
                        </button>
                      </div>
                   </div>
                 )}

                 <div className="space-y-4">
                    {activeCall.status === CallStatus.ACCEPTED && (
                       <button onClick={handleArrived} className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black uppercase text-sm tracking-widest shadow-2xl flex items-center justify-center gap-4 transition-all active:scale-95">
                          <Navigation size={24} /> Confirm Arrival
                       </button>
                    )}
                    {activeCall.status === CallStatus.VISITING && (
                       <button 
                          onClick={handleCollect} 
                          disabled={activeCall.billing.paymentStatus === 'PENDING' || !activeCall.visitPhoto || !activeCall.samplePhoto} 
                          className={`w-full py-6 rounded-3xl font-black uppercase text-sm tracking-widest shadow-2xl flex items-center justify-center gap-4 transition-all ${activeCall.billing.paymentStatus === 'PAID' && activeCall.visitPhoto && activeCall.samplePhoto ? 'bg-brand-green text-white' : 'bg-slate-100 text-slate-300'}`}
                       >
                          <CheckCircle2 size={24} /> Complete Collection
                       </button>
                    )}
                    {activeCall.status === CallStatus.COLLECTED && (
                       <button onClick={() => onUpdateStatus(activeCall.id, CallStatus.DELIVERED, currentUser.id)} className="w-full bg-brand-purple text-white py-6 rounded-3xl font-black uppercase text-sm tracking-widest shadow-2xl flex items-center justify-center gap-4">
                          <PackageCheck size={24} /> Handover to Lab Hub
                       </button>
                    )}
                 </div>

                 {geoError && <div className="p-4 bg-red-50 text-red-500 rounded-2xl text-[10px] font-black uppercase text-center border border-red-100 flex items-center justify-center gap-2 animate-shake"><AlertTriangle size={14} /> {geoError}</div>}
                 
                 <div className="flex justify-between items-center px-2">
                    <div className="flex flex-col">
                       <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Quote Total</span>
                       <span className="text-lg font-black text-slate-900">₹{activeCall.billing.totalAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col items-end">
                       <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">TAT Countdown</span>
                       <span className={`text-lg font-black ${currentTime - activeCall.placedAt > activeCall.estimatedTatMinutes * 60000 ? 'text-red-500' : 'text-brand-purple'}`}>
                          {Math.max(0, activeCall.estimatedTatMinutes - Math.floor((currentTime - activeCall.placedAt) / 60000))}m Left
                       </span>
                    </div>
                 </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-slide-up">
               <div className="flex items-center justify-between px-2">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <Radar size={16} className="text-brand-purple animate-pulse" /> Available Broadcasts
                  </h3>
                  <span className="text-[10px] font-black text-slate-400 uppercase">{availableCalls.length} Tasks Nearby</span>
               </div>
               
               {availableCalls.length > 0 ? availableCalls.map(call => {
                 const distance = currentUser.currentLocation ? calculateDistance(currentUser.currentLocation, call.destination) : null;
                 
                 return (
                   <div key={call.id} className="bg-white p-8 rounded-[2.5rem] border shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between hover:border-brand-purple transition-all group gap-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                           <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest ${call.isPriority ? 'bg-orange-50 text-orange-600' : 'bg-slate-100 text-slate-500'}`}>
                             {call.isPriority ? 'URGENT' : 'STANDARD'}
                           </span>
                           <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{call.billing.tests.length} Services</span>
                           {distance !== null && (
                             <span className="text-[9px] font-black text-brand-purple uppercase tracking-widest ml-auto sm:ml-0">
                               {distance.toFixed(1)} km away
                             </span>
                           )}
                        </div>
                        <h4 className="text-2xl font-black text-slate-900">{call.patientName}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-1">
                          <MapPin size={10} /> {call.destination.address}
                        </p>
                      </div>
                      <div className="w-full sm:w-auto flex flex-col items-center gap-2">
                        <button onClick={() => handleAccept(call.id)} className="w-full sm:w-auto bg-brand-green text-white px-10 py-4 rounded-2xl font-black text-xs uppercase shadow-lg group-hover:scale-105 transition-all">
                          Accept Task
                        </button>
                        <span className="text-[7px] font-black text-slate-300 uppercase tracking-[0.2em]">First-come basis</span>
                      </div>
                   </div>
                 );
               }) : (
                 <div className="flex flex-col items-center justify-center py-40 text-slate-300">
                    <div className="relative">
                      <Smartphone size={64} className="opacity-10 mb-6" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Radar size={32} className="opacity-20 animate-ping" />
                      </div>
                    </div>
                    <p className="text-xs font-black uppercase tracking-[0.4em]">Scanning for Broadcasts...</p>
                 </div>
               )}
            </div>
          )
}
        </>
      )}

      {activeTab === 'TRIPS' && (
        <div className="space-y-6 animate-slide-up">
           <div className="bg-white p-10 rounded-[2.5rem] border shadow-sm flex flex-col gap-8">
              <div className="flex justify-between items-center">
                 <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Performance Summary</h3>
                 <div className="flex bg-slate-50 p-1 rounded-xl border">
                    {(['DAY', 'WEEK', 'MONTH'] as const).map(f => (
                       <button key={f} onClick={() => setTripFilter(f)} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${tripFilter === f ? 'bg-brand-purple text-white' : 'text-slate-400'}`}>{f}</button>
                    ))}
                 </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                 <div className="bg-slate-50 p-6 rounded-3xl flex flex-col items-center">
                    <span className="text-[8px] font-black text-slate-400 uppercase mb-2">My Payout</span>
                    <span className="text-lg font-black text-brand-green">₹{personalTripStats.totalIncentive.toFixed(0)}</span>
                 </div>
                 <div className="bg-slate-50 p-6 rounded-3xl flex flex-col items-center">
                    <span className="text-[8px] font-black text-slate-400 uppercase mb-2">Coverage</span>
                    <span className="text-lg font-black text-slate-900">{personalTripStats.totalKm.toFixed(1)}km</span>
                 </div>
                 <div className="bg-slate-50 p-6 rounded-3xl flex flex-col items-center">
                    <span className="text-[8px] font-black text-slate-400 uppercase mb-2">Handovers</span>
                    <span className="text-lg font-black text-slate-900">{personalTripStats.totalTrips}</span>
                 </div>
              </div>
           </div>
           <div className="space-y-3">
              {myTrips.length > 0 ? myTrips.map((trip, idx) => (
                 <div key={idx} className="bg-white p-6 rounded-[1.5rem] border shadow-sm flex justify-between items-center group">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-xl bg-brand-purple/5 flex items-center justify-center text-brand-purple">
                          <CheckSquare size={20} />
                       </div>
                       <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-900">{trip.patientName}</span>
                          <span className="text-[8px] font-bold text-slate-400 uppercase">{new Date(trip.timestamp).toLocaleDateString()} • {trip.distance.toFixed(1)}km</span>
                       </div>
                    </div>
                    <div className="text-right">
                       <div className="text-sm font-black text-brand-green">+₹{trip.incentive.toFixed(0)}</div>
                       <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{trip.totalTat}m TAT</span>
                    </div>
                 </div>
              )) : (
                 <div className="py-24 text-center text-slate-300 text-[10px] font-black uppercase tracking-widest opacity-20">History Silent... Check filter settings.</div>
              )}
           </div>
        </div>
      )}

      {activeTab === 'SCHEDULE' && (
        <div className="space-y-6 animate-slide-up">
           <div className="flex justify-between items-center bg-white p-8 rounded-[2rem] border shadow-sm">
             <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Roster Queue</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Future Service Tasks</p>
             </div>
             <button onClick={() => setIsBookingModalOpen(true)} className="bg-brand-purple text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg active:scale-95 transition-all">
                <PlusCircle size={18} /> New Entry
             </button>
           </div>

           <div className="space-y-3">
              {appointments.length > 0 ? appointments.map((apt) => (
                 <div key={apt.id} className="bg-white p-6 rounded-[1.5rem] border shadow-sm flex justify-between items-center animate-slide-up group">
                    <div className="flex items-center gap-4">
                       <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${apt.status === 'SCHEDULED' ? 'bg-brand-purple/5 text-brand-purple' : apt.status === 'CONVERTED' ? 'bg-brand-green/5 text-brand-green' : 'bg-red-50 text-red-500'}`}>
                          <Calendar size={24} />
                       </div>
                       <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-900">{apt.patientName}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{apt.testName}</span>
                          <span className="text-[8px] font-black text-slate-400 uppercase mt-1 flex items-center gap-1"><Clock4 size={10} /> {new Date(apt.scheduledAt).toLocaleString()}</span>
                       </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                       <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${apt.status === 'SCHEDULED' ? 'bg-brand-purple/5 text-brand-purple border-brand-purple/10' : apt.status === 'CONVERTED' ? 'bg-brand-green/5 text-brand-green border-brand-green/10' : 'bg-red-50 text-red-500 border-red-500/10'}`}>
                          {apt.status}
                       </span>
                       {apt.status === 'SCHEDULED' && (
                         <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={() => onUpdateAppointmentStatus(apt.id, 'CANCELLED')} className="p-2 text-red-300 hover:text-red-500 rounded-xl transition-all"><XCircle size={16} /></button>
                         </div>
                       )}
                    </div>
                 </div>
              )) : (
                <div className="flex flex-col items-center justify-center py-40 text-slate-200">
                    <CalendarDays size={64} className="opacity-10 mb-6" />
                    <p className="text-xs font-black uppercase tracking-[0.4em]">Grid Silent...</p>
                 </div>
              )}
           </div>
        </div>
      )}

      {/* Appointment Booking Modal */}
      {isBookingModalOpen && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-2xl z-[500] flex items-center justify-center p-6">
           <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-slide-up">
              <div className="p-8 bg-brand-purple text-white flex justify-between items-center">
                 <h3 className="text-xl font-black uppercase tracking-widest">Book Appointment</h3>
                 <button onClick={() => setIsBookingModalOpen(false)} className="bg-white/10 p-2 rounded-xl active:scale-95"><X size={20} /></button>
              </div>
              <form onSubmit={handleCreateAppointment} className="p-10 space-y-6">
                 <div className="space-y-4">
                    <div>
                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Patient Name</label>
                       <input 
                         required 
                         placeholder="Full Legal Name" 
                         value={newAppointment.patientName} 
                         onChange={e => setNewAppointment({...newAppointment, patientName: e.target.value})} 
                         className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 ring-brand-purple" 
                       />
                    </div>
                    <div>
                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Contact Mobile</label>
                       <input 
                         required 
                         type="tel" 
                         placeholder="98765..." 
                         value={newAppointment.patientPhone} 
                         onChange={e => setNewAppointment({...newAppointment, patientPhone: e.target.value})} 
                         className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 ring-brand-purple" 
                       />
                    </div>
                    <div>
                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Diagnostic Profile</label>
                       <select 
                         required 
                         value={newAppointment.testId} 
                         onChange={e => setNewAppointment({...newAppointment, testId: e.target.value})} 
                         className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 ring-brand-purple appearance-none"
                       >
                          <option value="">Select Service Node</option>
                          {tests.map(test => (
                            <option key={test.id} value={test.id}>{test.name} - ₹{test.price}</option>
                          ))}
                       </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Target Date</label>
                          <input 
                            required 
                            type="date" 
                            min={new Date().toISOString().split('T')[0]}
                            value={newAppointment.date} 
                            onChange={e => setNewAppointment({...newAppointment, date: e.target.value})} 
                            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 ring-brand-purple" 
                          />
                       </div>
                       <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Target Time</label>
                          <input 
                            required 
                            type="time" 
                            value={newAppointment.time} 
                            onChange={e => setNewAppointment({...newAppointment, time: e.target.value})} 
                            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 ring-brand-purple" 
                          />
                       </div>
                    </div>
                 </div>
                 <button type="submit" className="w-full bg-brand-green text-white py-5 rounded-3xl font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-95 transition-all mt-4">Confirm Roster</button>
              </form>
           </div>
        </div>
      )}

      {showUpiModal && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-2xl z-[400] flex items-center justify-center p-6" onClick={() => setShowUpiModal(false)}>
          <div className="bg-white w-full max-sm rounded-[4rem] p-12 flex flex-col items-center gap-8 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
             <h3 className="font-black text-xl uppercase tracking-widest text-brand-purple">UPI Authorization</h3>
             <img src={qrUrl} className="w-full rounded-[2.5rem] border-4 border-slate-50 shadow-inner" alt="UPI QR" />
             <button onClick={() => { onUpdateStatus(activeCall!.id, activeCall!.status, currentUser.id, { billing: {...activeCall!.billing, paymentStatus: 'PAID', paymentMode: PaymentMode.UPI}}); setShowUpiModal(false); }} className="w-full bg-brand-green text-white py-6 rounded-3xl font-black uppercase text-xs tracking-widest shadow-xl">Complete Payment</button>
          </div>
        </div>
      )}

      {viewingPhoto && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-3xl z-[600] flex flex-col items-center justify-center p-8" onClick={() => setViewingPhoto(null)}>
           <p className="text-white text-xs font-black uppercase tracking-[0.4em] mb-6">{viewingPhoto.label}</p>
           <img src={viewingPhoto.url} className="max-w-full max-h-[70vh] rounded-[2rem] shadow-2xl border-4 border-white/20" alt="Evidence" />
           <button className="mt-10 bg-white/10 text-white p-5 rounded-full hover:bg-white/20 transition-all"><X size={32}/></button>
        </div>
      )}
    </div>
  );
};

export default PhleboApp;
