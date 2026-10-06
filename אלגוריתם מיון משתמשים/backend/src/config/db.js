const mongoose = require('mongoose');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/unitree';
async function connectDb() {
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB connected');
}

module.exports = { connectDb };
