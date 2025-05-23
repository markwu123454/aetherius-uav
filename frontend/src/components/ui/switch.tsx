import React from "react";

export const Switch = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
  <button
    onClick={onChange}
    className={`w-10 h-6 flex items-center rounded-full px-1 transition-colors duration-200 ${checked ? "bg-blue-600" : "bg-zinc-700"}`}
  >
    <div
      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${checked ? "translate-x-4" : "translate-x-0"}`}
    />
  </button>
);
