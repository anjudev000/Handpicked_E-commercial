const User = require("../model/userSchema");
const Product = require("../model/productSchema");
const Order = require("../model/orderSchema");
const Coupon = require("../model/couponSchema");
const { ObjectId } = require('mongodb');
const moment = require('moment');
const razorPay = require('razorpay');
const instance = new razorPay({ key_id: process.env.KEY_ID, key_secret: process.env.KEY_SECRET });

const quantitys = [];
const checkOut = async (req, res,next) => {
  try {
    
    const address = await User.find({ _id: req.session.userData._id }).lean();
    const cartData = await User.aggregate([{
      $match: { _id: ObjectId(req.session.userData._id) }
    },
    {
      $lookup: {
        from: "products", let: { cartItems: "$cart" },
        pipeline: [{ $match: { $expr: { $in: ["$_id", "$$cartItems.productId"], }, }, },], as: "Cartproducts",
      },
    },]);
    let subtotal = 0;

    const cartProducts = cartData[0].Cartproducts;
    cartProducts.map((cartProduct, i) => {
      cartProduct.quantity = req.body.quantity[i];
      subtotal = subtotal + cartProduct.price * req.body.quantity[i];
      quantitys[i] = req.body.quantity[i];
    });
    
    
    res.render("users/checkout", {
      productDetails: cartData[0].Cartproducts,
      subtotal: subtotal,
      address: address[0].address,
      userData: req.session.userData,
      logged: 1, total: subtotal, offer: 0
    });
  } catch (error) {
    next(error);
  }

}

const checkOutLoad = async (req, res) => {
  try {
    const address = await User.find({ _id: req.session.userData._id }).lean();
    const cartData = await User.aggregate([
      {
        $match: { _id: new ObjectId(req.session.userData._id) },
      },
      {
        $lookup: {
          from: "products",
          let: { cartItems: "$cart" },
          pipeline: [
            { $match: { $expr: { $in: ["$_id", "$$cartItems.productId"] } } },
          ],
          as: "Cartproducts",
        },
      },
    ]);
    let subtotal = 0;

    const cartProducts = cartData[0].Cartproducts;
    cartProducts.map((cartProduct, i) => {
      cartProduct.quantity = quantitys[i];
      subtotal = subtotal + cartProduct.price * quantitys[i];
    });

    res.render("users/checkout", {
      productDetails: cartData[0].Cartproducts,
      subtotal: subtotal,
      address: address[0].address,
      userData: req.session.userData._id,
      logged: 1,
      total: subtotal,
      offer: 0,
    });
  } catch (error) {
    
  }
};

let couponamount

const placeOrder = async (req, res,next) => {
  try {
    const {
      productid,
      productname,
      price,
      quantity,
      addressId,
      payment,
      subtotal
    } = req.body;
    const result = Math.random().toString(36).substring(2, 7);
    const id = Math.floor(100000 + Math.random() * 900000);
    const orderId = result + id;


    const now = moment()
    const date = now.toDate()

    const productData = productid.map((item, i) => ({
      id: productid[i],
      name: productname[i],
      price: price[i],
      quantity: quantity[i]

    }));

    let total = subtotal;
    if (req.body.coupon) {

      couponCode = req.body.coupon;
      const applied = await Coupon.findOne({ code: req.body.coupon })
      couponamount = applied.offer
      if (couponamount) {
        const amount = (subtotal * couponamount) / 100
        total = subtotal - amount
      }
    }

    let data = {
      userId: ObjectId(req.session.userData._id),
      product: productData,
      orderId: orderId,
      date: moment().toDate(),
      status: "processing",
      payment_method: String(payment),
      addressId: addressId,
      subtotal: subtotal,
      total: total
    };

    const orderPlacement = await Order.insertMany(data);
    const clearCart = await User.updateOne({ _id: req.session.userData._id }, { $set: { cart: [] } })
    quantity.map(async (item, i) => {
    await Product.updateOne({
        _id: ObjectId(productid[i])
      }, {
        $inc: {
          stock: -Number(item)
        }
      })
    })

    if (orderPlacement && clearCart) {

      req.session.page = 'fghnjm'
      return res.json({
        res: "success",
        data: data
      })
    } else {
      const handlePlacementissue = await Order.deleteMany({
        orderId: orderId,
      });
      res.json("try again")
    }
  }
  catch (error) {
    next(error);
  }
}


