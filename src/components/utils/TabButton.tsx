import React from "react";

type TabButtonProps = {
  text: string;
  onClick: () => void;
  active: boolean;
  className?: string;
};

const TabButton = ({ text, onClick, active, className }: TabButtonProps) => {
  return (
    <button
      onClick={onClick}
      className={`border-t-1 border-x-1 ${
        active ? "border-neutral-300 dark:border-neutral-800" : "border-transparent"
      } rounded-t p-2 cursor-pointer ${className}`}
    >
      {text}
    </button>
  );
};

export default TabButton;
