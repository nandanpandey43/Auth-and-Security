//jshint esversion:6
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');
// bcrypt is used for salting the passwords...
// const bcrypt = require('bcrypt');

// md5 is used for hashing, now using bcrypt to hash with salting
// const md5 = require('md5')

const app = express();
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended:true}));

app.use(session({
    secret: "My secret Here",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect('mongodb://localhost:27017/userDB', {useNewUrlParser:true, useUnifiedTopology: true});
mongoose.set("useCreateIndex", true);

// creating database of user containing email and password
const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    secret: String
});


///////////////////// encryption of password here /////////////////////
// userSchema.plugin(encrypt, { secret: process.env.SECRET, encryptedFields: ['password'] });


userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

// creating a User model with userSchema
const User = mongoose.model('User', userSchema);



passport.use(User.createStrategy());


passport.serializeUser(function(user, done) {
    done(null, user.id);
});
  
passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
      done(err, user);
    });
});


passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);

    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));





app.get("/", function(req,res){
    res.render('home')
});

app.get("/auth/google",
  passport.authenticate('google', { scope: ["profile"] })
);

app.get("/auth/google/secrets",
  passport.authenticate('google', { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect to secrets.
    res.redirect("/secrets");
});

app.get("/login", function(req,res){
    res.render('login')
});

app.get("/logout", function(req,res){
    req.logout();
    res.redirect('/');
});

app.get("/register", function(req,res){
    res.render('register')
});

app.get("/submit", function(req, res){
    if (req.isAuthenticated()){
      res.render("submit");
    } else {
      res.redirect("/login");
    }
});

app.get("/secrets", function(req, res){
    User.find({"secret": {$ne: null}}, function(err, foundUsers){
      if (err){
        console.log(err);
      } else {
        if (foundUsers) {
          res.render("secrets", {usersWithSecrets: foundUsers});
        }
      }
    });
});


app.post("/submit", function(req, res){
    const submittedSecret = req.body.secret;
  
  //Once the user is authenticated and their session gets saved, their user details are saved to req.user.
    // console.log(req.user.id);
  
    User.findById(req.user.id, function(err, foundUser){
      if (err) {
        console.log(err);
      } else {
        if (foundUser) {
          foundUser.secret = submittedSecret;
          foundUser.save(function(){
            res.redirect("/secrets");
          });
        }
      }
    });
});


// registering a new user to the databse
app.post("/register", function(req,res){

    User.register({username: req.body.username}, req.body.password, function(err, user){
        if(err){
            console.log(err);
            res.redirect("/register");
        }else{
            passport.authenticate("local")(req, res, function(){
                res.redirect("/secrets")
            });
        }
    });



    // bcrypt.hash(req.body.password, 5, function(err, hash){
    //     const newUser = new User({
    //         email: req.body.username,
    //         password: hash
    //     });

    //     newUser.save(function(err, registeredUser){
    //         if(!err){
    //             res.render("secrets");
    //         }
    //         else{
    //             console.log(err);
    //         }
    //     });
        
    // });   
    
});

// accessing the userbase data in order to grant access to the secret page
app.post("/login", function(req, res){


    const user = new User({
        username: req.body.username,
        password: req.body.password
    });

    req.login(user, function(err){
        if(err){
            console.log(err);
        }else{
            passport.authenticate("local")(req, res, function(){
                res.redirect("/secrets");
            });
        }
    });





    // User.findOne({email: req.body.username}, function(err, foundUser){
    //     if(err){
    //         console.log(err);
    //     }else 
    //         bcrypt.compare(req.body.password, foundUser.password, function(err, result){
    //             if(result === true){
    //                 res.render('secrets');
    //             }
    //         });
    // });
});



app.listen("3000", function(req, res){
    console.log("server started at port 3000...");
});