/* =============================================================
   AMS — Quick Reset Script (สำหรับทดสอบ)
   Database: AttendanceMS (SQL Server)
   =============================================================

   ⚠️ ใช้สำหรับ DEV/UAT เท่านั้น — อย่ารันบน PRODUCTION

   สิ่งที่จะลบ:
     ✗ ใบลาทั้งหมด (LeaveRequest + LeaveApproval)
     ✗ OT ทั้งหมด (OTRequest + OTRequestEmployee + OTApproval
                     + OTCancellation + OTMemo)
     ✗ EmailLog + AuditLog (เฉพาะของ Leave/OT)
     ✗ ยอดวันลาที่ใช้ไป (LeaveBalance.usedDays → 0)

   สิ่งที่จะเก็บไว้:
     ✓ Employee / User / Department / LeaveType / VacationTier
     ✓ BusRoute / Holiday / SystemSetting
     ✓ LeaveBalance rows (แค่ reset usedDays)

   วิธีใช้:
     1) เปิด SSMS / Azure Data Studio / VS Code with SQL extension
     2) Connect ไปที่ CCTH-EX\SQL2019 → AttendanceMS
     3) เลือก script ทั้งหมด → กด Execute (F5)
     4) ดู PRINT output ที่ออกมา
   ============================================================= */

USE AttendanceMS;
GO

-- ─── Before counts (ดูสถานะก่อนลบ) ──────────────────────────────
PRINT '--- BEFORE ---';
SELECT 'LeaveRequest'      AS TableName, COUNT(*) AS Rows FROM LeaveRequest
UNION ALL SELECT 'LeaveApproval',         COUNT(*) FROM LeaveApproval
UNION ALL SELECT 'OTRequest',             COUNT(*) FROM OTRequest
UNION ALL SELECT 'OTRequestEmployee',     COUNT(*) FROM OTRequestEmployee
UNION ALL SELECT 'OTApproval',            COUNT(*) FROM OTApproval
UNION ALL SELECT 'OTCancellation',        COUNT(*) FROM OTCancellation
UNION ALL SELECT 'OTMemo',                COUNT(*) FROM OTMemo
UNION ALL SELECT 'EmailLog',              COUNT(*) FROM EmailLog
UNION ALL SELECT 'AuditLog',              COUNT(*) FROM AuditLog
UNION ALL SELECT 'LeaveBalance (preserved)', COUNT(*) FROM LeaveBalance;
GO

-- ─── ทำการลบใน transaction (rollback ได้ถ้าพลาด) ───────────────
BEGIN TRANSACTION ResetAll;
BEGIN TRY

    -- 1) ลบ children ของ Leave ก่อน (FK constraints)
    DELETE FROM LeaveApproval;
    DELETE FROM LeaveRequest;

    -- 2) Reset ยอดวันลาที่ใช้ไป (เก็บ totalDays + carriedOver ไว้)
    UPDATE LeaveBalance
       SET usedDays      = 0,
           remainingDays = totalDays + carriedOver;

    -- 3) ลบ children ของ OT ก่อน
    DELETE FROM OTMemo;
    DELETE FROM OTCancellation;
    DELETE FROM OTApproval;
    DELETE FROM OTRequestEmployee;

    -- 4) ลบ OT header
    DELETE FROM OTRequest;

    -- 5) เคลียร์ logs ที่เกี่ยวข้อง
    DELETE FROM EmailLog;
    DELETE FROM AuditLog
       WHERE action IN (
           'CREATE_LEAVE','APPROVE_LEAVE','REJECT_LEAVE','UPDATE_LEAVE','CANCEL_LEAVE',
           'CREATE_OT','APPROVE_OT','REJECT_OT','UPDATE_OT','CANCEL_OT',
           'APPROVE_OT_CANCEL','REJECT_OT_CANCEL','ACK_OT_MEMO','REJECT_OT_MEMO'
       );

    COMMIT TRANSACTION ResetAll;
    PRINT '';
    PRINT '✅ Reset เสร็จเรียบร้อย — Master data + Users + Departments + LeaveType + VacationTier ยังครบ';
    PRINT '   สามารถ login ทดสอบสร้างใบลา/OT ใหม่ได้เลย';

END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION ResetAll;
    PRINT '';
    PRINT '❌ Error — rollback แล้ว ไม่มีอะไรเปลี่ยนแปลง';
    PRINT ERROR_MESSAGE();
END CATCH
GO

-- ─── After counts (ตรวจสอบหลังลบ — ควรเป็น 0 หมด ยกเว้น LeaveBalance) ──
PRINT '';
PRINT '--- AFTER ---';
SELECT 'LeaveRequest'      AS TableName, COUNT(*) AS Rows FROM LeaveRequest
UNION ALL SELECT 'LeaveApproval',         COUNT(*) FROM LeaveApproval
UNION ALL SELECT 'OTRequest',             COUNT(*) FROM OTRequest
UNION ALL SELECT 'OTRequestEmployee',     COUNT(*) FROM OTRequestEmployee
UNION ALL SELECT 'OTApproval',            COUNT(*) FROM OTApproval
UNION ALL SELECT 'OTCancellation',        COUNT(*) FROM OTCancellation
UNION ALL SELECT 'OTMemo',                COUNT(*) FROM OTMemo
UNION ALL SELECT 'EmailLog',              COUNT(*) FROM EmailLog
UNION ALL SELECT 'AuditLog (Leave/OT)',   COUNT(*) FROM AuditLog WHERE action LIKE '%LEAVE%' OR action LIKE '%OT%'
UNION ALL SELECT 'LeaveBalance (preserved)', COUNT(*) FROM LeaveBalance;
GO

-- ─── ตรวจสอบว่า master data ครบดี ──────────────────────────────
PRINT '';
PRINT '--- Master data (untouched) ---';
SELECT 'Employee (active)'  AS TableName, COUNT(*) AS Rows FROM Employee WHERE isActive = 1
UNION ALL SELECT 'User (active)',         COUNT(*) FROM [User] WHERE isActive = 1
UNION ALL SELECT 'Department',            COUNT(*) FROM Department
UNION ALL SELECT 'LeaveType (active)',    COUNT(*) FROM LeaveType WHERE isActive = 1
UNION ALL SELECT 'VacationTier',          COUNT(*) FROM VacationTier
UNION ALL SELECT 'BusRoute (active)',     COUNT(*) FROM BusRoute WHERE isActive = 1
UNION ALL SELECT 'Holiday',               COUNT(*) FROM Holiday;
GO
