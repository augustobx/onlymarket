import type {MetadataRoute} from "next";
export default function manifest():MetadataRoute.Manifest {
 return {id:"/",name:"OnlyMarket | NanoLabs",short_name:"OnlyMarket",description:"Gestión integral de comercios",start_url:"/",scope:"/",display:"standalone",background_color:"#f5f7fa",theme_color:"#087c61",lang:"es-AR",icons:[{src:"/market-icon.svg",sizes:"any",type:"image/svg+xml",purpose:"any"}]};
}
