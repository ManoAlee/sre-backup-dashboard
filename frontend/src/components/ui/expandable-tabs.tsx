"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface Tab {
  id?: string;
  title: string;
  icon: LucideIcon;
  type?: never;
}

interface Separator {
  type: "separator";
  id?: never;
  title?: never;
  icon?: never;
}

type TabItem = Tab | Separator;

interface ExpandableTabsProps {
  tabs: TabItem[];
  className?: string;
  activeColor?: string;
  onChange?: (index: number | null) => void;
  selectedIndex?: number | null;
}

const transition = { delay: 0.02, type: "spring" as const, bounce: 0.15, duration: 0.3 };

export function ExpandableTabs({
  tabs,
  className,
  activeColor = "text-sky-600 dark:text-sky-400",
  onChange,
  selectedIndex,
}: ExpandableTabsProps) {
  const [selected, setSelected] = React.useState<number | null>(selectedIndex ?? 0);
  const [hovered, setHovered] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (selectedIndex !== undefined && selectedIndex !== null) {
      setSelected(selectedIndex);
    }
  }, [selectedIndex]);

  const handleSelect = (index: number) => {
    setSelected(index);
    onChange?.(index);
  };

  const Separator = () => (
    <div className="mx-1 h-4 w-[1px] bg-slate-200 dark:bg-slate-700/80 shrink-0" aria-hidden="true" />
  );

  return (
    <div
      className={cn(
        "flex flex-nowrap items-center gap-1 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/90 backdrop-blur-md p-1 shadow-2xs overflow-hidden max-w-full",
        className
      )}
    >
      {tabs.map((tab, index) => {
        if (tab.type === "separator") {
          return <Separator key={`separator-${index}`} />;
        }

        const Icon = tab.icon;
        const isSelected = selected === index;
        const isHovered = hovered === index;
        const showTitle = isSelected || isHovered;

        return (
          <motion.button
            key={tab.title}
            onClick={() => handleSelect(index)}
            onMouseEnter={() => setHovered(index)}
            onMouseLeave={() => setHovered(null)}
            title={tab.title}
            layout
            transition={transition}
            className={cn(
              "relative flex items-center rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors duration-200 select-none cursor-pointer whitespace-nowrap shrink-0",
              isSelected
                ? cn(
                    "bg-white dark:bg-slate-800 shadow-xs text-sky-600 dark:text-sky-400 border border-slate-200/90 dark:border-slate-700 font-bold",
                    activeColor
                  )
                : "text-slate-600 dark:text-slate-400 hover:bg-white/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
            )}
          >
            <Icon size={16} className={isSelected ? "text-sky-600 dark:text-sky-400 shrink-0" : "text-slate-500 dark:text-slate-400 shrink-0"} />
            
            <AnimatePresence initial={false}>
              {showTitle && (
                <motion.span
                  initial={{ width: 0, opacity: 0, marginLeft: 0 }}
                  animate={{ width: "auto", opacity: 1, marginLeft: 6 }}
                  exit={{ width: 0, opacity: 0, marginLeft: 0 }}
                  transition={transition}
                  className="overflow-hidden whitespace-nowrap tracking-tight"
                >
                  {tab.title}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        );
      })}
    </div>
  );
}
