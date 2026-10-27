import { Router } from 'express';

import {
    listProductsHandler,
    getProductHandler,
    createProductHandler,
    updateProductHandler,
    deactivateProductHandler
} from '../controllers/products.controller.js';

import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();

// Public customers can view active products.
router.get('/', listProductsHandler);
router.get('/:id', getProductHandler);

// Only authenticated owners and product managers can add or edit products.
router.post(
    '/',
    requireAuth,
    requireRole('owner', 'product_manager'),
    createProductHandler
);

router.put(
    '/:id',
    requireAuth,
    requireRole('owner', 'product_manager'),
    updateProductHandler
);

// Only the owner can deactivate products.
router.patch(
    '/:id/deactivate',
    requireAuth,
    requireRole('owner'),
    deactivateProductHandler
);

export default router;
