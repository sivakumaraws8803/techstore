import { pool } from '../config/database.js';

export async function createCustomerOrder(customerId, items) {
    if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
        throw Object.assign(new Error('Provide 1 to 50 order items'), { status: 400 });
    }

    const quantities = new Map();

    for (const item of items) {
        const productId = Number(item.productId);
        const quantity = Number(item.quantity);

        if (!Number.isSafeInteger(productId) || productId <= 0 ||
            !Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 1000) {
            throw Object.assign(new Error('Invalid product ID or quantity'), { status: 400 });
        }

        quantities.set(productId, (quantities.get(productId) || 0) + quantity);
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const productIds = [...quantities.keys()].sort((a, b) => a - b);

        const result = await client.query(
            `SELECT id, name, price, stock, is_active
             FROM products
             WHERE id = ANY($1::bigint[])
             ORDER BY id
             FOR UPDATE`,
            [productIds]
        );

        if (result.rows.length !== productIds.length) {
            throw Object.assign(new Error('One or more products were not found'), { status: 400 });
        }

        let totalCents = 0n;

        const orderItems = result.rows.map(product => {
            const quantity = quantities.get(Number(product.id));

            if (!product.is_active) {
                throw Object.assign(new Error(`${product.name} is unavailable`), { status: 400 });
            }

            if (product.stock < quantity) {
                throw Object.assign(new Error(`Insufficient stock for ${product.name}`), { status: 400 });
            }

            const cents = BigInt(String(product.price).replace('.', '').padEnd(0, '0'));
            const priceCents = BigInt(Math.round(Number(product.price) * 100));

            totalCents += priceCents * BigInt(quantity);

            return {
                productId: product.id,
                name: product.name,
                quantity,
                price: product.price
            };
        });

        const totalAmount = (totalCents / 100n).toString() + '.' +
            (totalCents % 100n).toString().padStart(2, '0');

        const orderResult = await client.query(
            `INSERT INTO orders (customer_id, status, total_amount)
             VALUES ($1, 'pending', $2)
             RETURNING id, customer_id, status, total_amount, created_at`,
            [customerId, totalAmount]
        );

        const order = orderResult.rows[0];

        for (const item of orderItems) {
            await client.query(
                `INSERT INTO order_items
                 (order_id, product_id, product_name, quantity, unit_price)
                 VALUES ($1, $2, $3, $4, $5)`,
                [order.id, item.productId, item.name, item.quantity, item.price]
            );

            await client.query(
                'UPDATE products SET stock = stock - $1 WHERE id = $2',
                [item.quantity, item.productId]
            );
        }

        await client.query('COMMIT');

        return { ...order, items: orderItems };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

export async function getCustomerOrders(customerId) {
    const result = await pool.query(
        `SELECT o.id, o.status, o.payment_status, o.total_amount, o.created_at,
                oi.product_id, oi.product_name, oi.quantity, oi.unit_price
         FROM orders o
         LEFT JOIN order_items oi ON oi.order_id = o.id
         WHERE o.customer_id = $1
         ORDER BY o.created_at DESC, oi.id`,
        [customerId]
    );

    return groupOrders(result.rows);
}

export async function getAllOrders() {
    const result = await pool.query(
        `SELECT o.id, o.customer_id, u.username, o.status, o.payment_status,
                o.total_amount, o.created_at,
                oi.product_id, oi.product_name, oi.quantity, oi.unit_price
         FROM orders o
         JOIN users u ON u.id = o.customer_id
         LEFT JOIN order_items oi ON oi.order_id = o.id
         ORDER BY o.created_at DESC, oi.id`
    );

    return groupOrders(result.rows);
}

function groupOrders(rows) {
    const orders = new Map();

    for (const row of rows) {
        if (!orders.has(row.id)) {
            orders.set(row.id, {
                id: row.id,
                customer_id: row.customer_id,
                username: row.username,
                status: row.status,
                total_amount: row.total_amount,
                created_at: row.created_at,
                items: []
            });
        }

        if (row.product_id !== null) {
            orders.get(row.id).items.push({
                product_id: row.product_id,
                product_name: row.product_name,
                quantity: row.quantity,
                unit_price: row.unit_price
            });
        }
    }

    return [...orders.values()];
}

export async function updateOrderStatus(orderId, status) {
    const allowed = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

    if (!allowed.includes(status)) {
        throw Object.assign(new Error('Invalid order status'), { status: 400 });
    }

    const result = await pool.query(
        `UPDATE orders SET status = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, status, total_amount, created_at`,
        [status, orderId]
    );

    if (!result.rowCount) {
        throw Object.assign(new Error('Order not found'), { status: 404 });
    }

    return result.rows[0];
}
