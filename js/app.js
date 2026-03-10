/* ═══════════════════════════════════════════════════════════
   SAMARITAN — app.js  (Kenya Edition)
   Community-Powered Civic Platform
   2026 Ready Version
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
  sosHoldTimeout: null,

  currentFilter: 'all',
  confirmedPosts: new Set(),
  extraPostsLoaded: false,

  mapInstance: null,
  reportMapInstance: null,
  userMarker: null
};

/* ──────────────────────────────────────────────────────────
   SAMPLE DATA
────────────────────────────────────────────────────────── */
const POSTS = [
  {
    id:1, category:'corruption',
    title:'NYS contractor paid twice for same road',
    desc:'Documents show Sh47M disbursed to Apex Contractors Ltd in March and June for the same Githurai–Kamiti stretch. Road still potholed.',
    location:'Githurai, Nairobi', time:'18 min ago',
    confirmations:63, icon:'💰', lat:-1.219, lng:36.908
  },
  {
    id:2, category:'abandoned',
    title:'Dispensary construction stalled — 4 years',
    desc:'Foundations poured in 2020, nothing since. Residents walk 9km to Kajiado County Hospital. Contractor untraceable.',
    location:'Isinya, Kajiado County', time:'45 min ago',
    confirmations:107, icon:'🏗️', lat:-1.932, lng:36.972
  },
  {
    id:3, category:'environment',
    title:'Nairobi River choked with industrial effluent',
    desc:'Black oily discharge spotted flowing from Kariobangi Light Industries into the river. Fish kill reported downstream near Mathare.',
    location:'Kariobangi, Nairobi', time:'1 hr ago',
    confirmations:218, icon:'🌿', lat:-1.267, lng:36.876
  },
  {
    id:4, category:'safety',
    title:'Collapsed footbridge — 3 students injured',
    desc:'Wooden bridge over drainage channel near Pumwani Primary gave way yesterday morning. No replacement in sight.',
    location:'Pumwani, Nairobi', time:'2 hrs ago',
    confirmations:84, icon:'⚠️', lat:-1.282, lng:36.849
  },
  {
    id:5, category:'public',
    title:'Huduma Centre closed — no explanation',
    desc:'Mombasa Huduma Centre shuttered for 11 days. Staff say "system upgrade" but no official notice. Hundreds turned away daily.',
    location:'Mombasa CBD', time:'3 hrs ago',
    confirmations:51, icon:'🏛️', lat:-4.043, lng:39.668
  },
  {
    id:6, category:'corruption',
    title:'Phantom bursary recipients — Kisumu County',
    desc:'Over 200 bursary slots allocated to ghost students. Source within education office leaks names linked to officials\' relatives.',
    location:'Kisumu City', time:'5 hrs ago',
    confirmations:176, icon:'💰', lat:-0.091, lng:34.768
  },
  {
    id:7, category:'environment',
    title:'Plastic waste dumped in Karura Forest',
    desc:'Truckload of plastic bags and construction debris dumped at the Limuru Road entrance of Karura Forest at night. CCTV footage available.',
    location:'Karura Forest, Nairobi', time:'6 hrs ago',
    confirmations:142, icon:'🌿', lat:-1.231, lng:36.820
  },
  {
    id:8, category:'safety',
    title:'Exposed live cables — Nakuru town centre',
    desc:'KPLC cables dangling over Kenyatta Avenue after a matatu hit a pole 3 days ago. Area roped off but cables still live.',
    location:'Nakuru Town', time:'8 hrs ago',
    confirmations:39, icon:'⚠️', lat:-0.304, lng:36.068
  }
];

const EXTRA_POSTS = [
  {
    id:9, category:'public',
    title:'Water rationing — Kibera gets 2hrs/week',
    desc:'Nairobi Water Company confirms Kibera allocation cut from 3 days to 2 hours per week. No compensation or timeline given.',
    location:'Kibera, Nairobi', time:'10 hrs ago',
    confirmations:304, icon:'🏛️', lat:-1.312, lng:36.787
  },
  {
    id:10, category:'abandoned',
    title:'SGR feeder road funds disappeared — Voi',
    desc:'KSh 120M allocated for access roads to Voi SGR station. Two years later: murram track, no grading, no drainage.',
    location:'Voi, Taita Taveta County', time:'1 day ago',
    confirmations:233, icon:'🏗️', lat:-3.396, lng:38.558
  }
];

