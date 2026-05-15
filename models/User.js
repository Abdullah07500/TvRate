const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password_hash: { type: String, required: true },
    bio: { type: String, default: '' },
    created_at: { type: Date, default: Date.now }
});

class UserModel {
    constructor() {
        this.model = mongoose.model('User', userSchema);
    }

    async create(username, email, passwordHash) {
        const doc = await this.model.create({ username, email, password_hash: passwordHash });
        return doc._id.toString();
    }

    async findByEmail(email) {
        const doc = await this.model.findOne({ email: email.toLowerCase() }).lean();
        return doc ? { ...doc, id: doc._id.toString() } : null;
    }

    async findByUsername(username) {
        const doc = await this.model.findOne({ username: new RegExp(`^${username}$`, 'i') }).lean();
        return doc ? { ...doc, id: doc._id.toString() } : null;
    }

    async findById(id) {
        const doc = await this.model.findById(id).select('-password_hash').lean();
        return doc ? { ...doc, id: doc._id.toString() } : null;
    }

    async updateBio(id, bio) {
        await this.model.findByIdAndUpdate(id, { bio });
    }

    async search(query) {
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const docs = await this.model.find({
            username: { $regex: escaped, $options: 'i' }
        }).select('username bio').limit(10).lean();
        return docs.map(d => ({ id: d._id.toString(), username: d.username, bio: d.bio || '' }));
    }
}

module.exports = new UserModel();
