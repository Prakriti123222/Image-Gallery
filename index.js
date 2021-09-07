require('dotenv').config()
const express = require('express');
const bodyParser = require("body-parser");
const ejs = require("ejs");
const cookieParser = require('cookie-parser')
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const app = express();

// Google Auth
const { OAuth2Client } = require('google-auth-library');
const CLIENT_ID = process.env.CLIENT_ID;
const client = new OAuth2Client(CLIENT_ID);

app.set('view engine', 'ejs');
app.use(express.json());
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

mongoose.connect(process.env.CONNECTION, { useNewUrlParser: true });

var storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads');
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now())
    }
});
// file size nd file type
var upload = multer({ storage: storage });

const PORT = 3000;

const postSchema = {
    // title: String,
    name: String,
    email: String,
    content: String,
    img:
    {
        data: Buffer,
        contentType: String
    }
};

const Post = mongoose.model("Post", postSchema);

app.get("/", function (req, res) {
    Post.find({}, (err, items) => {
        if (err) {
            console.log(err);
            res.status(500).send('An error occurred', err);
        }
        else {
            res.render('home', { items: items });
        }
    });
    // res.render("home");
})

// app.post('/upload', upload.single('image'), async (req, res) => {
//     const { filename: image } = req.file

//     await sharp(req.file.path)
//         .resize(500)
//         .jpeg({ quality: 50,  compressionLevel: 9 })
//         .toFile(
//             path.resolve(req.file.destination, 'resized', image)
//         )
//     fs.unlinkSync(req.file.path)

//     return res.redirect("/add-image");
// })

app.post('/add-image', checkAuthenticated, upload.single('image'), async (req, res, next) => {
    let user = req.user;
    // console.log(user);
    // console.log(req);
    // console.log(req);
    if ((req.file.originalname.endsWith(".jpeg") || req.file.originalname.endsWith(".jfif") || req.file.originalname.endsWith(".tif") || req.file.originalname.endsWith(".tiff") || req.file.originalname.endsWith(".raw") || req.file.originalname.endsWith(".jpg") || req.file.originalname.endsWith(".png")) && (req.file.size < 2097152)) {
        var filePath = path.join(__dirname + '/uploads/' + req.file.filename);
        // console.log(filePath);
        var newFilePath = path.join(__dirname + '/resized/' + req.file.filename);
        await sharp(filePath).resize(600, 450).toFormat('webp').toFile(newFilePath);
        var obj = {
            //   title: req.body.name,
            name: user.name,
            email: user.email,
            content: req.body.desc,
            img: {
                data: fs.readFileSync(newFilePath),
                contentType: 'image/png'
            },
        }
        Post.create(obj, (err, item) => {
            if (err) {
                console.log(err);
            }
            else {
                // item.save();
                res.redirect('/add-image');
            }
        });
    } else {
        res.redirect('/add-image');
    }
});

app.get("/delete/:id", function (req, res, next) {
    var id = req.params.id;
    // console.log(id);
    var deleteImg = Post.findByIdAndDelete(id);
    deleteImg.exec(function (err, data) {
        if (err) {
            // res.redirect("/add-image", {msg: "Deleted"});
            // try adding success / error method
            throw err;
        };
        res.redirect("/add-image");
    });
});

// app.get("/edit/:id", function (req, res, next) {
//     var id = req.params.id;
//     var updateImg = Post.findById(id);
//     updateImg.exec(function (err, data) {
//         if (err) {
//             // res.redirect("/add-image", {msg: "Deleted"});
//             // try adding success / error method
//             throw err;
//         };
//         res.render("edit", { record: data });
//     });
// })

// app.post("/update", function (req, res, next) {
//     // console.log(req.body.desc);
//     // console.log(req.body.id);
//     Post.findByIdAndUpdate(req.body.id, {
//         content: req.body.desc
//     }, function(err){
//         if (err)
//         console.log(err);
//     });
//     // update.exec(function(err,data){
//     //     if (err) throw err;
//     //     res.redirect("/add-image")
//     // })
//     res.redirect("/add-image");
//     // res.send("sent");
// })

app.get("/add-image", checkAuthenticated, function (req, res) {
    let user = req.user;
    Post.find({ name: user.name, email: user.email }, (err, items) => {
        if (err) {
            console.log(err);
            res.status(500).send('An error occurred', err);
        }
        else {
            res.render('add-image', { items: items, user: user });
            // console.log(items);
        }
    });
    // res.render("add-image", { user });
});

app.get('/login', (req, res) => {
    res.render('login');
})

app.get('/logout', (req, res) => {
    res.clearCookie('session-token');
    res.redirect('/');
});

app.post('/login', (req, res) => {
    let token = req.body.token;

    async function verify() {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: CLIENT_ID,  // Specify the CLIENT_ID of the app that accesses the backend
        });
        const payload = ticket.getPayload();
        const userid = payload['sub'];
    }
    verify()
        .then(() => {
            res.cookie('session-token', token);
            res.send('success')
        })
        .catch(console.error);

})

function checkAuthenticated(req, res, next) {

    let token = req.cookies['session-token'];

    let user = {};
    async function verify() {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: CLIENT_ID,  // Specify the CLIENT_ID of the app that accesses the backend
        });
        const payload = ticket.getPayload();
        user.name = payload.name;
        user.email = payload.email;
        user.picture = payload.picture;
    }
    verify()
        .then(() => {
            req.user = user;
            next();
        })
        .catch(err => {
            res.redirect('/login')
        })
}

app.listen(process.env.PORT || 3000, () => {
    console.log(`Server running on port ${PORT}`);
})

// EDIT CODE OF ADD-IMAGES.EJS
{/* <a class="btn btn-primary btn-xs" href="/edit/<%=image._id%>"><i
                                                    class="fa fa-2x fa-edit"></i></a> */}