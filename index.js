require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const authRoutes = require('./routes/auth.routes');


const app = express();
const PORT = process.env.PORT

connectDB();

app.use(express.json());
app.use(cors());
app.use('/api/auth', authRoutes);

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));