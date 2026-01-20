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

const normalizeWebLocation = () => {
  if (typeof window === "undefined") return;
  const { pathname = "/", search = "" } = window.location;
  const params = new URLSearchParams(search);
  if (params.get("screen")) return;
  const normalizedPath = String(pathname ?? "").replace(/^\/+/, "");
  if (!normalizedPath) return;
  params.set("screen", normalizedPath);
  const nextSearch = params.toString();
  const nextUrl = nextSearch ? `/?${nextSearch}` : "/";
  window.history.replaceState(window.history.state, "", nextUrl);
};

if (Platform.OS === 'web') {
  require('./global.css');
  normalizeWebLocation();
  applyChromeDesktopZoom();
}

registerRootComponent(App);