/* ──────────────────────────────────────────────────────────
   HELPER FUNCTIONS
────────────────────────────────────────────────────────── */
function escapeHtml(text) {
  return text.replace(/[&<>"']/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]; });
}

function showToast(msg, type='info') {
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(()=>{ document.body.removeChild(toast); }, 3000);
}

/* ──────────────────────────────────────────────────────────
   REVERSE GEOCODING
────────────────────────────────────────────────────────── */
function reverseGeocode(lat, lng, callback) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`;
  fetch(url, {headers:{'Accept-Language':'en'}})
    .then(r=>r.json())
    .then(data=>{
      const a=data.address||{};
      const parts=[a.suburb||a.neighbourhood||a.village||a.town||a.road,a.city||a.county||a.state_district].filter(Boolean);
      const place = parts.slice(0,2).join(', ') || (data.display_name||'').split(',').slice(0,2).join(',').trim();
      callback(place||(lat.toFixed(4)+', '+lng.toFixed(4)));
    })
    .catch(()=>callback(lat.toFixed(4)+', '+lng.toFixed(4)));
}

/* ──────────────────────────────────────────────────────────
   LOCATION DETECTION
────────────────────────────────────────────────────────── */
function detectUserLocation() {
  if(!navigator.geolocation){ setKenyaDefaults(); return; }
  navigator.geolocation.getCurrentPosition(
    pos=>{
      State.userLat=pos.coords.latitude;
      State.userLng=pos.coords.longitude;
      reverseGeocode(State.userLat,State.userLng,place=>{
        State.userPlace=place;
        State.reportLat=State.userLat;
        State.reportLng=State.userLng;
        State.reportPlace=place;
        const el=document.getElementById('sos-loc-display');
        if(el) el.textContent=place+` (${State.userLat.toFixed(4)}, ${State.userLng.toFixed(4)})`;
        updateReportLocationUI(place,State.userLat,State.userLng);
        showToast('📍 '+place,'success');
      });
    },
    ()=>{ setKenyaDefaults(); showToast('Enable GPS for live location','warning'); },
    {enableHighAccuracy:true, timeout:10000, maximumAge:0}
  );
}

function setKenyaDefaults() {
  State.userLat=-1.2921;
  State.userLng=36.8219;
  State.userPlace='Nairobi, Kenya';
  State.reportLat=State.userLat;
  State.reportLng=State.userLng;
  State.reportPlace=State.userPlace;
  updateReportLocationUI(State.userPlace,State.userLat,State.userLng);
  const el=document.getElementById('sos-loc-display'); if(el) el.textContent=State.userPlace;
}

/* ──────────────────────────────────────────────────────────
   UPDATE REPORT UI
────────────────────────────────────────────────────────── */
function updateReportLocationUI(place,lat,lng){
  const txt=document.getElementById('location-text');
  const strip=document.getElementById('location-strip');
  if(!txt||!strip) return;
  txt.textContent = place + (lat?` (${lat.toFixed(4)}, ${lng.toFixed(4)})`:'');
  strip.classList.add('captured');
}

/* ──────────────────────────────────────────────────────────
   FEED LOGIC
────────────────────────────────────────────────────────── */
function loadFeed(filter){
  filter=filter||State.currentFilter;
  State.currentFilter=filter;
  const container=document.getElementById('feed-container');
  container.innerHTML='';
  const filtered = filter==='all'?POSTS:POSTS.filter(p=>p.category===filter);
  document.getElementById('feed-count').textContent=filtered.length+' reports';
  document.getElementById('stat-total').textContent=POSTS.length+EXTRA_POSTS.length;
  filtered.forEach((post,i)=>container.appendChild(buildCard(post,i)));
}

function buildCard(post,delay=0){
  const isConfirmed = State.confirmedPosts.has(post.id);
  const card=document.createElement('article');
  card.className='card';
  card.style.animationDelay=(delay*75)+'ms';
  card.dataset.id=post.id;
  card.innerHTML=`
    <div class="card-img-placeholder" role="img"><span style="font-size:50px">${post.icon}</span></div>
    <div class="card-body">
      <div class="card-meta">
        <span class="badge badge-${post.category}">${post.category.toUpperCase()}</span>
        <span class="card-time">⏱ ${post.time}</span>
      </div>
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
   CONFIRM & SHARE EVENTS
────────────────────────────────────────────────────────── */
document.getElementById('feed-container').addEventListener('click',e=>{
  const confirmBtn=e.target.closest('.confirm-btn');
  const shareBtn=e.target.closest('.share-btn');
  if(confirmBtn) updateConfirmation(Number(confirmBtn.dataset.id),confirmBtn);
  if(shareBtn) sharePost(Number(shareBtn.dataset.id));
});

function updateConfirmation(postId,btn){
  if(State.confirmedPosts.has(postId)){ showToast('Already confirmed this report','warning'); return; }
  State.confirmedPosts.add(postId);
  btn.classList.add('confirmed'); btn.innerHTML='✅ Confirmed';
  const post=POSTS.concat(EXTRA_POSTS).find(p=>p.id===postId);
  if(post){ post.confirmations++; const el=document.getElementById('conf-'+postId); if(el) el.textContent=post.confirmations+' confirmations'; }
  showToast('Report confirmed — asante!','success');
}

function sharePost(postId){
  if(navigator.share){ navigator.share({title:'The Samaritan — Civic Report', url:window.location.href}).catch(()=>{}); }
  else showToast('Share link copied!','success');
}

/* ──────────────────────────────────────────────────────────
   SOS LOGIC — HOLD TO CALL
────────────────────────────────────────────────────────── */
const sosBtn=document.getElementById('sos-hero-btn');
const EMERGENCY_NUMBER='999';

sosBtn.addEventListener('mousedown',()=>startHoldToCall());
sosBtn.addEventListener('touchstart',()=>startHoldToCall());
sosBtn.addEventListener('mouseup',()=>stopHoldToCall());
sosBtn.addEventListener('touchend',()=>stopHoldToCall());

function startHoldToCall(){
  showToast('Hold 2–3s to trigger emergency call','info');
  State.sosHoldTimeout=setTimeout(()=>{
    window.location.href='tel:'+EMERGENCY_NUMBER;
    showToast('Calling emergency: '+EMERGENCY_NUMBER,'success');
  },2500);
}

function stopHoldToCall(){
  if(State.sosHoldTimeout){ clearTimeout(State.sosHoldTimeout); State.sosHoldTimeout=null; }
}

/* ──────────────────────────────────────────────────────────
   INIT
────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded',()=>{
  detectUserLocation();
  loadFeed();
});