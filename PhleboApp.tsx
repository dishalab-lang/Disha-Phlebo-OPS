
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CollectionCall, CallStatus, Phlebotomist, SystemConfig, Location, PaymentMode, Appointment, CallMetrics, DiagnosticLab, DiagnosticTest } from './types';
import { 
  MapPin, Navigation, PackageCheck, AlertCircle, Clock, 
  Wallet, QrCode, Camera, FlaskConical, X, Key, Phone, 
  RefreshCw, FileCheck, Zap, ShieldCheck, ShieldAlert, History, ClipboardList, CalendarDays, PlusCircle, User, Calendar, CheckCircle2, XCircle, Maximize2, Ban, TrendingUp, CheckSquare,
  UserX, MapPinOff, Clock4, ShieldX, Info, AlertTriangle, ChevronRight, Fingerprint,
  Lock, Plus, Smartphone, LocateFixed, Share2, Building2, Timer, FileText, Shield, Route, Database, Download, UserCircle, Target, Search, ExternalLink, Radar,
  Mic, Square, Play, Volume2, CreditCard, Link, BarChart3, Truck, Battery, BatteryCharging
} from 'lucide-react';
import { isWithinGeofence, getCurrentLocation, calculateDistance } from './geoUtils';

import { LogoBird } from './LogoBird';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { indexedDbHelper } from './indexedDbHelper';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface PhleboAppProps {
  currentUser: Phlebotomist;
  calls: CollectionCall[];
  labs: DiagnosticLab[];
  appointments: Appointment[];
  tests: DiagnosticTest[];
  config: SystemConfig;
  history: CallMetrics[];
  onUpdateStatus: (id: string, status: CallStatus, phleboId: string, updates?: any) => void;
  onResendOtp: (id: string, isHandover?: boolean) => void;
  onVerifyOtp: (id: string, pin: string) => Promise<{ success: boolean; errorMsg: string }>
  onUpdateLocation: (id: string, location: Location) => void;
  onBookAppointment: (apt: Partial<Appointment>) => void;
  onUpdateAppointmentStatus: (id: string, status: Appointment['status']) => void;
}

