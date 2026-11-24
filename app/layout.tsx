import type {ReactNode} from "react";
import "./globals.css";
export const metadata={title:"OnlyMarket | NanoLabs",description:"Gestión comercial y trazabilidad"};
export default function RootLayout({children}:{children:ReactNode}){return <html lang="es-AR"><body>{children}</body></html>}
