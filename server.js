const express=require("express");
const axios=require("axios");
const cors=require("cors");
const multer=require("multer");
const fs=require("fs");
const PDFDocument=require("pdfkit");
const pdfParse=require("pdf-parse");
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
        console.log(e.message);
        res.status(500).json({error:"Job fetch failed"});
    }
});

/* RESUME OPTIMIZER */
app.post("/optimize",upload.single("resume"),async(req,res)=>{

    try{

        const buffer=fs.readFileSync(req.file.path);
        const parsed=await pdfParse(buffer);

        const resumeText=parsed.text;
        const jobDesc=req.body.jobDesc;

        const ai=await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
                model:"gpt-4o-mini",
                messages:[
                    {role:"system",content:"Rewrite this resume professionally for ATS optimization."},
                    {role:"user",content:`Resume:\n${resumeText}\n\nJob:\n${jobDesc}`}
                ]
            },
            {headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`}}
        );

        const optimized=ai.data.choices[0].message.content;

        const path="optimized_resume.pdf";
        const doc=new PDFDocument({margin:50});
        doc.pipe(fs.createWriteStream(path));
        doc.fontSize(11).text(optimized,{align:"left"});
        doc.end();

        setTimeout(()=>res.download(path),800);

    }catch(e){
        console.log(e);
        res.status(500).json({error:"Optimization failed"});
    }
});

app.listen(process.env.PORT||5000,()=>console.log("Server running"));
