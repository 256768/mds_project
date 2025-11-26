import jwt from "jsonwebtoken";

export const login = (req, res) => {
    const { password } = req.body;

    if (password !== process.env.STREAM_PASSWORD) {
        return res.status(401).json({ message: "Invalid password" });
    }

    const token = jwt.sign(
        { role: "broadcaster" },
        process.env.JWT_SECRET,
        { expiresIn: "2h" }
    );

    res.json({ token });
};

