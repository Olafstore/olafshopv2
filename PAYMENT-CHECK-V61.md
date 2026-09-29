# ผลตรวจโค้ดชำระเงิน 2026-09-29

ตรวจเฉพาะโค้ดในเครื่อง ไม่มี production logs จึงยังระบุสาเหตุของออเดอร์จริงไม่ได้ ไม่ได้ส่งสลิปหรือตรวจ API จริง และไม่ได้แก้ logic ชำระเงิน

- api/verify-slip.js ตั้ง timeout RDCW 18 วินาที; timeout/เครือข่ายล้มเหลวเป็น RDCW_TEMPORARY_ERROR พร้อม retriable=true
- mapRdcwError จัด code 1004–1006 เป็น RDCW_INVALID_SLIP และ error ที่ไม่รู้จักซึ่ง HTTP ต่ำกว่า 500 ก็เข้า fallback นี้ เช่น HTTP 429 ที่ไม่มี code ที่รู้จักอาจถูกจัดเป็น invalid แทน temporary เป็นความเสี่ยงจากโค้ด ยังไม่ยืนยันว่าเกิดจริง และยังไม่แก้
- ผู้รับไม่ตรงเป็น RECEIVER_MISMATCH; provider ไม่ส่งข้อมูลผู้รับเป็น RECEIVER_NOT_RETURNED
- เวลาโอนก่อนสร้างออเดอร์เกิน 15 นาทีหรืออนาคตเกิน 10 นาทีไม่ผ่าน PAYMENT_TIME_MISMATCH
- QR อ่านไม่ได้, ช่องทางผิด, ยอดไม่ตรง และ transaction ซ้ำ เป็นเหตุอื่นที่ตรวจอยู่
- provider error ที่ retriable ไม่เป็น true จะพยายาม reset สลิปและลบไฟล์เมื่อ reset สำเร็จ จึงควรตรวจ error code และ provider response ก่อนสรุปสาเหตุ

ต้องใช้เลขออเดอร์ที่ล้มเหลว 1–3 รายการ เวลาเกิดเหตุ และ error code / HTTP status / provider response จากประวัติ payment_verifications หรือ server log โดยปิดข้อมูลส่วนบุคคล ไม่ต้องส่ง secret หรือ API key

เปลี่ยนเฉพาะ product.html (ไอคอน shield-check และลิงก์ CSS) และ checkout-visual-fix.css (ตัวหมุนเดียวกับข้อความกึ่งกลางกรอบ) ไม่มีการแก้ API หรือ JavaScript การชำระเงิน
