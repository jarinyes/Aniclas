declare module 'better-sqlite3';

import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(__dirname, "aniclass.db"));

// Initialize Database
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      role TEXT DEFAULT 'student',
      points INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT UNIQUE,
      content TEXT,
      environment TEXT
    );

    CREATE TABLE IF NOT EXISTS quizzes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT UNIQUE,
      options TEXT, -- JSON string
      correct_answer TEXT,
      category TEXT,
      hint TEXT
    );

    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      game_type TEXT,
      score INTEGER,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS badges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      description TEXT,
      icon TEXT
    );

    CREATE TABLE IF NOT EXISTS user_badges (
      user_id INTEGER,
      badge_id INTEGER,
      PRIMARY KEY(user_id, badge_id),
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(badge_id) REFERENCES badges(id)
    );
  `);
  console.log("Database initialized successfully.");
} catch (error) {
  console.error("Database initialization failed:", error);
}

// Seed initial data
try {
  db.prepare("INSERT OR IGNORE INTO users (username, role) VALUES (?, ?)").run("Teacher", "teacher");
  
  // Seed some lessons
  const insertLesson = db.prepare("INSERT OR IGNORE INTO lessons (title, content, environment) VALUES (?, ?, ?)");
  insertLesson.run("Introduction to Mammals", "Mammals are warm-blooded animals with fur or hair. They give birth to live young and produce milk. Examples include lions, elephants, and humans!", "Forest");
  insertLesson.run("Reptile Residents", "Reptiles are cold-blooded animals with scales. They usually lay eggs on land. Snakes, turtles, and lizards are all reptiles you might find in the forest floor.", "Forest");
  
  insertLesson.run("The World of Fish", "Fish live in water, have scales, and breathe through gills. Most fish lay eggs. Sharks and goldfish are types of fish.", "Ocean");
  insertLesson.run("Deep Sea Wonders", "The ocean is home to giants like whales and clever creatures like octopuses. Mammals like dolphins also live here, but they breathe air through blowholes!", "Ocean");
  
  insertLesson.run("Birds of the Sky", "Birds have feathers, wings, and lay eggs. Most birds can fly! Eagles and parrots are famous birds.", "Sky");
  insertLesson.run("Feathery Flight", "Birds have hollow bones to help them stay light in the air. Not all birds fly - the penguin and ostrich are birds that prefer the ground and water!", "Sky");
  
  insertLesson.run("Farm Friends", "Farm animals are domestic animals raised for food or work. Cows, pigs, and chickens are common farm animals.", "Farm");
  insertLesson.run("Barnyard Life", "Horses help with work, sheep provide wool for clothes, and ducks love the farm pond. Every animal has a special job on the farm!", "Farm");

  // Seed some quizzes
  const insertQuiz = db.prepare("INSERT OR IGNORE INTO quizzes (question, options, correct_answer, category, hint) VALUES (?, ?, ?, ?, ?)");
  // Forest/Mammals
  insertQuiz.run("Which animal belongs to the mammal group?", JSON.stringify(["Snake", "Dog", "Eagle"]), "Dog", "Mammals", "They are known as man's best friend.");
  insertQuiz.run("Are mammals warm-blooded or cold-blooded?", JSON.stringify(["Warm-blooded", "Cold-blooded", "Both"]), "Warm-blooded", "Mammals", "Humans share this trait with other mammals.");
  insertQuiz.run("Which mammal is the largest land animal?", JSON.stringify(["Lion", "Elephant", "Giraffe"]), "Elephant", "Mammals", "They have long trunks and big ears.");
  
  // Ocean/Fish
  insertQuiz.run("What do fish use to breathe underwater?", JSON.stringify(["Lungs", "Gills", "Skin"]), "Gills", "Fish", "It's a specialized organ located on the sides of their heads.");
  insertQuiz.run("Which of these is a marine mammal, not a fish?", JSON.stringify(["Shark", "Dolphin", "Tuna"]), "Dolphin", "Ocean", "They breathe air and give birth to live young.");
  insertQuiz.run("How many hearts does an octopus have?", JSON.stringify(["One", "Two", "Three"]), "Three", "Ocean", "They have more than one to help pump their blue blood.");
  
  // Sky/Birds
  insertQuiz.run("Which of these animals has feathers?", JSON.stringify(["Lion", "Shark", "Parrot"]), "Parrot", "Birds", "This animal is known for its ability to mimic human speech.");
  insertQuiz.run("Which bird is famous for not being able to fly?", JSON.stringify(["Eagle", "Owl", "Penguin"]), "Penguin", "Birds", "They are excellent swimmers in cold waters.");
  insertQuiz.run("What is the only mammal that can truly fly?", JSON.stringify(["Flying Squirrel", "Bat", "Eagle"]), "Bat", "Sky", "They are nocturnal and use echolocation.");

  // Farm
  insertQuiz.run("Which animal is commonly found on a farm?", JSON.stringify(["Whale", "Cow", "Tiger"]), "Cow", "Farm", "This animal provides us with milk.");
  insertQuiz.run("Which farm animal provides wool for our clothes?", JSON.stringify(["Pig", "Sheep", "Chicken"]), "Sheep", "Farm", "They say 'Baa' and have fluffy coats.");
  insertQuiz.run("What does a rooster do in the morning?", JSON.stringify(["Sleep", "Crow", "Swim"]), "Crow", "Farm", "They make a loud 'Cock-a-doodle-doo' sound.");
  console.log("Seed data ensured.");
} catch (error) {
  console.error("Seeding failed:", error);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/login", (req, res) => {
    try {
      const { username } = req.body;
      if (!username) {
        return res.status(400).json({ error: "Username is required" });
      }
      let user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;
      if (!user) {
        const result = db.prepare("INSERT INTO users (username) VALUES (?)").run(username);
        user = db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);
      }
      if (!user) {
        return res.status(500).json({ error: "Failed to create or find user" });
      }
      res.json(user);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/user/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Fetch user error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/lessons", (req, res) => {
    try {
      const lessons = db.prepare("SELECT * FROM lessons").all();
      res.json(lessons);
    } catch (error) {
      console.error("Fetch lessons error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/quizzes", (req, res) => {
    try {
      const quizzes = db.prepare("SELECT * FROM quizzes").all();
      res.json(quizzes.map((q: any) => ({ ...q, options: JSON.parse(q.options) })));
    } catch (error) {
      console.error("Fetch quizzes error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/scores", (req, res) => {
    try {
      const { user_id, game_type, score } = req.body;
      if (!user_id || !game_type || score === undefined) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      db.prepare("INSERT INTO scores (user_id, game_type, score) VALUES (?, ?, ?)").run(user_id, game_type, score);
      
      // Update user points and level
      const user = db.prepare("SELECT points FROM users WHERE id = ?").get(user_id) as any;
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const newPoints = user.points + score;
      const newLevel = Math.floor(newPoints / 100) + 1;
      db.prepare("UPDATE users SET points = ?, level = ? WHERE id = ?").run(newPoints, newLevel, user_id);
      
      res.json({ success: true, newPoints, newLevel });
    } catch (error) {
      console.error("Submit score error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/leaderboard", (req, res) => {
    try {
      const leaderboard = db.prepare("SELECT username, points, level FROM users WHERE role = 'student' ORDER BY points DESC LIMIT 10").all();
      res.json(leaderboard);
    } catch (error) {
      console.error("Fetch leaderboard error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Teacher API
  app.get("/api/admin/stats", (req, res) => {
    try {
      const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'student'").get() as any;
      const avgScore = db.prepare("SELECT AVG(score) as avg FROM scores").get() as any;
      res.json({ totalUsers: totalUsers.count, avgScore: avgScore.avg || 0 });
    } catch (error) {
      console.error("Fetch admin stats error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false, // Explicitly disable HMR in middleware mode
      },
      appType: "spa",
      logLevel: 'error',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
