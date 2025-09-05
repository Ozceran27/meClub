import { DefaultTheme } from '@react-navigation/native';
import { colors as mc } from './tokens';

export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    mc,
  },
};

export default theme;
