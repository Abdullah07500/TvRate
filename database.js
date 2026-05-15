const mongoose = require('mongoose');

class Database {
    constructor() {
        this.uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tvrate';
    }

    async connect() {
        await mongoose.connect(this.uri);
        console.log(`Connected to MongoDB: ${this.uri}`);
    }
}

module.exports = new Database();
