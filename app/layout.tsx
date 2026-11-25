import type {ReactNode} from "react";
import "./globals.css";
import "./product.css";
import Pwa from "./pwa";
import {ThemeProvider} from "./theme/ThemeProvider";
export const metadata={title:"OnlyMarket | NanoLabs",description:"Gestión comercial y trazabilidad"};
export default function RootLayout({children}:{children:ReactNode}){
 return <html lang="es-AR" data-theme="light" suppressHydrationWarning><body><ThemeProvider>{children}</ThemeProvider><Pwa/></body></html>;
}
