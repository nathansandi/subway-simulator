import React, { useState, useEffect, useRef } from 'react';
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
  const [aiReport, setAiReport] = useState<string | null>(null);

  // Active instructions card overlay
  const [showTutorial, setShowTutorial] = useState(true);

  // Save/Load state integration
  const [saveSlotName, setSaveSlotName] = useState('');
  const [serverSaves, setServerSaves] = useState<any[]>([]);

  // Track rendering style: 0.0 is straight, and up to 0.16 is curved
  const [trackCurvature, setTrackCurvature] = useState<number>(0.08);

  // Density Overlay and District Filter controls
  const [showDensity, setShowDensity] = useState(true);
  const [districtTypeFilter, setDistrictTypeFilter] = useState<'all' | 'residential' | 'commercial' | 'leisure' | 'industrial' | 'tourism'>('all');
  const [minDensityFilter, setMinDensityFilter] = useState<number>(0);

  // Sandbox tools visibility (collapsed by default to keep Left Side Panel extremely clean)
  const [showSandboxTools, setShowSandboxTools] = useState(false);

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

  // 2. Leaflet Map setup and dynamic refresh with Mapbox layers
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

      // Mapbox Dark high-resolution tile layer with token from environment
      const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
      L.tileLayer(`https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/512/{z}/{x}/{y}?access_token=${mapboxToken}`, {
        attribution: '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        tileSize: 512,
        zoomOffset: -1,
        maxZoom: 18,
        minZoom: 9
      }).addTo(map);

      // Create overlay feature group layer
      const overlayLayer = L.featureGroup().addTo(map);

      overlayLayerRef.current = overlayLayer;
      mapInstanceRef.current = map;

      // Click to build event hook
      map.on('click', (e: L.LeafletMouseEvent) => {
        // We only trigger station modal placement if actively in build-station mode
        setClickedPosition([e.latlng.lat, e.latlng.lng]);
      });

      // Invalidate map scale to force container size refresh and prevent blank rendering
      setTimeout(() => {
        map.invalidateSize();
      }, 150);
      setTimeout(() => {
        map.invalidateSize();
      }, 800);
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
        showToast("💡 Pro-Tip: To build a station, click '🔨 Build Station ($150k)' in the map overlay first, then click on the map!");
        setClickedPosition(null);
      } else {
        setClickedPosition(null);
      }
    }
  }, [clickedPosition, buildMode]);

  // Vector render recalculator whenever gameState modifies
  useEffect(() => {
    const map = mapInstanceRef.current;
    const overlay = overlayLayerRef.current;
    if (!map || !overlay || !gameState) return;

    // Clear old tracks, trains, districts
    overlay.clearLayers();

    const city = gameState.cities[gameState.currentCityId];
    if (!city) return;

    // Bezier curve calculations for organic/flexible visuals
    const getBezierCurvePoints = (
      p1: [number, number],
      p2: [number, number],
      numSteps: number = 24
    ): [number, number][] => {
      const isOrdered = p1[0] < p2[0] || (p1[0] === p2[0] && p1[1] < p2[1]);
      const start = isOrdered ? p1 : p2;
      const end = isOrdered ? p2 : p1;

      const dy = end[0] - start[0];
      const dx = end[1] - start[1];
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist === 0) return [p1, p2];

      const ny = -dx / dist;
      const nx = dy / dist;
      
      const curvature = trackCurvature; // Subtle organic curves for flexible tracks
      const offsetAmount = dist * curvature;

      const cpLat = (start[0] + end[0]) / 2 + ny * offsetAmount;
      const cpLng = (start[1] + end[1]) / 2 + nx * offsetAmount;

      const bezierPoints: [number, number][] = [];
      for (let s = 0; s <= numSteps; s++) {
        const t = s / numSteps;
        const mt = 1 - t;

        const lat = mt * mt * p1[0] + 2 * mt * t * cpLat + t * t * p2[0];
        const lng = mt * mt * p1[1] + 2 * mt * t * cpLng + t * t * p2[1];
        bezierPoints.push([lat, lng]);
      }

      return bezierPoints;
    };

    // A. Draw green, blue, yellow District semi-opaque circular domains with real-world scales & dynamic pulsing/interaction
    if (showDensity) {
      city.districts.forEach((dist) => {
        // Category filtering
        if (districtTypeFilter !== 'all' && dist.type !== districtTypeFilter) return;
        // Density threshold filtering
        if (dist.density < minDensityFilter) return;

        const colorMap = {
        commercial: '#3b82f6', // blue
        residential: '#10b981', // green
        leisure: '#f59e0b', // gold/orange
        industrial: '#8b5cf6', // purple
        tourism: '#ec4899' // pink
      };
      const color = colorMap[dist.type] || '#64748b';

      // Calculate dynamic simulated activity coefficient based on hour
      const hour = gameState.hour;
      let activityFactor = 1.0;
      let statusDesc = 'Fluxo Normal';
      if (dist.type === 'residential') {
        if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
          activityFactor = 1.8;
          statusDesc = 'Pico de Deslocamento Morning/Evening Rush';
        } else if (hour >= 22 || hour <= 5) {
          activityFactor = 0.4;
          statusDesc = 'Período Silencioso Noturno';
        }
      } else if (dist.type === 'commercial' || dist.type === 'industrial') {
        if (hour >= 9 && hour <= 17) {
          activityFactor = 1.5;
          statusDesc = 'Horário Comercial Ativo';
        } else if (hour >= 20 || hour <= 6) {
          activityFactor = 0.3;
          statusDesc = 'Fora do Horário Ativo';
        }
      } else if (dist.type === 'leisure' || dist.type === 'tourism') {
        if (hour >= 11 && hour <= 21) {
          activityFactor = 1.7;
          statusDesc = 'Pico de Movimento de Lazer';
        } else if (hour >= 23 || hour <= 8) {
          activityFactor = 0.2;
          statusDesc = 'Atração Fechada';
        }
      }

      const isHovered = activeDistrictId === dist.id;

      // Pulse calculations (creates a beautiful breathing ambient glow effect on tick/tick shifts)
      const baseFillOpacity = isHovered ? 0.24 : 0.08;
      const pulsingOpacity = baseFillOpacity + (Math.sin(Date.now() / 1500 + dist.lat) * 0.02);
      const finalFillOpacity = Math.max(0.04, Math.min(0.35, pulsingOpacity * activityFactor));

      // 1. Draw solid outer border with dash arrays representing sonar scanner
      const realRadiusMeters = dist.radius * 85000;

      const mainCircle = L.circle([dist.lat, dist.lng], {
        radius: realRadiusMeters,
        color: color,
        weight: isHovered ? 2.5 : 1.2,
        dashArray: isHovered ? '2,5' : '5,8',
        fillColor: color,
        fillOpacity: finalFillOpacity,
        interactive: true
      });

      // 2. Beautiful inner solid mini center core indicator
      const centerCore = L.circle([dist.lat, dist.lng], {
        radius: realRadiusMeters * 0.08,
        color: color,
        weight: 1.5,
        fillColor: color,
        fillOpacity: 0.5,
        interactive: false
      });

      // 3. Futuristic informative HTML Tooltip
      const activityPercentage = (activityFactor * 100).toFixed(0);
      const tooltipHtml = `
        <div class="p-2.5 font-mono text-[10px] text-white bg-slate-950/95 border border-white/10 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.5)] leading-relaxed min-w-[150px]">
          <div class="flex items-center gap-1.5 mb-1.5 border-b border-white/5 pb-1">
            <span class="w-2 h-2 rounded-full" style="background-color: ${color}"></span>
            <p class="font-bold text-[11px] text-slate-100 uppercase tracking-tight truncate">${dist.name}</p>
          </div>
          <div class="space-y-1 text-slate-300">
            <p><span class="opacity-50">Zona:</span> <span class="capitalize font-sans font-bold" style="color: ${color}">${dist.type}</span></p>
            <p><span class="opacity-50">População:</span> <span class="text-slate-100 font-bold">${(dist.population).toLocaleString('pt-BR')} hab</span></p>
            <p><span class="opacity-50">Densidade:</span> <span class="text-slate-100 font-bold">${dist.density}%</span></p>
            <p><span class="opacity-50">Atividade:</span> <span class="text-amber-400 font-bold font-sans">${activityPercentage}% (${statusDesc})</span></p>
          </div>
          <p class="text-[8px] opacity-40 italic mt-2 border-t border-white/5 pt-1 text-center font-sans">Clique para focar câmera</p>
        </div>
      `;

      mainCircle.bindTooltip(tooltipHtml, {
        sticky: true,
        className: 'custom-district-tooltip',
        opacity: 0.98
      });

      // Set interactive handlers to highlight in LHS Zonal Census list card & fly camera
      mainCircle.on('mouseover', () => {
        setActiveDistrictId(dist.id);
      });
      mainCircle.on('mouseout', () => {
        setActiveDistrictId(null);
      });
      mainCircle.on('click', () => {
        map.flyTo([dist.lat, dist.lng], 13.5);
        showToast(`📍 Focando em ${dist.name}`);
      });

      mainCircle.addTo(overlay);
      centerCore.addTo(overlay);
    });
  }

    // B. Collect station segments to offset overlapping lines beautifully (dynamic parallel tracks)
    const segmentToLinesMap: { [key: string]: string[] } = {};
    const getSegmentKey = (id1: string, id2: string) => id1 < id2 ? `${id1}_${id2}` : `${id2}_${id1}`;

    (Object.values(gameState.lines) as Line[]).forEach((line) => {
      if (!line.isActive || line.stationIds.length < 2) return;
      for (let i = 0; i < line.stationIds.length - 1; i++) {
        const id1 = line.stationIds[i];
        const id2 = line.stationIds[i + 1];
        const key = getSegmentKey(id1, id2);
        if (!segmentToLinesMap[key]) {
          segmentToLinesMap[key] = [];
        }
        if (!segmentToLinesMap[key].includes(line.id)) {
          segmentToLinesMap[key].push(line.id);
        }
      }
    });

    Object.keys(segmentToLinesMap).forEach((key) => {
      segmentToLinesMap[key].sort();
    });

    // Draw metro route colored Polylines segment-by-segment with visual offsets
    (Object.values(gameState.lines) as Line[]).forEach((line) => {
      if (!line.isActive || line.stationIds.length < 2) return;
      
      for (let i = 0; i < line.stationIds.length - 1; i++) {
        const s1 = gameState.stations[line.stationIds[i]] as Station;
        const s2 = gameState.stations[line.stationIds[i + 1]] as Station;
        if (!s1 || !s2) continue;

        const key = getSegmentKey(s1.id, s2.id);
        const sharedLines = segmentToLinesMap[key] || [];
        const index = sharedLines.indexOf(line.id);
        const N = sharedLines.length;

        let p1: [number, number] = [s1.lat, s1.lng];
        let p2: [number, number] = [s2.lat, s2.lng];

        if (N > 1 && index !== -1) {
          const dy = s2.lat - s1.lat;
          const dx = s2.lng - s1.lng;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            const ny = -dx / dist;
            const nx = dy / dist;
            const baseSpacing = 0.00045; // Perfect latitude/longitude offset spacing for dynamic parallel track positioning
            const shift = index - (N - 1) / 2;
            const offsetLat = ny * shift * baseSpacing;
            const offsetLng = nx * shift * baseSpacing;

            p1 = [s1.lat + offsetLat, s1.lng + offsetLng];
            p2 = [s2.lat + offsetLat, s2.lng + offsetLng];
          }
        }

        // Generate and draw organic curved bezier tracks connecting stations
        L.polyline(getBezierCurvePoints(p1, p2), {
          color: line.color,
          weight: 6,
          opacity: 0.8,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(overlay);
      }
    });

    // C. Draw subway station custom markers
    (Object.values(gameState.stations) as Station[]).forEach((station) => {
      const isSelected = selectedStationId === station.id;
      const totalWait = (Object.values(station.waitingPassengers) as number[]).reduce((a, b) => a + b, 0);
      const isOvercrowded = totalWait >= station.capacity * 0.8;

      const pulseClass = isOvercrowded ? 'marker-overcrowd-pulse' : '';
      
      let stationInnerHtml = '';
      let labelOffsetClass = 'top-4';

      if (station.connectedLines.length === 0) {
        stationInnerHtml = `
          <div class="w-4 h-4 rounded-full border-2 border-white flex items-center justify-center bg-slate-600 shadow-[0_0_10px_rgba(0,0,0,0.5)] transition-transform duration-200" style="transform: scale(${isSelected ? 1.35 : 1.0})">
            <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
          </div>
        `;
      } else if (station.connectedLines.length === 1) {
        const line = gameState.lines[station.connectedLines[0]] as Line;
        const color = line?.color || '#a855f7';
        stationInnerHtml = `
          <div class="w-4 h-4 rounded-full border-2 border-white flex items-center justify-center shadow-[0_0_10px_rgba(0,0,0,0.5)] transition-transform duration-200" style="background-color: ${color}; transform: scale(${isSelected ? 1.35 : 1.0})">
            <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
          </div>
        `;
      } else {
        // Multi-line interchange station! Draw a beautiful metallic gold/white outer ring with multi-colored segment dots underneath/beside
        const colors = station.connectedLines.map(lineId => (gameState.lines[lineId] as Line)?.color).filter(Boolean);
        const dotsHtml = colors.map(col => `<div class="w-1.5 h-1.5 rounded-full border border-black/50" style="background-color: ${col}"></div>`).join('');
        labelOffsetClass = 'top-9';
        stationInnerHtml = `
          <div class="flex flex-col items-center gap-0.5 transition-transform duration-200" style="transform: scale(${isSelected ? 1.355 : 1.0})">
            <div class="w-5 h-5 rounded-full border-2 border-amber-400 bg-white flex items-center justify-center shadow-[0_0_12px_rgba(251,191,36,0.6)]">
              <div class="w-2.5 h-2.5 bg-slate-900 rounded-full flex items-center justify-center">
                <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
              </div>
            </div>
            <div class="flex gap-0.5 bg-slate-950/90 px-1 py-0.5 rounded-full border border-white/10 shadow-sm">
              ${dotsHtml}
            </div>
          </div>
        `;
      }

      const customHtml = L.divIcon({
        className: 'station-div-marker',
        html: `
          <div class="relative flex items-center justify-center ${pulseClass}">
            ${stationInnerHtml}
            <div class="absolute ${labelOffsetClass} left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-950/90 border border-slate-800 text-[9px] font-mono leading-none py-0.5 px-1 rounded shadow-lg text-slate-200 select-none flex items-center gap-1">
              <span>${station.name}</span>
              ${totalWait > 0 ? `<span class="text-amber-400 font-bold">(${totalWait})</span>` : ''}
              ${station.connectedLines.length > 1 ? `<span class="text-[8px] uppercase tracking-wider text-amber-400 font-sans border-l border-white/10 pl-1 font-bold">Transfer Hub</span>` : ''}
            </div>
          </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      const marker = L.marker([station.lat, station.lng], { icon: customHtml });
      marker.on('click', () => {
        // If track laying active
        if (buildMode === 'edit-line-tracks' && selectedLineIdForTracks) {
          handleLinkStationToLine(selectedLineIdForTracks, station.id);
        } else {
          setSelectedStationId(station.id);
          setSelectedLineId(null);
        }
      });
      marker.addTo(overlay);
    });

    // D. Animated moving Trains
    (Object.values(gameState.trains) as Train[]).forEach((train) => {
      const line = gameState.lines[train.lineId] as Line;
      if (!line) return;

      const color = line.color || '#e2e8f0';
      const isBroken = train.status === 'broken';

      let trainLat = train.lat;
      let trainLng = train.lng;

      // Smooth en-route dynamic track alignment offset and Bezier curve tracking for trains
      if (!train.currentStationId) {
        const targetIdx = train.targetStationIndex;
        const prevIdx = train.direction === 1 ? targetIdx - 1 : targetIdx + 1;
        const targetStationId = line.stationIds[targetIdx];
        const prevStationId = line.stationIds[prevIdx];

        if (targetStationId && prevStationId) {
          const s1 = gameState.stations[prevStationId];
          const s2 = gameState.stations[targetStationId];
          if (s1 && s2) {
            const key = getSegmentKey(s1.id, s2.id);
            const sharedLines = segmentToLinesMap[key] || [];
            const index = sharedLines.indexOf(line.id);
            const N = sharedLines.length;

            let p1: [number, number] = [s1.lat, s1.lng];
            let p2: [number, number] = [s2.lat, s2.lng];

            if (N > 1 && index !== -1) {
              const dy = s2.lat - s1.lat;
              const dx = s2.lng - s1.lng;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist > 0) {
                const ny = -dx / dist;
                const nx = dy / dist;
                const baseSpacing = 0.00045;
                const shift = index - (N - 1) / 2;
                const offsetLat = ny * shift * baseSpacing;
                const offsetLng = nx * shift * baseSpacing;

                p1 = [s1.lat + offsetLat, s1.lng + offsetLng];
                p2 = [s2.lat + offsetLat, s2.lng + offsetLng];
              }
            }

            // Curve tracing: calculate progression t (0 to 1) along s1 -> s2 straight path
            const straightDy = s2.lat - s1.lat;
            const straightDx = s2.lng - s1.lng;
            const straightDist = Math.sqrt(straightDx * straightDx + straightDy * straightDy);
            
            if (straightDist > 0) {
              const progDy = train.lat - s1.lat;
              const progDx = train.lng - s1.lng;
              const progDist = Math.sqrt(progDx * progDx + progDy * progDy);
              const t0 = progDist / straightDist;
              const t = Math.max(0, Math.min(1, t0));

              // Compute the exact Bezier control point for offsetted points p1 and p2
              const isOrdered = p1[0] < p2[0] || (p1[0] === p2[0] && p1[1] < p2[1]);
              const start = isOrdered ? p1 : p2;
              const end = isOrdered ? p2 : p1;

              const dy = end[0] - start[0];
              const dx = end[1] - start[1];
              const dist = Math.sqrt(dx * dx + dy * dy);

              if (dist > 0) {
                const ny = -dx / dist;
                const nx = dy / dist;
                const curvature = trackCurvature;
                const offsetAmount = dist * curvature;

                const cpLat = (start[0] + end[0]) / 2 + ny * offsetAmount;
                const cpLng = (start[1] + end[1]) / 2 + nx * offsetAmount;

                const mt = 1 - t;
                trainLat = mt * mt * p1[0] + 2 * mt * t * cpLat + t * t * p2[0];
                trainLng = mt * mt * p1[1] + 2 * mt * t * cpLng + t * t * p2[1];
              }
            }
          }
        }
      }

      const trainIcon = L.divIcon({
        className: 'train-div-marker',
        html: `
          <div class="relative flex items-center justify-center animate-pulse">
            <div class="w-4 h-4 rounded border-2 border-slate-950 text-white flex items-center justify-center shadow-md font-bold text-[8px] transition-all" style="background-color: ${isBroken ? '#ef4444' : color}; transform: rotate(${train.direction === 1 ? '45deg' : '-45deg'})">
              🚇
            </div>
            <div class="absolute -top-6 bg-slate-950/95 text-[8px] font-mono py-0.5 px-1 border border-slate-800 rounded shadow text-slate-300 pointer-events-none whitespace-nowrap">
              ${train.name} (${train.occupancy}/${train.capacity})
            </div>
          </div>
        `,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });

      L.marker([trainLat, trainLng], { icon: trainIcon }).addTo(overlay);
    });

  }, [gameState, selectedStationId, buildMode, selectedLineIdForTracks, trackCurvature, activeDistrictId, showDensity, districtTypeFilter, minDensityFilter]);

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

  const handleLinkStationToLine = async (lineId: string, stationId: string) => {
    const line = gameState?.lines[lineId];
    if (!line) return;

    // Check if station is already part of the line to prevent duplicate platforms/connections
    if (line.stationIds.includes(stationId)) {
      showToast('This station is already linked to this line.');
      return;
    }

    const updatedIds = [...line.stationIds, stationId];
    try {
      const res = await fetch('/api/game/line/stations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineId, stationIds: updatedIds })
      });
      const data = await res.json();
      if (data.error) {
        showToast(data.error);
      } else {
        setGameState(data.gameState);
        showToast(`Linked station to ${line.name}! New track segment laid.`);
      }
    } catch (err) {
      showToast('Error drawing track segments.');
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
                  <p className="opacity-80">Toggle <span className="text-emerald-400 font-bold">🔨 Build Station</span> mode on the map menu, then click any empty space on the real-world map to establish a new station hub ($150,000).</p>
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
                        mapInstanceRef.current.flyTo([d.lat, d.lng], 13.5);
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
                  onChange={(e) => setSelectedLineIdForTracks(e.target.value)}
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
                  💡 <span className="font-bold text-slate-200">Click consecutive Station pins</span> sequentially on the map to bind tracks!
                </div>
              </div>
            )}

            {/* Leaflet physical div element */}
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
                        <span className="text-indigo-400 font-bold underline">Configure</span>
                      </div>

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
                                  ${(50000 + newTrainCapacity * 200 + newTrainSpeed * 150).toLocaleString()}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleDeployTrain(line.id); }}
                                disabled={line.stationIds.length < 2 || gameState.economy.budget < (50000 + newTrainCapacity * 200 + newTrainSpeed * 150)}
                                className={`font-mono text-[9px] uppercase font-bold px-2.5 py-1.5 rounded-lg text-white shadow transition-all active:scale-95 cursor-pointer flex items-center gap-1 ${
                                  line.stationIds.length >= 2 && gameState.economy.budget >= (50000 + newTrainCapacity * 200 + newTrainSpeed * 150)
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
                
                {/* Color swatches */}
                <select
                  value={newLineColor}
                  onChange={(e) => setNewLineColor(e.target.value)}
                  className="bg-black border border-white/10 rounded-lg text-[10px] p-2 text-slate-200 outline-none h-8 font-mono"
                  id="new-line-color"
                >
                  <option value="#ef4444">🔴 Red</option>
                  <option value="#3b82f6">🔵 Blue</option>
                  <option value="#10b981">🟢 Green</option>
                  <option value="#ec4899">🌸 Pink</option>
                  <option value="#f97316">🟠 Orange</option>
                  <option value="#eab308">🟡 Gold</option>
                  <option value="#a855f7">🟣 Purple</option>
                </select>
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
          <SocialFeed
            posts={gameState.citizenPosts}
            events={gameState.activeEvents}
            aiReport={aiReport}
            loadingAi={loadingAi}
            onTriggerAi={handleTriggerGeminiAdvisor}
          />
        </section>

      </main>
    </div>
  );
}
