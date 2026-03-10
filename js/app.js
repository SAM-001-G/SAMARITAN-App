/* ═══════════════════════════════════════════════════════════
   SAMARITAN — app.js  (Kenya Edition)
   Community-Powered Civic Platform
   Updated with safe 2–3 second hold SOS
   ═══════════════════════════════════════════════════════════ */

'use strict';

/* ──────────────────────────────────────────────────────────
   STATE
────────────────────────────────────────────────────────── */
const State = {
  userLat: null,
  userLng: null,
  userPlace: 'Detecting location…',
  reportLat: null,
  reportLng: null,
  reportPlace: null,
  selectedCategory: null,
  reportPinMarker: null,
  sosType: null,
  sosLat: null,
  sosLng: null,
  sosPlace: null,
  currentFilter: 'all',
  confirmedPosts: new Set(),
  extraPostsLoaded: false,
  mapInstance: null,
  reportMapInstance: null,
  userMarker: null,
};

/* ──────────────────────────────────────────────────────────
   SAMPLE POSTS (replace with Firebase if needed)
────────────────────────────────────────────────────────── */
const POSTS = [
  {id:1, category:'corruption', title:'NYS contractor paid twice', desc:'Documents show Sh47M...', location:'Githurai, Nairobi', time:'18 min ago', confirmations:63, icon:'💰', lat:-1.219, lng:36.908},
  {id:2, category:'abandoned', title:'Dispensary stalled — 4 years', desc:'Foundations poured in 2020...', location:'Isinya, Kajiado County', time:'45 min ago', confirmations:107, icon:'🏗️', lat:-1.932, lng:36.972},
  {id:3, category:'environment', title:'Nairobi River choked', desc:'Black oily discharge...', location:'Kariobangi, Nairobi', time:'1 hr ago', confirmations:218, icon:'🌿', lat:-1.267, lng:36.876},
  {id:4, category:'safety', title:'Collapsed footbridge — 3 students injured', desc:'Wooden bridge over drainage...', location:'Pumwani, Nairobi', time:'2 hrs ago', confirmations:84, icon:'⚠️', lat:-1.282, lng:36.849},
  {id:5, category:'public', title:'Huduma Centre closed', desc:'Mombasa Huduma Centre shuttered...', location:'Mombasa CBD', time:'3 hrs ago', confirmations:51, icon:'🏛️', lat:-4.043, lng:39.668},
];

