/* ============================================================
   FighTea — App Data & State  (data.js)  v5
   New: sizes optional per item, varieties, promos, logo
   ============================================================ */
'use strict';

const API_BASE = 'https://backend-iiy0dz3zy-fightea-milktea-shops-projects.vercel.app';

const App = {
  currentUser:  null,
  currentView:  'home',
  cart:         [],
  activeFilter: 'All',
  orderCounter: 0,
};

/* ── CATEGORIES ─────────────────────────────────────────── */
let MENU_CATEGORIES = [];

/* ── GLOBAL SIZES (admin-editable, applied per item optionally) */
let GLOBAL_SIZES = [];
let SIZE_ID_SEQ  = 1;

/* ── ICE OPTIONS (fixed) ─────────────────────────────────── */
const ICE_OPTIONS = [
  { id:'normal', label:'Normal'   },
  { id:'less',   label:'Less Ice' },
  { id:'no',     label:'No Ice'   },
  { id:'warm',   label:'Warm'     },
];

/* ── TOPPINGS (admin-editable) ───────────────────────────── */
let TOPPINGS = [];
let TOPPING_ID_SEQ = 1;

/* ── PROMOS (admin-editable) ─────────────────────────────── */
let PROMOS = [];
let PROMO_ID_SEQ = 1;
/*  Promo shape:
    {
      id, name, description, badge,   // e.g. "Buy 1 Take 1", "Weekend Deal", "B1T1"
      isActive,
      items: [
        { itemId, varietyId|null, sizeId|null, promoPrice }
      ]
    }
*/

/* ── MENU ITEMS ──────────────────────────────────────────── */
async function loadMenuFromAPI() {
  const [cats, products, sizes, toppings, promos] = await Promise.all([
    fetch(`${API_BASE}/menu/categories`).then(r => r.json()),
    fetch(`${API_BASE}/menu/products`).then(r => r.json()),
    fetch(`${API_BASE}/menu/sizes`).then(r => r.json()),
    fetch(`${API_BASE}/menu/toppings`).then(r => r.json()),
    fetch(`${API_BASE}/menu/promos`).then(r => r.json()),
  ]);
  MENU_CATEGORIES = cats.map(c => c.name);
  MENU_ITEMS = products.map(p => ({
    id: p.id, cat: p.category, name: p.name, desc: p.description,
    basePrice: p.base_price, image: p.image_url, emoji: p.emoji,
    bestseller: !!p.is_bestseller, available: !!p.is_available,
    hasSizes: !!p.has_sizes, varieties: p.varieties || [], sizes: [],
  }));
  GLOBAL_SIZES = sizes.map(s => ({ id: s.id, label: s.label, priceAdd: s.price_add }));
  TOPPINGS = toppings.map(t => ({ id: t.id, name: t.name, emoji: t.emoji, price: t.price }));
  PROMOS = promos.map(p => ({ id: p.id, name: p.name, badge: p.badge, description: p.description,
    isActive: !!p.is_active, items: (p.items||[]).map(i => ({ itemId: i.product_id,
      varietyId: i.variety_id, sizeId: i.size_id, promoPrice: i.promo_price })) }));
}
/*  Item shape:
    {
      id, cat, name, desc, image, emoji,
      basePrice,          // base price (no size/variety selected)
      hasSizes: bool,     // if false, sizes are not shown
      sizes: [            // item-specific overrides (uses global size labels)
        { sizeId, label, priceAdd }
      ],
      varieties: [        // e.g. [{id, name, price}]  — mutually exclusive with size selection
        { id, name, price }
      ],
      bestseller, available
    }
*/

let VARIETY_ID_SEQ = 1;

/* ── ORDERS ─────────────────────────────────────────────── */
let ORDERS = [];

/* ── USERS ──────────────────────────────────────────────── */
let USERS = [
  { id:1, name:'FighTea Admin', email:'admin@fightea.com', password:'Admin@FighTea2024', role:'admin' },
];
let USER_ID_SEQ = 2;

/* ── DEFAULT IMAGE ──────────────────────────────────────── */
const DEFAULT_IMG = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop&q=80';

