import * as Phaser from 'phaser';
import { ISOMETRIC_CONFIG } from '../config/FarmMapConfig';
import { FarmWorldLayoutConfig } from '../config/FarmWorldLayoutConfig';
import { farmEventBus } from '../services/farmEventBus';
import { getFarmUIPreferences, saveFarmUIPreferences } from '../../utils/farmPreferences';

// Cấu hình riêng biệt cho Camera DESKTOP (bảo tồn nguyên vẹn 100% logic hiện tại)
export const DESKTOP_CAMERA_CONFIG = {
  MIN_ZOOM: ISOMETRIC_CONFIG.CAMERA?.MIN_ZOOM ?? 0.40,
  MAX_ZOOM: ISOMETRIC_CONFIG.CAMERA?.MAX_ZOOM ?? 1.85,
  DEFAULT_ZOOM: ISOMETRIC_CONFIG.CAMERA?.DEFAULT_ZOOM ?? 0.82,
  DEFAULT_CENTER_X: ISOMETRIC_CONFIG.CAMERA?.DEFAULT_CENTER_X ?? -180,
  DEFAULT_CENTER_Y: ISOMETRIC_CONFIG.CAMERA?.DEFAULT_CENTER_Y ?? 220,
};

// Cấu hình riêng biệt cho Camera MOBILE (Pinch zoom siêu nhỏ, pan 4 hướng không kẹt)
export const MOBILE_CAMERA_CONFIG = {
  WORLD_MIN_X: -1120,
  WORLD_MAX_X: 680,
  WORLD_MIN_Y: -380,
  WORLD_MAX_Y: 820,
  WORLD_WIDTH: 1800,
  WORLD_HEIGHT: 1200,
  WORLD_CENTER_X: -220,
  WORLD_CENTER_Y: 220,
  MIN_SCALE_FACTOR: 0.70, // Cho phép thu nhỏ sâu hơn fitScale (0.65 - 0.75)
  MAX_SCALE: 1.35,        // Giới hạn phóng to hợp lý, bảo vệ pixel art và bounds
};

export class CameraControls {
  private scene: Phaser.Scene;
  public camera: Phaser.Cameras.Scene2D.Camera;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;

  // Multi-touch pinch tracking
  public isPinching = false;
  private pinchJustEndedUntil = 0;
  private prevPinchDistance = 0;
  private prevPinchMidpoint: { x: number; y: number } | null = null;

  private isInputBlocked = false;
  private saveDebounceTimer: any = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.camera = scene.cameras.main;
    this.setupControls();

    // Re-center and adjust zoom on resize / orientation change
    this.scene.scale.on('resize', () => {
      this.handleResize();
    });

