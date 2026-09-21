// Original SVG pixel illustrations. No external assets, copied packaging or raster dependencies.
import {writeFile} from 'node:fs/promises';
const ink='#18213d',cream='#fff5d2',pink='#ff72b8',aqua='#69efe1',lime='#a4ff35',purple='#9865dc';
const letters={
 A:['01110','11011','11011','11111','11011','11011','11011'],B:['11110','11011','11011','11110','11011','11011','11110'],
 C:['01111','11000','11000','11000','11000','11000','01111'],D:['11110','11011','11011','11011','11011','11011','11110'],
 E:['11111','11000','11000','11110','11000','11000','11111'],H:['11011','11011','11011','11111','11011','11011','11011'],
 I:['11111','00100','00100','00100','00100','00100','11111'],K:['11011','11011','11110','11100','11110','11011','11011'],
 L:['11000','11000','11000','11000','11000','11000','11111'],O:['01110','11011','11011','11011','11011','11011','01110'],
 R:['11110','11011','11011','11110','11100','11010','11011'],S:['01111','11000','11000','01110','00011','00011','11110'],
 T:['11111','00100','00100','00100','00100','00100','00100'],W:['11011','11011','11011','11011','11111','11111','01010'],
 X:['11011','11011','01110','00100','01110','11011','11011']
};
const text=(word,x,y,size=3,fill=ink)=>{let d='';for(const [i,c]of [...word].entries()){if(c===' ')continue;for(const [row,line]of letters[c].entries())for(const [col,v]of [...line].entries())if(v==='1')d+=`M${x+(i*6+col)*size} ${y+row*size}h${size}v${size}h-${size}z`;}return `<path d="${d}" fill="${fill}"/>`;};
const rect=(x,y,w,h,fill)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
const star=(x,y,s,fill)=>`<path d="M${x} ${y-s*3}h${s}v${s*2}h${s*2}v${s}h-${s*2}v${s*2}h-${s}v-${s*2}h-${s*2}v-${s}h${s*2}z" fill="${fill}"/>`;
const whale=(x,y,scale=1)=>`<g transform="translate(${x} ${y}) scale(${scale})"><path d="M0 27h15V12h15V3h58v9h17v11h12v34h-12v12H35V58H15V47H0V27z" fill="${ink}"/><path d="M8 32h16V17h14V10h47v10h13v11h12v20H98v11H38V51H24V39H8z" fill="${aqua}"/><path d="M39 45h58v10H83v7H43z" fill="${cream}"/><path d="M48 10h17V-4h8v-9h9v8h-8V9h-9v8H48z" fill="${aqua}"/>${rect(81,27,10,10,ink)}${rect(81,27,4,4,cream)}${rect(46,45,50,5,ink)}${rect(20,43,9,9,pink)}</g>`;
const svg=(title,description,content)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img" shape-rendering="crispEdges"><title>${title}</title><desc>${description}</desc>${content}</svg>\n`;

