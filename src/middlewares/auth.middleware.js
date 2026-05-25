const jwt = require("jsonwebtoken");

exports.verifyToken = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ message: "No token" });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();

    } catch (err) {
        return res.status(401).json({ message: "Invalid token" });
    }
};

exports.isAdmin = (req, res, next) => {
    if (req.user.role_id !== 1) {
        return res.status(403).json({ message: "Admin only" });
    }
    next();
};

exports.isSeller = (req, res, next) => {
    if (req.user.role_id !== 2) {
        return res.status(403).json({ message: "Seller only" });
    }
    next();
}

exports.isUser = (req, res, next) => {

    console.log("User Role ID:", req.user.role_id); // Debugging line

    if (req.user.role_id !== 3) {
        return res.status(403).json({ message: "User only" });
    }
    next();
}