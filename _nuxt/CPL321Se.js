import{d as p,r as t,c as _,e as f,f as s,i as v,n,H as l,ao as h,ap as g,aa as y,k as V}from"./C-8nz1pJ.js";import{r}from"./B6otZEb9.js";import"./76o_WpOd.js";const C={class:"summary"},k={class:"content"},w=p({__name:"Callout",props:{type:{type:String,default:"info",validator(a){return["info","success","warning","danger","primary"].includes(a)}},modelValue:{required:!1,default:()=>t(!1)}},emits:["update:modelValue"],setup(a,{emit:c}){const i=a,u=c,e=t(i.modelValue),d=()=>{e.value=!e.value,u("update:modelValue",e.value)};return(o,B)=>{const m=y;return _(),f("div",{class:n(["callout",[a.type]])},[s("span",{class:"preview",onClick:d},[s("span",C,[r(o.$slots,"summary",{},void 0,!0)]),v(m,{name:"heroicons-outline:chevron-right",class:n(["icon",[l(e)&&"rotate"]])},null,8,["class"])]),h(s("div",k,[r(o.$slots,"content",{},void 0,!0)],512),[[g,l(e)]])],2)}}}),I=V(w,[["__scopeId","data-v-6a4bb3a2"]]);export{I as default};
