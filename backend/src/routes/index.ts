import express from 'express';
import type { Router } from 'express';
import type { AppConfig } from '../config/env.ts';
import type { ReadinessCheck } from '../controllers/health.controller.ts';
import { createHealthRouter } from './health.routes.ts';

export function createApiRouter(config: AppConfig, readiness?: ReadinessCheck): Router {
  const router = express.Router();

  // Slice 1 / phase 11 mounts the health router only. Future-slice routers are added
  // when their phase starts.
  router.use(createHealthRouter(config, readiness));

  return router;
}
