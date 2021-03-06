// imports
const express = require("express");
const router = express.Router();

// import in the Forms
const {
    bootstrapField,
    createProductForm,
    createSearchForm,
} = require('../forms');

// import product from product models, category (grouping products) & tags (for filter)
const { Product, Category, Tag } = require('../models');

// import in the CheckIfAuthenticated middleware
const {checkIfAuthenticated} = require('../middlewares/index');

// import in the DAL
const dataLayer = require('../dal/products')

// router.get('/index', async (req,res)=>{

//     // #2 - fetch all the products (ie, SELECT * from products)
//     let products = await Product.collection().fetch({
//     // and load each of their category relationship:
//         withRelated:['category']
//     });
//     res.render('products/index', {
//         'products': products.toJSON() // #3 - convert collection to JSON
//     })
// })

router.get('/index', async (req, res) => {

    // 1. get all the categories
    // all these datalayer is imported from dal/products.js so that the codes dont need to keep repeatedly typed for every new file
    const allCategories = await dataLayer.getAllCategories();
    
    // We manually add in a new category, '----', which simply represents no category selected. 
    // The value for this option is 0. 
    allCategories.unshift([0, '----']);

    // 2. Get all the tags
    const allTags = await dataLayer.getAllTags();

    // 3. Create search form 
    let searchForm = createSearchForm(allCategories, allTags);
    // creates a query builder that simply means "SELECT * from products". 
    // We can continue to add clauses to a query builder until we execute it with a fetch function call. 
    let q = Product.collection();

    searchForm.handle(req, {
        'empty': async (form) => {
            //  fetches all the products
            // renders the hbs file and passes it the products results and the form
            let products = await q.fetch({
                withRelated: ['category']
            })
            res.render('products/index', {
                'products': products.toJSON(),
                'form': form.toHTML(bootstrapField)
            })
        },
        //  Display all results if there are errors
        'error': async (form) => {
            let products = await q.fetch({
                withRelated: ['category']
            })
            res.render('products/index', {
                'products': products.toJSON(),
                'form': form.toHTML(bootstrapField)
            })
        },
        'success': async (form) => {
            if (form.data.name) {
                q = q.where('name', 'like', '%' + req.query.name + '%')
            }

            if (form.data.category) {
                q = q.query('join', 'categories', 'category_id', 'categories.id')
                    .where('categories.name', 'like', '%' + req.query.category + '%')
            }

            if (form.data.min_cost) {
                q = q.where('cost', '>=', req.query.min_cost)
            }

            if (form.data.max_cost) {
                q = q.where('cost', '<=', req.query.max_cost);
            }

            if (form.data.tags) {
                q.query('join', 'products_tags', 'products.id', 'product_id')
                    .where('tag_id', 'in', form.data.tags.split(','))
            }

            let products = await q.fetch({
                withRelated: ['category']
            })
            res.render('products/index', {
                'products': products.toJSON(),
                'form': form.toHTML(bootstrapField)
            })
        }
    })
})

router.get('/:product_id/views', async(req,res)=>{
    // retrieve the product: We retrieve the product instance with that specific product id and store it in the product variable.
    const productId = req.params.product_id
    const product = await dataLayer.getProductByID(productId);

    // fetch all the categories in the system and use that to populate the forms.
    const allCategories = await Category.fetchAll().map((category) => {
        return [category.get('id'), category.get('name')];
    })

    // fetch all the tags
    // displaying all the possible tags in the form
    const allTags = await Tag.fetchAll().map(tag => [tag.get('id'), tag.get('name')]);
    const productForm = createProductForm(allCategories, allTags);

    // fill in the existing values: 
    // we once again create a productForm. 
    // However this time round we assign the value of each field from its corresponding key in the product model instance.  
    productForm.fields.name.value = product.get('name');
    productForm.fields.cost.value = product.get('cost');
    productForm.fields.description.value = product.get('description');

    // set the initial value fo the category_id field of the form:
    // sets the form's category_id field value to be the same as the category_id from the product. 
    // When the form is displayed, the correct category will be selected by default.
    productForm.fields.category_id.value = product.get('category_id');

    // set the image url in the product form
    productForm.fields.image_url.value = product.get('image_url');

    // fill in the multi-select for the tags
    // read the current tags of the product and set them as the value of the tags field of the form.
    // This will set the default values of the tags multi-select to the current tags of the product.

    let selectedTags = await product.related('tags').pluck('id');
    productForm.fields.tags.value = selectedTags;

    res.render('products/views', {
        'form': productForm.toHTML(bootstrapField),
        'product': product.toJSON(),
        // send to the HBS file the cloudinary information
        cloudinaryName: process.env.CLOUDINARY_NAME,
        cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
        cloudinaryPreset: process.env.CLOUDINARY_UPLOAD_PRESET
    })
})

