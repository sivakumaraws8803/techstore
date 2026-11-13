import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import {
    createOrder,
    myOrders,
    allOrders,
    changeOrderStatus
} from '../controllers/orders.controller.js';

const router = Router();

router.post('/', requireAuth, requireRole('customer'), createOrder);
router.get('/my', requireAuth, requireRole('customer'), myOrders);
router.get('/', requireAuth, requireRole('owner', 'product_manager'), allOrders);
router.patch('/:id/status', requireAuth, requireRole('owner', 'product_manager'), changeOrderStatus);

export default router;