const PhleboApp: React.FC<PhleboAppProps> = ({ 
  currentUser, calls, labs, appointments, tests, config, history, 
  onUpdateStatus, onResendOtp, onVerifyOtp, onUpdateLocation, onBookAppointment, onUpdateAppointmentStatus 
}) => {
  const [activeTab, setActiveTab] = useState<'TASKS' | 'TRIPS' | 'SCHEDULE' | 'REPORTS'>('TASKS');
  const [selectedActiveCallId, setSelectedActiveCallId] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [isSimulatingGps, setIsSimulatingGps] = useState(false);
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [showNavOptions, setShowNavOptions] = useState(false);
  const [showMiniMapModal, setShowMiniMapModal] = useState(false);
  const [miniMapLocation, setMiniMapLocation] = useState<Location | null>(null);
  const [isRefreshingGps, setIsRefreshingGps] = useState(false);
  const [verificationInput, setVerificationInput] = useState('');
  const [handoverInput, setHandoverInput] = useState('');
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [forceOffline, setForceOffline] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingQueue, setPendingQueue] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('disha_pending_sync') || '[]');
    } catch (e) {
      return [];
    }
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [indexedDbCalls, setIndexedDbCalls] = useState<CollectionCall[]>([]);

  // Load initial pendingQueue and calls from IndexedDB on mount
  useEffect(() => {
    const loadFromDb = async () => {
      try {
        const dbQueue = await indexedDbHelper.getPendingSync();
        if (dbQueue && dbQueue.length > 0) {
          setPendingQueue(dbQueue);
        }
      } catch (err) {
        console.error("Failed to load pending sync queue from IndexedDB:", err);
      }

      try {
        const dbCalls = await indexedDbHelper.getCalls();
        if (dbCalls && dbCalls.length > 0) {
          setIndexedDbCalls(dbCalls);
        }
      } catch (err) {
        console.error("Failed to load calls from IndexedDB in PhleboApp:", err);
      }
    };
    loadFromDb();
  }, []);

  // Sync state to localStorage and IndexedDB
  useEffect(() => {
    localStorage.setItem('disha_pending_sync', JSON.stringify(pendingQueue));
    indexedDbHelper.savePendingSyncList(pendingQueue);
  }, [pendingQueue]);

  // Sync calls prop to IndexedDB
  useEffect(() => {
    if (calls && calls.length > 0) {
      indexedDbHelper.saveCalls(calls);
      setIndexedDbCalls(calls);
    }
  }, [calls]);

  const effectiveCalls = calls && calls.length > 0 ? calls : indexedDbCalls;

  const getPhleboRefLocation = (): Location => {
    // Find phlebotomist's assigned HUB/lab
    const phleboLab = labs.find(l => l.id === currentUser.labId) || labs[0];
    
    if (currentUser.currentLocation && currentUser.currentLocation.lat !== 0 && currentUser.currentLocation.lng !== 0) {
      if (phleboLab) {
        const distToLab = calculateDistance(currentUser.currentLocation, phleboLab.location);
        // If within 100km, the location is probably valid
        if (distToLab <= 100) {
          return currentUser.currentLocation;
        }
      } else {
        return currentUser.currentLocation;
      }
    }
    
    // Fallback to phlebotomist's assigned HUB location
    if (phleboLab) {
      return phleboLab.location;
    }
    
    // Ultimate fallback
    return { lat: 17.684942, lng: 73.998142, address: 'Satara, Maharashtra' };
  };

  // Handle connection events
  useEffect(() => {
    const handleOnline = () => {
      if (!forceOffline) setIsOnline(true);
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [forceOffline]);

  useEffect(() => {
    setIsOnline(navigator.onLine && !forceOffline);
  }, [forceOffline]);

  const syncPendingQueue = async () => {
    if (isSyncing || pendingQueue.length === 0) return;
    setIsSyncing(true);

    const queueToProcess = [...pendingQueue];
    const failedIds = new Set<string>();

    for (const item of queueToProcess) {
      try {
        const updateObj: any = { ...item.updates, status: item.status };
        
        if (item.status === CallStatus.ACCEPTED) {
          updateObj.acceptedAt = item.timestamp;
          updateObj.assignedPhleboId = item.phleboId;
        }
        if (item.status === CallStatus.PENDING) {
          updateObj.assignedPhleboId = null;
          updateObj.acceptedAt = null;
          updateObj.arrivedLocation = null;
          updateObj.visitPhoto = null;
          updateObj.samplePhoto = null;
          updateObj.sampleType = null;
          updateObj.voiceNote = null;
        }
        if (item.status === CallStatus.COLLECTED) {
          updateObj.collectedAt = item.timestamp;
        }
        if (item.status === CallStatus.IN_TRANSIT) {
          updateObj.transitAt = item.timestamp;
        }
        if (item.status === CallStatus.RECEIVED_AT_LAB) {
          updateObj.receivedAt = item.timestamp;
        }

        const res = await fetch(`/api/calls/${item.callId}`, {
          method: 'PATCH',
          headers: { 
            'Content-Type': 'application/json',
            'x-user-id': item.phleboId
          },
          body: JSON.stringify(updateObj)
        });

        if (res.ok) {
          // Re-trigger state update locally
          onUpdateStatus(item.callId, item.status, item.phleboId, item.updates);
        } else {
          failedIds.add(item.id);
        }
      } catch (error) {
        console.error(`Failed to sync pending call status for ${item.callId}:`, error);
        failedIds.add(item.id);
      }
    }

    setPendingQueue(prev => prev.filter(item => failedIds.has(item.id)));
    setIsSyncing(false);
  };

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingQueue.length > 0) {
      syncPendingQueue();
    }
  }, [isOnline, pendingQueue.length]);

  const triggerStatusUpdate = (callId: string, status: CallStatus, phleboId: string, updates?: any) => {
    const timestamp = Date.now();
    
    if (!isOnline) {
      const newItem = {
        id: 'sync_' + Date.now() + Math.random().toString(36).substring(2, 7),
        callId,
        status,
        phleboId,
        updates,
        timestamp
      };
      setPendingQueue(prev => [...prev, newItem]);
    }

    onUpdateStatus(callId, status, phleboId, updates);
  };

  const getRemainingTime = (call: CollectionCall) => {
    const targetTimeMs = call.estimatedTatMinutes * 60000;
    const elapsedMs = currentTime - call.placedAt;
    const remainingMs = targetTimeMs - elapsedMs;
    const isOverdue = remainingMs <= 0;
    
    const absRemainingMs = Math.abs(remainingMs);
    const totalSeconds = Math.floor(absRemainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    const formattedTime = `${isOverdue ? '-' : ''}${minutes}:${seconds.toString().padStart(2, '0')}`;
    const isCritical = elapsedMs > 0.8 * targetTimeMs;
    
    return {
      formattedTime,
      isOverdue,
      isCritical,
      remainingMs
    };
  };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoType, setPhotoType] = useState<'VISIT' | 'SAMPLE' | 'HANDOVER' | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<{ url: string; label: string } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [isCharging, setIsCharging] = useState<boolean | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        const updateBattery = () => {
          const level = battery.level * 100;
          const charging = battery.charging;
          setBatteryLevel(level);
          setIsCharging(charging);

          // Update backend
          fetch(`/api/users/${currentUser.id}/battery`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ batteryLevel: level, isCharging: charging })
          }).catch(console.error);
        };
        updateBattery();
        battery.addEventListener('levelchange', updateBattery);
        battery.addEventListener('chargingchange', updateBattery);
      });
    }
  }, [currentUser.id]);

  // Appointment Booking State
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  // SOS State
  const [isPressing, setIsPressing] = useState(false);
  const [pressProgress, setPressProgress] = useState(0); // 0 to 100
  const [isSosActive, setIsSosActive] = useState(false);
  const pressTimerRef = useRef<any>(null);
  const progressIntervalRef = useRef<any>(null);

  // Check on mount if this phlebo already has an active emergency
  useEffect(() => {
    const checkActiveSos = async () => {
      try {
        const res = await fetch('/api/emergencies');
        if (res.ok) {
          const list = await res.json();
          const active = list.some((e: any) => e.phleboId === currentUser.id);
          setIsSosActive(active);
        }
      } catch (err) {
        console.error("Failed to fetch active emergencies:", err);
      }
    };
    checkActiveSos();
  }, [currentUser.id]);

  const startPress = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (isSosActive) return;
    setIsPressing(true);
    setPressProgress(0);

    const startTime = Date.now();
    const duration = 3000; // 3 seconds

    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / duration) * 100, 100);
      setPressProgress(progress);
      if (progress >= 100) {
        clearInterval(progressIntervalRef.current);
      }
    }, 50);

    pressTimerRef.current = setTimeout(async () => {
      setIsPressing(false);
      setPressProgress(0);
      setIsSosActive(true);
      
      // Trigger SOS
      try {
        let coords = { lat: 0, lng: 0, address: "Live GPS Signal" };
        try {
          const pos = await getCurrentLocation();
          coords = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            address: "Live GPS Signal"
          };
        } catch (err) {
          // Fallback to currentUser's last known location
          if (currentUser.currentLocation) {
            coords = {
              ...currentUser.currentLocation,
              address: currentUser.currentLocation.address || "Last Known Location"
            };
          }
        }

        await fetch('/api/emergency', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phleboId: currentUser.id,
            location: coords
          })
        });

        // Optional high alert beep
        try {
          const context = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = context.createOscillator();
          const gain = context.createGain();
          osc.connect(gain);
          gain.connect(context.destination);
          osc.frequency.value = 880;
          gain.gain.setValueAtTime(0.1, context.currentTime);
          osc.start();
          setTimeout(() => osc.stop(), 500);
        } catch(e) {}
      } catch (err) {
        console.error("SOS Trigger Error:", err);
      }
    }, duration);
  };

  const endPress = () => {
    setIsPressing(false);
    setPressProgress(0);
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
  };

  const handleCancelSos = async () => {
    setIsSosActive(false);
    try {
      const res = await fetch('/api/emergencies');
      if (res.ok) {
        const list = await res.json();
        const myAlert = list.find((e: any) => e.phleboId === currentUser.id);
        if (myAlert) {
          await fetch('/api/emergencies/resolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ alertId: myAlert.id })
          });
        }
      }
    } catch(err) {
      console.error(err);
    }
  };
  const [newAppointment, setNewAppointment] = useState({
    patientName: '',
    patientPhone: '',
    testId: '',
    date: '',
    time: ''
  });

  const [tripFilter, setTripFilter] = useState<'DAY' | 'WEEK' | 'MONTH' | 'ALL'>('DAY');

  const myActiveCalls = useMemo(() => 
    effectiveCalls.filter(c => c.assignedPhleboId === currentUser?.id && ![CallStatus.COMPLETED, CallStatus.REJECTED].includes(c.status)),
    [effectiveCalls, currentUser?.id]
  );

  const activeCall = useMemo(() => 
    myActiveCalls.find(c => c.id === selectedActiveCallId) || myActiveCalls[0] || null,
    [myActiveCalls, selectedActiveCallId]
  );

  const availableCalls = effectiveCalls.filter(c => c.status === CallStatus.PENDING && (!currentUser?.labId || c.labId === currentUser?.labId));
  
  const myTrips = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const weekMs = 7 * dayMs;
    const monthMs = 30 * dayMs;

    return history.filter(h => {
      const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SYSTEM_ADMIN' || currentUser?.role === 'DEVELOPER';
      if (!isAdmin && h.phleboId !== currentUser?.id) return false;
      if (tripFilter === 'ALL') return true;
      const timeDiff = now - h.timestamp;
      if (tripFilter === 'DAY') return timeDiff <= dayMs;
      if (tripFilter === 'WEEK') return timeDiff <= weekMs;
      return timeDiff <= monthMs;
    });
  }, [history, tripFilter, currentUser?.id]);

  const handleDownloadInvoice = (trip: CallMetrics) => {
    const doc = new jsPDF() as any;
    doc.setFontSize(18);
    doc.text('DISHA DIAGNOSTICS - INVOICE', 20, 20);
    doc.setFontSize(10);
    doc.text(`Patient: ${trip.patientName}`, 20, 30);
    doc.text(`Date: ${new Date(trip.timestamp).toLocaleString()}`, 20, 35);
    doc.text(`Phlebotomist: ${trip.phleboName}`, 20, 40);
    doc.text(`Payment Mode: ${trip.paymentMode}`, 20, 45);
    
    doc.autoTable({
      startY: 55,
      head: [['Description', 'Amount']],
      body: [
        ['Diagnostic Services', `Rs. ${trip.revenue}`],
        ['Total', `Rs. ${trip.revenue}`]
      ],
      theme: 'grid',
      headStyles: { fillColor: [139, 92, 246] }
    });
    
    doc.save(`Invoice_${trip.patientName.replace(/\s+/g, '_')}_${trip.timestamp}.pdf`);
  };

  const personalTripStats = useMemo(() => {
    return {
      totalKm: myTrips.reduce((acc, curr) => acc + (Number(curr.distance) || 0), 0),
      totalIncentive: myTrips.reduce((acc, curr) => acc + (Number(curr.incentive) || 0), 0),
      totalTrips: myTrips.length
    };
  }, [myTrips]);

  useEffect(() => { 
    if (myActiveCalls.length > 0 && !selectedActiveCallId) {
      setSelectedActiveCallId(myActiveCalls[0].id);
    } else if (myActiveCalls.length === 0) {
      setSelectedActiveCallId(null);
    }
  }, [myActiveCalls, selectedActiveCallId]);

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

  useEffect(() => {
    const refLoc = getPhleboRefLocation();
    if (activeCall && refLoc && !isSimulatingGps) {
      const isInside = isWithinGeofence(refLoc, activeCall.destination, config.geofenceRadiusMeters);
      
      if (activeCall.status === CallStatus.VISITING || activeCall.status === CallStatus.IN_PROGRESS) {
        if (!isInside) {
          const dist = calculateDistance(refLoc, activeCall.destination);
          setGeoError(`Alert: You are ${dist.toFixed(2)}km outside the collection radius.`);
        } else {
          setGeoError(null);
        }
      } else if (activeCall.status === CallStatus.ACCEPTED) {
        if (isInside) {
          setGeoError(null);
        }
      }
    } else if (!activeCall) {
      setGeoError(null);
    }
  }, [activeCall, currentUser.currentLocation, config.geofenceRadiusMeters, isSimulatingGps, labs]);

  const handleAccept = (id: string) => {
    const refLoc = getPhleboRefLocation();
    triggerStatusUpdate(id, CallStatus.ACCEPTED, currentUser.id, {
      acceptedLocation: refLoc
    });
  };

  const handleArrived = async () => {
    if (!activeCall) return;
    if (isSimulatingGps) {
      triggerStatusUpdate(activeCall.id, CallStatus.VISITING, currentUser.id, {
        arrivedLocation: currentUser.currentLocation || { lat: 0, lng: 0, address: 'Simulated' }
      });
      setGeoError(null);
      return;
    }
    try {
      const pos = await getCurrentLocation();
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, address: 'Live' };
      if (isWithinGeofence(loc, activeCall.destination, config.geofenceRadiusMeters)) {
        triggerStatusUpdate(activeCall.id, CallStatus.VISITING, currentUser.id, {
          arrivedLocation: loc
        });
        setGeoError(null);
      } else {
        const dist = calculateDistance(loc, activeCall.destination);
        setGeoError(`Outside Geofence: You are ${dist.toFixed(2)}km away. Please move closer to patient.`);
      }
    } catch (e) {
      setGeoError("GPS Permission Lock. Please enable high accuracy or use Sim Mode.");
    }
  };

  const handleVerifyAndStart = async () => {
    if (!activeCall) return;
    
    const { success, errorMsg } = await onVerifyOtp(activeCall.id, verificationInput);
    
    if (!success) {
      alert(errorMsg);
      return;
    }
    setVerificationInput('');
  };

  const handleCompleteCollection = () => {
    if (!activeCall) return;
    if (!activeCall.visitPhoto || !activeCall.samplePhoto) {
      alert("Evidence Required: Capture Visit Proof and Sample Photo first.");
      return;
    }
    triggerStatusUpdate(activeCall.id, CallStatus.COLLECTED, currentUser.id);
  };

  const handleNavigate = () => {
    if (!activeCall) return;
    setShowNavOptions(true);
  };

  const handleOpenMiniMap = async () => {
    setShowMiniMapModal(true);
    setIsRefreshingGps(true);
    try {
      const pos = await getCurrentLocation();
      const newLoc: Location = { lat: pos.coords.latitude, lng: pos.coords.longitude, address: 'Live Browser GPS' };
      setMiniMapLocation(newLoc);
      onUpdateLocation(currentUser.id, newLoc);
    } catch (e) {
      setMiniMapLocation(getPhleboRefLocation());
    } finally {
      setIsRefreshingGps(false);
    }
  };

  const handleRefreshMiniMapGps = async () => {
    setIsRefreshingGps(true);
    try {
      const pos = await getCurrentLocation();
      const newLoc: Location = { lat: pos.coords.latitude, lng: pos.coords.longitude, address: 'Live Browser GPS' };
      setMiniMapLocation(newLoc);
      onUpdateLocation(currentUser.id, newLoc);
    } catch (e) {
      setMiniMapLocation(getPhleboRefLocation());
    } finally {
      setIsRefreshingGps(false);
    }
  };

  const navigateWithGoogleMaps = () => {
    if (!activeCall) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${activeCall.destination.lat},${activeCall.destination.lng}`;
    window.open(url, '_blank');
    setShowNavOptions(false);
  };

  const navigateWithWaze = () => {
    if (!activeCall) return;
    const url = `https://waze.com/ul?ll=${activeCall.destination.lat},${activeCall.destination.lng}&navigate=yes`;
    window.open(url, '_blank');
    setShowNavOptions(false);
  };

  const handleCallPatient = () => {
    if (!activeCall) return;
    window.location.href = `tel:${activeCall.patientPhone}`;
  };

  const handleTogglePriority = () => {
    if (!activeCall) return;
    const newPriority = !activeCall.isPriority;
    onUpdateStatus(activeCall.id, activeCall.status, currentUser.id, { isPriority: newPriority });
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
            triggerStatusUpdate(activeCall.id, activeCall.status, currentUser.id, { voiceNote: base64Audio });
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
  const upiUrl = activeCall && activeCall.billing ? `upi://pay?pa=${upiId}&pn=Disha%20Diagnostics&am=${activeCall.billing.totalAmount}&cu=INR` : "";
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
            triggerStatusUpdate(activeCall.id, activeCall.status, currentUser.id, updates);
            setPhotoType(null);
          };
          reader.readAsDataURL(file);
        }
      }} />

      {batteryLevel !== null && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl border shadow-sm ${batteryLevel < 20 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-slate-100 text-slate-500'}`}>
             {isCharging ? <BatteryCharging size={14} /> : <Battery size={14} />}
             <span className="text-[10px] font-black uppercase tracking-widest">{Math.round(batteryLevel)}% {isCharging ? 'Charging' : 'Remaining'}</span>
          </div>
      )}

      {/* Network Connectivity and Pending Sync Status */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 rounded-2xl border shadow-sm ${isOnline ? 'bg-white border-slate-100 text-slate-500' : 'bg-amber-50 border-amber-200 text-amber-800 animate-[pulse_3s_infinite]'}`}>
        <div className="flex items-center justify-between sm:justify-start gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-amber-500 animate-ping'}`} />
            <span className="text-[10px] font-black uppercase tracking-widest">
              {isOnline ? 'Network: Online' : 'Network: Offline'}
            </span>
          </div>
          
          <button 
            type="button"
            onClick={() => setForceOffline(!forceOffline)}
            className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${forceOffline ? 'bg-red-500 text-white shadow-sm border border-red-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'}`}
          >
            {forceOffline ? 'Go Online' : 'Force Offline'}
          </button>
        </div>
        
        {pendingQueue.length > 0 && (
          <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-2 sm:pt-0 border-dashed border-current/10">
            <span className="text-[9px] font-black uppercase tracking-widest bg-amber-200/50 text-amber-900 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
              <RefreshCw size={10} className={isSyncing ? 'animate-spin text-amber-700' : 'text-amber-700'} />
              {pendingQueue.length} Pending Sync{pendingQueue.length > 1 ? 's' : ''}
            </span>
            {isOnline && (
              <button 
                type="button"
                onClick={syncPendingQueue}
                disabled={isSyncing}
                className="text-[9px] font-black uppercase tracking-widest bg-brand-purple text-white px-3 py-1.5 rounded-lg active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1 shadow-md hover:bg-brand-purple/90"
              >
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </button>
            )}
          </div>
        )}
      </div>

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
        <button onClick={() => setActiveTab('REPORTS')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'REPORTS' ? 'bg-brand-purple text-white shadow-md' : 'text-slate-400'}`}>
          Reports
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

          {myActiveCalls.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <PackageCheck size={16} className="text-brand-green" /> My Active Tasks
                </h3>
                <span className="text-[10px] font-black text-slate-400 uppercase">{myActiveCalls.length} In Progress</span>
              </div>
              
              <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                {myActiveCalls.map(call => {
                  const { formattedTime, isCritical, isOverdue } = getRemainingTime(call);
                  const isSelected = selectedActiveCallId === call.id;
                  return (
                    <button 
                      key={call.id}
                      onClick={() => setSelectedActiveCallId(call.id)}
                      className={`flex-shrink-0 px-6 py-4 rounded-2xl border-2 transition-all text-left min-w-[220px] relative overflow-hidden ${isSelected ? 'bg-brand-purple text-white border-brand-purple shadow-lg' : 'bg-white text-slate-600 border-slate-100 hover:border-brand-purple/30'}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-[8px] font-black uppercase ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                          {call.status.replace('_', ' ')}
                        </span>
                        <div className="flex items-center gap-1">
                          {call.isPriority && <Zap size={10} className="text-orange-400" />}
                          {isCritical && <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />}
                        </div>
                      </div>
                      <p className="text-sm font-black truncate">{call.patientName}</p>
                      <p className={`text-[9px] font-bold opacity-70 truncate mt-1 ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                        {call.destination.address}
                      </p>
                      <div className="mt-3 pt-2 border-t border-dashed border-current/10 flex items-center justify-between">
                        <span className={`text-[8px] font-black uppercase tracking-wider ${isSelected ? 'text-white/60' : 'text-slate-400'}`}>
                          {isOverdue ? 'Overdue' : 'Time Left'}
                        </span>
                        <span className={`text-[10px] font-black font-mono flex items-center gap-1 ${isCritical ? 'text-red-500 animate-pulse' : isSelected ? 'text-green-300' : 'text-brand-purple'}`}>
                          <Clock size={10} />
                          {formattedTime}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

           {activeCall && (() => {
             const { formattedTime, isCritical, isOverdue } = getRemainingTime(activeCall);
             const isDelayed = isOverdue;
             return (
               <div className={`bg-white rounded-[2.5rem] shadow-2xl border-4 overflow-hidden animate-slide-up transition-all duration-500 ${isCritical ? 'border-red-500 ring-4 ring-red-500/20 animate-[pulse_2s_infinite]' : 'border-slate-50'}`}>
                 <div className={`${activeCall.isPriority ? 'brand-gradient' : 'bg-brand-purple'} p-8 text-white relative`}>
                    <div className="absolute top-6 right-8 text-right flex flex-col items-end">
                       {activeCall.isPriority && (
                         <div className="flex items-center gap-1.5 px-3 py-1 bg-orange-500 text-white rounded-full text-[9px] font-black uppercase tracking-widest mb-2 shadow-lg border border-orange-300 animate-pulse">
                           <Zap size={12} className="fill-white text-white" />
                           <span>Urgent Priority</span>
                         </div>
                       )}
                       {isDelayed && (
                         <div className="flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[9px] font-black uppercase tracking-widest mb-3 animate-pulse border border-white/30">
                           <AlertTriangle size={12} className="text-yellow-300" />
                           <span>Delayed TAT</span>
                         </div>
                       )}
                       <div className="flex flex-col items-end">
                         <span className="block text-[8px] font-black uppercase opacity-60">Status</span>
                         <span className="text-xs font-black uppercase tracking-widest">{activeCall.status.replace('_', ' ')}</span>
                       </div>
                    </div>
                  <h2 className="text-3xl font-black tracking-tight">{activeCall.patientName}</h2>
                  <p className="text-[10px] font-bold opacity-80 mt-2 flex items-center gap-2 max-w-[80%] truncate"><MapPin size={12}/> {activeCall.destination.address}</p>
                  
                  {/* Dynamic ETA & Traffic Speed Calculator Display */}
                  {(() => {
                    const refLoc = getPhleboRefLocation();
                    const distanceKm = refLoc ? calculateDistance(refLoc, activeCall.destination) : 0;
                    const avgTrafficSpeedKmH = 26; // Urban traffic average speed (km/h)
                    const travelTimeMins = Math.max(2, Math.round((distanceKm / avgTrafficSpeedKmH) * 60));
                    const etaDate = new Date(Date.now() + travelTimeMins * 60000);
                    const etaFormatted = etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    return (
                      <div className="mt-4 flex flex-wrap items-center gap-3 bg-white/20 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/20 text-white shadow-lg">
                        <div className="flex items-center gap-1.5">
                          <Clock size={15} className="text-yellow-300 animate-pulse" />
                          <span className="text-[10px] font-black uppercase tracking-wider">Live ETA: <strong className="text-white font-mono text-xs underline decoration-yellow-300 decoration-2">{etaFormatted}</strong></span>
                        </div>
                        <span className="text-white/40">•</span>
                        <span className="text-[10px] font-bold tracking-wide">{travelTimeMins} mins ({distanceKm.toFixed(1)} km @ 26 km/h traffic)</span>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-4 gap-2 mt-6">
                     <button onClick={handleNavigate} className="bg-white/20 hover:bg-white/30 backdrop-blur-md p-3 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all">
                        <ExternalLink size={14} /> Navigate
                     </button>
                     <button onClick={handleOpenMiniMap} className="bg-white/20 hover:bg-white/30 backdrop-blur-md p-3 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all">
                        <Route size={14} /> Mini-Map
                     </button>
                     <button onClick={handleCallPatient} className="bg-white/20 hover:bg-white/30 backdrop-blur-md p-3 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all">
                        <Phone size={14} /> Call
                     </button>
                     <button onClick={handleTogglePriority} className={`p-3 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all backdrop-blur-md ${activeCall.isPriority ? 'bg-orange-500 text-white shadow-lg ring-2 ring-orange-300 animate-pulse' : 'bg-white/20 hover:bg-white/30 text-white'}`}>
                        <Zap size={14} className={activeCall.isPriority ? 'fill-white' : ''} /> {activeCall.isPriority ? 'Urgent' : 'Priority'}
                     </button>
                  </div>
               </div>

               <div className="p-8 space-y-8">
                  {geoError && (activeCall.status === CallStatus.VISITING || activeCall.status === CallStatus.IN_PROGRESS) && !isSimulatingGps && (
                    <div className="bg-red-600 text-white p-6 rounded-[2rem] flex items-center gap-6 animate-shake shadow-2xl border-4 border-white/20">
                       <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                          <ShieldAlert size={36} className="animate-pulse" />
                       </div>
                       <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Security Protocol Violation</p>
                          <h4 className="text-lg font-black leading-tight mt-1">Movement Outside Geofence Detected</h4>
                          <p className="text-xs font-bold mt-1 opacity-90">{geoError}</p>
                          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-[8px] font-black uppercase tracking-widest">
                             <Radar size={10} /> Live Monitoring Active
                          </div>
                       </div>
                    </div>
                  )}

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
                           {activeCall.isOtpLocked ? 'NODE LOCKED - CONTACT DISPATCH' : `${3 - activeCall.otpRetryCount} attempts remaining`}
                         </span>
                         {(!activeCall.isOtpLocked && Date.now() <= activeCall.otpExpiresAt) && (
                           <button 
                             onClick={() => { onResendOtp(activeCall.id); setVerificationInput(''); }}
                             className="text-[9px] font-black text-brand-purple uppercase tracking-widest bg-white/10 px-3 py-1.5 rounded-lg hover:bg-white/20 transition-all"
                           >
                             Resend PIN
                           </button>
                         )}
                         {(activeCall.isOtpLocked || Date.now() > activeCall.otpExpiresAt) && (
                           <span className="text-[7px] font-black text-brand-purple uppercase tracking-widest bg-white/10 px-3 py-1.5 rounded-lg">
                             PIN Expired - Call Dispatch
                           </span>
                         )}
                       </div>
                    </div>
                  )}

                  <div className="space-y-4">
                     {activeCall.status === CallStatus.VISITING && activeCall.billing?.paymentStatus === 'PENDING' && (
                        <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex flex-col gap-4">
                           <div className="flex justify-between items-center">
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Payment Collection</span>
                              <span className="text-sm font-black text-slate-900">₹{(activeCall.billing?.totalAmount || 0).toLocaleString()}</span>
                           </div>
                           <div className="grid grid-cols-2 gap-3">
                              <button onClick={() => setShowUpiModal(true)} className="bg-white border-2 border-slate-100 p-4 rounded-2xl flex flex-col items-center gap-2 hover:border-brand-purple transition-all">
                                 <QrCode size={24} className="text-brand-purple" />
                                 <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">UPI QR</span>
                              </button>
                              <button onClick={() => triggerStatusUpdate(activeCall.id, activeCall.status, currentUser.id, { billing: {...(activeCall.billing || {} as any), paymentStatus: 'PAID', paymentMode: PaymentMode.CASH} })} className="bg-white border-2 border-slate-100 p-4 rounded-2xl flex flex-col items-center gap-2 hover:border-brand-green transition-all">
                                 <Wallet size={24} className="text-brand-green" />
                                 <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Cash</span>
                              </button>
                              <button onClick={() => triggerStatusUpdate(activeCall.id, activeCall.status, currentUser.id, { billing: {...(activeCall.billing || {} as any), paymentStatus: 'PAID', paymentMode: PaymentMode.CARD} })} className="bg-white border-2 border-slate-100 p-4 rounded-2xl flex flex-col items-center gap-2 hover:border-blue-500 transition-all">
                                 <CreditCard size={24} className="text-blue-500" />
                                 <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Card</span>
                              </button>
                              <button onClick={() => triggerStatusUpdate(activeCall.id, activeCall.status, currentUser.id, { billing: {...(activeCall.billing || {} as any), paymentStatus: 'PAID', paymentMode: PaymentMode.LINK} })} className="bg-white border-2 border-slate-100 p-4 rounded-2xl flex flex-col items-center gap-2 hover:border-orange-500 transition-all">
                                 <Link size={24} className="text-orange-500" />
                                 <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Link</span>
                              </button>
                           </div>
                        </div>
                     )}

                     {activeCall.status === CallStatus.ACCEPTED && (
                        <button onClick={handleArrived} className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black uppercase text-sm tracking-widest shadow-2xl flex items-center justify-center gap-4 transition-all active:scale-95">
                           <Navigation size={24} /> Confirm Arrival
                        </button>
                     )}
                     {activeCall.status === CallStatus.VISITING && (
                        <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                           <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sample Logging</p>
                           <select 
                             value={activeCall.sampleType || ''} 
                             onChange={(e) => triggerStatusUpdate(activeCall.id, activeCall.status, currentUser.id, { sampleType: e.target.value })}
                             className="w-full p-4 rounded-xl border-2 border-slate-100 text-xs font-bold focus:border-brand-purple outline-none"
                           >
                             <option value="">Select Sample Type</option>
                             <option value="Blood">Blood</option>
                             <option value="Urine">Urine</option>
                             <option value="Swab">Swab</option>
                             <option value="Stool">Stool</option>
                             <option value="Sputum">Sputum</option>
                           </select>
                           <button 
                              onClick={handleVerifyAndStart} 
                              disabled={(activeCall.billing?.paymentStatus || 'PENDING') === 'PENDING' || !activeCall.visitPhoto || !activeCall.samplePhoto || !activeCall.sampleType || verificationInput.length < 4} 
                              className={`w-full py-6 rounded-3xl font-black uppercase text-sm tracking-widest shadow-2xl flex items-center justify-center gap-4 transition-all ${(activeCall.billing?.paymentStatus || 'PENDING') === 'PAID' && activeCall.visitPhoto && activeCall.samplePhoto && activeCall.sampleType && verificationInput.length === 4 ? 'bg-brand-purple text-white' : 'bg-slate-100 text-slate-300'}`}
                           >
                              <Fingerprint size={24} /> Verify & Start Collection
                           </button>
                        </div>
                     )}

                     {activeCall.status === CallStatus.IN_PROGRESS && (
                        <button 
                           onClick={handleCompleteCollection} 
                           className="w-full py-6 rounded-3xl font-black uppercase text-sm tracking-widest shadow-2xl flex items-center justify-center gap-4 transition-all bg-brand-green text-white"
                        >
                           <CheckCircle2 size={24} /> Finish Collection
                        </button>
                     )}
                     {activeCall.status === CallStatus.COLLECTED && (
                        <button 
                           onClick={() => triggerStatusUpdate(activeCall.id, CallStatus.IN_TRANSIT, currentUser.id)} 
                           className="w-full py-6 rounded-3xl font-black uppercase text-sm tracking-widest shadow-2xl flex items-center justify-center gap-4 transition-all bg-orange-500 text-white"
                        >
                           <Truck size={24} /> Start Transit to Lab
                        </button>
                     )}

                     {activeCall.status === CallStatus.IN_TRANSIT && (
                        <div className="bg-slate-900 text-white p-8 rounded-[2rem] space-y-4">
                           <div className="flex justify-between items-center px-2">
                             <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Enter Dispatch Handover PIN</p>
                           </div>
                           <input 
                             type="text" maxLength={4} placeholder="----"
                             value={handoverInput}
                             onChange={(e) => setHandoverInput(e.target.value.replace(/[^0-9]/g, ''))}
                             className="w-full bg-white/10 p-6 rounded-2xl text-center text-5xl font-black tracking-[0.5em] outline-none placeholder:text-white/10"
                           />
                           <button 
                              onClick={() => {
                                if (handoverInput === activeCall.handoverCode) {
                                  triggerStatusUpdate(activeCall.id, CallStatus.RECEIVED_AT_LAB, currentUser.id);
                                  setHandoverInput('');
                                } else {
                                  alert("Invalid Handover PIN. Please confirm with Dispatch.");
                                }
                              }}
                              disabled={handoverInput.length < 4}
                              className={`w-full py-6 rounded-3xl font-black uppercase text-sm tracking-widest shadow-2xl flex items-center justify-center gap-4 transition-all ${handoverInput.length === 4 ? 'bg-brand-purple text-white' : 'bg-slate-100 text-slate-300'}`}
                           >
                              <PackageCheck size={24} /> Handover to Lab Hub
                           </button>
                        </div>
                     )}

                     {activeCall.status === CallStatus.RECEIVED_AT_LAB && (
                        <button 
                           onClick={() => triggerStatusUpdate(activeCall.id, CallStatus.COMPLETED, currentUser.id)} 
                           className="w-full py-6 rounded-3xl font-black uppercase text-sm tracking-widest shadow-2xl flex items-center justify-center gap-4 transition-all bg-brand-green text-white"
                        >
                           <CheckCircle2 size={24} /> Accept Sample
                        </button>
                     )}
                  </div>

                  {geoError && (activeCall.status !== CallStatus.VISITING && activeCall.status !== CallStatus.IN_PROGRESS) && (
                    <div className="p-4 bg-red-50 text-red-500 rounded-2xl text-[10px] font-black uppercase text-center border border-red-100 flex items-center justify-center gap-2 animate-shake">
                      <AlertTriangle size={14} /> {geoError}
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center px-2">
                     <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Quote Total</span>
                        <span className="text-lg font-black text-slate-900">₹{(activeCall.billing?.totalAmount || 0).toLocaleString()}</span>
                     </div>
                     <div className="flex flex-col items-end">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">TAT Countdown</span>
                        <span className={`text-lg font-black flex items-center gap-1 font-mono ${isCritical ? 'text-red-500 animate-pulse' : 'text-brand-purple'}`}>
                           <Clock size={16} />
                           {formattedTime}
                        </span>
                     </div>
                  </div>
               </div>
            </div>
           );})()}

          <div className="space-y-6 animate-slide-up pt-4">
             <div className="flex items-center justify-between px-2">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <Radar size={16} className="text-brand-purple animate-pulse" /> Available Broadcasts
                </h3>
                <span className="text-[10px] font-black text-slate-400 uppercase">{availableCalls.length} Tasks Nearby</span>
             </div>
             
             {availableCalls.length > 0 ? availableCalls.map(call => {
               const refLoc = getPhleboRefLocation();
               const distance = refLoc ? calculateDistance(refLoc, call.destination) : null;
               
               return (
                 <div key={call.id} className="bg-white p-8 rounded-[2.5rem] border shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between hover:border-brand-purple transition-all group gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                         <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest ${call.isPriority ? 'bg-orange-50 text-orange-600' : 'bg-slate-100 text-slate-500'}`}>
                           {call.isPriority ? 'URGENT' : 'STANDARD'}
                         </span>
                         <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{call.billing?.tests?.length || 0} Services</span>
                         {distance !== null && (
                           <span className="text-[9px] font-black text-brand-purple uppercase tracking-widest ml-auto sm:ml-0">
                             {distance.toFixed(1)} km away
                           </span>
                         )}
                      </div>
                      <h4 className="text-2xl font-black text-slate-900">{call.patientName}</h4>
                       {(() => {
                         const { formattedTime, isCritical, isOverdue } = getRemainingTime(call);
                         return (
                           <div className="mt-2 mb-1 flex items-center gap-2">
                             <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Time Left:</span>
                             <span className={`text-[11px] font-black font-mono flex items-center gap-1 ${isCritical ? 'text-red-500 animate-pulse' : 'text-brand-purple'}`}>
                               <Clock size={11} />
                               {formattedTime} {isOverdue ? 'Overdue' : ''}
                             </span>
                           </div>
                         );
                       })()}
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
               <div className="flex flex-col items-center justify-center py-20 text-slate-300">
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
        </>
      )}

      {activeTab === 'TRIPS' && (
        <div className="space-y-6 animate-slide-up">
           <div className="bg-white p-10 rounded-[2.5rem] border shadow-sm flex flex-col gap-8">
              <div className="flex justify-between items-center">
                 <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Performance Summary</h3>
                 <div className="flex bg-slate-50 p-1 rounded-xl border">
                    {(['DAY', 'WEEK', 'MONTH', 'ALL'] as const).map(f => (
                       <button key={f} onClick={() => setTripFilter(f)} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${tripFilter === f ? 'bg-brand-purple text-white shadow-sm' : 'text-slate-400'}`}>{f}</button>
                    ))}
                 </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                 <div className="bg-slate-50 p-6 rounded-3xl flex flex-col items-center">
                    <span className="text-[8px] font-black text-slate-400 uppercase mb-2">My Payout</span>
                    <span className="text-lg font-black text-brand-green">₹{(Number(personalTripStats.totalIncentive) || 0).toFixed(0)}</span>
                 </div>
                 <div className="bg-slate-50 p-6 rounded-3xl flex flex-col items-center">
                    <span className="text-[8px] font-black text-slate-400 uppercase mb-2">Coverage</span>
                    <span className="text-lg font-black text-slate-900">{(Number(personalTripStats.totalKm) || 0).toFixed(1)}km</span>
                 </div>
                 <div className="bg-slate-50 p-6 rounded-3xl flex flex-col items-center">
                    <span className="text-[8px] font-black text-slate-400 uppercase mb-2">Handovers</span>
                    <span className="text-lg font-black text-slate-900">{personalTripStats.totalTrips}</span>
                 </div>
              </div>
           </div>
           <div className="space-y-3">
              {myTrips.length > 0 ? myTrips.map((trip) => (
                 <div key={trip.callId} className="bg-white p-6 rounded-[1.5rem] border shadow-sm flex justify-between items-center group">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-xl bg-brand-purple/5 flex items-center justify-center text-brand-purple">
                          <CheckSquare size={20} />
                       </div>
                       <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-900">{trip.patientName}</span>
                          <span className="text-[8px] font-bold text-slate-400 uppercase">{new Date(trip.timestamp).toLocaleDateString()} • {(Number(trip.distance) || 0).toFixed(1)}km</span>
                       </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                       <div className="text-sm font-black text-brand-green">+₹{(Number(trip.incentive) || 0).toFixed(0)}</div>
                       <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{trip.totalTat}m TAT</span>
                       <button 
                         onClick={() => handleDownloadInvoice(trip)}
                         className="text-[8px] font-black uppercase text-brand-purple bg-brand-purple/10 px-2 py-1 rounded-lg border border-brand-purple/20 flex items-center gap-1"
                       >
                         <Download size={10} /> Invoice
                       </button>
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

      {showNavOptions && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-2xl z-[400] flex items-center justify-center p-6" onClick={() => setShowNavOptions(false)}>
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 flex flex-col items-center gap-6 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
             <h3 className="font-black text-lg uppercase tracking-widest text-brand-purple">Choose Navigation</h3>
             <button onClick={navigateWithGoogleMaps} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg flex items-center justify-center gap-2">
                <MapPin size={16} /> Google Maps
             </button>
             <button onClick={navigateWithWaze} className="w-full bg-cyan-500 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg flex items-center justify-center gap-2">
                <MapPin size={16} /> Waze
             </button>
             <button onClick={() => setShowNavOptions(false)} className="w-full bg-slate-100 text-slate-500 py-4 rounded-2xl font-black uppercase text-xs tracking-widest mt-2">
                Cancel
             </button>
          </div>
        </div>
      )}

      {showMiniMapModal && activeCall && (() => {
        const currentLoc = miniMapLocation || getPhleboRefLocation();
        const destLoc = activeCall.destination;
        const distanceKm = calculateDistance(currentLoc, destLoc);
        
        return (
          <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-2xl z-[500] flex items-center justify-center p-4 sm:p-6" onClick={() => setShowMiniMapModal(false)}>
            <div className="bg-slate-950 text-white w-full max-w-2xl rounded-[3rem] p-8 sm:p-10 flex flex-col gap-6 shadow-2xl border-2 border-brand-purple/40 animate-slide-up relative overflow-hidden" onClick={e => e.stopPropagation()}>
               <div className="absolute top-0 right-0 w-32 h-32 bg-brand-purple/20 rounded-bl-full pointer-events-none blur-2xl" />
               
               <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-2xl bg-brand-purple/20 border border-brand-purple/40 flex items-center justify-center text-brand-purple">
                        <Route size={20} className="text-purple-400" />
                     </div>
                     <div>
                        <h3 className="font-black text-base uppercase tracking-wider">Live Path & Mini-Map</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Route to {activeCall.patientName}</p>
                     </div>
                  </div>
                  <button onClick={() => setShowMiniMapModal(false)} className="bg-white/10 p-2.5 rounded-xl hover:bg-white/20 text-slate-300 transition-all">
                     <X size={18} />
                  </button>
               </div>

               {/* Simulated Map Visualizer */}
               <div className="bg-slate-900/90 rounded-[2.5rem] border border-white/10 p-6 relative overflow-hidden flex flex-col items-center justify-center min-h-[240px] shadow-inner">
                  {/* Grid background effect */}
                  <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-30" />
                  
                  <div className="relative z-10 w-full flex flex-col sm:flex-row items-center justify-between gap-6 py-4 px-2">
                     {/* Origin Node */}
                     <div className="flex flex-col items-center text-center max-w-[200px]">
                        <div className="relative mb-3">
                           <div className="absolute -inset-2 bg-brand-purple rounded-full animate-ping opacity-40" />
                           <div className="w-14 h-14 bg-brand-purple text-white rounded-2xl shadow-xl flex items-center justify-center relative z-10 border-2 border-white/20">
                              <User size={24} />
                           </div>
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-brand-purple bg-brand-purple/20 px-2.5 py-1 rounded-md border border-brand-purple/30 mb-1">
                           Phlebo GPS Node
                        </span>
                        <p className="text-xs font-bold text-slate-200 truncate w-full">{currentLoc.address || 'Live Location'}</p>
                        <p className="text-[10px] font-mono text-slate-400 mt-0.5">{currentLoc.lat.toFixed(4)}, {currentLoc.lng.toFixed(4)}</p>
                     </div>

                     {/* Distance Badge & Connecting Line */}
                     <div className="flex flex-col items-center justify-center px-4">
                        <div className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-lg flex items-center gap-2 mb-2">
                           <Navigation size={14} className="text-green-400 animate-pulse" />
                           <span className="text-xs font-black font-mono text-green-300">{distanceKm} KM</span>
                        </div>
                        <div className="w-24 sm:w-32 h-0.5 bg-gradient-to-r from-brand-purple via-green-400 to-blue-500 rounded-full relative">
                           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full animate-ping" />
                        </div>
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 mt-2">Direct Vector</span>
                     </div>

                     {/* Destination Node */}
                     <div className="flex flex-col items-center text-center max-w-[200px]">
                        <div className="relative mb-3">
                           <div className="absolute -inset-2 bg-blue-500 rounded-full animate-ping opacity-30" />
                           <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl shadow-xl flex items-center justify-center relative z-10 border-2 border-white/20">
                              <MapPin size={24} />
                           </div>
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-blue-400 bg-blue-500/20 px-2.5 py-1 rounded-md border border-blue-500/30 mb-1">
                           Patient Destination
                        </span>
                        <p className="text-xs font-bold text-slate-200 truncate w-full">{destLoc.address}</p>
                        <p className="text-[10px] font-mono text-slate-400 mt-0.5">{destLoc.lat.toFixed(4)}, {destLoc.lng.toFixed(4)}</p>
                     </div>
                  </div>
               </div>

               <div className="flex items-center justify-between gap-4 pt-2">
                  <button 
                     onClick={handleRefreshMiniMapGps}
                     disabled={isRefreshingGps}
                     className="flex-1 bg-white/10 hover:bg-white/20 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-2 border border-white/10 active:scale-95 disabled:opacity-50"
                  >
                     <RefreshCw size={14} className={isRefreshingGps ? 'animate-spin' : ''} />
                     {isRefreshingGps ? 'Acquiring GPS...' : 'Refresh GPS Location'}
                  </button>
                  <button 
                     onClick={() => setShowMiniMapModal(false)}
                     className="bg-brand-purple hover:bg-brand-purple/90 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg transition-all active:scale-95"
                  >
                     Done
                  </button>
               </div>
            </div>
          </div>
        );
      })()}

      {showUpiModal && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-2xl z-[400] flex items-center justify-center p-6" onClick={() => setShowUpiModal(false)}>
          <div className="bg-white w-full max-sm rounded-[4rem] p-12 flex flex-col items-center gap-8 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
             <h3 className="font-black text-xl uppercase tracking-widest text-brand-purple">UPI Authorization</h3>
             <img src={qrUrl} className="w-full rounded-[2.5rem] border-4 border-slate-50 shadow-inner" alt="UPI QR" />
             <button onClick={() => { onUpdateStatus(activeCall!.id, activeCall!.status, currentUser.id, { billing: {...(activeCall!.billing || {} as any), paymentStatus: 'PAID', paymentMode: PaymentMode.UPI}}); setShowUpiModal(false); }} className="w-full bg-brand-green text-white py-6 rounded-3xl font-black uppercase text-xs tracking-widest shadow-xl">Complete Payment</button>
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
      {activeTab === 'REPORTS' && (
        <ReportsView history={history} currentUser={currentUser} />
      )}

      {/* Floating Action Button (Emergency SOS) */}
      <div className="fixed bottom-28 right-6 z-[100] flex flex-col items-end gap-2">
        {isPressing && (
          <div className="bg-slate-900 text-white px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md border border-slate-800 animate-pulse">
            Hold {Math.max(0, Math.ceil((3000 - (pressProgress * 30)) / 1000))}s to Trigger
          </div>
        )}
        {isSosActive ? (
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={handleCancelSos}
              className="bg-slate-900 text-white hover:bg-slate-800 px-4 py-2 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-lg border border-slate-700 transition-all flex items-center gap-1.5"
            >
              <X size={12} className="text-red-500 animate-spin-slow" /> Cancel SOS
            </button>
            <div className="relative flex items-center justify-center">
              <div className="absolute w-16 h-16 bg-red-500 rounded-full animate-ping opacity-60" />
              <button
                className="w-16 h-16 bg-red-600 hover:bg-red-700 text-white rounded-full flex flex-col items-center justify-center shadow-[0_0_25px_rgba(239,68,68,0.7)] border-4 border-white relative z-10 transition-transform active:scale-95"
              >
                <ShieldAlert size={24} className="animate-bounce" />
                <span className="text-[7px] font-black uppercase tracking-widest mt-0.5">ACTIVE</span>
              </button>
            </div>
          </div>
        ) : (
          <button
            onMouseDown={startPress}
            onMouseUp={endPress}
            onMouseLeave={endPress}
            onTouchStart={startPress}
            onTouchEnd={endPress}
            className={`w-16 h-16 rounded-full flex flex-col items-center justify-center shadow-lg border-4 border-white relative transition-all active:scale-90 select-none ${isPressing ? 'bg-red-500 text-white border-red-500' : 'bg-rose-50 hover:bg-rose-100 text-rose-600 border-white'}`}
            style={{
              background: isPressing 
                ? `conic-gradient(#ef4444 ${pressProgress}%, #334155 ${pressProgress}%)`
                : undefined
            }}
          >
            {isPressing ? (
              <div className="w-12 h-12 bg-slate-900 rounded-full flex flex-col items-center justify-center text-white">
                <ShieldAlert size={20} className="animate-pulse text-red-500" />
                <span className="text-[7px] font-black tracking-widest mt-0.5">SOS</span>
              </div>
            ) : (
              <>
                <ShieldAlert size={22} className="text-rose-600" />
                <span className="text-[8px] font-black uppercase tracking-wider mt-0.5">SOS</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

const ReportsView: React.FC<{ history: CallMetrics[], currentUser: Phlebotomist }> = ({ history, currentUser }) => {
  const [reportRange, setReportRange] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ALL'>('DAILY');

  const filteredHistory = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const weekMs = 7 * dayMs;
    const monthMs = 30 * dayMs;

    return history.filter(h => {
      if (h.phleboId !== currentUser.id) return false;
      if (reportRange === 'ALL') return true;
      const timeDiff = now - h.timestamp;
      if (reportRange === 'DAILY') return timeDiff <= dayMs;
      if (reportRange === 'WEEKLY') return timeDiff <= weekMs;
      return timeDiff <= monthMs;
    });
  }, [history, reportRange, currentUser.id]);

  const stats = useMemo(() => {
    return {
      totalCalls: filteredHistory.length,
      completedSamples: filteredHistory.filter(h => h.status === 'COMPLETED').length,
      totalRevenue: filteredHistory.reduce((sum, h) => sum + (Number(h.revenue) || 0), 0),
      totalIncentive: filteredHistory.reduce((sum, h) => sum + (Number(h.incentive) || 0), 0),
      totalDistance: filteredHistory.reduce((sum, h) => sum + (Number(h.distance) || 0), 0),
    };
  }, [filteredHistory]);

  const chartData = useMemo(() => {
    const map: Record<string, { date: string; earnings: number; revenue: number; calls: number }> = {};
    const sorted = [...filteredHistory].sort((a, b) => a.timestamp - b.timestamp);
    
    sorted.forEach(h => {
      const d = new Date(h.timestamp);
      const dateKey = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!map[dateKey]) {
        map[dateKey] = { date: dateKey, earnings: 0, revenue: 0, calls: 0 };
      }
      map[dateKey].earnings += Number(h.incentive) || 0;
      map[dateKey].revenue += Number(h.revenue) || 0;
      map[dateKey].calls += 1;
    });

    return Object.values(map);
  }, [filteredHistory]);

  const handleExportPDF = () => {
    const doc = new jsPDF() as any;
    doc.setFontSize(18);
    doc.text(`Disha Diagnostics - Phlebotomist Report (${reportRange})`, 20, 20);
    doc.setFontSize(12);
    doc.text(`Phlebotomist: ${currentUser.name}`, 20, 30);
    doc.text(`Generated At: ${new Date().toLocaleString()}`, 20, 35);

    doc.autoTable({
      startY: 45,
      head: [['Metric', 'Value']],
      body: [
        ['Total Collection Calls', stats.totalCalls],
        ['Samples Collected', stats.completedSamples],
        ['Total Distance (km)', (Number(stats.totalDistance) || 0).toFixed(2)],
        ['Total Revenue (₹)', stats.totalRevenue.toLocaleString()],
        ['Total Incentive (₹)', stats.totalIncentive.toLocaleString()],
      ],
      theme: 'grid',
      headStyles: { fillColor: [139, 92, 246] }
    });

    doc.save(`Report_${currentUser.name}_${reportRange}_${Date.now()}.pdf`);
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="bg-white p-6 rounded-[2rem] border shadow-sm space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
            <BarChart3 size={18} className="text-brand-purple" /> Performance Summary
          </h3>
          <div className="flex bg-slate-50 p-1 rounded-xl border gap-1">
            {(['DAILY', 'WEEKLY', 'MONTHLY', 'ALL'] as const).map(range => (
              <button
                key={range}
                onClick={() => setReportRange(range)}
                className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${reportRange === range ? 'bg-brand-purple text-white shadow-sm' : 'text-slate-400'}`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Calls</p>
            <p className="text-3xl font-black text-slate-900">{stats.totalCalls}</p>
          </div>
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Samples Collected</p>
            <p className="text-3xl font-black text-brand-green">{stats.completedSamples}</p>
          </div>
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Distance</p>
            <p className="text-3xl font-black text-slate-900">{(Number(stats.totalDistance) || 0).toFixed(1)} <span className="text-sm">km</span></p>
          </div>
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Earnings</p>
            <p className="text-3xl font-black text-brand-purple">₹{stats.totalIncentive.toLocaleString()}</p>
          </div>
        </div>

        {/* Recharts Daily Earnings Trend Line Chart */}
        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <TrendingUp size={16} className="text-brand-purple" /> Daily Earnings Trend
              </h4>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">Earnings (₹) over selected time range</p>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest bg-brand-purple/10 text-brand-purple px-3 py-1 rounded-full border border-brand-purple/20">
              {reportRange}
            </span>
          </div>

          {chartData.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
              <BarChart3 size={32} className="opacity-40" />
              <p className="text-xs font-bold uppercase tracking-wider">No earnings data recorded for this range</p>
            </div>
          ) : (
            <div className="h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#64748b" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={{ stroke: '#cbd5e1' }} 
                  />
                  <YAxis 
                    stroke="#64748b" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickFormatter={(value) => `₹${value}`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '1rem', color: '#fff', fontSize: '12px', padding: '10px 14px' }}
                    formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, 'Earnings']}
                    labelStyle={{ fontWeight: 'bold', color: '#c084fc', marginBottom: '4px' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="earnings" 
                    stroke="#8b5cf6" 
                    strokeWidth={3} 
                    dot={{ fill: '#8b5cf6', stroke: '#fff', strokeWidth: 2, r: 5 }}
                    activeDot={{ r: 8, fill: '#7c3aed', stroke: '#fff', strokeWidth: 2 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <button
          onClick={handleExportPDF}
          className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center gap-3 hover:bg-slate-800 transition-all"
        >
          <Download size={18} /> Export Detailed Report (PDF)
        </button>
      </div>
    </div>
  );
};

export default PhleboApp;
