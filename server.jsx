import { useState, useEffect } from "react";
import mammoth from "mammoth";

export default function Resumes(){

  const [resume,setResume]=useState(
    localStorage.getItem("resumeText") || ""
  );

  const [jd,setJd]=useState(
    localStorage.getItem("jobJD") || ""
  );

  const [loading,setLoading]=useState(false);
  const [progress,setProgress]=useState(0);
  const [output,setOutput]=useState("");

  useEffect(()=>{
    const savedJD=localStorage.getItem("jobJD");
    if(savedJD) setJd(savedJD);
  },[]);

  async function handleFile(e){
    const file=e.target.files[0];
    if(!file) return;

    const arrayBuffer=await file.arrayBuffer();
    const result=await mammoth.extractRawText({arrayBuffer});
    const text=result.value;

    setResume(text);
    localStorage.setItem("resumeText",text);
  }

  function downloadTXT(){
    const blob=new Blob([output],{type:"text/plain"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download="Optimized_Resume.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadDOC(){
    const formatted=output.replace(/\n/g,"<br/>");
    const html=`<html><body style="font-family:Calibri;padding:40px">${formatted}</body></html>`;
    const blob=new Blob([html],{type:"application/msword"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download="Optimized_Resume.doc";
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadPDF(){
    const win=window.open("");
    win.document.write(`
      <html>
      <body style="font-family:Arial;padding:40px;white-space:pre-wrap">
      ${output}
      </body>
      </html>
    `);
    win.document.close();
    win.print();
  }

  async function optimize(){

    if(!resume || !jd) return alert("Upload resume and add job description first");

    setLoading(true);
    setProgress(10);

    try{
      const res=await fetch("https://api.openai.com/v1/chat/completions",{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "Authorization":`Bearer ${import.meta.env.VITE_OPENAI_KEY}`
        },
        body:JSON.stringify({
          model:"gpt-4.1-mini",
          messages:[
            {
              role:"system",
              content:"You are a resume optimization expert."
            },
            {
              role:"user",
              content:`JOB DESCRIPTION:\n${jd}\n\nRESUME:\n${resume}`
            }
          ]
        })
      });

      setProgress(60);

      const data=await res.json();
      const text=data.choices?.[0]?.message?.content || "No output";

      setOutput(text);
      localStorage.setItem("resumeText",text);

      setProgress(100);

    }catch(e){
      alert("Error optimizing resume");
    }

    setLoading(false);
  }

  return(
    <div>

      <h1>Resume Optimizer</h1>

      <div style={{marginTop:"20px"}}>
        <input type="file" accept=".docx" onChange={handleFile}/>
      </div>

      <div style={{display:"flex",gap:"20px",marginTop:"20px"}}>

        <textarea
          value={resume}
          onChange={e=>{
            setResume(e.target.value);
            localStorage.setItem("resumeText",e.target.value);
          }}
          style={{flex:1,height:"300px"}}
        />

        <textarea
          value={jd}
          onChange={e=>{
            setJd(e.target.value);
            localStorage.setItem("jobJD",e.target.value);
          }}
          style={{flex:1,height:"300px"}}
        />

      </div>

      {/* COLOURED OPTIMIZE BUTTON */}
      <button onClick={optimize} style={optimizeBtn}>
        ⚡ Optimize Resume {loading && `(${progress}%)`}
      </button>

      {output && (
        <div style={{marginTop:"15px",display:"flex",gap:"10px"}}>
          <button style={txtBtn} onClick={downloadTXT}>⬇ TXT</button>
          <button style={docBtn} onClick={downloadDOC}>⬇ DOC</button>
          <button style={pdfBtn} onClick={downloadPDF}>⬇ PDF</button>
        </div>
      )}

      {output && (
        <div style={{marginTop:"30px"}}>
          <h3>Optimized Resume</h3>
          <pre style={{whiteSpace:"pre-wrap"}}>{output}</pre>
        </div>
      )}

    </div>
  );
}

/* BUTTON STYLES */

const optimizeBtn={
  marginTop:"20px",
  background:"#7c3aed",
  color:"#fff",
  border:"none",
  padding:"10px 16px",
  borderRadius:"8px",
  cursor:"pointer",
  fontWeight:"600"
};

const txtBtn={background:"#475569",color:"#fff",border:"none",padding:"8px 14px",borderRadius:"6px",cursor:"pointer"};
const docBtn={background:"#2563eb",color:"#fff",border:"none",padding:"8px 14px",borderRadius:"6px",cursor:"pointer"};
const pdfBtn={background:"#dc2626",color:"#fff",border:"none",padding:"8px 14px",borderRadius:"6px",cursor:"pointer"};
