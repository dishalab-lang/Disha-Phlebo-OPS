import React, { useState, useMemo } from 'react';
import { CollectionCall, CallStatus, Location, DiagnosticLab } from './types';
import { calculateDistance } from './geoUtils';
import { 
  MapPin, Navigation, User, Zap, PackageCheck, Building2, 
  Clock, Maximize2, Minimize2, RotateCcw, Eye, Target, Radio, 
  CheckCircle2, Compass, Layers, ChevronRight
} from 'lucide-react';

interface TaskMapVisualizerProps {
  phleboLocation: Location;
  myActiveCalls: CollectionCall[];
  availableCalls: CollectionCall[];
  selectedActiveCallId: string | null;
  onSelectCall: (callId: string) => void;
  onAcceptCall?: (callId: string) => void;
  phleboLab?: DiagnosticLab | null;
}

export const TaskMapVisualizer: React.FC<TaskMapVisualizerProps> = ({
  phleboLocation,
  myActiveCalls,
  availableCalls,
  selectedActiveCallId,
  onSelectCall,
  onAcceptCall,
  phleboLab
}) => {
  const [mapTheme, setMapTheme] = useState<'RADAR' | 'CLEAN'>('RADAR');
  const [showBroadcasts, setShowBroadcasts] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hoveredCallId, setHoveredCallId] = useState<string | null>(null);

  // Active call selected or hovered
  const selectedCall = useMemo(() => {
    return myActiveCalls.find(c => c.id === (hoveredCallId || selectedActiveCallId)) || 
           availableCalls.find(c => c.id === (hoveredCallId || selectedActiveCallId)) || null;
  }, [myActiveCalls, availableCalls, selectedActiveCallId, hoveredCallId]);

  // Compute map bounds and points
  const points = useMemo(() => {
    const list: Array<{
      id: string;
      lat: number;
      lng: number;
      type: 'PHLEBO' | 'ASSIGNED' | 'BROADCAST' | 'HUB';
      call?: CollectionCall;
      label: string;
    }> = [
      {
        id: 'phlebo_self',
        lat: phleboLocation.lat,
        lng: phleboLocation.lng,
        type: 'PHLEBO',
        label: 'Phlebo Node (You)'
      }
    ];

    myActiveCalls.forEach(c => {
      list.push({
        id: c.id,
        lat: c.destination.lat,
        lng: c.destination.lng,
        type: 'ASSIGNED',
        call: c,
        label: c.patientName
      });
    });

    if (showBroadcasts) {
      availableCalls.forEach(c => {
        list.push({
          id: c.id,
          lat: c.destination.lat,
          lng: c.destination.lng,
          type: 'BROADCAST',
          call: c,
          label: c.patientName
        });
      });
    }

    if (phleboLab) {
      list.push({
        id: 'hub_lab',
        lat: phleboLab.location.lat,
        lng: phleboLab.location.lng,
        type: 'HUB',
        label: phleboLab.name
      });
    }

    return list;
  }, [phleboLocation, myActiveCalls, availableCalls, showBroadcasts, phleboLab]);

  // Map projection calculations
  const { minLat, maxLat, minLng, maxLng, width, height, padding, getSvgCoords } = useMemo(() => {
    const w = 800;
    const h = 420;
    const pad = 60;

    let lats = points.map(p => p.lat).filter(l => typeof l === 'number' && !isNaN(l));
    let lngs = points.map(p => p.lng).filter(l => typeof l === 'number' && !isNaN(l));

    if (lats.length === 0) {
      lats = [phleboLocation.lat || 17.684942];
      lngs = [phleboLocation.lng || 73.998142];
    }

    let minL = Math.min(...lats);
    let maxL = Math.max(...lats);
    let minG = Math.min(...lngs);
    let maxG = Math.max(...lngs);

    // Minimum span ~ 1.5 - 2km to avoid collapsed zoom
    const minSpan = 0.015;
    if (maxL - minL < minSpan) {
      const mid = (maxL + minL) / 2;
      minL = mid - minSpan / 2;
      maxL = mid + minSpan / 2;
    }
    if (maxG - minG < minSpan) {
      const mid = (maxG + minG) / 2;
      minG = mid - minSpan / 2;
      maxG = mid + minSpan / 2;
    }

    // 15% margin
    const latPad = (maxL - minL) * 0.15;
    const lngPad = (maxG - minG) * 0.15;
    minL -= latPad;
    maxL += latPad;
    minG -= lngPad;
    maxG += lngPad;

    const project = (lat: number, lng: number) => {
      const x = pad + ((lng - minG) / (maxG - minG)) * (w - 2 * pad);
      const y = h - (pad + ((lat - minL) / (maxL - minL)) * (h - 2 * pad));
      return { x: Math.round(x), y: Math.round(y) };
    };

    return {
      minLat: minL,
      maxLat: maxL,
      minLng: minG,
      maxLng: maxG,
      width: w,
      height: h,
      padding: pad,
      getSvgCoords: project
    };
  }, [points, phleboLocation]);

  const phleboCoords = getSvgCoords(phleboLocation.lat, phleboLocation.lng);

  return (
    <div className={`bg-slate-950 rounded-[2.5rem] border-2 border-brand-purple/30 shadow-2xl overflow-hidden transition-all duration-300 relative ${isExpanded ? 'p-6 sm:p-8 min-h-[580px]' : 'p-5 sm:p-6'}`}>
      
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-purple/20 border border-brand-purple/40 flex items-center justify-center text-brand-purple shadow-inner">
            <Radio size={20} className="text-purple-400 animate-pulse" />
          </div>
          <div>
            <h3 className="font-black text-sm uppercase tracking-wider text-white flex items-center gap-2">
              Live Field Map Visualizer
              <span className="bg-brand-purple/30 text-brand-purple text-[8px] font-black uppercase px-2 py-0.5 rounded-full border border-brand-purple/40">
                GPS Sync
              </span>
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Tracking {myActiveCalls.length} Active Tasks • {availableCalls.length} Broadcasts Nearby
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Theme Toggle */}
          <button
            onClick={() => setMapTheme(t => t === 'RADAR' ? 'CLEAN' : 'RADAR')}
            className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 transition-all flex items-center gap-1.5"
            title="Toggle Map Style"
          >
            <Layers size={12} className="text-purple-400" />
            {mapTheme === 'RADAR' ? 'Radar' : 'Clean'}
          </button>

          {/* Broadcasts Filter Toggle */}
          <button
            onClick={() => setShowBroadcasts(b => !b)}
            className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all flex items-center gap-1.5 ${
              showBroadcasts ? 'bg-orange-500/20 text-orange-300 border-orange-500/40' : 'bg-white/5 text-slate-500 border-white/10'
            }`}
          >
            <Eye size={12} />
            {showBroadcasts ? 'Broadcasts On' : 'Broadcasts Off'}
          </button>

          {/* Vector Routes Toggle */}
          <button
            onClick={() => setShowRoutes(r => !r)}
            className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all flex items-center gap-1.5 ${
              showRoutes ? 'bg-brand-purple/20 text-purple-300 border-brand-purple/40' : 'bg-white/5 text-slate-500 border-white/10'
            }`}
          >
            <Navigation size={12} />
            {showRoutes ? 'Vectors On' : 'Vectors Off'}
          </button>

          {/* Expand / Collapse Toggle */}
          <button
            onClick={() => setIsExpanded(e => !e)}
            className="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 transition-all"
            title={isExpanded ? 'Collapse Map' : 'Expand Map'}
          >
            {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* SVG Canvas Container */}
      <div className={`relative rounded-3xl overflow-hidden border border-white/10 ${
        mapTheme === 'RADAR' 
          ? 'bg-slate-900/90 [background-image:radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:24px_24px]' 
          : 'bg-slate-950/95 [background-image:linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] [background-size:32px_32px]'
      }`}>
        
        {/* Radar Ring Visuals */}
        <div className="absolute inset-0 pointer-events-none opacity-20 flex items-center justify-center">
          <div className="w-[300px] h-[300px] border border-brand-purple/40 rounded-full animate-ping opacity-25" />
          <div className="w-[180px] h-[180px] border border-blue-400/30 rounded-full" />
        </div>

        {/* SVG Graphic */}
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto max-h-[380px] sm:max-h-[440px] select-none"
        >
          <defs>
            {/* Pulsing Gradient Filters */}
            <radialGradient id="phleboGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="taskGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="50%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>

          {/* Grid Decorative Crosshairs */}
          <line x1={width / 2} y1={0} x2={width / 2} y2={height} stroke="rgba(255,255,255,0.04)" strokeDasharray="4 4" />
          <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke="rgba(255,255,255,0.04)" strokeDasharray="4 4" />

          {/* Vector Routes from Phlebotomist to Active Tasks */}
          {showRoutes && myActiveCalls.map(c => {
            const dest = getSvgCoords(c.destination.lat, c.destination.lng);
            const distKm = calculateDistance(phleboLocation, c.destination);
            const isSelected = c.id === selectedActiveCallId || c.id === hoveredCallId;
            const midX = (phleboCoords.x + dest.x) / 2;
            const midY = (phleboCoords.y + dest.y) / 2;

            return (
              <g key={`route_${c.id}`}>
                {/* Outer Glow Line */}
                <line
                  x1={phleboCoords.x}
                  y1={phleboCoords.y}
                  x2={dest.x}
                  y2={dest.y}
                  stroke={isSelected ? '#a855f7' : '#38bdf8'}
                  strokeWidth={isSelected ? 4 : 2}
                  strokeOpacity={isSelected ? 0.9 : 0.4}
                  strokeDasharray="6 4"
                  className="animate-pulse"
                />
                
                {/* Distance Badge on Vector */}
                <g transform={`translate(${midX}, ${midY})`}>
                  <rect
                    x="-24"
                    y="-10"
                    width="48"
                    height="18"
                    rx="6"
                    fill="#0f172a"
                    stroke={isSelected ? '#a855f7' : '#334155'}
                    strokeWidth="1"
                  />
                  <text
                    x="0"
                    y="3"
                    fill={isSelected ? '#c084fc' : '#94a3b8'}
                    fontSize="9"
                    fontWeight="800"
                    textAnchor="middle"
                  >
                    {distKm} KM
                  </text>
                </g>
              </g>
            );
          })}

          {/* Lab / Hub Marker */}
          {phleboLab && (() => {
            const hubCoords = getSvgCoords(phleboLab.location.lat, phleboLab.location.lng);
            return (
              <g key="hub_node" transform={`translate(${hubCoords.x}, ${hubCoords.y})`}>
                <circle r="16" fill="#3b82f6" fillOpacity="0.15" />
                <rect x="-12" y="-12" width="24" height="24" rx="8" fill="#1e293b" stroke="#3b82f6" strokeWidth="2" />
                <text x="0" y="4" fill="#60a5fa" fontSize="10" fontWeight="900" textAnchor="middle">H</text>
                <text x="0" y="24" fill="#94a3b8" fontSize="8" fontWeight="700" textAnchor="middle">{phleboLab.name}</text>
              </g>
            );
          })()}

          {/* Broadcast Calls Markers */}
          {showBroadcasts && availableCalls.map(c => {
            const coords = getSvgCoords(c.destination.lat, c.destination.lng);
            const distKm = calculateDistance(phleboLocation, c.destination);
            const isHovered = c.id === hoveredCallId;

            return (
              <g
                key={`bcast_${c.id}`}
                transform={`translate(${coords.x}, ${coords.y})`}
                className="cursor-pointer group"
                onMouseEnter={() => setHoveredCallId(c.id)}
                onMouseLeave={() => setHoveredCallId(null)}
                onClick={() => onAcceptCall ? onAcceptCall(c.id) : onSelectCall(c.id)}
              >
                <circle r={isHovered ? '18' : '12'} fill="#f97316" fillOpacity="0.2" className="transition-all duration-300" />
                <circle r="8" fill="#ea580c" stroke="#ffedd5" strokeWidth="1.5" />
                {c.isPriority && (
                  <circle r="12" fill="none" stroke="#f97316" strokeWidth="1.5" strokeDasharray="3 2" className="animate-spin" />
                )}
                {/* Call Label */}
                <g transform="translate(0, -14)">
                  <rect x="-35" y="-12" width="70" height="15" rx="4" fill="#0f172a" fillOpacity="0.9" stroke="#f97316" strokeWidth="0.8" />
                  <text x="0" y="-2" fill="#ffedd5" fontSize="8" fontWeight="800" textAnchor="middle">
                    {c.patientName.split(' ')[0]} ({distKm}k)
                  </text>
                </g>
              </g>
            );
          })}

          {/* Assigned Active Tasks Markers */}
          {myActiveCalls.map(c => {
            const coords = getSvgCoords(c.destination.lat, c.destination.lng);
            const distKm = calculateDistance(phleboLocation, c.destination);
            const isSelected = c.id === selectedActiveCallId || c.id === hoveredCallId;
            const isUrgent = c.isPriority;

            return (
              <g
                key={`active_${c.id}`}
                transform={`translate(${coords.x}, ${coords.y})`}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredCallId(c.id)}
                onMouseLeave={() => setHoveredCallId(null)}
                onClick={() => onSelectCall(c.id)}
              >
                {/* Selection Halo */}
                {isSelected && (
                  <>
                    <circle r="26" fill="url(#taskGlow)" />
                    <circle r="20" fill="none" stroke="#10b981" strokeWidth="1.5" strokeDasharray="4 3" className="animate-spin" />
                  </>
                )}

                {/* Base Outer Ring */}
                <circle r={isSelected ? '14' : '11'} fill={isUrgent ? '#f97316' : '#10b981'} fillOpacity="0.3" />
                
                {/* Core Marker Pin */}
                <circle
                  r={isSelected ? '10' : '8'}
                  fill={isUrgent ? '#ea580c' : '#059669'}
                  stroke="#ffffff"
                  strokeWidth="2"
                  className="transition-all duration-300"
                />

                {/* Status Dot */}
                <circle r="3" fill="#ffffff" />

                {/* Floating Patient Name Banner */}
                <g transform="translate(0, -18)">
                  <rect
                    x="-45"
                    y="-14"
                    width="90"
                    height="18"
                    rx="5"
                    fill={isSelected ? '#059669' : '#0f172a'}
                    stroke={isSelected ? '#6ee7b7' : '#334155'}
                    strokeWidth="1"
                    shadow-sm
                  />
                  <text
                    x="0"
                    y="-2"
                    fill={isSelected ? '#ffffff' : '#e2e8f0'}
                    fontSize="9"
                    fontWeight="900"
                    textAnchor="middle"
                  >
                    {c.patientName}
                  </text>
                </g>

                {/* Distance Badge */}
                <g transform="translate(0, 20)">
                  <rect x="-24" y="-8" width="48" height="14" rx="4" fill="#1e293b" fillOpacity="0.9" />
                  <text x="0" y="2" fill="#34d399" fontSize="8" fontWeight="800" textAnchor="middle">
                    {distKm} km
                  </text>
                </g>
              </g>
            );
          })}

          {/* Phlebotomist Current Position Node (YOU) */}
          <g transform={`translate(${phleboCoords.x}, ${phleboCoords.y})`} className="z-30">
            {/* Outer Pulsing Wave */}
            <circle r="32" fill="url(#phleboGlow)" />
            <circle r="22" fill="none" stroke="#a855f7" strokeWidth="2" strokeDasharray="4 3" className="animate-spin" />
            <circle r="14" fill="#7c3aed" stroke="#ffffff" strokeWidth="2.5" className="shadow-2xl" />
            <circle r="5" fill="#ffffff" />

            {/* Phlebo Location Banner */}
            <g transform="translate(0, -26)">
              <rect
                x="-55"
                y="-14"
                width="110"
                height="20"
                rx="6"
                fill="#7c3aed"
                stroke="#d8b4fe"
                strokeWidth="1.5"
              />
              <text x="0" y="-1" fill="#ffffff" fontSize="9" fontWeight="900" textAnchor="middle">
                YOU (GPS Node)
              </text>
            </g>
          </g>
        </svg>

        {/* Selected Call Popover Card */}
        {selectedCall && (
          <div className="absolute bottom-3 left-3 right-3 sm:left-4 sm:right-auto sm:max-w-md bg-slate-900/95 backdrop-blur-xl border border-white/20 p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4 animate-slide-up z-40">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                selectedCall.assignedPhleboId ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
              }`}>
                <MapPin size={20} />
              </div>
              <div className="overflow-hidden">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-white truncate">{selectedCall.patientName}</span>
                  {selectedCall.isPriority && (
                    <span className="bg-orange-500 text-white text-[8px] font-black uppercase px-1.5 py-0.5 rounded">Urgent</span>
                  )}
                </div>
                <p className="text-[10px] text-slate-300 truncate mt-0.5">{selectedCall.destination.address}</p>
                <p className="text-[9px] font-mono text-purple-300 font-bold mt-0.5">
                  Distance: {calculateDistance(phleboLocation, selectedCall.destination)} KM
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                if (!selectedCall.assignedPhleboId && onAcceptCall) {
                  onAcceptCall(selectedCall.id);
                } else {
                  onSelectCall(selectedCall.id);
                }
              }}
              className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shrink-0 flex items-center gap-1.5 shadow-lg ${
                selectedCall.assignedPhleboId 
                  ? 'bg-brand-purple text-white hover:bg-purple-700' 
                  : 'bg-emerald-500 text-white hover:bg-emerald-600'
              }`}
            >
              {selectedCall.assignedPhleboId ? 'View Task' : 'Accept Task'}
              <ChevronRight size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Legend & Summary Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-4 text-[10px] font-bold text-slate-400 border-t border-white/5 pt-3">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 ring-2 ring-purple-300" />
            <span className="text-white">You (Phlebo GPS)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-slate-300">My Assigned Tasks ({myActiveCalls.length})</span>
          </div>
          {showBroadcasts && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
              <span className="text-slate-300">Available Broadcasts ({availableCalls.length})</span>
            </div>
          )}
          {phleboLab && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-slate-300">Hub Lab</span>
            </div>
          )}
        </div>

        {/* Task Switcher Chips */}
        {myActiveCalls.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full no-scrollbar">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Quick Select:</span>
            {myActiveCalls.map((c, idx) => {
              const isSelected = c.id === selectedActiveCallId;
              return (
                <button
                  key={`chip_${c.id}`}
                  onClick={() => onSelectCall(c.id)}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase transition-all whitespace-nowrap ${
                    isSelected ? 'bg-brand-purple text-white shadow-md' : 'bg-white/10 text-slate-300 hover:bg-white/20'
                  }`}
                >
                  #{idx + 1} {c.patientName.split(' ')[0]}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
