export interface District {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number; // in meters/degrees
  type: 'residential' | 'commercial' | 'industrial' | 'leisure' | 'tourism';
  density: number; // 0 to 100
  population: number;
}

export interface City {
  id: string;
  name: string;
  lat: number;
  lng: number;
  population: number;
  districts: District[];
}

export type TrackType = 'underground' | 'elevated' | 'highspeed';

export interface Station {
  id: string;
  name: string;
  lat: number;
  lng: number;
  capacity: number;
  connectedLines: string[]; // line IDs
  waitingPassengers: { [targetStationId: string]: number }; // where they are headed
  upgradeLevel: number; // 1 to 5
  maintenanceLevel: number; // 0 to 100
  accessibilityScore: number; // 0 to 100
  ticketGatesCount: number;
  platformWidth: number;
}

export interface Line {
  id: string;
  name: string;
  color: string;
  stationIds: string[]; // ordered station sequence
  type: TrackType;
  isActive: boolean;
  statistics?: {
    totalPassengersCarried: number;
    currentTrainsCount: number;
    dailyRevenue: number;
  };
}

export interface Train {
  id: string;
  name: string;
  lineId: string;
  capacity: number;
  occupancy: number;
  speed: number; // km/h
  lat: number;
  lng: number;
  currentStationId: string | null;
  targetStationIndex: number; // index in line.stationIds
  direction: 1 | -1; // forward or backward
  maintenance: number; // 100% down to 0% (warning)
  status: 'running' | 'boarding' | 'stopped' | 'broken';
  delayTicks: number; // ticks before next move
  energyConsumption: number; // kw/h
  boardingTimer: number; // ticks remaining for boarding
}

export interface Loan {
  id: string;
  amount: number;
  remainingAmount: number;
  interestRate: number;
  paymentPerTick: number;
}

export interface Economy {
  budget: number;
  ticketPrice: number;
  revenue: number;
  expenses: {
    maintenance: number;
    electricity: number;
    staff: number;
    loans: number;
  };
  loans: Loan[];
  totalCO2Saved: number; // in metric tons
  totalCarReduced: number; // number of cars off roads
}

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  type: 'emergency' | 'sports' | 'weather' | 'strike' | 'growth';
  severity: 'low' | 'medium' | 'high';
  ticksRemaining: number;
  affectedStationIds?: string[];
  affectedDistrictIds?: string[];
  passengerMultiplier?: number;
  speedMultiplier?: number;
}

export interface CitizenPost {
  id: string;
  handle: string;
  avatar: string;
  text: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  timestamp: string;
}

export interface GameState {
  currentCityId: string;
  cities: { [id: string]: City };
  stations: { [id: string]: Station };
  lines: { [id: string]: Line };
  trains: { [id: string]: Train };
  economy: Economy;
  hour: number; // 0-23
  minute: number; // 0-59
  day: number;
  timeSpeed: number; // 0 (paused), 1 (normal), 2 (fast), 3 (super-fast)
  activePassengersCount: number;
  deliveredPassengersCount: number;
  activeEvents: GameEvent[];
  citizenPosts: CitizenPost[];
}

export interface SimulationTickResponse {
  gameState: GameState;
  eventsTriggered: string[];
}
