const User = require("../model/userSchema");
const { ObjectId } = require('mongodb');


const cartLoad = async (req, res, next) => {
  try {
    const user = await User.findById(req.session.userData);
    const userData = req.session.userData;
    const cartData = await User.aggregate([
      {
        $match: {
          _id: ObjectId(userData._id),
        },
      },
      {
        $lookup: {
          from: "products",
          let: {
            cartItems: "$cart",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: ["$_id", { $ifNull: ["$$cartItems.productId", []] }],
                },
              },
            },
          ],
          as: "productcartData",
        },
      },
    ]);
    const cartProducts = cartData[0].productcartData;
  

    // Remove out of stock items from cart
    const updatedCartProducts = [];
    const removedItems = [];
    for (const cartProduct of cartProducts) {
      const cartItem = user.cart.find((item) => item.productId.equals(cartProduct._id));
      if (cartItem && cartProduct.stock > 0) { // Check if item is in stock
        cartProduct.quantity = cartItem.quantity;
        updatedCartProducts.push(cartProduct);
        
      } else {
        // Notify user that item has been removed from cart due to being out of stock
        removedItems.push(cartProduct._id);
      }
    }

    // Remove out of stock items from user's cart in the database
    await User.findByIdAndUpdate(userData._id, { $pull: { cart: { productId: { $in: removedItems } } } });

    // Update subtotal and render cart page
    let subtotal = 0;
    updatedCartProducts.forEach((cartProduct) => {
      subtotal += Number(cartProduct.price) * cartProduct.quantity;
    });
    
    const length = updatedCartProducts.length;

    if (removedItems.length > 0) {
      const removedItemsMessage = 'The following item(s) have been removed from your cart as they are no longer available: ' + removedItems.map(item => item.name).join(', ');
      
      res.render("users/cart", { cartProducts: updatedCartProducts, subtotal, length, userData: req.session.userData, user, message: removedItemsMessage });
      res.json({ res: "success" });
      return;
    } else {
      
      
      res.render("users/cart", { cartProducts: updatedCartProducts, subtotal, length, userData: req.session.userData, user });
    }
  } catch (error) {
    next(error);
  }
};

const updateCartQuantity = async (req, res) => {
  try {
    const productId = req.params.productId;
    const newQuantity = req.body.quantity;


    const user = await User.findByIdAndUpdate(
      req.session.userData,
      { $set: { "cart.$[item].quantity": newQuantity } },
      { arrayFilters: [{ "item.productId": productId }] }
    );
   
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const addToCart = async (req, res) => {
  try {
    const productId = req.body.productId;

    await User.updateOne({ _id: req.session.userData._id }, { $addToSet: { cart: { productId: productId } } });

    res.status(200).json({ message: 'Product added to cart.' });
  } catch (error) {
    next(error);
  }
}

const removeCartProduct = async (req, res) => {
  try {
    await User.findByIdAndUpdate({ _id: req.session.userData._id }, { $pull: { cart: { productId: req.params.id } } });
    res.json("success")
  } catch (error) {
    next(error);
  }
}

module.exports = {
  cartLoad,
  addToCart,
  removeCartProduct,
  updateCartQuantity


}
