import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum FarmGardenLayoutStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export enum FarmGardenObjectType {
  PLOT = 'PLOT',
  DECORATION = 'DECORATION',
  TREE = 'TREE',
  EFFECT = 'EFFECT',
}

export enum FarmGardenDisplayMode {
  ALWAYS = 'ALWAYS',
  DAY_ONLY = 'DAY_ONLY',
  NIGHT_ONLY = 'NIGHT_ONLY',
}

export enum FarmGardenDeviceMode {
  ALL = 'ALL',
  DESKTOP_ONLY = 'DESKTOP_ONLY',
  MOBILE_ONLY = 'MOBILE_ONLY',
}

export class GardenAnimationConfigDto {
  @IsOptional()
  @IsString()
  preset?: string;

  @IsOptional()
  @IsNumber()
  duration?: number;

  @IsOptional()
  @IsNumber()
  delay?: number;

  @IsOptional()
  @IsNumber()
  amplitudeX?: number;

  @IsOptional()
  @IsNumber()
  amplitudeY?: number;

  @IsOptional()
  @IsNumber()
  rotationAmplitude?: number;

  @IsOptional()
  @IsNumber()
  scaleAmplitude?: number;

  @IsOptional()
  @IsNumber()
  glowIntensity?: number;

  @IsOptional()
  @IsString()
  direction?: string;

  @IsOptional()
  iterationCount?: number | string;

  @IsOptional()
  @IsString()
  timingFunction?: string;

  @IsOptional()
  @IsBoolean()
  randomDelay?: boolean;

  @IsOptional()
  @IsString()
  trigger?: string;

  @IsOptional()
  @IsBoolean()
  staticBaseEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  staticBaseRatio?: number;

  @IsOptional()
  @IsNumber()
  swayPivotX?: number;

  @IsOptional()
  @IsNumber()
  swayPivotY?: number;
}

export class GardenObjectDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  objectKey: string;

  @IsEnum(FarmGardenObjectType)
  objectType: FarmGardenObjectType;

  @IsOptional()
  @IsString()
  assetId?: string | null;

  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @IsNumber()
  plotIndex?: number | null;

  @IsOptional()
  @IsString()
  name?: string | null;

  @IsNumber()
  positionX: number;

  @IsNumber()
  positionY: number;

  @IsNumber()
  width: number;

  @IsNumber()
  height: number;

  @IsOptional()
  @IsNumber()
  scaleX?: number;

  @IsOptional()
  @IsNumber()
  scaleY?: number;

  @IsOptional()
  @IsNumber()
  rotation?: number;

  @IsOptional()
  @IsNumber()
  opacity?: number;

  @IsOptional()
  @IsNumber()
  zIndex?: number;

  @IsOptional()
  @IsNumber()
  anchorX?: number;

  @IsOptional()
  @IsNumber()
  anchorY?: number;

  @IsOptional()
  @IsBoolean()
  flipX?: boolean;

  @IsOptional()
  @IsBoolean()
  flipY?: boolean;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  @IsOptional()
  @IsBoolean()
  isLocked?: boolean;

  @IsOptional()
  @IsEnum(FarmGardenDisplayMode)
  displayMode?: FarmGardenDisplayMode;

  @IsOptional()
  @IsEnum(FarmGardenDeviceMode)
  deviceMode?: FarmGardenDeviceMode;

  @IsOptional()
  animationConfig?: GardenAnimationConfigDto | Record<string, unknown> | null;

  @IsOptional()
  styleConfig?: Record<string, unknown> | null;

  @IsOptional()
  startAt?: string | null;

  @IsOptional()
  endAt?: string | null;
}

export class CreateLayoutDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class SaveDraftLayoutDto {
  @IsNumber()
  revision: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GardenObjectDto)
  objects: GardenObjectDto[];
}

export class PublishLayoutDto {
  @IsNumber()
  revision: number;
}

export class RollbackLayoutDto {
  @IsString()
  targetVersionId: string;
}

export class UploadGardenAssetDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsString()
  category: string;

  @IsOptional()
  @IsNumber()
  defaultAnchorX?: number;

  @IsOptional()
  @IsNumber()
  defaultAnchorY?: number;

  @IsOptional()
  @IsNumber()
  defaultScale?: number;
}

export class UpdateGardenAssetDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumber()
  defaultAnchorX?: number;

  @IsOptional()
  @IsNumber()
  defaultAnchorY?: number;

  @IsOptional()
  @IsNumber()
  defaultScale?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
