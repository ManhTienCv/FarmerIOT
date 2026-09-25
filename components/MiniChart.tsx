import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Svg, Defs, LinearGradient, Stop, Path, Circle } from 'react-native-svg';
import type { SensorHistoryPoint } from '@/types';
import { colors } from '@/constants/theme';

interface MiniChartProps {
  data: SensorHistoryPoint[];
  color?: string;
  height?: number;
  showDot?: boolean;
}

function MiniChartComponent({
  data,
  color = colors.primary[400],
  height = 120,
  showDot = true,
}: MiniChartProps) {
  const { path, areaPath, lastPoint } = useMemo(() => {
    if (data.length < 2) return { path: '', areaPath: '', lastPoint: null };
    const width = 300;
    const pad = 6;
    const values = data.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const stepX = (width - pad * 2) / (data.length - 1);

    const points = data.map((d, i) => {
      const x = pad + i * stepX;
      const y = pad + (1 - (d.value - min) / range) * (height - pad * 2);
      return { x, y };
    });

    let p = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx = (prev.x + curr.x) / 2;
      p += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
    }
    const last = points[points.length - 1];
    const a = `${p} L ${last.x} ${height - pad} L ${points[0].x} ${height - pad} Z`;

    return { path: p, areaPath: a, lastPoint: last };
  }, [data, height]);

  if (!path) return <View style={{ height }} />;

  const gid = `grad-${color.replace('#', '')}`;

  return (
    <View style={[styles.container, { height }]}>
      <Svg width="100%" height={height} viewBox={`0 0 300 ${height}`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity="0.20" />
            <Stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </LinearGradient>
        </Defs>
        <Path d={areaPath} fill={`url(#${gid})`} />
        <Path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {showDot && lastPoint && (
          <>
            <Circle cx={lastPoint.x} cy={lastPoint.y} r={6} fill={color} opacity={0.18} />
            <Circle cx={lastPoint.x} cy={lastPoint.y} r={3.5} fill={color} />
            <Circle cx={lastPoint.x} cy={lastPoint.y} r={1.5} fill="#FFFFFF" />
          </>
        )}
      </Svg>
    </View>
  );
}

const MiniChart = memo(MiniChartComponent);
export default MiniChart;

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
});
