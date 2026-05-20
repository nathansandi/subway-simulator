import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import {
  City,
  District,
  Station,
  Line,
  Train,
  Economy,
  GameState,
  GameEvent,
  CitizenPost,
  Loan
} from './src/types';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy GoogleGenAI Initialization Helper
async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, retries = 3, initialDelay = 1500): Promise<T> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      // Retry on 503 (Service Unavailable) or 429 (Too Many Requests)
      const status = error?.status || error?.code || (error?.message?.includes('503') ? 503 : error?.message?.includes('429') ? 429 : null);
      if (status === 503 || status === 429) {
        const waitTime = initialDelay * Math.pow(2, i);
        console.warn(`Gemini API error (${status}). Retrying in ${waitTime}ms... (Attempt ${i + 1}/${retries})`);
        await delay(waitTime);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key && key !== 'MY_GEMINI_API_KEY') {
      aiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
  }
  return aiClient;
}

// Default real-world cities with coordinates and detailed district profiles
const DEFAULT_CITIES: { [id: string]: City } = {
  nyc: {
    id: 'nyc',
    name: 'New York City',
    lat: 40.7128,
    lng: -74.0060,
    population: 8335000,
    districts: [
      { id: 'nyc-d1', name: 'Manhattan Midtown', lat: 40.7589, lng: -73.9851, radius: 0.02, type: 'commercial', density: 95, population: 1600000 },
      { id: 'nyc-d2', name: 'Brooklyn Heights', lat: 40.6925, lng: -73.9903, radius: 0.03, type: 'residential', density: 80, population: 2600000 },
      { id: 'nyc-d3', name: 'Williamsburg', lat: 40.7081, lng: -73.9571, radius: 0.015, type: 'leisure', density: 88, population: 150000 },
      { id: 'nyc-d4', name: 'Flushing Queens', lat: 40.7673, lng: -73.8331, radius: 0.04, type: 'residential', density: 70, population: 2200000 },
      { id: 'nyc-d5', name: 'Long Island City', lat: 40.7447, lng: -73.9485, radius: 0.02, type: 'industrial', density: 60, population: 100000 },
      { id: 'nyc-d6', name: 'Wall Street', lat: 40.7075, lng: -74.0113, radius: 0.015, type: 'commercial', density: 98, population: 80000 },
      { id: 'nyc-d7', name: 'Central Park North', lat: 40.7999, lng: -73.9510, radius: 0.025, type: 'tourism', density: 55, population: 150000 },
      { id: 'nyc-d8', name: 'Harlem', lat: 40.8116, lng: -73.9465, radius: 0.025, type: 'residential', density: 75, population: 400000 },
      { id: 'nyc-d9', name: 'Astoria Queens', lat: 40.7644, lng: -73.9235, radius: 0.022, type: 'leisure', density: 72, population: 320000 },
      { id: 'nyc-d10', name: 'Hoboken NJ', lat: 40.7452, lng: -74.0300, radius: 0.018, type: 'residential', density: 67, population: 180000 },
      { id: 'nyc-d11', name: 'Upper West Side', lat: 40.7870, lng: -73.9754, radius: 0.02, type: 'tourism', density: 80, population: 290000 },
      { id: 'nyc-d12', name: 'Greenwich Village', lat: 40.7336, lng: -74.0027, radius: 0.015, type: 'leisure', density: 88, population: 140000 },
      { id: 'nyc-d13', name: 'Bushwick Brooklyn', lat: 40.6944, lng: -73.9213, radius: 0.026, type: 'industrial', density: 55, population: 210000 },
      { id: 'nyc-d14', name: 'Staten Ferry Terminal', lat: 40.7010, lng: -74.0130, radius: 0.012, type: 'tourism', density: 78, population: 85000 },
      { id: 'nyc-d15', name: 'Jersey City Heights', lat: 40.7410, lng: -74.0560, radius: 0.038, type: 'residential', density: 62, population: 250000 },
      { id: 'nyc-d16', name: 'Bronx Hub', lat: 40.8160, lng: -73.9180, radius: 0.045, type: 'industrial', density: 78, population: 850000 },
      { id: 'nyc-d17', name: 'Queens Corona', lat: 40.7430, lng: -73.8680, radius: 0.032, type: 'residential', density: 74, population: 420000 }
    ]
  },
  tokyo: {
    id: 'tokyo',
    name: 'Tokyo',
    lat: 35.6762,
    lng: 139.6503,
    population: 14040000,
    districts: [
      { id: 'tokyo-d1', name: 'Shinjuku', lat: 35.6895, lng: 139.7003, radius: 0.02, type: 'commercial', density: 98, population: 350000 },
      { id: 'tokyo-d2', name: 'Shibuya', lat: 35.6580, lng: 139.7016, radius: 0.015, type: 'leisure', density: 96, population: 230000 },
      { id: 'tokyo-d3', name: 'Marunouchi', lat: 35.6812, lng: 139.7671, radius: 0.025, type: 'commercial', density: 99, population: 60000 },
      { id: 'tokyo-d4', name: 'Roppongi', lat: 35.6586, lng: 139.7285, radius: 0.015, type: 'tourism', density: 85, population: 260000 },
      { id: 'tokyo-d5', name: 'Odaiba', lat: 35.6294, lng: 139.7786, radius: 0.03, type: 'industrial', density: 65, population: 520000 },
      { id: 'tokyo-d6', name: 'Setagaya', lat: 35.6461, lng: 139.6562, radius: 0.05, type: 'residential', density: 82, population: 940000 },
      { id: 'tokyo-d7', name: 'Edogawa', lat: 35.6862, lng: 139.8824, radius: 0.04, type: 'residential', density: 78, population: 690000 },
      { id: 'tokyo-d8', name: 'Akihabara', lat: 35.6997, lng: 139.7711, radius: 0.012, type: 'commercial', density: 94, population: 85000 },
      { id: 'tokyo-d9', name: 'Ueno', lat: 35.7141, lng: 139.7774, radius: 0.018, type: 'tourism', density: 78, population: 180000 },
      { id: 'tokyo-d10', name: 'Ginza', lat: 35.6718, lng: 139.7650, radius: 0.015, type: 'commercial', density: 96, population: 50000 },
      { id: 'tokyo-d11', name: 'Nakano', lat: 35.7075, lng: 139.6638, radius: 0.022, type: 'residential', density: 85, population: 310000 },
      { id: 'tokyo-d12', name: 'Shinagawa', lat: 35.6285, lng: 139.7387, radius: 0.032, type: 'industrial', density: 89, population: 450000 },
      { id: 'tokyo-d13', name: 'Ikebukuro', lat: 35.7295, lng: 139.7109, radius: 0.025, type: 'commercial', density: 95, population: 380000 },
      { id: 'tokyo-d14', name: 'Asakusa', lat: 35.7148, lng: 139.7967, radius: 0.014, type: 'tourism', density: 80, population: 95000 },
      { id: 'tokyo-d15', name: 'Koto Waterfront', lat: 35.6500, lng: 139.8100, radius: 0.035, type: 'industrial', density: 70, population: 520000 }
    ]
  },
  london: {
    id: 'london',
    name: 'London',
    lat: 51.5074,
    lng: -0.1278,
    population: 8980000,
    districts: [
      { id: 'london-d1', name: 'City of London', lat: 51.5123, lng: -0.0903, radius: 0.02, type: 'commercial', density: 96, population: 15000 },
      { id: 'london-d2', name: 'Westminster', lat: 51.4975, lng: -0.1357, radius: 0.02, type: 'tourism', density: 85, population: 250000 },
      { id: 'london-d3', name: 'Camden Town', lat: 51.5390, lng: -0.1426, radius: 0.015, type: 'leisure', density: 80, population: 270000 },
      { id: 'london-d4', name: 'Canary Wharf', lat: 51.5054, lng: -0.0235, radius: 0.015, type: 'commercial', density: 92, population: 50000 },
      { id: 'london-d5', name: 'Stratford', lat: 51.5430, lng: -0.0020, radius: 0.035, type: 'residential', density: 75, population: 350000 },
      { id: 'london-d6', name: 'Kensington', lat: 51.5010, lng: -0.1910, radius: 0.03, type: 'residential', density: 75, population: 160000 },
      { id: 'london-d7', name: 'Greenwich', lat: 51.4872, lng: -0.0060, radius: 0.03, type: 'industrial', density: 60, population: 280000 },
      { id: 'london-d8', name: 'Soho Central', lat: 51.5136, lng: -0.1365, radius: 0.01, type: 'leisure', density: 95, population: 45000 },
      { id: 'london-d9', name: 'Brixton South', lat: 51.4624, lng: -0.1149, radius: 0.02, type: 'residential', density: 82, population: 180000 },
      { id: 'london-d10', name: 'Hackney East', lat: 51.5450, lng: -0.0550, radius: 0.028, type: 'leisure', density: 85, population: 290000 },
      { id: 'london-d11', name: 'Southwark Bankside', lat: 51.5020, lng: -0.0890, radius: 0.018, type: 'tourism', density: 88, population: 130000 },
      { id: 'london-d12', name: 'Paddington Terminal', lat: 51.5175, lng: -0.1714, radius: 0.022, type: 'residential', density: 80, population: 210000 },
      { id: 'london-d13', name: 'Battersea Reach', lat: 51.4780, lng: -0.1650, radius: 0.024, type: 'industrial', density: 72, population: 170000 },
      { id: 'london-d14', name: 'Islington', lat: 51.5416, lng: -0.1022, radius: 0.022, type: 'residential', density: 86, population: 240000 },
      { id: 'london-d15', name: 'Wemley Arena', lat: 51.5560, lng: -0.2797, radius: 0.035, type: 'tourism', density: 68, population: 190000 }
    ]
  },
  paris: {
    id: 'paris',
    name: 'Paris',
    lat: 48.8566,
    lng: 2.3522,
    population: 2160000,
    districts: [
      { id: 'paris-d1', name: 'La Défense', lat: 48.8924, lng: 2.2384, radius: 0.02, type: 'commercial', density: 94, population: 30000 },
      { id: 'paris-d2', name: 'Champs-Élysées', lat: 48.8698, lng: 2.3075, radius: 0.015, type: 'tourism', density: 90, population: 120000 },
      { id: 'paris-d3', name: 'Montmartre', lat: 48.8867, lng: 2.3431, radius: 0.01, type: 'leisure', density: 85, population: 110000 },
      { id: 'paris-d4', name: 'Le Marais', lat: 48.8580, lng: 2.3621, radius: 0.015, type: 'residential', density: 88, population: 180000 },
      { id: 'paris-d5', name: 'Porte de Clichy', lat: 48.8988, lng: 2.3117, radius: 0.02, type: 'industrial', density: 65, population: 150000 },
      { id: 'paris-d6', name: 'Boulogne-Billancourt', lat: 48.8357, lng: 2.2412, radius: 0.03, type: 'residential', density: 78, population: 370000 },
      { id: 'paris-d7', name: 'Panthéon / Quartier Latin', lat: 48.8462, lng: 2.3447, radius: 0.02, type: 'tourism', density: 80, population: 210000 },
      { id: 'paris-d8', name: 'St-Germain-des-Prés', lat: 48.8537, lng: 2.3333, radius: 0.014, type: 'tourism', density: 88, population: 70000 },
      { id: 'paris-d9', name: 'Bastille', lat: 48.8532, lng: 2.3691, radius: 0.012, type: 'leisure', density: 85, population: 95000 },
      { id: 'paris-d10', name: 'Belleville Nord', lat: 48.8712, lng: 2.3843, radius: 0.025, type: 'residential', density: 76, population: 220000 },
      { id: 'paris-d11', name: 'Bercy Village', lat: 48.8386, lng: 2.3831, radius: 0.022, type: 'industrial', density: 70, population: 140000 },
      { id: 'paris-d12', name: 'Montparnasse', lat: 48.8421, lng: 2.3219, radius: 0.018, type: 'commercial', density: 92, population: 180000 },
      { id: 'paris-d13', name: 'Passy Trocadéro', lat: 48.8614, lng: 2.2798, radius: 0.02, type: 'tourism', density: 80, population: 130000 },
      { id: 'paris-d14', name: 'Saint-Denis Stadium', lat: 48.9362, lng: 2.3574, radius: 0.04, type: 'industrial', density: 65, population: 410000 }
    ]
  },
  saopaulo: {
    id: 'saopaulo',
    name: 'São Paulo',
    lat: -23.5505,
    lng: -46.6333,
    population: 12330000,
    districts: [
      { id: 'sp-d1', name: 'Avenida Paulista', lat: -23.5615, lng: -46.6560, radius: 0.02, type: 'commercial', density: 98, population: 400000 },
      { id: 'sp-d2', name: 'Centro Histórico / Sé', lat: -23.5505, lng: -46.6333, radius: 0.025, type: 'tourism', density: 92, population: 350000 },
      { id: 'sp-d3', name: 'Vila Madalena', lat: -23.5539, lng: -46.6908, radius: 0.015, type: 'leisure', density: 80, population: 151000 },
      { id: 'sp-d4', name: 'Pinheiros', lat: -23.5663, lng: -46.6903, radius: 0.025, type: 'residential', density: 85, population: 290000 },
      { id: 'sp-d5', name: 'Itaim Bibi', lat: -23.5843, lng: -46.6775, radius: 0.02, type: 'commercial', density: 95, population: 160000 },
      { id: 'sp-d6', name: 'Santo Amaro', lat: -23.6455, lng: -46.7022, radius: 0.04, type: 'industrial', density: 70, population: 800000 },
      { id: 'sp-d7', name: 'Mooca', lat: -23.5574, lng: -46.5980, radius: 0.03, type: 'residential', density: 78, population: 350000 },
      { id: 'sp-d8', name: 'Tatuapé Leste', lat: -23.5410, lng: -46.5750, radius: 0.028, type: 'residential', density: 86, population: 450000 },
      { id: 'sp-d9', name: 'Santana Norte', lat: -23.5042, lng: -46.6214, radius: 0.032, type: 'residential', density: 80, population: 380000 },
      { id: 'sp-d10', name: 'Liberdade', lat: -23.5610, lng: -46.6340, radius: 0.012, type: 'tourism', density: 89, population: 120000 },
      { id: 'sp-d11', name: 'Vila Mariana', lat: -23.5810, lng: -46.6410, radius: 0.024, type: 'residential', density: 88, population: 280000 },
      { id: 'sp-d12', name: 'Barra Funda', lat: -23.5250, lng: -46.6690, radius: 0.026, type: 'industrial', density: 76, population: 190000 },
      { id: 'sp-d13', name: 'Morumbi Sul', lat: -23.5980, lng: -46.7230, radius: 0.035, type: 'residential', density: 68, population: 320000 },
      { id: 'sp-d14', name: 'Lapa Oeste', lat: -23.5220, lng: -46.7030, radius: 0.028, type: 'industrial', density: 72, population: 265000 },
      { id: 'sp-d15', name: 'Aeroporto Congonhas (CGH)', lat: -23.6273, lng: -46.6565, radius: 0.025, type: 'commercial', density: 99, population: 450000 },
      { id: 'sp-d16', name: 'Aeroporto Guarulhos (GRU)', lat: -23.4356, lng: -46.4731, radius: 0.045, type: 'industrial', density: 95, population: 600000 }
    ]
  }
};

