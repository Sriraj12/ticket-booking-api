const prisma = require("../config/prisma");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
// OAuth2 client for server-side redirect flow (requires CLIENT_SECRET and REDIRECT_URI)
const googleOAuth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

exports.userRegister = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    // Check existing user
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists"
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone,
        role_id: 3
      }
    });

    res.status(201).json({
      message: "User registered successfully",
      user
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error"
    });
  }
};

exports.googleAuth = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ message: "Google idToken is required" });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload?.email;
    const name = payload?.name || payload?.email?.split("@")[0];

    if (!email) {
      return res.status(400).json({ message: "Unable to verify Google user email" });
    }

    let user = await prisma.user.findUnique({
      where: { email }
    });

    const isNewUser = !user;

    if (isNewUser) {
      user = await prisma.user.create({
        data: {
          name,
          email,
          password: null,
          phone: null,
          role_id: 3
        }
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        role_id: user.role_id
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d"
      }
    );

    res.status(isNewUser ? 201 : 200).json({
      message: isNewUser ? "User created with Google OAuth" : "Logged in successfully",
      token,
      user
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Google authentication failed" });
  }
};

    // Redirect the user to Google's OAuth2 consent page
    exports.googleRedirect = (req, res) => {
      try {
        const redirectTo = req.query.redirect_uri || process.env.FRONTEND_REDIRECT_URI || "";
        const state = encodeURIComponent(redirectTo);

        const redirectUri = process.env.GOOGLE_REDIRECT_URI;
        const url = googleOAuth2Client.generateAuthUrl({
          access_type: "offline",
          scope: ["openid", "email", "profile"],
          prompt: "consent",
          state,
          redirect_uri: redirectUri
        });

        console.log("Google auth URL:", url);
        return res.redirect(url);
      } catch (error) {
        console.error(error);
        return res.status(500).send("Failed to generate Google auth URL");
      }
    };

    // Handle Google's OAuth2 callback, exchange code for tokens and issue JWT
    exports.googleCallback = async (req, res) => {
      try {
        const code = req.query.code;
        const state = req.query.state;
        const redirectTo = state ? decodeURIComponent(state) : (process.env.FRONTEND_REDIRECT_URI || "/");

        if (!code) {
          return res.status(400).send("Authorization code not provided");
        }

        const { tokens } = await googleOAuth2Client.getToken(code);
        const idToken = tokens.id_token;

        if (!idToken) {
          return res.status(400).json({ message: "No id_token returned from Google" });
        }

        const ticket = await googleClient.verifyIdToken({
          idToken,
          audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const email = payload?.email;
        const name = payload?.name || payload?.email?.split("@")[0];

        if (!email) {
          return res.status(400).json({ message: "Unable to verify Google user email" });
        }

        let user = await prisma.user.findUnique({ where: { email } });
        const isNewUser = !user;

        if (isNewUser) {
          user = await prisma.user.create({
            data: {
              name,
              email,
              password: null,
              phone: null,
              role_id: 3
            }
          });
        }

        const token = jwt.sign(
          { id: user.id, role_id: user.role_id },
          process.env.JWT_SECRET,
          { expiresIn: "1d" }
        );

        // Redirect back to frontend with token as query param
        const separator = redirectTo.includes("?") ? "&" : "?";
        const redirectUrl = redirectTo + separator + "token=" + encodeURIComponent(token);

        return res.redirect(redirectUrl);
      } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Google OAuth callback failed" });
      }
    };

exports.adminRegister = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    // Check existing user
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists"
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone,
        role_id: 1
      }
    });

    res.status(201).json({
      message: "User registered successfully",
      user
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error"
    });
  }
};

// Return the generated Google auth URL (useful to debug redirect_uri mismatches)
exports.googleDebugUrl = (req, res) => {
  try {
    const redirectTo = req.query.redirect_uri || process.env.FRONTEND_REDIRECT_URI || "";
    const state = encodeURIComponent(redirectTo);
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    const url = googleOAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope: ["openid", "email", "profile"],
      prompt: "consent",
      state,
      redirect_uri: redirectUri
    });

    return res.json({ url, redirect_uri_used: redirectUri });
  } catch (error) {
    console.error("googleDebugUrl error:", error);
    return res.status(500).json({ message: "Failed to generate debug URL" });
  }
};

// Return non-secret environment values helpful for debugging (DO NOT expose secrets)
exports.googleDebugEnv = (req, res) => {
  try {
    return res.json({
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || null,
      GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || null,
      FRONTEND_REDIRECT_URI: process.env.FRONTEND_REDIRECT_URI || null
    });
  } catch (error) {
    console.error("googleDebugEnv error:", error);
    return res.status(500).json({ message: "Failed to read env" });
  }
};

exports.sellerRegister = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    // Check existing user
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists"
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone,
        role_id: 2
      }
    });

    res.status(201).json({
      message: "User registered successfully",
      user
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error"
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user || !user.password) {
      return res.status(400).json({
        message: "Invalid credentials"
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid credentials"
      });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        id: user.id,
        role_id: user.role_id
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d"
      }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error"
    });
  }
};