// meClub/meClub/index.js
import "react-native-gesture-handler";
import "react-native-reanimated";
import { registerRootComponent } from "expo";
import { Platform } from "react-native";
import App from "./App";

const applyChromeDesktopZoom = () => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const userAgent = window.navigator.userAgent || "";
  const isDesktop = !/Mobi|Android|iPhone|iPad/i.test(userAgent);
  const isChrome = /Chrome/i.test(userAgent) && !/Edg|OPR|Brave/i.test(userAgent);

  if (isDesktop && isChrome) {
    document.documentElement.style.zoom = "0.9";
    document.body.style.zoom = "0.9";
  }
};

if (Platform.OS === 'web') {
  require('./global.css');
  applyChromeDesktopZoom();
}

registerRootComponent(App);
