import {
    listActiveProducts,
    findProductById,
    createProduct,
    updateProduct,
    deactivateProduct
} from '../repositories/products.repository.js';

function validateProduct(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        const error = new Error('A product object is required');
        error.status = 400;
        throw error;
    }

    const { name, description, category, price, image_url } = data;

    if (typeof name !== 'string' || !name.trim() || name.trim().length > 150) {
        const error = new Error('Product name is required (maximum 150 characters)');
        error.status = 400;
        throw error;
    }

    if (typeof category !== 'string' || !category.trim() || category.trim().length > 50) {
        const error = new Error('Category is required (maximum 50 characters)');
        error.status = 400;
        throw error;
    }

    if (price === undefined || price === null || price === '' ||
        !Number.isFinite(Number(price)) || Number(price) < 0) {
        const error = new Error('Price must be a valid non-negative number');
        error.status = 400;
        throw error;
    }

    if (description !== undefined && description !== null &&
        typeof description !== 'string') {
        const error = new Error('Description must be text');
        error.status = 400;
        throw error;
    }

    if (image_url !== undefined && image_url !== null &&
        typeof image_url !== 'string') {
        const error = new Error('Image URL must be text');
        error.status = 400;
        throw error;
    }

    return {
        name: name.trim(),
        description: description?.trim() || null,
        category: category.trim(),
        price: Number(price),
        image_url: image_url?.trim() || null
    };
}

export { listActiveProducts, findProductById, deactivateProduct };

export async function addProduct(data, userId) {
    const product = validateProduct(data);
    return createProduct(product, userId);
}

export async function editProduct(id, data) {
    const product = validateProduct(data);
    return updateProduct(id, product);
}
