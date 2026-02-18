const express = require("express");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs");
const PDFDocument = require("pdfkit");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static(__dirname));

/* HOMEPAGE ROUTE */
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

/* JOB FETCH */
app.get("/api/jobs", async (req, res) => {
  const role = req.query.role || "Business Analyst";

  try {
    const r = await axios.get(
      "https://api.adzuna.com/v1/api/jobs/in/search/1",
      {
        params: {
          app_id: process.env.APP_ID,
          app_key: process.env.APP_KEY,
          what: role,
          results_per_page: 10,
        },
      }
    );

    res.json(r.data.results);
  } catch (e) {
    console.log(e.message);
    res.status(500).json({ error: "Job fetch failed" });
  }
});

/* RESUME OPTIMIZER */
app.post("/optimize", async (req, res) => {
  try {
    const { resumeText, jobDesc } = req.body;

    const ai = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Rewrite this resume professionally using the job description keywords. Keep formatting ATS-friendly.",
          },
          {
            role: "user",
            content: `Resume:\n${resumeText}\n\nJob:\n${jobDesc}`,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    const text = ai.data.choices[0].message.content;

    const path = "optimized.pdf";
    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(path));
    doc.fontSize(11).text(text, { width: 450 });
    doc.end();

    setTimeout(() => res.download(path), 600);
  } catch (e) {
    console.log(e.message);
    res.status(500).json({ error: "Optimization failed" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Server running"));