// create new content
// before the route is accessed, the checkIfAuthenticated middleware will be executed.
router.get('/create', checkIfAuthenticated, async (req, res) => {
    console.log(1)
    const allCategories = await Category.fetchAll().map((category) => {
        return [category.get('id'), category.get('name')];
    })
    const allTags = await Tag.fetchAll().map(tag => [tag.get('id'), tag.get('name')]);
    const productForm = createProductForm(allCategories, allTags);

    //    create have access to bootstrap and cloudinary
    res.render('products/create', {
        'form': productForm.toHTML(bootstrapField),
        cloudinaryName: process.env.CLOUDINARY_NAME,
        cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
        cloudinaryPreset: process.env.CLOUDINARY_UPLOAD_PRESET
    })
})

// before the route is accessed, the checkIfAuthenticated middleware will be executed.
router.post('/create', checkIfAuthenticated, async (req, res) => {

    // 1. Read in all the categories
    const allCategories = await Category.fetchAll().map((category) => {
        return [category.get('id'), category.get('name')];
    })

    //  reads in all the tags from the table and for each tag, store their id and name in an array. 
    // All the tags are then passed to the createProductForm function.

    const allTags = await Tag.fetchAll().map(tag => [tag.get('id'), tag.get('name')]);

    const productForm = createProductForm(allCategories, allTags);
    productForm.handle(req, {
        'success': async (form) => {
            // separate out tags from the other product data as not to cause an error when we create the new product
            // extract out the tags from the form data, and assign the rest of the form keys to be in a new object named productData
            let {
                tags,
                ...productData
            } = form.data;

            // 2. Save data from form into the new product instance
            // we pass all the data in the form to the product via the constructor. 
            // For this to work, the name of fields in the form must match the name of all columns in the table.
            const product = new Product(productData);
            product.set('name', form.data.name);
            product.set('cost', form.data.cost);
            product.set('description', form.data.description);
            await product.save();
            // save the many to many relationship
            // if the user has selected any tags; if so attach ID of those tags to the product. 
            // We have to use tags.split(',') because Caolan Forms will return the selected options from a multiple select as a comma delimited string.

            if (tags) {
                await product.tags().attach(tags.split(","));
            }
            // flash message appears after task is done
            req.flash("success_messages", `New Product ${product.get('name')} has been created`)
            res.redirect('/products/index');

        },
        'error': async (form) => {
            res.render('products/create', {
                'form': form.toHTML(bootstrapField)
            })
            // flash message appears after task is done
            res.flash('error_messages', 'Error creating the product')
        }
    })
})

