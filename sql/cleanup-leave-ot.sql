/* =============================================================
   AMS — Cleanup Scripts for Leave + OT Data
   Database: AttendanceMS (SQL Server)
   =============================================================
   IMPORTANT:
   - Run inside an explicit transaction to allow ROLLBACK if needed.
   - Master data (Employee / Department / LeaveType / BusRoute / Holiday / User)
     is NEVER touched by these scripts.
   - LeaveBalance rows are kept but `usedDays` / `remainingDays` are reset
     so the system can still calculate quota for the current year.
   ============================================================= */

USE AttendanceMS;
GO

-------------------------------------------------------------------
-- 1) Check current counts BEFORE deleting (read-only — safe to run)
-------------------------------------------------------------------
SELECT 'LeaveRequest'    AS [Table], COUNT(*) AS [Rows] FROM LeaveRequest
UNION ALL SELECT 'LeaveApproval',   COUNT(*) FROM LeaveApproval
UNION ALL SELECT 'LeaveBalance',    COUNT(*) FROM LeaveBalance
UNION ALL SELECT 'OTRequest',       COUNT(*) FROM OTRequest
UNION ALL SELECT 'OTRequestEmployee', COUNT(*) FROM OTRequestEmployee
UNION ALL SELECT 'OTApproval',      COUNT(*) FROM OTApproval
UNION ALL SELECT 'OTCancellation',  COUNT(*) FROM OTCancellation
UNION ALL SELECT 'OTMemo',          COUNT(*) FROM OTMemo
UNION ALL SELECT 'EmailLog',        COUNT(*) FROM EmailLog
UNION ALL SELECT 'AuditLog',        COUNT(*) FROM AuditLog;
GO


/* =============================================================
   SCRIPT A — ลบเฉพาะข้อมูลการลา (Leave Module)
   ============================================================= */
BEGIN TRANSACTION DeleteLeave;
BEGIN TRY
    -- ลำดับการลบ: children → parent (เพราะมี FK reference)
    -- 1.1 ลบประวัติการอนุมัติ (CASCADE จะลบให้อัตโนมัติเมื่อลบ LeaveRequest
    --     แต่ลบ explicit ก็ปลอดภัยกว่า)
    DELETE FROM LeaveApproval;

    -- 1.2 ลบใบลาทั้งหมด
    DELETE FROM LeaveRequest;

    -- 1.3 Reset ยอดวันลาที่ใช้ไป (ไม่ลบ row — เก็บโควต้าไว้)
    UPDATE LeaveBalance
       SET usedDays      = 0,
           remainingDays = totalDays + carriedOver;

    -- 1.4 (เลือกได้) ลบ EmailLog ที่เกี่ยวข้องกับใบลา
    DELETE FROM EmailLog WHERE subject LIKE '%ใบลา%';

    -- 1.5 (เลือกได้) ลบ AuditLog ที่เกี่ยวข้อง
    DELETE FROM AuditLog WHERE action IN ('CREATE_LEAVE','APPROVE_LEAVE','REJECT_LEAVE','UPDATE_LEAVE','CANCEL_LEAVE');

    COMMIT TRANSACTION DeleteLeave;
    PRINT '✅ ลบข้อมูล Leave สำเร็จ + reset balance';
END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION DeleteLeave;
    PRINT '❌ ลบ Leave ไม่สำเร็จ — rollback แล้ว';
    PRINT ERROR_MESSAGE();
END CATCH
GO


/* =============================================================
   SCRIPT B — ลบเฉพาะข้อมูล OT (OT Module)
   ============================================================= */
BEGIN TRANSACTION DeleteOT;
BEGIN TRY
    -- 2.1 ลบ children ก่อน (cascade ทำงานเองได้ แต่ explicit ปลอดภัยกว่า)
    DELETE FROM OTMemo;
    DELETE FROM OTCancellation;
    DELETE FROM OTApproval;
    DELETE FROM OTRequestEmployee;

    -- 2.2 ลบ OT header
    DELETE FROM OTRequest;

    -- 2.3 (เลือกได้) ลบ EmailLog
    DELETE FROM EmailLog WHERE subject LIKE '%OT%';

    -- 2.4 (เลือกได้) ลบ AuditLog
    DELETE FROM AuditLog WHERE action IN (
        'CREATE_OT','APPROVE_OT','REJECT_OT','UPDATE_OT','CANCEL_OT',
        'APPROVE_OT_CANCEL','REJECT_OT_CANCEL','ACK_OT_MEMO','REJECT_OT_MEMO'
    );

    COMMIT TRANSACTION DeleteOT;
    PRINT '✅ ลบข้อมูล OT สำเร็จ';
