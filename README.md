# Roblox Low Ping Finder v9.0

Userscript สำหรับสแกน Roblox public servers แล้วคัดเซิร์ฟเวอร์ที่มี ping ต่ำและเล่นลื่นกว่าเดิม พร้อม UI แบบแดชบอร์ดสีส้ม/ขาวที่อ่านง่าย

![Preview of the Roblox Low Ping Finder UI](preview.png)

> เหมาะสำหรับคนที่อยากลดแลค, เปรียบเทียบ ping อย่างเร็ว และกดเข้าเซิร์ฟเวอร์ได้ทันที

---

## ✨ Features

- สแกน public server จากหน้าเกม Roblox โดยตรง
- กรอง region ได้จาก dropdown
  - All Regions
  - Asia: Singapore, Japan, South Korea, Australia
  - Americas: US East, US Central, US West, Brazil
  - Europe: Germany, UK, France
- จัดเรียงผลลัพธ์ได้ 2 แบบ
  - Ping ขึ้นก่อน
  - Players ลงก่อน
- แสดงข้อมูลสำคัญบนการ์ดแต่ละ server
  - ping
  - label คุณภาพ ping
  - จำนวนผู้เล่น / ช่องว่าง
  - FPS
  - สถานะ Fresh / Active / Full
- มี progress bar และ status line ระหว่างสแกน
- มีระบบ retry เมื่อเจอ network error, timeout, 401, 403 หรือ 429
- มี rate limit ป้องกันการกดสแกนถี่เกินไป
- dedupe server ID อัตโนมัติ
- ปุ่ม `JOIN SERVER` เข้าเกมได้ทันที

---

## 🧱 สิ่งที่สคริปต์ทำงานอยู่ตอนนี้

- Inject UI ลงในหน้าเกม Roblox อัตโนมัติ
- อ่านข้อมูล public server จาก endpoint ของ Roblox
- ตรวจ region จาก metadata ที่ endpoint ส่งมา
- เลือกผลลัพธ์ที่ ping ไม่เกินเกณฑ์ในโค้ด
- แสดงผลแบบ card/grid ให้ดูเร็วและเปรียบเทียบง่าย

---

## 📦 วิธีติดตั้ง

1. ติดตั้งส่วนขยายสำหรับ userscript เช่น Tampermonkey หรือ Violentmonkey
2. สร้างสคริปต์ใหม่ใน extension ที่ใช้
3. คัดลอกโค้ดจาก [script.js](script.js) ไปวาง
4. เปิดหน้าเกม Roblox ที่มีรูปแบบ URL `https://www.roblox.com/games/...`
5. รอให้แผง `LOW PING FINDER` ถูกแทรกเข้าไปในหน้า แล้วกด `SCAN`

---

## 🎮 วิธีใช้งาน

1. เลือก region ที่ต้องการจาก dropdown
2. เลือกการ sort ระหว่าง `Ping` หรือ `Players`
3. กด `SCAN`
4. ดูการ์ด server ที่ได้ผลลัพธ์แล้วกด `JOIN SERVER` ตัวที่ต้องการ

---

## ⚙️ หมายเหตุการใช้งาน

- ค่า ping ที่เห็นมาจากข้อมูลที่ Roblox ส่งมาในขณะนั้น ไม่ใช่ค่าที่วัดจากเครื่องคุณแบบ real-time เสมอไป
- บาง server อาจแสดง region เป็น unknown ถ้า metadata ไม่ครบ
- ถ้า Roblox จำกัด API ชั่วคราว ผลลัพธ์อาจไม่สมบูรณ์หรือสแกนช้าลง

---

## 🛠️ โครงสร้างไฟล์

- [script.js](script.js) — userscript หลัก
- [README.md](README.md) — คู่มือใช้งานและภาพรวมโปรเจกต์
- [preview.png](preview.png) — ภาพตัวอย่าง UI สำหรับ README

---

## 📄 License

MIT
