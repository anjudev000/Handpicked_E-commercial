
const dotenv = require("dotenv");
dotenv.config();
const fs = require("fs")
const Category = require('../model/categorySchema');
const Product = require('../model/productSchema');
const path = require('path');
const sharp = require('sharp');




const productLoad = async (req, res, next) => {
  try {
    const productData = await Product.aggregate([
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'category'
        }
      },
      {
        $addFields: {
          category: { $arrayElemAt: ['$category.category', 0] }
        }
      }
    ]);
    res.render('admin/product', { product: productData });
  }
  catch (error) {
    next(error);
  }
}

const addProductLoad = async (req, res, next) => {
  try {

    const categoryData = await Category.find({});

    res.render('admin/addNewProduct', { category: categoryData });

  }
  catch (error) {
    next(error);
  }
}
const productUpload = async (req, res, next) => {
  const images = req.files.map((file) => {
    return file.filename;
  });

  try {
    if (
      req.body.name != "" &&
      req.body.price != "" &&
      req.body.description != "" &&
      req.body.stock != "" &&
      req.body.category != ""
    ) {
      const productData = new Product({
        productName: req.body.name,
        price: req.body.price,
        description: req.body.description,
        stock: req.body.stock,
        category: req.body.category,
        __v: 1,
        images: images,
        is_deleted: false,
      });
       // Perform image cropping
       const croppedImages = await Promise.all(
        
        images.map(async (image) => {
          const imagePath = path.join("public", "images", image);
          console.log(imagePath,"yessssssssssss");
          // Perform image cropping using sharp library
          const croppedImage = await sharp(imagePath)
            .resize(1001,801) // Set desired width/height for cropped image
            .toBuffer(); // Convert to buffer
          console.log("here alsoo",croppedImage)
          // Write the cropped image back to the file system
          fs.writeFileSync(imagePath, croppedImage);

          return image;
        })
      );

      await productData.save();
      req.session.messager = "";
      const message = "Product added successfully";
      req.session.productMessage = message;
      res.redirect("/productList");
    } else {
      const message = "Fields cannot be blank";
      req.session.messager = message;
      res.redirect(`/addNewProduct?message=${message}`);
    }
  } catch (error) {
    next(error);
  }
};

const deleteProduct = async (req, res, next) => {
  try {
    const id = req.body.id;
    const response = await Product.findByIdAndUpdate(id, { $set: { is_deleted: true } });
    res.json(response);
  } catch (error) {
    next(error);
  }
};
const productEdit = async (req, res, next) => {
  try {

    const id = req.query.id;
    const productData = await Product.findById({ _id: id });
    const categoryData = await Category.find({});
    if (productData) {
      res.render('admin/editProduct', { product: productData, category: categoryData });
    }
    else {
      res.redirect('/productList');
    }

  }
  catch (error) {
    next(error);
  }
}
const updateProduct = async (req, res, next) => {
  const id = req.query.id;
  const product = await Product.findById(id);
  const images = req.files ? req.files.map((file) => file.filename) : [];
  const updation = {
    $set: {
      productName: req.body.name,
      price: req.body.price,
      description: req.body.description,
      stock: req.body.stock,
      category: req.body.category,
      is_deleted: false,
    },
  };
  if (images.length > 0) {
    updation.$push = { images: { $each: images } };
  }
  try {
    const result = await Product.updateOne({ _id: id }, updation);
    if (result) {
      res.redirect("/productList");
    } else {
      throw new Error("Product not found");
    }
  } catch (error) {
    next(error);
  }
};

const removeImage = async (req, res, next) => {
  const imgName = req.params.imgName;
  const imagePath = path.join("public", "images", imgName);

  try {
    const result = await Product.updateOne(
      { images: imgName }, // Filter by the image name
      { $pull: { images: imgName } } // Use $pull to remove the image from the array
    );
    if (result) {
      res.status(200).json({ success: true });
    }
  } catch (error) {
    next(error);
  }
}

module.exports = {
  productLoad,
  addProductLoad,
  productUpload,
  deleteProduct,
  productEdit,
  updateProduct,
  removeImage
}