const express=require("express");
const axios=require("axios");
const cors=require("cors");
const multer=require("multer");
const fs=require("fs");
const mammoth=require("mammoth");
const {Document,Packer,Paragraph,TextRun}=require("docx");
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
        res.status(500).json({error:"Job fetch failed"});
    }
});

/* WORD OPTIMIZER */
app.post("/optimize",upload.single("resume"),async(req,res)=>{

    try{

        const buffer=fs.readFileSync(req.file.path);
        const parsed=await mammoth.extractRawText({buffer});
        const resumeText=parsed.value;
        const jobDesc=req.body.jobDesc;

        const ai=await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
                model:"gpt-4o-mini",
                messages:[
                    {role:"system",content:"Rewrite resume professionally keeping headings and bullet flow."},
                    {role:"user",content:`Resume:\n${resumeText}\n\nJob:\n${jobDesc}`}
                ]
            },
            {headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`}}
        );

        const optimized=ai.data.choices[0].message.content;

        const doc=new Document({
            sections:[{
                children:optimized.split("\n").map(line=>
                    new Paragraph({
                        children:[new TextRun({
                            text:line,
                            font:"Calibri",
                            size:20
                        })]
                    })
                )
            }]
        });

        const bufferDoc=await Packer.toBuffer(doc);
        res.setHeader("Content-Disposition","attachment; filename=Optimized_Resume.docx");
        res.send(bufferDoc);

    }catch(e){
        console.log(e);
        res.status(500).json({error:"Optimization failed"});
    }
});

app.listen(process.env.PORT||5000,()=>console.log("Server running"));
