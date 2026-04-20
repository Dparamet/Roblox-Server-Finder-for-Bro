# Roblox Low Ping Server Finder

Userscript สำหรับช่วยค้นหาเซิร์ฟเวอร์ Roblox ที่มี **ping ต่ำกว่าเกณฑ์** ที่คุณกำหนดเอง พร้อม UI ที่อ่านง่ายและใช้งานเร็ว

> เหมาะสำหรับคนที่อยากลดแลค และเข้าเซิร์ฟเวอร์ที่เล่นลื่นขึ้น

---

## ✨ Features

- ค้นหาเซิร์ฟเวอร์แบบหลายหน้า (สูงสุด 20 หน้า)
- ตั้งค่า `Max Ping` ได้เอง
- ตั้งค่า `Minimum Free Slots` (จำนวนที่ว่างขั้นต่ำ)
- แยกค้นหาตาม Region ได้ เช่น
  - Asia / Singapore
  - Asia / Japan
  - Europe / Denmark
  - Europe / Italy
  - และแบบกลุ่ม Asia / Europe
- จัดเรียงผลลัพธ์ได้ 3 แบบ
  - Lowest Ping
  - Least Players
  - Balanced (สมดุลระหว่าง ping และความหนาแน่นผู้เล่น)
- ปุ่ม `FORCE REFRESH` เพื่อบังคับดึงข้อมูลใหม่
- ปุ่ม `CANCEL` เพื่อยกเลิกการสแกนระหว่างทำงาน
- แสดงสถิติสำคัญ
  - จำนวนเซิร์ฟเวอร์ที่สแกน
  - จำนวนที่ผ่านเงื่อนไข
  - Best ping
  - Average ping
- ระบบแคชผลลัพธ์ชั่วคราว (45 วินาที) ลดการยิง request ซ้ำ
- ระบบ retry request อัตโนมัติเมื่อเครือข่ายแกว่ง
- ตัดข้อมูลซ้ำของ server (dedupe) เพื่อผลลัพธ์ที่นิ่งขึ้น
- ปุ่ม `JOIN` เข้าเซิร์ฟเวอร์ที่เลือกทันที

---

## 🧱 ระบบพื้นฐานที่มีในโปรเจกต์

- **Settings Persistence**: จำค่าที่ตั้งไว้ด้วย `localStorage`
- **Error Handling**: แจ้งสถานะเมื่อ request fail / timeout
- **State Management**: ป้องกันสแกนชนกันด้วย token และสถานะ scanning
- **Stable Networking**: retry + ตรวจ HTTP status + timeout
- **Progress Feedback**: แถบ progress + status line แบบเรียลไทม์
- **Responsive UI**: ปรับ layout ให้พอใช้งานได้บนหน้าจอเล็ก

---

## 📦 วิธีใช้งาน

1. ติดตั้งส่วนขยายสำหรับ userscript เช่น:
   - Tampermonkey
   - Violentmonkey
2. สร้างสคริปต์ใหม่ แล้วคัดลอกโค้ดจาก `script.js` ไปวาง
3. เข้าเกม Roblox ที่ URL รูปแบบ `https://www.roblox.com/games/...`
4. ใช้แผง `Roblox Low Ping Server Finder`:
  - ตั้งค่า Max Ping / Scan Pages / Free Slots / Region
   - กด `SCAN NOW`
   - เลือกเซิร์ฟเวอร์แล้วกด `JOIN`

---

## ⚙️ ค่าแนะนำเริ่มต้น

- `Max Ping`: 80–120 ms
- `Scan Pages`: 6–10
- `Minimum Free Slots`: 1–3
- `Sort`: Lowest Ping

> ถ้าเกมคนเยอะมาก แนะนำเพิ่ม Scan Pages เพื่อเพิ่มโอกาสเจอเซิร์ฟเวอร์ที่ดี

---

## 🛠️ โครงสร้างไฟล์

- `script.js` — userscript หลัก
- `README.md` — คู่มือใช้งานและภาพรวมโปรเจกต์

---

## ⚠️ หมายเหตุ

- ค่า `ping` มาจากข้อมูลที่ Roblox API ส่งมาในเวลานั้น ๆ และอาจเปลี่ยนได้
- Region อาศัย metadata ที่ endpoint ส่งมาในแต่ละเกม/ช่วงเวลา (บางรายการอาจเป็น `Unknown`)
- บางช่วง Roblox อาจจำกัดหรือเปลี่ยนพฤติกรรม API ทำให้ผลลัพธ์ต่างจากเดิม
- สคริปต์นี้ช่วย “คัดเลือก” เซิร์ฟเวอร์ที่น่าจะดีขึ้น แต่ไม่การันตี latency จริง 100%

---

## 📄 License

MIT (แนะนำให้เพิ่มไฟล์ LICENSE หากต้องการใช้งานสาธารณะเต็มรูปแบบ)
