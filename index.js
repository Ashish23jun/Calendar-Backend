const express = require("express");
require("dotenv").config();
const dbConnection = require("./database/config");
const cors = require("cors");
const path = require("path");
const bodyParser = require("body-parser");

// Server
const app = express();

app.use(bodyParser.json());

// Database
dbConnection();

// Cors
app.use(cors());

// Public path
app.use(express.static("public"));

// Read and parse body
app.use(express.json());

app.get("/test", (req, res) => {
  res.send("Hello, World!");
});

// Routes
app.use("/api/auth", require("./routes/auth.js"));
app.use("/api/events", require("./routes/events.js"));

// Listening PORT
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`SERVER LISTENING ON PORT ${port}`);
});
