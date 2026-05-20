import React, { useState } from 'react';
import { City } from '../types';
import { Search, MapPin, Globe, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

interface CitySelectorProps {
  currentCityId: string;
  cities: { [id: string]: City };
  onSelectCity: (cityId: string) => void;
  onCustomCityLoaded: (name: string, lat: number, lng: number) => void;
}

export const CitySelector: React.FC<CitySelectorProps> = ({
  currentCityId,
  cities,
  onSelectCity,
  onCustomCityLoaded
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);

  const handleSearchCommit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setErrorText(null);
    setSearchResults([]);

    try {
      // Free OpenStreetMap geo-searching with proper user-agent tags
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
         )}&limit=5`,
        {
          headers: {
            'Accept-Language': 'en-US,en;q=0.9',
          },
        }
      );
      const data = await response.json();

      if (data && data.length > 0) {
        setSearchResults(data);
      } else {
        setErrorText('No cities found matching that search query. Try another name!');
      }
    } catch (err) {
      console.error(err);
      setErrorText('Error connecting to maps database. Please check your internet connection.');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectPrediction = (place: any) => {
    const lat = parseFloat(place.lat);
    const lng = parseFloat(place.lon);
    const shortName = place.display_name.split(',')[0];

    onCustomCityLoaded(shortName, lat, lng);
    setSearchQuery('');
    setSearchResults([]);
  };

  return (
    <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 p-4 text-white shadow-xl flex flex-col gap-3" id="city-selector-card">
      <div 
        className="flex items-center justify-between cursor-pointer select-none" 
        onClick={() => setIsExpanded(!isExpanded)}
        id="city-selector-header"
      >
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-200">
            City Sandbox
          </h3>
        </div>
        <button
          type="button"
          className="text-[10px] text-emerald-400 font-mono font-bold uppercase hover:text-emerald-300 transition-colors flex items-center gap-1 cursor-pointer"
        >
          {isExpanded ? (
            <>
              Ficar Slim <ChevronUp className="w-3.5 h-3.5" />
            </>
          ) : (
            <>
              Expandir <ChevronDown className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="flex flex-col gap-3 animate-fade-in" id="city-selector-contents">
          {/* Preset Swaps Grid */}
          <div className="grid grid-cols-2 gap-2" id="preload-cities-grid">
            {Object.keys(cities)
              .filter((id) => ['nyc', 'tokyo', 'london', 'paris', 'saopaulo'].includes(id))
              .map((id) => {
                const city = cities[id];
                const isSelected = id === currentCityId;
                
                const cityTraits: { [k: string]: { label: string; color: string } } = {
                  nyc: { label: 'Never Sleeps (2x Nights)', color: 'text-amber-400' },
                  tokyo: { label: 'Megacity Demand', color: 'text-cyan-400' },
                  london: { label: 'High Yield (+25% ticket)', color: 'text-purple-400' },
                  paris: { label: 'Tourism Spikes', color: 'text-pink-400' },
                  saopaulo: { label: 'Rush Hour Hub (+50%)', color: 'text-emerald-400' }
                };
                const trait = cityTraits[id] || { label: 'Alternative Sandbox', color: 'text-slate-400' };

                return (
                  <button
                    key={id}
                    onClick={() => onSelectCity(id)}
                    className={`py-2 px-3 rounded-xl text-left font-sans font-medium text-xs border transition-all flex flex-col gap-2 justify-between min-h-[72px] cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200'
                    }`}
                    id={`city-button-${id}`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-slate-100">{city.name}</span>
                      <span className={`text-[9px] font-mono leading-tight ${trait.color}`}>
                        {trait.label}
                      </span>
                    </div>
                    <span className="text-[10px] opacity-75 font-mono">
                      {(city.population / 1000000).toFixed(1)}M citizens
                    </span>
                  </button>
                );
              })}
          </div>

          {/* Search Custom City Form */}
          <form onSubmit={handleSearchCommit} className="relative mt-1" id="custom-city-search-form">
            <div className="relative">
              <input
                type="text"
                placeholder="Search any world city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/40 border border-white/10 text-xs rounded-xl py-2.5 pl-3 pr-10 focus:outline-none focus:border-indigo-500 text-slate-200 font-sans"
                id="city-search-input"
              />
              <button
                type="submit"
                disabled={searching}
                className="absolute right-1 top-1 text-slate-400 hover:text-white p-1.5 active:scale-95 transition-all text-xs"
                id="city-search-submit"
              >
                {searching ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : <Search className="w-4 h-4" />}
              </button>
            </div>

            {/* Search Results Drawer popup */}
            {searchResults.length > 0 && (
              <div className="absolute left-0 right-0 mt-2 bg-black/95 border border-white/10 rounded-xl max-h-48 overflow-y-auto shadow-2xl z-[1200] divide-y divide-white/5" id="search-predictions-box">
                {searchResults.map((place) => (
                  <button
                    key={place.place_id}
                    type="button"
                    onClick={() => handleSelectPrediction(place)}
                    className="w-full text-left py-2 px-3 text-[11px] text-slate-300 hover:bg-white/5 hover:text-white flex items-center gap-2 font-sans transition-colors"
                  >
                    <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="truncate">{place.display_name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Errors details */}
            {errorText && (
              <p className="text-[10px] text-rose-450 mt-1.5 font-sans leading-relaxed">
                ⚠️ {errorText}
              </p>
            )}
          </form>
        </div>
      )}
    </div>
  );
};
