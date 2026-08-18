import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  gradient: "blue" | "green" | "gold" | "red-orange" | "navy";
  change?: string;
  badge?: ReactNode;
  trending?: "up" | "down";
  onClick?: () => void;
}

const gradients = {
  blue: "from-[#0E4EBD] to-[#1E70E8]",
  green: "from-[#22C55E] to-[#16A34A]",
  gold: "from-[#FFC107] to-[#F59E0B]",
  "red-orange": "from-[#EF4444] to-[#F97316]",
  navy: "from-[#001A4D] to-[#0E4EBD]",
};

export function MetricCard({
  title,
  value,
  icon: Icon,
  gradient,
  change,
  badge,
  trending,
  onClick,
}: MetricCardProps) {
  return (
    <div
      onClick={onClick}
      className={`relative bg-gradient-to-br ${gradients[gradient]} rounded-2xl p-6 text-white overflow-hidden shadow-sm ${
        onClick ? "cursor-pointer hover:shadow-lg hover:scale-[1.01] transition-all group" : ""
      }`}
    >
      {/* Icon Container */}
      <div className="absolute top-6 left-6 w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm group-hover:bg-white/30 transition-colors">
        <Icon className="w-6 h-6" />
      </div>

      {/* Badge or Trending Arrow */}
      <div className="absolute top-6 right-6">
        {badge ? (
          badge
        ) : trending === "up" ? (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        ) : trending === "down" ? (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17l5-5m0 0l-5-5m5 5H6" />
          </svg>
        ) : null}
      </div>

      {/* Content */}
      <div className="mt-16">
        <div className="text-4xl sm:text-5xl font-bold mb-2 font-mono tracking-tight">{value}</div>
        <div className="text-white/90 text-sm font-semibold mb-2">{title}</div>
        {change && <div className="text-white/80 text-xs font-medium">{change}</div>}
      </div>
    </div>
  );
}