// Global in-memory game state
let gameState: GameState = {
  currentCityId: 'nyc',
  cities: DEFAULT_CITIES,
  stations: {},
  lines: {},
  trains: {},
  economy: {
    budget: 2500000, // starting budget in dollars
    ticketPrice: 3.25, // starting ticket price (slightly higher for easier start)
    revenue: 0,
    expenses: {
      maintenance: 0,
      electricity: 0,
      staff: 0,
      loans: 0
    },
    loans: [],
    totalCO2Saved: 0,
    totalCarReduced: 0
  },
  hour: 8,
  minute: 0,
  day: 1,
  timeSpeed: 1, // default speed
  activePassengersCount: 0,
  deliveredPassengersCount: 0,
  activeEvents: [],
  citizenPosts: [
    { id: 'p1', handle: '@ManhattanCommuter', avatar: '👩', text: 'Excited for the new transit network to build out! Busses are too slow.', sentiment: 'positive', timestamp: '8:00 AM' },
    { id: 'p2', handle: '@SubwayFanatic', avatar: '🚇', text: 'Waiting to see where the first station will be placed!', sentiment: 'neutral', timestamp: '8:02 AM' }
  ]
};

// --- HELPER GEOMETRY & CONSTANTS ---
function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = lat1 - lat2;
  const dLng = lng1 - lng2;
  return Math.sqrt(dLat * dLat + dLng * dLng) * 111.32; // Approx distance in KM
}

