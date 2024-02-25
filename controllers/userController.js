const { userModel } = require('../models/userModel');
const bcrypt = require('bcryptjs');

/* GET user details */
const getUser = async (req, res) => {
    const email = req.query.email; // Extract email from query parameters
    if (!email) {
        return res.status(400).json({ error: 'Email parameter is missing' });
    }

    try {
        // Find user by email and exclude password field
        const user = await userModel.findOne({ email }).select('-password');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
}


/* POST new user */
const addUser = async (req, res) => {
    const user = new userModel(req.body);
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(req.body.password, salt);
    // hashing the password before save it in DB
    user.password = hash;

    try {
        await user.save();
        // Return the user data without the password
        const userWithoutPassword = user.toObject();
        delete userWithoutPassword.password;
        res.status(200).json(userWithoutPassword);
    } catch (error) {
        res.status(400).json(error);
    }
}



module.exports = {
    getUser,
    addUser
}