/* ──────────────────────────────────────────────────────────
   REVERSE GEOCODING
────────────────────────────────────────────────────────── */
function reverseGeocode(lat, lng, callback){
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`;
  fetch(url, {headers:{'Accept-Language':'en'}})
    .then(r=>r.json())
    .then(data=>{
      const a=data.address||{};
      const parts=[a.suburb||a.neighbourhood||a.village||a.town||a.road,a.city||a.county||a.state_district].filter(Boolean);
      callback(parts.slice(0,2).join(', ')||(data.display_name||'').split(',').slice(0,2).join(',').trim()||`${lat.toFixed(4)},${lng.toFixed(4)}`);
    })
    .catch(()=>callback(`${lat.toFixed(4)},${lng.toFixed(4)}`));
}

/* ──────────────────────────────────────────────────────────
   DETECT USER LOCATION
────────────────────────────────────────────────────────── */
function detectUserLocation(){
  if(!navigator.geolocation){setKenyaDefaults(); return;}
  navigator.geolocation.getCurrentPosition(pos=>{
    State.userLat=pos.coords.latitude;
    State.userLng=pos.coords.longitude;
    reverseGeocode(State.userLat,State.userLng,place=>{
      State.userPlace=place;
      State.reportLat=State.userLat;
      State.reportLng=State.userLng;
      State.reportPlace=place;
      updateReportLocationUI(place,State.userLat,State.userLng);
      const el=document.getElementById('sos-loc-display'); if(el) el.textContent=`${place} (${State.userLat.toFixed(4)}, ${State.userLng.toFixed(4)})`;
      if(State.mapInstance){State.mapInstance.setView([State.userLat,State.userLng],13); placeUserMarker(State.userLat,State.userLng);}
      if(State.reportMapInstance){State.reportMapInstance.setView([State.userLat,State.userLng],14); placeReportPin(State.userLat,State.userLng,place);}
      showToast('📍 '+place,'success');
    });
  },()=>{setKenyaDefaults(); showToast('Enable GPS for live location','warning');},{enableHighAccuracy:true,timeout:10000,maximumAge:0});
}

function setKenyaDefaults(){
  State.userLat=-1.2921; State.userLng=36.8219; State.userPlace='Nairobi, Kenya';
  State.reportLat=State.userLat; State.reportLng=State.userLng; State.reportPlace=State.userPlace;
  updateReportLocationUI(State.userPlace,State.userLat,State.userLng);
  const el=document.getElementById('sos-loc-display'); if(el) el.textContent=State.userPlace;
}

/* ──────────────────────────────────────────────────────────
   UPDATE REPORT LOCATION STRIP
────────────────────────────────────────────────────────── */
function updateReportLocationUI(place,lat,lng){
  const txt=document.getElementById('location-text');
  const strip=document.getElementById('location-strip');
  if(!txt||!strip) return;
  txt.textContent=place+(lat?` (${lat.toFixed(4)}, ${lng.toFixed(4)})`:'');
  strip.classList.add('captured');
}

/* ──────────────────────────────────────────────────────────
   FEED FUNCTIONS
────────────────────────────────────────────────────────── */
function loadFeed(filter){
  filter=filter||State.currentFilter; State.currentFilter=filter;
  const container=document.getElementById('feed-container'); if(!container) return; container.innerHTML='';
  const filtered=filter==='all'?POSTS:POSTS.filter(p=>p.category===filter);
  document.getElementById('feed-count').textContent=filtered.length+' reports';
  filtered.forEach((post,i)=>container.appendChild(buildCard(post,i)));
}

function buildCard(post,delay){
  const isConfirmed=State.confirmedPosts.has(post.id);
  const card=document.createElement('article'); card.className='card'; card.style.animationDelay=(delay*75)+'ms'; card.dataset.id=post.id;
  card.innerHTML=`<div class="card-img-placeholder" role="img"><span style="font-size:50px">${post.icon}</span></div>
  <div class="card-body">
    <div class="card-meta"><span class="badge badge-${post.category}">${post.category.toUpperCase()}</span><span class="card-time">⏱ ${post.time}</span></div>
    <h3 class="card-title">${escapeHtml(post.title)}</h3>
    <p class="card-desc">${escapeHtml(post.desc)}</p>
    <div class="card-location">📍 ${escapeHtml(post.location)}</div>
    <div class="card-footer">
      <button class="confirm-btn${isConfirmed?' confirmed':''}" data-id="${post.id}">${isConfirmed?'✅ Confirmed':'👍 Confirm'}</button>
      <span class="confirm-count" id="conf-${post.id}">${post.confirmations} confirmations</span>
      <button class="share-btn" data-id="${post.id}" title="Share">↗</button>
    </div>
  </div>`;
  return card;
}

/* ──────────────────────────────────────────────────────────
   CONFIRM / SHARE EVENTS
────────────────────────────────────────────────────────── */
document.getElementById('feed-container').addEventListener('click',e=>{
  const confirmBtn=e.target.closest('.confirm-btn'); const shareBtn=e.target.closest('.share-btn');
  if(confirmBtn) updateConfirmation(Number(confirmBtn.dataset.id),confirmBtn);
  if(shareBtn) sharePost(Number(shareBtn.dataset.id));
});

function updateConfirmation(postId,btn){
  if(State.confirmedPosts.has(postId)){ showToast('Already confirmed this report','warning'); return; }
  State.confirmedPosts.add(postId);
  btn.classList.add('confirmed'); btn.innerHTML='✅ Confirmed';
  const post=POSTS.find(p=>p.id===postId); if(post){post.confirmations++; document.getElementById('conf-'+postId).textContent=post.confirmations+' confirmations';}
  showToast('Report confirmed — asante!','success');
}

function sharePost(postId){
  if(navigator.share){ navigator.share({title:'The Samaritan — Civic Report',url:window.location.href}).catch(()=>{}); }
  else{ showToast('Share link copied!','success'); }
}

/* ──────────────────────────────────────────────────────────
   SOS BUTTON — 2–3 SECOND HOLD CALL
────────────────────────────────────────────────────────── */
const sosHeroBtn=document.querySelectorAll('.sos-hero-btn');
const sosTypeCards=document.querySelectorAll('.sos-type-card');
const sosStatus=document.getElementById('sos-status');
let holdTimer=null, sosTriggered=false;
const emergencyNumbers={"Medical Emergency":"999","Fire Emergency":"999","Security Threat":"999","Accident / Disaster":"999"};

sosHeroBtn.forEach(btn=>{
  btn.addEventListener('mousedown',()=>startHoldToCall(btn));
  btn.addEventListener('mouseup',stopHoldToCall);
  btn.addEventListener('touchstart',()=>startHoldToCall(btn));
  btn.addEventListener('touchend',stopHoldToCall);
});

function startHoldToCall(btn){
  if(holdTimer) clearTimeout(holdTimer);
  if(sosStatus) sosStatus.textContent="⚠️ Hold to call — 2 sec";
  holdTimer=setTimeout(triggerSosCall,2000);
}

function stopHoldToCall(){
  clearTimeout(holdTimer);
  holdTimer=null;
  if(!sosTriggered) if(sosStatus) sosStatus.textContent="Monitoring Active — GPS Ready";
  sosTriggered=false;
}

function triggerSosCall(){
  if(sosTriggered) return;
  sosTriggered=true;
  let selectedType=null;
  sosTypeCards.forEach(card=>{if(card.classList.contains('active')||card.classList.contains('selected')) selectedType=card.dataset.type;});
  const numberToCall=selectedType?emergencyNumbers[selectedType]:"999";
  const serviceName=selectedType||"Police";
  if(sosStatus) sosStatus.textContent=`📞 Calling ${serviceName}…`;
  window.location.href=`tel:${numberToCall}`;
  holdTimer=null;
}

/* ──────────────────────────────────────────────────────────
   INITIALIZE
────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded',()=>{
  detectUserLocation();
  loadFeed('all');
});