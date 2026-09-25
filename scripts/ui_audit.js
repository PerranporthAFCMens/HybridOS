const { chromium }=require('playwright');
const fs=require('fs');
const base=process.env.BASE_URL,gym=process.env.HUB_GYM_ID;
const routes=[
['dashboard','index.html'],['community','community.html'],['classes','classes.html'],
['class-setup','class-setup.html'],['workouts','workout-builder.html'],
['services-resources','admin-operations.html#resources'],['staff-management','admin-operations.html#staff'],
['staff-access','staff-permissions.html'],['admin-access','admin-access.html'],
['memberships','member-memberships.html'],['door-access','access-settings.html'],
['reporting','reporting.html'],['communications','communications.html'],
['member-view-settings','member-view-settings.html'],['resource-availability','resource-availability.html'],
['gym-layout','gym-layout.html'],['staff-view','staff.html'],['member-preview','member-preview.html'],
['social','social.html'],['groups','groups.html'],['integrations','integrations.html']
];
async function runViewport(browser,label,viewport){
 const context=await browser.newContext({viewport}),page=await context.newPage(),consoleErrors=[];
 page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
 await page.goto(base+'hybrid-hub-login.html?gym_id='+encodeURIComponent(gym),{waitUntil:'domcontentloaded',timeout:30000});
 await page.locator('#email').fill(process.env.AUDIT_EMAIL);
 await page.locator('#password').fill(process.env.UI_AUDIT_PASS);
 await page.locator('#signIn').click();
 await page.waitForURL(url=>url.href.includes('admin.html?gym_id='),{timeout:20000});
 const results=[];
 for(const [name,route] of routes){
  const hi=route.indexOf('#'),path=hi>=0?route.slice(0,hi):route,hash=hi>=0?route.slice(hi):'';
  const url=base+path+'?gym_id='+encodeURIComponent(gym)+'&ui_audit='+encodeURIComponent(process.env.HYBRID_BUILD_SHA)+hash;
  try{
   await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});await page.waitForTimeout(1600);
   await page.addStyleTag({content:'*{animation-duration:0s!important;transition-duration:0s!important;caret-color:transparent!important}'}).catch(()=>{});
   const metrics=await page.evaluate(()=>{
    const visible=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};
    const main=document.querySelector('.main,.groups-main,.admin-frame-main')||document.body,h=document.querySelector('.top h1,.groups-top h1,h1');
    const cards=[...document.querySelectorAll('.card,.panel,.report-card,.group-card')].filter(visible),buttons=[...document.querySelectorAll('.btn,button')].filter(visible);
    return {title:document.title,pathname:location.pathname+location.hash,bodyWidth:document.body.scrollWidth,viewportWidth:document.documentElement.clientWidth,overflowX:document.body.scrollWidth>document.documentElement.clientWidth+2,heading:h?h.textContent.trim():'',headingSize:h?getComputedStyle(h).fontSize:'',mainBg:getComputedStyle(main).backgroundColor,cardCount:cards.length,buttonCount:buttons.length,firstCard:cards[0]?{radius:getComputedStyle(cards[0]).borderRadius,bg:getComputedStyle(cards[0]).backgroundColor}:null,firstButton:buttons[0]?{radius:getComputedStyle(buttons[0]).borderRadius,minHeight:getComputedStyle(buttons[0]).minHeight,fontWeight:getComputedStyle(buttons[0]).fontWeight}:null};
   });
   await page.screenshot({path:'ui-audit/'+label+'-'+name+'.png',fullPage:true});
   results.push({name,url:page.url(),metrics});console.log(label+' '+name+' '+JSON.stringify(metrics));
  }catch(err){results.push({name,error:String(err.message||err),url:page.url()});console.error(label+' FAILED '+name+' '+String(err.message||err))}
 }
 fs.writeFileSync('ui-audit/'+label+'-audit.json',JSON.stringify({label,viewport,results,consoleErrors},null,2));await context.close();
}
(async()=>{const browser=await chromium.launch({headless:true});try{await runViewport(browser,'desktop',{width:1440,height:1000});await runViewport(browser,'mobile',{width:390,height:844})}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
