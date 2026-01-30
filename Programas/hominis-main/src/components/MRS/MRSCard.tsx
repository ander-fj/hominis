import { ReactNode, useState } from 'react';
import { motion } from 'framer-motion';
import { LucideIcon, ChevronDown, ChevronUp } from 'lucide-react';

interface MRSCardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
  icon?: LucideIcon;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export default function MRSCard({
  title,
  subtitle,
  children,
  className = '',
  action,
  icon: Icon,
  collapsible = false,
  defaultOpen = true
}: MRSCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white rounded shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200 ${className}`}
    >
      {(title || action) && (
        <div
          className={`px-4 py-3 border-b border-gray-200 flex items-center justify-between ${collapsible ? 'cursor-pointer hover:bg-gray-50' : ''}`}
          onClick={() => collapsible && setIsOpen(!isOpen)}
        >
          <div className="flex items-center gap-1.5">
            {Icon && (
              <div className="w-8 h-8 bg-gradient-to-br from-[#912325] to-[#701a1c] rounded-lg flex items-center justify-center shadow-md">
                <Icon className="w-4 h-4 text-white" />
              </div>
            )}
            <div>
              {title && <h3 className="text-base font-semibold text-[#912325]">{title}</h3>}
              {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {action}
            {collapsible && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-gray-500">
                  {isOpen ? 'Ocultar' : 'Mostrar'}
                </span>
                {isOpen ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {(!collapsible || isOpen) && (
        <div className="p-2.5">
          <div className="p-2">{children}</div>
        </div>
      )}
    </motion.div>
  );
}
