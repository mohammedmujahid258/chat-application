import bcrypt from "bcryptjs";
import User from "../models/Users.model.js";
import jwt from "jsonwebtoken"

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !cleanEmail || password.length < 6) {
      return res.status(400).json({
        message: "Please provide valid name, email, and a password with at least 6 characters",
      });
    }

    const existingUser = await User.findOne({ email: cleanEmail });

    if (existingUser) {
      return res.status(409).json({
        message: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: cleanName,
      email: cleanEmail,
      password: hashedPassword,
    });

    return res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profilePic: user.profilePic || "",
        lastSeen: user.lastSeen,
        isOnline: user.isOnline,
      },
    });
  } catch (error) {
    console.error("Register error:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

export const login =async(req,res)=>{
    try{
        const{email,password}=req.body || {};

        // check if email and password were provided 
        if(!email || !password){
            return res.status(400).json({
                message:"Email and password are required ",
            });
        }

        const cleanEmail = email.trim().toLowerCase();
        const user=await User.findOne({email: cleanEmail});
        if(!user){
            return res.status(401).json({
                message:"Invalid email or password",

            });
        }
        const isPasswordCorrect=await bcrypt.compare(
            password,
            user.password
        );
        if(!isPasswordCorrect){
            return res.status(401).json({
                message:"Invalid email or password"
            })
        }
        const token=jwt.sign(
            {userId:user._id},
            process.env.JWT_SECRET,
            {expiresIn:"7d"}
        )

        return res.status(200).json({
            message:"Login successful",
            token,
            user:{
                id:user._id,
                name:user.name,
                email:user.email,
                profilePic:user.profilePic || "",
                lastSeen:user.lastSeen,
                isOnline:user.isOnline,
            },
        });
    }catch(error){
        console.log("Login error: ",error);
        return res.status(500).json({
            message:"Server error",
        })
    }
}

export const logout = async (req, res) => {
    try {
        // The Socket.IO disconnect handler owns presence updates. This avoids
        // marking a user offline while another tab/device is still connected.
        return res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
        console.error("Logout error:", error);
        return res.status(500).json({ message: "Server error" });
    }
};
