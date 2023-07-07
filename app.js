//jshint esversion:6
require("dotenv").config(); // this always put one for environment variable to be run back ----> const secret
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');
// const bcrypt = require("bcrypt");
// const saltRounds = 10; // saltRounds means that number of time password will be mixed up with random no.
// const md5 = require("md5");
// const encrypt = require("mongoose-encryption");

const app = express();

// this is used to deencrypt the keys
// console.log(md5("123456"));

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));

// Please maintain the order of the code of express-session,passport & passport-local-mongoose
app.use(session({
  secret: "Our little secret.",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB", {
  useNewUrlParser: true
});

// mongoose.set("useCreateIndex", true);

// 1. Create the Database ---> First Create a Schema with encrypt this ---> mongoose.Schema
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  secret: String
});

// This is for bcrypt & for google oaut- findOrCreate plugin
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

// Create the secret key
// const secret = "Thisisourlittlesecret.";
// userSchema.plugin(encrypt, { secret: process.env.SECRET, encryptedFields: ["password"] });


// 2. Create the new User Model
const User = new mongoose.model("User", userSchema);

// This is for bcrypt
passport.use(User.createStrategy());

// for one specific
// passport.serializeUser(User.serializeUser());
// passport.deserializeUser(User.deserializeUser());

//this code for any user of google
passport.serializeUser(function(user, cb) {
  process.nextTick(function() {
    return cb(null, {
      id: user.id,
      username: user.username,
      picture: user.picture
    });
  });
});

passport.deserializeUser(function(user, cb) {
  process.nextTick(function() {
    return cb(null, user);
  });
});


// Google oauth20
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo" // this ---> imp
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({
      googleId: profile.id
    }, function(err, user) {
      return cb(err, user);
    });
  }
));

// 0. Initial ---> get function is use to Create or take or listen the data from User ("/" means ---> go to that page and sync the data)
app.get("/", function(req, res) {
  res.render("home");
});

// oauth2.0
app.get("/auth/google",
  // this code will lead to run the Google sign in page
  passport.authenticate("google", {  scope: ["profile"] })
);

app.get("/auth/google/secrets",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect secrets page.
    res.redirect("/secrets");
  });


app.get("/login", function(req, res) {
  res.render("login");
});

app.get("/register", function(req, res) {
  res.render("register");
});

app.get("/secrets", function(req, res) {
  // if (req.isAuthenticated()) {
  //   res.render("secrets");
  // } else {
  //   res.render("login");
  // }
  User.find({"secret": {$ne:null}})
    .then(foundUsers => {
      res.render("secrets", {usersWithSecrets: foundUsers});
    })
    .catch(err => console.log(err));
});


app.get("/submit",function(req, res){
  if (req.isAuthenticated()) {
    res.render("submit");
  } else {
    res.render("login");
  }
});

app.post("/submit", function(req, res) {
  const submittedSecret = req.body.secret;
  console.log(req.user.id);
  User.findById(req.user.id)
    .then(foundUser => {
      if (foundUser) {
        foundUser.secret = submittedSecret;
        return foundUser.save();
      }
    })
    .then(() => res.redirect("/secrets"))
    .catch(err => console.log(err));
});


app.get("/logout", function(req, res) {
  req.logout(function(err) {
    if (err) {
      console.log(err);
    } else {
      res.redirect("/");
    }
  });
});

// 3. First of all User Enter the email and password to this register page and will be Catch by this & Responsed back to the User that is corrected or not:
//  post ---> read the data from the existing data or make availibity
app.post("/register", function(req, res) {
  // bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
  //   // Store hash in your password DB.
  //   const newUser = new User({
  //     email: req.body.username,
  //     password: hash
  //   });
  //
  //   newUser.save()
  //     .then(function() {
  //       // Render the "secrets" view if the user was saved successfully
  //       res.render("secrets");
  //     })
  //     .catch(function(err) {
  //       console.log(err);
  //       // Handle the error appropriately, e.g., by sending an error response
  //       res.status(500).send("Failed to save user.");
  //     });
  // });

  // Use of passport-local-mongoose doc
  User.register({
    username: req.body.username
  }, req.body.password, function(err, user) {
    if (err) {
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function() {
        res.redirect("/secrets");
      });
    }
  });

});

// 4. this is login page
app.post("/login", function(req, res) {
  //   const username = req.body.username;
  //   const password = req.body.password;
  //
  //   User.findOne({
  //       email: username
  //     })
  //     .then(function(foundUser) {
  //         if (foundUser) {
  //           bcrypt.compare(password, foundUser.password, function(err, result) {
  //             // result == true
  //             if (result === true) {
  //               res.render("secrets");
  //             }
  //           });
  //         }
  //     })
  // .catch(function(err) {
  //   console.log(err);
  //   // Handle the error appropriately, e.g., by sending an error response
  //   res.status(500).send("Failed to find user.");
  // });

  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(user, function(err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function() {
        res.redirect("/secrets");
      });
    }
  });
});


app.listen(3000, function() {
  console.log("Server started on port 3000");
});
