import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const source=fs.readFileSync(new URL('../notifications.js',import.meta.url),'utf8');
const ctx=vm.createContext({});
vm.runInContext(source.slice(source.indexOf('function isVisibleCouponCampaign('),source.indexOf('let campaignExpiryTimer')),ctx);
const now=Date.parse('2026-09-07T12:00:00Z');

test('new product notices exclude old dates and remember read status',()=>{
  const list={innerHTML:''}; let badge=0;
  const context=vm.createContext({document:{querySelector:()=>list},newProducts:[
    {id:'new',name:'New game',price:1299,image:'https://example.com/game.jpg',createdAt:new Date().toISOString()},
    {id:'old',name:'Old game',createdAt:'2020-01-01'},
    {id:'invalid',createdAt:'bad'}],campaignExpiryTimer:null,clearTimeout:()=>{},
    isVisibleCouponCampaign:()=>true,readDeliveryNotificationIds:()=>new Set(['product:new']),
    setBadge:n=>badge=n,escapeHtml:String,formatDate:String,createIconSet:()=>{}});
  vm.runInContext(source.slice(source.indexOf('function renderNotifications('),source.indexOf('let notificationRequest')),context);
  context.renderNotifications([],[],null);
  assert(list.innerHTML.includes('สินค้าใหม่เข้าร้าน'));
  assert(list.innerHTML.includes('product.html?id=new'));
  assert(list.innerHTML.includes('src="https://example.com/game.jpg"'));
  assert(list.innerHTML.includes('loading="lazy"'));
  assert(list.innerHTML.includes('฿1,299'));
  assert(!list.innerHTML.includes('product.html?id=old'));
  assert(!list.innerHTML.includes('product.html?id=invalid'));
  assert.equal(badge,0);
});
test('expired dates and expiry boundary are hidden even without server expired flag',()=>{
  for(const time of ['2026-09-06T12:00:00Z','2026-09-07T12:00:00Z']) assert.equal(ctx.isVisibleCouponCampaign({expiresAt:time},now),false);
  assert.equal(ctx.isVisibleCouponCampaign({expires_at:'2026-09-08T12:00:00Z'},now),true);
  assert.equal(ctx.isVisibleCouponCampaign({expired:true},now),false);
});
test('products, delivered orders and coupon announcements interleave by actual event time',()=>{
 const base=Date.now(),date=seconds=>new Date(base-seconds*1000).toISOString(),list={innerHTML:''};
 const context=vm.createContext({document:{querySelector:()=>list},newProducts:[{id:'product',name:'Game',createdAt:date(20)}],
  campaignExpiryTimer:null,clearTimeout:()=>{},setTimeout:()=>0,isVisibleCouponCampaign:()=>true,readDeliveryNotificationIds:()=>new Set(),
  setBadge:()=>{},escapeHtml:String,formatDate:String,createIconSet:()=>{},couponValueLabel:()=>'',couponPeriodLabel:()=>'',
  orderProductImage:()=>'',orderProductText:()=>'',orderLabel:()=>''});
 vm.runInContext(source.slice(source.indexOf('function renderNotifications('),source.indexOf('let notificationRequest')),context);
 const orders=[{id:'order',status:'delivered',deliveredAt:date(10),updatedAt:date(0)}];
 const coupons=[{id:'coupon-new',createdAt:date(5),expiresAt:'2099-12-31'}, {id:'coupon-old',createdAt:date(30),expiresAt:'2099-01-01'},{id:'missing-date'}];
 context.renderNotifications(orders,coupons,{id:'u'});
 const markup=list.innerHTML,sequence=['data-coupon-notification="coupon-new"','data-delivery-notification="order"','data-product-notification="product"','data-coupon-notification="coupon-old"','data-coupon-notification="missing-date"'];
 const positions=sequence.map(value=>markup.indexOf(value));assert(positions.every(pos=>pos>=0));assert.deepEqual([...positions].sort((a,b)=>a-b),positions);
 context.renderNotifications(orders,coupons,{id:'u'});assert.equal(list.innerHTML,markup);
});
test('disabled campaigns are hidden regardless of claim status',()=>{
  for(const field of ['isActive','is_active','active','enabled']) assert.equal(ctx.isVisibleCouponCampaign({[field]:false,claimed:true},now),false);
  for(const status of ['inactive','disabled','expired','closed','revoked']) assert.equal(ctx.isVisibleCouponCampaign({status},now),false);
});
test('valid active and claimed campaigns remain visible, malformed expiry is hidden',()=>{
  assert.equal(ctx.isVisibleCouponCampaign({isActive:true,claimed:true},now),true);
  assert.equal(ctx.isVisibleCouponCampaign({status:'available'},now),true);
  assert.equal(ctx.isVisibleCouponCampaign({expiresAt:'invalid'},now),false);
});
test('filter precedes badge count and timeout rerenders expiry without a page refresh',()=>{
  assert(source.indexOf('.filter(coupon => isVisibleCouponCampaign(coupon))')<source.indexOf('const unreadCoupons'));
  assert(source.includes('setTimeout(() => renderNotifications(orders, campaigns, user), delay)'));
  assert(source.includes("event.target.closest('.notification-button')"));
  assert(source.includes('if (request !== notificationRequest) return;'));
});
