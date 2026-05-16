const mongoose = require('mongoose');

const watchlistSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    movie_id: { type: Number, required: true },
    movie_type: { type: String, enum: ['movie', 'tv'], required: true },
    title: { type: String, required: true },
    poster_path: { type: String, default: null },
    year: { type: String, default: null },
    added_at: { type: Date, default: Date.now }
});

watchlistSchema.index({ user_id: 1, movie_id: 1, movie_type: 1 }, { unique: true });

class WatchlistModel {
    constructor() {
        this.model = mongoose.model('Watchlist', watchlistSchema);
    }

    _fmt(doc) {
        return {
            id: doc._id.toString(),
            user_id: doc.user_id?.toString() || null,
            movie_id: doc.movie_id,
            movie_type: doc.movie_type,
            title: doc.title,
            poster_path: doc.poster_path,
            year: doc.year,
            added_at: doc.added_at
        };
    }

    async add(userId, movie) {
        try {
            await this.model.create({
                user_id: userId,
                movie_id: movie.movieId,
                movie_type: movie.type,
                title: movie.title,
                poster_path: movie.poster || null,
                year: movie.year || null
            });
            return true;
        } catch (e) {
            if (e.code === 11000) return false;
            throw e;
        }
    }

    async remove(userId, movieId, movieType) {
        const result = await this.model.deleteOne({ user_id: userId, movie_id: movieId, movie_type: movieType });
        return result.deletedCount > 0;
    }

    async getByUser(userId) {
        const docs = await this.model.find({ user_id: userId }).sort({ added_at: -1 }).lean();
        return docs.map(d => this._fmt(d));
    }

    async isInList(userId, movieId, movieType) {
        const doc = await this.model.findOne({ user_id: userId, movie_id: movieId, movie_type: movieType });
        return !!doc;
    }

    async getFeedForFollowing(followingIds) {
        const docs = await this.model.find({ user_id: { $in: followingIds } })
            .populate('user_id', 'username')
            .sort({ added_at: -1 })
            .limit(50)
            .lean();
        return docs.map(d => ({
            ...this._fmt(d),
            username: d.user_id?.username || null,
            activity_type: 'watchlist'
        }));
    }
}

module.exports = new WatchlistModel();
