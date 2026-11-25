import type {ReactNode} from "react";
import "./globals.css";
import Pwa from "./pwa";
import {ThemeProvider} from "./theme/ThemeProvider";
import {ToastProvider} from "./components/toast";

export const metadata={title:"OnlyMarket | NanoLabs",description:"Gestión comercial y trazabilidad"};

const themeInitScript=`(()=>{try{var t=localStorage.getItem("nl-theme")==="dark"?"dark":"light";var r=document.documentElement;r.setAttribute("data-theme",t);r.classList.toggle("dark",t==="dark");}catch{}})();`;

export default function RootLayout({children}:{children:ReactNode}){
 return (
  <html lang="es-AR" data-theme="light" suppressHydrationWarning>
   <head>
    <script dangerouslySetInnerHTML={{__html:themeInitScript}}/>
   </head>
   <body>
    <ThemeProvider>
     <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
    <Pwa/>
   </body>
  </html>
 );
}
