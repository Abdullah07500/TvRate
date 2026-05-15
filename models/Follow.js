const mongoose = require('mongoose');

const followSchema = new mongoose.Schema({
    follower_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    following_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    created_at: { type: Date, default: Date.now }
});

followSchema.index({ follower_id: 1, following_id: 1 }, { unique: true });

class FollowModel {
    constructor() {
        this.model = mongoose.model('Follow', followSchema);
    }

    async follow(followerId, followingId) {
        try {
            await this.model.create({ follower_id: followerId, following_id: followingId });
            return true;
        } catch (e) {
            if (e.code === 11000) return false;
            throw e;
        }
    }

    async unfollow(followerId, followingId) {
        const result = await this.model.deleteOne({ follower_id: followerId, following_id: followingId });
        return result.deletedCount > 0;
    }

    async isFollowing(followerId, followingId) {
        const doc = await this.model.findOne({ follower_id: followerId, following_id: followingId });
        return !!doc;
    }

    async getFollowers(userId) {
        const docs = await this.model.find({ following_id: userId })
            .populate('follower_id', 'username bio')
            .sort({ created_at: -1 })
            .lean();
        return docs.map(d => ({
            id: d.follower_id._id.toString(),
            username: d.follower_id.username,
            bio: d.follower_id.bio
        }));
    }

    async getFollowing(userId) {
        const docs = await this.model.find({ follower_id: userId })
            .populate('following_id', 'username bio')
            .sort({ created_at: -1 })
            .lean();
        return docs.map(d => ({
            id: d.following_id._id.toString(),
            username: d.following_id.username,
            bio: d.following_id.bio
        }));
    }

    async getFollowingIds(userId) {
        const docs = await this.model.find({ follower_id: userId }).lean();
        return docs.map(d => d.following_id);
    }
}

module.exports = new FollowModel();
