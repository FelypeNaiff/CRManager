import { Router } from 'express';
import { healthController } from '../controllers/health.controller';
import { authRouter } from './auth.routes';
import { crmRouter } from './crm.routes';
import { modulesRouter } from './modules.routes';
import { authenticate } from '../middlewares/auth.middleware';
import { tenantGuard } from '../middlewares/tenant.middleware';

export const apiRouter = Router();

apiRouter.get('/health', healthController);
apiRouter.use('/auth', authRouter);
apiRouter.use(authenticate, tenantGuard);
apiRouter.use('/crm', crmRouter);
apiRouter.use('/modules', modulesRouter);
