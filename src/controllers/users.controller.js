import {
    createManagedUser,
    listUsers,
    updateUserRole,
    deactivateUser
} from '../services/users.service.js';

export async function createUserHandler(req, res, next) {
    try {
        const user = await createManagedUser(req.body);
        res.status(201).json({ message: 'User created successfully', user });
    } catch (error) {
        next(error);
    }
}

export async function listUsersHandler(req, res, next) {
    try {
        res.json({ users: await listUsers() });
    } catch (error) {
        next(error);
    }
}

export async function updateUserRoleHandler(req, res, next) {
    try {
        const id = Number(req.params.id);

        if (!Number.isSafeInteger(id) || id < 1) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const { role } = req.body;

        if (!['product_manager', 'customer'].includes(role)) {
            return res.status(400).json({
                error: 'Role must be product_manager or customer'
            });
        }

        const user = await updateUserRole(id, role);

        if (!user) {
            return res.status(404).json({
                error: 'User not found or cannot modify owner'
            });
        }

        res.json({ message: 'User role updated', user });
    } catch (error) {
        next(error);
    }
}

export async function deactivateUserHandler(req, res, next) {
    try {
        const id = Number(req.params.id);

        if (!Number.isSafeInteger(id) || id < 1) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const user = await deactivateUser(id);

        if (!user) {
            return res.status(404).json({
                error: 'User not found or cannot deactivate owner'
            });
        }

        res.json({ message: 'User deactivated', user });
    } catch (error) {
        next(error);
    }
}
