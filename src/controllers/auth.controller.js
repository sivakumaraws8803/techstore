import {
    authenticateUser,
    registerCustomer
} from '../services/auth.service.js';

export async function register(req, res, next) {
    try {
        const { fullName, email, password } = req.body;

        if (
            typeof fullName !== 'string' ||
            typeof email !== 'string' ||
            typeof password !== 'string' ||
            !fullName.trim() ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                error: 'Full name, email and password are required.'
            });
        }

        const user = await registerCustomer({ fullName, email, password });

        return res.status(201).json({
            message: 'Account created successfully. Please log in.',
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({ error: error.message });
        }
        next(error);
    }
}

export async function login(req, res, next) {
    try {
        const identifier = req.body.email ?? req.body.username;
        const { password } = req.body;

        if (
            typeof identifier !== 'string' ||
            typeof password !== 'string' ||
            !identifier.trim() ||
            !password
        ) {
            return res.status(400).json({
                error: 'Email or username and password are required.'
            });
        }

        const user = await authenticateUser(
            identifier.trim(),
            password
        );

        if (!user) {
            return res.status(401).json({
                error: 'Invalid email/username or password.'
            });
        }

        req.session.regenerate((error) => {
            if (error) {
                return next(error);
            }

            req.session.user = user;

            req.session.save((saveError) => {
                if (saveError) {
                    return next(saveError);
                }

                res.json({
                    message: 'Login successful',
                    user
                });
            });
        });
    } catch (error) {
        next(error);
    }
}

export function me(req, res) {
    if (!req.session.user) {
        return res.status(401).json({
            error: 'Authentication required'
        });
    }

    res.json({
        user: req.session.user
    });
}

export function logout(req, res, next) {
    req.session.destroy((error) => {
        if (error) {
            return next(error);
        }

        res.clearCookie('techstore.sid');

        res.json({
            message: 'Logout successful'
        });
    });
}