/* ── UTILS ───────────────────────────────────────────────── */
function formatCurrency(n){ return '₱'+Number(n).toLocaleString('en-PH',{minimumFractionDigits:0,maximumFractionDigits:2}); }
function generateOrderId(){ App.orderCounter++; return 'FT-'+String(App.orderCounter).padStart(4,'0'); }
function getCurrentTime(){ return new Date().toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'}); }
function getCategories(){ return ['All',...MENU_CATEGORIES]; }

function drinkImg(item, cls='', style=''){
  const src=item.image||DEFAULT_IMG, fb=item.emoji||'🧋';
  return `<img src="${src}" alt="${item.name||''}" class="${cls}" style="${style}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" loading="lazy">`+
         `<span style="display:none;align-items:center;justify-content:center;font-size:48px;width:100%;height:100%">${fb}</span>`;
}

/** Returns the item's effective sizes array (item-specific or falls back to global) */
function getItemSizes(item){
  if(!item.hasSizes) return [];
  if(item.sizes && item.sizes.length>0) return item.sizes;
  return GLOBAL_SIZES.map(s=>({sizeId:s.id, label:s.label, priceAdd:s.priceAdd}));
}

/** Compute base display price for a menu item (lowest option) */
function getItemDisplayPrice(item){
  if(item.varieties && item.varieties.length>0){
    return Math.min(...item.varieties.map(v=>v.price));
  }
  return item.basePrice;
}

/** Get active promos for a given item */
function getItemPromos(itemId){
  return PROMOS.filter(p=>p.isActive && p.items.some(pi=>pi.itemId===itemId));
}

function saveSession(data) {
  App.currentUser = data.user;
  localStorage.setItem('fightea_token', data.token);
}
async function loadSession() {
  const token = localStorage.getItem('fightea_token');
  if (!token) return;
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (res.ok) App.currentUser = await res.json();
  else clearSession();
}
function clearSession() {
  App.currentUser = null;
  localStorage.removeItem('fightea_token');
}

function isLoggedIn(){    return !!App.currentUser; }
function isAdmin(){       return App.currentUser&&(App.currentUser.role==='admin'||App.currentUser.role==='staff'); }
function isStrictAdmin(){ return App.currentUser&&App.currentUser.role==='admin'; }

function cartTotal(){ return App.cart.reduce((s,i)=>s+i.price*i.qty,0); }
function cartCount(){ return App.cart.reduce((s,i)=>s+i.qty,0); }

function getAnalytics(){
  const today=new Date().toDateString();
  const todayOrds=ORDERS.filter(o=>o.dateStr===today);
  const paidOrds=ORDERS.filter(o=>o.paymentStatus==='paid');
  const totalRevenue=paidOrds.reduce((s,o)=>s+o.total,0);
  const todayRevenue=todayOrds.filter(o=>o.paymentStatus==='paid').reduce((s,o)=>s+o.total,0);
  const pendingRevenue=ORDERS.filter(o=>o.payment==='cash'&&o.paymentStatus==='unpaid').reduce((s,o)=>s+o.total,0);
  const byStatus={};
  ORDERS.forEach(o=>{byStatus[o.status]=(byStatus[o.status]||0)+1;});
  const gcashCount=ORDERS.filter(o=>o.payment==='gcash').length;
  const cashCount=ORDERS.filter(o=>o.payment==='cash').length;
  const itemCounts={};
  ORDERS.forEach(order=>{
    order.items.forEach(item=>{
      const k=item.name;
      if(!itemCounts[k]) itemCounts[k]={name:k,emoji:item.emoji,image:item.image,count:0,revenue:0};
      itemCounts[k].count+=item.qty; itemCounts[k].revenue+=item.price*item.qty;
    });
  });
  return {
    totalRevenue,todayRevenue,pendingRevenue,
    totalOrders:ORDERS.length,todayOrders:todayOrds.length,
    completedOrders:byStatus.completed||0,
    gcashCount,cashCount,
    avgOrder:ORDERS.length?(totalRevenue/ORDERS.length):0,
    topItems:Object.values(itemCounts).sort((a,b)=>b.count-a.count).slice(0,5),
    availableItems:MENU_ITEMS.filter(i=>i.available).length,
    unavailableItems:MENU_ITEMS.filter(i=>!i.available).length,
    totalMenuItems:MENU_ITEMS.length,
    totalToppings:TOPPINGS.length,
    totalCategories:MENU_CATEGORIES.length,
    totalPromos:PROMOS.filter(p=>p.isActive).length,
    byStatus,
  };
}

function getOrderStats(){
  return {
    pending:ORDERS.filter(o=>o.status==='pending').length,
    preparing:ORDERS.filter(o=>o.status==='preparing').length,
    ready:ORDERS.filter(o=>o.status==='ready').length,
    total:ORDERS.filter(o=>o.paymentStatus==='paid').reduce((s,o)=>s+o.total,0),
  };
}
