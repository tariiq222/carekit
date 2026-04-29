import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';

type Props = ComponentProps<typeof Ionicons>;

export function DirectionalIcon({ style, ...rest }: Props) {
  return <Ionicons {...rest} style={[{ transform: [{ scaleX: -1 }] }, style]} />;
}
