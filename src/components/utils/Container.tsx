import React from "react";

type ContainerProps = { children: React.ReactNode; className?: string };

const Container = ({ children, className }: ContainerProps) => {
  return (
    <div
      className={`w-full flex flex-col justify-center items-center p-3 md:px-12 md:py-12 ${className}`}
    >
      {children}
    </div>
  );
};

export default Container;
