import React from "react";
import { ScrollView, Text, View, useWindowDimensions } from "react-native";
import Svg, {
  G,
  Line,
  Rect,
  Text as SvgText,
} from "react-native-svg";

import { useColors } from "@/hooks/useColors";

export interface BarItem {
  label: string;
  value: number;
  /** optional sub-label shown below the name */
  sub?: string;
}

interface Props {
  data: BarItem[];
  /** label when data is empty */
  emptyLabel?: string;
}

const BAR_COLORS = [
  "#7c3aed",
  "#2563eb",
  "#059669",
  "#d97706",
  "#dc2626",
  "#0891b2",
  "#7c3aed",
  "#9333ea",
];

const PAD_L = 38;
const PAD_R = 12;
const PAD_T = 28;
const PAD_B = 44;
const CHART_H = 192;
const MIN_BAR_SLOT = 52; // px per bar slot

export function ProductionBarChart({ data, emptyLabel = "No data yet." }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const colors = useColors();

  if (data.length === 0) {
    return (
      <Text style={{ color: colors.mutedForeground, fontSize: 13, fontStyle: "italic", paddingVertical: 8 }}>
        {emptyLabel}
      </Text>
    );
  }

  // Chart dimensions
  const cardInnerW = screenWidth - 36 - 32; // page padding (18×2) + card padding (16×2)
  const minChartW = PAD_L + PAD_R + data.length * MIN_BAR_SLOT;
  const chartW = Math.max(cardInnerW, minChartW);
  const plotW = chartW - PAD_L - PAD_R;
  const plotH = CHART_H - PAD_B - PAD_T;
  const needsScroll = chartW > cardInnerW;

  // Scale
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const gridMax = maxVal <= 5
    ? maxVal + 1
    : Math.ceil(maxVal / (maxVal <= 20 ? 5 : maxVal <= 100 ? 10 : 50)) *
      (maxVal <= 20 ? 5 : maxVal <= 100 ? 10 : 50);

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    val: Math.round(gridMax * f),
    y: PAD_T + plotH - f * plotH,
  }));

  const slotW = plotW / data.length;
  const barW = Math.min(42, Math.max(14, slotW * 0.55));

  const chart = (
    <Svg width={chartW} height={CHART_H}>
      {/* Grid lines */}
      {gridLines.map(({ val, y }) => (
        <G key={val}>
          <Line
            x1={PAD_L} y1={y} x2={chartW - PAD_R} y2={y}
            stroke="#e2e8f0" strokeWidth={1}
          />
          <SvgText
            x={PAD_L - 5} y={y + 4}
            fontSize={9} fill="#94a3b8" textAnchor="end"
          >
            {val}
          </SvgText>
        </G>
      ))}

      {/* X-axis baseline */}
      <Line
        x1={PAD_L} y1={PAD_T + plotH}
        x2={chartW - PAD_R} y2={PAD_T + plotH}
        stroke="#cbd5e1" strokeWidth={1.5}
      />

      {/* Bars */}
      {data.map((d, i) => {
        const color = BAR_COLORS[i % BAR_COLORS.length];
        const rawBarH = (d.value / gridMax) * plotH;
        const barH = Math.max(rawBarH, d.value > 0 ? 3 : 0);
        const cx = PAD_L + i * slotW + slotW / 2;
        const x = cx - barW / 2;
        const y = PAD_T + plotH - barH;
        const nameStr = d.label.length > 9 ? d.label.slice(0, 8) + "…" : d.label;

        return (
          <G key={`bar-${i}`}>
            {/* Bar body */}
            <Rect
              x={x} y={y}
              width={barW} height={barH}
              fill={color} rx={4}
            />
            {/* Value label above bar */}
            {d.value > 0 && (
              <SvgText
                x={cx} y={y - 5}
                fontSize={10} fill={color}
                textAnchor="middle" fontWeight="bold"
              >
                {d.value}
              </SvgText>
            )}
            {/* Operator name */}
            <SvgText
              x={cx} y={CHART_H - 24}
              fontSize={9} fill="#475569"
              textAnchor="middle"
            >
              {nameStr}
            </SvgText>
            {/* Sub-label (e.g. target) */}
            {d.sub ? (
              <SvgText
                x={cx} y={CHART_H - 10}
                fontSize={8} fill="#94a3b8"
                textAnchor="middle"
              >
                {d.sub}
              </SvgText>
            ) : null}
          </G>
        );
      })}
    </Svg>
  );

  if (needsScroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {chart}
      </ScrollView>
    );
  }
  return chart;
}
