import { authenticateUser } from '../services/auth.service.js';

export async function login(req, res, next) {
    try {
        const { username, password } = req.body;

        if (
            typeof username !== 'string' ||
            typeof password !== 'string' ||
            !username.trim() ||
            !password
        ) {
            return res.status(400).json({
                error: 'Username and password are required'
            });
        }

        const user = await authenticateUser(
            username.trim(),
            password
        );

        if (!user) {
            return res.status(401).json({
                error: 'Invalid username or password'
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
