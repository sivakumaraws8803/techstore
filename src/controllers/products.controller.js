import {
    listActiveProducts,
    findProductById,
    addProduct,
    editProduct,
    deactivateProduct
} from '../services/products.service.js';

function parseProductId(value) {
    const id = Number(value);

    if (!Number.isSafeInteger(id) || id < 1) {
        return null;
    }

    return id;
}

export async function listProductsHandler(req, res, next) {
    try {
        const products = await listActiveProducts();
        res.json({ products });
    } catch (error) {
        next(error);
    }
}

export async function getProductHandler(req, res, next) {
    try {
        const id = parseProductId(req.params.id);

        if (!id) {
            return res.status(400).json({ error: 'Invalid product ID' });
        }

        const product = await findProductById(id);

        if (!product || !product.is_active) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json({ product });
    } catch (error) {
        next(error);
    }
}

export async function createProductHandler(req, res, next) {
    try {
        const product = await addProduct(req.body, req.session.user.id);

        res.status(201).json({
            message: 'Product created successfully',
            product
        });
    } catch (error) {
        next(error);
    }
}

export async function updateProductHandler(req, res, next) {
    try {
        const id = parseProductId(req.params.id);

        if (!id) {
            return res.status(400).json({ error: 'Invalid product ID' });
        }

        const product = await editProduct(id, req.body);

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json({
            message: 'Product updated successfully',
            product
        });
    } catch (error) {
        next(error);
    }
}

export async function deactivateProductHandler(req, res, next) {
    try {
        const id = parseProductId(req.params.id);

        if (!id) {
            return res.status(400).json({ error: 'Invalid product ID' });
        }

        const product = await deactivateProduct(id);

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json({
            message: 'Product deactivated successfully',
            product
        });
    } catch (error) {
        next(error);
    }
}
