import React from 'react';
import { Search } from 'lucide-react';
import { useStationStore } from '../../store/stationStore';
import type { ChargerType } from '../../types';

export const PillFilter: React.FC = () => {
  const { 
    activeFilter, setActiveFilter, 
    selectedConnector, setSelectedConnector,
    onlyAvailable, setOnlyAvailable,
    searchQuery, setSearchQuery
  } = useStationStore();

  const connectors = [
    { id: 'All', label: '모든 커넥터', speed: 'All' },
    { id: 'DC Combo', label: 'DC 콤보', speed: '급속' },
    { id: 'Chademo', label: '차데모', speed: '급속' },
    { id: 'AC 5핀', label: 'AC 5핀 (완속)', speed: '완속' },
    { id: 'Slow', label: 'AC 완속', speed: '완속' }
  ];

  // [설계 6.2] 상향 참조: 커넥터 선택 시 상위 속도 필터 자동 연동
  const handleConnectorClick = (id: string, speed: string) => {
    setSelectedConnector(id);
    if (speed !== 'All' && activeFilter !== speed) {
      setActiveFilter(speed as ChargerType);
    }
  };

  return (
    <div className="space-y-4 w-full">
      {/* 0. 지능형 검색 바 (통합형) */}
      <div className="relative w-full">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="충전소 이름 또는 주소를 검색하세요..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-gray-50 border-none rounded-2xl py-3.5 pl-10 pr-4 text-sm font-bold text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-inner"
        />
      </div>

      {/* 1. 충전 타입 필터 (대분류) */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {['All', '급속', '완속'].map((type) => (
          <button
            key={type}
            onClick={() => {
              setActiveFilter(type as any);
              // [설계 6.2] 하향 제어: 속도 변경 시 맞지 않는 커넥터 초기화
              if (type !== 'All' && selectedConnector !== 'All') {
                const conn = connectors.find(c => c.id === selectedConnector);
                if (conn && conn.speed !== type && conn.speed !== 'All') {
                  setSelectedConnector('All');
                }
              }
            }}
            className={`px-5 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap border ${
              activeFilter === type 
                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100' 
                : 'bg-white text-gray-500 border-gray-100 hover:border-blue-200'
            }`}
          >
            {type === 'All' ? '전체 속도' : type}
          </button>
        ))}
      </div>

      {/* 2. 커넥터 타입 필터 (소분류) */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {connectors.map((conn) => {
          // [설계 6.2] 하향 제어: 상위 필터와 맞지 않는 항목 Dimmed 처리
          const isDisabled = activeFilter !== 'All' && conn.speed !== 'All' && conn.speed !== activeFilter;
          
          return (
            <button
              key={conn.id}
              onClick={() => handleConnectorClick(conn.id, conn.speed)}
              disabled={isDisabled}
              className={`px-4 py-1.5 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap border ${
                selectedConnector === conn.id 
                  ? 'bg-gray-900 text-white border-gray-900' 
                  : isDisabled
                    ? 'bg-gray-50 text-gray-200 border-gray-50 cursor-not-allowed'
                    : 'bg-white text-gray-400 border-gray-100 hover:border-gray-300'
              }`}
            >
              {conn.label}
            </button>
          );
        })}
      </div>

      {/* 3. 이용 가능 여부 스위치 */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => setOnlyAvailable(!onlyAvailable)}
          className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${
            onlyAvailable ? 'bg-blue-600' : 'bg-gray-200'
          }`}
        >
          <span
            className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
              onlyAvailable ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
        <span className="text-xs font-bold text-gray-500">현재 이용 가능한 곳만 보기</span>
      </div>
    </div>
  );
};
