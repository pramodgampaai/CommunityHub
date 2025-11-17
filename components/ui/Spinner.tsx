import React from 'react';

const Spinner: React.FC = () => {
  return (
    <div className="flex justify-center items-center p-8">
      <div
        className="w-8 h-8 border-4 border-[var(--accent)] border-b-transparent rounded-full animate-spin"
        style={{ animationDuration: '0.75s' }}
      ></div>
    </div>
  );
};

export default Spinner;