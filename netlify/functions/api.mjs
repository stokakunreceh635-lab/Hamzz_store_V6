import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';

const store = getStore({ name: 'hamzz-v4-data', consistency: 'strong' });
const KEY='db.json';
const ADMIN_EMAIL=(process.env.HAMZZ_ADMIN_EMAIL||'admin1@gmail.com').toLowerCase();
const ADMIN_PASSWORD=process.env.HAMZZ_ADMIN_PASSWORD||'adminHamzz';
const SECRET=process.env.HAMZZ_AUTH_SECRET||'change-this-secret';

const now=()=>Date.now();
const id=()=>crypto.randomUUID();
const hash=p=>crypto.createHash('sha256').update(String(p)).digest('hex');
const sign=payload=>{const body=Buffer.from(JSON.stringify(payload)).toString('base64url');const sig=crypto.createHmac('sha256',SECRET).update(body).digest('base64url');return `${body}.${sig}`};
const verifyToken=t=>{try{const [body,sig]=String(t||'').split('.');if(!body||!sig)return null;const good=crypto.createHmac('sha256',SECRET).update(body).digest('base64url');if(!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(good)))return null;const p=JSON.parse(Buffer.from(body,'base64url').toString());return p.exp>now()?p:null}catch{return null}};
async function readDB(){let d=await store.get(KEY,{type:'json'});if(!d)d={users:[],products:[],orders:[],payments:[],vouchers:[],banners:[],flashSales:[],chats:[],revisions:[],ratings:[],info:{name:'HAMZZ Store',description:'Marketplace game dan jasa digital HAMZZ.',contact:'Hubungi admin melalui Chat Admin.'}};d.users??=[];d.products??=[];d.orders??=[];d.payments??=[];d.vouchers??=[];d.banners??=[];d.flashSales??=[];d.chats??=[];d.revisions??=[];d.ratings??=[];d.info??={name:'HAMZZ Store',description:'Marketplace game dan jasa digital HAMZZ.',contact:'Hubungi admin melalui Chat Admin.'};let a=d.users.find(u=>u.email===ADMIN_EMAIL);if(!a){d.users.push({id:id(),name:'Admin HAMZZ',email:ADMIN_EMAIL,passwordHash:hash(ADMIN_PASSWORD),role:'admin',created:now()});await store.setJSON(KEY,d)}return d}
async function saveDB(d){await store.setJSON(KEY,d)}
function auth(event){const h=event.headers?.authorization||event.headers?.Authorization||'';return verifyToken(h.startsWith('Bearer ')?h.slice(7):'')}
function res(status,body){return {statusCode:status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},body:JSON.stringify(body)}}
function ok(data={}){return res(200,{ok:true,...data})}
function fail(msg,status=400){return res(status,{ok:false,error:msg})}
function parse(event){try{if(event.httpMethod==='GET')return event.queryStringParameters||{};return JSON.parse(event.body||'{}')}catch{return {}}}
function requireUser(event,role){const u=auth(event);if(!u)return [null,fail('Silakan login terlebih dahulu.',401)];if(role&&u.role!==role)return [null,fail('Akses ditolak.',403)];return [u,null]}
const cleanUser=u=>u&&{id:u.id,name:u.name,email:u.email,role:u.role,created:u.created};
function publicState(d,u){const admin=u?.role==='admin';return {products:d.products,payments:d.payments,vouchers:d.vouchers.filter(v=>v.active!==false && (!v.expires||v.expires>=Date.now())),banners:d.banners.filter(b=>b.active!==false),flashSales:d.flashSales.filter(f=>f.active!==false && (!f.ends||f.ends>Date.now())),info:d.info,orders:admin?d.orders:d.orders.filter(o=>o.userId===u?.id),users:admin?d.users.map(cleanUser):[],chats:admin?d.chats:d.chats.filter(c=>c.userId===u?.id),revisions:admin?d.revisions:d.revisions.filter(r=>r.userId===u?.id),ratings:d.ratings,session:u?cleanUser(d.users.find(x=>x.id===u.id)||u):null}}

