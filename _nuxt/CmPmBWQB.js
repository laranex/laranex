import{d,G as a,W as S,c as b,e as v,f as w,n as I,H as f,k as _,u as P,aq as C,a1 as x,r as D,L as c}from"./C-8nz1pJ.js";import E from"./5kl9PNM1.js";import"./DXic_067.js";import"./ClVuWoBC.js";import"./zwqb7pzE.js";import"./HW4L8dEG.js";import"./BmeAgugv.js";import"./B6otZEb9.js";import"./76o_WpOd.js";import"./Bmjsa84v.js";import"./BOwfIIFv.js";import"./Dmwdynta.js";const j=d({__name:"Ellipsis",props:{width:{type:String,default:"10rem"},height:{type:String,default:"10rem"},zIndex:{type:String,default:"10"},top:{type:String,default:"0"},left:{type:String,default:"auto"},right:{type:String,default:"auto"},blur:{type:String,default:"50px"},colors:{type:Array,default:()=>["rgba(0, 71, 225, 0.22)","rgba(26, 214, 255, 0.22)","rgba(0, 220, 130, 0.22)"]}},setup(e){const n=a(()=>((t=s)=>t.top)()),o=a(()=>((t=s)=>t.left)()),r=a(()=>((t=s)=>t.right)()),l=a(()=>((t=s)=>t.zIndex)()),m=a(()=>((t=s)=>t.width)()),g=a(()=>((t=s)=>t.height)()),y=a(()=>((t=s)=>`blur(${t.blur})`)()),h=a(()=>((t=s)=>{var i,p,u;return`linear-gradient(97.62deg, ${(i=t==null?void 0:t.colors)==null?void 0:i[0]} 2.27%, ${(p=t==null?void 0:t.colors)==null?void 0:p[1]} 50.88%, ${(u=t==null?void 0:t.colors)==null?void 0:u[2]} 98.48%)`})()),s=e,{$pinceau:$}=S(s,void 0,{_cCN_top:n,_eih_insetInlineStart:o,_IfB_insetInlineEnd:r,_SsE_zIndex:l,_wj8_maxWidth:m,_t33_height:g,_Jfd_filter:y,_yUj_background:h});return(t,i)=>(b(),v("div",{class:I(["ellipsis",[f($)]])},i[0]||(i[0]=[w("div",{class:"ellipsis-item"},null,-1)]),2))}}),z=_(j,[["__scopeId","data-v-7a24e4f4"]]);async function B(e){P();const n=f(e);{const{data:o}=await C(`nuxt-component-meta${n?`-${n}`:""}`,()=>$fetch(`/api/component-meta${n?`/${n}`:""}`));return a(()=>o.value)}}const N=d({props:{component:{type:String,required:!0},props:{type:Object,required:!1,default:()=>({})}},async setup(e){const n=a(()=>x(e.component)),o=D({...e.props}),r=await B(e.component);return{as:n,formProps:o,componentData:r}},render(e){const n=Object.entries(this.$slots).reduce((o,[r,l])=>{if(r.startsWith("component-")){const m=r.replace("component-","");o[m]=l}return o},{});return c("div",{class:"component-playground"},[c("div",{class:"component-playground-wrapper"},[c(z,{class:"component-playground-ellipsis",blur:"5vw",height:"100%",width:"100%"}),c(e.as,{...e.formProps,class:"component-playground-component"},{...n})]),c(E,{modelValue:e.formProps,componentData:e.componentData,"onUpdate:modelValue":o=>e.formProps=o})])}}),M=_(N,[["__scopeId","data-v-2f2a1e91"]]);export{M as default};
