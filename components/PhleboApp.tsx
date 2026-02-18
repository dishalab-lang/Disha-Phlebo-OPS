
import React, { useState, useEffect, useRef } from 'react';
import { CollectionCall, CallStatus, Phlebotomist, SystemConfig, CallMetrics, CallType, PaymentMode, Location } from '../types';
import { MapPin, Navigation, CheckCircle2, PackageCheck, AlertCircle, Clock, Truck, ReceiptIndianRupee, Wallet, QrCode, Camera, Image as ImageIcon, Megaphone, Zap, LocateFixed, X, ShieldCheck } from '../utils/lucide-icons-mock'; // Assuming icons are here or relative to where they were imported
import { isWithinGeofence, getCurrentLocation, calculateDistance } from '../utils/geoUtils';
import { LAB_LOCATION } from '../constants';

// Fixed: Corrected icons import as they were previously imported from lucide-react in the provided context
import { 
  MapPin as MapPinIcon, Navigation as NavigationIcon, CheckCircle2 as CheckCircle2Icon, 
  PackageCheck as PackageCheckIcon, AlertCircle as AlertCircleIcon, Clock as ClockIcon, 
  Truck as TruckIcon, Wallet as WalletIcon, QrCode as QrCodeIcon, 
  Camera as CameraIcon, Image as ImageIconIcon, Zap as ZapIcon, 
  LocateFixed as LocateFixedIcon, X as XIcon, ShieldCheck as ShieldCheckIcon 
} from 'lucide-react';

