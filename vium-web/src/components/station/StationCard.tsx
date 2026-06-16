import React, { useMemo } from 'react';
import { Zap, Star, ChevronRight, Coins } from 'lucide-react';
import type { ChargingStation } from '../../types';
import { useStationStore } from '../../store/stationStore';

interface StationCardProps {
  station: ChargingStation;
  onClick: (station: ChargingStation) => void;
}

export const StationCard: React.FC<StationCardProps> = ({ station, onClick }) => {
  const { getAvailableSlots, userLocation } = useStationStore();
  
  const availableSlots = getAvailableSlots(station);
  const totalSlots = station.chargers.length;
  
  // 전체 상태 결정
  const displayStatus = availableSlots > 0 ? 'Available' : (station.chargers.some(c => c.status === 'Charging') ? 'Charging' : 'Faulty');

  // 실시간 거리 계산 (Haversine)
  const displayDistance = useMemo(() => {
    if (!userLocation || !station.latitude || !station.longitude) return station.distance || '- km';
    
    const lat1 = userLocation.lat;
    const lon1 = userLocation.lng;
    const lat2 = Number(station.latitude);
    const lon2 = Number(station.longitude);
    
    const R = 6371; // km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`;
  }, [userLocation, station.latitude, station.longitude, station.distance]);

  return (
    <div 
      onClick={() => onClick(station)}
      className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all group cursor-pointer active:scale-[0.98] relative overflow-hidden"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
            displayStatus === 'Available' ? 'bg-green-100 text-green-600' :
            displayStatus === 'Charging' ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${
              displayStatus === 'Available' ? 'bg-green-500' :
              displayStatus === 'Charging' ? 'bg-blue-500' : 'bg-red-500'
            }`}></span>
            {displayStatus === 'Available' ? '이용 가능' : displayStatus === 'Charging' ? '충전 중' : '점검 중'}
          </div>
        </div>
        <span className="text-[11px] font-black text-blue-500 uppercase tracking-tighter">{displayDistance}</span>
      </div>

      <div className="mb-4">
        <h4 className="text-lg font-black text-gray-900 group-hover:text-blue-600 transition-colors flex items-center gap-2 mb-1">
          {station.station_name}
        </h4>
        <div className="flex items-center gap-2">
          <p className="text-xs text-gray-400 font-medium line-clamp-1 flex-1">{station.address}</p>
          {station.reviews && station.reviews.length > 0 && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-yellow-50 rounded-lg">
              <Star size={10} className="text-yellow-500 fill-current" />
              <span className="text-[10px] text-yellow-700 font-black">
                {(station.reviews.reduce((acc, r) => acc + r.rating, 0) / station.reviews.length).toFixed(1)}
              </span>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-center justify-between border-t border-gray-50 pt-5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Zap size={14} className="text-blue-600" />
            <span className="text-sm font-black text-gray-900">{availableSlots} <span className="text-gray-300 font-bold">/ {totalSlots} 여유</span></span>
          </div>
          <div className="flex items-center gap-1.5">
            <Coins size={14} className="text-orange-500" />
            <span className="text-sm font-black text-gray-900">{station.price || 340}<span className="text-[10px] text-gray-300 ml-0.5 font-bold">원</span></span>
          </div>
        </div>
        
        <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-blue-600 group-hover:text-white transition-all transform group-hover:translate-x-1">
          <ChevronRight size={18} />
        </div>
      </div>
    </div>
  );
};
