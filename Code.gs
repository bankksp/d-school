
/**
 * D-school Management System - Backend Script
 * Version: 2.5.0 (Enhanced Notification & Prompt Design)
 */
const SCRIPT_VERSION = "2.5.0";

const FOLDER_NAME = "D-school_Uploads"; 
const SCHOOL_NAME = "โรงเรียนกาฬสินธุ์ปัญญานุกูล";

const SHEET_NAMES = {
  REPORTS: "Reports",
  STUDENTS: "Students",
  PERSONNEL: "Personnel",
  SETTINGS: "Settings",
  STUDENT_ATTENDANCE: "StudentAttendance",
  PERSONNEL_ATTENDANCE: "PersonnelAttendance",
  DUTY_RECORDS: "DutyRecords",
  LEAVE_RECORDS: "LeaveRecords",
  ACADEMIC_PLANS: "AcademicPlans",
  SERVICE_RECORDS: "ServiceRecords",
  SUPPLY_ITEMS: "SupplyItems",
  SUPPLY_REQUESTS: "SupplyRequests",
  DURABLE_GOODS: "DurableGoods",
  CERTIFICATE_PROJECTS: "CertificateProjects",
  CERTIFICATE_REQUESTS: "CertificateRequests",
  MAINTENANCE_REQUESTS: "MaintenanceRequests",
  PERFORMANCE_REPORTS: "PerformanceReports",
  SALARY_PROMOTION_REPORTS: "SalaryPromotionReports",
  SAR_REPORTS: "SARReports",
  ACHIEVEMENTS: "Achievements",
  DOCUMENTS: "GeneralDocuments",
  CONSTRUCTION_RECORDS: "ConstructionRecords",
  PROJECT_PROPOSALS: "ProjectProposals",
  HOME_VISITS: "HomeVisits",
  SDQ_RECORDS: "SDQRecords",
  MEAL_PLANS: "MealPlans",
  INGREDIENTS: "Ingredients",
  OTP_STORE: "OTPStore",
  WORKFLOW_DOCS: "WorkflowDocuments",
  CHAT_MESSAGES: "ChatMessages"
};


function findRecordById(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idIndex = headers.indexOf('id');
  if (idIndex === -1) return null;

  const ids = sheet.getRange(2, idIndex + 1, lastRow - 1, 1).getValues().flat();
  const rowIndex = ids.map(String).indexOf(String(id));

  if (rowIndex !== -1) {
    const row = rowIndex + 2;
    const rowData = sheet.getRange(row, 1, 1, headers.length).getValues()[0];
    const obj = {};
    headers.forEach((h, i) => {
      if (h) {
        let val = rowData[i];
        if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
          try { val = JSON.parse(val); } catch(e) {}
        }
        obj[h] = val;
      }
    });
    return obj;
  }
  return null;
}

