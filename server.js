const express = require("express");
const axios = require("axios");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const mammoth = require("mammoth");
const { Document, Packer, Paragraph, TextRun } = require("docx");
require("dotenv").config();

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"));

/* ATS OPTIMIZER */
app.post("/optimize", upload.single("resume"), async (req, res) => {

    try {

        if (!req.file) return res.status(400).send("No file uploaded");

        const buffer = fs.readFileSync(req.file.path);

        const parsed = await mammoth.extractRawText({ buffer });
        const resumeText = parsed.value || "No text detected in resume.";

        const jobDesc = req.body.jobDesc || "";

        let optimized = resumeText;

        /* REAL OPENAI CALL */
        try {
            const ai = await axios.post(
                "https://api.openai.com/v1/chat/completions",
                {
                    model: "gpt-4o-mini",
                    messages: [
                        {
                            role: "system",
                            content:
                                "Rewrite this resume so it strongly matches the job description. Add missing keywords, improve bullets, and optimize for ATS."
                        },
                        {
                            role: "user",
                            content:
                                `JOB:\n${jobDesc}\n\nRESUME:\n${resumeText}`
                        }
                    ],
                    temperature: 0.3
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
                    }
                }
            );

            optimized = ai.data.choices[0].message.content;

        } catch (aiError) {
            console.log("OPENAI FAILED:", aiError.response?.data || aiError.message);
        }

        /* BUILD WORD FILE */
        const doc = new Document({
            sections: [{
                children: optimized.split("\n").map(line =>
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: line,
                                font: "Calibri",
                                size: 20
                            })
                        ]
                    })
                )
            }]
        });

        const bufferDoc = await Packer.toBuffer(doc);

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        );
        res.setHeader(
            "Content-Disposition",
            "attachment; filename=Optimized_Resume.docx"
        );
        res.send(bufferDoc);

    } catch (e) {
        console.log("SERVER ERROR:", e);
        res.status(500).send("Server error");
    }
});

app.listen(process.env.PORT || 5000, () => console.log("Server running"));