// Find transit routing using Dijkstra's algorithm
function findTransitRoute(
  stations: { [id: string]: Station },
  lines: { [id: string]: Line },
  startStationId: string,
  endStationId: string
): string[] | null {
  const dist: { [id: string]: number } = {};
  const prev: { [id: string]: string | null } = {};
  const queue = new Set<string>();

  for (const sId in stations) {
    dist[sId] = Infinity;
    prev[sId] = null;
    queue.add(sId);
  }
  dist[startStationId] = 0;

  while (queue.size > 0) {
    let minId: string | null = null;
    let minDist = Infinity;
    for (const sId of queue) {
      if (dist[sId] < minDist) {
        minId = sId;
        minDist = dist[sId];
      }
    }

    if (!minId || dist[minId] === Infinity) break;
    if (minId === endStationId) break;

    queue.delete(minId);

    const minStation = stations[minId];
    const neighbors: { id: string; weight: number }[] = [];

    // Find stations directly connected to minStation via active subway lines
    minStation.connectedLines.forEach((lineId) => {
      const line = lines[lineId];
      if (!line || !line.isActive) return;
      const idx = line.stationIds.indexOf(minId);
      if (idx !== -1) {
        if (idx > 0) {
          const prevId = line.stationIds[idx - 1];
          const lenRef = getDistance(minStation.lat, minStation.lng, stations[prevId].lat, stations[prevId].lng);
          neighbors.push({ id: prevId, weight: lenRef });
        }
        if (idx < line.stationIds.length - 1) {
          const nextId = line.stationIds[idx + 1];
          const lenRef = getDistance(minStation.lat, minStation.lng, stations[nextId].lat, stations[nextId].lng);
          neighbors.push({ id: nextId, weight: lenRef });
        }
      }
    });

    for (const neighbor of neighbors) {
      if (!queue.has(neighbor.id)) continue;
      // Transfer penalty logic to favor keeping on the same line if multiple paths exist
      const alt = dist[minId] + neighbor.weight;
      if (alt < dist[neighbor.id]) {
        dist[neighbor.id] = alt;
        prev[neighbor.id] = minId;
      }
    }
  }

  if (dist[endStationId] === Infinity) return null;

  // Rebuild station hopper
  const path: string[] = [];
  let curr: string | null = endStationId;
  while (curr !== null) {
    path.unshift(curr);
    curr = prev[curr];
  }
  return path;
}

// Generate passengers to waiting lists
function populateDailyCommuters() {
  const city = gameState.cities[gameState.currentCityId];
  if (!city || Object.keys(gameState.stations).length < 2) return;

  // Commute generation factors based on current hour
  const currentHour = gameState.hour;
  let multiplier = 1.0;
  let description = "Normal hours flow";

  if ((currentHour >= 7 && currentHour <= 9)) {
    multiplier = 3.5; // Morning Rush Hour
    description = "Morning Commute Rush";
  } else if ((currentHour >= 17 && currentHour <= 19)) {
    multiplier = 3.0; // Evening Rush Hour
    description = "Evening Return Rush";
  } else if (currentHour >= 22 || currentHour <= 5) {
    if (gameState.currentCityId === 'nyc') {
      multiplier = 0.35; // Nighttime (NYC never sleeps!)
      description = "Night owl (City That Never Sleeps)";
    } else {
      multiplier = 0.15; // Nighttime
      description = "Night owl lull";
    }
  }

  // Multiply by active events impact (Weather, Sports event spikes, strikes)
  let strikeActive = false;
  gameState.activeEvents.forEach((event) => {
    multiplier *= (event.passengerMultiplier || 1.0);
    if (event.type === 'strike') {
      strikeActive = true;
    }
  });

  if (strikeActive) return; // Strike blocks passenger demand

  // Paris tourism spike during leisure hours (11am to 4pm)
  if (gameState.currentCityId === 'paris' && currentHour >= 11 && currentHour <= 16) {
    multiplier *= 1.35; // Tourist flow boost
  }

  const districts = city.districts;
  const stationsList = Object.values(gameState.stations);

  // City-specific core commuting volumes
  let cityVolumeFactor = 1.0;
  if (gameState.currentCityId === 'saopaulo') {
    cityVolumeFactor = 5.0; // High density Sao Paulo
  } else if (gameState.currentCityId === 'tokyo') {
    cityVolumeFactor = 2.0;
  }

  // Weigh districts by population/density for more realistic passenger flows
  const weightedDistricts: {dist: any, weight: number}[] = districts.map(d => ({
    dist: d,
    weight: (d.population / 10000) * (d.density / 50) 
  }));
  const totalWeight = weightedDistricts.reduce((sum, d) => sum + d.weight, 0);

  const getRandomWeightedDistrict = () => {
    let r = Math.random() * totalWeight;
    for (const wd of weightedDistricts) {
      if (r < wd.weight) return wd.dist;
      r -= wd.weight;
    }
    return districts[0];
  };

  // Cross district travel simulation
  const numCommuteAttempts = Math.floor((40 + Math.random() * 80) * multiplier * cityVolumeFactor);
  let newlySpawned = 0;

  for (let i = 0; i < numCommuteAttempts; i++) {
    const startDist = getRandomWeightedDistrict();
    const endDist = getRandomWeightedDistrict();

    if (startDist.id === endDist.id) continue;

    // Check if player has built station near these districts (Districts radius is in degrees, getDistance is in KM)
    const catchmentKM = 2.5; // 2.5km catchment area beyond district radius
    const startStation = stationsList.find(s => getDistance(s.lat, s.lng, startDist.lat, startDist.lng) <= (startDist.radius * 111) + catchmentKM);
    const endStation = stationsList.find(s => getDistance(s.lat, s.lng, endDist.lat, endDist.lng) <= (endDist.radius * 111) + catchmentKM);

    if (startStation && endStation && startStation.id !== endStation.id) {
      // Tickets sold! (Removed path check to show demand even before lines are connected)
      const counts = Math.floor(1 + Math.random() * 5);
      if (!startStation.waitingPassengers[endStation.id]) {
        startStation.waitingPassengers[endStation.id] = 0;
      }

      // Cap station capacity (São Paulo stations can handle overflow capacity)
      const totalWaiting = Object.values(startStation.waitingPassengers).reduce((a, b) => a + b, 0);
      const capacityFactor = gameState.currentCityId === 'saopaulo' ? 3.0 : 2.0;
      if (totalWaiting + counts <= startStation.capacity * capacityFactor) {
        startStation.waitingPassengers[endStation.id] += counts;
        newlySpawned += counts;

        // Financial impact (Initial ticket sale at entrance)
        const cityFareMultiplier = gameState.currentCityId === 'london' ? 1.25 : 1.0;
        const fare = counts * gameState.economy.ticketPrice * cityFareMultiplier;
        gameState.economy.revenue += fare;
        gameState.economy.budget += fare;

        // Ecological impact
        gameState.economy.totalCarReduced += Math.floor(counts * 0.75);
        gameState.economy.totalCO2Saved += counts * 0.0025;
      }
    }
  }

  gameState.activePassengersCount += newlySpawned;
}