const tub=svg('Whale Wax — salt water special','An original pixel-art surf wax tub with a hot-pink lid, mint whale mascot, cream label and purple shadow.',`
 <path d="M65 316h270v15h-18v13H87v-13H65z" fill="${ink}" opacity=".18"/>
 <path d="M66 178h272v116h-14v17h-24v14H99v-14H77v-17H66z" fill="${ink}"/>
 <path d="M76 180h251v105h-17v16h-25v14H110v-12H88v-19H76z" fill="${purple}"/>
 <path d="M78 185h239v77h-12v20H92v-20H78z" fill="${cream}"/>
 ${rect(78,207,13,45,'#ead99f')}${rect(301,208,17,42,'#e4cdd3')}
 <path d="M70 117h15V99h29V85h169v13h29v16h22v17h16v55h-13v20h-32v15H100v-13H74v-19H57v-53h13z" fill="${ink}"/>
 <path d="M68 145h270v34h-14v17h-28v14H109v-12H82v-20H68z" fill="#b93181"/>
 <path d="M80 126h16v-17h29V95h149v13h29v15h21v17h14v22h-18v17h-28v11H108v-13H83v-15H68v-21h12z" fill="${pink}"/>
 <path d="M93 127h26v-18h153v13h28v15h18v18h-23v18H111v-15H88v-18h5z" fill="${cream}"/>
 <path d="M128 116h142v9H115v-8h13z" fill="#ffbcde"/>
 ${text('WHALE',142,120,4)}${text('WAX',175,155,3)}
 ${whale(120,216,1)}${text('WAX',242,221,3)}
 ${text('COLD',113,292,1.6,cream)}${text('WATER',183,292,1.6,cream)}
 ${rect(94,274,20,7,pink)}${rect(94,281,10,7,pink)}${rect(284,274,20,7,aqua)}${rect(294,281,10,7,aqua)}
 ${star(48,120,7,lime)}${star(345,251,6,pink)}${star(307,62,4,aqua)}
`);
const board=svg('The Surfboard','An upright mint and pink pixel surfboard with a yellow stringer, whale sticker, checker rails and a coiled leash.',`
 <path d="M117 359h150v12H117z" fill="${ink}" opacity=".18"/>
 <path d="M194 21h16v13h15v18h14v23h13v31h10v211h-12v26h-23v17h-52v-17h-23v-26h-12V107h10V76h13V53h15V35h16z" fill="${ink}"/>
 <path d="M194 35h15v16h13v22h13v30h12v212h-11v23h-24v11h-28v-11h-20v-24h-10V107h10V77h13V56h14V35z" fill="${aqua}"/>
 <path d="M200 36h9v313h-9z" fill="#ffe660"/><path d="M183 59h10v260h-10z" fill="${cream}"/>
 <path d="M155 235h39v13h-25v16h25v16h-39zM211 107h35v18h-35v17h35v17h-35z" fill="${pink}"/>
 ${Array.from({length:8},(_,i)=>rect(i%2?236:225,168+i*14,11,14,i%2?ink:cream)).join('')}
 ${whale(163,178,.55)}
 ${text('WAX',169,283,3,ink)}
 <path d="M233 334h31v-17h20v12h-11v23h-29v14h49v-14h11v-15h10v24h-11v15h-68v-10h-14z" fill="${ink}"/>
 ${star(102,119,6,cream)}${star(286,82,5,pink)}${star(103,291,4,lime)}
`);
const brick=svg('Holy Brick of Kek','A neon-green pixel brick with glowing runes, a lime top face and a little sacred frog seal.',`
 <path d="M82 297h247v16H82z" fill="#80ff2822"/>
 <path d="M63 189l185-53 96 49v90l-182 57-99-47z" fill="#09291d"/>
 <path d="M77 190l170-43 78 39-168 48z" fill="${lime}"/>
 <path d="M78 205l72 39v70l-72-37z" fill="#27b847"/>
 <path d="M164 244l167-48v71l-167 50z" fill="#48ee55"/>
 <path d="M84 191l70 33 157-39-65-29z" fill="#cfff73"/>
 <path d="M167 248l153-43v11l-153 44zM84 209l55 28v9l-55-28z" fill="#cfff99"/>
 <g transform="matrix(1,-.29,0,1,181,263)">${text('KEK',0,0,6,'#073627')}</g>
 <path d="M169 179h13v-10h13v10h30v-10h13v10h13v20h-13v10h-56v-10h-13z" fill="#20934c"/>
 ${rect(183,180,7,7,cream)}${rect(231,180,7,7,cream)}${rect(196,198,29,5,'#062d21')}
 ${star(97,121,8,lime)}${star(301,107,6,'#d4ff9c')}${star(346,322,6,lime)}${star(58,303,4,lime)}
 <path d="M177 109V74h8v35zM142 117l-17-28 7-5 17 28zM222 108l21-25 6 6-21 25z" fill="#a4ff35"/>
`);
const crown=svg('Captain’s Drip','A gold pixel crown with turquoise gems, pink velvet, star tips and a whale-tail crest.',`
 <path d="M82 299h240v15H82z" fill="${ink}" opacity=".18"/>
 <path d="M70 137h21l41 54 56-94h25l55 93 43-55h20l-25 167H91z" fill="${ink}"/>
 <path d="M86 158l46 54 65-102 66 103 49-52-20 124H106z" fill="#ffce45"/>
 <path d="M110 219l22 10 65-93 64 94 33-22-9 48H116z" fill="#f89b35"/>
 <path d="M121 245h163v25H121z" fill="${pink}"/>
 ${rect(101,275,198,15,cream)}${rect(111,291,179,11,'#bd7730')}
 <path d="M181 226h30v11h11v27h-11v11h-30v-11h-11v-27h11z" fill="${ink}"/>
 ${rect(181,238,30,25,aqua)}${rect(181,238,11,11,cream)}${rect(138,246,14,14,aqua)}${rect(248,246,14,14,aqua)}
 ${star(78,130,9,cream)}${star(196,89,9,aqua)}${star(321,129,9,pink)}
`);
for(const [name,content]of Object.entries({'wax-tub':tub,surfboard:board,'holy-brick':brick,'captain-crown':crown}))await writeFile(new URL('../public/art/'+name+'.svg',import.meta.url),name==='surfboard'?content.replace('0 0 400 400','85 0 255 400'):content);
console.log('Four original pixel SVG illustrations generated.');
