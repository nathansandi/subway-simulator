import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import {
  Play,
  Pause,
  Clock,
  Trash2,
  Plus,
  Zap,
  TrendingUp,
  DollarSign,
  Users,
  Map as MapIcon,
  Navigation,
  Activity,
  Award,
  AlertOctagon,
  ChevronsRight,
  ShieldAlert,
  HelpCircle,
  X,
  FileText,
  Sparkles
} from 'lucide-react';
import { GameState, Station, Line, Train } from './types';
import { CitySelector } from './components/CitySelector';
import { EconomyPanel } from './components/EconomyPanel';
import { SocialFeed } from './components/SocialFeed';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  // Game state core
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [activeDistrictId, setActiveDistrictId] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Builder tools options
  const [buildMode, setBuildMode] = useState<'select' | 'build-station' | 'edit-line-tracks'>('select');
  const [selectedLineIdForTracks, setSelectedLineIdForTracks] = useState<string | null>(null);
  const [trackExtensionSourceId, setTrackExtensionSourceId] = useState<string | null>(null);

  // Create forms state
  const [stationFormName, setStationFormName] = useState('');
  const [showStationModal, setShowStationModal] = useState(false);
  const [clickedPosition, setClickedPosition] = useState<[number, number] | null>(null);

  const [newLineName, setNewLineName] = useState('');
  const [newLineColor, setNewLineColor] = useState('#ef4444');
  const [newLineType, setNewLineType] = useState<'underground' | 'elevated' | 'highspeed'>('underground');

  const [newTrainCapacity, setNewTrainCapacity] = useState(150);
  const [newTrainSpeed, setNewTrainSpeed] = useState(80);
  const [newTrainNickname, setNewTrainNickname] = useState('');

  // Gemini analyst state
  const [loadingAi, setLoadingAi] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(12);
  const [aiReport, setAiReport] = useState<string | null>(null);

  // Active instructions card overlay
  const [showTutorial, setShowTutorial] = useState(true);

  // Save/Load state integration
  const [saveSlotName, setSaveSlotName] = useState('');
  const [serverSaves, setServerSaves] = useState<any[]>([]);

  // Track rendering style: 0.0 is straight, and up to 0.16 is curved
  const [trackCurvature, setTrackCurvature] = useState<number>(0.0);

  // Density Overlay and District Filter controls
  const [showDensity, setShowDensity] = useState(true);
  const [districtTypeFilter, setDistrictTypeFilter] = useState<'all' | 'residential' | 'commercial' | 'leisure' | 'industrial' | 'tourism'>('all');
  const [minDensityFilter, setMinDensityFilter] = useState<number>(0);

  // Sandbox tools visibility (collapsed by default to keep Left Side Panel extremely clean)
  const [showSandboxTools, setShowSandboxTools] = useState(false);
  const [showSocialFeed, setShowSocialFeed] = useState(true);

  const fetchSavesList = async () => {
    try {
      const res = await fetch('/api/game/save-list');
      const data = await res.json();
      if (data.saves) {
        setServerSaves(data.saves);
      }
    } catch (err) {
      console.error('Failed to fetch saves list:', err);
    }
  };

  const handleSaveGame = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const nameToSave = saveSlotName.trim() || `Metrô - ${new Date().toLocaleTimeString('pt-BR')}`;
    try {
      // 1. Save on Server scale
      const res = await fetch('/api/game/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameToSave })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`⚡ Jogo salvo no servidor: ${nameToSave}!`);
        setSaveSlotName('');
        fetchSavesList();
      } else {
        showToast(data.error || 'Erro ao salvar jogo.');
      }
    } catch (err) {
      showToast('Erro de conexão ao salvar.');
    }

    // 2. LocalStorage redundancy backup
    if (gameState) {
      try {
        const localSlot = {
          name: nameToSave,
          timestamp: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
          gameState
        };
        localStorage.setItem('metro_sandbox_last_save', JSON.stringify(localSlot));
      } catch (err) {
        console.error('LocalStorage backup error:', err);
      }
    }
  };

  const handleLoadGame = async (id: string) => {
    try {
      const res = await fetch('/api/game/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.success) {
        setGameState(data.gameState);
        setSelectedStationId(null);
        setSelectedLineId(null);
        setBuildMode('select');
        showToast('🔄 Carregado com sucesso!');
      } else {
        showToast(data.error || 'Falha ao carregar.');
      }
    } catch (err) {
      showToast('Falha ao comunicar com o servidor.');
    }
  };

  const handleLoadLastLocalSave = () => {
    try {
      const localString = localStorage.getItem('metro_sandbox_last_save');
      if (!localString) {
        showToast('Nenhum save local armazenado no seu navegador.');
        return;
      }
      const saveObj = JSON.parse(localString);
      if (saveObj && saveObj.gameState) {
        handleRawGameStateRestore(saveObj.gameState);
      } else {
        showToast('O arquivo de save local está corrompido.');
      }
    } catch (err) {
      showToast('Erro ao ler do LocalStorage.');
    }
  };

  const handleRawGameStateRestore = async (stateObj: any) => {
    try {
      const res = await fetch('/api/game/load-raw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadedState: stateObj })
      });
      const data = await res.json();
      if (data.success) {
        setGameState(data.gameState);
        setSelectedStationId(null);
        setSelectedLineId(null);
        setBuildMode('select');
        showToast('📥 Save restaurado com sucesso!');
      } else {
        showToast(data.error || 'Falha ao validar save.');
      }
    } catch (err) {
      showToast('Erro ao transmitir payload.');
    }
  };

  const handleExportSaveToJson = () => {
    if (!gameState) return;
    try {
      const payload = {
        appSignature: 'metro-sandbox-save',
        timestamp: new Date().toISOString(),
        gameState
      };
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `metro-metro-${gameState.currentCityId}-${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('💾 Arquivo .json baixado com sucesso!');
    } catch (err) {
      showToast('Erro ao exportar JSON.');
    }
  };

  const handleImportSaveFromJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json && json.gameState) {
          await handleRawGameStateRestore(json.gameState);
        } else {
          showToast('Formato JSON de save inválido.');
        }
      } catch (err) {
        showToast('Erro ao decodificar arquivo JSON.');
      }
    };
    reader.readAsText(file);
    // Reset file input
    e.target.value = '';
  };

  // Fetch initial save list on start
  useEffect(() => {
    if (gameState) {
      fetchSavesList();
    }
  }, [gameState !== null]);

  // Map references
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const overlayLayerRef = useRef<L.FeatureGroup | null>(null);

  // Toast notifier timer helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Bezier curve calculations for organic/flexible visuals with parallel offset tapering
  // Improved with Cubic Bezier and Octolinear-aware routing for a "Brand New Subway" aesthetic
  const getBezierCurvePoints = (
    p1: [number, number],
    p2: [number, number],
    numSteps: number = 32,
    offset: { amt: number } | null = null,
    isCanonical: boolean = true
  ): [number, number][] => {
    const dy = p2[0] - p1[0];
    const dx = p2[1] - p1[1];
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist === 0) return [p1, p2];

    // Perfect straight line if curvature is 0
    if (trackCurvature === 0) {
      const straightPoints: [number, number][] = [];
      for (let s = 0; s <= numSteps; s++) {
        const t = s / numSteps;
        const baseLat = p1[0] + dy * t;
        const baseLng = p1[1] + dx * t;
        if (offset && offset.amt !== 0) {
          const ny = -dx / dist;
          const nx = dy / dist;
          const taper = Math.pow(Math.sin(t * Math.PI), 0.2);
          const multiplier = isCanonical ? 1 : -1;
          straightPoints.push([baseLat + ny * offset.amt * multiplier * taper, baseLng + nx * offset.amt * multiplier * taper]);
        } else {
          straightPoints.push([baseLat, baseLng]);
        }
      }
      return straightPoints;
    }

    // Determine "best fit" octolinear exit angles from stations
    // This creates the professional transit map look where lines exit stations on 45/90 deg
    const getControlPoint = (start: [number, number], end: [number, number], strength: number) => {
      const dLat = end[0] - start[0];
      const dLng = end[1] - start[1];
      const absLat = Math.abs(dLat);
      const absLng = Math.abs(dLng);
      
      // Alignment Check: If stations are already close to an octolinear axis (0, 45, 90), favor a straight exit
      const isVertical = absLat > absLng * 3.0; // Sharp threshold for vertical
      const isHorizontal = absLng > absLat * 3.0; // Sharp threshold for horizontal
      const isDiagonal = Math.abs(absLat - absLng) < Math.min(absLat, absLng) * 0.25; // Close to 45 deg

      if (isVertical || isHorizontal || isDiagonal) {
        // Soften the curve into a straight-ish line for aligned segments
        return [start[0] + dLat * strength * 0.5, start[1] + dLng * strength * 0.5] as [number, number];
      }

      let cpLat = start[0];
      let cpLng = start[1];

      // Smart direction choice: prefer the dominant axis for the "S" or "L" curve
      if (absLat > absLng) {
        cpLat += dLat * strength; // Primary Vertical exit
      } else {
        cpLng += dLng * strength; // Primary Horizontal exit
      }
      
      return [cpLat, cpLng] as [number, number];
    };

    // Strength of the "curving" effect
    const curveStrength = Math.min(0.5, trackCurvature + 0.2);
    
    // Cubic Control Points
    const cp1 = getControlPoint(p1, p2, curveStrength);
    const cp2 = getControlPoint(p2, p1, curveStrength);

    const bezierPoints: [number, number][] = [];
    for (let s = 0; s <= numSteps; s++) {
      const t = s / numSteps;
      const mt = 1 - t;

      // Cubic Bezier: B(t) = (1-t)^3*P0 + 3(1-t)^2*t*P1 + 3(1-t)t^2*P2 + t^3*P3
      const baseLat = mt * mt * mt * p1[0] + 3 * mt * mt * t * cp1[0] + 3 * mt * t * t * cp2[0] + t * t * t * p2[0];
      const baseLng = mt * mt * mt * p1[1] + 3 * mt * mt * t * cp1[1] + 3 * mt * t * t * cp2[1] + t * t * t * p2[1];

      if (offset && offset.amt !== 0) {
        // Calculate tangent B'(t) to determine perpendicular offset direction
        const dLat = 3 * mt * mt * (cp1[0] - p1[0]) + 6 * mt * t * (cp2[0] - cp1[0]) + 3 * t * t * (p2[0] - cp2[0]);
        const dLng = 3 * mt * mt * (cp1[1] - p1[1]) + 6 * mt * t * (cp2[1] - cp1[1]) + 3 * t * t * (p2[1] - cp2[1]);
        const dDist = Math.sqrt(dLat * dLat + dLng * dLng);
        
        if (dDist > 0) {
          const tny = -dLng / dDist; // Perpendicular to tangent
          const tnx = dLat / dDist;
          
          // Tapering to ensure clean entry into circular stations
          const taper = Math.pow(Math.sin(t * Math.PI), 0.2);
          const multiplier = isCanonical ? 1 : -1;
          
          bezierPoints.push([baseLat + tny * offset.amt * multiplier * taper, baseLng + tnx * offset.amt * multiplier * taper]);
          continue;
        }
      }

      bezierPoints.push([baseLat, baseLng]);
    }
    return bezierPoints;
  };

  // 1. Initial mounting reload loops
  useEffect(() => {
    fetchGameState();

    const interval = setInterval(() => {
      fetchGameState();
    }, 1000); // 1-second ticks update sync

    return () => clearInterval(interval);
  }, []);

  const fetchGameState = async () => {
    try {
      const resp = await fetch('/api/game/state');
      const data = await resp.json();
      if (data.status === 'ok') {
        setGameState(data.gameState);
      }
    } catch (err) {
      console.error('State fetching failure:', err);
    }
  };

  // 2. Leaflet Map setup and dynamic refresh with OpenStreetMap / CartoDB layers
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Create Map
      const map = L.map(mapContainerRef.current, {
        center: [40.7128, -74.0060], // default Manhattan
        zoom: 12,
        zoomControl: false,
        attributionControl: false
      });

      // CartoDB Voyager (OSM Based, Free, Richer Labels and colors)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(map);

      // Create overlay feature group layer
      const overlayLayer = L.featureGroup().addTo(map);

      overlayLayerRef.current = overlayLayer;
      mapInstanceRef.current = map;

      // Click to build event hook
      map.on('click', (e: L.LeafletMouseEvent) => {
        setClickedPosition([e.latlng.lat, e.latlng.lng]);
      });

      map.on('zoomend', () => {
        setZoomLevel(map.getZoom());
      });

      // Invalidate map scale to force container size refresh and prevent blank rendering
      setTimeout(() => {
        map.invalidateSize();
      }, 400);
    }
  }, [gameState !== null]);

  // Resize observer to auto-adapt map size to container layout adjustments
  useEffect(() => {
    const map = mapInstanceRef.current;
    const container = mapContainerRef.current;
    if (!map || !container) return;

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [gameState !== null]);

  // Vector render recalculator whenever gameState modifies
  useEffect(() => {
    const map = mapInstanceRef.current;
    const overlay = overlayLayerRef.current;
    if (!map || !overlay || !gameState) return;

    // Clear old tracks, trains, districts
    overlay.clearLayers();

    const city = gameState.cities[gameState.currentCityId];
    if (!city) return;

    const segmentToLinesMap: { [key: string]: string[] } = {};
    const getSegmentKey = (id1: string, id2: string) => id1 < id2 ? `${id1}_${id2}` : `${id2}_${id1}`;

    // A. Draw Districts
    if (showDensity) {
      city.districts.forEach((dist) => {
        if (districtTypeFilter !== 'all' && dist.type !== districtTypeFilter) return;
        if (dist.density < minDensityFilter) return;

        const colorMap: Record<string, string> = {
          commercial: '#3b82f6',
          residential: '#10b981',
          leisure: '#f59e0b',
          industrial: '#8b5cf6',
          tourism: '#ec4899'
        };
        const color = colorMap[dist.type] || '#64748b';
        const isHovered = activeDistrictId === dist.id;

        const mainCircle = L.circle([dist.lat, dist.lng], {
          radius: dist.radius * 85000,
          color: color,
          weight: isHovered ? 2.5 : 1.2,
          fillColor: color,
          fillOpacity: isHovered ? 0.2 : 0.08,
          interactive: true
        });

        const tooltipHtml = `
          <div class="px-2 py-1.5 font-mono text-[10px] text-white bg-slate-950/95 border border-white/10 rounded shadow-xl">
            <p class="font-bold border-b border-white/10 mb-1 pb-0.5">${dist.name}</p>
            <p><span class="opacity-50">Pop:</span> ${(dist.population).toLocaleString('pt-BR')}</p>
            <p><span class="opacity-50">Densidade:</span> ${dist.density}%</p>
          </div>
        `;
        mainCircle.bindTooltip(tooltipHtml, { sticky: true, className: 'custom-district-tooltip' });
        mainCircle.on('mouseover', () => setActiveDistrictId(dist.id));
        mainCircle.on('mouseout', () => setActiveDistrictId(null));
        mainCircle.addTo(overlay);
      });
    }

    // B. Collect segments for offsetting overlapping lines
    Object.values(gameState.lines).forEach((line) => {
      const l = line as Line;
      if (!l.isActive || l.stationIds.length < 2) return;
      for (let i = 0; i < l.stationIds.length - 1; i++) {
        const key = getSegmentKey(l.stationIds[i], l.stationIds[i+1]);
        if (!segmentToLinesMap[key]) segmentToLinesMap[key] = [];
        if (!segmentToLinesMap[key].includes(l.id)) segmentToLinesMap[key].push(l.id);
      }
    });

    // C. Draw Metro Lines
    const lines = Object.values(gameState.lines) as Line[];
    // Sort to draw the selected/editing line last so it appears on top
    const sortedLines = [...lines].sort((a, b) => {
      if (a.id === selectedLineIdForTracks) return 1;
      if (b.id === selectedLineIdForTracks) return -1;
      return 0;
    });

    sortedLines.forEach((l) => {
      if (!l.isActive || l.stationIds.length < 2) return;

      const isEditing = selectedLineIdForTracks === l.id;

      for (let i = 0; i < l.stationIds.length - 1; i++) {
        const s1 = gameState.stations[l.stationIds[i]];
        const s2 = gameState.stations[l.stationIds[i+1]];
        if (!s1 || !s2) continue;

        const key = getSegmentKey(s1.id, s2.id);
        const sharedLines = segmentToLinesMap[key] || [];
        const index = sharedLines.indexOf(l.id);
        const N = sharedLines.length;

        const dy = s2.lat - s1.lat;
        const dx = s2.lng - s1.lng;
        const dist = Math.sqrt(dx*dx + dy*dy);

        let parallelOffset: { amt: number } | null = null;
        if (dist > 0 && N > 1 && index !== -1) {
          const shift = index - (N-1)/2;
          const zoomFactor = Math.pow(2, 14 - zoomLevel);
          // 0.0008 spacing for very clear distinction even at high zoom
          const spacing = 0.0008 * zoomFactor; 
          parallelOffset = { amt: shift * spacing };
        }

        const curve = getBezierCurvePoints([s1.lat, s1.lng], [s2.lat, s2.lng], 40, parallelOffset, s1.id < s2.id);
        L.polyline(curve, { 
          color: l.color, 
          weight: isEditing ? 6 : 4, 
          opacity: 0.95, 
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false
        }).addTo(overlay);
      }
    });

    // D. Draw Stations
    const stationLinesMap: Record<string, Line[]> = {};
    Object.values(gameState.lines).forEach((l) => {
      const line = l as Line;
      if (!line.isActive) return;
      line.stationIds.forEach((sid) => {
        if (!stationLinesMap[sid]) stationLinesMap[sid] = [];
        if (!stationLinesMap[sid].find(ex => ex.id === line.id)) {
          stationLinesMap[sid].push(line);
        }
      });
    });

    const editingLine = selectedLineIdForTracks ? gameState.lines[selectedLineIdForTracks] : null;
    const endStationIds = editingLine?.stationIds || [];
    const actualEnds = endStationIds.length > 0 ? [endStationIds[0], endStationIds[endStationIds.length - 1]] : [];

    Object.values(gameState.stations).forEach((station) => {
      const s = station as Station;
      const isSelected = selectedStationId === s.id;
      const isLineEnd = actualEnds.includes(s.id);
      const isExtensionSource = trackExtensionSourceId === s.id;
      const totalWait = Object.values(s.waitingPassengers).reduce((a, b) => (a as number) + (b as number), 0) as number;
      
      const connections = stationLinesMap[s.id] || [];
      const isHub = connections.length >= 2;
      const isOvercrowded = totalWait > 25;
      const isBroken = s.maintenanceLevel < 20;

      const borderColor = isBroken ? '#ef4444' : isSelected ? '#34d399' : (isExtensionSource ? '#fbbf24' : (isLineEnd ? editingLine?.color || '#3b82f6' : '#fff'));
      const borderClass = isSelected ? 'scale-125 border-emerald-400' : (isExtensionSource ? 'scale-150 border-amber-400 z-[1000] ring-4 ring-amber-400/30' : (isLineEnd ? 'scale-110 border-2' : isHub ? 'border-indigo-400 border-2' : 'border-white/40'));

      const connectionDots = connections
        .map(l => `<div class="w-1.5 h-1.5 rounded-full border border-black/20" style="background-color: ${l.color}"></div>`)
        .join('');

      const icon = L.divIcon({
        className: 'station-marker',
        html: `
          <div class="relative flex items-center justify-center">
            ${isHub ? `<div class="absolute -top-4 -left-1 bg-indigo-500 text-[7px] text-white font-bold px-1 rounded-sm uppercase tracking-tighter shadow-md z-[60]">HUB</div>` : ''}
            ${isOvercrowded || isBroken ? `
              <div class="absolute -top-4 -right-1 ${isBroken ? 'bg-red-500' : 'bg-amber-500'} text-white rounded-full w-3.5 h-3.5 flex items-center justify-center text-[10px] font-bold shadow-lg animate-pulse z-[60]">
                ${isBroken ? '!' : '△'}
              </div>
            ` : ''}
            <div class="w-4 h-4 rounded-full border-2 bg-slate-900 shadow-xl transition-all ${borderClass}" style="border-color: ${borderColor}">
              <div class="w-1.5 h-1.5 rounded-full bg-white m-auto mt-0.5 ${isLineEnd || isExtensionSource ? 'animate-pulse' : ''}"></div>
            </div>
            
            <div class="absolute top-4.5 flex gap-0.5 justify-center w-full">
              ${connectionDots}
            </div>

            <div class="absolute -bottom-8 bg-slate-950 text-[9px] font-mono px-1 border border-white/10 rounded whitespace-nowrap z-50">
              ${s.name} ${totalWait > 0 ? `(${totalWait})` : ''}
            </div>
          </div>
        `,
        iconSize: [24, 24]
      });

      const marker = L.marker([s.lat, s.lng], { icon });
      marker.on('click', () => {
        if (buildMode === 'edit-line-tracks' && selectedLineIdForTracks) {
          handleLinkStationToLine(selectedLineIdForTracks, s.id);
        } else {
          setSelectedStationId(s.id);
          setSelectedLineId(null);
        }
      });
      marker.addTo(overlay);
    });

    // E. Draw Trains
    Object.values(gameState.trains).forEach((train) => {
      const t = train as Train;
      const line = gameState.lines[t.lineId];
      if (!line) return;
      const isBroken = t.status === 'broken';

      let renderLat = t.lat;
      let renderLng = t.lng;

      // VISUAL SNAPPING: If train is moving, snap its render position to the line's curved geometry
      if (t.status === 'running' && line.stationIds.length >= 2) {
        const targetId = line.stationIds[t.targetStationIndex];
        const prevIdx = t.direction === 1 ? t.targetStationIndex - 1 : t.targetStationIndex + 1;
        const prevId = line.stationIds[prevIdx];
        
        if (prevId && targetId) {
          const s1 = gameState.stations[prevId];
          const s2 = gameState.stations[targetId];
          if (s1 && s2) {
            const key = getSegmentKey(s1.id, s2.id);
            const sharedLines = segmentToLinesMap[key] || [t.lineId];
            const index = sharedLines.indexOf(t.lineId);
            const zoomFactor = Math.pow(2, 14 - zoomLevel);
            const offsetAmt = (index !== -1) ? (index - (sharedLines.length - 1) / 2) * (0.0008 * zoomFactor) : 0;
            
            // Progress Calculation (chord-based interpolation ratio)
            const dy = s2.lat - s1.lat;
            const dx = s2.lng - s1.lng;
            const distTotal = Math.sqrt(dx*dx + dy*dy);
            const distCurrent = Math.sqrt(Math.pow(t.lat - s1.lat, 2) + Math.pow(t.lng - s1.lng, 2));
            const progress = distTotal > 0 ? Math.min(1.0, distCurrent / distTotal) : 0;

            const curvePoints = getBezierCurvePoints([s1.lat, s1.lng], [s2.lat, s2.lng], 40, { amt: offsetAmt }, s1.id < s2.id);
            const pIdx = Math.floor(progress * (curvePoints.length - 1));
            const pt = curvePoints[pIdx];
            if (pt) {
              renderLat = pt[0];
              renderLng = pt[1];
            }
          }
        }
      }

      const icon = L.divIcon({
        className: 'train-marker',
        html: `
          <div class="bg-slate-950 border border-white/10 rounded p-0.5 shadow-lg scale-90 flex items-center gap-1" style="background-color: ${isBroken ? '#ef4444' : line.color}">
            <p class="text-[8px] font-bold text-white px-0.5">🚇</p>
            <p class="text-[7px] font-mono text-white pr-1">${t.occupancy}</p>
          </div>
        `,
        iconSize: [36, 20]
      });

      L.marker([renderLat, renderLng], { icon, interactive: false }).addTo(overlay);
    });

  }, [gameState, selectedStationId, activeDistrictId, buildMode, selectedLineIdForTracks, trackExtensionSourceId, zoomLevel, showDensity, districtTypeFilter, minDensityFilter, trackCurvature]);

  // Handle map click for station building is handled by Leaflet .on('click')
  // No longer needed: onMapClick

  // Sync click coords to raise build popup
  useEffect(() => {
    if (clickedPosition) {
      if (buildMode === 'build-station') {
        const cityId = gameState?.currentCityId;
        let nameIdeas = ['Grand Terminal', 'Lexington Plaza', 'Waterfront Port', 'Symphony Circle', 'Broadway Central', 'South Gateway', 'Tech Junction', 'Central Station', 'Park Avenue', 'Exchange Hub'];
        let suffix = ' Station';

        if (cityId === 'saopaulo') {
          nameIdeas = [
            'Estação da Luz', 'Vila Madalena', 'Consolação', 'Avenida Paulista', 'Faria Lima', 
            'Liberdade', 'Pinheiros', 'Paraíso', 'Trianon-Masp', 'Butantã', 'República', 
            'Mooca', 'Anhangabaú', 'Brigadeiro', 'Vila Mariana', 'Palmeiras-Barra Funda', 
            'São Joaquim', 'Itaim Bibi', 'Berrini', 'Santo Amaro', 'Moema', 'Brooklin', 
            'Fradique Coutinho', 'Sumaré', 'Clinicas', 'Vila Olimpia', 'Gatões', 'Cidade Jardim',
            'Tatuapé', 'Penha', 'Carrão', 'Paraíso', 'Ana Rosa', 'São Bento', 'Sé'
          ];
          suffix = ''; // SP Metro names are fully customized natively
        } else if (cityId === 'paris') {
          nameIdeas = [
            'Champs-Élysées', 'Châtelet', 'Gare de Lyon', 'Montmartre', 'Bastille', 
            'République', 'Saint-Germain-des-Prés', 'Louvre-Rivoli', 'La Défense', 
            'Opéra', 'Nation', 'Belleville', 'Pigalle', 'Saint-Michel', 'Montparnasse-Bienvenüe',
            'Pont Neuf', 'Trocadéro', 'Anvers', 'Gare du Nord', 'Bastille'
          ];
          suffix = ''; // Paris Metro names contain local titles natively
        } else if (cityId === 'nyc') {
          nameIdeas = [
            'Grand Central', 'Lexington Plaza', 'Times Square', 'Wall Street', 'Penn Station', 
            'Canal Street', 'Astor Place', 'Columbus Circle', 'Rockefeller Center', 'Fulton Street', 
            'Brooklyn Heights', 'Chelsea Park', 'World Trade Center', 'Bedford-Nostrand', 'Flushing-Main St',
            'Astoria Blvd', 'St. George Terminal', 'Union Square'
          ];
          suffix = ' Station';
        } else if (cityId === 'london') {
          nameIdeas = [
            'King\'s Cross St Pancras', 'Waterloo', 'Oxford Circus', 'Paddington', 'Victoria', 
            'Piccadilly Circus', 'Canary Wharf', 'Camden Town', 'Westminster', 'London Bridge',
            'Liverpool Street', 'South Kensington', 'Covent Garden', 'Elephant & Castle', 'Greenwich'
          ];
          suffix = '';
        }

        const chosenIdea = nameIdeas[Math.floor(Math.random() * nameIdeas.length)];
        setStationFormName(chosenIdea + suffix);
        setShowStationModal(true);
      } else if (buildMode === 'select') {
        showToast("💡 Pro-Tip: To build a station, click '🔨 Build Station ($80k)' in the map overlay first, then click on the map!");
        setClickedPosition(null);
      } else {
        setClickedPosition(null);
      }
    }
  }, [clickedPosition, buildMode]);

  // Move camera set center on active city change
  useEffect(() => {
    if (gameState && mapInstanceRef.current) {
      const city = gameState.cities[gameState.currentCityId];
      if (city) {
        mapInstanceRef.current.setView([city.lat, city.lng], 12);
      }
    }
  }, [gameState?.currentCityId]);

  // --- API COMMUNICATIONS ---

  const handleSelectCityId = async (id: string) => {
    try {
      const res = await fetch('/api/game/city', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cityId: id })
      });
      const data = await res.json();
      if (data.status === 'ok') {
        setGameState(data.gameState);
        setSelectedStationId(null);
        setSelectedLineId(null);
        setBuildMode('select');
        showToast(`City shifted! Map centered on ${data.gameState.cities[id].name}.`);
      }
    } catch (err) {
      showToast('Error shifting sandbox cities.');
    }
  };

  const handleCustomCityLoaded = async (name: string, lat: number, lng: number) => {
    try {
      const res = await fetch('/api/game/city', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customName: name, lat, lng })
      });
      const data = await res.json();
      if (data.status === 'ok') {
        setGameState(data.gameState);
        setSelectedStationId(null);
        setSelectedLineId(null);
        setBuildMode('select');
        showToast(`Custom city spawned: ${name}! Geological transit zones simulated.`);
      }
    } catch (err) {
      showToast('Error loading coordinates.');
    }
  };

  const handleBuildStationSubmit = async () => {
    if (!stationFormName.trim() || !clickedPosition) return;

    try {
      const res = await fetch('/api/game/station', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: stationFormName,
          lat: clickedPosition[0],
          lng: clickedPosition[1]
        })
      });
      const data = await res.json();
      if (data.error) {
        showToast(data.error);
      } else {
        setGameState(data.gameState);
        setShowStationModal(false);
        setClickedPosition(null);
        setBuildMode('select');
        showToast(`Platform operational: ${stationFormName}!`);
      }
    } catch (err) {
      showToast('Fails to build station.');
    }
  };

  const handleUpgradeStation = async (id: string) => {
    try {
      const res = await fetch('/api/game/station/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.error) {
        showToast(data.error);
      } else {
        setGameState(data.gameState);
        showToast('Station size, ticket gates, and platform width expanded successfully!');
      }
    } catch (err) {
      showToast('Error upgrading station platform.');
    }
  };

  const handleMaintenanceStation = async (id: string) => {
    try {
      const res = await fetch('/api/game/station/maintain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.error) {
        showToast(data.error);
      } else {
        setGameState(data.gameState);
        showToast('Station tracks cleaned and security protocols cleared! Maintenance: 100%.');
      }
    } catch (err) {
      showToast('Error executing maintenance.');
    }
  };

  const handleDeleteStation = async (id: string) => {
    if (!window.confirm('Delete this subway station and dismantle all associated tracks? This action is irreversible.')) return;
    try {
      const res = await fetch(`/api/game/station/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.status === 'ok') {
        setGameState(data.gameState);
        setSelectedStationId(null);
        showToast('Subway station dismantled.');
      }
    } catch (err) {
      showToast('Dismantling error.');
    }
  };

  const handleCreateLine = async () => {
    if (!newLineName.trim()) return;

    try {
      const res = await fetch('/api/game/line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newLineName,
          color: newLineColor,
          type: newLineType
        })
      });
      const data = await res.json();
      if (data.error) {
        showToast(data.error);
      } else {
        setGameState(data.gameState);
        setNewLineName('');
        showToast(`Line established: ${newLineName}. Enter track editor to lay rails between stations!`);
      }
    } catch (err) {
      showToast('Establish line failed.');
    }
  };

  const handleUpdateLine = async (lineId: string, name: string, color: string) => {
    try {
      const res = await fetch('/api/game/line/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineId, name, color })
      });
      const data = await res.json();
      if (data.status === 'ok') {
        setGameState(data.gameState);
        showToast('Linha atualizada com sucesso!');
      }
    } catch (err) {
      showToast('Erro ao atualizar linha.');
    }
  };

  const handleLinkStationToLine = async (lineId: string, stationId: string) => {
    const line = gameState?.lines[lineId];
    if (!line) return;

    const startId = line.stationIds[0];
    const endId = line.stationIds[line.stationIds.length - 1];
    
    // CASE A: Picking the ORIGIN of the new segment
    if (!trackExtensionSourceId) {
      // If line is empty, this is the very first station
      if (line.stationIds.length === 0) {
        setTrackExtensionSourceId(stationId);
        // We initialize the line with just this one station immediately
        await updateLineStations(lineId, [stationId]);
        showToast('Ponto inicial definido. Agora clique na próxima estação para conectar.');
        return;
      }

      // If line exists, must click an END (tip) to start extending
      if (stationId === startId || stationId === endId) {
        setTrackExtensionSourceId(stationId);
        showToast(`Origem selecionada: ${gameState.stations[stationId]?.name}. Clique no destino.`);
      } else if (line.stationIds.includes(stationId)) {
        showToast('Selecione uma estação na PONTA da linha para estender.');
      } else {
        showToast('Primeiro selecione uma estação que já faz parte da linha para estender.');
      }
      return;
    }

    // CASE B: Already have an origin, now picking the DESTINATION
    const originId = trackExtensionSourceId;
    setTrackExtensionSourceId(null); // Reset for next segment

    if (originId === stationId) {
      showToast('Origem e destino são iguais. Cancelado.');
      return;
    }

    let updatedIds = [...line.stationIds];

    // Check if destination is already in the line (loop closure or middle station error)
    if (line.stationIds.includes(stationId)) {
      // Logic for closing loops
      const sId = line.stationIds[0];
      const eId = line.stationIds[line.stationIds.length - 1];
      
      if ((originId === sId && stationId === eId) || (originId === eId && stationId === sId)) {
        // Close loop
        if (originId === sId) {
           updatedIds = [stationId, ...line.stationIds];
        } else {
           updatedIds = [...line.stationIds, stationId];
        }
        showToast(`Linha circular fechada: ${line.name}!`);
      } else {
        showToast('Esta estação já faz parte da linha no meio. Segmento ignorado.');
        return;
      }
    } else {
      // New station extension
      if (originId === startId) {
        updatedIds = [stationId, ...line.stationIds];
      } else if (originId === endId) {
        updatedIds = [...line.stationIds, stationId];
      } else {
        // This shouldn't happen if UI logic holds, but fallback:
        showToast('Erro: Origem não é uma extremidade da linha.');
        return;
      }
      showToast(`Trecho construído até ${gameState.stations[stationId]?.name}!`);
    }

    await updateLineStations(lineId, updatedIds);
  };

  const updateLineStations = async (lineId: string, stationIds: string[]) => {
    try {
      const res = await fetch('/api/game/line/stations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineId, stationIds })
      });
      const data = await res.json();
      if (data.error) {
        showToast(data.error);
      } else {
        setGameState(data.gameState);
      }
    } catch (err) {
      showToast('Erro ao atualizar os segmentos da linha.');
    }
  };

  const handleClearLineStations = async (lineId: string) => {
    try {
      const res = await fetch('/api/game/line/stations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineId, stationIds: [] })
      });
      const data = await res.json();
      if (data.status === 'ok') {
        setGameState(data.gameState);
        showToast('Dismantled all tracks. Station connections wiped.');
      }
    } catch (err) {
      showToast('Wipe track error.');
    }
  };

  const handleDeleteLine = async (lineId: string) => {
    if (!window.confirm('Scrap this transit line and recall all deployed trains?')) return;
    try {
      const res = await fetch(`/api/game/line/${lineId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.status === 'ok') {
        setGameState(data.gameState);
        setSelectedLineId(null);
        showToast('Line scrapped and rolling trains recalled.');
      }
    } catch (err) {
      showToast('Scrapping failure.');
    }
  };

  const handleDeployTrain = async (lineId: string) => {
    try {
      const finalName = newTrainNickname.trim()
        ? newTrainNickname.trim()
        : `Metrolink #${Math.floor(100 + Math.random() * 900)}`;

      const res = await fetch('/api/game/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineId,
          name: finalName,
          capacity: newTrainCapacity,
          speed: newTrainSpeed
        })
      });
      const data = await res.json();
      if (data.error) {
        showToast(data.error);
      } else {
        setGameState(data.gameState);
        showToast(`Locomotiva "${finalName}" de alta capacidade comprada e alocada!`);
        setNewTrainNickname(''); // Reset nickname input
      }
    } catch (err) {
      showToast('Falha ao comprar trem.');
    }
  };

  const handleTrainMaintenance = async (id: string) => {
    try {
      const res = await fetch('/api/game/train/maintain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.error) {
        showToast(data.error);
      } else {
        setGameState(data.gameState);
        showToast('Locomotive systems restored, mechanics discharged.');
      }
    } catch (err) {
      showToast('Error servicing locomotive.');
    }
  };

  const handleUpdateTicketPrice = async (price: number) => {
    try {
      const res = await fetch('/api/game/economy/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketPrice: price })
      });
      const data = await res.json();
      if (data.status === 'ok') {
        setGameState(data.gameState);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateVelocity = async (speed: number) => {
    try {
      const res = await fetch('/api/game/time/speed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeSpeed: speed })
      });
      const data = await res.json();
      if (data.status === 'ok') {
        setGameState(data.gameState);
        showToast(speed === 0 ? 'Simulation paused.' : `Simulation velocity: ${speed}x.`);
      }
    } catch (err) {
      showToast('Error altering velocity.');
    }
  };

  const handleTakeLoan = async (amount: number) => {
    try {
      const res = await fetch('/api/game/loan/take', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount })
      });
      const data = await res.json();
      if (data.error) {
        showToast(data.error);
      } else {
        setGameState(data.gameState);
        showToast(`Secured loan financing of $${amount.toLocaleString()}! Core balance updated.`);
      }
    } catch (err) {
      showToast('Network error securing credit.');
    }
  };

  const handleRepayLoan = async (loanId: string) => {
    try {
      const res = await fetch('/api/game/loan/repay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loanId })
      });
      const data = await res.json();
      if (data.error) {
        showToast(data.error);
      } else {
        setGameState(data.gameState);
        showToast('Settled loan principal with creditor! Clear of hourly interest.');
      }
    } catch (err) {
      showToast('Settlement processing error.');
    }
  };

  // 3. Summoning real-time expert Gemini Transit Advisor analysis
  const handleTriggerGeminiAdvisor = async () => {
    setLoadingAi(true);
    setAiReport(null);
    try {
      const res = await fetch('/api/gemini/advisor', { method: 'POST' });
      const data = await res.json();
      if (data.error) {
        showToast(data.error);
      } else {
        setAiReport(data.report);
        // Refresh feed posts
        fetchGameState();
        showToast('Gemini strategist evaluation completed! Check the report and incident banners.');
      }
    } catch (err) {
      showToast('Error interfacing with Gemini AI networks.');
    } finally {
      setLoadingAi(false);
    }
  };

  if (!gameState) {
    return (
      <div className="min-h-screen bg-[#090A0C] text-slate-100 flex flex-col justify-center items-center gap-4">
        <Activity className="w-12 h-12 text-indigo-500 animate-spin" />
        <h2 className="text-sm font-mono tracking-widest text-slate-455">LOADING METRO SIMULATOR STATE...</h2>
      </div>
    );
  }

  const currentCity = gameState.cities[gameState.currentCityId] || { name: 'New York City', population: 8335000 };
  const numStations = Object.keys(gameState.stations).length;
  const numLines = Object.keys(gameState.lines).length;
  const numTrains = Object.keys(gameState.trains).length;

  return (
    <div className="min-h-screen bg-[#090A0C] text-slate-100 flex flex-col font-sans overflow-x-hidden" id="applet-core-container">
      {/* Toast Alert popup overlay */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[1600] bg-black/80 backdrop-blur-xl border border-white/10 text-slate-200 py-3 px-4.5 rounded-xl shadow-[0_12px_36px_rgba(0,0,0,0.6)] font-sans text-xs flex items-center gap-2 max-w-sm animate-bounce" id="toast-notif">
          <Zap className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Tutorial modal */}
      {showTutorial && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[2000] flex items-center justify-center p-4" id="tutorial-overlay">
          <div className="bg-black/90 backdrop-blur-xl border border-white/15 rounded-3xl p-6 max-w-lg w-full text-slate-300 flex flex-col gap-4 shadow-2xl relative">
            <button onClick={() => setShowTutorial(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors cursor-pointer" id="close-tutorial">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-indigo-400">
              <MapIcon className="w-6 h-6 animate-pulse" />
              <h2 className="text-lg font-bold font-mono tracking-tight text-white uppercase">How to play Metro Builder</h2>
            </div>
            <p className="text-xs leading-relaxed text-slate-300">
              Welcome to the ultimate transportation sandbox! You are the Chief Transit Architect. Build a highly efficient transit loop from scratch directly over real physical mapping:
            </p>
            <div className="space-y-3.5 text-xs">
              <div className="flex gap-3">
                <div className="bg-emerald-600/10 text-emerald-400 w-6 h-6 rounded-lg font-mono font-bold flex items-center justify-center shrink-0">1</div>
                <div>
                  <p className="font-bold text-white mb-0.5">Establish Platforms</p>
                  <p className="opacity-80">Toggle <span className="text-emerald-400 font-bold">🔨 Build Station</span> mode on the map menu, then click any empty space on the real-world map to establish a new station hub ($80,000).</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="bg-indigo-600/10 text-indigo-400 w-6 h-6 rounded-lg font-mono font-bold flex items-center justify-center shrink-0">2</div>
                <div>
                  <p className="font-bold text-white mb-0.5">Lay Down Tracks</p>
                  <p className="opacity-80">Designate a Line under the Legend column (e.g., Red Line), click <span className="text-indigo-400 font-bold">✏️ Edit Tracks</span>, and click consecutive station markers on the map to join them with tracks!</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="bg-purple-600/10 text-purple-400 w-6 h-6 rounded-lg font-mono font-bold flex items-center justify-center shrink-0">3</div>
                <div>
                  <p className="font-bold text-white mb-0.5">Deploy Trains & Earn Yield</p>
                  <p className="opacity-80">Deploy rolling stock ($85,000) onto the line. Passengers naturally pathfind (Dijkstra) between residential and commercial districts, paying fares and reducing road congestion!</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="bg-amber-600/10 text-amber-400 w-6 h-6 rounded-lg font-mono font-bold flex items-center justify-center shrink-0">4</div>
                <div>
                  <p className="font-bold text-white mb-0.5">Interrogate Gemini Analyst</p>
                  <p className="opacity-80">Summon Gemini AI to perform real-time infrastructure scans, review citizen complaints, and trigger dynamic sports matches or weather events!</p>
                </div>
              </div>
            </div>
            <button onClick={() => setShowTutorial(false)} className="mt-2 text-center bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl font-bold font-mono text-xs uppercase text-white transition-all cursor-pointer shadow-lg active:translate-y-0.5" id="start-sandwich-button">
              Launch Sandbox Game
            </button>
          </div>
        </div>
      )}
      {/* Primary Header Dashboard */}
      <header className="bg-black/50 backdrop-blur-xl border-b border-white/10 p-4 sticky top-0 z-[1000] shadow-md shrink-0 flex flex-wrap justify-between items-center gap-4 text-white animate-fade-in">
        {/* Title */}
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 text-white p-2 rounded-xl shadow-lg shadow-indigo-650/45 animate-bounce">
            <Navigation className="w-5 h-5 fill-white" />
          </div>
          <div>
            <h1 className="text-base font-bold font-mono tracking-tight uppercase">METRO TRANSIT BUILDER</h1>
            <p className="text-[10px] text-slate-400 font-mono">Sandbox Architecture • AI Powered Advisor</p>
          </div>
        </div>

        {/* Global Statistics ticker */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-mono" id="header-stats-grid">
          {/* Economy cash */}
          <div className="flex items-center gap-2.5 bg-white/5 py-1.5 px-3 rounded-xl border border-white/10">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <div>
              <p className="text-[9px] text-slate-500 leading-none">CASH BUDGET</p>
              <p className={`font-bold ${gameState.economy.budget < 0 ? 'text-rose-455 animate-pulse' : 'text-emerald-400'}`}>
                ${gameState.economy.budget.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Commuters counts */}
          <div className="flex items-center gap-2.5 bg-white/5 py-1.5 px-3 rounded-xl border border-white/10">
            <Users className="w-4 h-4 text-indigo-400" />
            <div>
              <p className="text-[9px] text-slate-500 leading-none">delivered / active</p>
              <p className="font-bold text-slate-200">
                {gameState.deliveredPassengersCount.toLocaleString()} <span className="text-slate-500 font-normal">/ {gameState.activePassengersCount.toLocaleString()}</span>
              </p>
            </div>
          </div>

          {/* Carbon emissions savings */}
          <div className="flex items-center gap-2.5 bg-white/5 py-1.5 px-3 rounded-xl border border-white/10">
            <Award className="w-4 h-4 text-teal-400" />
            <div>
              <p className="text-[9px] text-slate-500 leading-none">co2 saved / cars off road</p>
              <p className="font-bold text-teal-400">
                {gameState.economy.totalCO2Saved.toFixed(1)}t <span className="text-slate-500 font-normal">/ {gameState.economy.totalCarReduced.toLocaleString()}</span>
              </p>
            </div>
          </div>

          {/* Active Lines & stations ratios */}
          <div className="flex items-center gap-2.5 bg-white/5 py-1.5 px-3 rounded-xl border border-white/10">
            <MapIcon className="w-4 h-4 text-amber-500" />
            <div>
              <p className="text-[9px] text-slate-500 leading-none">stations / lines / trains</p>
              <p className="font-bold text-slate-200">
                {numStations} <span className="text-slate-500 font-normal">/</span> {numLines} <span className="text-slate-500 font-normal">/</span> {numTrains}
              </p>
            </div>
          </div>
        </div>

        {/* Game clock & Tick Velocity Controllers */}
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 py-1.5 px-3 rounded-xl" id="time-scaler">
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-300 mr-2 border-r border-white/10 pr-3">
            <Clock className="w-4 h-4 text-indigo-505" />
            <span>DAY {gameState.day} • {gameState.hour.toString().padStart(2, '0')}:{gameState.minute.toString().padStart(2, '0')}</span>
          </div>

          <div className="flex items-center gap-1" id="speed-buttons-list">
            {[
              { val: 0, icon: <Pause className="w-3 h-3" />, label: "Pause" },
              { val: 1, icon: <Play className="w-3 h-3" />, label: "1x" },
              { val: 2, icon: <ChevronsRight className="w-3 h-3" />, label: "2x" },
              { val: 3, icon: <Zap className="w-2.5 h-2.5" />, label: "3x" }
            ].map((btn) => {
              const isActive = gameState.timeSpeed === btn.val;
              return (
                <button
                  key={btn.val}
                  onClick={() => handleUpdateVelocity(btn.val)}
                  title={btn.label}
                  className={`p-1.5 rounded-lg text-xs leading-none transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-650 text-white'
                      : 'text-slate-550 hover:text-slate-100 hover:bg-white/10'
                  }`}
                  id={`speed-button-${btn.val}`}
                >
                  {btn.icon}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Outer Content Layout: 3 Columns Grid */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 p-5 min-h-0 bg-[#090A0C] overflow-y-auto lg:overflow-hidden" id="sandbox-grid-layout">
        
        {/* Left Column (Width: 3/12): City Settings, Statistics reports, tutorial links */}
        <section className="lg:col-span-3 flex flex-col gap-5 overflow-y-auto pr-1" id="left-sidebar-panel">
          
          {/* City Selection hub cards */}
          <CitySelector
            currentCityId={gameState.currentCityId}
            cities={gameState.cities}
            onSelectCity={handleSelectCityId}
            onCustomCityLoaded={handleCustomCityLoaded}
          />

          {/* District Census Report panel with Category, Density filters & Overlay controls */}
          <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 p-4 text-white shadow-xl flex flex-col gap-3.5" id="district-census-panel">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-100">
                  Censo Distrital
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDensity(!showDensity)}
                className={`px-2.5 py-1 rounded-lg text-[9px] font-mono font-bold uppercase leading-none transition-all border ${
                  showDensity
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-white/10 bg-white/5 text-slate-500'
                }`}
                title="Mostrar ou ocultar círculos de densidade e zoneamento no mapa"
              >
                {showDensity ? '🟢 Mapa: On' : '⚫ Mapa: Off'}
              </button>
            </div>

            {/* Category / Type filtering tabs */}
            <div className="flex flex-col gap-1.5 border-t border-white/5 pt-2.5">
              <span className="text-[9px] font-mono uppercase font-bold text-slate-400 tracking-wider">Filtrar por Zoneamento:</span>
              <div className="grid grid-cols-3 gap-1">
                {(['all', 'residential', 'commercial', 'leisure', 'industrial', 'tourism'] as const).map((t) => {
                  const active = districtTypeFilter === t;
                  const labelMap = {
                    all: 'Todas',
                    residential: 'Resid.',
                    commercial: 'Comerc.',
                    leisure: 'Lazer',
                    industrial: 'Indús.',
                    tourism: 'Turis.'
                  };
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setDistrictTypeFilter(t)}
                      className={`px-1.5 py-1 rounded text-[8.5px] font-mono capitalize transition-all border text-center ${
                        active
                          ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300 font-bold'
                          : 'bg-white/5 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10'
                      }`}
                    >
                      {labelMap[t]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Slider to filter by Minimum Density */}
            <div className="flex flex-col gap-1.5 border-t border-white/5 pt-2.5">
              <div className="flex justify-between items-center text-[9px] font-mono uppercase font-bold tracking-wider">
                <span className="text-slate-405">Densidade Mínima:</span>
                <span className="text-teal-400 font-extrabold">{minDensityFilter}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="90"
                step="5"
                value={minDensityFilter}
                onChange={(e) => setMinDensityFilter(parseInt(e.target.value))}
                className="w-full h-1 bg-slate-800 accent-emerald-500 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed font-sans mt-0.5 font-mono">
              Distritos e zonas de {currentCity.name}. Expande estações e trilhos perto das zonas ativas para gerar passageiros:
            </p>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1" id="districts-list">
              {currentCity.districts?.filter((d) => {
                if (districtTypeFilter !== 'all' && d.type !== districtTypeFilter) return false;
                if (d.density < minDensityFilter) return false;
                return true;
              }).map((d) => {
                const colors = {
                  commercial: 'text-blue-300 border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/40',
                  residential: 'text-emerald-300 border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/40',
                  leisure: 'text-amber-305 border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/40',
                  industrial: 'text-purple-305 border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10 hover:border-purple-500/40',
                  tourism: 'text-pink-305 border-pink-500/20 bg-pink-500/5 hover:bg-pink-500/10 hover:border-pink-500/40'
                };
                const style = colors[d.type] || 'text-slate-400 border-white/10 bg-white/5';
                const isHovered = activeDistrictId === d.id;

                return (
                  <div
                    key={d.id}
                    className={`p-2 rounded-xl border text-[10.5px] flex items-center justify-between font-sans transition-all cursor-pointer ${style} ${
                      isHovered
                        ? 'border-white/30 bg-white/10 scale-[1.02] shadow-md ring-1 ring-white/10'
                        : ''
                    }`}
                    onMouseEnter={() => setActiveDistrictId(d.id)}
                    onMouseLeave={() => setActiveDistrictId(null)}
                    onClick={() => {
                      if (mapInstanceRef.current) {
                        mapInstanceRef.current.setView([d.lat, d.lng], 13.5);
                        showToast(`📍 Centralizando em ${d.name}`);
                      }
                    }}
                    title="Clique para centralizar esta zona no mapa"
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full" style={{
                          backgroundColor: d.type === 'commercial' ? '#3b82f6' : d.type === 'residential' ? '#10b981' : d.type === 'leisure' ? '#f59e0b' : d.type === 'industrial' ? '#8b5cf6' : '#ec4899'
                        }}></span>
                        <p className="font-bold text-slate-200 truncate">{d.name}</p>
                      </div>
                      <p className="text-[8.5px] opacity-75 capitalize pl-2.5">{d.type} Zone</p>
                    </div>
                    <div className="text-right shrink-0 font-mono">
                      <p className="text-slate-250 font-bold">{(d.population / 1000).toLocaleString('pt-BR')}k hab</p>
                      <p className="text-[8px] opacity-75">Densidade: {d.density}%</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Collapsible Sandbox Controls Button */}
          <button
            type="button"
            onClick={() => setShowSandboxTools(!showSandboxTools)}
            className="w-full bg-slate-900/40 hover:bg-slate-900/80 border border-white/10 rounded-2xl p-3 text-slate-200 font-mono text-[11px] font-bold uppercase transition-all flex items-center justify-between shadow-lg cursor-pointer shrink-0"
            id="sandbox-toggle-button"
          >
            <div className="flex items-center gap-2">
              <span className="text-indigo-400">⚡</span>
              <span>Visual & Sandbox Saves</span>
            </div>
            <span className="text-[10px] text-indigo-400 font-extrabold">
              {showSandboxTools ? 'FECHAR ▲' : 'EXPANDIR ▼'}
            </span>
          </button>

          {showSandboxTools && (
            <div className="flex flex-col gap-5 animate-fade-in">
              {/* Rails Visual Styling Control Panel */}
              <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 p-4 text-white shadow-xl flex flex-col gap-3" id="rails-styling-panel">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-indigo-400 font-bold">🛣️</span>
                    <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-200">
                      Estilo dos Trilhos
                    </h3>
                  </div>
                  <span className="text-[9px] font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded uppercase font-bold text-center">
                    Visual
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                  Configure a curvatura das linhas de metrô no mapa e a trajetória das composições instantaneamente:
                </p>

                {/* Curvature Preset Fast buttons */}
                <div className="grid grid-cols-2 gap-2 mt-0.5">
                  <button
                    type="button"
                    onClick={() => setTrackCurvature(0.0)}
                    className={`py-1.5 px-2.5 text-xs font-mono rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      trackCurvature === 0.0
                        ? 'border-indigo-500/80 bg-indigo-500/20 text-indigo-300 font-bold'
                        : 'border-white/5 bg-white/5 hover:bg-white/10 text-slate-300'
                    }`}
                  >
                    <span>📏</span> Reto
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrackCurvature(0.08)}
                    className={`py-1.5 px-2.5 text-xs font-mono rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      trackCurvature === 0.08
                        ? 'border-indigo-500/80 bg-indigo-500/20 text-indigo-300 font-bold'
                        : 'border-white/5 bg-white/5 hover:bg-white/10 text-slate-300'
                    }`}
                  >
                    <span>➰</span> Curvo
                  </button>
                </div>

                {/* Range Slider for complete control */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                    <span>Curvatura dos Trilhos:</span>
                    <span className="text-indigo-300 font-bold">{(trackCurvature * 125).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.00"
                    max="0.16"
                    step="0.02"
                    value={trackCurvature}
                    onChange={(e) => setTrackCurvature(parseFloat(e.target.value))}
                    className="w-full accent-indigo-500 bg-slate-850 cursor-pointer h-1.5 rounded-lg appearance-none"
                    id="track-curvature-range"
                  />
                  <div className="flex justify-between text-[8px] font-mono text-slate-500 uppercase tracking-widest leading-none">
                    <span>Totalmente Reto</span>
                    <span>Max Curvatura</span>
                  </div>
                </div>

                {/* Dynamic visual indicator text based on current value */}
                <div className="bg-white/5 border border-white/5 rounded-xl p-2 flex items-center gap-2">
                  <span className="text-sm">
                    {trackCurvature === 0.0 ? '📏' : trackCurvature <= 0.04 ? '🍃' : trackCurvature <= 0.10 ? '➰' : '🌊'}
                  </span>
                  <div className="flex-1">
                    <p className="text-[11px] font-bold text-slate-200">
                      {trackCurvature === 0.0
                        ? 'Estilo Retilíneo Tradicional'
                        : trackCurvature <= 0.04
                        ? 'Curvatura Suave (Moderna)'
                        : trackCurvature <= 0.10
                        ? 'Curvatura Orgânica Curva'
                        : 'Curvatura Sinuosa Estreita'}
                    </p>
                    <p className="text-[9px] text-slate-400 leading-none mt-0.5">
                      Trilhos desenhados em {trackCurvature === 0.0 ? 'linhas retas diretivas' : `curvas de Bézier de ${(trackCurvature * 125).toFixed(0)}% de amplitude`}.
                    </p>
                  </div>
                </div>
              </div>

              {/* Persistent Sandbox Saves Control Panel */}
              <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 p-4 text-white shadow-xl flex flex-col gap-3" id="sandbox-saves-panel">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">💾</span>
                    <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-200">
                      Save Sandbox
                    </h3>
                  </div>
                  <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded uppercase font-bold">
                    Persistent
                  </span>
                </div>
                
                {/* Save current game action */}
                <form onSubmit={handleSaveGame} className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-slate-400 font-sans">Save Slot Name:</label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="e.g. Meu Metrô SP"
                      value={saveSlotName}
                      onChange={(e) => setSaveSlotName(e.target.value)}
                      className="flex-1 bg-black/40 border border-white/10 rounded-lg py-1 px-2.5 text-xs text-slate-100 placeholder:text-slate-600 font-mono outline-none focus:border-emerald-500/40"
                      id="sandbox-save-name-input"
                    />
                    <button
                      type="submit"
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs px-3 rounded-lg flex items-center justify-center transition-colors cursor-pointer shrink-0"
                      id="sandbox-save-btn"
                    >
                      Save
                    </button>
                  </div>
                </form>

                {/* List of server saves */}
                <div className="space-y-1.5">
                  <p className="text-[10px] text-slate-400 font-sans flex items-center gap-1">
                    <span>📂</span> Saved Slots on Server:
                  </p>
                  {serverSaves.length === 0 ? (
                    <p className="text-[10px] text-slate-500 italic py-1 font-sans">
                      No saves recorded in this session yet.
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1" id="saves-selector-list">
                      {serverSaves.map((save) => (
                        <div
                          key={save.id}
                          className="bg-white/5 border border-white/5 hover:border-white/10 rounded-lg p-2 flex flex-col gap-1 text-[11px] transition-all"
                        >
                          <div className="flex justify-between items-start">
                            <span className="font-bold text-slate-200 truncate pr-2">{save.name}</span>
                            <button
                              onClick={() => handleLoadGame(save.id)}
                              className="bg-indigo-600 hover:bg-indigo-500 text-[9px] text-white font-mono font-bold py-0.5 px-1.5 rounded transition-colors cursor-pointer"
                            >
                              Load
                            </button>
                          </div>
                          <div className="flex justify-between text-[9px] text-slate-400 font-mono leading-none">
                            <span>🏷️ {save.cityName}</span>
                            <span>💰 ${save.budget.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-[8px] text-slate-500 font-mono leading-none border-t border-white/5 pt-1">
                            <span>🕒 {save.timestamp}</span>
                            <span>Stops: {save.stationsCount}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Portability Controls (JSON File downloads, local browser recovery fallback) */}
                <div className="flex flex-col gap-1.5 border-t border-white/5 pt-2.5">
                  <p className="text-[10px] text-slate-400 font-sans">Portability & Recoveries:</p>
                  
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={handleExportSaveToJson}
                      className="bg-white/5 hover:bg-white/10 border border-white/10 hover:text-white rounded-lg p-1.5 text-[10px] font-mono flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      title="Download game session as JSON file to your computer"
                    >
                      📤 Export Save
                    </button>
                    <label
                      className="bg-white/5 hover:bg-white/10 border border-white/10 hover:text-white rounded-lg p-1.5 text-[10px] font-mono flex items-center justify-center gap-1 transition-colors cursor-pointer text-center"
                      title="Upload in-game save files directly"
                    >
                      📥 Import Save
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImportSaveFromJson}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={handleLoadLastLocalSave}
                    className="w-full bg-indigo-500/10 hover:bg-indigo-555/20 border border-indigo-500/30 font-bold transition-all text-[11px] text-indigo-300 rounded-lg py-1 px-2.5 text-center cursor-pointer"
                    title="Restore state from browser localStorage redundancy"
                  >
                    🔄 Restore Auto-Backup (Browser Cache)
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white/5 p-3 rounded-xl border border-white/10 flex items-center gap-2.5 text-xs text-slate-400 hover:text-slate-200 transition-colors pointer-events-auto" id="tutorial-card">
            <HelpCircle className="w-5 h-5 text-indigo-400 shrink-0" />
            <div>
              <p className="font-bold">Need assistance?</p>
              <button onClick={() => setShowTutorial(true)} className="text-[10px] underline text-indigo-400 block text-left">
                Read building mechanics again
              </button>
            </div>
          </div>
        </section>

        {/* Center Column (Width: 6/12): Physical Geolocation simulator Map with canvas tools overlay */}
        <section className="lg:col-span-6 flex flex-col gap-4 min-h-[500px] lg:min-h-0" id="center-map-container">
          
          {/* Mapping canvas and overlay selector bar */}
          <div className="flex-1 bg-[#090A0C] border border-white/10 rounded-3xl overflow-hidden relative shadow-2xl flex flex-col" id="map-wrap">
            
            {/* Overlay tool controls */}
            <div className="absolute top-4 left-4 right-4 z-[500] bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-2.5 flex justify-between items-center gap-3 text-slate-200 shadow-xl" id="overlay-tool-bar">
              <div className="flex items-center gap-2 text-xs font-bold font-mono text-slate-200">
                <span className="w-2.5 h-2.5 bg-indigo-505 rounded-full animate-ping"></span>
                <span>Active Builder mode:</span>
              </div>
              
              <div className="flex items-center gap-1.5" id="mode-selectors">
                {[
                  { mode: 'select', text: '🔍 Inspect Pins', style: 'hover:bg-white/10' },
                  { mode: 'build-station', text: '🔨 Build Station ($150k)', style: 'bg-emerald-555/10 border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-200 font-bold' },
                  { mode: 'edit-line-tracks', text: '✏️ Edit Tracks', style: 'bg-indigo-555/10 border-indigo-500/20 hover:bg-indigo-500/20 text-indigo-200 font-bold' }
                ].map((actObj) => {
                  const isActive = buildMode === actObj.mode;
                  return (
                    <button
                      key={actObj.mode}
                      onClick={() => {
                        setBuildMode(actObj.mode as any);
                        setClickedPosition(null); // Clear click coordinate memory to prevent accidental stale triggers
                        setTrackExtensionSourceId(null); // Clear selection state
                        if (actObj.mode === 'edit-line-tracks') {
                          // Default select first line if available
                          const l = Object.keys(gameState.lines)[0];
                          if (l) setSelectedLineIdForTracks(l);
                        } else {
                          setSelectedLineIdForTracks(null);
                        }
                      }}
                      className={`text-[10px] font-mono font-bold uppercase py-1.5 px-3 rounded-xl border transition-all cursor-pointer ${
                        isActive
                          ? 'bg-indigo-650 text-white border-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.25)]'
                          : `bg-black/40 border-white/10 text-slate-400 ${actObj.style}`
                      }`}
                      id={`mode-button-${actObj.mode}`}
                    >
                      {actObj.text}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Editing tracks secondary panel option */}
            {buildMode === 'edit-line-tracks' && (
              <div className="absolute top-20 left-4 z-[500] bg-black/80 backdrop-blur-xl border border-indigo-500/30 rounded-xl p-2.5 text-xs flex items-center gap-3 shadow-lg animate-fade-in" id="line-track-builder-options">
                <span className="font-semibold text-indigo-300 font-mono text-[10px]">Active Line:</span>
                <select
                  value={selectedLineIdForTracks || ''}
                  onChange={(e) => {
                    setSelectedLineIdForTracks(e.target.value);
                    setTrackExtensionSourceId(null);
                  }}
                  className="bg-black border border-white/10 rounded px-2.5 py-1 text-xs text-white outline-none font-mono focus:border-indigo-550"
                  id="line-track-select"
                >
                  {(Object.values(gameState.lines) as Line[]).map(line => (
                    <option key={line.id} value={line.id}>
                      {line.name} ({line.stationIds.length} stops)
                    </option>
                  ))}
                </select>
                <div className="text-[10px] text-slate-400 font-sans border-l border-white/10 pl-3">
                  💡 <span className="font-bold text-slate-200 uppercase">Fluxo de Construção:</span> Clique em uma estação da linha para definir a <span className="text-amber-400 font-bold">Origem</span>, depois no <span className="text-indigo-400 font-bold">Destino</span> para estender!
                </div>
              </div>
            )}

            {/* Map Viewport Area */}
            <div ref={mapContainerRef} className="w-full flex-1 z-10" id="leaflet-element-holder" />

            {/* Custom empty space map click popups station building input name modal */}
            {showStationModal && clickedPosition && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] bg-black/95 backdrop-blur-xl border border-white/15 rounded-2xl p-4.5 max-w-sm w-full shadow-2xl flex flex-col gap-3.5 text-slate-300 animate-zoom-in" id="station-building-modal">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
                    🏗️ Lay Station Platform
                  </h4>
                  <button onClick={() => { setShowStationModal(false); setClickedPosition(null); }} className="text-slate-550 hover:text-slate-200 cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-1 text-xs">
                  <span className="text-slate-400 font-sans">Geographic Coordinates:</span>
                  <p className="font-mono text-[10px] opacity-75">{clickedPosition[0].toFixed(5)}°N, {clickedPosition[1].toFixed(5)}°W</p>
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-sans mb-1.5 block">Assign Station Station Name:</label>
                  <input
                    type="text"
                    value={stationFormName}
                    onChange={(e) => setStationFormName(e.target.value)}
                    className="w-full bg-black/40 border border-white/15 text-xs rounded-lg p-2 text-slate-100 font-mono focus:outline-none focus:border-indigo-550"
                    id="new-station-name-input"
                  />
                </div>
                <div className="flex gap-2 text-xs">
                  <button
                    onClick={() => { setShowStationModal(false); setClickedPosition(null); }}
                    className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 p-2 rounded-xl text-slate-400 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBuildStationSubmit}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 font-bold p-2 rounded-xl text-white shadow transition-transform cursor-pointer"
                    id="confirm-build-station"
                  >
                    Build ($150k)
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Right Column (Width: 3/12): Subway Line Legend lists, Economics budget manager, Gemini Expert advising */}
        <section className="lg:col-span-3 flex flex-col gap-5 overflow-y-auto pr-1" id="right-sidebar-panel">
          
          {/* Subways Lines Lists Legend column */}
          <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 p-4 text-white shadow-xl flex flex-col gap-3" id="legend-metro-card">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <Navigation className="w-4 h-4 text-indigo-400" />
                Transit Lines
              </h3>
              <span className="text-[10px] font-mono text-slate-500 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded">
                Legend
              </span>
            </div>

            {/* List existing lines and actions */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1" id="active-lines-legend-list">
              {Object.keys(gameState.lines).length === 0 ? (
                <div className="text-center text-slate-650 italic py-6 text-xs">Click establish brand below to map out tracks!</div>
              ) : (
                (Object.values(gameState.lines) as Line[]).map((line) => {
                  const isCurMatch = selectedLineId === line.id;
                  return (
                    <div
                      key={line.id}
                      onClick={() => {
                        setSelectedLineId(isCurMatch ? null : line.id);
                        setSelectedStationId(null);
                      }}
                      className={`p-2.5 rounded-xl border text-xs flex flex-col gap-2 cursor-pointer transition-all ${
                        isCurMatch
                          ? 'bg-black/60 border-indigo-500/50 shadow-[0_0_12px_rgba(99,102,241,0.15)]'
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                      }`}
                      id={`line-legend-${line.id}`}
                    >
                      {/* Name tag and dots indicators */}
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full block shrink-0" style={{ backgroundColor: line.color }}></span>
                          <span className="font-mono font-bold text-slate-100">{line.name}</span>
                        </div>
                        <span className="text-[8px] font-mono uppercase tracking-wider bg-black/40 text-slate-450 rounded-md py-0.5 px-1.5 h-4 flex items-center shrink-0">
                          {line.type}
                        </span>
                      </div>

                      {/* Summary details */}
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                        <span>{line.stationIds.length} Platforms connected</span>
                        <div className="flex items-center gap-2">
                           <input 
                              type="color" 
                              value={line.color} 
                              onChange={(e) => {
                                e.stopPropagation();
                                handleUpdateLine(line.id, line.name, e.target.value);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 rounded cursor-pointer border-none bg-transparent"
                              title="Alterar cor da linha"
                           />
                           <span className="text-indigo-400 font-bold underline">Configure</span>
                        </div>
                      </div>

                      {line.statistics && (
                        <div className="flex flex-wrap gap-4 mt-1 border-t border-white/5 pt-1.5 text-[9px] font-mono">
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3 h-3 text-slate-500" />
                            <span className="text-emerald-400 font-bold">{line.statistics.totalPassengersCarried.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Activity className="w-3 h-3 text-slate-500" />
                            <span className="text-indigo-400 font-bold">{line.statistics.currentTrainsCount} trains</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <DollarSign className="w-3 h-3 text-slate-500" />
                            <span className="text-amber-400 font-bold">${line.statistics.dailyRevenue.toLocaleString()}</span>
                          </div>
                        </div>
                      )}

                      {/* Actions drawer if currently clicked match */}
                      {isCurMatch && (
                        <div className="border-t border-white/5 pt-2.5 mt-1 flex flex-col gap-2.5 text-[10px]" id={`line-actions-${line.id}`}>
                          {/* Option to configure custom locomotive and deploy */}
                          <div className="bg-slate-950/60 p-3 rounded-xl border border-white/10 flex flex-col gap-3" onClick={(e) => { e.stopPropagation(); }} id={`configurator-train-${line.id}`}>
                            <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                              <span className="font-mono text-[10px] uppercase font-bold text-indigo-400">⚡ Configurar Trem</span>
                              <span className="text-[9px] text-slate-400 bg-white/5 px-1.5 py-0.5 rounded font-mono font-bold">Sandbox</span>
                            </div>

                            {/* Nickname input */}
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] uppercase tracking-wider text-slate-400 font-mono font-bold">Apelido do Trem:</label>
                              <input
                                type="text"
                                placeholder={`ex: Express #${Math.floor(100 + Math.random() * 900)}`}
                                value={newTrainNickname}
                                onChange={(e) => setNewTrainNickname(e.target.value)}
                                className="bg-black/80 border border-white/10 text-[9px] font-mono rounded-md py-1 px-2 text-slate-200 focus:outline-none focus:border-indigo-550"
                              />
                            </div>

                            {/* Train Capacity Slider */}
                            <div className="flex flex-col gap-1">
                              <div className="flex justify-between text-[9px] uppercase tracking-wider text-slate-450 font-mono">
                                <span>Capacidade:</span>
                                <span className="text-emerald-400 font-bold font-mono">{newTrainCapacity} passageiros</span>
                              </div>
                              <input
                                type="range"
                                min="40"
                                max="450"
                                step="10"
                                value={newTrainCapacity}
                                onChange={(e) => setNewTrainCapacity(parseInt(e.target.value))}
                                className="w-full accent-indigo-500 bg-slate-800 h-1 rounded-sm appearance-none cursor-pointer"
                              />
                              <div className="flex justify-between text-[8px] text-slate-500 font-mono opacity-80 leading-snug">
                                <span>VLT (40)</span>
                                <span>Metrô (150)</span>
                                <span>Mega (450)</span>
                              </div>
                            </div>

                            {/* Train Speed Slider */}
                            <div className="flex flex-col gap-1">
                              <div className="flex justify-between text-[9px] uppercase tracking-wider text-slate-455 font-mono">
                                <span>Velocidade Máxima:</span>
                                <span className="text-indigo-400 font-bold font-mono">{newTrainSpeed} km/h</span>
                              </div>
                              <input
                                type="range"
                                min="50"
                                max="160"
                                step="10"
                                value={newTrainSpeed}
                                onChange={(e) => setNewTrainSpeed(parseInt(e.target.value))}
                                className="w-full accent-indigo-500 bg-slate-800 h-1 rounded-sm appearance-none cursor-pointer"
                              />
                              <div className="flex justify-between text-[8px] text-slate-500 font-mono opacity-80 leading-snug">
                                <span>Lento (50)</span>
                                <span>Padrão (80)</span>
                                <span>Rápido (160)</span>
                              </div>
                            </div>

                            {/* Dynamic Calculated Cost & Action Button */}
                            <div className="flex items-center justify-between border-t border-white/5 pt-2.5 mt-1 bg-indigo-500/5 -mx-3 -mb-3 p-3 rounded-b-xl">
                              <div className="flex flex-col">
                                <span className="text-[8px] text-slate-500 uppercase font-mono font-bold">Investimento</span>
                                <span className="text-xs font-bold text-emerald-400 font-mono">
                                  ${(20000 + newTrainCapacity * 100 + newTrainSpeed * 80).toLocaleString()}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleDeployTrain(line.id); }}
                                disabled={line.stationIds.length < 2 || gameState.economy.budget < (20000 + newTrainCapacity * 100 + newTrainSpeed * 80)}
                                className={`font-mono text-[9px] uppercase font-bold px-2.5 py-1.5 rounded-lg text-white shadow transition-all active:scale-95 cursor-pointer flex items-center gap-1 ${
                                  line.stationIds.length >= 2 && gameState.economy.budget >= (20000 + newTrainCapacity * 100 + newTrainSpeed * 80)
                                    ? 'bg-emerald-600 hover:bg-emerald-500 hover:shadow-emerald-500/10'
                                    : 'bg-slate-700 opacity-40 cursor-not-allowed'
                                }`}
                              >
                                🚆 Deploy Train
                              </button>
                            </div>
                          </div>

                          {/* Options layout for line track wipers */}
                          <div className="grid grid-cols-2 gap-2 text-[9px] font-bold uppercase">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleClearLineStations(line.id); }}
                              disabled={line.stationIds.length === 0}
                              className="bg-white/5 border border-white/10 hover:bg-white/10 p-1.5 rounded-lg text-slate-450 hover:text-slate-200 transition-colors cursor-pointer disabled:opacity-40"
                            >
                              Clear Tracks
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleDeleteLine(line.id); }}
                              className="bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/20 p-1.5 rounded-lg text-rose-355 hover:text-rose-100 transition-colors cursor-pointer"
                            >
                              Scrap Line
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Create brand new subway line form */}
            <form
              onSubmit={(e) => { e.preventDefault(); handleCreateLine(); }}
              className="bg-white/5 rounded-xl p-3 border border-white/10 flex flex-col gap-2.5 mt-1"
              id="establish-line-form"
            >
              <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                Establish Brand New Line
              </h4>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="e.g., Manhattan Express"
                  value={newLineName}
                  onChange={(e) => setNewLineName(e.target.value)}
                  className="flex-1 bg-black/40 border border-white/10 text-[10px] rounded-lg p-2 text-slate-200 font-sans focus:outline-none focus:border-indigo-505"
                  id="new-line-name"
                />
                
                <div className="relative group">
                  <input
                    type="color"
                    value={newLineColor}
                    onChange={(e) => setNewLineColor(e.target.value)}
                    className="w-10 h-8 rounded-lg bg-black border border-white/10 cursor-pointer p-1"
                    id="new-line-color"
                    title="Selecione a cor da linha"
                  />
                </div>
              </div>

              {/* Rails mapping types selector */}
              <div className="flex gap-2 text-[9px] font-mono text-slate-405" id="rail-type-selection">
                {['underground', 'elevated', 'highspeed'].map((typeVal) => (
                  <label key={typeVal} className="flex-1 flex items-center justify-center gap-1 bg-black/40 border border-white/10 p-1.5 rounded-lg cursor-pointer capitalize hover:text-white transition-colors">
                    <input
                      type="radio"
                      name="railType"
                      checked={newLineType === typeVal}
                      onChange={() => setNewLineType(typeVal as any)}
                      className="accent-indigo-500"
                    />
                    <span>{typeVal}</span>
                  </label>
                ))}
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-550 text-white font-bold font-mono text-[10px] uppercase p-2 rounded-xl transition-all shadow-md cursor-pointer text-center"
                id="establish-new-line-submit"
              >
                Establish Line ($50,000)
              </button>
            </form>
          </div>

          {/* Active object Inspector (Station / Train) details panel */}
          {selectedStationId && gameState.stations[selectedStationId] && (
            <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 p-4 text-white shadow-xl flex flex-col gap-3.5 relative" id="object-details-inspector">
              <button
                onClick={() => setSelectedStationId(null)}
                className="absolute top-4 right-4 text-slate-550 hover:text-white cursor-pointer"
                id="close-inspector"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-2">
                <MapIcon className="w-4 h-4 text-emerald-400 animate-pulse" />
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                  Station Inspector
                </h3>
              </div>

              {/* Load active inspection */}
              {(() => {
                const station = gameState.stations[selectedStationId] as Station;
                const totalWaiting = (Object.values(station.waitingPassengers) as number[]).reduce((a, b) => a + b, 0);
                const upgradeFee = station.upgradeLevel * 75000;
                
                return (
                  <div className="space-y-4 text-xs font-sans text-slate-300" id={`inspector-details-${station.id}`}>
                    <div>
                      <h4 className="text-base font-bold text-white mb-0.5">{station.name}</h4>
                      <p className="text-[10px] text-slate-500 font-mono">Platform ID: {station.id.split('-')[1]}</p>
                    </div>

                    {/* Operational levels progress sheets */}
                    <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-3" id="operational-spec-grid">
                      <div>
                        <span className="text-slate-500 text-[10px]">PASSENGER CONGESTION</span>
                        <p className="font-mono text-slate-100 font-bold leading-relaxed">{totalWaiting} / {station.capacity} Max</p>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px]">MAINTENANCE LEVEL</span>
                        <p className={`font-mono font-bold leading-relaxed ${station.maintenanceLevel < 35 ? 'text-rose-400 animate-pulse font-extrabold' : 'text-slate-100'}`}>
                          {station.maintenanceLevel.toFixed(0)}%
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px]">TICKET GATES SPEED</span>
                        <p className="font-mono text-slate-100 font-bold leading-relaxed">{station.ticketGatesCount} Active gates</p>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px]">PLATFORM COMFORT</span>
                        <p className="font-mono text-slate-100 font-bold leading-relaxed">{station.platformWidth.toFixed(1)}m width</p>
                      </div>
                    </div>

                    {/* Breakdown destinations waiting lists */}
                    <div className="bg-white/5 p-2.5 rounded-xl border border-white/10" id="commuter-route-breakdowns">
                      <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wide mb-1.5 font-bold">Waiting Commuter Destinations</p>
                      {Object.keys(station.waitingPassengers).length === 0 ? (
                        <p className="italic text-slate-650 text-[10px]">No travelers waiting yet. Ensure active trains run across connections!</p>
                      ) : (
                        <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                          {Object.keys(station.waitingPassengers).map((tId) => {
                            const trg = gameState.stations[tId];
                            const cnt = station.waitingPassengers[tId];
                            if (cnt === 0) return null;
                            return (
                              <div key={tId} className="flex justify-between items-center text-[10px] font-mono border-b border-white/5 pb-1">
                                <span className="text-slate-400">➡ {trg?.name || 'End Terminal'}</span>
                                <span className="font-bold text-amber-300 bg-amber-500/5 border border-amber-500/10 px-1 py-0.5 rounded">{cnt} waiting</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Inspection upgrades Actions button arrays */}
                    <div className="space-y-2 pt-2.5 border-t border-white/5 text-[10px] uppercase font-bold text-center" id="station-inspector-controls">
                      {/* Upgrade gates capacity */}
                      <button
                        onClick={() => handleUpgradeStation(station.id)}
                        disabled={station.upgradeLevel >= 5}
                        className="w-full bg-indigo-650 hover:bg-indigo-550 disabled:opacity-30 text-white font-mono p-2 rounded-xl border border-indigo-500/30 transition-all cursor-pointer hover:border-indigo-400"
                        id="upgrade-platform-button"
                      >
                        {station.upgradeLevel >= 5 ? 'MAX LEVEL REACHED' : `Upgrade Platform ($${upgradeFee.toLocaleString()})`}
                      </button>

                      {/* Run platform maintenance cleanup Crew */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleMaintenanceStation(station.id)}
                          disabled={station.maintenanceLevel >= 95}
                          className="bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-45 text-slate-300 py-1.5 px-2.5 rounded-xl transition-all cursor-pointer"
                        >
                          Maintain Hub ($5k)
                        </button>
                        <button
                          onClick={() => handleDeleteStation(station.id)}
                          className="bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/20 text-rose-355 hover:text-rose-100 py-1.5 px-2.5 rounded-xl transition-all cursor-pointer"
                        >
                          Dismantle Hub
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Core game economics balance sheet panel component */}
          <EconomyPanel
            economy={gameState.economy}
            onUpdateTicketPrice={handleUpdateTicketPrice}
            onTakeLoan={handleTakeLoan}
            onRepayLoan={handleRepayLoan}
          />

          {/* Scrolling citizens tweets commentary and AI Strategy advisor */}
          <div className="flex flex-col gap-2 shrink-0">
            <button
              onClick={() => setShowSocialFeed(!showSocialFeed)}
              className="w-full bg-slate-900/40 hover:bg-slate-900/80 border border-white/5 rounded-xl p-2 text-[10px] font-mono font-bold uppercase text-slate-400 flex items-center justify-between transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Users className="w-3 h-3 text-indigo-400" />
                <span>City Social Feed</span>
              </div>
              <span className="text-[10px] opacity-60">{showSocialFeed ? 'Hide' : 'Expand'}</span>
            </button>
            
            <AnimatePresence>
              {showSocialFeed && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <SocialFeed
                    posts={gameState.citizenPosts}
                    events={gameState.activeEvents}
                    aiReport={aiReport}
                    loadingAi={loadingAi}
                    onTriggerAi={handleTriggerGeminiAdvisor}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

      </main>
    </div>
  );
}
