import type {ReactNode} from "react";
import "./globals.css";
import Pwa from "./pwa";
export const metadata={title:"OnlyMarket | NanoLabs",description:"Gestión comercial y trazabilidad"};
export default function RootLayout({children}:{children:ReactNode}){return <html lang="es-AR"><body>{children}<Pwa/></body></html>}
