# Summary - Roblox Low Ping Server Finder

อัปเดตล่าสุด: 2026-04-20

## Current Version

- **script.js**: `v6.1`
- ชื่อสคริปต์: `Roblox Low Ping Server Finder (Modern UI)`

## Version History (สรุปสิ่งที่แก้)

### v6.0
- รีแฟกเตอร์ UI เป็นแดชบอร์ดใหม่
- เพิ่มการตั้งค่า:
  - Max Ping
  - Scan Pages
  - Minimum Free Slots
  - Sort (ping / players / balanced)
- เพิ่มระบบพื้นฐาน:
  - Scan progress + status
  - Cancel scan
  - Force refresh
  - Cache ผลลัพธ์ชั่วคราว
  - Error handling และ timeout
- ปรับผลลัพธ์ให้เข้าเซิร์ฟเวอร์ได้ทันทีด้วยปุ่ม Join

### v6.1
- เพิ่มระบบ **Region Filter**
  - all / asia / asia-singapore / asia-japan
  - europe / europe-denmark / europe-italy
  - unknown
- เพิ่มการแสดงผลแบบ **Card/Grid UI** ให้คล้ายแนว extension server browser
- เพิ่ม **Region Chips Selector** (เลือก region แบบเร็ว)
- เพิ่มการแสดง **Region code** บนการ์ด (เช่น SG, JP, DK, IT)
- เพิ่ม badge `⚡ Fast` สำหรับ ping ต่ำ
- เพิ่มปุ่ม `Copy ID` บนการ์ด
- เพิ่มความเสถียร network:
  - Retry request อัตโนมัติ
  - ตรวจ HTTP status
- เพิ่มความแม่นยำผลลัพธ์:
  - Deduplicate server id
  - กรอง ping ผิดปกติ
- ปรับ performance:
  - ลดภาระ event binding (delegation)
  - จำกัดจำนวนรายการ render ต่อรอบ

## Notes

- การระบุ region ขึ้นกับข้อมูล metadata ที่ Roblox API ส่งมาในแต่ละเกม/ช่วงเวลา
- ถ้า API ไม่ส่งข้อมูล region บางรายการจะเป็น `Unknown`

## Files Updated In This Project

- `script.js` — userscript หลัก (v6.1)
- `README.md` — คู่มือใช้งาน
- `summary.md` — สรุปเวอร์ชันและการเปลี่ยนแปลง