// Updating the form
// this router is the get the infromation that is to be updated
router.get('/:product_id/update',checkIfAuthenticated, async (req, res) => {
    // retrieve the product: We retrieve the product instance with that specific product id and store it in the product variable.
    const productId = req.params.product_id
    const product = await dataLayer.getProductByID(productId);

    // fetch all the categories in the system and use that to populate the forms.
    const allCategories = await Category.fetchAll().map((category) => {
        return [category.get('id'), category.get('name')];
    })

    // fetch all the tags
    // displaying all the possible tags in the form
    const allTags = await Tag.fetchAll().map(tag => [tag.get('id'), tag.get('name')]);

    const productForm = createProductForm(allCategories, allTags);

    // fill in the existing values: 
    // we once again create a productForm. 
    // However this time round we assign the value of each field from its corresponding key in the product model instance.  
    productForm.fields.name.value = product.get('name');
    productForm.fields.cost.value = product.get('cost');
    productForm.fields.description.value = product.get('description');

    // set the initial value fo the category_id field of the form:
    // sets the form's category_id field value to be the same as the category_id from the product. 
    // When the form is displayed, the correct category will be selected by default.
    productForm.fields.category_id.value = product.get('category_id');

    // set the image url in the product form
    productForm.fields.image_url.value = product.get('image_url');

    // fill in the multi-select for the tags
    // read the current tags of the product and set them as the value of the tags field of the form.
    // This will set the default values of the tags multi-select to the current tags of the product.

    let selectedTags = await product.related('tags').pluck('id');
    productForm.fields.tags.value = selectedTags;

    res.render('products/update', {
        'form': productForm.toHTML(bootstrapField),
        'product': product.toJSON(),
        // send to the HBS file the cloudinary information
        cloudinaryName: process.env.CLOUDINARY_NAME,
        cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
        cloudinaryPreset: process.env.CLOUDINARY_UPLOAD_PRESET
    })
})

// this router is to push the updated information into the database

// we fetch the product by the product id from the URL parameters
router.post('/:product_id/update',checkIfAuthenticated, async (req, res) => {
    // fetch all the categories
    const allCategories = await Category.fetchAll().map((category) => {
        return [category.get('id'), category.get('name')];
    })

    // fetch the product that we want to update
    const product = await Product.where({
        'id': req.params.product_id
    }).fetch({
        require: true,
        withRelated: ['tags']
    });
    // console.log(product);
    // process the form:
    // If the form is successfully processed (i.e, no validation errors) and we use the product.
    // set function to overwrite the original product data with the data from the form. 
    // Then we instruct the product to save itself. 
    // If there's an error in the form, we just re-render the form to display the error messages.

    const productForm = createProductForm(allCategories);
    productForm.handle(req, {
        'success': async (form) => {
            //  retrieves the selected tags and the product data from the form
            let {
                tags,
                ...productData
            } = form.data;
            product.set(productData);
            product.save();

            // First, it goes through all the existing tags in the product and removes those not in the selected tags.
            // Second, it adds all the selected tags to the model. (under the .attach())
            let tagIds = tags.split(',');
            let existingTagIds = await product.related('tags').pluck('id');

            // remove all the tags that aren't selected anymore
            let toRemove = existingTagIds.filter(id => tagIds.includes(id) === false);
            await product.tags().detach(toRemove);
            // add in all the tags selected in the form
            await product.tags().attach(tagIds);

            // flash message appears after task is done
            req.flash("success_messages", ` ${product.get('name')} has been updated`)

            res.redirect('/products/index');
        },
        'error': async (form) => {
            res.render('products/update', {
                'form': form.toHTML(bootstrapField),
                'product': product.toJSON()
            })
            // flash message appears after task is done
            req.flash("error_messages", `Product ${product.get('name')} encountered an error while updating`)
        }
    })
})

// Deleting a form
router.get('/:product_id/delete',checkIfAuthenticated, async (req, res) => {
    // fetch the product that we want to delete
    const product = await Product.where({
        'id': req.params.product_id
    }).fetch({
        require: true
    });
    res.render('products/delete', {
        'product': product.toJSON()
    })
});

// process delete:
router.post('/:product_id/delete',checkIfAuthenticated, async (req, res) => {
// fetch the product that we want to delete
const product = await Product.where({
    'id': req.params.product_id
}).fetch({
    require: true
});
req.flash("success_messages", `Product ${product.get('name')} has been deleted`)
// destroy function basically just destroys that product that we fetch above
await product.destroy();
// flash message appears after task is done
res.redirect('/products/index')
})
module.exports = router;
