const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    movie_id: { type: Number, required: true },
    movie_type: { type: String, enum: ['movie', 'tv'], required: true },
    title: { type: String, required: true },
    poster_path: { type: String, default: null },
    year: { type: String, default: null },
    rating: { type: Number, min: 1, max: 10, required: true },
    review_text: { type: String, required: true },
    ip_address: { type: String, default: null },
    submitted_date: { type: Date, default: Date.now }
});

reviewSchema.index({ user_id: 1 });
reviewSchema.index({ submitted_date: -1 });

class ReviewModel {
    constructor() {
        this.model = mongoose.model('Review', reviewSchema);
    }

    _fmt(doc) {
        return {
            id: doc._id.toString(),
            username: doc.user_id?.username || null,
            movie_id: doc.movie_id,
            movie_type: doc.movie_type,
            title: doc.title,
            poster_path: doc.poster_path,
            year: doc.year,
            rating: doc.rating,
            review_text: doc.review_text,
            ip_address: doc.ip_address,
            submitted_date: doc.submitted_date
        };
    }

    async getAll() {
        const docs = await this.model.find()
            .populate('user_id', 'username')
            .sort({ submitted_date: -1 })
            .lean();
        return docs.map(d => this._fmt(d));
    }

    async add(data) {
        const doc = await this.model.create({
            user_id: data.userId || null,
            movie_id: data.movieId,
            movie_type: data.type,
            title: data.title,
            poster_path: data.poster || null,
            year: data.year || null,
            rating: data.rating,
            review_text: data.reviewText,
            ip_address: data.ipAddress,
            submitted_date: new Date()
        });
        return doc._id.toString();
    }

    async delete(id) {
        const result = await this.model.findByIdAndDelete(id);
        return !!result;
    }

    async getByUser(userId) {
        const docs = await this.model.find({ user_id: userId })
            .sort({ submitted_date: -1 })
            .lean();
        return docs.map(d => this._fmt(d));
    }

    async checkLimit(ipAddress, maxPerDay = 5) {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const count = await this.model.countDocuments({ ip_address: ipAddress, submitted_date: { $gte: since } });
        return count >= maxPerDay;
    }

    async getFeedForFollowing(followingIds) {
        const docs = await this.model.find({ user_id: { $in: followingIds } })
            .populate('user_id', 'username')
            .sort({ submitted_date: -1 })
            .limit(50)
            .lean();
        return docs.map(d => ({ ...this._fmt(d), activity_type: 'review' }));
    }
}

module.exports = new ReviewModel();