const LogoBird = () => (
  <svg width="40" height="40" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 70C20 70 35 30 75 40C75 40 55 45 60 75C60 75 40 55 20 70Z" fill="url(#paint0_linear)" />
    <path d="M75 40C75 40 85 35 90 45L75 40Z" fill="#FFB800" />
    <defs>
      <linearGradient id="paint0_linear" x1="20" y1="40" x2="60" y2="75" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFB800" />
        <stop offset="1" stopColor="#D46A00" />
      </linearGradient>
    </defs>
  </svg>
);

interface PhleboAppProps {
  currentUser: Phlebotomist;
  calls: CollectionCall[];
  config: SystemConfig;
  onUpdateStatus: (id: string, status: CallStatus, phleboId: string, updates?: any) => void;
  onComplete: (metrics: CallMetrics) => void;
  onUpdateLocation: (id: string, location: Location) => void;
}

const PhleboApp: React.FC<PhleboAppProps> = ({ currentUser, calls, config, onUpdateStatus, onComplete, onUpdateLocation }) => {
  const [activeCall, setActiveCall] = useState<CollectionCall | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [isSimulatingGps, setIsSimulatingGps] = useState(false);
  const [showUpiModal, setShowUpiModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoType, setPhotoType] = useState<'VISIT' | 'SAMPLE' | null>(null);

  const myCurrentCall = calls.find(c => c.assignedPhleboId === currentUser.id && c.status !== CallStatus.COMPLETED);
  const availableCalls = calls.filter(c => c.status === CallStatus.PENDING);

  useEffect(() => {
    setActiveCall(myCurrentCall || null);
  }, [myCurrentCall]);

  // Immediate and ongoing location sync
  useEffect(() => {
    const syncLocation = async () => {
      if (isSimulatingGps) return;
      try {
        const pos = await getCurrentLocation();
        onUpdateLocation(currentUser.id, {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          address: 'Synced'
        });
      } catch (e) {}
    };
    syncLocation();
    const interval = setInterval(syncLocation, 20000);
    return () => clearInterval(interval);
  }, [currentUser.id, isSimulatingGps]);

  const handleAccept = (id: string) => onUpdateStatus(id, CallStatus.ACCEPTED, currentUser.id);

  const confirmPayment = (mode: PaymentMode) => {
    if (!activeCall) return;
    onUpdateStatus(activeCall.id, activeCall.status, currentUser.id, {
      billing: { ...activeCall.billing, paymentStatus: 'PAID', paymentMode: mode }
    });
    setShowUpiModal(false);
  };

  const handleArrived = async () => {
    if (!activeCall) return;
    let currentLoc: Location;
    if (isSimulatingGps) {
      currentLoc = activeCall.destination;
    } else {
      try {
        const pos = await getCurrentLocation();
        currentLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude, address: 'Live' };
      } catch (e) {
        setGeoError("GPS Locked. Use 'Simulation Mode' to test.");
        return;
      }
    }

    if (isWithinGeofence(currentLoc, activeCall.destination, config.geofenceRadiusMeters) || isSimulatingGps) {
      onUpdateStatus(activeCall.id, CallStatus.VISITING, currentUser.id);
      setGeoError(null);
    } else {
      setGeoError(`Too far from patient location (${calculateDistance(currentLoc, activeCall.destination)}km).`);
    }
  };

  const handleHandover = async () => {
    if (!activeCall) return;
    let currentLoc: Location;
    if (isSimulatingGps) {
      currentLoc = LAB_LOCATION;
    } else {
      try {
        const pos = await getCurrentLocation();
        currentLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude, address: 'Live' };
      } catch (e) {
        setGeoError("GPS Permission denied.");
        return;
      }
    }

    if (isWithinGeofence(currentLoc, LAB_LOCATION, 500) || isSimulatingGps) {
      const now = Date.now();
      const isOutsideHours = () => {
        const h = new Date().getHours();
        const [startH] = currentUser.shiftStart.split(':').map(Number);
        const [endH] = currentUser.shiftEnd.split(':').map(Number);
        return h < startH || h >= endH;
      };
      
      const isPremium = activeCall.isPriority || isOutsideHours();
      // Calculate distance once for reuse
      const distance = calculateDistance(activeCall.destination, LAB_LOCATION);
      
      // Calculate targetTat based on brackets
      const sortedBrackets = [...config.tatBrackets].sort((a, b) => a.maxKm - b.maxKm);
      const applicableBracket = sortedBrackets.find(b => distance <= b.maxKm) || sortedBrackets[sortedBrackets.length - 1];
      const targetTat = applicableBracket ? applicableBracket.tatMinutes : config.standardTatMinutes;

      // Fixed: Removed 'acceptDelay' as it is not present in CallMetrics interface
      const metrics: CallMetrics = {
        callId: activeCall.id,
        phleboId: currentUser.id,
        phleboName: currentUser.name,
        patientName: activeCall.patientName,
        totalTat: Math.round((now - activeCall.placedAt) / 60000),
        targetTat: targetTat,
        distance: distance,
        incentive: 0,
        revenue: activeCall.billing.totalAmount,
        paymentMode: activeCall.billing.paymentMode,
        timestamp: now,
        isPremiumIncentive: isPremium,
        status: 'COMPLETED'
      };
      
      // Use the calculated targetTat for incentive logic
      const baseRate = metrics.totalTat <= targetTat ? config.withinTatRate : config.outsideTatRate;
      metrics.incentive = metrics.distance * baseRate * (isPremium ? 1.5 : 1);
      onComplete(metrics);
      onUpdateStatus(activeCall.id, CallStatus.COMPLETED, currentUser.id);
    } else {
      setGeoError("Must be at Lab for handover. Switch to 'Simulation Mode' to test.");
    }
  };

  const upiId = "dishalab@okicici";
  const upiUrl = `upi://pay?pa=${upiId}&pn=Disha%20Diagnostics&am=${activeCall?.billing.totalAmount || 0}&cu=INR`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiUrl)}`;

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-24">
      <input type="file" accept="image/*" capture="environment" className="hidden" ref={fileInputRef} onChange={e => {
        const file = e.target.files?.[0];
        if (file && activeCall && photoType) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const update = photoType === 'VISIT' ? { visitPhoto: reader.result as string } : { samplePhoto: reader.result as string };
            onUpdateStatus(activeCall.id, activeCall.status, currentUser.id, update);
            setPhotoType(null);
          };
          reader.readAsDataURL(file);
        }
      }} />

      <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <LocateFixedIcon size={18} className={isSimulatingGps ? 'text-brand-purple' : 'text-slate-300'} />
        <div className="flex-1">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none">GPS Engine</p>
          <p className="text-xs font-bold text-slate-700 mt-1">{isSimulatingGps ? 'Simulation Mode (Test Geofences)' : 'Live Satellite Feed'}</p>
        </div>
        <button onClick={() => setIsSimulatingGps(!isSimulatingGps)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${isSimulatingGps ? 'bg-brand-purple text-white' : 'bg-slate-100 text-slate-500'}`}>
          {isSimulatingGps ? 'Disable' : 'Enable'} Sim
        </button>
      </div>

      {activeCall ? (
        <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden">
          <div className={`${activeCall.isPriority ? 'brand-gradient' : 'bg-brand-purple'} p-8 text-white`}>
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest opacity-80">
              <span>{activeCall.status.replace('_', ' ')}</span>
              <span className="flex items-center gap-1"><ShieldCheckIcon size={10}/> Verified Call</span>
            </div>
            <h2 className="text-3xl font-black mt-3 tracking-tight">{activeCall.patientName}</h2>
            <p className="text-sm font-medium mt-2 opacity-90 flex items-center gap-2"><MapPinIcon size={16}/> {activeCall.destination.address}</p>
          </div>

          <div className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-4">
               <button onClick={() => { setPhotoType('VISIT'); fileInputRef.current?.click(); }} className="aspect-video bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center hover:bg-white hover:border-brand-purple transition-all group overflow-hidden">
                  {activeCall.visitPhoto ? <img src={activeCall.visitPhoto} className="w-full h-full object-cover" /> : <><CameraIcon className="text-slate-300 group-hover:text-brand-purple mb-1" /><span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Visit Proof</span></>}
               </button>
               <button onClick={() => { setPhotoType('SAMPLE'); fileInputRef.current?.click(); }} className="aspect-video bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center hover:bg-white hover:border-brand-purple transition-all group overflow-hidden">
                  {activeCall.samplePhoto ? <img src={activeCall.samplePhoto} className="w-full h-full object-cover" /> : <><ImageIconIcon className="text-slate-300 group-hover:text-brand-purple mb-1" /><span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Sample Proof</span></>}
               </button>
            </div>

            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
               <div className="flex justify-between items-baseline mb-4">
                 <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Collection Summary</h3>
                 <span className="text-2xl font-black text-brand-purple">₹{activeCall.billing.totalAmount}</span>
               </div>
               {activeCall.billing.paymentStatus === 'PENDING' ? (
                 <div className="grid grid-cols-2 gap-3 mt-4">
                   <button onClick={() => confirmPayment(PaymentMode.CASH)} className="p-4 bg-white border border-slate-200 rounded-2xl font-black text-[10px] uppercase flex flex-col items-center gap-2 hover:border-brand-green">
                     <WalletIcon className="text-brand-green" /> Cash
                   </button>
                   <button onClick={() => setShowUpiModal(true)} className="p-4 bg-white border border-slate-200 rounded-2xl font-black text-[10px] uppercase flex flex-col items-center gap-2 hover:border-brand-purple">
                     <QrCodeIcon className="text-brand-purple" /> UPI/QR
                   </button>
                 </div>
               ) : (
                 <div className="p-4 bg-green-50 border border-green-200 rounded-2xl text-brand-green text-[10px] font-black uppercase text-center flex items-center justify-center gap-2">
                   <CheckCircle2Icon size={16} /> Paid via {activeCall.billing.paymentMode}
                 </div>
               )}
            </div>

            {geoError && <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><AlertCircleIcon size={16} /> {geoError}</div>}

            {activeCall.status === CallStatus.ACCEPTED && <button onClick={handleArrived} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3"><NavigationIcon size={22} /> Mark Arrived</button>}
            {activeCall.status === CallStatus.VISITING && <button onClick={() => activeCall.samplePhoto ? onUpdateStatus(activeCall.id, CallStatus.VISITING, currentUser.id, { status: CallStatus.COLLECTED }) : alert("Upload Sample Proof")} disabled={activeCall.billing.paymentStatus === 'PENDING'} className="w-full bg-brand-green text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 disabled:opacity-50"><CheckCircle2Icon size={22} /> Collect Samples</button>}
            {activeCall.status === CallStatus.COLLECTED && <button onClick={handleHandover} className="w-full bg-brand-purple text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3"><PackageCheckIcon size={22} /> Handover to Lab</button>}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
           {availableCalls.map(call => (
             <div key={call.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                   <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg uppercase">{call.type}</span>
                   <h4 className="text-xl font-black text-slate-900 mt-1">{call.patientName}</h4>
                   <p className="text-xs font-medium text-slate-400 mt-1">{call.destination.address}</p>
                </div>
                <button onClick={() => handleAccept(call.id)} className="bg-brand-green text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg">Accept</button>
             </div>
           ))}
           {availableCalls.length === 0 && <div className="text-center py-20 text-slate-300 font-black uppercase text-xs tracking-widest">Searching for calls...</div>}
        </div>
      )}

      {showUpiModal && (
        <div className="fixed inset-0 bg-brand-purple/40 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xs rounded-[2.5rem] p-10 flex flex-col items-center gap-6 shadow-2xl">
            <h3 className="font-black text-lg uppercase text-brand-purple">Lab UPI: {upiId}</h3>
            <img src={qrUrl} className="w-full rounded-3xl border-4 border-slate-50" />
            <button onClick={() => confirmPayment(PaymentMode.UPI)} className="w-full bg-brand-green text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg">Confirm Payment</button>
            <button onClick={() => setShowUpiModal(false)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhleboApp;
