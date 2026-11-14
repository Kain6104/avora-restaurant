import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsIn,
  MaxLength,
} from 'class-validator';

export const ONBOARDING_DEPARTMENTS = [
  'HEAD_CHEF_RD',
  'MENU_OPERATIONS',
  'PROCUREMENT',
  'FINANCE',
  'WAREHOUSE',
  'AVO1_BRANCH_MANAGER',
  'POS_KDS_TECH',
  'QA',
] as const;

export type OnboardingDepartment = (typeof ONBOARDING_DEPARTMENTS)[number];

export const ONBOARDING_TASK_STATUSES = [
  'NOT_STARTED',
  'AWAITING_INPUT',
  'SUBMITTED',
  'VALIDATING',
  'VALIDATION_FAILED',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'COMMITTED',
  'BLOCKED',
] as const;

export type OnboardingTaskStatus = (typeof ONBOARDING_TASK_STATUSES)[number];

export const SUBMISSION_WORKSTREAM_TYPES = [
  'RECIPE_WORKBOOK',
  'MODIFIER_MATRIX',
  'CATALOG_ANOMALIES',
  'SET_BUFFET_SIGNOFF',
  'INGREDIENT_EXPANSION',
  'SUPPLIER_DATA',
  'DEV_SEED_APPROVAL',
  'OPENING_STOCKTAKE',
  'HARDWARE_ACCEPTANCE',
] as const;

export type SubmissionWorkstreamType = (typeof SUBMISSION_WORKSTREAM_TYPES)[number];

export class AssignTaskOwnerDto {
  @IsString()
  @IsNotEmpty({ message: 'Mã nhân viên được phân công là bắt buộc' })
  employeeId: string;

  @IsString()
  @IsOptional()
  targetDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class SubmitOnboardingEvidenceDto {
  @IsString()
  @IsIn(SUBMISSION_WORKSTREAM_TYPES)
  workstreamType: SubmissionWorkstreamType;

  @IsString()
  @IsNotEmpty({ message: 'Mã Workstream là bắt buộc' })
  workstreamId: string;

  @IsString()
  @IsNotEmpty({ message: 'Tên tệp đính kèm là bắt buộc' })
  @MaxLength(255)
  fileName: string;

  @IsString()
  @IsNotEmpty({ message: 'Nội dung tệp CSV/JSON là bắt buộc' })
  content: string;

  @IsString()
  @IsOptional()
  branchCode?: string;

  @IsBoolean()
  @IsOptional()
  createDraftRevisionIfApproved?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class ReviewOnboardingSubmissionDto {
  @IsBoolean()
  approved: boolean;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  rejectionReason?: string;
}

export class AssignExceptionOwnerDto {
  @IsString()
  @IsNotEmpty({ message: 'Nhân viên phụ trách không được để trống' })
  employeeId: string;

  @IsString()
  @IsOptional()
  targetCompletionDate?: string;
}

export class CloseOnboardingExceptionDto {
  @IsString()
  @IsNotEmpty({ message: 'Bằng chứng xác nhận xử lý (evidenceRef) là bắt buộc' })
  evidenceRef: string;

  @IsString()
  @IsNotEmpty({ message: 'Lý do đóng ngoại lệ là bắt buộc' })
  closureReason: string;
}

export class CompositeApprovalDecisionDto {
  @IsString()
  @IsIn(['SET_SUSHI_STRATEGY', 'BUFFET_TICKETS_NON_TRACKED', 'DEACTIVATE_TEST_BUFFET_PACKAGE'])
  decisionType: 'SET_SUSHI_STRATEGY' | 'BUFFET_TICKETS_NON_TRACKED' | 'DEACTIVATE_TEST_BUFFET_PACKAGE';

  @IsString()
  @IsNotEmpty()
  strategyOrOutcome: string;

  @IsString()
  @IsNotEmpty({ message: 'Mã tham chiếu phê duyệt là bắt buộc' })
  approvalRef: string;

  @IsString()
  @IsNotEmpty()
  submittedById: string;

  @IsBoolean()
  @IsOptional()
  executeCommit?: boolean;
}

export class RecordHardwareScenarioDto {
  @IsNumber()
  scenarioNumber: number;

  @IsString()
  @IsNotEmpty()
  terminalId: string;

  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsString()
  @IsNotEmpty()
  transactionIds: string;

  @IsString()
  @IsNotEmpty()
  screenshotRef: string;

  @IsBoolean()
  passed: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}

