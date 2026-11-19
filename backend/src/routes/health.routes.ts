import express from 'express';
import type { Router } from 'express';
import type { AppConfig } from '../config/env.ts';
import type { ReadinessCheck } from '../controllers/health.controller.ts';
import { createHealthController } from '../controllers/health.controller.ts';

export function createHealthRouter(config: AppConfig, readiness?: ReadinessCheck): Router {
  const router = express.Router();

  router.get('/health', createHealthController(config, readiness));

  return router;
}
