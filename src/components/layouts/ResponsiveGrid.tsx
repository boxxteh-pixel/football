import React from 'react';
import { View, type ViewStyle } from 'react-native';

interface ResponsiveGridProps {
  /** Number of columns. 1 = simple vertical stack. */
  columns: number;
  /** Gap between items (both row and column), in px. */
  gap?: number;
  style?: ViewStyle;
  children?: React.ReactNode;
}

/**
 * Lays children out in an N-column responsive grid.
 *
 * - `columns === 1` falls back to a clean vertical stack (mobile).
 * - On wider screens each cell takes an equal fraction of the row with a CSS
 *   `gap`. Grids are only ever rendered with >1 column on web (desktop/tablet),
 *   so `calc()` widths are safe here.
 */
export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  columns,
  gap = 16,
  style,
  children,
}) => {
  const items = React.Children.toArray(children).filter(Boolean);

  if (columns <= 1) {
    return <View style={[{ gap }, style]}>{children}</View>;
  }

  const cellWidth = `calc((100% - ${gap * (columns - 1)}px) / ${columns})` as unknown as number;

  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap } as ViewStyle, style]}>
      {items.map((child, i) => (
        <View key={i} style={{ width: cellWidth }}>
          {child}
        </View>
      ))}
    </View>
  );
};
