const express=require("express");
const axios=require("axios");
const cors=require("cors");
const multer=require("multer");
const fs=require("fs");
const PDFDocument=require("pdfkit");
const mammoth=require("mammoth");
require("dotenv").config();

const app=express();
const upload=multer({dest:"uploads/"});

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.get("/",(req,res)=>res.sendFile(__dirname+"/index.html"));

/* JOB FETCH */
app.get("/api/jobs",async(req,res)=>{
    const role=req.query.role||"Business Analyst";

    try{
        const r=await axios.get("https://api.adzuna.com/v1/api/jobs/in/search/1",{
            params:{
                app_id:process.env.APP_ID,
                app_key:process.env.APP_KEY,
                what:role,
                results_per_page:10
            }
        });

        const jobs=r.data.results.map(j=>({
            role:j.title,
            company:j.company.display_name,
            location:j.location.display_name,
            salary:j.salary_max||"Not specified",
            description:j.description,
            source:j.redirect_url
        }));

        res.json(jobs);

    }catch(e){
        console.log("JOB FETCH ERROR:",e.message);
        res.status(500).json({error:"Job fetch failed"});
    }
});

/* OPTIMIZER — SAFE VERSION */
app.post("/optimize",upload.single("resume"),async(req,res)=>{

    try{

        const buffer=fs.readFileSync(req.file.path);
        const parsed=await mammoth.extractRawText({buffer});
        const resumeText=parsed.value;
        const jobDesc=req.body.jobDesc;

        let optimizedText=resumeText; // fallback

        try{
            const ai=await axios.post(
                "https://api.openai.com/v1/chat/completions",
                {
                    model:"gpt-4o-mini",
                    messages:[
                        {role:"system",content:"Rewrite resume professionally for ATS."},
                        {role:"user",content:`Resume:\n${resumeText}\n\nJob:\n${jobDesc}`}
                    ]
                },
                {headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`}}
            );

            optimizedText=ai.data.choices[0].message.content;

        }catch(aiError){
            console.log("OPENAI ERROR:",aiError.response?.data||aiError.message);
        }

        const path="optimized_resume.pdf";
        const doc=new PDFDocument({margin:50});
        const stream=fs.createWriteStream(path);

        doc.pipe(stream);
        doc.fontSize(10).text(optimizedText,{align:"left"});
        doc.end();

        stream.on("finish",()=>{
            res.download(path,()=>fs.unlinkSync(path));
        });

    }catch(e){
        console.log("OPTIMIZER CRASH:",e);
        res.status(500).send("Server error");
    }
});

app.listen(process.env.PORT||5000,()=>console.log("Server running"));
