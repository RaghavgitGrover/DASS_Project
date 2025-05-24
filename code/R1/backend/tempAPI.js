import express from "express";
import { readFile } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import cors from "cors"; // Import CORS

const __dirname = dirname(fileURLToPath(import.meta.url)); // Define __dirname manually

const app = express();
const PORT = 3001;

app.use(cors()); // Enable CORS

app.get("/data", (req, res) => {
  const filePath = join(__dirname, "2425midsemspringdata.json");
  readFile(filePath, "utf8", (err, data) => {
    if (err) {
      res.status(500).json({ error: "Failed to read file" });
    } else {
      res.setHeader("Content-Type", "application/json");
      res.send(data);
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
