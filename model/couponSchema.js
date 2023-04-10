
const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');


const couponSchema = new mongoose.Schema({

    code: {
        type: String,
        required: true
    },
    date: {
        type: String,
        required: true
    },
    offer: {
        type: Number,
        required: true
    },
    status: {
        type: Boolean,
        default: true
    },
    userId: [{
        type: ObjectId
    }]
})
module.exports = mongoose.model("Coupon", couponSchema);