import React from "react";

type CheckboxProps = {
  label?: string | null;
  checked: boolean;
  onClick: () => void;
};

const Checkbox = ({
  label = null,
  checked = false,
  onClick,
}: CheckboxProps) => {
  return (
    <div
      className="flex items-center space-x-2 cursor-pointer"
      onClick={onClick}
    >
      <div
        className={`flex items-center justify-center w-5 h-5 border-2 rounded ${
          checked ? "bg-blue-500 text-white border-blue-500" : "border-gray-300"
        }`}
      >
        {checked && "✔"}
      </div>
      {label && <span>{label}</span>}
    </div>
  );
};

export default Checkbox;
