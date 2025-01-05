const express = require("express");
const fs = require("fs-extra");
const path = require("path");
const session = require("express-session");
const app = express();

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: "simple secret", // Change this to a real secret in production
    resave: false,
    saveUninitialized: true,
  })
);

// Middleware to read users data
const readUsers = async () => {
  const data = await fs.readFile(
    path.join(__dirname, "data", "users.txt"),
    "utf8"
  );
  return data
    .trim()
    .split("\n")
    .map((line) => {
      const [username, password] = line.split(":");
      return { username, password };
    });
};
// Testing
app.get("/test", (req, res) => {
  res.send("Hello Express!");
});
// Account Creation Page
app.get("/register", (req, res) => {
  res.render("register", { message: null });
});
// Routes
app.get("/home", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/dogcare", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dogcare.html"));
});

app.get("/catcare", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "catcare.html"));
});

app.get("/contact", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "contact.html"));
});

app.get("/privacy", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "privacy.html"));
});

app.get("/pet-success", (req, res) => {
  res.render("pet-success", { message: null });
});

// Handle Account Creation
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const users = await readUsers();

  if (users.some((user) => user.username === username)) {
    return res.render("register", { message: "Username is already in use." });
  }

  const newUser = `${username}:${password}\n`;
  await fs.appendFile(path.join(__dirname, "data", "users.txt"), newUser);
  res.render("login", {
    message: "Account created successfully. Please log in.",
  });
});

// Login Page
app.get("/login", (req, res) => {
  res.render("login", { message: null });
});

// Handle Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const users = await readUsers();
  const user = users.find(
    (user) => user.username === username && user.password === password
  );

  if (user) {
    req.session.user = user;
    res.redirect("dashboard");
  } else {
    res.render("login", { message: "Invalid credentials." });
  }
});

// Dashboard after Login
app.get("/dashboard", (req, res) => {
  if (req.session.user) {
    res.render("dashboard", { username: req.session.user.username });
  } else {
    res.redirect("/login");
  }
});

app.get("/give-pet", (req, res) => {
  if (!req.session.user) {
    res.redirect("/login");
  } else {
    res.render("give-pet", { username: req.session.user.username });
  }
});

// Handle Pet Submission
app.post("/submit-pet", async (req, res) => {
  if (!req.session.user) {
    res.redirect("/login");
  } else {
    const {
      petType,
      breed,
      age,
      gender,
      getsAlongDogs,
      getsAlongCats,
      suitableForChildren,
      comments,
      ownerName,
      ownerEmail,
    } = req.body;

    const petsData = await fs.readFile(
      path.join(__dirname, "data", "pets.txt"),
      "utf8"
    );
    const petsLines = petsData.trim().split("\n");
    let id = 1;

    if (petsLines.length > 0 && petsLines[0] !== "") {
      const lastId = parseInt(petsLines[petsLines.length - 1].split(":")[0]);
      if (!isNaN(lastId)) {
        id = lastId + 1;
      }
    }

    const newPet = `${id}:${
      req.session.user.username
    }:${petType}:${breed}:${age}:${gender}:${getsAlongDogs ? "yes" : "no"}:${
      getsAlongCats ? "yes" : "no"
    }:${
      suitableForChildren ? "yes" : "no"
    }:${comments}:${ownerName}:${ownerEmail}\n`;

    await fs.appendFile(path.join(__dirname, "data", "pets.txt"), newPet);
    res.render("pet-success");
  }
});

app.get("/search-pets", (req, res) => {
  res.render("search-pets");
});

app.post("/search-pets", async (req, res) => {
  const {
    type,
    breed,
    minAge,
    maxAge,
    gender,
    getsAlongDogs,
    getsAlongCats,
    suitableForChildren,
  } = req.body;

  // Read the pets data
  const petsData = await fs.readFile(
    path.join(__dirname, "data", "pets.txt"),
    "utf8"
  );
  const pets = petsData
    .trim()
    .split("\n")
    .map((line) => {
      const parts = line.split(":");
      return {
        id: parts[0],
        username: parts[1],
        type: parts[2],
        breed: parts[3],
        age: parts[4], // No need to parse as float if age will be compared as categories
        gender: parts[5],
        getsAlongDogs: parts[6] === "yes", // Boolean conversion
        getsAlongCats: parts[7] === "yes", // Boolean conversion
        suitableForChildren: parts[8] === "yes", // Boolean conversion
        comments: parts[9],
        ownerName: parts[10],
        ownerEmail: parts[11],
      };
    });

  // Filter pets based on input criteria
  const filteredPets = pets.filter((pet) => {
    return (
      (!type || pet.type.toLowerCase() === type.toLowerCase()) &&
      (!breed || pet.breed.toLowerCase().includes(breed.toLowerCase())) &&
      (!minAge || pet.age === minAge) &&
      (!maxAge || pet.age === maxAge) &&
      (!gender || pet.gender.toLowerCase() === gender.toLowerCase()) &&
      (getsAlongDogs === undefined ||
        pet.getsAlongDogs === (getsAlongDogs === "yes")) &&
      (getsAlongCats === undefined ||
        pet.getsAlongCats === (getsAlongCats === "yes")) &&
      (suitableForChildren === undefined ||
        pet.suitableForChildren === (suitableForChildren === "yes"))
    );
  });

  // Render a page to display results
  res.render("pet-results", { pets: filteredPets });
});

// Logout Handler
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      // Log the error and send an error response
      console.error("Error destroying session: ", err);
      return res.status(500).send("Could not log out, please try again.");
    }

    // Render a view and pass the logout success message to that view
    res.render("login", {
      message: "Logged out successfully.",
    });
  });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