// Tick simulation engine (Main movement and logic)
function processSimulationTick() {
  // 1. Advance time scale
  let minutesToAdd = 5;
  if (gameState.timeSpeed === 2) minutesToAdd = 15;
  if (gameState.timeSpeed === 3) minutesToAdd = 30;

  gameState.minute += minutesToAdd;
  if (gameState.minute >= 60) {
    gameState.minute = gameState.minute % 60;
    gameState.hour++;
    if (gameState.hour >= 24) {
      gameState.hour = 0;
      gameState.day++;
    }

    // Every hour perform economic budget deduction (operational costs)
    deductHourlyExpenses();
  }

  // 2. Events duration countdown
  if (gameState.activeEvents.length > 0) {
    gameState.activeEvents = gameState.activeEvents.map(e => {
      e.ticksRemaining -= 1;
      return e;
    }).filter(e => e.ticksRemaining > 0);
  }

  // 3. Spawning commuters based on current hour/district factors
  populateDailyCommuters();

  // 4. Upkeep station maintenance decline
  Object.values(gameState.stations).forEach((station) => {
    station.maintenanceLevel = Math.max(0, station.maintenanceLevel - 0.05);
  });

  // 5. Simulating active trains along their paths
  Object.values(gameState.trains).forEach((train) => {
    const line = gameState.lines[train.lineId];
    if (!line || !line.isActive || line.stationIds.length < 2) return;

    // Decay maintenance
    train.maintenance = Math.max(0, train.maintenance - 0.04);
    if (train.maintenance < 15 && Math.random() < 0.02) {
      train.status = 'broken';
    }

    if (train.status === 'broken') {
      // 5% chance of spontaneous recovery or manual crew dispatch
      if (Math.random() < 0.05) {
        train.status = 'running';
        train.maintenance = 60;
      }
      return; // Broken train doesn't move
    }

    if (train.status === 'boarding') {
      train.boardingTimer = Math.max(0, train.boardingTimer - 1);
      if (train.boardingTimer === 0) {
        train.status = 'running';
        train.currentStationId = null;
      } else {
        // Handle loading/unloading
        const currentStation = gameState.stations[train.currentStationId!];
        if (currentStation) {
          // Initialize stats if missing
          if (!line.statistics) {
            line.statistics = { totalPassengersCarried: 0, currentTrainsCount: 0, dailyRevenue: 0 };
          }

          // A. Unleash matching passengers whose route ends at this station or requires line-change transfers
          const unboarded = Math.min(train.occupancy, Math.floor(3 + Math.random() * 8));
          if (unboarded > 0) {
            train.occupancy = Math.max(0, train.occupancy - unboarded);
            gameState.activePassengersCount = Math.max(0, gameState.activePassengersCount - unboarded);
            gameState.deliveredPassengersCount += unboarded;
            
            // Track delivered for this line specifically
            line.statistics.totalPassengersCarried += unboarded;
          }

          // B. Board waiting passengers who need to proceed onwards
          Object.keys(currentStation.waitingPassengers).forEach((destId) => {
            const count = currentStation.waitingPassengers[destId];
            if (count > 0 && train.occupancy < train.capacity) {
              const spaces = train.capacity - train.occupancy;
              const boarding = Math.min(count, spaces);
              currentStation.waitingPassengers[destId] -= boarding;
              train.occupancy += boarding;
              
              // Revenue tracking per line (estimate share of fare)
              line.statistics.dailyRevenue += (boarding * gameState.economy.ticketPrice);
            }
          });
        }
      }
      return;
    }

    if (train.status === 'running') {
      // Move towards target station
      const targetStation = gameState.stations[line.stationIds[train.targetStationIndex]];
      if (!targetStation) {
        // Reset index if out of bounds
        train.targetStationIndex = 0;
        return;
      }

      // Compute vector shift
      const dist = getDistance(train.lat, train.lng, targetStation.lat, targetStation.lng);
      const speedKMPerTick = (train.speed / 3600) * (gameState.timeSpeed === 2 ? 3 : gameState.timeSpeed === 3 ? 6 : 1) * 30; // scaled

      if (dist <= speedKMPerTick * 1.5 || dist <= 0.15) {
        // Enters station!
        train.lat = targetStation.lat;
        train.lng = targetStation.lng;
        train.currentStationId = targetStation.id;
        train.status = 'boarding';
        train.boardingTimer = 2; // 2 tick pause

        // Calculate next target stop index
        const idx = train.targetStationIndex;
        if (train.direction === 1) {
          if (idx === line.stationIds.length - 1) {
            train.direction = -1;
            train.targetStationIndex = idx - 1;
          } else {
            train.targetStationIndex = idx + 1;
          }
        } else {
          if (idx === 0) {
            train.direction = 1;
            train.targetStationIndex = idx + 1;
          } else {
            train.targetStationIndex = idx - 1;
          }
        }
      } else {
        // Move towards target
        const ratio = speedKMPerTick / dist;
        const boundedRatio = Math.min(1.0, ratio);
        train.lat = train.lat + (targetStation.lat - train.lat) * boundedRatio;
        train.lng = train.lng + (targetStation.lng - train.lng) * boundedRatio;
      }
    }
  });
}

