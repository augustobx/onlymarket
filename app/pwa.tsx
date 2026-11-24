"use client";
import {useEffect} from "react";
export default function Pwa(){
 useEffect(()=>{if(window.isSecureContext&&"serviceWorker" in navigator&&process.env.NODE_ENV==="production")navigator.serviceWorker.register("/sw.js",{scope:"/"}).catch(()=>{});},[]);
 return null;
}
