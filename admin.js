const SIZES=["XS","S","M","L","XL","XXL"],KEY="dress-dream-products-v1";
const seed=[{id:1,name:"The Elara Midi Dress",category:"Dresses",price:2499,tag:"NEW ARRIVAL",image:"https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=700&q=85",description:"A graceful silhouette for special moments.",variants:[{color:"Wine",stock:{XS:2,S:5,M:8,L:5,XL:3,XXL:1}},{color:"Black",stock:{XS:1,S:3,M:4,L:3,XL:2,XXL:1}}]},{id:2,name:"The Ivory Edit Top",category:"Tops",price:1299,tag:"BESTSELLER",image:"https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?auto=format&fit=crop&w=700&q=85",description:"An effortless everyday essential.",variants:[{color:"Ivory",stock:{XS:2,S:5,M:6,L:4,XL:2,XXL:1}}]},{id:3,name:"The Noor Ensemble",category:"Traditional",price:3299,tag:"LIMITED EDITION",image:"https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=700&q=85",description:"A timeless traditional-inspired look.",variants:[{color:"Emerald",stock:{XS:1,S:3,M:4,L:3,XL:2,XXL:1}},{color:"Maroon",stock:{XS:1,S:2,M:3,L:2,XL:1,XXL:0}}]}];
let products;try{products=JSON.parse(localStorage.getItem(KEY));if(!Array.isArray(products)||!products.length)products=seed;}catch(e){products=seed;}
const $=id=>document.getElementById(id),money=n=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(n);
function migrate(p){if(!Array.isArray(p.variants))p.variants=[{color:"Default",stock:p.stock||{}}];return p;}
function stockFields(variants=[]){$("variantStockFields").innerHTML=variants.map((v,i)=>`<div class="variant-stock-block"><h3>${v.color}</h3><div class="stock-inputs">${SIZES.map(s=>`<div><label>${s}</label><input type="number" min="0" step="1" id="v${i}_${s}" value="${Number(v.stock?.[s]||0)}"></div>`).join("")}</div></div>`).join("");}
function buildFromNames(names,old=[]){return names.map(name=>{const prior=old.find(v=>v.color.toLowerCase()===name.toLowerCase());return {color:name,stock:{...(prior?.stock||{})}};});}
function render(){products=products.map(migrate);$("statProducts").textContent=products.length;$("statUnits").textContent=products.reduce((n,p)=>n+p.variants.reduce((a,v)=>a+SIZES.reduce((b,s)=>b+Number(v.stock?.[s]||0),0),0),0);$("statSold").textContent=products.filter(p=>p.variants.every(v=>SIZES.every(s=>Number(v.stock?.[s]||0)===0))).length;$("adminProducts").innerHTML=products.length?products.map(p=>{const units=p.variants.reduce((n,v)=>n+SIZES.reduce((a,s)=>a+Number(v.stock?.[s]||0),0),0);return `<article class="admin-product"><img src="${p.image}" alt=""><div><h3>${p.name}</h3><p>${p.category} · ${money(p.price)} · ${units} units</p><p>${p.variants.map(v=>`${v.color}: ${SIZES.reduce((a,s)=>a+Number(v.stock?.[s]||0),0)} units`).join(" | ")}</p></div><div class="admin-actions"><button data-edit="${p.id}">EDIT</button><button class="delete" data-delete="${p.id}">DELETE</button></div></article>`;}).join(""):'<p class="admin-help">No products yet.</p>';}
function reset(){ $("productForm").reset();$("productId").value="";$("formTitle").textContent="Add a new piece";$("cancelEdit").style.display="none";$("variantStockFields").innerHTML="";$("imagePreview").style.display="none";}
$("buildStock").addEventListener("click",()=>{const names=[...new Set($("productColors").value.split(",").map(x=>x.trim()).filter(Boolean))];if(!names.length){alert("Enter at least one colour.");return;}const old=window.editingVariants||[];const variants=buildFromNames(names,old);stockFields(variants);});
function compressUploadedImage(file){
 return new Promise((resolve,reject)=>{
  if(!file||!file.type.startsWith("image/")){reject(new Error("Please choose a valid image file."));return;}
  const reader=new FileReader();
  reader.onerror=()=>reject(new Error("Could not read the selected image."));
  reader.onload=()=>{
   const img=new Image();
   img.onerror=()=>reject(new Error("Could not open this image."));
   img.onload=()=>{
    const max=1400,scale=Math.min(1,max/Math.max(img.width,img.height));
    const canvas=document.createElement("canvas");canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);
    const ctx=canvas.getContext("2d");ctx.drawImage(img,0,0,canvas.width,canvas.height);
    resolve(canvas.toDataURL("image/jpeg",0.82));
   };
   img.src=reader.result;
  };
  reader.readAsDataURL(file);
 });
}
$("productImageFile").addEventListener("change",()=>{
 const file=$("productImageFile").files[0],preview=$("imagePreview");
 if(!file){preview.style.display="none";return;}
 const reader=new FileReader();reader.onload=()=>{preview.src=reader.result;preview.style.display="block";};reader.readAsDataURL(file);
});
$("productForm").addEventListener("submit",async e=>{
 e.preventDefault();
 const names=[...new Set($("productColors").value.split(",").map(x=>x.trim()).filter(Boolean))];
 if(!names.length){alert("Enter at least one colour.");return;}
 if(!$("variantStockFields").children.length){alert("Click CREATE STOCK FIELDS and enter stock for each colour and size.");return;}
 const file=$("productImageFile").files[0],url=$("productImage").value.trim();
 if(!file&&!url){alert("Please upload a product photo or enter an image URL.");return;}
 const button=e.submitter||$("productForm").querySelector('[type="submit"]');button.disabled=true;button.textContent="SAVING…";
 try{
  const id=$("productId").value?Number($("productId").value):Date.now();
  const old=products.find(x=>x.id===id);
  const image=file?await compressUploadedImage(file):url;
  const variants=names.map((color,i)=>{const stock={};SIZES.forEach(s=>{const input=$(`v${i}_${s}`);stock[s]=Math.max(0,Number(input?.value||0));});return {color,stock};});
  const p={id,name:$("productName").value.trim(),category:$("productCategory").value,price:Number($("productPrice").value),image,description:$("productDescription").value.trim(),tag:$("productTag").value.trim()||"DRESS DREAMS",variants};
  const ix=products.findIndex(x=>x.id===id);if(ix>=0)products[ix]=p;else products.unshift(p);
  localStorage.setItem(KEY,JSON.stringify(products));window.editingVariants=[];render();reset();alert("Product saved. The photo and inventory are stored in this browser.");
 }catch(err){alert(err.message||"Could not save the product. Try a smaller image.");}
 finally{button.disabled=false;button.textContent="SAVE PRODUCT →";}
});
$("adminProducts").addEventListener("click",e=>{const edit=e.target.closest("[data-edit]"),del=e.target.closest("[data-delete]");if(edit){const p=products.find(x=>x.id===Number(edit.dataset.edit));$("productId").value=p.id;$("productName").value=p.name;$("productCategory").value=p.category;$("productPrice").value=p.price;$("productImage").value=p.image.startsWith("data:")?"":p.image;$("imagePreview").src=p.image;$("imagePreview").style.display="block";$("productDescription").value=p.description||"";$("productTag").value=p.tag||"";$("productColors").value=p.variants.map(v=>v.color).join(", ");window.editingVariants=p.variants.map(v=>({color:v.color,stock:{...v.stock}}));stockFields(p.variants);$("formTitle").textContent="Edit product";$("cancelEdit").style.display="block";window.scrollTo({top:0,behavior:"smooth"});}if(del&&confirm("Delete this product?")){products=products.filter(p=>p.id!==Number(del.dataset.delete));localStorage.setItem(KEY,JSON.stringify(products));render();}});$("cancelEdit").addEventListener("click",()=>{window.editingVariants=[];reset();});products=products.map(migrate);render();