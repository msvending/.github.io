document.addEventListener("DOMContentLoaded", () => {

const canvas = document.getElementById("canvas");
const libraryEl = document.getElementById("library");
const statusEl = document.getElementById("status");

const wInput = document.getElementById("wInput");
const hInput = document.getElementById("hInput");
const layoutInput = document.getElementById("layoutInput");

const dimLabel = document.getElementById("dimLabel");
const gridLabel = document.getElementById("gridLabel");

const fileInput = document.getElementById("fileInput");
const applyBtn = document.getElementById("applyBtn");
const clearBtn = document.getElementById("clearBtn");

let state = {
  canvas:{ width:800, height:900, rowLayout:[3,3,3] },
  library:[],
  items:[]
};

const uid = () => Math.random().toString(16).slice(2);

function clamp(n,min,max){ return Math.max(min,Math.min(max,n)); }

function parseLayout(text){
  return text.split(/[, ]+/)
    .map(x=>parseInt(x))
    .filter(x=>!isNaN(x) && x>0);
}

function buildSections(){
  const {width,height,rowLayout} = state.canvas;
  const rows = rowLayout.length;
  const rowH = height/rows;
  const sections=[];
  for(let r=0;r<rows;r++){
    const cols=rowLayout[r];
    const colW=width/cols;
    for(let c=0;c<cols;c++){
      sections.push({
        r,c,
        x:c*colW,
        y:r*rowH,
        w:colW,
        h:rowH
      });
    }
  }
  return sections;
}

function renderSections(){
  document.querySelectorAll(".section").forEach(x=>x.remove());
  buildSections().forEach(s=>{
    const div=document.createElement("div");
    div.className="section";
    div.style.left=s.x+"px";
    div.style.top=s.y+"px";
    div.style.width=s.w+"px";
    div.style.height=s.h+"px";
    canvas.appendChild(div);
  });
}

function applySettings(){
  const width=parseInt(wInput.value);
  const height=parseInt(hInput.value);
  const layout=parseLayout(layoutInput.value);

  state.canvas={width,height,rowLayout:layout};

  canvas.style.width=width+"px";
  canvas.style.height=height+"px";

  dimLabel.textContent=width+" × "+height;
  gridLabel.textContent=layout.join(",");

  renderSections();
  renderItems();
  statusEl.textContent="Applied.";
}

function renderLibrary(){
  libraryEl.innerHTML="";
  state.library.forEach(item=>{
    const div=document.createElement("div");
    div.className="libItem";
    div.draggable=true;

    div.addEventListener("dragstart",e=>{
      e.dataTransfer.setData("id",item.id);
    });

    const img=document.createElement("img");
    img.src=item.src;
    div.appendChild(img);

    libraryEl.appendChild(div);
  });
}

function renderItems(){
  document.querySelectorAll(".item").forEach(x=>x.remove());

  state.items.forEach(it=>{
    const div=document.createElement("div");
    div.className="item";
    div.style.left=it.x+"px";
    div.style.top=it.y+"px";
    div.style.width=it.w+"px";
    div.style.height=it.h+"px";

    const img=document.createElement("img");
    img.src=it.src;
    div.appendChild(img);

    // Remove on double click
    div.addEventListener("dblclick",()=>{
      state.items=state.items.filter(x=>x.id!==it.id);
      renderItems();
    });

    // Remove on right click
    div.addEventListener("contextmenu",(e)=>{
      e.preventDefault();
      state.items=state.items.filter(x=>x.id!==it.id);
      renderItems();
    });

    enableDrag(div,it);
    canvas.appendChild(div);
  });
}

function enableDrag(el,it){
  let startX,startY,baseX,baseY;

  el.addEventListener("pointerdown",e=>{
    el.setPointerCapture(e.pointerId);
    startX=e.clientX;
    startY=e.clientY;
    baseX=it.x;
    baseY=it.y;
  });

  el.addEventListener("pointermove",e=>{
    if(!el.hasPointerCapture(e.pointerId)) return;
    const dx=e.clientX-startX;
    const dy=e.clientY-startY;
    it.x=clamp(baseX+dx,0,state.canvas.width-it.w);
    it.y=clamp(baseY+dy,0,state.canvas.height-it.h);
    el.style.left=it.x+"px";
    el.style.top=it.y+"px";
  });

  el.addEventListener("pointerup",e=>{
    el.releasePointerCapture(e.pointerId);
  });
}

canvas.addEventListener("dragover",e=>e.preventDefault());

canvas.addEventListener("drop",e=>{
  e.preventDefault();
  const id=e.dataTransfer.getData("id");
  const lib=state.library.find(x=>x.id===id);
  if(!lib) return;

  const rect=canvas.getBoundingClientRect();
  const x=e.clientX-rect.left;
  const y=e.clientY-rect.top;

  state.items.push({
    id:uid(),
    src:lib.src,
    x:x-50,
    y:y-50,
    w:100,
    h:100
  });

  renderItems();
});

fileInput.addEventListener("change",async()=>{
  for(const f of fileInput.files){
    const reader=new FileReader();
    reader.onload=()=>{
      state.library.push({id:uid(),src:reader.result});
      renderLibrary();
    };
    reader.readAsDataURL(f);
  }
});

applyBtn.addEventListener("click",applySettings);
clearBtn.addEventListener("click",()=>{
  state.items=[];
  renderItems();
});

applySettings();
});
