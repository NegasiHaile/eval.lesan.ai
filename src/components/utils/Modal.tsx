import { Dispatch, ReactNode, SetStateAction } from "react";
import { X } from "lucide-react";

type ModalProps = {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  children: ReactNode;
  className?: string;
};

export default function Modal({
  isOpen,
  setIsOpen,
  children,
  className,
}: ModalProps) {
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 bg-gray-800/80"
          onClick={() => setIsOpen(false)}
        >
          <div
            className={`relative w-fit bg-white dark:bg-gray-900 rounded-lg md:p-6 mx-4 md:mx-5 shadow-lg ${className}`}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 cursor-pointer absolute top-2 right-2 rounded-full transition-all duration-300 dark:hover:bg-gray-800/50 hover:scale-110 focus:outline-none"
            >
              <X className="size-5 transition-all duration-300" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
