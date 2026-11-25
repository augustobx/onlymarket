const L=["0001101","0011001","0010011","0111101","0100011","0110001","0101111","0111011","0110111","0001011"];
const G=["0100111","0110011","0011011","0100001","0011101","0111001","0000101","0010001","0001001","0010111"];
const P=["LLLLLL","LLGLGG","LLGGLG","LLGGGL","LGLLGG","LGGLLG","LGGGLL","LGLGLG","LGLGGL","LGGLGL"];

export function ean13(code){
 if(typeof code!=="string"||!/^\d{13}$/.test(code))return null;
 const digits=[...code].map(Number);
 const sum=digits.slice(0,12).reduce((a,d,i)=>a+d*(i%2?3:1),0);
 if((10-sum%10)%10!==digits[12])return null;
 let bits="101";
 for(let i=1;i<=6;i++)bits+=(P[digits[0]][i-1]==="L"?L:G)[digits[i]];
 bits+="01010";
 for(let i=7;i<13;i++)bits+=L[digits[i]].replace(/[01]/g,b=>b==="0"?"1":"0");
 return bits+"101";
}

export function decodeWeight(code,prefix){
 if(!prefix||!/^2\d$/.test(prefix)||typeof code!=="string"||!code.startsWith(prefix)||!ean13(code))return null;
 const grams=Number(code.slice(7,12));if(grams<=0)return null;
 return {plu:code.slice(2,7),quantityMilli:grams};
}

export function encodeWeightEan13(prefix,plu,grams){
 if(!prefix||!/^2\d$/.test(prefix)||!plu||!/^\d{5}$/.test(plu))return null;
 const weight=typeof grams==="bigint"?Number(grams):Number(grams);
 if(!Number.isInteger(weight)||weight<1||weight>99999)return null;
 const body=prefix+plu+String(weight).padStart(5,"0");
 const sum=[...body].reduce((a,d,i)=>a+Number(d)*(i%2?3:1),0);
 return body+String((10-sum%10)%10);
}