function deductHourlyExpenses() {
  const numStations = Object.keys(gameState.stations).length;
  const numLines = Object.keys(gameState.lines).length;
  const numTrains = Object.keys(gameState.trains).length;

  // Refresh train counts on line objects for frontend display
  Object.values(gameState.lines).forEach(l => {
    if (!l.statistics) {
       l.statistics = { totalPassengersCarried: 0, currentTrainsCount: 0, dailyRevenue: 0 };
    }
    l.statistics.currentTrainsCount = Object.values(gameState.trains).filter(t => t.lineId === l.id).length;
  });

  // Calculative operational expense structure (Reduced slightly)
  const mCost = numStations * 50 + numLines * 100;
  const eCost = numTrains * 80 + numStations * 20;
  const sCost = numStations * 70 + numTrains * 100;

  let loanPayments = 0;
  gameState.economy.loans.forEach((loan) => {
    if (loan.remainingAmount > 0) {
      const pay = Math.min(loan.remainingAmount, loan.paymentPerTick * 10);
      loan.remainingAmount -= pay;
      loanPayments += pay;
    }
  });

  // Filter settled loans
  gameState.economy.loans = gameState.economy.loans.filter(l => l.remainingAmount > 0);

  gameState.economy.expenses = {
    maintenance: mCost,
    electricity: eCost,
    staff: sCost,
    loans: loanPayments
  };

  const totalCost = mCost + eCost + sCost + loanPayments;
  gameState.economy.budget -= totalCost;

  // Append a citizen post reflecting system condition at the hour mark
  let postText = "Commute is going excellent today!";
  let postHandle = "@UrbanistAlex";
  let sentiment: 'positive' | 'neutral' | 'negative' = "positive";

  if (gameState.economy.budget < 0) {
    postText = "Warning: City declares financial emergency. Subway development frozen?";
    postHandle = "@TransitReporter";
    sentiment = "negative";
  } else if (numTrains === 0) {
    postText = "Can someone actually deploy a train onto the map? We are waiting here!";
    postHandle = "@AngryCommuter";
    sentiment = "negative";
  } else {
    // Check station overcrowding
    let highWaiting = false;
    Object.values(gameState.stations).forEach((s) => {
      const wait = Object.values(s.waitingPassengers).reduce((a, b) => a + b, 0);
      if (wait > s.capacity * 0.9) highWaiting = true;
    });

    if (highWaiting) {
      postText = "Station platforms crowded! Trains are running full. We need longer networks!";
      postHandle = "@CrowdedTransit";
      sentiment = "negative";
    } else {
      const replies = [
        "Loving how clean the train stations are looking! Upgrades are worth it.",
        "Beautiful layout of the lines! Transit maps look great.",
        "Trains are punctual. Solid work on scheduling.",
        "The ticket pricing is quite fair for daily commuters."
      ];
      postText = replies[Math.floor(Math.random() * replies.length)];
      postHandle = "@CommuterLover";
      sentiment = "positive";
    }
  }

  const amPm = gameState.hour >= 12 ? 'PM' : 'AM';
  const displayHour = gameState.hour % 12 || 12;
  const timestamp = `${displayHour}:00 ${amPm}`;

  gameState.citizenPosts.unshift({
    id: 'post-' + Date.now(),
    handle: postHandle,
    avatar: sentiment === 'positive' ? '😄' : sentiment === 'negative' ? '🤬' : '🤖',
    text: postText,
    sentiment,
    timestamp
  });

  if (gameState.citizenPosts.length > 25) {
    gameState.citizenPosts.pop();
  }
}

// Master Interval Ticker Setup triggered automatically
let MasterTickerId: any = null;
function startMasterTicker() {
  if (MasterTickerId) clearInterval(MasterTickerId);
  MasterTickerId = setInterval(() => {
    if (gameState.timeSpeed > 0) {
      processSimulationTick();
    }
  }, 1000);
}
startMasterTicker();

// --- API PORT HANDLERS ---

// GET: Current game layout and status
app.get('/api/game/state', (req, res) => {
  res.json({ status: 'ok', gameState });
});

// POST: Select a new city or search a custom coordinate
app.post('/api/game/city', (req, res) => {
  const { cityId, customName, lat, lng } = req.body;

  if (cityId && DEFAULT_CITIES[cityId]) {
    gameState.currentCityId = cityId;
    gameState.stations = {};
    gameState.lines = {};
    gameState.trains = {};
    gameState.economy.budget = 2500000; // starting budget in dollars
    gameState.economy.revenue = 0;
    gameState.economy.loans = [];
    gameState.economy.totalCarReduced = 0;
    gameState.economy.totalCO2Saved = 0;
    gameState.activePassengersCount = 0;
    gameState.deliveredPassengersCount = 0;
    gameState.activeEvents = [];
    gameState.citizenPosts = [
      { id: 'p1', handle: '@UrbanCommute', avatar: '🌆', text: `Welcome to ${DEFAULT_CITIES[cityId].name}! Ready to map out our future transit system.`, sentiment: 'positive', timestamp: '8:00 AM' }
    ];
    res.json({ status: 'ok', gameState });
  } else if (customName && lat && lng) {
    // Generate organic simulated districts for custom city mapping
    const customCityId = 'custom-' + Date.now();
    const lVal = parseFloat(lat);
    const nVal = parseFloat(lng);
    const customCity: City = {
      id: customCityId,
      name: customName,
      lat: lVal,
      lng: nVal,
      population: 2500000,
      districts: [
        { id: `${customCityId}-d1`, name: 'Downtown Core', lat: lVal, lng: nVal, radius: 0.02, type: 'commercial', density: 90, population: 300000 },
        { id: `${customCityId}-d2`, name: 'Residential North', lat: lVal + 0.018, lng: nVal - 0.015, radius: 0.03, type: 'residential', density: 75, population: 400000 },
        { id: `${customCityId}-d3`, name: 'Suburbs South', lat: lVal - 0.022, lng: nVal + 0.02, radius: 0.035, type: 'residential', density: 50, population: 350000 },
        { id: `${customCityId}-d4`, name: 'Commercial Hub West', lat: lVal - 0.005, lng: nVal - 0.025, radius: 0.015, type: 'leisure', density: 85, population: 150050 },
        { id: `${customCityId}-d5`, name: 'Industrial Dock East', lat: lVal + 0.012, lng: nVal + 0.025, radius: 0.025, type: 'industrial', density: 60, population: 200000 },
        { id: `${customCityId}-d6`, name: 'Tourist Waterfront', lat: lVal - 0.015, lng: nVal - 0.008, radius: 0.02, type: 'tourism', density: 80, population: 100000 },
        { id: `${customCityId}-d7`, name: 'Outer Suburbs North', lat: lVal + 0.035, lng: nVal - 0.030, radius: 0.04, type: 'residential', density: 55, population: 300000 },
        { id: `${customCityId}-d8`, name: 'Business Park East', lat: lVal + 0.005, lng: nVal + 0.042, radius: 0.022, type: 'commercial', density: 88, population: 180000 },
        { id: `${customCityId}-d9`, name: 'Recreation Park', lat: lVal - 0.030, lng: nVal - 0.015, radius: 0.025, type: 'leisure', density: 65, population: 90000 },
        { id: `${customCityId}-d10`, name: 'Tech Valley West', lat: lVal + 0.022, lng: nVal - 0.038, radius: 0.03, type: 'industrial', density: 70, population: 240000 },
        { id: `${customCityId}-d11`, name: 'Cultural Heights', lat: lVal - 0.010, lng: nVal + 0.032, radius: 0.02, type: 'tourism', density: 82, population: 125000 },
        { id: `${customCityId}-d12`, name: 'Lakeside Residential', lat: lVal - 0.035, lng: nVal + 0.035, radius: 0.032, type: 'residential', density: 60, population: 280000 }
      ]
    };

    gameState.cities[customCityId] = customCity;
    gameState.currentCityId = customCityId;
    gameState.stations = {};
    gameState.lines = {};
    gameState.trains = {};
    gameState.economy.budget = 2500000;
    gameState.economy.revenue = 0;
    gameState.economy.loans = [];
    gameState.economy.totalCarReduced = 0;
    gameState.economy.totalCO2Saved = 0;
    gameState.activePassengersCount = 0;
    gameState.deliveredPassengersCount = 0;
    gameState.activeEvents = [];
    gameState.citizenPosts = [
      { id: 'p1', handle: '@UrbanPlanner', avatar: '🗺️', text: `Mapping out Transit for ${customName}! Initiating geological subway plans.`, sentiment: 'positive', timestamp: '8:00 AM' }
    ];

    res.json({ status: 'ok', gameState });
  } else {
    res.status(400).json({ error: 'Invalid city dataset or search location' });
  }
});

