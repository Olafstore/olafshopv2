# 499K server authentication — v5

## ติดตั้งบนชุด v4 เดิม

แตก `host-upload-supplier-auth-v5.zip` แล้วอัปโหลดไฟล์ด้านในทับตามโครงสร้างเดิมใน GitHub จากนั้น Deploy บน Vercel Production

ไฟล์ runtime ที่แก้:
- lib/suppliers/499k/client.js
- lib/suppliers/499k/fulfillment-client.js
- lib/suppliers/shop-service.js
- lib/suppliers/shop-handler.js
- supplier-store.js
- supplier-store.html
- product.html
- profile.html

ไม่ต้องรัน SQL ใหม่ ไม่ต้องนำเข้าแคตตาล็อกใหม่ ไม่มีการแก้สินค้าเดิมหรือเพิ่ม Vercel Function (ยัง 12 Functions)
อย่าอัปโหลด .env.local หรือ API Key

## Environment

ใช้ Live Key / Base URL / Supabase / SUPPLIER_DELIVERY_KEY_V1 เดิม
ค่าเริ่มต้นของ header เป็น x-api-key ตามคู่มือ 499K ไม่ต้องเพิ่มตัวแปรก็ได้
ถ้ามี SUPPLIER_499K_AUTH_MODE อยู่แล้ว ให้ตั้งเป็น x-api-key เพื่อทดสอบชุดนี้
โหมด bearer ยังเลือกได้ผ่าน Server Environment เท่านั้น ไม่มีการสลับ header หรือ retry POST อัตโนมัติ
SUPPLIER_499K_LIVE_PURCHASE_ENABLED=true จำเป็นสำหรับขายจริง แต่ไม่ใช่การแก้ 403

## ตรวจหลัง Deploy ก่อนรับเงินจริง

1. Login Admin แล้วเปิด supplier-store.html กด Ctrl+F5
2. กด “ตรวจบัญชี / แคตตาล็อก / สินค้า (ไม่สั่งซื้อ)”
3. ต้องเห็น revision=supplier-auth-v5, authMode=x-api-key, configuration/account/catalog/productSample1/productSample2 ok:true (ถ้ามีสินค้าในสต็อกให้สุ่มตรวจครบสองรายการ)
4. การตรวจนี้เป็น GET เท่านั้น ไม่หักเงิน ไม่ขอ Steam Guard และไม่เปิดเผยยอดเงิน/คีย์/ข้อมูลบัญชี
5. ตรวจหน้ารายละเอียดสินค้าและการขอราคาสำเร็จ การตรวจตัวอย่างไม่ใช่การยืนยันครบทุกเกม
6. หากยังเป็น 403 HTML ห้ามข้ามการตรวจราคาเพื่อรับเงิน ต้องให้ 499K ตรวจคำขอจาก Vercel การทดสอบ local ไม่ยืนยันเครือข่าย Production

## เส้นทางขายที่คงไว้

ลูกค้าชำระเงิน → server ยืนยันสลิปและหลักฐานชำระ → claim ออเดอร์แบบล็อก → ตรวจราคา/สต็อก → POST /orders ด้วย product_id/type=offline/ref คงที่ → 499K หักยอดบัญชีร้านตาม price จริง → เก็บบัญชีแบบเข้ารหัส → เจ้าของออเดอร์รับบัญชี

ไม่ส่ง price override (เป็นสิทธิ์ master key) ราคาขายลูกค้ายังคงต้นทุน × 1.5 ตามระบบเดิม
Steam Guard ใช้ POST /orders/{order_no}/code: เปิดรอบพร้อม reason 5–500 ตัวอักษร, refresh ภายใน 60 วินาทีไม่ส่ง reason, สูงสุด 3 รอบ และเปิดดูได้เฉพาะเจ้าของออเดอร์ที่ชำระ/ส่งมอบแล้ว
หากผล POST ไม่แน่นอน ห้ามสร้าง ref ใหม่/ซื้อซ้ำ ระบบคงสถานะให้ตรวจสอบและกระทบยอดจากประวัติ

## หลักฐานทดสอบ

23 กันยายน 2026: x-api-key จาก local ผ่าน GET /me, catalog 275 รายการ และรายละเอียดตัวอย่าง 4090250 / 3764200001
Supplier tests 129 ข้อผ่าน รวมซื้อ/ส่งมอบ/Steam Guard บนข้อมูลจำลอง ไม่มีคำสั่งซื้อจริง ไม่มีการหักเงิน ไม่มีการเขียนฐานข้อมูลจริงระหว่างงานนี้
ยังไม่ได้ Deploy หรือยืนยันการซื้อและส่งมอบจริงบน Vercel