export default async function handler(event){
 try{
  const input=parse(event); const action=input.action; const d=await readDB(); const u=auth(event);
  if(event.httpMethod==='GET' && input.action==='state'){return ok(publicState(d,u))}
  if(action==='state')return ok(publicState(d,u));
  if(action==='register'){
   const email=String(input.email||'').trim().toLowerCase(), name=String(input.name||'').trim(), password=String(input.password||'');
   if(!name||!email||password.length<6)return fail('Nama, email, dan password minimal 6 karakter wajib diisi.');
   if(d.users.some(x=>x.email===email))return fail('Email sudah terdaftar.');
   const user={id:id(),name,email,passwordHash:hash(password),role:'user',created:now()};d.users.push(user);await saveDB(d);return ok({token:sign({userId:user.id,role:user.role,email:user.email,exp:now()+30*86400000})});
  }
  if(action==='login'){
   const email=String(input.email||'').trim().toLowerCase(),password=String(input.password||'');const user=d.users.find(x=>x.email===email);
   if(!user||user.passwordHash!==hash(password))return fail('Email atau password salah.',401);return ok({token:sign({userId:user.id,role:user.role,email:user.email,exp:now()+30*86400000})});
  }
  if(action==='logout')return ok();
  if(!u)return fail('Silakan login terlebih dahulu.',401);
  const user=d.users.find(x=>x.id===u.userId);if(!user)return fail('Akun tidak ditemukan.',401);
  if(action==='order'){
   if(user.role!=='user')return fail('Admin tidak dapat membuat pesanan.');
   const p=d.products.find(x=>x.id===input.productId);if(!p)return fail('Produk tidak ditemukan.');if(Number(p.stock)<=0)return fail('Stok produk habis.');
   const pay=d.payments.find(x=>x.id===input.paymentId);if(!pay)return fail('Metode pembayaran tidak ditemukan.');
   const proof=String(input.proofData||'');if(!proof)return fail('Bukti transfer wajib diupload.');
   let price=Number(p.price)||0, discount=0, voucherCode=String(input.voucherCode||'').trim().toUpperCase();
   if(voucherCode){const v=d.vouchers.find(x=>x.code===voucherCode&&x.active!==false&&(!x.expires||x.expires>=now()));if(!v)return fail('Voucher tidak valid atau sudah berakhir.');if(Number(v.minPurchase||0)>price)return fail(`Minimal pembelian voucher ${v.minPurchase}.`);discount=v.type==='percent'?Math.floor(price*Number(v.value||0)/100):Math.min(price,Number(v.value||0));}
   const flash=d.flashSales.find(f=>f.productId===p.id&&f.active!==false&&(!f.ends||f.ends>now()));if(flash)price=Math.max(0,Number(flash.price)||price);
   const total=Math.max(0,price-discount);
   const o={id:id(),userId:user.id,productId:p.id,price:Number(p.price)||0,finalPrice:total,discount,voucherCode,wa:String(input.wa||''),driveEmail:String(input.driveEmail||''),paymentId:pay.id,paymentName:pay.name,paymentNumber:pay.number,proofUrl:proof,status:'Verifikasi',created:now(),updated:now()};
   if(!o.wa||!/^\S+@\S+\.\S+$/.test(o.driveEmail))return fail('Nomor WhatsApp dan Email Drive wajib diisi.');
   p.stock=Number(p.stock)-1;d.orders.unshift(o);await saveDB(d);return ok({order:o});
  }
  if(action==='addProduct'||action==='deleteProduct'||action==='addPayment'||action==='deletePayment'||action==='changeStatus'||action==='addVoucher'||action==='deleteVoucher'||action==='addBanner'||action==='deleteBanner'||action==='addFlashSale'||action==='deleteFlashSale'||action==='updateInfo'||action==='updateRevision'){
   if(user.role!=='admin')return fail('Khusus admin.',403);
  }
  if(action==='addProduct'){if(!input.name||!input.photoData)return fail('Nama dan foto produk wajib diisi.');const p={id:id(),name:String(input.name),price:Number(input.price)||0,stock:Number(input.stock)||0,category:String(input.category||'Lainnya'),type:String(input.type||'Lainnya'),photoUrl:String(input.photoData),created:now()};d.products.unshift(p);await saveDB(d);return ok({product:p})}
  if(action==='deleteProduct'){d.products=d.products.filter(x=>x.id!==input.id);await saveDB(d);return ok()}
  if(action==='addPayment'){if(!input.name||!input.number||!input.photoData)return fail('Nama, nomor, dan QR wajib diisi.');const p={id:id(),name:String(input.name),number:String(input.number),photoUrl:String(input.photoData),created:now()};d.payments.unshift(p);await saveDB(d);return ok({payment:p})}
  if(action==='deletePayment'){d.payments=d.payments.filter(x=>x.id!==input.id);await saveDB(d);return ok()}
  if(action==='changeStatus'){const o=d.orders.find(x=>x.id===input.id);if(!o)return fail('Pesanan tidak ditemukan.');o.status=String(input.status);o.updated=now();await saveDB(d);return ok({order:o})}
  if(action==='addVoucher'){const code=String(input.code||'').trim().toUpperCase();if(!code||Number(input.value)<=0)return fail('Kode dan nilai voucher wajib diisi.');if(d.vouchers.some(v=>v.code===code))return fail('Kode voucher sudah ada.');const v={id:id(),code,type:input.type==='percent'?'percent':'fixed',value:Number(input.value),minPurchase:Number(input.minPurchase)||0,expires:input.expires?new Date(input.expires).getTime():null,active:true,created:now()};d.vouchers.unshift(v);await saveDB(d);return ok({voucher:v})}
  if(action==='deleteVoucher'){d.vouchers=d.vouchers.filter(x=>x.id!==input.id);await saveDB(d);return ok()}
  if(action==='addBanner'){if(!input.title)return fail('Judul banner wajib diisi.');const b={id:id(),title:String(input.title),text:String(input.text||''),imageUrl:String(input.imageData||''),active:true,created:now()};d.banners.unshift(b);await saveDB(d);return ok({banner:b})}
  if(action==='deleteBanner'){d.banners=d.banners.filter(x=>x.id!==input.id);await saveDB(d);return ok()}
  if(action==='addFlashSale'){const p=d.products.find(x=>x.id===input.productId);if(!p)return fail('Produk tidak ditemukan.');const f={id:id(),productId:p.id,price:Number(input.price)||0,ends:input.ends?new Date(input.ends).getTime():null,active:true,created:now()};d.flashSales=d.flashSales.filter(x=>x.productId!==p.id);d.flashSales.unshift(f);await saveDB(d);return ok({flashSale:f})}
  if(action==='deleteFlashSale'){d.flashSales=d.flashSales.filter(x=>x.id!==input.id);await saveDB(d);return ok()}
  if(action==='updateInfo'){d.info={name:String(input.name||'HAMZZ Store'),description:String(input.description||''),contact:String(input.contact||'')};await saveDB(d);return ok({info:d.info})}
  if(action==='sendChat'){const order=input.orderId?d.orders.find(x=>x.id===input.orderId):null;if(input.orderId&&!order)return fail('Pesanan tidak ditemukan.');if(user.role==='user'&&order&&order.userId!==user.id)return fail('Akses ditolak.',403);const targetUserId=order?order.userId:(user.role==='user'?user.id:String(input.userId||''));if(user.role==='admin'&&!targetUserId)return fail('Pilih pembeli untuk chat.');const c={id:id(),orderId:order?.id||null,userId:targetUserId,senderRole:user.role,message:String(input.message||'').trim(),created:now()};if(!c.message)return fail('Pesan tidak boleh kosong.');d.chats.push(c);await saveDB(d);return ok({chat:c})}
  if(action==='requestRevision'){const o=d.orders.find(x=>x.id===input.orderId);if(!o||o.userId!==user.id)return fail('Pesanan tidak ditemukan.',404);const r={id:id(),orderId:o.id,userId:user.id,reason:String(input.reason||'').trim(),status:'Menunggu',note:'',created:now(),updated:now()};if(!r.reason)return fail('Alasan revisi wajib diisi.');d.revisions.unshift(r);await saveDB(d);return ok({revision:r})}
  if(action==='updateRevision'){const r=d.revisions.find(x=>x.id===input.id);if(!r)return fail('Revisi tidak ditemukan.');r.status=String(input.status||'Diproses');r.note=String(input.note||'');r.updated=now();await saveDB(d);return ok({revision:r})}
  if(action==='rating'){const o=d.orders.find(x=>x.id===input.orderId);if(!o||o.userId!==user.id)return fail('Pesanan tidak ditemukan.',404);if(o.status!=='Selesai')return fail('Rating tersedia setelah pesanan selesai.');const stars=Math.max(1,Math.min(5,Number(input.stars)||0));const existing=d.ratings.find(x=>x.orderId===o.id);const r=existing||{id:id(),orderId:o.id,userId:user.id,created:now()};r.stars=stars;r.comment=String(input.comment||'');r.updated=now();if(!existing)d.ratings.unshift(r);await saveDB(d);return ok({rating:r})}
  return fail('Aksi tidak dikenal.');
 }catch(e){console.error(e);return fail('Server HAMZZ mengalami kesalahan.',500)}
}