// POST: Build a subway/train station
app.post('/api/game/station', (req, res) => {
  const { name, lat, lng } = req.body;
  if (!name || !lat || !lng) {
    return res.status(400).json({ error: 'Missing name or coordinates' });
  }

  const cost = 80000; // Build cost Reduced from 150000
  if (gameState.economy.budget < cost) {
    return res.status(400).json({ error: 'Insufficient funds! Stations require $80,000.' });
  }

  const id = 'station-' + Date.now();
  const station: Station = {
    id,
    name,
    lat: parseFloat(lat),
    lng: parseFloat(lng),
    capacity: 250, // base capacity
    connectedLines: [],
    waitingPassengers: {},
    upgradeLevel: 1,
    maintenanceLevel: 100,
    accessibilityScore: 70,
    ticketGatesCount: 4,
    platformWidth: 3.5
  };

  gameState.stations[id] = station;
  gameState.economy.budget -= cost;

  gameState.citizenPosts.unshift({
    id: 'post-' + Date.now(),
    handle: '@SubwayWatcher',
    avatar: '🏗️',
    text: `Station built: ${name}! Construction crew finished placement.`,
    sentiment: 'positive',
    timestamp: 'Just Now'
  });

  res.json({ status: 'ok', gameState });
});

// POST: Upgrade a station
app.post('/api/game/station/upgrade', (req, res) => {
  const { id } = req.body;
  const station = gameState.stations[id];
  if (!station) {
    return res.status(404).json({ error: 'Station not found' });
  }

  const upgradeCost = station.upgradeLevel * 40000; // Reduced from 75000
  if (gameState.economy.budget < upgradeCost) {
    return res.status(400).json({ error: `Not enough funds! Level ${station.upgradeLevel + 1} station upgrade costs $${upgradeCost}.` });
  }

  station.upgradeLevel++;
  station.capacity += 250;
  station.accessibilityScore = Math.min(100, station.accessibilityScore + 8);
  station.ticketGatesCount += 2;
  station.platformWidth += 0.8;
  gameState.economy.budget -= upgradeCost;

  res.json({ status: 'ok', gameState });
});

// POST: Perform station maintenance
app.post('/api/game/station/maintain', (req, res) => {
  const { id } = req.body;
  const station = gameState.stations[id];
  if (!station) return res.status(404).json({ error: 'Station not found' });

  const cost = 5000;
  if (gameState.economy.budget < cost) return res.status(400).json({ error: 'Insufficient budget' });

  station.maintenanceLevel = 100;
  gameState.economy.budget -= cost;
  res.json({ status: 'ok', gameState });
});

// POST: Create a pipeline Line
app.post('/api/game/line', (req, res) => {
  const { name, color, type } = req.body;
  if (!name || !color) {
    return res.status(400).json({ error: 'Missing line name or accent color' });
  }

  const cost = 20000; // mapping charge Reduced from 50000
  if (gameState.economy.budget < cost) {
    return res.status(400).json({ error: 'Insufficient funds to draw line!' });
  }

  const id = 'line-' + Date.now();
  const line: Line = {
    id,
    name,
    color,
    stationIds: [],
    type: type || 'underground',
    isActive: true,
    statistics: {
      totalPassengersCarried: 0,
      currentTrainsCount: 0,
      dailyRevenue: 0
    }
  };

  gameState.lines[id] = line;
  gameState.economy.budget -= cost;

  res.json({ status: 'ok', gameState });
});

// POST: Update line name or color
app.post('/api/game/line/update', (req, res) => {
  const { lineId, name, color } = req.body;
  const line = gameState.lines[lineId];
  if (!line) return res.status(404).json({ error: 'Line not found' });

  if (name) line.name = name;
  if (color) line.color = color;

  res.json({ status: 'ok', gameState });
});

// POST: Edit lines connecting order of stations
app.post('/api/game/line/stations', (req, res) => {
  const { lineId, stationIds } = req.body;
  const line = gameState.lines[lineId];
  if (!line) {
    return res.status(404).json({ error: 'Line not found' });
  }

  // Validate stations on the same line. 
  // We allow the first and last station to be the same to create circular lines (loops).
  // But otherwise we prevent duplicates.
  const isCircular = stationIds.length > 2 && stationIds[0] === stationIds[stationIds.length - 1];
  const checkSlice = isCircular ? stationIds.slice(0, -1) : stationIds;
  const uniqueStationIds = Array.from(new Set(checkSlice));
  
  if (uniqueStationIds.length !== checkSlice.length) {
    return res.status(400).json({ error: 'Uma estação só pode aparecer uma vez por linha (exceto em loops).' });
  }

  // Cost calculation for track laying per pair of stations
  const oldStations = line.stationIds;
  const newLength = stationIds.length;
  let trackLayingCost = 0;

  if (newLength > oldStations.length) {
    trackLayingCost = (newLength - oldStations.length) * 15000; // Line track lay fee Reduced from 45000
    if (gameState.economy.budget < trackLayingCost) {
      return res.status(400).json({ error: `Not enough budget to lay rails! Costs $${trackLayingCost}.` });
    }
  }

  // De-associate stations from line first
  Object.values(gameState.stations).forEach((s) => {
    if (s.connectedLines.includes(lineId)) {
      s.connectedLines = s.connectedLines.filter(id => id !== lineId);
    }
  });

  // Wire new station array
  line.stationIds = stationIds;
  stationIds.forEach((sId: string) => {
    const station = gameState.stations[sId];
    if (station && !station.connectedLines.includes(lineId)) {
      station.connectedLines.push(lineId);
    }
  });

  gameState.economy.budget -= trackLayingCost;

  res.json({ status: 'ok', gameState });
});

// DELETE: Delete a line
app.delete('/api/game/line/:id', (req, res) => {
  const { id } = req.params;
  if (gameState.lines[id]) {
    delete gameState.lines[id];

    // Remove train linkages
    Object.keys(gameState.trains).forEach((tId) => {
      if (gameState.trains[tId].lineId === id) {
        delete gameState.trains[tId];
      }
    });

    // Remove stations connection
    Object.values(gameState.stations).forEach((s) => {
      s.connectedLines = s.connectedLines.filter(lineRef => lineRef !== id);
    });

    res.json({ status: 'ok', gameState });
  } else {
    res.status(404).json({ error: 'Line not found' });
  }
});

// DELETE: Delete a station
app.delete('/api/game/station/:id', (req, res) => {
  const { id } = req.params;
  if (gameState.stations[id]) {
    delete gameState.stations[id];

    // Remove from lines connection lists
    Object.values(gameState.lines).forEach((line) => {
      line.stationIds = line.stationIds.filter(sId => sId !== id);
    });

    res.json({ status: 'ok', gameState });
  } else {
    res.status(404).json({ error: 'Station not found' });
  }
});

