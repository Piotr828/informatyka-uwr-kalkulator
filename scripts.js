const THEMATIC_TAGS=["RPiS","IO","PiPO","ASK","SO","SK","BD"];
const TAGS_PRESET=[...THEMATIC_TAGS];
const RULES={minI:66,minIInz:12,minKInz:10,needP:1,minOIKP:170,thematicMin:28,thematicEachAtLeastOne:true,needPS:1,minPraktyki:4,minHS:5,minOWI:1,minE:2,needAngielski:1};
document.addEventListener("DOMContentLoaded",()=>{
  const semestersEl=document.getElementById("semesters");
  const tplSem=document.getElementById("tpl-semester");
  const tplCourse=document.getElementById("tpl-course");
  const btnSave=document.getElementById("btn-save");
  const fileInput=document.getElementById("file-input");
  const qs=(s,r=document)=>r.querySelector(s);
  function initChoices(el,opts){return new Choices(el,Object.assign({removeItemButton:true,placeholder:true,searchPlaceholderValue:"Szukaj",noResultsText:"Brak wyników",shouldSort:false},opts||{}))}
  function createCourseRow(){
    const node=tplCourse.content.firstElementChild.cloneNode(true);
    const typeSel=qs(".type-select",node);
    const tagsSel=qs(".tags-select",node);
    tagsSel.innerHTML="";
    TAGS_PRESET.forEach(tag=>{const o=document.createElement("option");o.value=tag;o.textContent=tag;tagsSel.appendChild(o)});
    initChoices(typeSel,{placeholderValue:"Typ"});
    initChoices(tagsSel,{placeholderValue:"Tagi",duplicateItemsAllowed:false,addItems:true});
    qs(".remove-course",node).addEventListener("click",()=>{
      const sem=node.closest(".semester");
      node.remove();
      if(qs(".courses",sem).children.length===0){sem.remove();renumberSemesters()}
      recalcECTS();renderChecklist();updateSaveMode()
    });
    qs(".ects",node).addEventListener("input",onDataChanged);
    qs(".subject",node).addEventListener("input",onDataChanged);
    typeSel.addEventListener("change",onDataChanged);
    tagsSel.addEventListener("change",onDataChanged);
    return node
  }
  function createSemester(){
    const node=tplSem.content.firstElementChild.cloneNode(true);
    qs(".courses",node).appendChild(createCourseRow());
    return node
  }
  function addSemester(){
    const sem=createSemester();
    semestersEl.appendChild(sem);
    renumberSemesters();recalcECTS();renderChecklist();updateSaveMode()
  }
  function addCourseToCurrent(){
    let last=semestersEl.lastElementChild;
    if(!last){addSemester();last=semestersEl.lastElementChild}
    qs(".courses",last).appendChild(createCourseRow());
    recalcECTS();renderChecklist();updateSaveMode()
  }
  function renumberSemesters(){Array.from(semestersEl.children).forEach((sem,i)=>{qs(".semester-title",sem).textContent=`Semestr ${i+1}`})}
  function getAllCourses(){
    const out=[];
    Array.from(semestersEl.children).forEach((sem,sidx)=>{
      Array.from(qs(".courses",sem).children).forEach(row=>{
        const subject=(qs(".subject",row).value||"").trim();
        const ects=Number(qs(".ects",row).value)||0;
        const types=Array.from(qs(".type-select",row).selectedOptions).map(o=>o.value);
        const tags=Array.from(qs(".tags-select",row).selectedOptions).map(o=>o.value);
        out.push({subject,ects,types,tags,semester:sidx+1})
      })
    });
    return out
  }
  function recalcECTS(){
    let total=0;
    Array.from(semestersEl.children).forEach(sem=>{
      const sum=Array.from(qs(".courses",sem).children).reduce((a,row)=>a+(Number(qs(".ects",row).value)||0),0);
      qs(".ects-sem",sem).textContent=sum;total+=sum
    });
    document.getElementById("ects-total").textContent=total
  }
  function computeStatus(){
    const courses=getAllCourses();
    const sumWhere=p=>courses.reduce((a,c)=>a+(p(c)?c.ects:0),0);
    const countWhere=p=>courses.reduce((a,c)=>a+(p(c)?1:0),0);
    const hasType=(c,t)=>c.types.includes(t);
    const hasAnyType=(c,arr)=>arr.some(t=>hasType(c,t));
    const hasAnyTag=(c,arr)=>arr.some(t=>c.tags.includes(t));
    const sumI=sumWhere(c=>hasType(c,"I"));
    const sumIInz=sumWhere(c=>hasType(c,"IInż"));
    const sumKInz=sumWhere(c=>hasType(c,"Kinż"));
    const sumOIKP=sumWhere(c=>hasAnyType(c,["O","I","K","P"]));
    const sumHS=sumWhere(c=>hasType(c,"HS"));
    const sumOWI=sumWhere(c=>hasType(c,"OWI"));
    const sumE=sumWhere(c=>hasType(c,"E"));
    const sumPr=sumWhere(c=>hasType(c,"PRAKTYKI"));
    const sumThematic=sumWhere(c=>hasAnyTag(c,THEMATIC_TAGS));
    const cntP=countWhere(c=>hasType(c,"P"));
    const cntPS=countWhere(c=>hasType(c,"PS"));
    const cntAng=countWhere(c=>hasType(c,"ANGIELSKI"));
    const thematicCovered=Object.fromEntries(THEMATIC_TAGS.map(t=>[t,countWhere(c=>c.tags.includes(t))>0]));
    return{details:{sumI,sumIInz,sumKInz,sumOIKP,sumHS,sumOWI,sumE,sumPr,sumThematic,cntP,cntPS,cntAng,thematicCovered},
      checks:{
        I:sumI>=RULES.minI,
        IInz:sumIInz>=RULES.minIInz,
        KInz:sumKInz>=RULES.minKInz,
        P:cntP>=RULES.needP,
        OIKP:sumOIKP>=RULES.minOIKP,
        THEMIN:sumThematic>=RULES.thematicMin,
        THEEACH:RULES.thematicEachAtLeastOne?THEMATIC_TAGS.every(t=>thematicCovered[t]):true,
        PS:cntPS>=RULES.needPS,
        PRAKTYKI:sumPr>=RULES.minPraktyki,
        HS:sumHS>=RULES.minHS,
        OWI:sumOWI>=RULES.minOWI,
        E:sumE>=RULES.minE,
        ANG:cntAng>=RULES.needAngielski
      }}
  }
  function renderChecklist(){
    const cl=document.getElementById("checklist");cl.innerHTML="";
    const {details,checks}=computeStatus();
    const rows=[
      {ok:checks.I,text:`I ≥ ${RULES.minI} ECTS (masz ${details.sumI})`},
      {ok:checks.IInz,text:`IInż ≥ ${RULES.minIInz} ECTS (masz ${details.sumIInz})`},
      {ok:checks.KInz,text:`Kinż ≥ ${RULES.minKInz} ECTS (masz ${details.sumKInz})`},
      {ok:checks.P,text:`Projekt P: co najmniej 1 (masz ${details.cntP})`},
      {ok:checks.OIKP,text:`O+I+K+P ≥ ${RULES.minOIKP} ECTS (masz ${details.sumOIKP})`},
      {ok:checks.THEMIN,text:`Przedmioty tematyczne ≥ ${RULES.thematicMin} ECTS (masz ${details.sumThematic})`},
      {ok:checks.THEEACH,text:`Każdy znacznik tematyczny co najmniej raz: ${THEMATIC_TAGS.map(t=>`${t}:${details.thematicCovered[t]?"✓":"–"}`).join(" ")}`},
      {ok:checks.PS,text:`Proseminarium (PS): ≥ ${RULES.needPS}`},
      {ok:checks.PRAKTYKI,text:`Praktyki ≥ ${RULES.minPraktyki} ECTS (masz ${details.sumPr})`},
      {ok:checks.HS,text:`HS ≥ ${RULES.minHS} ECTS (masz ${details.sumHS})`},
      {ok:checks.OWI,text:`OWI ≥ ${RULES.minOWI} ECTS (masz ${details.sumOWI})`},
      {ok:checks.E,text:`E ≥ ${RULES.minE} ECTS (masz ${details.sumE})`},
      {ok:checks.ANG,text:`ANGIELSKI: obecny`}
    ];
    rows.forEach(r=>{const d=document.createElement("div");d.className=`check ${r.ok?"ok":"bad"}`;d.innerHTML=`<span class="dot"></span><span class="text">${r.text}</span>`;cl.appendChild(d)})
  }
  function serialize(){
    const semesters=[];
    Array.from(semestersEl.children).forEach(sem=>{
      const courses=Array.from(qs(".courses",sem).children).map(row=>{
        const subject=qs(".subject",row).value||"";
        const ects=Number(qs(".ects",row).value)||0;
        const types=Array.from(qs(".type-select",row).selectedOptions).map(o=>o.value);
        const tags=Array.from(qs(".tags-select",row).selectedOptions).map(o=>o.value);
        return{subject,ects,types,tags}
      });
      if(courses.length)semesters.push({courses})
    });
    const status=computeStatus();
    return{semesters,status}
  }
  function deserialize(obj){
    semestersEl.innerHTML="";
    if(!obj||!obj.semesters||!obj.semesters.length){addSemester();return}
    obj.semesters.forEach(semData=>{
      const sem=createSemester();
      const box=qs(".courses",sem);
      box.innerHTML="";
      semData.courses.forEach(c=>{
        const row=createCourseRow();
        qs(".subject",row).value=c.subject||"";
        qs(".ects",row).value=c.ects||0;
        const typeSel=qs(".type-select",row);
        const tagsSel=qs(".tags-select",row);
        (c.tags||[]).forEach(t=>{if(![...tagsSel.options].some(o=>o.value===t)){const o=document.createElement("option");o.value=t;o.textContent=t;tagsSel.appendChild(o)}});
        [...typeSel.options].forEach(o=>o.selected=(c.types||[]).includes(o.value));
        [...tagsSel.options].forEach(o=>o.selected=(c.tags||[]).includes(o.value));
        box.appendChild(row)
      });
      semestersEl.appendChild(sem)
    });
    renumberSemesters();recalcECTS();renderChecklist();updateSaveMode()
  }
  function downloadJSON(name,data){
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url)
  }
  function isAllInputsEmpty(){
    const courses=getAllCourses();
    if(courses.length===0)return true;
    return courses.every(c=>!c.subject&&(!c.ects||c.ects===0)&&c.types.length===0&&c.tags.length===0)
  }
  function updateSaveMode(){
    if(isAllInputsEmpty()){
      btnSave.textContent="Wczytaj";
      btnSave.classList.add("secondary");
      btnSave.classList.remove("primary")
    }else{
      btnSave.textContent="Zapisz";
      btnSave.classList.add("primary");
      btnSave.classList.remove("secondary")
    }
  }
  function onDataChanged(){recalcECTS();renderChecklist();updateSaveMode()}
  addSemester();renderChecklist();updateSaveMode();
  document.getElementById("btn-add-course").addEventListener("click",addCourseToCurrent);
  document.getElementById("btn-add-semester").addEventListener("click",addSemester);
  btnSave.addEventListener("click",()=>{
    if(isAllInputsEmpty()){fileInput.click()}else{downloadJSON("uwr-plan.json",serialize())}
  });
  fileInput.addEventListener("change",e=>{
    const f=e.target.files&&e.target.files[0];if(!f)return;
    const r=new FileReader();
    r.onload=()=>{try{deserialize(JSON.parse(r.result))}catch{alert("Nieprawidłowy plik JSON")}finally{fileInput.value=""}};
    r.readAsText(f)
  })
});
