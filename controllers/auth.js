const bcryptjs = require("bcryptjs");
const User = require("../models/user");
const generateJWT = require("../helpers/jwt");
const { google } = require("googleapis");

// Replace with your Google Client credentials
const CLIENT_ID =
  "1006583541945-c3pur533l7mt7vofn9f251heapao6qu7.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REDIRECT_URI = "http://localhost:8080/api/auth/google/callback";

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

const createUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    let user = await User.findOne({ email });

    if (user) {
      return res
        .status(400)
        .json({ ok: false, msg: "User email already exists" });
    }

    user = new User(req.body);

    // Encrypt password
    const salt = bcryptjs.genSaltSync();
    user.password = bcryptjs.hashSync(password, salt);

    await user.save();
    const token = await generateJWT(user.id, user.name);

    return res.status(201).json({
      ok: true,
      user,
      token,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      ok: false,
      msg: "Please, contact the administrator",
    });
  }
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        ok: false,
        msg: "User email does not exist",
      });
    }

    // Verify if passwords match
    const validPassword = bcryptjs.compareSync(password, user.password);
    if (!validPassword) {
      return res.status(401).json({
        ok: false,
        msg: "Invalid password.",
      });
    }

    const token = await generateJWT(user.id, user.name);

    return res.status(200).json({
      ok: true,
      user,
      token,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      ok: false,
      msg: "Please, contact the administrator",
    });
  }
};

const renewToken = async (req, res) => {
  const { id, name } = req;

  const token = await generateJWT(id, name);

  res.json({ ok: true, user: { _id: id, name }, token });
};

const googleLogin = (req, res) => {
  const scopes = [
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/userinfo.email",
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    state: "secure_random_state", // Add CSRF protection
  });

  res.redirect(url);
};

const googleCallback = async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;

  try {
    // Validate state (CSRF protection)
    if (state !== "secure_random_state") {
      return res.status(400).json({ error: "Invalid state parameter" });
    }

    // Exchange the authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Retrieve user info from Google
    const oauth2 = google.oauth2({
      auth: oauth2Client,
      version: "v2",
    });
    const { data: userInfo } = await oauth2.userinfo.get();

    const { email, name, picture } = userInfo;

    // Check if the user already exists in the database
    let user = await User.findOne({ email });

    if (!user) {
      // If the user doesn't exist, create a new user
      user = new User({
        email,
        name,
        picture,
        password: null, // OAuth users don't need a password
      });

      // Save the user to the database
      await user.save();
    }

    // Store Google OAuth tokens in the user's record (for future API requests)
    user.googleTokens = tokens;
    await user.save();

    // Generate JWT for the user
    const token = await generateJWT(user.id, user.name);

    // Redirect to the front-end (applying token to URL)
    return res.redirect(`http://localhost:3000?token=${token}`);
  } catch (error) {
    console.error("Error during Google OAuth login:", error);
    return res
      .status(500)
      .json({ error: "Failed to authenticate with Google" });
  }
};

const googlecalendar = google.calendar({ version: "v3", auth: oauth2Client });

module.exports = {
  createUser,
  loginUser,
  renewToken,
  googleLogin,
  googleCallback,
  googlecalendar,
};
