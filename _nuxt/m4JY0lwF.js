import{d,aA as f,x,G as a,c as _,e as z,az as S,H as c,k as I}from"./Bv-qzeFl.js";const y=d({__name:"IconCSS",props:{name:{type:String,required:!0},size:{type:String,default:""}},setup(l){var r;f(n=>({"3bb513ac":c(m)}));const e=x();(r=e==null?void 0:e.nuxtIcon)!=null&&r.aliases;const s=l,p=a(()=>{var n;return(((n=e==null?void 0:e.nuxtIcon)==null?void 0:n.aliases)||{})[s.name]||s.name}),m=a(()=>`url('https://api.iconify.design/${p.value.replace(":","/")}.svg')`),o=a(()=>{var t,i,u;if(!s.size&&typeof((t=e.nuxtIcon)==null?void 0:t.size)=="boolean"&&!((i=e.nuxtIcon)!=null&&i.size))return;const n=s.size||((u=e.nuxtIcon)==null?void 0:u.size)||"1em";return String(Number(n))===n?`${n}px`:n});return(n,t)=>(_(),z("span",{style:S({width:c(o),height:c(o)})},null,4))}}),b=I(y,[["__scopeId","data-v-f38c2550"]]);export{b as default};
