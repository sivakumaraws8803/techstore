import {
    createCustomerOrder,
    getCustomerOrders,
    getAllOrders,
    updateOrderStatus
} from '../services/orders.service.js';

export async function createOrder(req, res, next) {
    try {
        const order = await createCustomerOrder(req.session.user.id, req.body.items);
        res.status(201).json({ message: 'Order placed successfully', order });
    } catch (error) {
        next(error);
    }
}

export async function myOrders(req, res, next) {
    try {
        const orders = await getCustomerOrders(req.session.user.id);
        res.json({ orders });
    } catch (error) {
        next(error);
    }
}

export async function allOrders(req, res, next) {
    try {
        const orders = await getAllOrders();
        res.json({ orders });
    } catch (error) {
        next(error);
    }
}

export async function changeOrderStatus(req, res, next) {
    try {
        const id = Number(req.params.id);

        if (!Number.isSafeInteger(id) || id <= 0) {
            return res.status(400).json({ error: 'Invalid order ID' });
        }

        const order = await updateOrderStatus(id, req.body.status);
        res.json({ message: 'Order status updated', order });
    } catch (error) {
        next(error);
    }
}
