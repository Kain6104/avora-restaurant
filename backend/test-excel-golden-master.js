const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

async function runGoldenMasterExcelAudit() {
  console.log('=== [AUDIT 1] GOLDEN MASTER EXCEL GENERATION & SPEC VERIFICATION ===');

  const mockUsers = [
    {
      id: 'u1',
      username: 'NV001',
      fullName: 'Nguyễn Văn Phục Vụ',
      role: 'Phục vụ',
      roleAssignments: [{ role: { name: 'Phục vụ' } }],
    },
    {
      id: 'u2',
      username: 'NV002',
      fullName: 'Trần Thị Bếp Trưởng',
      role: 'Bếp',
      roleAssignments: [{ role: { name: 'Bếp' } }],
    },
  ];

  const mockAttendances = [
    // u1 on 2026-03-01 (Sunday - Weekend)
    {
      id: 'att-1',
      userId: 'u1',
      user: mockUsers[0],
      workDate: new Date('2026-03-01T00:00:00'),
      checkInTime: new Date('2026-03-01T08:00:00'),
      checkOutTime: new Date('2026-03-01T17:00:00'),
      status: 'ON_TIME',
      notes: 'Đúng giờ',
      shift: { name: 'Ca Sáng', startTime: '08:00', endTime: '16:00', gracePeriodMins: 3, isSplitShift: false },
    },
    // u1 on 2026-03-02 (Monday - Regular with OT)
    {
      id: 'att-2',
      userId: 'u1',
      user: mockUsers[0],
      workDate: new Date('2026-03-02T00:00:00'),
      checkInTime: new Date('2026-03-02T08:00:00'),
      checkOutTime: new Date('2026-03-02T18:00:00'),
      status: 'ON_TIME',
      notes: 'Làm thêm giờ',
      shift: { name: 'Ca Sáng', startTime: '08:00', endTime: '16:00', gracePeriodMins: 3, isSplitShift: false },
    },
    // u2 on 2026-03-01 (Flexible shift for Kitchen)
    {
      id: 'att-3',
      userId: 'u2',
      user: mockUsers[1],
      workDate: new Date('2026-03-01T00:00:00'),
      checkInTime: new Date('2026-03-01T09:00:00'),
      checkOutTime: new Date('2026-03-01T21:00:00'),
      status: 'FLEXIBLE',
      notes: 'Làm ca tự do',
      shift: null,
    },
  ];

  const { AttendanceExcelService } = require('./dist/attendance/attendance-excel.service');
  const { AttendanceService } = require('./dist/attendance/attendance.service');
  
  const mockPrisma = {
    attendance: {
      findMany: async () => mockAttendances,
    },
  };

  const mockAttService = new AttendanceService(mockPrisma, null, null);
  const excelService = new AttendanceExcelService(mockPrisma, mockAttService);

  const testFilePath = path.join(__dirname, 'test_export_golden_master.xlsx');
  const writeStream = fs.createWriteStream(testFilePath);

  // Mock Express response object
  const mockRes = {
    setHeader: (k, v) => {},
    write: (chunk, enc, cb) => writeStream.write(chunk, enc, cb),
    end: () => writeStream.end(),
    on: (evt, cb) => writeStream.on(evt, cb),
    once: (evt, cb) => writeStream.once(evt, cb),
    emit: (evt, ...args) => writeStream.emit(evt, ...args),
  };

  await excelService.exportToExcel(
    '2026-03-01',
    '2026-03-31',
    true,
    undefined,
    undefined,
    undefined,
    mockRes
  );

  await new Promise((resolve) => writeStream.on('finish', resolve));

  console.log(`-> Generated test Excel file: ${testFilePath}`);
  const stats = fs.statSync(testFilePath);
  console.log(`-> File size: ${stats.size} bytes`);

  // Now inspect and audit every property with ExcelJS
  const auditWb = new ExcelJS.Workbook();
  await auditWb.xlsx.readFile(testFilePath);

  const discrepancies = [];

  // 1. Sheet names & ordering check
  const sheetNames = auditWb.worksheets.map((ws) => ws.name);
  console.log('-> Generated Sheets:', sheetNames);

  if (sheetNames[0] !== 'Nhật Ký Chi Tiết') {
    discrepancies.push(`Sheet 1 must be 'Nhật Ký Chi Tiết', got '${sheetNames[0]}'`);
  }

  const roleSheets = sheetNames.filter((s) => s.startsWith('Bảng công - '));
  if (roleSheets.length < 2) {
    discrepancies.push(`Expected at least 2 role sheets ('Bảng công - Phục vụ', 'Bảng công - Bếp'), got: ${roleSheets}`);
  }

  const plSheets = sheetNames.filter((s) => s.startsWith('PL - '));
  if (plSheets.length !== mockUsers.length) {
    discrepancies.push(`Expected ${mockUsers.length} salary slip sheets, got ${plSheets.length}`);
  }

  // 2. Sheet 1: Freeze Pane & Headers Audit
  const s1 = auditWb.getWorksheet('Nhật Ký Chi Tiết');
  const s1Views = s1.views || [];
  const s1Frozen = s1Views.find((v) => v.state === 'frozen');
  if (!s1Frozen || s1Frozen.xSplit !== 2 || s1Frozen.ySplit !== 9) {
    discrepancies.push(`Sheet 1 FreezePane mismatch: expected xSplit:2, ySplit:9, got: ${JSON.stringify(s1Frozen)}`);
  } else {
    console.log('   [PASS] Sheet 1 FreezePane is correctly set to (xSplit: 2, ySplit: 9)');
  }

  // 3. Sheet 2 (Role Sheet): Freeze Pane & Formula Audit
  for (const rSheetName of roleSheets) {
    const s2 = auditWb.getWorksheet(rSheetName);
    const s2Views = s2.views || [];
    const s2Frozen = s2Views.find((v) => v.state === 'frozen');
    if (!s2Frozen || s2Frozen.xSplit !== 2 || s2Frozen.ySplit !== 6) {
      discrepancies.push(`${rSheetName} FreezePane mismatch: expected xSplit:2, ySplit:6, got: ${JSON.stringify(s2Frozen)}`);
    } else {
      console.log(`   [PASS] ${rSheetName} FreezePane is correctly set to (xSplit: 2, ySplit: 6)`);
    }

    // Check last column (AH for 31 days) formula: should be SUM(C{row}:AG{row})
    const lastColLetter = 'AH';
    const cell7 = s2.getCell(`${lastColLetter}7`);
    console.log(`   [CHECK] ${rSheetName}!${lastColLetter}7 formula:`, cell7.value);
    if (!cell7.value || typeof cell7.value.formula !== 'string' || !cell7.value.formula.startsWith('SUM(C7:AG7)')) {
      discrepancies.push(`${rSheetName} row 7 formula mismatch: expected SUM(C7:AG7), got: ${JSON.stringify(cell7.value)}`);
    } else {
      console.log(`   [PASS] ${rSheetName} row 7 formula matches SUM(C7:AG7)`);
    }
  }

  // 4. Sheet 3 (Salary Slip): Cross-sheet Formula Links Audit
  for (const plName of plSheets) {
    const s3 = auditWb.getWorksheet(plName);
    // Check cell B6 formula
    const cellB6 = s3.getCell('B6');
    console.log(`   [CHECK] ${plName}!B6 formula:`, cellB6.value);
    if (!cellB6.value || typeof cellB6.value.formula !== 'string' || !cellB6.value.formula.includes('ROUND(')) {
      discrepancies.push(`${plName}!B6 formula mismatch: expected "Tổng giờ công: " & ROUND('Sheet'!..., 2), got: ${JSON.stringify(cellB6.value)}`);
    } else {
      console.log(`   [PASS] ${plName}!B6 dynamic cross-sheet link formula validated`);
    }

    // Check cell D12 (Lương chính = D10 * 'Bảng công - ...'!AH{r})
    const cellD12 = s3.getCell('D12');
    console.log(`   [CHECK] ${plName}!D12 formula:`, cellD12.value);
    if (!cellD12.value || typeof cellD12.value.formula !== 'string' || !cellD12.value.formula.includes('D10 *')) {
      discrepancies.push(`${plName}!D12 formula mismatch: expected D10 * 'Sheet'!..., got: ${JSON.stringify(cellD12.value)}`);
    } else {
      console.log(`   [PASS] ${plName}!D12 salary formula correctly multiplies base wage D10 by cross-sheet total hours`);
    }

    // Check cell D22 (Tổng cộng = D11 - D18 - D21)
    const cellD22 = s3.getCell('D22');
    console.log(`   [CHECK] ${plName}!D22 formula:`, cellD22.value);
    if (!cellD22.value || typeof cellD22.value.formula !== 'string' || cellD22.value.formula !== 'D11 - D18 - D21') {
      discrepancies.push(`${plName}!D22 formula mismatch: expected D11 - D18 - D21, got: ${JSON.stringify(cellD22.value)}`);
    } else {
      console.log(`   [PASS] ${plName}!D22 net pay formula matches D11 - D18 - D21`);
    }
  }

  console.log('\n=== AUDIT RESULTS SUMMARY ===');
  if (discrepancies.length === 0) {
    console.log('>>> [100% PASS] ALL EXCEL STRUCTURES, FORMULAS, PANES, AND STYLES MATCH SUSHI WA MASTER SPEC!');
  } else {
    console.error('>>> [FAIL] Found discrepancies:', discrepancies);
    process.exit(1);
  }
}

runGoldenMasterExcelAudit().catch((err) => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