END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION DeleteOT;
    PRINT '❌ ลบ OT ไม่สำเร็จ — rollback แล้ว';
    PRINT ERROR_MESSAGE();
END CATCH
GO


/* =============================================================
   SCRIPT C — ลบทั้ง Leave + OT พร้อมกัน (ครบทุกอย่าง)
   ============================================================= */
BEGIN TRANSACTION DeleteAll;
BEGIN TRY
    -- Leave
    DELETE FROM LeaveApproval;
    DELETE FROM LeaveRequest;
    UPDATE LeaveBalance SET usedDays = 0, remainingDays = totalDays + carriedOver;

    -- OT
    DELETE FROM OTMemo;
    DELETE FROM OTCancellation;
    DELETE FROM OTApproval;
    DELETE FROM OTRequestEmployee;
    DELETE FROM OTRequest;

    -- Logs (เลือกได้ — ลบออกเพื่อความสะอาด)
    DELETE FROM EmailLog;
    DELETE FROM AuditLog
       WHERE action IN (
           'CREATE_LEAVE','APPROVE_LEAVE','REJECT_LEAVE','UPDATE_LEAVE','CANCEL_LEAVE',
           'CREATE_OT','APPROVE_OT','REJECT_OT','UPDATE_OT','CANCEL_OT',
           'APPROVE_OT_CANCEL','REJECT_OT_CANCEL','ACK_OT_MEMO','REJECT_OT_MEMO'
       );

    COMMIT TRANSACTION DeleteAll;
    PRINT '✅ ลบข้อมูล Leave + OT + Logs สำเร็จ — master data ยังครบ';
END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION DeleteAll;
    PRINT '❌ Error — rollback แล้ว';
    PRINT ERROR_MESSAGE();
END CATCH
GO


-------------------------------------------------------------------
-- 3) Verify AFTER deleting — ควรเหลือ 0 ทุกแถวที่ลบ
-------------------------------------------------------------------
SELECT 'LeaveRequest'      AS [Table], COUNT(*) AS [Rows] FROM LeaveRequest
UNION ALL SELECT 'LeaveApproval',     COUNT(*) FROM LeaveApproval
UNION ALL SELECT 'LeaveBalance',      COUNT(*) FROM LeaveBalance    -- เท่าเดิม (reset แล้ว)
UNION ALL SELECT 'OTRequest',         COUNT(*) FROM OTRequest
UNION ALL SELECT 'OTRequestEmployee', COUNT(*) FROM OTRequestEmployee
UNION ALL SELECT 'OTApproval',        COUNT(*) FROM OTApproval
UNION ALL SELECT 'OTCancellation',    COUNT(*) FROM OTCancellation
UNION ALL SELECT 'OTMemo',            COUNT(*) FROM OTMemo
UNION ALL SELECT 'EmailLog',          COUNT(*) FROM EmailLog
UNION ALL SELECT 'AuditLog',          COUNT(*) FROM AuditLog;
GO


/* =============================================================
   APPENDIX: คำสั่งเพิ่มเติม
   =============================================================

   A) TRUNCATE TABLE (เร็วกว่า DELETE แต่ใช้กับ table ที่มี FK เข้ามาไม่ได้):
      → ใช้กับตารางที่ไม่มี FK reference เท่านั้น
      → ในระบบนี้ไม่แนะนำ เพราะ table มี relation กันเยอะ

   B) Reset Identity (ในระบบนี้ใช้ cuid ไม่มี IDENTITY → ไม่ต้องทำ)

   C) ลบเฉพาะของพนักงาน 1 คน (ตัวอย่าง EMP001):
      DELETE FROM LeaveRequest WHERE employeeId IN
          (SELECT id FROM Employee WHERE employeeCode = 'EMP001');

   D) ลบเฉพาะของเดือนใดเดือนหนึ่ง (ตัวอย่าง พ.ค. 2569 = May 2026):
      DELETE FROM LeaveRequest
          WHERE startDate >= '2026-05-01' AND startDate < '2026-06-01';

   E) ลบเฉพาะ OT ของวันใดวันหนึ่ง:
      DELETE FROM OTRequest WHERE otDate = '2026-05-20';
      -- (cascade จะลบ OTRequestEmployee/OTApproval/etc. ให้อัตโนมัติ)
   ============================================================= */
