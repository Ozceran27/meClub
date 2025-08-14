import 'react-native-gesture-handler';
import 'react-native-reanimated'; // reanimated debe cargarse muy temprano

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
