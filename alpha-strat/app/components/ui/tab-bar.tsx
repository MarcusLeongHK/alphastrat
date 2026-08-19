"use client";

import { useRef, useEffect, useState } from "react";

interface Tab {
  key: string;
  label: string;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (key: string) => void;
}

export function TabBar({ tabs, activeTab, onChange }: TabBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const activeIndex = tabs.findIndex((t) => t.key === activeTab);
    const buttons = container.querySelectorAll<HTMLButtonElement>("button");
    const btn = buttons[activeIndex];
    if (btn) {
      setIndicator({
        left: btn.offsetLeft,
        width: btn.offsetWidth,
      });
    }
  }, [activeTab, tabs]);

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`relative z-10 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? "text-text-primary"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        className="absolute bottom-0 h-0.5 rounded-full bg-accent transition-all duration-200"
        style={{ left: indicator.left, width: indicator.width }}
      />
    </div>
  );
}
