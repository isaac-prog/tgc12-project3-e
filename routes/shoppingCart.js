const express = require("express");
const router = express.Router();
const CartServices = require('../services/cart_services');
const {checkIfAuthenticated} = require('../middlewares/index');

router.get('/', async(req,res)=>{
    let cart = new CartServices(req.session.user.id);
    res.render('carts/index', {
        'shoppingCart': (await cart.getCart()).toJSON()
    })
})

router.get('/:product_id/add',checkIfAuthenticated, async (req,res)=>{
    let cart = new CartServices(req.session.user.id);
    await cart.addToCart(req.params.product_id, 1);
    req.flash('success_messages', 'Yay! Successfully added to cart')
    res.redirect('/products/index')
})

router.get('/:product_id/remove', async(req,res)=>{
    let cart = new CartServices(req.session.user.id);
    await cart.remove(req.params.product_id);
    req.flash("success_messages", "Item has been removed");
    res.redirect('/cart/');
})

router.post('/:product_id/quantity/update', async(req,res)=>{
    let cart = new CartServices(req.session.user.id);
    await cart.setQuantity(req.params.product_id, req.body.newQuantity);
    req.flash("success_messages", "Quantity updated")
    res.redirect('/cart/');
  })



module.exports=router;