function updateRecordFields(sheet, id, fieldsToUpdate) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idIndex = headers.indexOf('id');
  if (idIndex === -1) return; 

  const ids = sheet.getRange(2, idIndex + 1, lastRow - 1, 1).getValues().flat();
  const rowIndex = ids.map(String).indexOf(String(id));

  if (rowIndex !== -1) {
    const row = rowIndex + 2; 
    for (const field in fieldsToUpdate) {
      if (Object.prototype.hasOwnProperty.call(fieldsToUpdate, field)) {
        const colIndex = headers.indexOf(field);
        if (colIndex !== -1) {
          const col = colIndex + 1;
          sheet.getRange(row, col).setValue(fieldsToUpdate[field] === undefined ? '' : fieldsToUpdate[field]);
        }
      }
    }
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  // Reduce lock wait time to prevent timeout on client
  if (!lock.tryLock(10000)) return responseJSON({ status: 'error', message: 'Server busy, please try again.' });

  try {
    const request = JSON.parse(e.postData.contents);
    const action = String(request.action || "").trim();
    const data = request.data;
    const uploadFolder = getUploadFolder();
    
    switch (action) {
      case 'checkVersion':
        return responseJSON({ status: 'success', version: SCRIPT_VERSION });

      case 'checkIdCardExists': {
        const personnelSheet = getSheet(SHEET_NAMES.PERSONNEL);
        const personnel = readSheet(personnelSheet);
        const cleanIdCard = String(request.idCard || '').replace(/[^0-9]/g, '');
        const exists = personnel.some(p => String(p.idCard || '').replace(/[^0-9]/g, '') === cleanIdCard);
        return responseJSON({ status: 'success', data: { exists: exists } });
      }

      case 'login':
        const personnel = readSheet(getSheet(SHEET_NAMES.PERSONNEL));
        const identifier = String(request.identifier || "").toLowerCase().trim();
        const user = personnel.find(p => (String(p.idCard).replace(/[^0-9]/g, '') === identifier.replace(/[^0-9]/g, '')) || (String(p.email).toLowerCase() === identifier));

        if (!user) return responseJSON({ status: 'error', message: 'ไม่พบผู้ใช้งานในระบบ' });
        
        const actualPass = user.password || user.idCard;
        if (String(actualPass) === String(request.password)) {
            if (user.status === 'pending') return responseJSON({ status: 'error', message: 'บัญชีของท่านยังไม่ได้รับอนุมัติ' });
            if (user.status === 'blocked') return responseJSON({ status: 'error', message: 'บัญชีของท่านถูกระงับการใช้งาน' });
            return responseJSON({ status: 'success', data: user });
        } else {
            return responseJSON({ status: 'error', message: 'รหัสผ่านไม่ถูกต้อง' });
        }

      case 'getDashboardData':
        const dashboardData = {
          reports: readSheet(getSheet(SHEET_NAMES.REPORTS)),
          students: readSheet(getSheet(SHEET_NAMES.STUDENTS)),
          personnel: readSheet(getSheet(SHEET_NAMES.PERSONNEL)),
          studentAttendance: readSheet(getSheet(SHEET_NAMES.STUDENT_ATTENDANCE)),
          personnelAttendance: readSheet(getSheet(SHEET_NAMES.PERSONNEL_ATTENDANCE)),
          homeVisits: readSheet(getSheet(SHEET_NAMES.HOME_VISITS)),
          settings: readSheet(getSheet(SHEET_NAMES.SETTINGS))[0] || null
        };
        return responseJSON({ status: 'success', data: dashboardData });

      case 'getStudents': return responseJSON({ status: 'success', data: readSheet(getSheet(SHEET_NAMES.STUDENTS)) });
      case 'getPersonnel': return responseJSON({ status: 'success', data: readSheet(getSheet(SHEET_NAMES.PERSONNEL)) });
      case 'getReports': return responseJSON({ status: 'success', data: readSheet(getSheet(SHEET_NAMES.REPORTS)) });
      case 'getAttendanceData': 
        return responseJSON({ status: 'success', data: {
            studentAttendance: readSheet(getSheet(SHEET_NAMES.STUDENT_ATTENDANCE)),
            personnelAttendance: readSheet(getSheet(SHEET_NAMES.PERSONNEL_ATTENDANCE))
        }});
      case 'getDutyRecords': return responseJSON({ status: 'success', data: readSheet(getSheet(SHEET_NAMES.DUTY_RECORDS)) });
      case 'getLeaveRecords': return responseJSON({ status: 'success', data: readSheet(getSheet(SHEET_NAMES.LEAVE_RECORDS)) });
      case 'getAchievements': return responseJSON({ status: 'success', data: readSheet(getSheet(SHEET_NAMES.ACHIEVEMENTS)) });
      case 'getAcademicPlans': return responseJSON({ status: 'success', data: readSheet(getSheet(SHEET_NAMES.ACADEMIC_PLANS)) });
      case 'getServiceRecords': return responseJSON({ status: 'success', data: readSheet(getSheet(SHEET_NAMES.SERVICE_RECORDS)) });
      case 'getSupplyRequests': return responseJSON({ status: 'success', data: readSheet(getSheet(SHEET_NAMES.SUPPLY_REQUESTS)) });
      case 'getProjectProposals': return responseJSON({ status: 'success', data: readSheet(getSheet(SHEET_NAMES.PROJECT_PROPOSALS)) });
      case 'getDurableGoods': return responseJSON({ status: 'success', data: readSheet(getSheet(SHEET_NAMES.DURABLE_GOODS)) });
      case 'getPerformanceReports': return responseJSON({ status: 'success', data: readSheet(getSheet(SHEET_NAMES.PERFORMANCE_REPORTS)) });
      case 'getSalaryPromotionReports': return responseJSON({ status: 'success', data: readSheet(getSheet(SHEET_NAMES.SALARY_PROMOTION_REPORTS)) });
      case 'getSarReports': return responseJSON({ status: 'success', data: readSheet(getSheet(SHEET_NAMES.SAR_REPORTS)) });
      case 'getGeneralDocuments': return responseJSON({ status: 'success', data: readSheet(getSheet(SHEET_NAMES.DOCUMENTS)) });
      case 'getMaintenanceRequests': return responseJSON({ status: 'success', data: readSheet(getSheet(SHEET_NAMES.MAINTENANCE_REQUESTS)) });
      case 'getCertificateData':
        return responseJSON({ status: 'success', data: {
            projects: readSheet(getSheet(SHEET_NAMES.CERTIFICATE_PROJECTS)),
            requests: readSheet(getSheet(SHEET_NAMES.CERTIFICATE_REQUESTS))
        }});
      case 'getConstructionRecords': return responseJSON({ status: 'success', data: readSheet(getSheet(SHEET_NAMES.CONSTRUCTION_RECORDS)) });
      case 'getNutritionData':
        return responseJSON({ status: 'success', data: {
            mealPlans: readSheet(getSheet(SHEET_NAMES.MEAL_PLANS)),
            ingredients: readSheet(getSheet(SHEET_NAMES.INGREDIENTS))
        }});
      case 'getHomeVisits': return responseJSON({ status: 'success', data: readSheet(getSheet(SHEET_NAMES.HOME_VISITS)) });
      case 'getSdqRecords': return responseJSON({ status: 'success', data: readSheet(getSheet(SHEET_NAMES.SDQ_RECORDS)) });
      case 'getWorkflowDocs': return responseJSON({ status: 'success', data: readSheet(getSheet(SHEET_NAMES.WORKFLOW_DOCS)) });

      case 'getChatMessages':
        const messages = readSheet(getSheet(SHEET_NAMES.CHAT_MESSAGES));
        const userId = request.userId;
        const userRole = request.userRole;
        const sinceTimestamp = request.sinceTimestamp;

        const isUserAdmin = (userRole === 'admin' || userRole === 'pro');

        const filtered = messages.filter(m => {
          if (sinceTimestamp && new Date(m.timestamp) <= new Date(sinceTimestamp)) {
            return false;
          }
          
          return !m.isDeleted && (
            m.senderId == userId || 
            m.receiverId == userId || 
            m.receiverId == 'all' ||
            (m.receiverId == 'admin' && isUserAdmin)
          );
        });
        return responseJSON({ status: 'success', data: filtered });

      case 'sendChatMessage':
      case 'editChatMessage':
      case 'deleteChatMessage':
        const chatSheet = getSheet(SHEET_NAMES.CHAT_MESSAGES);
        if (action === 'sendChatMessage') ensureHeadersExist(chatSheet, data);
        const savedChat = saveRecord(chatSheet, data, uploadFolder);
        return responseJSON({ status: 'success', data: savedChat });

      case 'testWebhook':
        const { url, label } = data;
        if (!url || !url.startsWith('http')) {
           return responseJSON({ status: 'error', message: 'URL ไม่ถูกต้อง' });
        }
        return sendToGoogleChat(url, `⚡ *D-school Connection Test*\n✅ สถานะ: เชื่อมต่อสำเร็จ\n🤖 ระบบ: ${label}\n👤 ทดสอบโดย: ผู้ดูแลระบบ\n🕒 เวลา: ${new Date().toLocaleString('th-TH')}`);
      
      case 'updateAcademicPlanStatus': {
        const planSheet = getSheet(SHEET_NAMES.ACADEMIC_PLANS);
        const { id, status, comment, approverName, approvedDate } = data;
        
        const originalRecord = findRecordById(planSheet, id); 
        updateRecordFields(planSheet, id, { status, comment, approverName, approvedDate });

        if (originalRecord) {
          const updatedPlanForNotif = { ...originalRecord, ...data };
          const settingsListForPlan = readSheet(getSheet(SHEET_NAMES.SETTINGS));
          if (settingsListForPlan.length > 0) {
            triggerNotification('updateAcademicPlanStatus', updatedPlanForNotif, settingsListForPlan[0]);
          }
        }
        return responseJSON({ status: 'success', data: {id: id} });
      }

      default:
        return routeGenericAction(action, request, uploadFolder);
    }

  } catch (error) {
    return responseJSON({ status: 'error', message: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

function sendToGoogleChat(webhookUrl, messageText) {
  try {
    if (!webhookUrl || !webhookUrl.startsWith('http')) {
      Logger.log("Invalid Webhook URL: " + webhookUrl);
      return responseJSON({ status: 'error', message: 'Invalid Webhook URL' });
    }

    const payload = { text: messageText };
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    const response = UrlFetchApp.fetch(webhookUrl, options);
    const code = response.getResponseCode();
    if (code >= 200 && code < 300) {
      return responseJSON({ status: 'success', message: 'Sent' });
    } else {
      Logger.log("Chat API Error: " + response.getContentText());
      return responseJSON({ status: 'error', message: `Chat Error ${code}: ${response.getContentText()}` });
    }
  } catch (e) {
    Logger.log("Send Exception: " + e.toString());
    return responseJSON({ status: 'error', message: e.toString() });
  }
}

function triggerNotification(action, data, settings) {
  // Actions that do NOT trigger notifications
  const exemptActions = ['addPersonnel', 'updatePersonnel', 'addStudent', 'updateStudent', 'deleteStudentAttendance', 'deletePersonnelAttendance', 'updateSettings'];
  if (exemptActions.includes(action)) return;

  const first = Array.isArray(data) ? data[0] : data;
  if (!first) return;

  let webhookUrl = '';
  let msg = '';

  try {
    switch (action) {
      case 'saveStudentAttendance':
      case 'savePersonnelAttendance':
        webhookUrl = settings.webhookAttendance;
        const isStudent = action === 'saveStudentAttendance';
        const periodMap = { 'morning_act': 'กิจกรรมหน้าเสาธง', 'p1': 'คาบที่ 1', 'lunch_act': 'กิจกรรมกลางวัน', 'evening_act': 'กิจกรรมเย็น' };
        
        const stats = { present: 0, absent: 0, sick: 0, leave: 0, home: 0 };
        const records = Array.isArray(data) ? data : [data];
        records.forEach(r => { if (stats[r.status] !== undefined) stats[r.status]++; });
        const totalCheck = records.length;
        const presentTotal = (stats.present || 0);

        msg = `📊 *รายงานการเช็คชื่อ${isStudent ? 'นักเรียน' : 'บุคลากร'}*\n` +
              `📅 วันที่: ${first.date} | ช่วง: ${periodMap[first.period] || first.period}\n` +
              `----------------------------------\n` +
              `👥 ทั้งหมด: ${totalCheck} คน\n` +
              `✅ มา: ${presentTotal} | ❌ ขาด: ${stats.absent}\n` +
              `🤒 ป่วย: ${stats.sick} | 📝 ลา: ${stats.leave}\n` +
              `🏠 บ้าน/อื่นๆ: ${stats.home}\n` +
              `----------------------------------`;
        break;

      case 'addReport':
      case 'updateReport':
        webhookUrl = settings.webhookDormitory;
        let sickNames = "-";
        if (first.studentDetails) {
          try {
            const details = JSON.parse(first.studentDetails);
            const sickArr = details.filter(s => s.status === 'sick').map(s => s.name);
            if (sickArr.length > 0) sickNames = sickArr.join(', ');
          } catch(e) {}
        }
        // New Prompt Design
        msg = `📢 *รายงานสถานการณ์ประจำวัน* 📢\n` +
              `🏢 *หอนอน:* ${first.dormitory}\n` +
              `📅 *วันที่:* ${first.reportDate} | 🕒 ${first.reportTime || '-'}\n` +
              `👤 *ผู้รายงาน:* ${first.reporterName}\n` +
              `➖➖➖➖➖➖➖➖➖➖\n` +
              `✅ *มาเรียน:* ${first.presentCount} คน\n` +
              `🤒 *ป่วย:* ${first.sickCount} คน\n` +
              `🏠 *กลับบ้าน/อื่นๆ:* ${first.homeCount || 0} คน\n` +
              `➖➖➖➖➖➖➖➖➖➖\n` +
              `📝 *รายละเอียดเพิ่มเติม:*\n` +
              `${first.log || '- ไม่มี -'}`;
        break;

      case 'saveAcademicPlan':
        webhookUrl = settings.webhookAcademic;
        msg = `📚 *ส่งแผนการจัดการเรียนรู้*\n` +
              `📖 วิชา: ${first.subjectName} (${first.subjectCode})\n` +
              `👤 ผู้สอน: ${first.teacherName}\n` +
              `📂 กลุ่มสาระ: ${first.learningArea}\n` +
              `📅 วันที่ส่ง: ${first.date}`;
        break;

      case 'updateAcademicPlanStatus':
        webhookUrl = settings.webhookAcademic;
        const statusIcon = first.status === 'approved' ? '✅' : '⚠️';
        const statusText = first.status === 'approved' ? 'อนุมัติแล้ว' : 'ส่งคืนแก้ไข';
        msg = `${statusIcon} *ผลการตรวจแผนการสอน*\n` +
              `📖 วิชา: ${first.subjectName}\n` +
              `👤 ผู้สอน: ${first.teacherName}\n` +
              `⭐ ผลการพิจารณา: ${statusText}\n` +
              `💬 ความเห็น: ${first.comment || '-'}\n` +
              `ผู้ตรวจ: ${first.approverName}`;
        break;

      case 'saveServiceRecord':
        webhookUrl = settings.webhookAcademic;
        msg = `🏫 *ขอใช้บริการแหล่งเรียนรู้*\n` +
              `📍 สถานที่: ${first.location}\n` +
              `📝 กิจกรรม: ${first.purpose}\n` +
              `👥 จำนวนนักเรียน: ${first.students ? JSON.parse(first.students).length : 0} คน\n` +
              `👤 ผู้รับผิดชอบ: ${first.teacherName}\n` +
              `📅 วันที่ใช้: ${first.date} เวลา ${first.time}`;
        break;

      case 'saveSupplyRequest':
        webhookUrl = settings.webhookFinance;
        msg = `📦 *ขอจัดซื้อ/จัดจ้างพัสดุ*\n` +
              `📝 เรื่อง: ${first.subject}\n` +
              `👤 ผู้ขอ: ${first.requesterName}\n` +
              `🏢 ฝ่าย/งาน: ${first.department}\n` +
              `💰 ยอดรวม: ${Number(first.totalPrice).toLocaleString()} บาท\n` +
              `📅 วันที่: ${first.docDate}`;
        break;

      case 'saveProjectProposal':
        webhookUrl = settings.webhookFinance;
        msg = `📊 *เสนอโครงการใหม่*\n` +
              `📋 โครงการ: ${first.name}\n` +
              `💰 งบประมาณ: ${Number(first.budget).toLocaleString()} บาท\n` +
              `👤 ผู้รับผิดชอบ: ${first.responsiblePersonName}\n` +
              `📅 ปีงบประมาณ: ${first.fiscalYear}`;
        break;

      case 'saveMaintenanceRequest':
        webhookUrl = settings.webhookGeneral;
        msg = `🔧 *แจ้งซ่อมบำรุง*\n` +
              `🛠️ รายการ: ${first.itemName}\n` +
              `⚠️ อาการ: ${first.description}\n` +
              `📍 สถานที่: ${first.location}\n` +
              `👤 ผู้แจ้ง: ${first.requesterName}`;
        break;

      case 'saveDocument':
      case 'saveWorkflowDoc':
        webhookUrl = settings.webhookGeneral;
        const docStatus = first.status === 'proposed' || first.status === 'pending' ? 'รอพิจารณา' : (first.status === 'approved' || first.status === 'endorsed' ? 'อนุมัติ/ลงนามแล้ว' : first.status);
        msg = `📄 *หนังสือราชการ/บันทึกข้อความ*\n` +
              `📝 เรื่อง: ${first.title}\n` +
              `📂 ประเภท: ${first.category || first.type}\n` +
              `👤 ผู้ส่ง: ${first.submitterName || first.from}\n` +
              `⭐ สถานะ: ${docStatus}`;
        break;

      case 'saveHomeVisit':
        webhookUrl = settings.webhookStudentSupport;
        msg = `🏠 *บันทึกการเยี่ยมบ้าน*\n` +
              `👤 นักเรียน: รหัส ${first.studentId}\n` +
              `👨‍🏫 ครูผู้เยี่ยม: ${first.visitorName}\n` +
              `📅 วันที่: ${first.date}\n` +
              `📍 สถานที่: ${first.locationName}`;
        break;
        
      case 'saveLeaveRecord':
        webhookUrl = settings.webhookGeneral; 
        msg = `📝 *ขออนุญาตลา (${first.type})*\n` +
              `👤 ชื่อ: ${first.personnelName}\n` +
              `📅 ลาวันที่: ${first.startDate} ถึง ${first.endDate}\n` +
              `⏱️ รวม: ${first.daysCount} วัน\n` +
              `เหตุผล: ${first.reason}`;
        break;
        
      case 'saveConstructionRecord':
        webhookUrl = settings.webhookGeneral;
        msg = `🏗️ *อัปเดตงานก่อสร้าง*\n` +
              `📋 โครงการ: ${first.projectName}\n` +
              `🚧 ความคืบหน้า: ${first.progress}%\n` +
              `👷 ผู้รับเหมา: ${first.contractor}\n` +
              `📝 รายละเอียดงาน: ${first.description || '-'}`;
        break;
    }

    if (webhookUrl && webhookUrl.trim().startsWith('http') && msg) {
      // Use a fire-and-forget approach or simple error logging
      try {
        sendToGoogleChat(webhookUrl.trim(), msg);
      } catch (e) {
        Logger.log("Failed to send chat notification: " + e.toString());
      }
    }
  } catch (e) {
    Logger.log("Error in triggerNotification: " + e.toString());
  }
}

function routeGenericAction(action, request, uploadFolder) {
  const data = request.data;
  const ids = request.ids;
  
  if (action.startsWith('delete')) {
     const sheetMap = {
        'deleteReports': SHEET_NAMES.REPORTS, 'deleteStudents': SHEET_NAMES.STUDENTS,
        'deletePersonnel': SHEET_NAMES.PERSONNEL, 'deleteServiceRecords': SHEET_NAMES.SERVICE_RECORDS,
        'deleteDutyRecords': SHEET_NAMES.DUTY_RECORDS,
        'deleteLeaveRecords': SHEET_NAMES.LEAVE_RECORDS, 'deleteSupplyItems': SHEET_NAMES.SUPPLY_ITEMS,
        'deleteSupplyRequests': SHEET_NAMES.SUPPLY_REQUESTS,
        'deleteDurableGoods': SHEET_NAMES.DURABLE_GOODS, 'deleteCertificateProjects': SHEET_NAMES.CERTIFICATE_PROJECTS,
        'deleteCertificateRequests': SHEET_NAMES.CERTIFICATE_REQUESTS,
        'deleteMaintenanceRequests': SHEET_NAMES.MAINTENANCE_REQUESTS,
        'deletePerformanceReports': SHEET_NAMES.PERFORMANCE_REPORTS,
        'deleteSalaryPromotionReports': SHEET_NAMES.SALARY_PROMOTION_REPORTS,
        'deleteSARReports': SHEET_NAMES.SAR_REPORTS, 'deleteDocuments': SHEET_NAMES.DOCUMENTS,
        'deleteConstructionRecords': SHEET_NAMES.CONSTRUCTION_RECORDS,
        'deleteProjectProposals': SHEET_NAMES.PROJECT_PROPOSALS,
        'deleteSDQRecords': SHEET_NAMES.SDQ_RECORDS, 'deleteMealPlans': SHEET_NAMES.MEAL_PLANS,
        'deleteIngredients': SHEET_NAMES.INGREDIENTS, 'deleteStudentAttendance': SHEET_NAMES.STUDENT_ATTENDANCE,
        'deletePersonnelAttendance': SHEET_NAMES.PERSONNEL_ATTENDANCE,
        'deleteAchievements': SHEET_NAMES.ACHIEVEMENTS,
        'deleteWorkflowDocs': SHEET_NAMES.WORKFLOW_DOCS
     };
     const targetSheetName = sheetMap[action];
     if (!targetSheetName) return responseJSON({ status: 'error', message: 'Unknown delete action: ' + action });
     deleteRecords(getSheet(targetSheetName), ids);
     return responseJSON({ status: 'success' });
  }

  const actionToSheetMap = {
    'addReport': SHEET_NAMES.REPORTS, 'updateReport': SHEET_NAMES.REPORTS,
    'addPersonnel': SHEET_NAMES.PERSONNEL, 'updatePersonnel': SHEET_NAMES.PERSONNEL,
    'addStudent': SHEET_NAMES.STUDENTS, 'updateStudent': SHEET_NAMES.STUDENTS,
    'saveAcademicPlan': SHEET_NAMES.ACADEMIC_PLANS,
    'saveServiceRecord': SHEET_NAMES.SERVICE_RECORDS,
    'saveDutyRecord': SHEET_NAMES.DUTY_RECORDS,
    'saveLeaveRecord': SHEET_NAMES.LEAVE_RECORDS,
    'saveSupplyItem': SHEET_NAMES.SUPPLY_ITEMS,
    'saveSupplyRequest': SHEET_NAMES.SUPPLY_REQUESTS,
    'saveDurableGood': SHEET_NAMES.DURABLE_GOODS,
    'saveCertificateProject': SHEET_NAMES.CERTIFICATE_PROJECTS,
    'saveCertificateRequest': SHEET_NAMES.CERTIFICATE_REQUESTS,
    'saveMaintenanceRequest': SHEET_NAMES.MAINTENANCE_REQUESTS,
    'savePerformanceReport': SHEET_NAMES.PERFORMANCE_REPORTS,
    'saveSalaryPromotionReport': SHEET_NAMES.SALARY_PROMOTION_REPORTS,
    'saveSARReport': SHEET_NAMES.SAR_REPORTS,
    'saveAchievement': SHEET_NAMES.ACHIEVEMENTS,
    'saveDocument': SHEET_NAMES.DOCUMENTS,
    'saveConstructionRecord': SHEET_NAMES.CONSTRUCTION_RECORDS,
    'saveProjectProposal': SHEET_NAMES.PROJECT_PROPOSALS,
    'saveHomeVisit': SHEET_NAMES.HOME_VISITS,
    'saveSDQRecord': SHEET_NAMES.SDQ_RECORDS,
    'saveMealPlan': SHEET_NAMES.MEAL_PLANS,
    'saveIngredient': SHEET_NAMES.INGREDIENTS,
    'saveStudentAttendance': SHEET_NAMES.STUDENT_ATTENDANCE,
    'savePersonnelAttendance': SHEET_NAMES.PERSONNEL_ATTENDANCE,
    'saveWorkflowDoc': SHEET_NAMES.WORKFLOW_DOCS,
    'updateSettings': SHEET_NAMES.SETTINGS
  };

  const sheetName = actionToSheetMap[action];
  if (!sheetName) return responseJSON({ status: 'error', message: 'Unknown action: ' + action });

  const sheet = getSheet(sheetName);

  if (action === 'updateSettings') {
    ensureHeadersExist(sheet, data);
    const result = saveRecord(sheet, data, uploadFolder);
    return responseJSON({ status: 'success', data: result });
  }

  if (action.startsWith('add') || action.startsWith('update') || action.startsWith('save')) {
    const records = Array.isArray(data) ? data : [data];
    if (records.length > 0) ensureHeadersExist(sheet, records[0]);
    const results = records.map(r => saveRecord(sheet, r, uploadFolder));

    // Fix: Ensure we read settings properly to get the webhook URL
    const settingsList = readSheet(getSheet(SHEET_NAMES.SETTINGS));
    if (settingsList.length > 0) {
      triggerNotification(action, results, settingsList[0]);
    }

    return responseJSON({ status: 'success', data: Array.isArray(data) ? results : results[0] });
  }

  return responseJSON({ status: 'error', message: 'Action implementation missing in generic router: ' + action });
}

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function readSheet(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const data = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const headers = data.shift();
  return data.map(row => {
    const obj = {};
    headers.forEach((h, i) => { 
      if (h) {
        let val = row[i];
        if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
          try { val = JSON.parse(val); } catch(e) {}
        }
        obj[h] = val;
      }
    });
    return obj;
  });
}

function ensureHeadersExist(sheet, dataObj) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(Object.keys(dataObj));
    return;
  }
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const existingHeaders = new Set(headers);
  const newHeaders = [];
  
  Object.keys(dataObj).forEach(key => {
    if (!existingHeaders.has(key)) {
      newHeaders.push(key);
    }
  });

  if (newHeaders.length > 0) {
    const lastCol = sheet.getLastColumn();
    sheet.getRange(1, lastCol + 1, 1, newHeaders.length).setValues([newHeaders]);
  }
}

function saveRecord(sheet, dataObj, uploadFolder) {
  for (const key in dataObj) {
    const val = dataObj[key];
    if (Array.isArray(val)) {
      dataObj[key] = val.map(item => {
        if (item && item.data && item.filename) {
          try {
            const blob = Utilities.newBlob(Utilities.base64Decode(item.data), item.mimeType, item.filename);
            const file = uploadFolder.createFile(blob);
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            return file.getUrl();
          } catch(e) {
            Logger.log("Error uploading file array item for key " + key + ": " + e.toString());
            return item; // return original object on failure
          }
        }
        return item;
      });
    } else if (val && val.data && val.filename) {
       try {
         const blob = Utilities.newBlob(Utilities.base64Decode(val.data), val.mimeType, val.filename);
         const file = uploadFolder.createFile(blob);
         file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
         dataObj[key] = file.getUrl();
       } catch (e) {
         Logger.log("Error uploading file for key " + key + ": " + e.toString());
         // Keep original object in dataObj on failure
       }
    }
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  let rowIndex = -1;
  const idIndex = headers.indexOf('id');
  
  if (sheet.getName() === SHEET_NAMES.SETTINGS) {
    if (sheet.getLastRow() > 1) rowIndex = 2;
  } else if (idIndex !== -1 && dataObj.id && sheet.getLastRow() > 1) {
    // OPTIMIZATION: Use TextFinder to find the row instead of reading all IDs
    const idColumn = idIndex + 1;
    const range = sheet.getRange(2, idColumn, sheet.getLastRow() - 1, 1);
    const textFinder = range.createTextFinder(String(dataObj.id)).matchEntireCell(true);
    const foundCell = textFinder.findNext();
    if (foundCell) {
      rowIndex = foundCell.getRow();
    }
  }

  const rowData = headers.map(h => {
    const val = dataObj[h];
    if (val === undefined || val === null) return '';
    if (typeof val === 'object') {
        try {
            return JSON.stringify(val);
        } catch (e) {
            return String(val); // Fallback
        }
    }
    return val;
  });

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
  return dataObj;
}

function deleteRecords(sheet, ids) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idIndex = headers.indexOf('id');
  if (idIndex === -1) return;
  const data = sheet.getDataRange().getValues();
  const idsToMatch = ids.map(String);
  for (let i = data.length - 1; i >= 1; i--) {
    if (idsToMatch.includes(String(data[i][idIndex]))) {
      sheet.deleteRow(i + 1);
    }
  }
}

function getUploadFolder() {
  const it = DriveApp.getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
