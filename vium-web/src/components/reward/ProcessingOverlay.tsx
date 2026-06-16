import React from 'react';
import { Loader2 } from 'lucide-react';

interface ProcessingOverlayProps {
  isProcessing: boolean;
}

export const ProcessingOverlay: React.FC<ProcessingOverlayProps> = ({ isProcessing }) => {
  if (!isProcessing) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-blue-600/90 backdrop-blur-md flex flex-col items-center justify-center text-white p-8 text-center">
      <Loader2 size={64} className="animate-spin mb-6 opacity-50" />
      <h2 className="text-3xl font-black mb-2 italic tracking-tighter uppercase">Waiting for Departure...</h2>
      <p className="text-blue-100 max-w-xs leading-relaxed">
        하드웨어 센서가 차량의 이동을 감지하고 있습니다. 충전 완료 후 즉시 이동하면 마일리지가 지급됩니다!
      </p>
      <div className="mt-10 w-48 h-1 bg-white/20 rounded-full overflow-hidden">
        <div className="h-full bg-white animate-progress"></div>
      </div>
    </div>
  );
};
