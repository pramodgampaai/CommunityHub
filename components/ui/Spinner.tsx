
import React from 'react';

const Spinner: React.FC = () => {
  return (
    <div className="flex justify-center items-center p-8 gpu-accelerated">
      <div
        className="w-10 h-10 border-[3px] border-brand-500/20 border-t-brand-500 rounded-full animate-spin shadow-sm"
        style={{ animationDuration: '0.6s' }}
      ></div>
    </div>
  );
};

export default Spinner;