// POST: Deploy/Assign train to line
app.post('/api/game/train', (req, res) => {
  const { lineId, name, capacity, speed } = req.body;
  const line = gameState.lines[lineId];
  if (!line) {
    return res.status(404).json({ error: 'Line not found' });
  }

  if (line.stationIds.length === 0) {
    return res.status(400).json({ error: 'Deploy fails: Target line has no stations mapped!' });
  }

  const capVal = Math.max(40, Math.min(600, parseInt(capacity) || 120));
  const spdVal = Math.max(40, Math.min(200, parseInt(speed) || 80));
  const trainCost = Math.floor(20000 + (capVal * 100) + (spdVal * 80)); // Reduced from 50000 + 200 + 150

  if (gameState.economy.budget < trainCost) {
    return res.status(400).json({ error: `Insufficient funds! This custom locomotive config costs $${trainCost.toLocaleString()}.` });
  }

  const startStation = gameState.stations[line.stationIds[0]];
  const id = 'train-' + Date.now();
  const train: Train = {
    id,
    name: name || `Metrolink #${Object.keys(gameState.trains).length + 1}`,
    lineId,
    capacity: capVal,
    occupancy: 0,
    speed: spdVal,
    lat: startStation.lat,
    lng: startStation.lng,
    currentStationId: startStation.id,
    targetStationIndex: 1 % line.stationIds.length,
    direction: 1,
    maintenance: 100,
    status: 'boarding',
    delayTicks: 0,
    energyConsumption: 12, // kW per movement tick
    boardingTimer: 2
  };

  gameState.trains[id] = train;
  gameState.economy.budget -= trainCost;

  res.json({ status: 'ok', gameState });
});

// POST: Repair train
app.post('/api/game/train/maintain', (req, res) => {
  const { id } = req.body;
  const train = gameState.trains[id];
  if (!train) return res.status(404).json({ error: 'Train not found' });

  const maintenanceCost = 15000;
  if (gameState.economy.budget < maintenanceCost) {
    return res.status(400).json({ error: 'Insufficient funds' });
  }

  train.maintenance = 100;
  train.status = 'boarding';
  train.boardingTimer = 2;
  gameState.economy.budget -= maintenanceCost;

  res.json({ status: 'ok', gameState });
});

// POST: Change ticket pricing
app.post('/api/game/economy/ticket', (req, res) => {
  const { ticketPrice } = req.body;
  if (ticketPrice && ticketPrice >= 0.5 && ticketPrice <= 15) {
    gameState.economy.ticketPrice = parseFloat(ticketPrice);
    res.json({ status: 'ok', gameState });
  } else {
    res.status(400).json({ error: 'Price must be between $0.50 and $15.00' });
  }
});

// POST: Set speed scale
app.post('/api/game/time/speed', (req, res) => {
  const { timeSpeed } = req.body;
  if (timeSpeed !== undefined && [0, 1, 2, 3].includes(timeSpeed)) {
    gameState.timeSpeed = timeSpeed;
    res.json({ status: 'ok', gameState });
  } else {
    res.status(400).json({ error: 'Speed scale must be 0 (paused), 1, 2, or 3.' });
  }
});

// POST: Secure Game Loans
app.post('/api/game/loan/take', (req, res) => {
  const { amount } = req.body;
  const parsedAmt = parseInt(amount);
  if (!parsedAmt || ![100000, 250000, 500000].includes(parsedAmt)) {
    return res.status(400).json({ error: 'Loans restricted to size groups: $100,000, $250,000 and $500,000.' });
  }

  // Limit to max 3 loans active
  if (gameState.economy.loans.length >= 3) {
    return res.status(400).json({ error: 'A max of 3 active loans allowed simultaneously!' });
  }

  const interestMultiplier = 1.15; // 15% debt markup
  const interestRate = 15;
  const repaymentSpanTicks = 120; // payment divisions

  const loan: Loan = {
    id: 'loan-' + Date.now(),
    amount: parsedAmt,
    remainingAmount: Math.floor(parsedAmt * interestMultiplier),
    interestRate,
    paymentPerTick: Math.floor((parsedAmt * interestMultiplier) / repaymentSpanTicks)
  };

  gameState.economy.loans.push(loan);
  gameState.economy.budget += parsedAmt;

  res.json({ status: 'ok', gameState });
});

// POST: Repay loan instantly
app.post('/api/game/loan/repay', (req, res) => {
  const { loanId } = req.body;
  const loanIdx = gameState.economy.loans.findIndex(l => l.id === loanId);
  if (loanIdx === -1) return res.status(404).json({ error: 'Loan index not found' });

  const loan = gameState.economy.loans[loanIdx];
  if (gameState.economy.budget < loan.remainingAmount) {
    return res.status(400).json({ error: 'Insufficient funds' });
  }

  gameState.economy.budget -= loan.remainingAmount;
  gameState.economy.loans.splice(loanIdx, 1);

  res.json({ status: 'ok', gameState });
});