    // Listen for reset camera event from HUD / Nav
    farmEventBus.on('RESET_CAMERA', () => {
      this.resetCameraToDefault();
    });
  }

  /**
   * Nhận diện thiết bị cảm ứng / Mobile (chỉ áp dụng gesture pinch cho mobile)
   */
  public isMobileDevice(): boolean {
    if (typeof window === 'undefined') return false;
    if ((window as any).__AVORA_FORCE_MOBILE_CAMERA) return true;
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    return isMobileUA || (isTouch && window.innerWidth < 1024);
  }

  /**
   * Tính toán giới hạn scale động theo kích thước viewport thực tế trên Mobile
   */
  public getMobileScaleLimits() {
    const { width, height } = this.scene.scale;
    const fitScaleX = width / MOBILE_CAMERA_CONFIG.WORLD_WIDTH;
    const fitScaleY = height / MOBILE_CAMERA_CONFIG.WORLD_HEIGHT;
    const fitScale = Math.min(fitScaleX, fitScaleY);

    // MOBILE_MIN_SCALE: Cho phép nhìn bao quát toàn bộ hòn đảo + lưới trồng trọt
    const minScale = Phaser.Math.Clamp(
      Number((fitScale * MOBILE_CAMERA_CONFIG.MIN_SCALE_FACTOR).toFixed(3)),
      0.20,
      0.38
    );
    const maxScale = MOBILE_CAMERA_CONFIG.MAX_SCALE;
    const defaultScale = Phaser.Math.Clamp(
      Number(Math.max(minScale * 1.35, Math.min(fitScale * 1.25, 0.65)).toFixed(3)),
      minScale,
      maxScale
    );

    return {
      fitScale,
      minScale,
      maxScale,
      defaultScale,
    };
  }

  public getOptimalZoom(): number {
    if (this.isMobileDevice()) {
      return this.getMobileScaleLimits().defaultScale;
    }
    const { width, height } = this.scene.scale;
    // On desktop, keep exact previous behavior
    const targetW = 1150;
    const targetH = 700;
    const zoomX = (width * 0.94) / targetW;
    const zoomY = (height * 0.90) / targetH;
    const optimal = Math.min(zoomX, zoomY);
    return Phaser.Math.Clamp(optimal, 0.50, 1.25);
  }

  public setInputBlocked(blocked: boolean) {
    this.isInputBlocked = blocked;
    if (blocked) {
      this.isDragging = false;
      this.isPinching = false;
      this.prevPinchDistance = 0;
      this.prevPinchMidpoint = null;
    }
  }

  private scheduleSaveCamera() {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }
    this.saveDebounceTimer = setTimeout(() => {
      saveFarmUIPreferences({
        cameraZoom: Number(this.camera.zoom.toFixed(3)),
        cameraScrollX: Math.round(this.camera.scrollX),
        cameraScrollY: Math.round(this.camera.scrollY),
      });
    }, 400);
  }

  private setupControls() {
    const isMobile = this.isMobileDevice();
    const saved = getFarmUIPreferences();

    const limits = isMobile
      ? this.getMobileScaleLimits()
      : {
          minScale: DESKTOP_CAMERA_CONFIG.MIN_ZOOM,
          maxScale: DESKTOP_CAMERA_CONFIG.MAX_ZOOM,
          defaultScale: this.getOptimalZoom(),
        };

    const initialZoom =
      saved.cameraZoom && saved.cameraZoom >= limits.minScale && saved.cameraZoom <= limits.maxScale
        ? saved.cameraZoom
        : limits.defaultScale;

    this.camera.setZoom(initialZoom);

    if (typeof saved.cameraScrollX === 'number' && typeof saved.cameraScrollY === 'number') {
      this.camera.scrollX = saved.cameraScrollX;
      this.camera.scrollY = saved.cameraScrollY;
      this.clampCameraBounds();
    }

    // Ensure Phaser has at least 3 active touch pointers for multi-touch
    try {
      if ((this.scene.input as any).totalPointers < 3) {
        this.scene.input.addPointer(2);
      }
    } catch {}

    // 1. Pointer Down
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isInputBlocked) return;

      const p1 = this.scene.input.pointer1;
      const p2 = this.scene.input.pointer2;

      // Two fingers down -> start pinch zoom immediately without jump
      if (p1?.isDown && p2?.isDown) {
        this.isDragging = false;
        this.isPinching = true;
        this.prevPinchDistance = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        this.prevPinchMidpoint = {
          x: (p1.x + p2.x) / 2,
          y: (p1.y + p2.y) / 2,
        };
        return;
      }

      // If pinch just ended in last 200ms, ignore accidental drag
      if (Date.now() < this.pinchJustEndedUntil) return;

      // Single finger / mouse drag
      this.isDragging = true;
      this.dragStartX = pointer.x;
      this.dragStartY = pointer.y;
    });

    // 2. Pointer Move
    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isInputBlocked) return;

      const p1 = this.scene.input.pointer1;
      const p2 = this.scene.input.pointer2;

      // Two-Finger Pinch Zoom with Focal-Point preservation
      if (p1?.isDown && p2?.isDown) {
        this.isDragging = false;
        this.isPinching = true;

        const currentDist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        const currentMid = {
          x: (p1.x + p2.x) / 2,
          y: (p1.y + p2.y) / 2,
        };

        if (this.prevPinchDistance > 0 && this.prevPinchMidpoint) {
          const oldZoom = this.camera.zoom;
          const zoomRatio = currentDist / this.prevPinchDistance;

          const { minScale, maxScale } = this.isMobileDevice()
            ? this.getMobileScaleLimits()
            : {
                minScale: DESKTOP_CAMERA_CONFIG.MIN_ZOOM,
                maxScale: DESKTOP_CAMERA_CONFIG.MAX_ZOOM,
              };

          const newZoom = Phaser.Math.Clamp(oldZoom * zoomRatio, minScale, maxScale);

          if (
            Math.abs(newZoom - oldZoom) > 0.0005 ||
            Math.abs(currentMid.x - this.prevPinchMidpoint.x) > 0.5 ||
            Math.abs(currentMid.y - this.prevPinchMidpoint.y) > 0.5
          ) {
            // World coordinate currently anchored under the previous midpoint
            const camMidX = this.camera.scrollX + this.camera.width / 2;
            const camMidY = this.camera.scrollY + this.camera.height / 2;
            const worldUnderMidX = camMidX + (this.prevPinchMidpoint.x - this.camera.width / 2) / oldZoom;
            const worldUnderMidY = camMidY + (this.prevPinchMidpoint.y - this.camera.height / 2) / oldZoom;

            // Apply new zoom
            this.camera.setZoom(newZoom);

            // Shift camera scroll so the world point stays anchored under the current midpoint
            this.camera.scrollX = worldUnderMidX - this.camera.width / 2 - (currentMid.x - this.camera.width / 2) / newZoom;
            this.camera.scrollY = worldUnderMidY - this.camera.height / 2 - (currentMid.y - this.camera.height / 2) / newZoom;

            this.clampCameraBounds();
            farmEventBus.emit('CAMERA_MOVED');
          }
        }

        this.prevPinchDistance = currentDist;
        this.prevPinchMidpoint = currentMid;
        return;
      }

      // If we were pinching and fingers lifted / reduced to 1 finger
      if (this.isPinching) {
        this.isPinching = false;
        this.pinchJustEndedUntil = Date.now() + 200;
        this.prevPinchDistance = 0;
        this.prevPinchMidpoint = null;

        // Seamless 2 fingers -> 1 finger: transfer smoothly into single finger drag without jump
        const remainingPointer = p1?.isDown ? p1 : p2?.isDown ? p2 : null;
        if (remainingPointer) {
          this.isDragging = true;
          this.dragStartX = remainingPointer.x;
          this.dragStartY = remainingPointer.y;
          return;
        }
      }

      // Single-finger / Mouse Pan
      if (this.isDragging && pointer.isDown && Date.now() >= this.pinchJustEndedUntil) {
        const dx = (pointer.x - this.dragStartX) / this.camera.zoom;
        const dy = (pointer.y - this.dragStartY) / this.camera.zoom;

        if (Math.abs(dx) > 0.2 || Math.abs(dy) > 0.2) {
          this.camera.scrollX -= dx;
          this.camera.scrollY -= dy;

          this.dragStartX = pointer.x;
          this.dragStartY = pointer.y;

          this.clampCameraBounds();
          farmEventBus.emit('CAMERA_MOVED');
        }
      }
    });

    // 3. Pointer Up
    this.scene.input.on('pointerup', () => {
      if (this.isPinching) {
        this.isPinching = false;
        this.pinchJustEndedUntil = Date.now() + 200;
      }
      this.isDragging = false;
      this.prevPinchDistance = 0;
      this.prevPinchMidpoint = null;
      this.scheduleSaveCamera();
    });

    // 4. Desktop Mouse Wheel Zoom (Focal-point anchored to cursor - DESKTOP ONLY)
    this.scene.input.on('wheel', (pointer: Phaser.Input.Pointer, _gameObjects: any, _deltaX: number, deltaY: number) => {
      if (this.isInputBlocked) return;

      const oldZoom = this.camera.zoom;
      const factor = deltaY > 0 ? 0.90 : 1.10;
      const minZ = DESKTOP_CAMERA_CONFIG.MIN_ZOOM;
      const maxZ = DESKTOP_CAMERA_CONFIG.MAX_ZOOM;
      const newZoom = Phaser.Math.Clamp(oldZoom * factor, minZ, maxZ);

      if (Math.abs(newZoom - oldZoom) > 0.001) {
        const camMidX = this.camera.scrollX + this.camera.width / 2;
        const camMidY = this.camera.scrollY + this.camera.height / 2;
        const worldX = camMidX + (pointer.x - this.camera.width / 2) / oldZoom;
        const worldY = camMidY + (pointer.y - this.camera.height / 2) / oldZoom;

        this.camera.setZoom(newZoom);
        this.camera.scrollX = worldX - this.camera.width / 2 - (pointer.x - this.camera.width / 2) / newZoom;
        this.camera.scrollY = worldY - this.camera.height / 2 - (pointer.y - this.camera.height / 2) / newZoom;

        this.clampCameraBounds();
        farmEventBus.emit('CAMERA_MOVED');
        this.scheduleSaveCamera();
      }
    });
  }

  /**
   * Giới hạn camera bounds trên Desktop: Giữ nguyên 100% logic ban đầu
   */
  private clampDesktopCameraBounds() {
    const zoom = Math.max(0.35, this.camera.zoom);
    const boundW = Math.max(350, Math.round(900 * Math.min(1, zoom / 0.65)));
    const boundH = Math.max(280, Math.round(700 * Math.min(1, zoom / 0.65)));
    this.camera.scrollX = Phaser.Math.Clamp(this.camera.scrollX, -boundW, boundW);
    this.camera.scrollY = Phaser.Math.Clamp(this.camera.scrollY, -boundH, boundH);
  }

  /**
   * Giới hạn camera bounds trên Mobile:
   * Tính toán bounds động theo kích thước viewport và scale hiện tại.
   * TUYỆT ĐỐI KHÔNG KHÓA ĐẢO SANG PHẢI Ở MINIMUM ZOOM.
   * Cho phép kéo tự do 4 hướng: ← trái, → phải, ↑ lên, ↓ xuống.
   */
  private clampMobileCameraBounds() {
    const viewportW = this.camera.width;
    const viewportH = this.camera.height;
    const zoom = Math.max(0.15, this.camera.zoom);

    const visibleW = viewportW / zoom;
    const visibleH = viewportH / zoom;
    const marginX = 60 / zoom;
    const marginY = 60 / zoom;

    const {
      WORLD_MIN_X,
      WORLD_MAX_X,
      WORLD_MIN_Y,
      WORLD_MAX_Y,
      WORLD_WIDTH,
      WORLD_HEIGHT,
      WORLD_CENTER_X,
      WORLD_CENTER_Y,
    } = MOBILE_CAMERA_CONFIG;

    let minCenterX: number;
    let maxCenterX: number;

    if (visibleW >= WORLD_WIDTH) {
      // Ở mức thu nhỏ sâu (minimum zoom), hòn đảo nằm trọn trong viewport.
      // Cho phép kéo di chuyển hòn đảo thoải mái sang PHẢI, TRÁI mà không bị kẹt!
      const panSpanX = Math.max(350, (visibleW - WORLD_WIDTH) / 2 + 350);
      minCenterX = WORLD_CENTER_X - panSpanX;
      maxCenterX = WORLD_CENTER_X + panSpanX;
    } else {
      // Khi phóng to (zoomed in), cho phép duyệt từ cạnh trái sang cạnh phải thế giới
      minCenterX = WORLD_MIN_X - marginX + visibleW / 2;
      maxCenterX = WORLD_MAX_X + marginX - visibleW / 2;
      if (minCenterX > maxCenterX) {
        const mid = (minCenterX + maxCenterX) / 2;
        minCenterX = mid - 120;
        maxCenterX = mid + 120;
      }
    }

    let minCenterY: number;
    let maxCenterY: number;

    if (visibleH >= WORLD_HEIGHT) {
      const panSpanY = Math.max(250, (visibleH - WORLD_HEIGHT) / 2 + 250);
      minCenterY = WORLD_CENTER_Y - panSpanY;
      maxCenterY = WORLD_CENTER_Y + panSpanY;
    } else {
      minCenterY = WORLD_MIN_Y - marginY + visibleH / 2;
      maxCenterY = WORLD_MAX_Y + marginY - visibleH / 2;
      if (minCenterY > maxCenterY) {
        const midY = (minCenterY + maxCenterY) / 2;
        minCenterY = midY - 100;
        maxCenterY = midY + 100;
      }
    }

    // Chuyển đổi bounds từ World Center sang Camera Scroll
    const minScrollX = minCenterX - viewportW / 2;
    const maxScrollX = maxCenterX - viewportW / 2;
    const minScrollY = minCenterY - viewportH / 2;
    const maxScrollY = maxCenterY - viewportH / 2;

    this.camera.scrollX = Phaser.Math.Clamp(this.camera.scrollX, minScrollX, maxScrollX);
    this.camera.scrollY = Phaser.Math.Clamp(this.camera.scrollY, minScrollY, maxScrollY);
  }

  public clampCameraBounds() {
    if (this.isMobileDevice()) {
      this.clampMobileCameraBounds();
    } else {
      this.clampDesktopCameraBounds();
    }
  }

  public handleResize() {
    const isMobile = this.isMobileDevice();
    const limits = isMobile
      ? this.getMobileScaleLimits()
      : {
          minScale: DESKTOP_CAMERA_CONFIG.MIN_ZOOM,
          maxScale: DESKTOP_CAMERA_CONFIG.MAX_ZOOM,
          defaultScale: this.getOptimalZoom(),
        };

    if (this.camera.zoom < limits.minScale) {
      this.camera.setZoom(limits.minScale);
    } else if (this.camera.zoom > limits.maxScale) {
      this.camera.setZoom(limits.maxScale);
    }

    this.clampCameraBounds();
    farmEventBus.emit('CAMERA_MOVED');
  }

  /**
   * Reset camera smoothly to default center & optimal zoom
   */
  public resetCameraToDefault(duration = 450) {
    const defaultX = this.isMobileDevice()
      ? MOBILE_CAMERA_CONFIG.WORLD_CENTER_X
      : DESKTOP_CAMERA_CONFIG.DEFAULT_CENTER_X;
    const defaultY = this.isMobileDevice()
      ? MOBILE_CAMERA_CONFIG.WORLD_CENTER_Y
      : DESKTOP_CAMERA_CONFIG.DEFAULT_CENTER_Y;
    const targetZoom = this.getOptimalZoom();

    this.scene.tweens.add({
      targets: this.camera,
      scrollX: defaultX - this.camera.width / 2,
      scrollY: defaultY - this.camera.height / 2,
      zoom: targetZoom,
      duration,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        farmEventBus.emit('CAMERA_MOVED');
      },
      onComplete: () => {
        this.scheduleSaveCamera();
      },
    });
  }

  /**
   * Focus camera smoothly on specific plot or object
   */
  public focusOnPlot(targetX: number, targetY: number, duration = 400) {
    this.scene.tweens.add({
      targets: this.camera,
      scrollX: targetX - this.camera.width / 2,
      scrollY: targetY - this.camera.height / 2,
      duration,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        farmEventBus.emit('CAMERA_MOVED');
      },
    });
  }

  /**
   * Initial center on world (Restores saved position if available)
   */
  public centerOnWorld(
    worldCenterX = ISOMETRIC_CONFIG.CAMERA?.DEFAULT_CENTER_X ?? -180,
    worldCenterY = ISOMETRIC_CONFIG.CAMERA?.DEFAULT_CENTER_Y ?? 220,
    duration = 0,
    force = false
  ) {
    const isMobile = this.isMobileDevice();
    const saved = getFarmUIPreferences();
    const limits = isMobile
      ? this.getMobileScaleLimits()
      : {
          minScale: DESKTOP_CAMERA_CONFIG.MIN_ZOOM,
          maxScale: DESKTOP_CAMERA_CONFIG.MAX_ZOOM,
          defaultScale: this.getOptimalZoom(),
        };

    if (
      !force &&
      duration === 0 &&
      typeof saved.cameraScrollX === 'number' &&
      typeof saved.cameraScrollY === 'number'
    ) {
      this.camera.scrollX = saved.cameraScrollX;
      this.camera.scrollY = saved.cameraScrollY;
      if (saved.cameraZoom && saved.cameraZoom >= limits.minScale && saved.cameraZoom <= limits.maxScale) {
        this.camera.setZoom(saved.cameraZoom);
      } else {
        this.camera.setZoom(limits.defaultScale);
      }
      this.clampCameraBounds();
      farmEventBus.emit('CAMERA_MOVED');
      return;
    }

    const targetX = worldCenterX - this.camera.width / 2;
    const targetY = worldCenterY - this.camera.height / 2;

    if (duration === 0) {
      this.camera.scrollX = targetX;
      this.camera.scrollY = targetY;
      this.camera.setZoom(limits.defaultScale);
      this.clampCameraBounds();
      farmEventBus.emit('CAMERA_MOVED');
    } else {
      this.scene.tweens.add({
        targets: this.camera,
        scrollX: targetX,
        scrollY: targetY,
        zoom: limits.defaultScale,
        duration,
        ease: 'Cubic.easeOut',
        onUpdate: () => {
          farmEventBus.emit('CAMERA_MOVED');
        },
      });
    }
  }
}
