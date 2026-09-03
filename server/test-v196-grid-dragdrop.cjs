'use strict';
/* v196 GRID/DRAG-DROP KANON - olu yol temizligi, stale-slot guvenli donus, opened grid gate */
const assert=require('assert');
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
let P=0;function T(n,c){assert(c,n);P++;}
/* 1) olu rackDrop (eski SWAP yolu) kalkti */
T('olu rackDrop tanimi yok',html.indexOf('function rackDrop(')<0);
T('kaldirma izi var',html.indexOf('v196: olu rackDrop')>=0);
/* 2) drop yolunda ikinci sokum satiri yok */
T('cift sokum satiri kalkti',html.indexOf('if(src.area==="rack")RACKS[src.row][src.slot]=null;')<0);
/* 3) kor slot restorasyonu tamamen kalkti - tek yazar safeRackReturn */
T('kor RACKS[src...]=t restorasyonu kalmadi',html.indexOf('RACKS[src.row][src.slot]=t')<0);
/* 4) opened grid gate blogu dogru yerde */
const gi=html.indexOf('v196 grid kanon');
T('gate blogu var',gi>=0);
const fpi=html.indexOf('fp=freePlace(freeRects(t)',gi);
T('gate blogu freePlace cagrisindan once',fpi>gi);
T('gate acilmis-el sartina bagli',/v196 grid kanon[\s\S]{0,700}E\.st\.players\[HSEAT\]\.opened/.test(html));
T('gate kaynaga guvenli donus yapiyor',/v196 grid kanon[\s\S]{0,900}restoreDraggedSource\(t,e,src\)/.test(html));
T('acilis staging toast korunur',html.indexOf('\u00d6nce a\u00e7\u0131l\u0131\u015f modunu se\u00e7')>=0);
/* 5) safeRackReturn davranis (slice-eval) */
const a0=html.indexOf('/*V196-SRR-BAS*/'),a1=html.indexOf('/*V196-SRR-SON*/');
T('SRR dilimi bulundu',a0>0&&a1>a0);
const mk=new Function('RACKS','SLOTS',html.slice(a0,a1)+';return safeRackReturn;');
function fresh(){const R=[[],[]];for(let i=0;i<15;i++){R[0][i]=null;R[1][i]=null}return R}
{const R=fresh();const f=mk(R,15);const t={};
 T('a: bos src slota donus true',f(t,{row:1,slot:4})===true);
 T('a: birebir yerinde',R[1][4]===t&&t.row===1&&t.slot===4&&t.area==='rack');}
{const R=fresh();const f=mk(R,15);const yerli={};R[0][6]=yerli;const t={};
 f(t,{row:0,slot:6});
 T('b: yerli tas ezilmedi',R[0][6]===yerli);
 T('b: en yakin bos slota indi',(R[0][5]===t)||(R[0][7]===t));}
{const R=fresh();const f=mk(R,15);for(let i=0;i<15;i++)R[0][i]={};const t={};
 T('c: satir doluyken true',f(t,{row:0,slot:3})===true);
 T('c: diger satira tasti',R[1].indexOf(t)>=0);}
{const R=fresh();const f=mk(R,15);const t={};
 f(t,{row:7,slot:99});
 T('d: bozuk src normalize edildi',t.area==='rack'&&(t.row===0||t.row===1)&&t.slot>=0&&t.slot<15);}
/* 6) restoreDraggedSource SRR kullaniyor */
const ri=html.indexOf('function restoreDraggedSource');
const rds=html.slice(ri,html.indexOf('function okeyRepDropTarget'));
T('rds SRR cagiriyor',rds.indexOf('safeRackReturn(t,src)')>=0);
/* 7) insert-shift canli yolu korunur */
T('insert-shift korunur',html.indexOf('if(left>=0&&right>=0)target=(i-left<=right-i)?left:right;')>=0);
/* 8) damga */
T('v196 damga',html.indexOf('gobek17-202-pair-visual-handoff')>=0);
T('v195 damga kalmadi',html.indexOf('gobek17-195-islek-legality-kanon')<0);
console.log('v196-grid-dragdrop: '+P+' PASS / 0 FAIL');