// --- AI INTELLIGENT GEMINI ADVISOR ENDPOINT ---
app.post('/api/gemini/advisor', async (req, res) => {
  try {
    const ai = getGeminiClient();

    if (!ai) {
      // Elegant rule-based backup if GEMINI_API_KEY is not configured
      const simulatedReports = [
        "**AI Transit Review**: The system operates reliably. Adding intersections between lines in Manhattan or Shibuya would trigger additional transfer opportunities. Keep ticket pricing around $2.50 to $3.50 to maximize both passenger satisfaction and budget recovery.",
        "**AI Transit Review**: Station overcrowding warning! Commuter queues at residential sectors are increasing. Deploy high-capacity trains (capacity 200+) to clear rush-hour congestion.",
        "**AI Transit Review**: Budget is balanced, but CO2 counts are static. Expand subway routes to connect commercial districts and lower car pollution in surrounding neighborhoods."
      ];
      const feedFallback: CitizenPost[] = [
        { id: `c-${Date.now()}-1`, handle: '@GeminiAI', avatar: '✨', text: 'Transit recommendation loaded. Connecting terminal hubs creates high economic gains.', sentiment: 'positive', timestamp: 'Advisor' },
        { id: `c-${Date.now()}-2`, handle: '@SubwayGuru', avatar: '🧠', text: 'Advisor suggests upgrading station ticketing gates to support higher flow.', sentiment: 'neutral', timestamp: 'Advisor' }
      ];

      // Add one advisor post into citizen posts as live AI advisory!
      gameState.citizenPosts.unshift(feedFallback[Math.random() > 0.5 ? 0 : 1]);
      if (gameState.citizenPosts.length > 25) gameState.citizenPosts.pop();

      return res.json({
        report: simulatedReports[Math.floor(Math.random() * simulatedReports.length)],
        event: null,
        advisorFeed: feedFallback
      });
    }

    // Call real Gemini API models/gemini-3.5-flash as default, passing actual gameplay data
    const activeStationsSummarized = Object.values(gameState.stations).map(s => ({
      name: s.name,
      maintenance: s.maintenanceLevel.toFixed(0) + '%',
      waitingCount: Object.values(s.waitingPassengers).reduce((a, b) => a + b, 0)
    }));

    const activeLinesSummarized = Object.values(gameState.lines).map(l => ({
      name: l.name,
      stationsConnectedCount: l.stationIds.length
    }));

    const budget = gameState.economy.budget;
    const ticketPrice = gameState.economy.ticketPrice;
    const activeTrains = Object.keys(gameState.trains).length;

    const prompt = `
      You are the Chief AI Transit Architect for a subway simulation sandbox game.
      Analyze the current game circumstances:
      - Active City: ${gameState.cities[gameState.currentCityId]?.name || 'Unknown'}
      - Station Layouts: ${JSON.stringify(activeStationsSummarized)}
      - Active Subway Lines: ${JSON.stringify(activeLinesSummarized)}
      - Train fleet size: ${activeTrains} running trains.
      - Budget limits: $${budget}
      - Ticket Fare: $${ticketPrice}

      Generate a brief, highly engaging report (150 words max, in Markdown):
      1. An **AI Transit Review** summarizing and scoring the player's current system spacing, financial margins, or crowd flow.
      2. Choose if a **Simulation Event** should trigger (e.g. Sports Match, Heatwave, Snowstorm, Tech Conference, Union negotiation) that will change demand or speed factors. State this clearly.
      3. Return 2 mock citizen social media posts commenting on the system (with witty, realistic handles, modern emojis, and text).

      Analyze carefully and return a JSON matching this exact structure:
      {
        "report": "Your detailed Markdown report",
        "event": {
          "title": "Event Name (or null if none)",
          "description": "Short explanation of impact",
          "type": "weather" or "sports" or "strike" or "growth" or "emergency",
          "severity": "low" or "medium" or "high",
          "passengerMultiplier": 1.5, // multiplier to passenger generation
          "speedMultiplier": 0.8, // weather delays
          "durationTicks": 40
        },
        "posts": [
          { "handle": "@HandleName", "avatar": "emoji", "text": "Witty comment", "sentiment": "positive" or "neutral" or "negative" }
        ]
      }
    `;

    let response;
    try {
      response = await withRetry(() => ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              report: { type: Type.STRING },
              event: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  type: { type: Type.STRING },
                  severity: { type: Type.STRING },
                  passengerMultiplier: { type: Type.NUMBER },
                  speedMultiplier: { type: Type.NUMBER },
                  durationTicks: { type: Type.NUMBER }
                },
                required: ["title", "description", "type", "severity", "passengerMultiplier", "speedMultiplier", "durationTicks"]
              },
              posts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    handle: { type: Type.STRING },
                    avatar: { type: Type.STRING },
                    text: { type: Type.STRING },
                    sentiment: { type: Type.STRING }
                  },
                  required: ["handle", "avatar", "text", "sentiment"]
                }
              }
            },
            required: ["report", "posts"]
          }
        }
      }));
    } catch (apiErr) {
      console.error("Gemini Advisor failure (fallback triggered):", apiErr);
      return res.json({
        report: "**AI Advisor (Offline Mode)**: The transit network is being analyzed by backup systems. Focus on maintaining high maintenance levels across all stations and ensuring your budget remains positive during localized rush hours.",
        event: null,
        posts: [
          { handle: "@SystemAdvisory", avatar: "🤖", text: "Heuristic backup mode active. AI analysis temporarily unavailable due to capacity.", sentiment: "neutral" }
        ]
      });
    }

    const body = response.text ? JSON.parse(response.text.trim()) : null;
    if (body) {
      // Apply Event to GameState if triggered
      if (body.event && body.event.title) {
        const gameEv: GameEvent = {
          id: 'ev-' + Date.now(),
          title: body.event.title,
          description: body.event.description,
          type: body.event.type,
          severity: body.event.severity,
          ticksRemaining: body.event.durationTicks || 60,
          passengerMultiplier: body.event.passengerMultiplier || 1.3,
          speedMultiplier: body.event.speedMultiplier || 0.9
        };
        gameState.activeEvents.push(gameEv);
      }

      // Add feedback posts to citizen stream
      if (body.posts && Array.isArray(body.posts)) {
        body.posts.forEach((post: { handle: string; avatar: string; text: string; sentiment: "positive" | "neutral" | "negative" }) => {
          const amPm = gameState.hour >= 12 ? 'PM' : 'AM';
          const displayHour = gameState.hour % 12 || 12;
          const displayMinute = gameState.minute.toString().padStart(2, '0');
          gameState.citizenPosts.unshift({
            id: 'post-' + Math.random(),
            handle: post.handle,
            avatar: post.avatar || '🚍',
            text: post.text,
            sentiment: post.sentiment || 'neutral',
            timestamp: `${displayHour}:${displayMinute} ${amPm}`
          });
        });
        if (gameState.citizenPosts.length > 25) {
          gameState.citizenPosts = gameState.citizenPosts.slice(0, 25);
        }
      }

      return res.json({
        report: body.report,
        event: body.event || null,
        posts: body.posts || []
      });
    }

    res.status(500).json({ error: 'Failed to process AI parsing content' });
  } catch (err: any) {
    console.error('Gemini call error:', err);
    res.status(500).json({ error: 'Gemini server error: ' + err.message });
  }
});

interface SavedGame {
  id: string;
  name: string;
  timestamp: string;
  cityName: string;
  cityId: string;
  budget: number;
  stationsCount: number;
  linesCount: number;
  trainsCount: number;
  gameState: any;
}

let serverSavedGames: { [id: string]: SavedGame } = {};

// GET: List all available saved games
app.get('/api/game/save-list', (req, res) => {
  const list = Object.values(serverSavedGames).map(save => ({
    id: save.id,
    name: save.name,
    timestamp: save.timestamp,
    cityName: save.cityName,
    cityId: save.cityId,
    budget: save.budget,
    stationsCount: save.stationsCount,
    linesCount: save.linesCount,
    trainsCount: save.trainsCount
  }));
  res.json({ saves: list });
});

// POST: Save the current game state
app.post('/api/game/save', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Save slot name is required' });

  const id = 'save-' + Date.now();
  const currentCity = gameState.cities[gameState.currentCityId];
  const cityName = currentCity ? currentCity.name : 'Unknown City';

  const newSave: SavedGame = {
    id,
    name,
    timestamp: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    cityName,
    cityId: gameState.currentCityId,
    budget: gameState.economy.budget,
    stationsCount: Object.keys(gameState.stations).length,
    linesCount: Object.keys(gameState.lines).length,
    trainsCount: Object.keys(gameState.trains).length,
    gameState: JSON.parse(JSON.stringify(gameState)) // Deep copy
  };

  serverSavedGames[id] = newSave;
  res.json({ success: true, save: { id, name: newSave.name } });
});

// POST: Load a saved game from the server
app.post('/api/game/load', (req, res) => {
  const { id } = req.body;
  const targetSave = serverSavedGames[id];
  if (!targetSave) return res.status(404).json({ error: 'Save file not found on the server.' });

  gameState = JSON.parse(JSON.stringify(targetSave.gameState));
  res.json({ success: true, gameState });
});

// POST: Direct payload raw restore (manual uploaded JSON strings or localStorage fallbacks)
app.post('/api/game/load-raw', (req, res) => {
  const { uploadedState } = req.body;
  if (!uploadedState || typeof uploadedState !== 'object') {
    return res.status(400).json({ error: 'Invalid game state payload' });
  }

  gameState = JSON.parse(JSON.stringify(uploadedState));
  res.json({ success: true, gameState });
});

// Configure Vite integration for SPA fallback
async function bootServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Express server listening on http://0.0.0.0:${PORT}`);
  });
}

bootServer();
