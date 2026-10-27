import { Router } from 'express';

import {
    createUserHandler,
    listUsersHandler,
    updateUserRoleHandler,
    deactivateUserHandler
} from '../controllers/users.controller.js';

import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();

router.use(requireAuth, requireRole('owner'));

router.post('/', createUserHandler);
router.get('/', listUsersHandler);
router.patch('/:id/role', updateUserRoleHandler);
router.patch('/:id/deactivate', deactivateUserHandler);

export default router;
