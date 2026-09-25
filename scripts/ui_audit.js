const { chromium }=require('playwright');
const assert=require('node:assert/strict');
const fs=require('fs');
const base=process.env.BASE_URL,hub=process.env.HUB_GYM_ID,puffin='aec16956-3793-4543-873b-4412646ca1eb';
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

async function clickGym(page,name){
 const card=page.locator('.gym-card').filter({hasText:name});
 await card.waitFor({state:'visible',timeout:20000});
 await card.click();
 await page.waitForFunction(()=>!!sessionStorage.getItem('hybrid-gym-id'),null,{timeout:20000});
}
async function waitForGymContext(page,gymId){
 await page.waitForFunction(id=>sessionStorage.getItem('hybrid-gym-id')===id,gymId,{timeout:20000});
 assert.equal(await page.evaluate(()=>localStorage.getItem('hybrid-last-gym-id')),gymId);
}
async function universalLogin(page){
 await page.goto(base+'login.html?ui_audit='+encodeURIComponent(process.env.HYBRID_BUILD_SHA),{waitUntil:'domcontentloaded',timeout:30000});
 assert.match(await page.title(),/Sign in .* HybridOne/i);
 await page.locator('#email').fill(process.env.AUDIT_EMAIL);
 await page.locator('#password').fill(process.env.UI_AUDIT_PASS);
 await page.locator('#signIn').click();
 await page.waitForURL(url=>url.pathname.endsWith('/choose-gym.html'),{timeout:20000});
 await page.locator('.gym-card').first().waitFor({state:'visible',timeout:20000});
 const text=await page.locator('#gyms').innerText();
 assert.match(text,/Hybrid Hub/);
 assert.match(text,/Puffin Performance/);
 assert.equal(await page.locator('.gym-card').count(),2);
 console.log('Universal login produced the two-gym chooser');
}
async function verifySwitchJourney(page,label){
 await universalLogin(page);
 await clickGym(page,'Hybrid Hub');
 await waitForGymContext(page,hub);
 await page.waitForTimeout(900);

 // Account menu is present on the dashboard source and must expose Switch gym.
 await page.goto(base+'index.html?gym_id='+encodeURIComponent(hub)+'&switch_probe=1',{waitUntil:'domcontentloaded',timeout:30000});
 await page.locator('.userchip').waitFor({state:'visible',timeout:20000});
 await page.locator('.userchip').click();
 await page.locator('#accountSwitchGymBtn').waitFor({state:'visible',timeout:20000});
 assert.match(await page.locator('#accountGymContext').innerText(),/Hybrid Hub/i);
 console.log(label+' account menu exposes Switch gym');
 await page.locator('#accountSwitchGymBtn').click();
 await page.waitForURL(url=>url.pathname.endsWith('/choose-gym.html')&&url.searchParams.get('switch')==='1',{timeout:20000});

 await clickGym(page,'Puffin Performance');
 await waitForGymContext(page,puffin);
 console.log(label+' switched from Hybrid Hub to Puffin Performance');

 // The global sidebar/current-gym control must also take a multi-gym user back to the chooser.
 await page.goto(base+'index.html?gym_id='+encodeURIComponent(puffin)+'&switch_probe=2',{waitUntil:'domcontentloaded',timeout:30000});
 await page.locator('.hybrid-gym-switchable').waitFor({state:'visible',timeout:20000});
 await page.locator('.hybrid-gym-switchable').click();
 await page.waitForURL(url=>url.pathname.endsWith('/choose-gym.html')&&url.searchParams.get('switch')==='1',{timeout:20000});
 console.log(label+' sidebar gym control opens the chooser');

 await clickGym(page,'Hybrid Hub');
 await waitForGymContext(page,hub);
 console.log(label+' switched back to Hybrid Hub');
}

async function runViewport(browser,label,viewport){
 const context=await browser.newContext({viewport}),page=await context.newPage(),consoleErrors=[];
 page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
 await verifySwitchJourney(page,label);
 const results=[];
 for(const [name,route] of routes){
  const hi=route.indexOf('#'),path=hi>=0?route.slice(0,hi):route,hash=hi>=0?route.slice(hi):'';
  const url=base+path+'?gym_id='+encodeURIComponent(hub)+'&ui_audit='+encodeURIComponent(process.env.HYBRID_BUILD_SHA)+hash;
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
 fs.writeFileSync('ui-audit/'+label+'-audit.json',JSON.stringify({label,viewport,results,consoleErrors},null,2));
 await context.close();
}
(async()=>{const browser=await chromium.launch({headless:true});try{await runViewport(browser,'desktop',{width:1440,height:1000});await runViewport(browser,'mobile',{width:390,height:844})}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});