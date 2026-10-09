'use client';

import React, { useEffect, useRef } from 'react';
import type * as Phaser from 'phaser';

import { farmEventBus } from '../../game/services/farmEventBus';
import type { FarmTheme } from '../../utils/farmPreferences';

interface FarmCanvasProps {
  onGameReady?: (game: Phaser.Game) => void;
  theme?: FarmTheme;
  containerId?: string;
  editorMode?: boolean;
  layoutData?: any;
}

export default function FarmCanvas({
  onGameReady,
  theme = 'DAY',
  containerId = 'avora-farm-canvas-container',
  editorMode = false,
  layoutData,
}: FarmCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const onGameReadyRef = useRef(onGameReady);
  onGameReadyRef.current = onGameReady;

  useEffect(() => {
    let isMounted = true;

    async function initPhaser() {
      if (!containerRef.current || gameRef.current) return;

      const { createAvoraFarmGame } = await import('../../game/AvoraFarmGame');

      if (!isMounted) return;

      const game = createAvoraFarmGame(containerId);
      gameRef.current = game;

      if (onGameReadyRef.current) {
        onGameReadyRef.current(game);
      }
    }

    initPhaser();

    return () => {
      isMounted = false;
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [containerId]);

  // Synchronize layout data
  useEffect(() => {
    if (layoutData) {
      farmEventBus.emit('SET_GARDEN_LAYOUT', { layout: layoutData, editorMode });
    }

    const unsubSceneReady = farmEventBus.on('SCENE_READY', () => {
      if (layoutData) {
        farmEventBus.emit('SET_GARDEN_LAYOUT', { layout: layoutData, editorMode });
      }
    });

    const unsubReq = farmEventBus.on('REQUEST_GARDEN_LAYOUT', () => {
      if (layoutData) {
        farmEventBus.emit('SET_GARDEN_LAYOUT', { layout: layoutData, editorMode });
      }
    });

    return () => {
      unsubSceneReady();
      unsubReq();
    };
  }, [layoutData, editorMode]);

  // Synchronize editor mode
  useEffect(() => {
    farmEventBus.emit('SET_EDITOR_MODE', editorMode);
  }, [editorMode]);

  return (
    <div
      id={containerId}
      ref={containerRef}
      className="w-full h-full absolute inset-0 overflow-hidden select-none pointer-events-auto"
      style={{ touchAction: 'none' }}
    />
  );
}

