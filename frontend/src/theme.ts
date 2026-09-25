import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ColorScheme = "light" | "dark";
export type AccentName = "green" | "blue" | "red" | "purple" | "gold" | "orange" | "pink" | "teal" | "indigo" | "slate";

const accents: Record<AccentName, { primary: string; secondary: string; tertiary: string; onTertiary: string }> = {
  green: { primary:"#10B981", secondary:"#34D399", tertiary:"#D1FAE5", onTertiary:"#065F46" },
  blue: { primary:"#2563EB", secondary:"#60A5FA", tertiary:"#DBEAFE", onTertiary:"#1E40AF" },
  red: { primary:"#DC2626", secondary:"#F87171", tertiary:"#FEE2E2", onTertiary:"#991B1B" },
  purple: { primary:"#7C3AED", secondary:"#A78BFA", tertiary:"#EDE9FE", onTertiary:"#5B21B6" },
  gold: { primary:"#B7791F", secondary:"#D69E2E", tertiary:"#FEF3C7", onTertiary:"#78350F" },
  orange: { primary:"#EA580C", secondary:"#FB923C", tertiary:"#FFEDD5", onTertiary:"#9A3412" },
  pink: { primary:"#DB2777", secondary:"#F472B6", tertiary:"#FCE7F3", onTertiary:"#9D174D" },
  teal: { primary:"#0D9488", secondary:"#2DD4BF", tertiary:"#CCFBF1", onTertiary:"#115E59" },
  indigo: { primary:"#4F46E5", secondary:"#818CF8", tertiary:"#E0E7FF", onTertiary:"#3730A3" },
  slate: { primary:"#475569", secondary:"#94A3B8", tertiary:"#E2E8F0", onTertiary:"#334155" },
};

function palette(scheme: ColorScheme, accent: AccentName) {
  const a=accents[accent];
  const dark=scheme==="dark";
  return {
    surface: dark?"#09090B":"#FFFFFF", onSurface: dark?"#FAFAFA":"#09090B",
    surfaceSecondary: dark?"#18181B":"#F4F4F5", onSurfaceSecondary: dark?"#E4E4E7":"#18181B",
    surfaceTertiary: dark?"#27272A":"#E4E4E7", onSurfaceTertiary: dark?"#D4D4D8":"#27272A",
    surfaceInverse: dark?"#FAFAFA":"#18181B", onSurfaceInverse: dark?"#18181B":"#FAFAFA", muted: dark?"#A1A1AA":"#71717A",
    brand:a.primary,onBrand:"#FFFFFF",brandPrimary:a.primary,onBrandPrimary:"#FFFFFF",brandSecondary:a.secondary,onBrandSecondary:dark?"#FFFFFF":a.onTertiary,
    brandTertiary:dark?a.primary+"2E":a.tertiary,onBrandTertiary:dark?a.secondary:a.onTertiary,
    success:"#10B981",onSuccess:"#FFFFFF",warning:"#F59E0B",onWarning:"#FFFFFF",error:"#EF4444",onError:"#FFFFFF",info:dark?"#D4D4D8":"#3F3F46",onInfo:dark?"#18181B":"#FFFFFF",
    border:dark?"#27272A":"#E4E4E7",borderStrong:dark?"#52525B":"#A1A1AA",divider:dark?"#18181B":"#F4F4F5",
  };
}
export type ThemeColors = ReturnType<typeof palette>;
export const colors = palette("light","green");
export const accentOptions = Object.keys(accents) as AccentName[];
export async function loadDisplaySettings(){const [scheme,accent]=await Promise.all([AsyncStorage.getItem("circle.display.scheme"),AsyncStorage.getItem("circle.display.accent")]);return {scheme:(scheme==="dark"?"dark":"light") as ColorScheme,accent:((accent&&accent in accents)?accent:"green") as AccentName};}
export async function saveDisplaySettings(scheme:ColorScheme,accent:AccentName){await Promise.all([AsyncStorage.setItem("circle.display.scheme",scheme),AsyncStorage.setItem("circle.display.accent",accent)]);}
export function getThemeColors(scheme:ColorScheme,accent:AccentName){return palette(scheme,accent);}
type ThemeCtx={scheme:ColorScheme;accent:AccentName;colors:ThemeColors;setDisplay:(scheme:ColorScheme,accent:AccentName)=>Promise<void>;ready:boolean};
const ThemeContext=createContext<ThemeCtx>({scheme:"light",accent:"green",colors,ready:false,setDisplay:async()=>{}});
export function ThemeProvider({children}:{children:React.ReactNode}){
 const [scheme,setScheme]=useState<ColorScheme>("light"); const [accent,setAccent]=useState<AccentName>("green"); const [ready,setReady]=useState(false);
 useEffect(()=>{loadDisplaySettings().then(x=>{setScheme(x.scheme);setAccent(x.accent);setReady(true);});},[]);
 const setDisplay=async(s:ColorScheme,a:AccentName)=>{setScheme(s);setAccent(a);await saveDisplaySettings(s,a);};
 const value=useMemo(()=>({scheme,accent,colors:palette(scheme,accent),setDisplay,ready}),[scheme,accent,ready]);
 return React.createElement(ThemeContext.Provider,{value},children);
}
export function useTheme(){return useContext(ThemeContext);}
export function makeStyles<T extends StyleSheet.NamedStyles<T>|StyleSheet.NamedStyles<any>>(factory:(colors:ThemeColors)=>T&StyleSheet.NamedStyles<any>){return function(){const {colors}=useTheme();return useMemo(()=>StyleSheet.create(factory(colors)),[colors]);};}
export const spacing={xs:4,sm:8,md:12,lg:16,xl:24,xxl:32,xxxl:48};
export const radius={sm:6,md:12,lg:20,pill:999};