const successorder = async (req, res,next) => {
  try {
    
    if (req.session.page) {
      delete req.session.page
      
      const orderData = await Order.find({}).sort({ _id: -1 }).limit(1)
      res.render('users/successOrder', { order: orderData, userData: req.session.userData })
    } else {
      res.redirect('/')
    }

  } catch (error) {
    next(error);
  }
}

let offerPrice
const coupon = async (req, res, next) => {
  try {
    const codeId = req.body.code
    const total = req.body.total
    const couponData = await Coupon.findOne({ code: codeId }).lean();
    const userData = await Coupon.findOne({ code: codeId, userId: req.session.userData._id }).lean()
       
    let minamount=100;
    let maxamount=500;
    let amount;

    if (couponData && couponData.date > moment().format("YYYY-MM-DD" ) && couponData.status) {
      offerPrice = couponData.offer


      if (userData) {
        res.json("fail")
      } else {
        if(total>=minamount){

          if(total<=maxamount){
            amount = (total * offerPrice) / 100;
          var gtotal = total - amount;
           
        }else{
            amount = (1000 * offerPrice) / 100;
            var gtotal = total - amount;
          
           }
        }else{
           gtotal=amount;
           res.json("alert");
          }
      res.json({ offerPrice: offerPrice, gtotal: gtotal })
        const userupdate = await Coupon.updateOne({ code: codeId }, { $push: { userId: req.session.userData._id } })
      }
    } else {
      res.json('fail')
    }

  } catch (error) {
    next(error);
  }
}

const removeCouponcode = async (req, res, next) => {
  try {
    // Retrieve coupon data for the currently applied coupon
    const codeId = req.body.code;
    const couponData = await Coupon.findOne({ code: codeId }).lean();
    const userData = await Coupon.findOne({
      code: codeId,
      userId: req.session.userData._id,
    }).lean();
    
    if (couponData) {
      // Remove coupon from user's coupon list
      const updateData = await Coupon.updateOne(
        { code: codeId },
        { $pull: { userId: req.session.userData._id } }
      );
        
      // Set gtotal to be the same as total, since the coupon has been removed
      const total = req.body.total;
      const gtotal = total;
      res.json({ success: true, gtotal: gtotal });
    } else {
      // Handle error scenario
      res.json({ success: false });
    }
  } catch (error) {
    next(error);
  }
};


const removeAddress = async (req, res,next) => {
  try {
    const id = req.body.addressId;
    const userId = req.session.userData._id;

    await User.updateOne(
      {
        _id: userId,
        "address._id": id,
      },
      {
        $pull: {
          address: { _id: id },
        },
      }
    );
    res.json({
      res: "success",
    });
  } catch (error) {
   next(error)
  }
};

const editAddressLoad = async(req,res,next)=>{
  try{
   const id = req.query.id;
    const userData = req.session.userData;
    const userAddress = await User.findOne({ address: { $elemMatch: { _id: id } } }, { "address.$": 1, _id: id });
    res.render('users/edit-address2', { address: userAddress, userData: userData });
  }
  catch(error){
    next(error)
  }
}

const editAddressUpload = async(req,res,next)=>{
  try{
    const id = req.query.id;
    
    const userAddress = await User.updateOne(
      { address: { $elemMatch: { _id: id } } }, { $set: { "address.$": req.body } });
     
    res.redirect('/checkout');
}
  catch(error){
    next(error)
  }
}

const razorPayFunction = async(req, res) => {
  
let  options = {
    amount: req.body.amount,  // amount in the smallest currency unit
    currency: "INR",
    receipt: "rcp1"
  };
  instance.orders.create(options, function (err, order) {
    
    res.send({ orderId: order.id });//EXTRACT5NG ORDER ID AND SENDING IT TO CHECKOUT
  });
}
 
const razorPayVerify = async (req, res) => {

  let body = req.body.response.razorpay_order_id + "|" + req.body.response.razorpay_payment_id;

  let crypto = require("crypto");
  let expectedSignature = crypto.createHmac('sha256', process.env.KEY_SECRET)
    .update(body.toString())
    .digest('hex');
  let response = { "signatureIsValid": "false" }
  if (expectedSignature === req.body.response.razorpay_signature)
    response = { "signatureIsValid": "true" }
  res.send(response);
}

module.exports={
  
  checkOut,
  placeOrder,
  successorder,
  coupon,
  removeAddress,
  editAddressLoad,
  editAddressUpload,
  razorPayFunction,
  razorPayVerify,
  checkOutLoad,
  removeCouponcode

}
