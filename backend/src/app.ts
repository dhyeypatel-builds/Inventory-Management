import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { errorHandler } from './middleware/error';
import { rateLimiter } from './middleware/rateLimit';
import { requestLogger } from './middleware/requestLogger';
import { success } from './utils/apiResponse';
import { NotFoundError } from './utils/errors';

import { authRouter } from './modules/auth/auth.routes';
import { brandsRouter } from './modules/catalog/brands.routes';
import { categoriesRouter } from './modules/catalog/categories.routes';
import { productTypesRouter } from './modules/catalog/productTypes.routes';
import { productsRouter, variantsRouter } from './modules/products/products.routes';
import { inventoryRouter } from './modules/inventory/inventory.routes';
import { customersRouter } from './modules/customers/customers.routes';
import { salesRouter } from './modules/sales/sales.routes';
import { purchasesRouter, vendorsRouter, serialsRouter } from './modules/purchases/purchases.routes';
import { alertsRouter } from './modules/alerts/alerts.routes';
import { dashboardRouter } from './modules/dashboard/dashboard.routes';
import { reportsRouter } from './modules/reports/reports.routes';
import { settingsRouter } from './modules/settings/settings.routes';
import { platformRouter } from './modules/platform/platform.routes';
import { uploadsRouter } from './modules/uploads/uploads.routes';
import { teamRouter } from './modules/team/team.routes';
import { onboardingRouter } from './modules/onboarding/onboarding.routes';

export const app = express();

// ── Security / request parsing ──────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGINS.split(',').map((o) => o.trim()),
    credentials: true,
  }),
);
app.use(requestLogger);
app.use(rateLimiter);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Health ───────────────────────────────────────────────────────────────────
app.get('/api/v1/health', (_req, res) => {
  success(res, { status: 'ok', timestamp: new Date().toISOString() });
});

// ── Module routes ────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/brands', brandsRouter);
app.use('/api/v1/categories', categoriesRouter);
app.use('/api/v1/product-types', productTypesRouter);
app.use('/api/v1/products', productsRouter);
app.use('/api/v1/variants', variantsRouter);
app.use('/api/v1/inventory', inventoryRouter);
app.use('/api/v1/customers', customersRouter);
app.use('/api/v1/sales', salesRouter);
app.use('/api/v1/purchases', purchasesRouter);
app.use('/api/v1/vendors', vendorsRouter);
app.use('/api/v1/serials', serialsRouter);
app.use('/api/v1/alerts', alertsRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/reports', reportsRouter);
app.use('/api/v1/settings', settingsRouter);
app.use('/api/v1/platform', platformRouter);
app.use('/api/v1/uploads', uploadsRouter);
app.use('/api/v1/team', teamRouter);
app.use('/api/v1/onboarding', onboardingRouter);

// ── 404 catch-all ────────────────────────────────────────────────────────────
app.use((_req, _res, next) => {
  next(new NotFoundError('Route'));
});

// ── Central error handler (must be last) ─────────────────────────────────────
app.use(errorHandler);
