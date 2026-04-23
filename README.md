# Roblox Low Ping & Capacity Finder v10.0

Userscript สำหรับสแกน Roblox public servers แล้วคัดเซิร์ฟเวอร์ตาม ping, จำนวนผู้เล่น, และจำนวนช่องว่างที่เหลือ พร้อม UI แบบแดชบอร์ดสีส้ม/ขาวที่อ่านง่าย

![Preview of the Roblox Low Ping Finder UI](preview.png)

> เหมาะสำหรับคนที่อยากลดแลค, หาเซิร์ฟเล็ก, หาเซิร์ฟที่มี free slots พอ, และกดเข้าเกมได้ทันที

---

## ✨ Features

- สแกน public server จากหน้าเกม Roblox โดยตรง
- กรองเซิร์ฟเวอร์ตามโหมดได้ 3 แบบ
  - All Servers
  - Small servers 1-3 players
  - Minimum free slots ตามจำนวนที่กำหนด
- จัดเรียงผลลัพธ์ได้ 2 แบบ
  - Ping ขึ้นก่อน
  - Players ลงก่อน
- แสดงข้อมูลสำคัญบนการ์ดแต่ละ server
  - ping
  - จำนวนผู้เล่น / ช่องว่าง
  - FPS
  - Server ID
- มี progress bar และ status line ระหว่างสแกน
- มีระบบ retry เมื่อเจอ network error, timeout, 401, 403 หรือ 429
- มี rate limit ป้องกันการกดสแกนถี่เกินไป
- dedupe server ID อัตโนมัติ
- ปุ่ม `JOIN SERVER` เข้าเกมได้ทันที

---

## 🧱 สิ่งที่สคริปต์ทำงานอยู่ตอนนี้

- Inject UI ลงในหน้าเกม Roblox อัตโนมัติ
- อ่านข้อมูล public server จาก endpoint ของ Roblox
- กรองผลลัพธ์ตาม capacity mode ที่เลือก
- แสดงผลแบบ card/grid พร้อม pagination 50 server ต่อหน้า
- แสดง server ID, ping, players, free slots และปุ่ม join ในแต่ละ card
- ใช้ cache สั้น ๆ และยกเลิก request เก่าเพื่อลดการยิง API ซ้ำ

---

## 📦 วิธีติดตั้ง

1. ติดตั้งส่วนขยายสำหรับ userscript เช่น Tampermonkey หรือ Violentmonkey
2. สร้างสคริปต์ใหม่ใน extension ที่ใช้
3. คัดลอกโค้ดจาก [script.js](script.js) ไปวาง
4. เปิดหน้าเกม Roblox ที่มีรูปแบบ URL `https://www.roblox.com/games/...`
5. รอให้แผง `SERVER FINDER PRO` ถูกแทรกเข้าไปในหน้า แล้วกด `SCAN`

---

## 🎮 วิธีใช้งาน

1. เลือก `Filter` ระหว่าง `All Servers`, `Small`, หรือ `Min Free Slots`
2. ถ้าเลือก `Min Free Slots` ให้ใส่จำนวน slot ที่ต้องการ
3. เลือกการ sort ระหว่าง `Ping` หรือ `Players`
4. กด `SCAN`
5. ใช้ pagination เพื่อเลื่อนไปหน้าถัดไปได้ทีละ 50 server
6. กด `JOIN SERVER` ที่ card ของ server ที่ต้องการ

---

## ⚙️ หมายเหตุการใช้งาน

- ค่า ping ที่เห็นมาจากข้อมูลที่ Roblox ส่งมาในขณะนั้น ไม่ใช่ค่าที่วัดจากเครื่องคุณแบบ real-time เสมอไป
- โหมด `Small` จะเน้น server ที่ผู้เล่นน้อย เพื่อเข้าไปได้ง่ายกว่า
- โหมด `Min Free Slots` จะคัด server ที่มีช่องว่างอย่างน้อยตามค่าที่ตั้งไว้
- ถ้า Roblox จำกัด API ชั่วคราว ผลลัพธ์อาจไม่สมบูรณ์หรือสแกนช้าลง
- ระบบ cache จะช่วยให้การกดสแกนซ้ำในช่วงสั้น ๆ ตอบสนองเร็วขึ้น

---

## 🛠️ โครงสร้างไฟล์

- [script.js](script.js) — userscript หลัก
- [README.md](README.md) — คู่มือใช้งานและภาพรวมโปรเจกต์
- [preview.png](preview.png) — ภาพตัวอย่าง UI สำหรับ README

---

## 📄 License

MIT
