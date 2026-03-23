// ==UserScript==
// @name         Ronyrato
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  chilenito finalboss
// @author       healing
// @match        https://*.habblet.city/*
// @grant        none
// @run-at       document-start
// ==/UserScript==
(function(){
    'use strict';

    // ═══ ADBLOCK (otimizado — batch DOM removal, throttled observer) ═══
    const adSelectors=[
        'iframe[src*="ad"]','iframe[src*="banner"]','iframe[src*="doubleclick"]','iframe[src*="googlesyndication"]',
        'iframe[src*="adserver"]','iframe[src*="ads"]','iframe[id*="google_ads"]',
        '[class*="ad-"]','[class*="ad_"]','[class*="ads-"]','[class*="ads_"]',
        '[class*="advert"]','[class*="banner-ad"]','[class*="Ad-"]',
        '[id*="ad-"]','[id*="ad_"]','[id*="ads-"]','[id*="ads_"]','[id*="advert"]',
        '.ad-container','.ad-wrapper','.ad-banner','.ads-container',
        'div[class*="google-ad"]','div[class*="GoogleAd"]',
        'ins.adsbygoogle','div[data-ad]','div[data-ads]',
        '[class*="sponsor"]','[id*="sponsor"]',
        'div[class$="-ad"]','div[class$="_ad"]',
        'div[style*="z-index"][style*="position: fixed"]:not(#rx)',
        '.bottom.inverted','div.bottom.inverted',
        'div[class*="top"][class*="bottom"]',
    ];
    const adSelectorJoined=adSelectors.join(',');

    function killAds(){
        try{
            document.querySelectorAll(adSelectorJoined).forEach(el=>{
                if(el.id==='rx'||el.closest('#rx'))return;
                el.remove();
            });
            document.querySelectorAll('div[style*="display: flex"][style*="justify-content: center"]').forEach(el=>{
                if(el.querySelector('.top,.bottom,.inverted,iframe')||el.children.length<=2){
                    if(!el.closest('.nitro-')&&!el.closest('#rx')&&!el.querySelector('canvas'))el.remove();
                }
            });
            document.querySelectorAll('div[style*="position: fixed"],div[style*="position: absolute"]').forEach(el=>{
                if(el.id==='rx'||el.closest('#rx')||el.closest('.nitro-'))return;
                const s=el.style;
                if((s.zIndex>9000||s.zIndex>500)&&el.querySelector('iframe,img[src*="ad"],a[href*="ad"]'))el.remove();
            });
        }catch(e){}
    }

    function startAdBlock(){killAds();setTimeout(killAds,2000);setTimeout(killAds,5000);}
    if(document.body)startAdBlock();
    else document.addEventListener('DOMContentLoaded',startAdBlock);

    // ═══ CORE STATE ═══
    let gs=null,rawSend=null,looping=false,loopTimer=null,ms=68;
    let panelOpen=false,activeTab='pvp',selId=null,lastTarget=null,myId=null,settingMyId=false;
    let users=new Map(),roomIdxMap=new Map(),prevPos=new Map();
    let hkEnabled=true,hkMod='alt',hkHold=false;
    let whitelist=new Set(),persistFlood=false;
    let autoMode=false,autoNoFlood=false,autoDelayTimer=null,autoDelayMs=85;
    let chatHeader=null;
    let isWorkerSocket=false;
    let macros=[{text:':push',withTarget:true},{text:':pull',withTarget:true},{text:'',withTarget:false},{text:'',withTarget:false},{text:'',withTarget:false},{text:'',withTarget:false},{text:'',withTarget:false}];

    // ═══ DOUBLECLICK ═══
    let dcMouseEnabled=false, dcF1Enabled=false;
    let dcLastMouseX=0, dcLastMouseY=0;

    document.addEventListener('mousemove',e=>{dcLastMouseX=e.clientX;dcLastMouseY=e.clientY;},{passive:true});

    let dcMouseFiring=false;
    document.addEventListener('mousedown',e=>{
        if(dcMouseFiring)return;
        if(e.button!==0)return;
        if(!dcMouseEnabled)return;
        const t=e.target;
        if(!t||t.closest('#rx'))return;
        dcMouseFiring=true;
        const cx=e.clientX,cy=e.clientY,sx=e.screenX,sy=e.screenY;
        const b=true,c=true;
        t.dispatchEvent(new MouseEvent('mousedown',{bubbles:b,cancelable:c,clientX:cx,clientY:cy,screenX:sx,screenY:sy,button:0,detail:1,view:window}));
        t.dispatchEvent(new MouseEvent('mouseup',{bubbles:b,cancelable:c,clientX:cx,clientY:cy,screenX:sx,screenY:sy,button:0,detail:1,view:window}));
        t.dispatchEvent(new MouseEvent('click',{bubbles:b,cancelable:c,clientX:cx,clientY:cy,screenX:sx,screenY:sy,button:0,detail:1,view:window}));
        dcMouseFiring=false;
    },{capture:true});

    document.addEventListener('contextmenu',e=>{
        if(!dcMouseEnabled)return;
        if(e.target&&!e.target.closest('#rx')){e.preventDefault();e.stopPropagation();}
    },{capture:true});

    // ═══ BATCHED UI UPDATES ═══
    let uiDirty={users:false,pos:false,vs:false,vu:false};
    let uiRaf=null;
    function schedUI(){if(uiRaf)return;uiRaf=requestAnimationFrame(()=>{uiRaf=null;if(uiDirty.users){uiDirty.users=false;_uiUsers();}if(uiDirty.pos){uiDirty.pos=false;_uiPositions();}if(uiDirty.vs){uiDirty.vs=false;_uiVS();}if(uiDirty.vu){uiDirty.vu=false;_uiVU();}});}
    function uiUsers(){uiDirty.users=true;schedUI();}
    function uiPositions(){uiDirty.pos=true;schedUI();}
    function uiVS(){uiDirty.vs=true;schedUI();}
    function uiVU(){uiDirty.vu=true;schedUI();}

    // ═══ VOLLEYBALL STATE ═══
    let vEnabled=false,vHits=0,vBallPos=null,vMyPos=null;
    let vCoordBounds=null;
    let vMode='rage';

    const ROOMS={
        'Volleyball':{
            pos:[
                [[24,24],[25,24],[26,24],[27,24],[28,24],[29,24],[30,24],[31,24],[32,24],[24,25],[24,26],[24,27],[25,27],[25,26],[25,25],[26,25],[26,26],[26,27],[27,27],[27,26],[27,25],[28,25],[28,26],[28,27],[29,27],[29,26],[29,25],[30,25],[30,26],[30,27],[31,27],[31,26],[31,25],[32,25],[32,26],[32,27]],
                [[28,25],[28,24],[28,23],[28,22],[28,21],[28,20],[28,19],[27,19],[27,20],[27,21],[27,22],[27,23],[27,24],[27,25],[26,25],[26,24],[26,23],[26,22],[26,21],[26,20],[26,19],[25,19],[25,20],[25,21],[25,22],[25,23],[25,24],[25,25],[24,25],[24,24],[24,23],[24,22],[24,21],[24,20],[24,19]],
                [[28,25],[28,24],[28,23],[28,22],[28,21],[28,20],[28,19],[29,19],[29,20],[29,21],[29,22],[29,23],[29,24],[29,25],[30,25],[30,24],[30,23],[30,22],[30,21],[30,20],[30,19],[31,19],[31,20],[31,21],[31,22],[31,23],[31,24],[31,25],[32,25],[32,24],[32,23],[32,22],[32,21],[32,20],[32,19]],
                [[24,30],[24,31],[24,32],[24,33],[25,30],[25,31],[25,32],[25,33],[26,30],[26,31],[26,32],[26,33],[27,30],[27,31],[27,32],[27,33],[28,30],[28,31],[28,32],[28,33],[29,30],[29,31],[29,32],[29,33],[30,30],[30,31],[30,32],[30,33],[31,30],[31,31],[31,32],[31,33],[32,30],[32,31],[32,32],[32,33]],
                [[24,38],[24,37],[24,36],[24,35],[24,34],[24,33],[24,32],[25,32],[25,33],[25,34],[25,35],[25,36],[25,37],[25,38],[26,38],[26,37],[26,36],[26,35],[26,34],[26,33],[26,32],[27,32],[27,33],[27,34],[27,35],[27,36],[27,37],[27,38],[28,38],[28,37],[28,36],[28,35],[28,34],[28,33],[28,32]],
                [[28,38],[28,37],[28,36],[28,35],[28,34],[28,33],[28,32],[29,32],[29,33],[29,34],[29,35],[29,36],[29,37],[29,38],[30,38],[30,37],[30,36],[30,35],[30,34],[30,33],[30,32],[31,32],[31,33],[31,34],[31,35],[31,36],[31,37],[31,38],[32,38],[32,37],[32,36],[32,35],[32,34],[32,33],[32,32]]
            ]
        }
    };
    let vRoom='Volleyball';
    let vDetectedBallId=0;
    function R(){return ROOMS[vRoom]||null;}
    function ballId(){return vDetectedBallId;}
    function zones(){return R()?.pos||[];}
    let vAllTilesCache=null;
    function allTiles(){if(vAllTilesCache)return vAllTilesCache;const s=new Set();for(const z of zones())for(const[x,y]of z)s.add((x<<8)|y);vAllTilesCache=s;return s;}
    function tileKey(x,y){return(x<<8)|y;}
    let vZoneSets=null;
    function buildZoneSets(){const zz=zones();vZoneSets=zz.map(z=>{const s=new Set();for(const[x,y]of z)s.add(tileKey(x,y));return s;});}
    function inMyPos(x,y){if(vMyPos==null)return false;if(!vZoneSets)buildZoneSets();const s=vZoneSets[vMyPos];return s?s.has(tileKey(x,y)):false;}
    function detectMyPos(px,py){const zz=zones();for(let i=0;i<zz.length;i++){if(zz[i].some(t=>t[0]===px&&t[1]===py)){vMyPos=i;return i;}}vMyPos=null;return null;}
    function calcBounds(){
        const zz=zones();if(!zz.length){vCoordBounds={minX:0,maxX:200,minY:0,maxY:200};return;}
        let mnx=999,mxx=0,mny=999,mxy=0;
        for(const z of zz)for(const[x,y]of z){if(x<mnx)mnx=x;if(x>mxx)mxx=x;if(y<mny)mny=y;if(y>mxy)mxy=y;}
        vCoordBounds={minX:Math.max(0,mnx-5),maxX:mxx+5,minY:Math.max(0,mny-5),maxY:mxy+5};
    }
    function inBounds(x,y){if(!vCoordBounds)calcBounds();return x>=vCoordBounds.minX&&x<=vCoordBounds.maxX&&y>=vCoordBounds.minY&&y<=vCoordBounds.maxY;}

    let vRec=false,vRecIdx=0,vRecLast=null,vRecTime=0,vRecLines=[];
    let vCustomPos=[[],[],[],[],[],[]];
    function vRecCapture(x,y){if(!vRec)return;const now=Date.now(),k=`${x},${y}`;if(vRecLast===k&&(now-vRecTime)<600)return;vRecLast=k;vRecTime=now;const z=vCustomPos[vRecIdx],i=z.findIndex(t=>t[0]===x&&t[1]===y);if(i>=0){z.splice(i,1);vDbg(`➖ (${x},${y}) — ${z.length}`);}else{z.push([x,y]);vDbg(`✅ (${x},${y}) — ${z.length}`);}uiRC();}

    // ═══ GLOBAL PERFORMANCE OPTIMIZATIONS ═══
    const MV_REGEX=/mv (\d+),(\d+),/;
    const _td=new TextDecoder('utf-8');
    const H_USERS=0x0176,H_STATUS=0x0668,H_CLICK=0x082b,H_MODEL=0x07ef;
    const H_FURNI=0x0163,H_WALK=0x0cf8,H_FSTATE=0x05ad;
    const H_FURNI_UPDATE=0x0168;
    const H_ROLLER=0x022e;
    const H_PRECLICK=0x01af;

    // ═══ PRE-CLICK — auto roomIdx (aceita qualquer valor) ═══
    let preClickVal=0;
    const _preClickBuf=new ArrayBuffer(10),_preClickDv=new DataView(_preClickBuf);
    _preClickDv.setInt32(0,6);_preClickDv.setInt16(4,H_PRECLICK);_preClickDv.setInt32(6,0);

    const gH=b=>{try{return b.byteLength>=6?new DataView(b).getInt16(4):null;}catch(e){return null;}};
    function log(m){console.log(`%c[RX]%c ${m}`,'color:#58a6ff;font-weight:bold','');}
    // ═══ FIX: TextDecoder para UTF-8 (nicks com acento/símbolo) ═══
    function rStr(dv,o){if(o+2>dv.byteLength)return null;const l=dv.getUint16(o);if(l>2000||o+2+l>dv.byteLength)return null;const s=_td.decode(new Uint8Array(dv.buffer,dv.byteOffset+o+2,l));return{v:s,s,n:o+2+l};}
    function rInt(dv,o){return o+4>dv.byteLength?null:{v:dv.getInt32(o),n:o+4};}
    // ═══ FIX: Limite 30 chars + aceita qualquer unicode válido ═══
    function isName(s){if(!s||s.length<1||s.length>30)return false;for(let i=0;i<s.length;i++)if(s.charCodeAt(i)<32)return false;return true;}

    // Pre-allocated walk buffer
    const _walkBuf=new ArrayBuffer(14),_walkDv=new DataView(_walkBuf);
    _walkDv.setInt32(0,10);_walkDv.setInt16(4,H_WALK);
    function sendWalk(x,y){_walkDv.setInt32(6,x);_walkDv.setInt32(10,y);rawSend(_walkBuf);}

    // Pre-allocated click buffer
    const _clickBuf=new ArrayBuffer(10),_clickDv=new DataView(_clickBuf);
    _clickDv.setInt32(0,6);_clickDv.setInt16(4,H_CLICK);

    // ═══ sendClick — preclick (roomIdx auto, qualquer valor) + click ═══
    function sendClick(uid){
        const u=users.get(uid);
        const ridx=(u&&u.roomIdx>=0)?u.roomIdx:preClickVal;
        _preClickDv.setInt32(6,ridx);
        rawSend(_preClickBuf);
        _clickDv.setInt32(6,uid);
        rawSend(_clickBuf);
    }

    function buildClick(uid){const b=new ArrayBuffer(10),v=new DataView(b);v.setInt32(0,6);v.setInt16(4,H_CLICK);v.setInt32(6,uid);return b;}
    function buildFurni(fid){const b=new ArrayBuffer(10),v=new DataView(b);v.setInt32(0,6);v.setInt16(4,H_FURNI);v.setInt32(6,fid);return b;}
    function buildWalk(x,y){const b=new ArrayBuffer(14),v=new DataView(b);v.setInt32(0,10);v.setInt16(4,H_WALK);v.setInt32(6,x);v.setInt32(10,y);return b;}
    function buildChat(msg){if(!chatHeader)return null;const e=new TextEncoder().encode(msg),tl=2+2+e.length+4+4,b=new ArrayBuffer(4+tl),v=new DataView(b);v.setInt32(0,tl);v.setInt16(4,chatHeader);v.setUint16(6,e.length);new Uint8Array(b,8,e.length).set(e);v.setInt32(8+e.length,0);v.setInt32(8+e.length+4,0);return b;}
    function sendRaw(buf){if(gs?.readyState===WebSocket.OPEN)try{(rawSend||gs.send.bind(gs))(buf);}catch(e){}}
    function sendMacro(i){const m=macros[i];if(!m?.text||!chatHeader)return;let msg=m.text;if(m.withTarget){const tn=lastTarget?.name||(selId?users.get(selId)?.name:null);if(!tn)return;msg+=' '+tn;}const p=buildChat(msg);if(p){sendRaw(p);log(`📨 F${i+1}: ${msg}`);}}

    // ═══ BALL DETECTION ═══
    function tryFurniUpdate(buf,dv,hdr){
        if(buf.byteLength<20)return false;
        let o=6;
        const count=dv.getInt32(o);o+=4;
        if(count<1||count>20)return false;
        let found=false;
        for(let i=0;i<count;i++){
            if(o+20>buf.byteLength)break;
            const rt=dv.getInt32(o);o+=4;
            const x=dv.getInt32(o);o+=4;
            const y=dv.getInt32(o);o+=4;
            const dx=dv.getInt32(o);o+=4;
            const dy=dv.getInt32(o);o+=4;
            const z1=rStr(dv,o);if(!z1){o+=2;continue;}o=z1.n;
            const z2=rStr(dv,o);if(!z2){o+=2;continue;}o=z2.n;
            if(o+12>buf.byteLength)break;
            const fid=dv.getInt32(o);o+=4;
            const ex1=dv.getInt32(o);o+=4;
            const ex2=dv.getInt32(o);o+=4;
            const isBallSig=(z1.s?.includes('5.5')||z2.s?.includes('5.5'))&&ex2===2&&(ex1===2000||ex1===1500);
            if(isBallSig&&!vDetectedBallId){vDetectedBallId=fid;log(`🏐 Ball: ${fid}`);}
            if(fid&&fid===vDetectedBallId){onBall(x,y);found=true;}
        }
        return found;
    }

    let vLastHitTile=null;
    let vHumanTimer=null;
    function onBall(x,y){
        if(vEnabled&&myId){
            const key=tileKey(x,y);
            if(inMyPos(x,y)){
                if(vLastHitTile!==key){
                    if(vMode==='rage'){
                        sendWalk(x,y);
                        vLastHitTile=key;
                        vHits++;
                    }else{
                        if(vHumanTimer)clearTimeout(vHumanTimer);
                        const hx=x,hy=y,hk=key;
                        vHumanTimer=setTimeout(()=>{
                            vHumanTimer=null;
                            if(vEnabled&&inMyPos(hx,hy)){
                                sendWalk(hx,hy);
                                vLastHitTile=hk;
                                vHits++;
                                uiVS();
                            }
                        },100+Math.random()*150);
                    }
                }
            }else{
                vLastHitTile=null;
            }
        }
        if(!vBallPos||vBallPos.x!==x||vBallPos.y!==y){
            vBallPos={x,y};
            uiVS();
        }
    }

    // ═══ WEBSOCKET WORKER PROXY + FLOOD NATIVO ═══
    const WORKER_CODE=`
    let ws=null,url=null,proto=null;
    let floodTimer=null,floodUid=0,floodMs=68,floodRIdx=0;
    const pcBuf=new ArrayBuffer(10),pcDv=new DataView(pcBuf);
    pcDv.setInt32(0,6);pcDv.setInt16(4,0x01af);
    const ckBuf=new ArrayBuffer(10),ckDv=new DataView(ckBuf);
    ckDv.setInt32(0,6);ckDv.setInt16(4,0x082b);
    function floodTick(){
        if(!ws||ws.readyState!==1||!floodUid)return;
        pcDv.setInt32(6,floodRIdx);ws.send(pcBuf);
        ckDv.setInt32(6,floodUid);ws.send(ckBuf);
    }
    self.onmessage=function(e){
        const m=e.data;
        if(m.type==='connect'){
            url=m.url;proto=m.proto;
            ws=proto!==undefined?new WebSocket(url,proto):new WebSocket(url);
            ws.binaryType='arraybuffer';
            ws.onopen=()=>self.postMessage({type:'open'});
            ws.onclose=ev=>self.postMessage({type:'close',code:ev.code,reason:ev.reason,wasClean:ev.wasClean});
            ws.onerror=()=>self.postMessage({type:'error'});
            ws.onmessage=ev=>{
                if(ev.data instanceof ArrayBuffer){
                    self.postMessage({type:'msg',buf:ev.data},[ev.data]);
                }else{
                    self.postMessage({type:'msg',data:ev.data});
                }
            };
        }else if(m.type==='send'){
            if(!ws||ws.readyState!==1)return;
            try{
                if(m.buf)ws.send(m.buf);
                else if(m.data)ws.send(m.data);
            }catch(e){}
        }else if(m.type==='close'){
            if(ws)try{ws.close(m.code,m.reason);}catch(e){}
        }else if(m.type==='flood_start'){
            floodUid=m.uid||0;floodMs=m.ms||68;floodRIdx=m.ridx||0;
            if(floodTimer)clearInterval(floodTimer);
            floodTick();floodTimer=setInterval(floodTick,floodMs);
        }else if(m.type==='flood_stop'){
            if(floodTimer){clearInterval(floodTimer);floodTimer=null;}
        }else if(m.type==='flood_update'){
            if(m.uid!==undefined)floodUid=m.uid;
            if(m.ridx!==undefined)floodRIdx=m.ridx;
            if(m.ms!==undefined&&floodTimer){floodMs=m.ms;clearInterval(floodTimer);floodTimer=setInterval(floodTick,floodMs);}
        }
    };`;

    const workerBlob=new Blob([WORKER_CODE],{type:'application/javascript'});
    const workerUrl=URL.createObjectURL(workerBlob);
    let wsWorker=null;

    class WorkerWebSocket{
        constructor(url,proto){
            this._url=url;
            this._proto=proto;
            this._readyState=0;
            this._listeners={open:[],close:[],error:[],message:[]};
            this._onopen=null;this._onclose=null;this._onerror=null;this._onmessage=null;
            this.binaryType='arraybuffer';
            this.bufferedAmount=0;
            this.extensions='';
            this.protocol='';
            this._worker=new Worker(workerUrl);
            this._worker.onmessage=e=>{
                const m=e.data;
                if(m.type==='open'){
                    this._readyState=1;
                    const ev=new Event('open');
                    if(this._onopen)this._onopen(ev);
                    this._listeners.open.forEach(fn=>fn(ev));
                }else if(m.type==='close'){
                    this._readyState=3;
                    const ev=new CloseEvent('close',{code:m.code,reason:m.reason,wasClean:m.wasClean});
                    if(this._onclose)this._onclose(ev);
                    this._listeners.close.forEach(fn=>fn(ev));
                    this._worker.terminate();
                }else if(m.type==='error'){
                    const ev=new Event('error');
                    if(this._onerror)this._onerror(ev);
                    this._listeners.error.forEach(fn=>fn(ev));
                }else if(m.type==='msg'){
                    let data=m.buf||m.data;
                    const ev=new MessageEvent('message',{data});
                    if(this._onmessage)this._onmessage(ev);
                    this._listeners.message.forEach(fn=>fn(ev));
                }
            };
            this._worker.postMessage({type:'connect',url,proto});
        }
        get readyState(){return this._readyState;}
        get url(){return this._url;}
        get onopen(){return this._onopen;}
        set onopen(fn){this._onopen=fn;}
        get onclose(){return this._onclose;}
        set onclose(fn){this._onclose=fn;}
        get onerror(){return this._onerror;}
        set onerror(fn){this._onerror=fn;}
        get onmessage(){return this._onmessage;}
        set onmessage(fn){this._onmessage=fn;}
        send(data){
            if(this._readyState!==1)throw new DOMException('WebSocket not open','InvalidStateError');
            if(data instanceof ArrayBuffer){
                const copy=data.slice(0);
                this._worker.postMessage({type:'send',buf:copy},[copy]);
            }else if(data instanceof Uint8Array){
                const copy=data.buffer.slice(0);
                this._worker.postMessage({type:'send',buf:copy},[copy]);
            }else{
                this._worker.postMessage({type:'send',data});
            }
        }
        close(code,reason){
            this._readyState=2;
            this._worker.postMessage({type:'close',code:code||1000,reason:reason||''});
        }
        addEventListener(type,fn){
            if(this._listeners[type])this._listeners[type].push(fn);
        }
        removeEventListener(type,fn){
            if(this._listeners[type])this._listeners[type]=this._listeners[type].filter(f=>f!==fn);
        }
        dispatchEvent(ev){
            const fns=this._listeners[ev.type]||[];
            fns.forEach(fn=>fn(ev));
            return true;
        }
        floodStart(uid,ms,ridx){this._worker.postMessage({type:'flood_start',uid,ms,ridx});}
        floodStop(){this._worker.postMessage({type:'flood_stop'});}
        floodUpdate(opts){this._worker.postMessage({type:'flood_update',...opts});}
    }
    WorkerWebSocket.CONNECTING=0;WorkerWebSocket.OPEN=1;WorkerWebSocket.CLOSING=2;WorkerWebSocket.CLOSED=3;

    const _WS=window.WebSocket,_p=_WS.prototype;
    window.WebSocket=function(url,p){
        if(url&&url.includes('proxy.habblet.city')){
            log('Socket (Worker)');
            let ws;
            try{
                ws=new WorkerWebSocket(url,p);
                isWorkerSocket=true;
            }catch(e){
                log('⚠ Worker falhou, usando WebSocket normal');
                ws=p!==undefined?new _WS(url,p):new _WS(url);
                isWorkerSocket=false;
            }
            gs=ws;
            ws.addEventListener('open',()=>{ws.binaryType='arraybuffer';log('ON');hookSend(ws);hookRecv(ws);});
            ws.addEventListener('close',()=>{log('OFF');rawSend=null;stopFlood();clearRoom('Off');});
            return ws;
        }
        return p!==undefined?new _WS(url,p):new _WS(url);
    };
    window.WebSocket.prototype=_p;window.WebSocket.CONNECTING=_WS.CONNECTING;window.WebSocket.OPEN=_WS.OPEN;window.WebSocket.CLOSING=_WS.CLOSING;window.WebSocket.CLOSED=_WS.CLOSED;Object.setPrototypeOf(window.WebSocket,_WS);

    function clearRoom(r){const h=users.size>0;users.clear();roomIdxMap.clear();prevPos.clear();vBallPos=null;vLastHitTile=null;vDetectedBallId=0;vCoordBounds=null;vAllTilesCache=null;vZoneSets=null;preClickVal=0;if(looping&&!persistFlood&&!autoMode)stopFlood();uiUsers();uiTarget();uiStatus();uiVU();uiVS();if(r&&h)log(`🚪 ${r}`);}

    function hookSend(ws){
        const _s=ws.send.bind(ws);rawSend=_s;
        ws.send=function(data){
            try{
                let buf;if(data instanceof ArrayBuffer)buf=data;else if(data instanceof Uint8Array)buf=data.buffer;else return _s(data);
                const hdr=gH(buf);
                if(hdr===H_CLICK&&buf.byteLength>=10){
                    const cid=new DataView(buf).getInt32(6);
                    if(settingMyId&&cid>0){myId=cid;settingMyId=false;log(`👤 Eu = ${users.get(cid)?.name||cid}`);const btn=document.getElementById('rxME');if(btn){btn.textContent=`👤 ${users.get(cid)?.name||cid}`;btn.classList.remove('rec');btn.classList.add('ok');}uiUsers();uiVU();uiVS();return _s(data);}
                    if(cid>0&&cid!==selId&&!whitelist.has(cid)&&cid!==myId){selId=cid;if(!users.has(cid))users.set(cid,{id:cid,name:`User #${cid}`,roomIdx:-1,x:-1,y:-1,dx:-1,dy:-1,tmp:true});lastTarget={id:cid,name:users.get(cid)?.name||`#${cid}`};uiUsers();uiTarget();if(looping){stopFlood();startFlood();}}
                }
                // ═══ FIX: Captura preClickVal de QUALQUER packet 0x01af (nosso ou do jogo) ═══
                if(hdr===H_PRECLICK&&buf.byteLength>=10){const pv=new DataView(buf).getInt32(6);if(pv!==preClickVal&&pv>=0){preClickVal=pv;log(`🔄 PreClick → ${pv}`);}}
                if(hdr===H_WALK&&buf.byteLength>=14){const wdv=new DataView(buf),wx=wdv.getInt32(6),wy=wdv.getInt32(10);if(wx>=0&&wx<=500&&wy>=0&&wy<=500){if(vRec)vRecCapture(wx,wy);if((autoMode||autoNoFlood)&&myId)autoCheck();}}
                if(!chatHeader&&hdr!==H_CLICK&&hdr!==H_PRECLICK&&hdr!==H_WALK&&hdr!==H_FURNI&&buf.byteLength>=12&&buf.byteLength<=500){try{const cdv=new DataView(buf),slen=cdv.getUint16(6);if(slen>0&&slen<300&&8+slen+4<=buf.byteLength){let str='';for(let ci=0;ci<slen;ci++)str+=String.fromCharCode(cdv.getUint8(8+ci));if(str.length>=1&&/^[\x20-\x7E\u00A0-\uFFFF]+$/.test(str)&&cdv.getInt32(8+slen)>=0&&cdv.getInt32(8+slen)<=50){chatHeader=hdr;queueMicrotask(()=>{const cd=document.getElementById('rxCD');if(cd)cd.className='xm-dot on';const sp=cd?.nextElementSibling;if(sp)sp.textContent='Chat detectado';});}}}catch(e){}}
                return _s(data);
            }catch(e){return _s(data);}
        };
    }

    function hookRecv(ws){
        ws.binaryType='arraybuffer';
        ws.addEventListener('message',ev=>{
            try{
                if(ev.data instanceof ArrayBuffer){
                    processRaw(ev.data);
                }else if(ev.data instanceof Blob){
                    ev.data.arrayBuffer().then(processRaw);
                }
            }catch(e){}
        });
    }

    function processRaw(buf){
        const dv=new DataView(buf);
        let o=0,s=0;
        while(o+6<=buf.byteLength&&s++<500){
            const len=dv.getInt32(o);
            if(len<=0||len>65535||o+4+len>buf.byteLength)break;
            const hdr=dv.getInt16(o+4);
            if(hdr===H_ROLLER&&len>=10){
                const base=o+6;
                const count=dv.getInt32(base);
                if(count>=1&&count<=20&&base+4+count*4<=o+4+len){
                    let ro=base+4;
                    for(let i=0;i<count;i++){
                        const packed=dv.getUint16(ro);ro+=2;
                        const flags=dv.getUint16(ro);ro+=2;
                        const x=(packed>>8)&0xFF;
                        const y=packed&0xFF;
                        if(x===29&&y===63)continue;
                        if(x>=20&&x<=36&&y>=15&&y<=42) onBall(x,y);
                    }
                }
            }else{
                processPkt(buf.slice(o,o+4+len));
            }
            o+=4+len;
        }
    }

    function processPkt(buf){
        if(buf.byteLength<6)return;
        const dv=new DataView(buf);
        const hdr=dv.getInt16(4);
        if(hdr===H_FURNI_UPDATE&&buf.byteLength>=20){tryFurniUpdate(buf,dv,hdr);return;}
        if(hdr===H_MODEL){clearRoom('Nova sala');return;}
        if(hdr===H_USERS){parseUsers(buf);return;}
        if(hdr===H_STATUS){parseStatus(buf);return;}
        if(hdr!==H_FSTATE)tryRemove(buf,hdr);
    }

    function parseOneUser(dv,o){const id=rInt(dv,o);if(!id||id.v<=0||id.v>99999999)return null;o=id.n;const name=rStr(dv,o);if(!name||!isName(name.v))return null;o=name.n;const motto=rStr(dv,o);if(!motto)return null;o=motto.n;const figure=rStr(dv,o);if(!figure)return null;o=figure.n;if(figure.v.length<5||!figure.v.includes('-'))return null;const ri=rInt(dv,o);if(!ri)return null;o=ri.n;const x=rInt(dv,o);if(!x)return null;o=x.n;const y=rInt(dv,o);if(!y)return null;o=y.n;const z=rStr(dv,o);if(!z)return null;o=z.n;const dir=rInt(dv,o);if(!dir)return null;o=dir.n;const type=rInt(dv,o);if(!type)return null;o=type.n;return{user:{id:id.v,name:name.v,roomIdx:ri.v,x:x.v,y:y.v,dx:x.v,dy:y.v,type:type.v},endOff:o};}
    function scanUser(dv,o){while(o+14<=dv.byteLength){const r=parseOneUser(dv,o);if(r)return{off:o,result:r};o++;}return null;}
    function parseUsers(buf){try{const dv=new DataView(buf);let o=6;const count=rInt(dv,o);if(!count)return;o=count.n;if(count.v<1||count.v>500)return;
        if(count.v>=10&&users.size>0){const pid=dv.getInt32(o);if(pid>0&&!users.has(pid)){users.clear();roomIdxMap.clear();prevPos.clear();uiTarget();}}
        const found=[];let first=parseOneUser(dv,o);
        if(first){if(first.user.type===1)found.push(first.user);o=first.endOff;}
        else{const s=scanUser(dv,o);if(!s)return;if(s.result.user.type===1)found.push(s.result.user);o=s.result.endOff;}
        for(let i=1;i<count.v;i++){const s=scanUser(dv,o);if(!s)break;if(s.result.user.type===1)found.push(s.result.user);o=s.result.endOff;}
        if(found.length>=1){found.forEach(u=>{users.set(u.id,u);roomIdxMap.set(u.roomIdx,u.id);if(selId===u.id)lastTarget={id:u.id,name:u.name};});if(myId&&users.has(myId)){const btn=document.getElementById('rxME');if(btn&&!btn.classList.contains('ok')){btn.textContent=`👤 ${users.get(myId).name}`;btn.classList.add('ok');}}uiUsers();uiTarget();uiVU();uiVS();}
    }catch(e){}}
    function parseStatus(buf){try{const dv=new DataView(buf);let o=6;const count=rInt(dv,o);if(!count)return;o=count.n;if(count.v<1||count.v>200)return;let ch=false;
        for(let i=0;i<count.v;i++){const ri=rInt(dv,o);if(!ri)return;o=ri.n;const x=rInt(dv,o);if(!x)return;o=x.n;const y=rInt(dv,o);if(!y)return;o=y.n;const z=rStr(dv,o);if(!z)return;o=z.n;const bd=rInt(dv,o);if(!bd)return;o=bd.n;const hd=rInt(dv,o);if(!hd)return;o=hd.n;const act=rStr(dv,o);if(!act)return;o=act.n;if(x.v<0||x.v>500||y.v<0||y.v>500)continue;const uid=roomIdxMap.get(ri.v);if(!uid||!users.has(uid))continue;const u=users.get(uid);
            if(u.x!==x.v||u.y!==y.v){prevPos.set(uid,{x:u.x,y:u.y});u.x=x.v;u.y=y.v;ch=true;if(uid===myId&&vEnabled)detectMyPos(x.v,y.v);}
            const mv=MV_REGEX.exec(act.v);if(mv){const nx=parseInt(mv[1]),ny=parseInt(mv[2]);if(u.dx!==nx||u.dy!==ny){u.dx=nx;u.dy=ny;ch=true;if(uid===myId&&vEnabled)detectMyPos(nx,ny);}}else if(u.dx!==x.v||u.dy!==y.v){u.dx=x.v;u.dy=y.v;ch=true;}}
        if(ch){uiPositions();uiVS();if((autoMode||autoNoFlood)&&myId)autoCheck();}
    }catch(e){}}

    // ═══ QUICK TARGET ═══
    function quickTarget(mx,my){
        if(!myId||(autoMode===false&&autoNoFlood===false))return;
        const me=users.get(myId);
        if(!me)return;
        let best=null,bestDist=99;
        for(const[uid,u]of users){
            if(uid===myId||whitelist.has(uid))continue;
            const d1=Math.max(Math.abs(u.x-mx),Math.abs(u.y-my));
            const d2=Math.max(Math.abs(u.x-me.x),Math.abs(u.y-me.y));
            const d=Math.min(d1,d2);
            if(d<=3&&d<bestDist){bestDist=d;best=uid;}
        }
        if(best&&best!==selId){
            selId=best;
            lastTarget={id:best,name:users.get(best)?.name||`#${best}`};
            queueMicrotask(()=>{uiUsers();uiTarget();uiStatus();});
        }
    }

    // ═══ AUTOCHECK ═══
    function autoCheck(){if(!myId||!users.has(myId))return;const me=users.get(myId),cx=me.x,cy=me.y;let best=null,bestDist=99;for(const[uid,u]of users){if(uid===myId||whitelist.has(uid))continue;const sd=Math.max(Math.abs(u.x-cx),Math.abs(u.y-cy));let minD=sd;if(sd<=4){let nx=cx,ny=cy;if(me.dx!==me.x||me.dy!==me.y){nx=me.x+Math.sign(me.dx-me.x);ny=me.y+Math.sign(me.dy-me.y);}let ex=u.x,ey=u.y;if(u.dx!==u.x||u.dy!==u.y){ex=u.x+Math.sign(u.dx-u.x);ey=u.y+Math.sign(u.dy-u.y);}minD=Math.min(sd,Math.max(Math.abs(u.x-nx),Math.abs(u.y-ny)),Math.max(Math.abs(ex-cx),Math.abs(ey-cy)),Math.max(Math.abs(ex-nx),Math.abs(ey-ny)));}if(minD<=3&&minD<bestDist){bestDist=minD;best=uid;}}if(best){if(best!==selId){selId=best;lastTarget={id:best,name:users.get(best)?.name||`#${best}`};queueMicrotask(()=>{uiUsers();uiTarget();uiStatus();});}
        if(!autoNoFlood){if(bestDist<=2){if(autoDelayTimer){clearTimeout(autoDelayTimer);autoDelayTimer=null;}if(!looping)startFlood();}else if(bestDist===3&&!looping&&!autoDelayTimer){autoDelayTimer=setTimeout(()=>{autoDelayTimer=null;if(autoMode&&selId&&!looping)startFlood();},autoDelayMs);}}}else{if(autoDelayTimer){clearTimeout(autoDelayTimer);autoDelayTimer=null;}if(looping&&!autoNoFlood){stopFlood();uiStatus();}}}

    function tryRemove(buf,hdr){if(buf.byteLength<8||buf.byteLength>20||users.size===0)return;try{const dv=new DataView(buf),str=rStr(dv,6);if(str&&/^\-?\d+$/.test(str.v)){const idx=parseInt(str.v);if(idx>=0&&idx<2000){const uid=roomIdxMap.get(idx);if(uid&&users.has(uid)){users.delete(uid);roomIdxMap.delete(idx);uiUsers();uiVU();}}}else if(buf.byteLength===10){const idx=dv.getInt32(6);if(idx>=0&&idx<2000){const uid=roomIdxMap.get(idx);if(uid&&users.has(uid)){users.delete(uid);roomIdxMap.delete(idx);uiUsers();uiVU();}}}}catch(e){}}

    // ═══ FLOOD — Worker ═══
    function getTargetRIdx(){const u=selId?users.get(selId):null;return(u&&u.roomIdx>=0)?u.roomIdx:preClickVal;}
    function doClick(){if(gs?.readyState!==WebSocket.OPEN||!selId)return;sendClick(selId);}
    function startFlood(){if(!selId||gs?.readyState!==WebSocket.OPEN)return;looping=true;doClick();loopTimer=setInterval(doClick,ms);queueMicrotask(()=>uiStatus());}
    function stopFlood(){if(loopTimer){clearInterval(loopTimer);loopTimer=null;}looping=false;uiStatus();}

    // ═══ DNA PARTICLES ═══
    let dnaCanvas=null,dnaAnim=null,dnaP=[];
    function initDNA(el){
        dnaCanvas=document.createElement('canvas');
        dnaCanvas.style.cssText='position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;border-radius:12px';
        el.insertBefore(dnaCanvas,el.firstChild);
        const N=65,LINK=110;
        const cols=['255,255,255'];
        function mk(w,h){return{x:Math.random()*w,y:Math.random()*h,vx:(Math.random()-0.5)*0.7,vy:(Math.random()-0.5)*0.7,r:1.5+Math.random()*2.5,c:cols[Math.floor(Math.random()*cols.length)],a:0.6+Math.random()*0.4,ph:Math.random()*6.28,ps:0.6+Math.random()*1.8};}
        const draw=()=>{
            if(!panelOpen){dnaAnim=requestAnimationFrame(draw);return;}
            const w=dnaCanvas.width=dnaCanvas.offsetWidth*2,h=dnaCanvas.height=dnaCanvas.offsetHeight*2;
            if(!w||!h){dnaAnim=requestAnimationFrame(draw);return;}
            const ctx=dnaCanvas.getContext('2d');ctx.clearRect(0,0,w,h);
            while(dnaP.length<N)dnaP.push(mk(w,h));
            for(let i=dnaP.length-1;i>=0;i--){
                const p=dnaP[i];p.x+=p.vx;p.y+=p.vy;p.ph+=0.02*p.ps;
                p.vx+=(Math.random()-0.5)*0.04;p.vy+=(Math.random()-0.5)*0.04;
                p.vx=Math.max(-0.8,Math.min(0.8,p.vx));p.vy=Math.max(-0.8,Math.min(0.8,p.vy));
                if(p.x<-10)p.x=w+5;if(p.x>w+10)p.x=-5;if(p.y<-10)p.y=h+5;if(p.y>h+10)p.y=-5;
            }
            for(let i=0;i<dnaP.length;i++){const a=dnaP[i];for(let j=i+1;j<dnaP.length;j++){const b=dnaP[j];const dx=a.x-b.x,dy=a.y-b.y,d=Math.sqrt(dx*dx+dy*dy);if(d<LINK){const al=(1-d/LINK)*0.35*Math.min(a.a,b.a)*2;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=`rgba(${a.c},${al.toFixed(3)})`;ctx.lineWidth=1+al*3;ctx.stroke();}}}
            for(const p of dnaP){const gl=0.5+0.5*Math.sin(p.ph),al=p.a*gl;ctx.beginPath();ctx.arc(p.x,p.y,p.r*5+gl*7,0,6.28);ctx.fillStyle=`rgba(${p.c},${(al*0.12).toFixed(3)})`;ctx.fill();ctx.beginPath();ctx.arc(p.x,p.y,p.r*3+gl*3,0,6.28);ctx.fillStyle=`rgba(${p.c},${(al*0.25).toFixed(3)})`;ctx.fill();ctx.beginPath();ctx.arc(p.x,p.y,p.r*1.2+gl*0.8,0,6.28);ctx.fillStyle=`rgba(${p.c},${(al*0.85).toFixed(3)})`;ctx.fill();ctx.beginPath();ctx.arc(p.x,p.y,p.r*0.5,0,6.28);ctx.fillStyle=`rgba(255,255,255,${(al*0.7).toFixed(3)})`;ctx.fill();}
            dnaAnim=requestAnimationFrame(draw);
        };draw();
    }

    // ═══ UI PANEL ═══
    function createPanel(){
        if(document.getElementById('rx'))return;
        const css=document.createElement('style');
        css.textContent=`
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
:root{--rx-bg:#0b0f15;--rx-card:rgba(13,17,23,.92);--rx-border:rgba(48,54,61,.5);--rx-text:#e6edf3;--rx-sub:#7d8590;--rx-dim:#2d333b;--rx-accent:#58a6ff;--rx-font:'Inter',system-ui,sans-serif}
#rx{position:fixed;top:50px;right:12px;width:290px;background:var(--rx-bg);border:1px solid var(--rx-border);border-radius:12px;z-index:999999;font-family:var(--rx-font);color:var(--rx-sub);box-shadow:0 16px 48px rgba(0,0,0,.6);display:none;user-select:none;overflow:hidden;font-size:11px}
#rx.vis{display:block}#rx canvas{border-radius:12px}
.xh{background:rgba(13,17,23,.92);padding:8px 11px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--rx-border);cursor:move;font-weight:700;font-size:12px;color:var(--rx-text);position:relative;z-index:1}
.xh-dot{width:6px;height:6px;border-radius:50%;background:var(--rx-sub);margin-right:8px;flex-shrink:0;transition:all .3s}.xh-dot.on{background:var(--rx-accent);box-shadow:0 0 5px rgba(88,166,255,.4)}
.xh-badge{font-size:8px;color:var(--rx-dim);font-weight:500}
.xh-water{font-weight:700;font-size:13px;letter-spacing:.5px;position:relative;display:inline-block;background:linear-gradient(180deg,rgba(160,220,255,.85) 0%,rgba(80,170,240,.65) 30%,rgba(40,120,200,.45) 60%,rgba(80,170,240,.65) 100%);background-size:100% 250%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:rxWaveY 6s ease-in-out infinite;filter:drop-shadow(0 1px 3px rgba(30,100,200,.2))}
.xh-water::after{content:'Ronyrato';position:absolute;left:0;top:0;background:linear-gradient(90deg,transparent 0%,rgba(200,235,255,.4) 40%,rgba(255,255,255,.6) 50%,rgba(200,235,255,.4) 60%,transparent 100%);background-size:50px 100%;background-repeat:no-repeat;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:rxShine 5s ease-in-out infinite}
@keyframes rxWaveY{0%,100%{background-position:0% 0%}50%{background-position:0% 100%}}
@keyframes rxShine{0%,10%{background-position:-50px 0}90%,100%{background-position:130px 0}}
.xbody{display:flex;min-height:210px;position:relative;z-index:1}
.xside{width:36px;background:rgba(13,17,23,.88);border-right:1px solid var(--rx-border);display:flex;flex-direction:column;padding:5px 0;gap:2px;flex-shrink:0;z-index:1}
.xstab{width:36px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;border-left:2px solid transparent;transition:all .15s;position:relative}
.xstab svg{width:14px;height:14px;color:var(--rx-dim);transition:color .15s}.xstab:hover svg{color:var(--rx-sub)}.xstab.active{border-left-color:var(--rx-accent);background:rgba(56,139,253,.06)}.xstab.active svg{color:var(--rx-accent)}
.xcont{flex:1;overflow-y:auto;overflow-x:hidden;min-width:0;position:relative;z-index:1;background:rgba(11,15,21,.78)}.xcont::-webkit-scrollbar{width:3px}.xcont::-webkit-scrollbar-thumb{background:var(--rx-dim);border-radius:2px}
.xtc{display:none;padding:3px 0}.xtc.active{display:block}
.xl{font-size:9px;font-weight:600;color:var(--rx-dim);text-transform:uppercase;letter-spacing:1.2px;padding:6px 10px 3px}
.xu{max-height:150px;overflow-y:auto;margin:2px 6px;border:1px solid var(--rx-border);border-radius:7px;background:var(--rx-card)}.xu::-webkit-scrollbar{width:3px}.xu::-webkit-scrollbar-thumb{background:var(--rx-dim)}
.xi{padding:4px 8px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(48,54,61,.3);cursor:pointer;transition:background .1s}.xi:last-child{border-bottom:none}.xi:hover{background:rgba(56,139,253,.04)}
.xi.s{background:rgba(56,139,253,.06);border-left:2px solid var(--rx-accent)}.xi .n{font-weight:600;color:var(--rx-text);font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px}.xi .id{font-size:8px;color:var(--rx-dim)}.xi .co{color:var(--rx-sub);font-size:9px;font-variant-numeric:tabular-nums;white-space:nowrap}
.xi.wl{border-left:2px solid #d29922}.xi.wl .n{color:#d29922}.xi.me{border-left:2px solid var(--rx-accent)}.xi.me .n{color:var(--rx-accent)}
.xwl{font-size:10px;cursor:pointer;opacity:.3;padding:2px 3px;transition:opacity .15s}.xwl:hover{opacity:1}.xi.wl .xwl{opacity:1}
.xe{padding:10px;text-align:center;color:var(--rx-dim);font-size:10px}
.xt{margin:3px 6px;padding:6px;background:var(--rx-card);border:1px solid var(--rx-border);border-radius:7px;text-align:center}.xt.a{color:var(--rx-accent);border-color:rgba(56,139,253,.3)}.xt .tn{font-weight:700;font-size:11px;color:var(--rx-text)}.xt .td{font-size:8px;color:var(--rx-dim);margin-top:2px}
.xb{display:block;width:calc(100% - 12px);margin:3px 6px;padding:6px;border:1px solid var(--rx-border);border-radius:7px;font-family:var(--rx-font);font-size:10px;font-weight:600;cursor:pointer;text-align:center;color:var(--rx-sub);background:var(--rx-card);transition:all .15s}.xb:hover{background:#161b22;border-color:rgba(48,54,61,.8)}
.xbf.on{background:linear-gradient(135deg,#1a6dbb,#58a6ff);color:#fff;border-color:transparent;animation:xP 1.5s infinite}
@keyframes xP{0%,100%{box-shadow:0 0 0 0 rgba(56,139,253,.3)}50%{box-shadow:0 0 0 5px rgba(56,139,253,0)}}
.xbs{font-size:9px;padding:4px;color:var(--rx-dim);background:transparent;border-color:rgba(48,54,61,.3)}.xbs:hover{color:var(--rx-sub)}
@keyframes xBl{0%,100%{opacity:1}50%{opacity:.5}}
.xdv{height:1px;background:var(--rx-border);margin:5px 6px}
.xr{display:flex;align-items:center;gap:6px;padding:3px 10px}.xr label{font-size:9px;color:var(--rx-dim);font-weight:600}
.xin{background:var(--rx-card);border:1px solid var(--rx-border);border-radius:5px;color:var(--rx-text);font-family:var(--rx-font);font-size:10px;padding:3px 6px;outline:none;width:50px;transition:border-color .15s}.xin:focus{border-color:var(--rx-accent)}
.xtr{display:flex;align-items:center;justify-content:space-between;padding:3px 10px;font-size:10px}
.xtg{width:30px;height:15px;background:var(--rx-dim);border-radius:8px;cursor:pointer;position:relative;border:none;flex-shrink:0;transition:background .2s}.xtg.on{background:var(--rx-accent)}
.xtg::after{content:'';position:absolute;top:2px;left:2px;width:11px;height:11px;border-radius:50%;background:#8b949e;transition:all .2s}.xtg.on::after{transform:translateX(15px);background:#fff}
.xsr{display:flex;justify-content:space-between;padding:3px 10px;font-size:10px;font-weight:600}.xoff{color:var(--rx-sub)}.xon{color:var(--rx-accent)}
.xbme{font-size:9px;padding:5px;color:var(--rx-accent);background:rgba(56,139,253,.06);border-color:rgba(56,139,253,.2)}.xbme:hover{background:rgba(56,139,253,.1)}
.xbme.rec{background:rgba(210,153,34,.06);color:var(--rx-sub);border-color:rgba(210,153,34,.3);animation:xBl .6s infinite}
.xbme.ok{background:rgba(56,139,253,.06);color:var(--rx-accent);border-color:rgba(56,139,253,.2)}
#rx-icon{width:42px!important;height:42px!important;display:flex!important;align-items:center!important;justify-content:center!important;cursor:pointer!important;position:relative!important;transition:all .2s!important;margin:0 2px!important}
#rx-icon:hover{transform:scale(1.12)!important}
#rx-icon .rx-img{width:42px;height:42px;background-size:50px 50px;background-repeat:no-repeat;background-position:center}
.xmrow{display:flex;align-items:center;gap:4px;padding:2px 8px;font-size:10px}.xmrow label{color:var(--rx-accent);font-weight:700;min-width:20px;font-size:9px}
.xmrow input{flex:1;background:var(--rx-card);border:1px solid var(--rx-border);border-radius:5px;color:var(--rx-text);font-family:var(--rx-font);font-size:10px;padding:3px 5px;outline:none}.xmrow input:focus{border-color:var(--rx-accent)}
.xmtg{width:22px;height:12px;background:var(--rx-dim);border-radius:6px;cursor:pointer;position:relative;border:none;flex-shrink:0;transition:background .2s}.xmtg.on{background:var(--rx-accent)}
.xmtg::after{content:'';position:absolute;top:2px;left:2px;width:8px;height:8px;border-radius:50%;background:#8b949e;transition:all .2s}.xmtg.on::after{transform:translateX(10px);background:#fff}
.xmtg-label{font-size:8px;color:var(--rx-dim);min-width:28px;text-align:center;font-weight:500}
.xm-chat{display:flex;align-items:center;gap:6px;padding:3px 10px;font-size:9px}.xm-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}.xm-dot.off{background:var(--rx-sub)}.xm-dot.on{background:var(--rx-accent)}
.xv-info{margin:3px 6px;padding:6px 8px;background:var(--rx-card);border:1px solid var(--rx-border);border-radius:7px;font-size:9px;color:var(--rx-sub);text-align:center}
.xv-info.on{color:var(--rx-accent);border-color:rgba(56,139,253,.2);background:rgba(56,139,253,.03)}
.xv-info .big{font-size:11px;font-weight:700;color:var(--rx-text)}.xv-info.on .big{color:var(--rx-accent)}
.xv-info .sub{font-size:8px;color:var(--rx-dim);margin-top:2px;font-variant-numeric:tabular-nums}
.xv-sel{background:var(--rx-card);border:1px solid var(--rx-border);border-radius:5px;color:var(--rx-text);font-family:var(--rx-font);font-size:10px;padding:3px 6px;outline:none;cursor:pointer}.xv-sel:focus{border-color:var(--rx-accent)}
.xv-cfg{margin:3px 6px;overflow:hidden;transition:max-height .3s ease;max-height:0}.xv-cfg.open{max-height:500px}
.xv-cfg-inner{padding:5px 0;border:1px solid var(--rx-border);border-radius:7px;background:var(--rx-card)}
.xvrec{background:rgba(210,153,34,.08);color:var(--rx-sub);border-color:rgba(210,153,34,.3)}.xvrec:hover{background:rgba(210,153,34,.15)}
.xvrec.recording{background:rgba(56,139,253,.08);color:var(--rx-accent);border-color:rgba(56,139,253,.3);animation:xBl .6s infinite}
.xv-dbg{margin:2px 5px;padding:2px 5px;font-size:8px;color:var(--rx-dim);max-height:80px;overflow-y:auto;font-family:'JetBrains Mono',monospace}
.xv-dbg::-webkit-scrollbar{width:2px}.xv-dbg::-webkit-scrollbar-thumb{background:var(--rx-dim)}
.xv-dbg .hit{color:var(--rx-accent)}.xv-dbg .rm{color:var(--rx-sub)}.xv-dbg .pkt{color:var(--rx-accent)}.xv-dbg .ball{color:var(--rx-accent);font-weight:bold}
.xv-method{font-size:7px;color:var(--rx-dim);padding:1px 10px;font-family:'JetBrains Mono',monospace;opacity:.7}
        `;
        document.head.appendChild(css);

        const el=document.createElement('div');el.id='rx';
        el.innerHTML=`
<div class="xh" id="rxDH"><div style="display:flex;align-items:center"><div class="xh-dot" id="rxD"></div><span class="xh-water">Ronyrato</span></div><span class="xh-badge">F8</span></div>
<div class="xbody">
<div class="xside">
<div class="xstab active" data-tab="pvp" title="PVP"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4l16 16M4 4l3 0M4 4l0 3M15.5 8.5l-2-2M20 4L4 20M20 4l-3 0M20 4l0 3M8.5 15.5l2 2"/></svg></div>
<div class="xstab" data-tab="volley" title="Volleyball"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10M12 2a15.3 15.3 0 0 0-4 10 15.3 15.3 0 0 0 4 10M2 12h20"/></svg></div>
<div class="xstab" data-tab="dclick" title="DoubleClick"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 4l7.07 17 2.51-7.39L21 11.07z"/></svg></div>
<div class="xstab" data-tab="macros" title="Macros"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg></div>
</div>
<div class="xcont">
<div class="xtc active" id="rxTabPvp">
<div class="xl">Usuários <span id="rxC" style="color:var(--rx-sub)">0</span></div>
<div class="xu" id="rxU"><div class="xe">Entrando...</div></div>
<div class="xdv"></div><div class="xl">Alvo</div><div class="xt" id="rxT">Esperando alvo</div>
<div class="xdv"></div>
<div class="xr"><label>MS</label><input type="number" class="xin" id="rxMS" value="68" min="10" max="10000" step="0.1"></div>
<div class="xtr"><span>Flood Ativadao</span><div class="xtg" id="rxPF"></div></div>
<div class="xsr"><span>Loop</span><span class="xoff" id="rxL">OFF</span></div>
<button class="xb xbf" id="rxF">Iniciar Flood</button>
<div class="xdv"></div><div class="xl">Modo Automático</div>
<div class="xtr"><span>Auto</span><div class="xtg" id="rxAM"></div></div>
<div class="xtr"><span>Auto sem flood</span><div class="xtg" id="rxANF"></div></div>
<button class="xb xbme" id="rxME">teste de update</button>
<div class="xdv"></div>
<div class="xtr"><span>Hotkey</span><div class="xtg on" id="rxHK"></div></div>
<div class="xtr"><span>Segurar</span><div class="xtg" id="rxHH"></div></div>
<div class="xr"><label>Tecla</label><select class="xin" id="rxHM" style="width:auto"><option value="alt" selected>Alt</option><option value="ctrl">Ctrl</option><option value="shift">Shift</option></select></div>
</div>
<div class="xtc" id="rxTabMacros">
<div class="xl">Chat</div>
<div class="xm-chat"><div class="xm-dot off" id="rxCD"></div><span style="color:var(--rx-dim)">Aguardando</span></div>
<div class="xdv"></div><div class="xl">Macros</div>
${[1,2,3,4,5,6,7].map((n,i)=>`<div class="xmrow"><label>F${n}</label><input type="text" id="rxM${i}" value="${i===0?':push':i===1?':pull':''}" placeholder="mensagem..."><div class="xmtg${i<2?' on':''}" id="rxMT${i}"></div><div class="xmtg-label">+Alvo</div></div>`).join('')}
</div>
<div class="xtc" id="rxTabVolley">
<div class="xl" id="rxVTitle">Volleyball</div>
<div class="xr"><label>Quarto</label><select class="xv-sel" id="rxVRoom"><option value="Volleyball">Volleyball</option></select></div>
<div class="xdv"></div>
<div class="xtr"><span>Auto</span><div class="xtg" id="rxVATG"></div></div>
<div class="xdv"></div>
<div class="xl">Modo</div>
<div style="display:flex;gap:6px;padding:0 8px">
<div class="xb xbs" id="rxVMRage" style="flex:1;text-align:center;padding:5px 0;border:1px solid rgba(56,139,253,.5);border-radius:6px;cursor:pointer;font-size:11px;background:rgba(56,139,253,.1);color:#58a6ff">Rage</div>
<div class="xb xbs" id="rxVMHuman" style="flex:1;text-align:center;padding:5px 0;border:1px solid var(--rx-border);border-radius:6px;cursor:pointer;font-size:11px;color:var(--rx-dim)">Humanizado</div>
</div>
<div class="xv-info" id="rxVInfo">seleciona tu na aba pvp</div>
<div class="xv-method" id="rxVMethod"></div>
<div class="xdv"></div>
<div class="xl">Usuários <span id="rxVC2" style="color:var(--rx-sub)">0</span></div>
<div class="xu" id="rxVU"><div class="xe">Entrando...</div></div>
<div class="xdv"></div>
<div class="xv-dbg" id="rxVDBG" style="max-height:100px"></div>
<button class="xb xbs" id="rxVCFG" style="color:var(--rx-sub)">⚙ Configuração</button>
<div class="xv-cfg" id="rxVCfgWrap"><div class="xv-cfg-inner">
<div class="xl">Gravar posições</div>
<div class="xr"><label>Pos</label><select class="xv-sel" id="rxVRP">${[1,2,3,4,5,6].map(n=>`<option value="${n-1}">Posição ${n}</option>`).join('')}</select><span id="rxVRC" style="font-size:8px;color:var(--rx-dim)">0</span></div>
<button class="xb xvrec" id="rxVREC" style="margin:2px 5px;width:calc(100% - 10px)">⏺ Gravar</button>
<div style="display:flex;gap:3px;padding:2px 5px">
<button class="xb xbs" id="rxVRCL" style="flex:1;margin:0;color:var(--rx-sub);font-size:8px">Limpar</button>
<button class="xb xbs" id="rxVEXP" style="flex:1;margin:0;color:var(--rx-accent);font-size:8px">Export</button>
<button class="xb xbs" id="rxVIMP" style="flex:1;margin:0;color:var(--rx-sub);font-size:8px">Import</button>
</div></div></div>
</div>
<div class="xtc" id="rxTabDclick">
<div class="xl">DoubleClick</div>
<div class="xdv"></div>
<div class="xtr"><span>Mouse DoubleClick</span><div class="xtg" id="rxDCMouse"></div></div>
<div class="xdv"></div>
<div class="xtr"><span>F1 DoubleClick</span><div class="xtg" id="rxDCF1"></div></div>
</div>
</div></div>`;
        document.body.appendChild(el);
        initDNA(el);

        let dox,doy;
        const header=document.getElementById('rxDH');
        function onMouseMove(e){el.style.left=(e.clientX-dox)+'px';el.style.top=(e.clientY-doy)+'px';el.style.right='auto';}
        header.addEventListener('mousedown',e=>{dox=e.clientX-el.getBoundingClientRect().left;doy=e.clientY-el.getBoundingClientRect().top;document.addEventListener('mousemove',onMouseMove);document.addEventListener('mouseup',()=>document.removeEventListener('mousemove',onMouseMove),{once:true});e.preventDefault();});

        document.querySelectorAll('.xstab').forEach(tab=>{tab.addEventListener('click',function(e){e.stopPropagation();const t=this.dataset.tab;document.querySelectorAll('.xstab').forEach(x=>x.classList.toggle('active',x.dataset.tab===t));['pvp','macros','volley','dclick'].forEach(n=>document.getElementById('rxTab'+n.charAt(0).toUpperCase()+n.slice(1))?.classList.toggle('active',n===t));activeTab=t;});});
        document.getElementById('rxMS').addEventListener('change',function(){ms=Math.max(10,parseFloat(this.value)||68);this.value=ms;if(looping){stopFlood();startFlood();}});
        document.getElementById('rxPF').addEventListener('click',function(e){e.stopPropagation();persistFlood=!persistFlood;this.classList.toggle('on',persistFlood);});
        document.getElementById('rxF').addEventListener('click',e=>{e.stopPropagation();looping?stopFlood():startFlood();});
        document.getElementById('rxAM').addEventListener('click',function(e){e.stopPropagation();if(!myId&&!autoMode)return;autoMode=!autoMode;this.classList.toggle('on',autoMode);if(autoMode&&autoNoFlood){autoNoFlood=false;document.getElementById('rxANF')?.classList.remove('on');}if(!autoMode&&looping)stopFlood();uiStatus();});
        document.getElementById('rxANF').addEventListener('click',function(e){e.stopPropagation();if(!myId&&!autoNoFlood)return;autoNoFlood=!autoNoFlood;this.classList.toggle('on',autoNoFlood);if(autoNoFlood&&autoMode){autoMode=false;document.getElementById('rxAM')?.classList.remove('on');if(looping)stopFlood();}uiStatus();});
        document.getElementById('rxME').addEventListener('click',function(e){e.stopPropagation();settingMyId=true;this.textContent='clica em tu no jogo';this.classList.add('rec');this.classList.remove('ok');});
        document.getElementById('rxHK').addEventListener('click',function(e){e.stopPropagation();hkEnabled=!hkEnabled;this.classList.toggle('on',hkEnabled);});
        document.getElementById('rxHH').addEventListener('click',function(e){e.stopPropagation();hkHold=!hkHold;this.classList.toggle('on',hkHold);});
        document.getElementById('rxHM').addEventListener('change',function(){hkMod=this.value;});

        document.getElementById('rxDCMouse').addEventListener('click',function(e){e.stopPropagation();dcMouseEnabled=!dcMouseEnabled;this.classList.toggle('on',dcMouseEnabled);});
        document.getElementById('rxDCF1').addEventListener('click',function(e){e.stopPropagation();dcF1Enabled=!dcF1Enabled;this.classList.toggle('on',dcF1Enabled);});
        for(let i=0;i<7;i++){document.getElementById(`rxM${i}`)?.addEventListener('input',function(){macros[i].text=this.value;});document.getElementById(`rxMT${i}`)?.addEventListener('click',function(e){e.stopPropagation();macros[i].withTarget=!macros[i].withTarget;this.classList.toggle('on',macros[i].withTarget);});}
        document.getElementById('rxVRoom').addEventListener('change',function(){vRoom=this.value;vCoordBounds=null;vAllTilesCache=null;vZoneSets=null;calcBounds();uiVS();});
        document.getElementById('rxVATG').addEventListener('click',function(e){
            e.stopPropagation();
            if(!myId){log('⚠ Primeiro seleciona tu na PVP');return;}
            vEnabled=!vEnabled;this.classList.toggle('on',vEnabled);
            if(vEnabled){vHits=0;vLastHitTile=null;vBallPos=null;calcBounds();vAllTilesCache=null;vZoneSets=null;
                if(myId&&users.has(myId)){const me=users.get(myId);detectMyPos(me.x,me.y);detectMyPos(me.dx!==undefined?me.dx:me.x,me.dy!==undefined?me.dy:me.y);}
                log('🏐 ON');}
            else{vMyPos=null;vLastHitTile=null;log('🏐 OFF');}
            uiVS();
        });
        document.getElementById('rxVCFG').addEventListener('click',e=>{e.stopPropagation();document.getElementById('rxVCfgWrap')?.classList.toggle('open');});
        const _vModeUpdate=()=>{
            const rBtn=document.getElementById('rxVMRage'),hBtn=document.getElementById('rxVMHuman');
            if(rBtn){rBtn.style.background=vMode==='rage'?'rgba(56,139,253,.1)':'';rBtn.style.borderColor=vMode==='rage'?'rgba(56,139,253,.5)':'var(--rx-border)';rBtn.style.color=vMode==='rage'?'var(--rx-accent)':'var(--rx-dim)';}
            if(hBtn){hBtn.style.background=vMode==='human'?'rgba(56,139,253,.1)':'';hBtn.style.borderColor=vMode==='human'?'rgba(56,139,253,.5)':'var(--rx-border)';hBtn.style.color=vMode==='human'?'var(--rx-accent)':'var(--rx-dim)';}
        };
        document.getElementById('rxVMRage').addEventListener('click',e=>{e.stopPropagation();vMode='rage';_vModeUpdate();log('🏐 Rage');});
        document.getElementById('rxVMHuman').addEventListener('click',e=>{e.stopPropagation();vMode='human';_vModeUpdate();log('🏐 Humanizado');});
        document.getElementById('rxVREC').addEventListener('click',function(e){
            e.stopPropagation();
            if(vRec){vRec=false;vDbg(`⏹ ${vCustomPos[vRecIdx].length} tiles`);this.textContent='⏺ Gravar';this.classList.remove('recording');uiRC();return;}
            vRec=true;vRecIdx=parseInt(document.getElementById('rxVRP').value)||0;vRecLast=null;vRecTime=0;vRecLines=[];
            this.textContent='⏹ Parar';this.classList.add('recording');vDbg(`🔴 Gravando Pos ${vRecIdx+1}`);
        });
        document.getElementById('rxVRP').addEventListener('change',function(){if(vRec){vRec=false;document.getElementById('rxVREC').textContent='⏺ Gravar';document.getElementById('rxVREC').classList.remove('recording');}uiRC();});
        document.getElementById('rxVRCL').addEventListener('click',e=>{e.stopPropagation();vCustomPos[parseInt(document.getElementById('rxVRP').value)||0]=[];uiRC();});
        document.getElementById('rxVEXP').addEventListener('click',function(e){e.stopPropagation();const out={};vCustomPos.forEach((z,i)=>{if(z.length>0)out[`pos${i+1}`]=z;});navigator.clipboard.writeText(JSON.stringify(out,null,2)).then(()=>{this.textContent='✓';setTimeout(()=>{this.textContent='Export';},1200);}).catch(()=>{});});
        document.getElementById('rxVIMP').addEventListener('click',function(e){e.stopPropagation();const j=prompt('JSON:');if(!j)return;try{const d=JSON.parse(j);const ks=Object.keys(d);if(ks.some(k=>k.startsWith('blue')||k.startsWith('green'))){['blue1','blue2','blue3','green1','green2','green3'].forEach((k,i)=>{if(d[k])vCustomPos[i]=d[k].map(v=>Array.isArray(v)?v:[v.x,v.y]);});}else{ks.forEach(k=>{const m=k.match(/(\d+)/);if(m){const i=parseInt(m[1])-1;if(i>=0&&i<6)vCustomPos[i]=d[k].map(v=>Array.isArray(v)?v:[v.x,v.y]);}});}uiRC();this.textContent='✓';setTimeout(()=>{this.textContent='Import';},1200);}catch(err){}});
        uiRC();log('v46.6');
    }

    function uiRC(){const i=parseInt(document.getElementById('rxVRP')?.value)||0;const el=document.getElementById('rxVRC');if(el)el.textContent=`${vCustomPos[i].length} tiles`;}
    function vDbg(m){vRecLines.push(m);if(vRecLines.length>40)vRecLines=vRecLines.slice(-25);const el=document.getElementById('rxVDBG');if(el){el.innerHTML=vRecLines.map(l=>l.startsWith('✅')?`<div class="hit">${l}</div>`:l.startsWith('➖')?`<div class="rm">${l}</div>`:l.startsWith('📦')?`<div class="pkt">${l}</div>`:l.startsWith('🏐')?`<div class="ball">${l}</div>`:`<div>${l}</div>`).join('');el.scrollTop=el.scrollHeight;}}

    function _uiVS(){try{
        const t=document.getElementById('rxVTitle');if(t){t.textContent=vEnabled?'Autoplay ON':'Volleyball';t.style.color=vEnabled?'var(--rx-accent)':'';}
        const tg=document.getElementById('rxVATG');if(tg)tg.classList.toggle('on',vEnabled);
        const info=document.getElementById('rxVInfo'),meth=document.getElementById('rxVMethod');
        if(info){
            if(!myId){info.innerHTML='seleciona tu no pvp';info.className='xv-info';}
            else if(!users.has(myId)){info.innerHTML='Aguardando';info.className='xv-info';}
            else{const me=users.get(myId),pos=vMyPos!=null?`Pos ${vMyPos+1}`:'Fora',ball=vBallPos?`(${vBallPos.x},${vBallPos.y})`:'—',inZ=vBallPos&&inMyPos(vBallPos.x,vBallPos.y);info.innerHTML=`<div class="big">${esc(me.name)} · ${pos}</div><div class="sub">(${me.x},${me.y}) | Bola: ${ball}${inZ?' ★':''} | Hits: ${vHits}</div>`;info.className=vEnabled?'xv-info on':'xv-info';}
        }
        if(meth)meth.textContent='';
    }catch(e){}}
    function _uiVU(){try{
        const c=document.getElementById('rxVU'),cnt=document.getElementById('rxVC2');if(!c)return;
        const list=[...users.values()];if(cnt)cnt.textContent=list.length;
        if(!list.length){c.innerHTML='<div class="xe">Entrando...</div>';return;}
        c.innerHTML=list.map(u=>{const isMe=u.id===myId,rx=u.dx!==undefined?u.dx:u.x,ry=u.dy!==undefined?u.dy:u.y;return`<div class="xi ${isMe?'me':''}"><div class="n">${isMe?'👤 ':''}${esc(u.name)}</div><div class="co" id="vco${u.id}">(${rx},${ry})</div></div>`;}).join('');
    }catch(e){}}
    function uiStatus(){try{const d=document.getElementById('rxD');if(d)d.classList.toggle('on',gs?.readyState===WebSocket.OPEN);const l=document.getElementById('rxL');if(l){if(looping&&autoMode){l.textContent='AUTO';l.className='xon';}else if(looping&&persistFlood){l.textContent='ATIVADAO';l.className='xon';}else if(looping){l.textContent='ON';l.className='xon';}else if(autoMode){l.textContent='ESPERA';l.className='xoff';}else{l.textContent='OFF';l.className='xoff';}l.style.color='';}const f=document.getElementById('rxF');if(f){f.textContent=looping?'Parar':'Iniciar Flood';f.classList.toggle('on',looping);}}catch(e){}}
    function uiTarget(){try{const el=document.getElementById('rxT');if(!el)return;if(selId&&users.has(selId)){const u=users.get(selId);lastTarget={id:u.id,name:u.name};el.innerHTML=`<div class="tn">${esc(u.name)}</div><div class="td" id="rxTD">ID: ${u.id} · (${u.x},${u.y})</div>`;el.classList.add('a');}else if(lastTarget){el.innerHTML=`<div class="tn">${esc(lastTarget.name)}</div><div class="td">salvo</div>`;el.classList.add('a');}else{el.textContent='Esperando Alvo';el.classList.remove('a');}}catch(e){}}
    function _uiUsers(){try{const c=document.getElementById('rxU'),cnt=document.getElementById('rxC');if(!c)return;const list=[...users.values()];if(cnt)cnt.textContent=list.length;if(!list.length){c.innerHTML='<div class="xe">Entrando...</div>';return;}c.innerHTML=list.map(u=>{const wl=whitelist.has(u.id),isMe=u.id===myId,cls=isMe?'me':wl?'wl':'',pre=isMe?'👤 ':wl?'🛡 ':'';return`<div class="xi ${selId===u.id?'s':''} ${cls}" data-id="${u.id}"><div><div class="n">${pre}${esc(u.name)}</div><div class="id">ID: ${u.id}</div></div><div style="display:flex;align-items:center;gap:3px"><div class="co" id="co${u.id}">(${u.x},${u.y})</div>${isMe?'':`<div class="xwl" data-wid="${u.id}">🛡</div>`}</div></div>`;}).join('');c.querySelectorAll('.xi').forEach(item=>{item.addEventListener('click',e=>{if(e.target.closest('.xwl'))return;e.stopPropagation();const uid=parseInt(item.dataset.id);if(whitelist.has(uid)||uid===myId)return;selId=uid;lastTarget={id:uid,name:users.get(uid)?.name||`#${uid}`};uiUsers();uiTarget();if(looping){stopFlood();startFlood();}});});c.querySelectorAll('.xwl').forEach(btn=>{btn.addEventListener('click',e=>{e.stopPropagation();const uid=parseInt(btn.dataset.wid);if(whitelist.has(uid))whitelist.delete(uid);else{whitelist.add(uid);if(selId===uid){selId=null;lastTarget=null;uiTarget();}}uiUsers();});});}catch(e){}}
    function _uiPositions(){try{for(const[,u]of users){for(const pre of ['co','vco']){const el=document.getElementById(`${pre}${u.id}`);if(el){const rx=u.dx!==undefined?u.dx:u.x,ry=u.dy!==undefined?u.dy:u.y;el.textContent=`(${rx},${ry})`;el.style.color=(rx!==u.x||ry!==u.y)?'var(--rx-accent)':'';}}}if(selId&&users.has(selId)){const td=document.getElementById('rxTD');if(td){const u=users.get(selId);td.textContent=`ID: ${u.id} · (${u.dx!==undefined?u.dx:u.x},${u.dy!==undefined?u.dy:u.y})`;}}
    _uiVS();}catch(e){}}

    function esc(t){if(!t)return '';const map={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};return t.replace(/[&<>"']/g,m=>map[m]);}
    function isOurInput(el){return el&&(el.closest('#rx')!==null);}

    let f1CachedTarget=null;
    setInterval(()=>{f1CachedTarget=document.querySelector('canvas');},2000);

    const f1Opts={bubbles:true,cancelable:true,clientX:0,clientY:0,screenX:0,screenY:0,button:0,detail:1,view:window};

    window.addEventListener('keydown',e=>{
        if(e.keyCode===112&&dcF1Enabled){
            e.preventDefault();
            e.stopImmediatePropagation();
            const el=f1CachedTarget;
            if(!el)return;
            const cx=dcLastMouseX,cy=dcLastMouseY;
            f1Opts.clientX=cx;f1Opts.clientY=cy;f1Opts.screenX=cx;f1Opts.screenY=cy;
            f1Opts.detail=1;
            el.dispatchEvent(new MouseEvent('mousedown',f1Opts));
            el.dispatchEvent(new MouseEvent('mouseup',f1Opts));
            el.dispatchEvent(new MouseEvent('click',f1Opts));
            f1Opts.detail=2;
            el.dispatchEvent(new MouseEvent('mousedown',f1Opts));
            el.dispatchEvent(new MouseEvent('mouseup',f1Opts));
            el.dispatchEvent(new MouseEvent('click',f1Opts));
            el.dispatchEvent(new MouseEvent('dblclick',f1Opts));
        }
    },{capture:true});

    document.addEventListener('keydown',e=>{
        if(e.keyCode===119){e.preventDefault();panelOpen=!panelOpen;document.getElementById('rx')?.classList.toggle('vis',panelOpen);return;}
        if(e.keyCode===112)return;
        const fm=e.key.match(/^F([1-7])$/);
        if(fm){
            e.preventDefault();
            e.stopPropagation();
            if(isOurInput(document.activeElement))return;
            sendMacro(parseInt(fm[1])-1);
            return;
        }
        if(!hkEnabled||e.repeat)return;
        const mod=(hkMod==='alt'&&e.key==='Alt')||(hkMod==='ctrl'&&e.key==='Control')||(hkMod==='shift'&&e.key==='Shift');
        if(mod){e.preventDefault();if(hkHold){if(!looping)startFlood();}else{looping?stopFlood():startFlood();}}
    },true);

    document.addEventListener('keyup',e=>{if(/^F[1-7]$/.test(e.key)){e.preventDefault();e.stopPropagation();return;}if(!hkEnabled||!hkHold)return;const mod=(hkMod==='alt'&&e.key==='Alt')||(hkMod==='ctrl'&&e.key==='Control')||(hkMod==='shift'&&e.key==='Shift');if(mod&&looping){e.preventDefault();stopFlood();}},true);

    function addIcon(){
        if(document.getElementById('rx-icon'))return;
        const nav=document.querySelector('.icon.icon-inventory')?.parentElement
            ||document.querySelector('.icon.icon-catalog')?.parentElement
            ||document.querySelector('.icon.icon-rooms')?.parentElement;
        const container=nav?.parentElement;
        if(!container)return;
        const i=document.createElement('div');
        i.id='rx-icon';
        i.className='cursor-pointer navigation-item';
        const img=document.createElement('div');
        img.className='rx-img';
        img.style.backgroundImage="url('data:image/png;base64,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')";
        i.appendChild(img);
        i.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();panelOpen=!panelOpen;document.getElementById('rx')?.classList.toggle('vis',panelOpen);});
        container.appendChild(i);
    }

    setTimeout(()=>{try{if(document.body)createPanel();}catch(e){console.error(e);}},1500);
    setInterval(()=>{try{addIcon();uiStatus();}catch(e){}},1000);

    window.rxInfo=()=>({myId,users:users.size,volley:{on:vEnabled,myPos:vMyPos,hits:vHits,ballPos:vBallPos,detectedBallId:vDetectedBallId,bounds:vCoordBounds}});
    window.rxUsers=()=>{console.table([...users.values()].map(u=>({id:u.id,name:u.name,x:u.x,y:u.y,idx:u.roomIdx})));return `${users.size} users`;};
    window.rxBall=()=>{console.log('Ball:',ballId(),'Pos:',vBallPos);return 'ok';};
    window.rxZones=()=>{zones().forEach((z,i)=>console.log(`Pos ${i+1}: ${z.length} tiles`));};
    window.rxSet=v=>{ms=Math.max(10,v);};
})();
