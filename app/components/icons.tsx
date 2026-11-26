import type {SVGProps} from "react";

export type IconName=
 |"home"|"bell"|"cart"|"box"|"grid"|"truck"|"scale"|"trace"|"tag"|"receipt"|"wallet"|"chart"|"settings"
 |"search"|"plus"|"minus"|"trash"|"check"|"x"|"alert"|"clock"|"printer"|"barcode"|"users"|"building"
 |"shield"|"sun"|"moon"|"palette"|"chevronLeft"|"chevronRight"|"chevronDown"|"arrowUpRight"|"layers"
 |"sparkles"|"filter"|"sliders"|"refresh"|"logOut"|"user"|"packageCheck"|"beef"|"cheese"|"apple"
 |"shoppingBag"|"creditCard"|"banknote"|"landmark"|"store"|"info"|"menu"|"help";

const paths:Record<IconName,string[]>={
 home:["M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"],
 bell:["M6 8a6 6 0 0 1 12 0c0 7 3 8 3 10H3c0-2 3-3 3-10","M10 21a2 2 0 0 0 4 0"],
 cart:["M2 3h3l2.6 11.2a1 1 0 0 0 1 .8h9.7a1 1 0 0 0 1-.8L21 7H6","M9 20a1 1 0 1 0 0 .01","M18 20a1 1 0 1 0 0 .01"],
 box:["M12 2 3 6.5v11L12 22l9-4.5v-11z","M3 6.5 12 11l9-4.5","M12 11v11"],
 grid:["M3 3h7v7H3z","M14 3h7v7h-7z","M3 14h7v7H3z","M14 14h7v7h-7z"],
 truck:["M1 4h14v12H1z","M15 8h4l3 4v4h-7z","M5.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z","M18.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"],
 scale:["M12 3v18","M5 6h14","M5 6 2 13h6z","M19 6l-3 7h6z","M8 21h8"],
 trace:["M6 3v12","M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z","M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z","M18 9a9 9 0 0 1-9 9"],
 tag:["M12 2H4a2 2 0 0 0-2 2v8l9.2 9.2a2 2 0 0 0 2.8 0l6.2-6.2a2 2 0 0 0 0-2.8z","M7 7h.01"],
 receipt:["M4 2h16v20l-3-2-2.5 2L12 20l-2.5 2L7 20l-3 2z","M8 7h8","M8 11h8","M8 15h5"],
 wallet:["M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z","M16 12h5v3h-5a1.5 1.5 0 0 1 0-3z","M5 5l11-2v2"],
 chart:["M3 3v18h18","M7 16v-4","M12 16V8","M17 16v-7"],
 settings:["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z","M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"],
 search:["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z","m21 21-4.35-4.35"],
 plus:["M12 5v14","M5 12h14"],
 minus:["M5 12h14"],
 trash:["M3 6h18","M8 6V4h8v2","M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6","M10 11v6","M14 11v6"],
 check:["M20 6 9 17l-5-5"],
 x:["M18 6 6 18","M6 6l12 12"],
 alert:["M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z","M12 9v4","M12 17h.01"],
 clock:["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z","M12 6v6l4 2"],
 printer:["M6 9V2h12v7","M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2","M6 14h12v8H6z"],
 barcode:["M3 5v14","M7 5v14","M11 5v14","M14 5v14","M17 5v14","M21 5v14"],
 users:["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2","M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z","M22 21v-2a4 4 0 0 0-3-3.87","M16 3.13a4 4 0 0 1 0 7.75"],
 building:["M3 21h18","M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16","M9 7h2","M13 7h2","M9 11h2","M13 11h2","M9 21v-4h6v4"],
 shield:["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z","m9 12 2 2 4-4"],
 sun:["M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z","M12 2v2","M12 20v2","m4.9 4.9 1.4 1.4","m17.7 17.7 1.4 1.4","M2 12h2","M20 12h2","m4.9 19.1 1.4-1.4","m17.7 6.3 1.4-1.4"],
 moon:["M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"],
 palette:["M12 22a10 10 0 1 1 10-10c0 2.2-1.8 4-4 4h-1.8a1.5 1.5 0 0 0-1.1 2.5c.6.7.9 1.5.4 2.4-.7 1-1.9 1.1-3.5 1.1z","M7.5 10.5h.01","M10.5 7.5h.01","M14.5 7.5h.01","M17 11h.01"],
 chevronLeft:["m15 18-6-6 6-6"],
 chevronRight:["m9 18 6-6-6-6"],
 chevronDown:["m6 9 6 6 6-6"],
 arrowUpRight:["M7 17 17 7","M7 7h10v10"],
 layers:["m12 2 10 5-10 5L2 7z","m2 12 10 5 10-5","m2 17 10 5 10-5"],
 sparkles:["M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8z","M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"],
 filter:["M22 3H2l8 9.5V19l4 2v-8.5z"],
 sliders:["M4 21v-7","M4 10V3","M12 21v-9","M12 8V3","M20 21v-5","M20 12V3","M1 14h6","M9 8h6","M17 16h6"],
 refresh:["M21 12a9 9 0 0 1-15.4 6.4L3 16","M3 12a9 9 0 0 1 15.4-6.4L21 8","M3 21v-5h5","M21 3v5h-5"],
 logOut:["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4","m16 17 5-5-5-5","M21 12H9"],
 user:["M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2","M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"],
 packageCheck:["M12 2 3 6.5v11L12 22l9-4.5v-11z","M3 6.5 12 11l9-4.5","M12 11v11","m9 15 2 2 4-4"],
 beef:["M12.5 5c3.5 0 6.5 2.4 6.5 6s-2.5 7-7.5 7C7 18 4 15.8 4 12.2 4 8.4 7.7 5 12.5 5z","M10 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"],
 cheese:["M3 11 16 4l5 5v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z","M3 11h18","M9 15.5h.01","M14 14.5h.01"],
 apple:["M12 6c-1.5-2-4.5-2-6 0-2 2.5-1.5 7.5 1 11 1.3 1.8 3 2.5 5 1.8 2 .7 3.7 0 5-1.8 2.5-3.5 3-8.5 1-11-1.5-2-4.5-2-6 0z","M12 6c0-2 1.2-3.5 3-4"],
 shoppingBag:["M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z","M3 6h18","M16 10a4 4 0 0 1-8 0"],
 creditCard:["M2 5h20v14H2z","M2 10h20","M6 15h4"],
 banknote:["M2 6h20v12H2z","M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z","M6 12h.01","M18 12h.01"],
 landmark:["M3 21h18","M3 10h18","M12 3 2 8h20z","M5 10v8","M10 10v8","M14 10v8","M19 10v8"],
 store:["M3 9 4.5 4h15L21 9","M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0","M4 11v9h16v-9","M9 20v-6h6v6"],
 info:["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z","M12 16v-4","M12 8h.01"],
 menu:["M4 6h16","M4 12h16","M4 18h16"],
 help:["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z","M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3","M12 17h.01"],
};

export function Icon({name,size=18,className="",...rest}:{name:IconName;size?:number;className?:string}&SVGProps<SVGSVGElement>){
 const list=paths[name]??paths.box;
 return (
  <svg
   width={size}
   height={size}
   viewBox="0 0 24 24"
   fill="none"
   stroke="currentColor"
   strokeWidth="1.8"
   strokeLinecap="round"
   strokeLinejoin="round"
   className={`nl-icon ${className}`.trim()}
   aria-hidden="true"
   {...rest}
  >
   {list.map((d,i)=><path key={i} d={d}/>)}
  </svg>
 );
}
