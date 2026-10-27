import bcrypt from 'bcrypt';

import {
    findUserByUsername,
    createUser,
    listUsers,
    updateUserRole,
    deactivateUser
} from '../repositories/users.repository.js';

const allowedRoles = ['product_manager', 'customer'];

export async function createManagedUser({ username, password, role }) {
    if (typeof username !== 'string' ||
        !/^[a-zA-Z0-9_.-]{3,50}$/.test(username)) {
        const error = new Error(
            'Username must be 3-50 characters using letters, numbers, _, . or -'
        );
        error.status = 400;
        throw error;
    }

    if (typeof password !== 'string' ||
        password.length < 12 ||
        Buffer.byteLength(password, 'utf8') > 72) {
        const error = new Error(
            'Password must be at least 12 characters and no more than 72 bytes'
        );
        error.status = 400;
        throw error;
    }

    if (!allowedRoles.includes(role)) {
        const error = new Error(
            'Role must be product_manager or customer'
        );
        error.status = 400;
        throw error;
    }

    if (await findUserByUsername(username)) {
        const error = new Error('Username already exists');
        error.status = 409;
        throw error;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    return createUser({ username, passwordHash, role });
}

export { listUsers, updateUserRole, deactivateUser };
